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
  // TODO: the manifest should just be URLs which corresponde to the s3 URLs
  // this would scale beyond the s3 usecase and include regional endpoints etc.
  files: {
    [url: string]: FileState;
  };
  // JSON-merge-patch update that the last operation was
  update: Merge;
}

const EMPTY_STATE: ManifestState = {
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
          this.handler(response.data);
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
    /*
    console.log(
      `observeVersionId ${versionId} in ${[
        ...this.writtenOperations.keys(),
      ]} pending ${this.pendingWrites.size}`
    );*/
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
      const response = await this.service._getObject<ManifestState>({
        operation: "POLL_TIME",
        ref: this.ref,
        ifNoneMatch: this.cache?.etag,
      });

      if (response.$metadata.httpStatusCode === 304) {
        return undefined;
      }

      if (response.data === undefined) {
        return EMPTY_STATE;
      }

      const lowerWaterMark = response.data;

      const objects = await this.service.s3ClientLite.listObjectV2(
        new ListObjectsV2Command({
          Bucket: this.ref.bucket,
          Prefix: this.ref.key,
          StartAfter: this.ref.key + "@" + lowerWaterMark,
        })
      );
      // Play the missing patches over the base state, oldest first
      if (objects.Contents === undefined) return EMPTY_STATE;

      let state = undefined;
      for (let index = 0; index < objects.Contents.length; index++) {
        const key = objects.Contents[index].Key!;
        const step = await this.service._getObject<ManifestState>({
          operation: "SWEEP",
          ref: {
            bucket: this.ref.bucket,
            key,
          },
        });
        if (!state) {
          state = step.data;
        } else {
          state = apply(state, step.data?.update);
        }
        this.observeVersionId(key.substring(key.lastIndexOf("@") + 1));
      }
      // reflect the catchup
      state.previous = {
        url: url(this.ref),
        version: response.VersionId!,
      };

      this.cache = {
        etag: response.ETag!,
        data: state,
      };
      return state;
    } catch (err: any) {
      if (err.name === "NoSuchKey") {
        return EMPTY_STATE;
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
          Promise.resolve({ data: null })
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
    // console.log(`updateContent pending ${this.pendingWrites.size}`);

    try {
      const update = await write;
      // the lower timebound pesimistically signals how far we are caught up to
      // we can do this just before we read the latest manifest state
      const lowerBound = time.lowerTimeBound();
      const state = await this.get();
      state.update = {
        files: {},
      };
      for (let [ref, version] of update) {
        const fileUrl = url(ref);
        if (version) {
          const fileState = {
            version: version,
          };
          state.files[fileUrl] = fileState;
          state.update.files[fileUrl] = fileState;
        } else {
          delete state.files[fileUrl];
          state.update.files[fileUrl] = null;
        }
      }
      // put versioned write
      const version = time.upperTimeBound() + "_" + uuid().substring(0, 2);
      await this.service._putObject({
        operation: "PUT_MANIFEST",
        ref: {
          key: this.ref.key + "@" + version,
          bucket: this.ref.bucket,
        },
        value: state,
      });
      // update pollers with write to known location
      const response = await this.service._putObject({
        operation: "PUT_TIME",
        ref: {
          key: this.ref.key,
          bucket: this.ref.bucket,
        },
        value: lowerBound,
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
