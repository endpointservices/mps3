import { OMap } from "OMap";
import { MPS3 } from "mps3";
import * as time from "time";
import {
  DeleteValue,
  JSONValue,
  Operation,
  ResolvedRef,
  VersionId,
  url,
  uuid,
} from "types";
import { apply } from "json-merge-patch";
import { ListObjectsV2Command } from "@aws-sdk/client-s3";
//import { ListObjectsV2Command } from "@aws-sdk/client-s3";

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

const INITIAL_STATE: ManifestState = {
  files: {},
  update: {},
};

interface HttpCacheEntry<T> {
  etag: string;
  data: T;
}

export class Subscriber {
  ref: ResolvedRef;
  handler: (value: any) => void;
  lastVersion?: VersionId;
  queue = Promise.resolve();
  constructor(
    ref: ResolvedRef,
    handler: (value: JSONValue | DeleteValue) => void
  ) {
    this.ref = ref;
    this.handler = handler;
  }

  notify(
    label: string,
    version: VersionId | undefined,
    content: Promise<JSONValue | DeleteValue>
  ) {
    this.queue = this.queue
      .then(() => content)
      .then((response) => {
        if (version === this.lastVersion) return;
        else {
          console.log(`${label} NOTIFY ${url(this.ref)} ${version}`);
          this.lastVersion = version;
          this.handler(response);
        }
      });
  }
}

export class Manifest {
  service: MPS3;
  ref: ResolvedRef;
  subscribers = new Set<Subscriber>();
  poller?: Timer;
  cache?: HttpCacheEntry<ManifestState>;
  pollInProgress: boolean = false;

  authoritative_key: string = "";
  authoritative_state = INITIAL_STATE;

  // Pending writes iterate in insertion order
  // The key, promise, indicated the pending IO operations
  pendingWrites: Map<Operation, OMap<ResolvedRef, JSONValue | DeleteValue>> =
    new Map();

  writtenOperations: Map<VersionId, Operation> = new Map();

  constructor(service: MPS3, ref: ResolvedRef, options?: {}) {
    this.service = service;
    this.ref = ref;
  }
  observeVersionId(versionId: VersionId) {
    if (this.writtenOperations.has(versionId)) {
      //console.log(`clearing pending write for observeVersionId ${versionId}`);
      const operation = this.writtenOperations.get(versionId)!;
      this.pendingWrites.delete(operation);
      this.writtenOperations.delete(versionId);
    }
  }

  async get(): Promise<ManifestState> {
    return this.getLatest().then((state) => state || this.cache?.data!);
  }

  async getLatest(): Promise<ManifestState | undefined> {
    try {
      const poll = await this.service._getObject<string>({
        operation: "POLL_TIME",
        ref: this.ref,
        ifNoneMatch: this.cache?.etag,
      });
      if (poll.$metadata.httpStatusCode === 304) {
        return undefined;
      }

      if (poll.data === undefined) {
        this.authoritative_key = "."; // before digits
      } else {
        this.authoritative_key = poll.data;
      }

      const objects = await this.service.s3ClientLite.listObjectV2(
        new ListObjectsV2Command({
          Bucket: this.ref.bucket,
          Prefix: this.ref.key,
          StartAfter: this.authoritative_key,
        })
      );

      // Play the missing patches over the base state, oldest first
      if (objects.Contents === undefined) {
        this.authoritative_state = INITIAL_STATE;
        return this.authoritative_state;
      }

      // Find the most recent patch, whose base state is settled, and that we have a record for
      for (let index = objects.Contents.length - 1; index >= 0; index--) {
        const key = objects.Contents[index].Key!;
        if (key == this.ref.key) continue; // skip manifest read
        const settledPoint = time.lowerTimeBound();
        const step = await this.service._getObject<ManifestState>({
          operation: "LOOK_BACK",
          ref: {
            bucket: this.ref.bucket,
            key,
          },
        });
        if (step.data === undefined) throw new Error("empty data");

        if (step.data.previous < settledPoint) {
          this.authoritative_key = step.data.previous;
          this.authoritative_state = step.data;
          console.log(
            `accepts lookback because ${step.data.previous} < ${settledPoint}`
          );
          break;
        } else {
          console.log(
            `reject lookback because ${step.data.previous} >= ${settledPoint}`
          );
        }
      }

      let state = this.authoritative_state;
      for (let index = 0; index < objects.Contents.length; index++) {
        const key = objects.Contents[index].Key!;
        if (key == this.ref.key) continue; // skip manifest read
        console.log(`step ${key} from ${this.authoritative_key}`);
        const step = await this.service._getObject<ManifestState>({
          operation: "SWEEP",
          ref: {
            bucket: this.ref.bucket,
            key,
          },
        });
        const stepVersionid = key.substring(key.lastIndexOf("@") + 1);
        const settledPoint = time.lowerTimeBound();

        if (stepVersionid >= settledPoint) {
          // we cannot replay state into the inflight zone, its not authorative yet

          console.log(
            `cannot use ${stepVersionid} >= ${settledPoint} as it could be inflight`
          );
        } else {
          console.log(`updating authority with settled patch ${stepVersionid}`);
          state = apply(state, step.data?.update);
          this.authoritative_key = key;
        }
        this.observeVersionId(stepVersionid);
      }

      /*
      Disable poll cache, as we sometimes need to gather the same thing twice to catchup
      this.cache = {
        etag: poll.ETag!,
        data: state,
      };*/
      this.authoritative_state = state;
      return state;
    } catch (err: any) {
      if (err.name === "NoSuchKey") {
        this.authoritative_state = INITIAL_STATE;
        return this.authoritative_state;
      } else {
        throw err;
      }
    }
  }

