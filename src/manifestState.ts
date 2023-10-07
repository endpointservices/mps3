import { apply } from "json";
import { Manifest } from "manifest";
import { JSONValue, clone } from "types";
import * as time from "time";

interface FileState {
  version: string;
}

type Merge = any;

export interface ManifestState {
  previous: string; // key of previous snapshot this change was based on
  files: {
    [url: string]: FileState;
  };
  // JSON-merge-patch update that *this* operation was, the files do not include this
  update: Merge;
}

const INITIAL_STATE: ManifestState & JSONValue = {
  previous: ".",
  files: {},
  update: {},
};

interface HttpCacheEntry<T> {
  etag: string;
  data: T;
}

export class ManifestState {
  authoritative_key: string = "";
  authoritative_state: ManifestState = clone(INITIAL_STATE);
  optimistic_state: ManifestState = clone(INITIAL_STATE);

  cache?: HttpCacheEntry<ManifestState>;

  constructor(private manifest: Manifest) {}

  async getLatest(): Promise<ManifestState> {
    try {
      const poll = await this.manifest.service._getObject<string>({
        operation: "POLL_TIME",
        ref: this.manifest.ref,
        ifNoneMatch: this.cache?.etag,
      });
      if (poll.$metadata.httpStatusCode === 304) {
        return this.authoritative_state
      }

      if (poll.data === undefined) {
        this.authoritative_key = "."; // before digits
      } else {
        this.authoritative_key = poll.data;
      }

      const objects = await this.manifest.service.s3ClientLite.listObjectV2({
        Bucket: this.manifest.ref.bucket,
        Prefix: this.manifest.ref.key,
        StartAfter: this.authoritative_key,
      });

      // Play the missing patches over the base state, oldest first
      if (objects.Contents === undefined) {
        this.authoritative_state = clone(INITIAL_STATE);
        this.optimistic_state = clone(INITIAL_STATE);
        return this.authoritative_state;
      }

      const settledPoint = `${this.manifest.ref.key}@${time.lowerTimeBound()}`;

      // Find the most recent patch, whose base state is settled, and that we have a record for
      for (let index = objects.Contents.length - 1; index >= 0; index--) {
        const key = objects.Contents[index].Key!;
        if (key == this.manifest.ref.key) continue; // skip manifest read
        const ref = {
          bucket: this.manifest.ref.bucket,
          key,
        };
        const step = await this.manifest.service._getObject<ManifestState>({
          operation: "LOOK_BACK",
          ref,
        });

        if (step.data === undefined) {
          await this.manifest.service._deleteObject({
            operation: "CLEANUP",
            ref,
          });
          continue;
        }
        if (step.data.previous < settledPoint) {
          this.authoritative_key = step.data.previous;
          this.authoritative_state = step.data;
          break;
        }
      }

      for (let index = 0; index < objects.Contents.length; index++) {
        const key = objects.Contents[index].Key!;
        if (key == this.manifest.ref.key) continue; // skip manifest read
        if (key < this.authoritative_key) {
          // Its old we can skip
          continue;
        }

        // console.log(`step ${key} from ${this.authoritative_key}`);
        const step = await this.manifest.service._getObject<ManifestState>({
          operation: "SWEEP",
          ref: {
            bucket: this.manifest.ref.bucket,
            key,
          },
        });
        const stepVersionid = key.substring(key.lastIndexOf("@") + 1);

        if (stepVersionid >= settledPoint) {
          console.log("Optimistic update");
          this.optimistic_state = apply(
            this.optimistic_state,
            step.data?.update
          );
          // we cannot replay state into the inflight zone, its not authorative yet
        } else {
          // console.log("settled update");
          this.authoritative_state = apply(
            this.authoritative_state,
            step.data?.update
          );
          this.optimistic_state = apply(
            this.optimistic_state,
            step.data?.update
          );
          this.authoritative_key = key;
        }
        this.manifest.observeVersionId(stepVersionid);
      }

      return this.authoritative_state;
    } catch (err: any) {
      if (err.name === "NoSuchKey") {
        this.authoritative_state = INITIAL_STATE;
        return this.authoritative_state;
      } else {
        throw err;
      }
    }
  }
}
