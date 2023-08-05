import { OMap } from "OMap";
import { MPS3 } from "mps3";
import { DeleteValue, JSONValue, ResolvedRef, eq, parseUrl, url } from "types";
import { apply } from "json-merge-patch";

interface FileState {
  version: string;
}

type Merge = any;

interface ManifestState {
  version: number;
  // TODO: the manifest should just be URLs which corresponde to the s3 URLs
  // this would scale beyond the s3 usecase and include regional endpoints etc.
  files: {
    [url: string]: FileState;
  };
  // The previous state this was based on
  // Writes made after this version will not have been included
  previous?: {
    url: string;
    version: string;
  };
  // JSON-merge-patch update that the last operation was
  update: Merge;
}

interface HttpCacheEntry<T> {
  etag: string;
  data: T;
}

class File implements FileState {
  ref: ResolvedRef;
  version: string;
  constructor(ref: ResolvedRef, state: FileState) {
    this.ref = ref;
    this.version = state.version;
  }
}
const files = (state: ManifestState): Set<File> =>
  Object.entries(state.files).reduce(
    (set, [url, file]) => set.add(new File(parseUrl(url), file)),
    new Set<File>()
  );

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
  constructor(ref: ResolvedRef, handler: (value: any) => void) {
    this.ref = ref;
    this.handler = handler;
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
  pendingWrites: Map<
    Promise<void>,
    OMap<ResolvedRef, JSONValue | DeleteValue>
  > = new Map();

  constructor(service: MPS3, ref: ResolvedRef, options?: {}) {
    this.service = service;
    this.ref = ref;
  }
  async get(): Promise<ManifestState> {
    try {
      const response = await this.service._getObject2<ManifestState>({
        ref: this.ref,
        ifNoneMatch: this.cache?.etag,
      });

      if (response.$metadata.httpStatusCode === 304) {
        return this.cache?.data!;
      }

      if (response.data === undefined) {
        return {
          version: 0,
          files: {},
          update: {},
        };
      }

      if (isManifest(response.data)) {
        const latestState: ManifestState = response.data;

        // First we confirm no versions were written while this one was in flight
        const previousVersion =
          await this.service.config.api.listObjectVersions({
            Bucket: this.ref.bucket,
            Prefix: this.ref.key,
            KeyMarker: this.ref.key,
            VersionIdMarker: response.VersionId,
            MaxKeys: 1, // Note we only look one version back
          });

        if (
          previousVersion.Versions === undefined ||
          previousVersion.Versions?.length == 0 ||
          previousVersion.Versions[0].VersionId ===
            latestState.previous?.version
        ) {
          // If that one key is the base the state was generated from, we're good
          // The is the common case for low load
          latestState.previous = {
            url: url(this.ref),
            version: response.VersionId!,
          };

          this.cache = {
            etag: response.ETag!,
            data: latestState,
          };

          return latestState;
        } else {
          // There have been some additional writes
          const previousVersions =
            await this.service.config.api.listObjectVersions({
              Bucket: this.ref.bucket,
              Prefix: this.ref.key,
              KeyMarker: this.ref.key,
              VersionIdMarker: response.VersionId,
              MaxKeys: 10,
            });

          if (previousVersions.Versions === undefined)
            throw new Error("No versions returned");

          const start = previousVersions.Versions?.findIndex(
            (version) => version.VersionId === latestState.previous?.version
          );

          if (start === undefined)
            throw new Error("Can't find previous state in search window");

          const baseStateRead = await this.service._getObject2<ManifestState>({
            ref: this.ref,
            version: latestState.previous?.version,
          });

          if (baseStateRead.data === undefined)
            throw new Error("Can't find base state");

          let state: ManifestState = baseStateRead.data;

          // Play the missing patches over the base state, oldest first
          console.log("replay state");
          for (let index = start - 1; index >= 0; index--) {
            const missingState = await this.service._getObject2<ManifestState>({
              ref: this.ref,
              version: previousVersions.Versions[index].VersionId,
            });
            const patch = missingState.data?.update;

            console.log("patch state", patch);
            state = apply(state, patch);
          }
          // include latest
          state = apply(state, response.data.update);
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
        }
      } else {
        throw new Error("Invalid manifest");
      }
    } catch (err: any) {
      if (err.name === "NoSuchKey") {
        return {
          version: 0,
          files: {},
          update: {},
        };
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
      this.poller = setInterval(() => this.poll(), 1000);
    }

    const state = await this.get();
    this.subscribers.forEach((subscriber) => {
      files(state).forEach(async (file) => {
        if (eq(file.ref, subscriber.ref)) {
          const fileContent = await this.service._getObject({
            ref: file.ref,
            version: file.version,
          });
          subscriber.handler(fileContent);
        }
      });
    });
  }

  async updateContent(update: Map<ResolvedRef, string | DeleteValue>) {
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

    return this.service._putObject({
      ref: this.ref,
      value: state,
    });
  }

  async getVersion(ref: ResolvedRef): Promise<string | undefined> {
    const state = await this.get();
    return state.files[url(ref)]?.version;
  }

  subscribe(
    keyRef: ResolvedRef,
    handler: (value: JSONValue | undefined) => void
  ): () => void {
    const sub = new Subscriber(keyRef, handler);
    this.subscribers.add(sub);
    return () => this.subscribers.delete(sub);
  }

  get subscriberCount(): number {
    return this.subscribers.size;
  }
}