  async poll() {
    if (this.pollInProgress) return;
    this.pollInProgress = true;

    if (this.subscriberCount === 0 && this.poller) {
      clearInterval(this.poller);
      this.poller = undefined;
    }
    if (this.subscriberCount > 0 && !this.poller) {
      this.poller = setInterval(
        () => this.poll(),
        this.service.config.pollFrequency
      );
    }

    const state = await this.getLatest();
    if (state === undefined) {
      this.pollInProgress = false;
      return; // no changes
    }
    this.subscribers.forEach(async (subscriber) => {
      const fileState: FileState | null | undefined =
        state.files[url(subscriber.ref)];
      if (fileState) {
        const content = this.service._getObject<any>({
          operation: "GET_CONTENT",
          ref: subscriber.ref,
          version: fileState.version,
        });
        subscriber.notify(
          this.service.config.label,
          fileState.version,
          content.then((res) => res.data)
        );
      } else if (fileState === null) {
        subscriber.notify(
          this.service.config.label,
          undefined,
          Promise.resolve(undefined)
        );
      }
    });
    this.pollInProgress = false;
  }

  async updateContent(
    values: OMap<ResolvedRef, JSONValue | DeleteValue>,
    write: Promise<Map<ResolvedRef, string | DeleteValue>>
  ) {
    this.pendingWrites.set(write, values);
    // console.loggit push(`updateContent pending ${this.pendingWrites.size}`);

    try {
      const update = await write;
      const state = await this.get();
      state.previous = this.authoritative_key;
      state.update = {
        files: {},
      };
      for (let [ref, version] of update) {
        const fileUrl = url(ref);
        if (version) {
          const fileState = {
            version: version,
          };
          state.update.files[fileUrl] = fileState;
        } else {
          state.update.files[fileUrl] = null;
        }
      }
      // put versioned write
      const version = time.upperTimeBound() + "_" + uuid().substring(0, 2);
      const manifest_key = this.ref.key + "@" + version;
      await this.service._putObject({
        operation: "PUT_MANIFEST",
        ref: {
          key: manifest_key,
          bucket: this.ref.bucket,
        },
        value: state,
      });
      // update pollers with write to known location
      const response = await this.service._putObject({
        operation: "PUT_POLL",
        ref: {
          key: this.ref.key,
          bucket: this.ref.bucket,
        },
        value: this.authoritative_key, // indicates how far we need to look back
      });

      this.writtenOperations.set(version, write);
      this.poll();
      return response;
    } catch (err) {
      console.error(err);
      this.pendingWrites.delete(write);
      throw err;
    }
  }

  async getVersion(ref: ResolvedRef): Promise<string | undefined> {
    const state = await this.get();
    return state.files[url(ref)]?.version;
  }

  subscribe(
    keyRef: ResolvedRef,
    handler: (value: JSONValue | undefined) => void
  ): () => void {
    console.log(`SUBSCRIBE ${url(keyRef)} ${this.subscriberCount + 1}`);
    const sub = new Subscriber(keyRef, handler);
    this.subscribers.add(sub);
    return () => this.subscribers.delete(sub);
  }

  get subscriberCount(): number {
    return this.subscribers.size;
  }
}
