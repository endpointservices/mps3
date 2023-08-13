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

const isManifest = (obj: any): obj is ManifestState => {
  if (!obj) return false;
  return (
    obj.version !== undefined &&
    typeof obj.version === "number" &&
    obj.files !== undefined &&
    typeof obj.files === "object" &&
    Object.values(obj.files).every(
      (file: any) =>
        typeof file === "object" &&
        file.version !== undefined &&
        typeof file.version === "string"
    )
  );
};

export class Subscriber {
  ref: ResolvedRef;
  handler: (value: any) => void;
  lastVersion?: VersionId;
  constructor(
    ref: ResolvedRef,
    handler: (value: JSONValue | DeleteValue) => void
  ) {
    this.ref = ref;
    this.handler = handler;
  }

  notify(version: VersionId | undefined, value: JSONValue | DeleteValue) {
    if (version === this.lastVersion) return;
    else {
      this.lastVersion = version;
      this.handler(value);
    }
  }
}

export class Manifest {
  service: MPS3;
  ref: ResolvedRef;
  subscribers = new Set<Subscriber>();
  poller?: Timer;
  cache?: HttpCacheEntry<ManifestState>;

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
    console.log(
      `observeVersionId ${versionId} in ${[
        ...this.writtenOperations.keys(),
      ]} pending ${this.pendingWrites.size}`
    );
    if (this.writtenOperations.has(versionId)) {
      console.log(`clearing pending write for observeVersionId ${versionId}`);
      const operation = this.writtenOperations.get(versionId)!;
      this.pendingWrites.delete(operation);
      this.writtenOperations.delete(versionId);
    }
  }

  async get(): Promise<ManifestState> {
    return this.getLatest().then((state) => state || this.cache?.data!);
  }

  async getLatest(): Promise<ManifestState | undefined> {
    console.log("getLatest");
    try {
      console.log("getLatest: s1");
      const response = await this.service._getObject2<ManifestState>({
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

      console.log("getLatest: s2");
      const objects = await this.service.s3Client.send(
        new ListObjectsV2Command({
          Bucket: this.ref.bucket,
          Prefix: this.ref.key,
          StartAfter: this.ref.key + "@" + lowerWaterMark,
        })
      );
      // Play the missing patches over the base state, oldest first
      if (objects.Contents === undefined) return EMPTY_STATE;

      console.log(`replay state ${JSON.stringify(objects.Contents)}`);
      let state = undefined;
      for (let index = 0; index < objects.Contents.length; index++) {
        const key = objects.Contents[index].Key!;
        const step = await this.service._getObject2<ManifestState>({
          ref: {
            bucket: this.ref.bucket,
            key,
          },
        });
        if (!state) {
          console.log(`base ${key} ${JSON.stringify(step.data)}`);
          state = step.data;
        } else {
          console.log(`patch ${key} ${JSON.stringify(step.data?.update)}`);
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
      console.log("resolved data", JSON.stringify(state));
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
    if (state === undefined) return; // no changes

    console.log(`POLL ${JSON.stringify(state)}`);
    this.subscribers.forEach(async (subscriber) => {
      const fileState: FileState | null | undefined =
        state.files[url(subscriber.ref)];
      if (fileState) {
        console.log(`NOTIFY ${url(subscriber.ref)} ${fileState.version}`);
        const fileContent = await this.service._getObject({
          ref: subscriber.ref,
          version: fileState.version,
        });
        subscriber.notify(fileState.version, fileContent);
      } else if (fileState === null) {
        console.log(`NOTIFY ${url(subscriber.ref)} DELETE`);
        subscriber.notify(undefined, undefined);
      }
    });
  }

  async updateContent(
    values: OMap<ResolvedRef, JSONValue | DeleteValue>,
    write: Promise<Map<ResolvedRef, string | DeleteValue>>
  ) {
    this.pendingWrites.set(write, values);
    console.log(`updateContent pending ${this.pendingWrites.size}`);

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
        ref: {
          key: this.ref.key + "@" + version,
          bucket: this.ref.bucket,
        },
        value: state,
      });
      // update pollers with write to known location
      const response = await this.service._putObject({
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
    console.log("getVersion");
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
