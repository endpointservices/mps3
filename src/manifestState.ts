import { JSONArrayless, JSONArraylessObject, merge } from "json";
import { Manifest } from "manifest";
import { clone } from "json";
import { JSONValue } from "json";
import * as time from "time";
import { UseStore, get, set } from "idb-keyval";

interface FileState extends JSONArraylessObject {
  version: string;
}

type Merge = any;

export interface ManifestFile extends JSONArraylessObject {
  previous: string; // key of previous snapshot this change was based on
  files: {
    [url: string]: FileState;
  };
  // JSON-merge-patch update that *this* operation was, the files do not include this
  update: Merge;
}
const MANIFEST_KEY = "manifest";
const INITIAL_STATE: ManifestFile & JSONValue = {
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
  authoritative_state: ManifestFile = clone(INITIAL_STATE);
  optimistic_state: ManifestFile = clone(INITIAL_STATE);

  loading?: Promise<unknown>;
  cache?: HttpCacheEntry<ManifestFile>;
  db?: UseStore;

  constructor(private manifest: Manifest) {}

  async restore(db: UseStore) {
    this.db = db;
    this.loading = get(MANIFEST_KEY, db).then((loaded) => {
      if (loaded) {
        this.authoritative_state = loaded;
        this.optimistic_state = loaded;
        this.manifest.service.config.log(`RESTORE ${MANIFEST_KEY}`);
      }
    });
  }

  async getLatest(): Promise<ManifestFile> {
    if (this.loading) await this.loading;
    this.loading = undefined;

    if (!this.manifest.service.config.online) {
      return this.authoritative_state;
    }
    try {
      const poll = await this.manifest.service._getObject<string>({
        operation: "POLL_TIME",
        ref: this.manifest.ref,
        ifNoneMatch: this.cache?.etag,
        useCache: false,
      });
      if (poll.$metadata.httpStatusCode === 304) {
        return this.authoritative_state;
      }

      if (poll.data === undefined) {
        this.authoritative_key = "."; // before digits
      } else {
        this.authoritative_key = poll.data;
      }

      const [objects, dt] = await time.measure(
        this.manifest.service.s3ClientLite.listObjectV2({
          Bucket: this.manifest.ref.bucket,
          Prefix: this.manifest.ref.key,
          StartAfter: this.authoritative_key,
        })
      );

      this.manifest.service.config.log(
        `${dt}ms LIST ${this.manifest.ref.bucket}/${this.manifest.ref.key}`
      );

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
        const step = await this.manifest.service._getObject<ManifestFile>({
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

        // this.manifest.service.config(`step ${key} from ${this.authoritative_key}`);
        const step = await this.manifest.service._getObject<ManifestFile>({
          operation: "SWEEP",
          ref: {
            bucket: this.manifest.ref.bucket,
            key,
          },
        });
        const stepVersionid = key.substring(key.lastIndexOf("@") + 1);

        if (stepVersionid >= settledPoint) {
          this.manifest.service.config.log("Optimistic update");
          this.optimistic_state = merge(
            this.optimistic_state,
            step.data?.update
          )!;
          // we cannot replay state into the inflight zone, its not authorative yet
        } else {
          // console.log("settled update");
          this.authoritative_state = merge<ManifestFile>(
            this.authoritative_state,
            step.data?.update
          )!;
          this.optimistic_state = merge(
            this.optimistic_state,
            step.data?.update
          )!;
          this.authoritative_key = key;
        }
        this.manifest.observeVersionId(stepVersionid);
      }
      if (this.db) set(MANIFEST_KEY, this.authoritative_state, this.db);
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
