import {
  DeleteObjectCommandInput,
  DeleteObjectCommandOutput,
  GetObjectCommandInput,
  GetObjectCommandOutput,
  PutObjectCommandInput,
  PutObjectCommandOutput,
  S3,
} from "@aws-sdk/client-s3";
import { apply } from "json-merge-patch";
import { OMap } from "OMap";
import { uuidRegex } from "regex";

export interface MPS3Config {
  defaultBucket: string;
  defaultManifest?: Ref;
  api: S3;
}

export type JSONValue =
  | string
  | number
  | boolean
  | null
  | { [x: string]: JSONValue }
  | Array<JSONValue>;

export type DeleteValue = undefined;

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

export interface Ref {
  bucket?: string;
  key: string;
}

const url = (ref: Ref): string => `${ref.bucket}/${ref.key}`;
const parseUrl = (url: string): ResolvedRef => {
  const [bucket, ...key] = url.split("/");
  return {
    bucket,
    key: key.join("/"),
  };
};
const eq = (a: Ref, b: Ref) => a.bucket === b.bucket && a.key === b.key;
const files = (state: ManifestState): Set<File> =>
  Object.entries(state.files).reduce(
    (set, [url, file]) => set.add(new File(parseUrl(url), file)),
    new Set<File>()
  );

export interface ResolvedRef extends Ref {
  bucket: string;
  key: string;
}

class Manifest {
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

  get subscriberCount(): number {
    return this.subscribers.size;
  }
}

class Subscriber {
  manifest: Manifest;
  ref: ResolvedRef;
  handler: (value: any) => void;
  constructor(
    ref: ResolvedRef,
    manifest: Manifest,
    handler: (value: any) => void
  ) {
    this.manifest = manifest;
    this.ref = ref;
    this.handler = handler;
  }
}

async function sha256(message: string) {
  // encode as UTF-8
  const msgBuffer = new TextEncoder().encode(message);

  // hash the message
  const arrayBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);

  // convert ArrayBuffer to base64-encoded string
  return btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
}

export class MPS3 {
  config: MPS3Config;
  manifests = new OMap<ResolvedRef, Manifest>(url);
  defaultManifest: ResolvedRef;

  constructor(config: MPS3Config) {
    this.config = config;
    this.defaultManifest = {
      bucket: config.defaultManifest?.bucket || config.defaultBucket,
      key: config.defaultManifest?.key || "manifest.json",
    };
  }

  getOrCreateManifest(ref: ResolvedRef): Manifest {
    if (!this.manifests.has(ref)) {
      this.manifests.set(ref, new Manifest(this, ref));
    }
    return this.manifests.get(ref)!;
  }

  public async get(
    ref: string | Ref,
    options: {
      manifest?: Ref;
    } = {}
  ): Promise<JSONValue | undefined> {
    const manifestRef: ResolvedRef = {
      ...this.defaultManifest,
      ...options.manifest,
    };
    const manifest = this.getOrCreateManifest(manifestRef);
    const contentRef: ResolvedRef = {
      bucket:
        (<Ref>ref).bucket ||
        this.config.defaultBucket ||
        this.defaultManifest.bucket,
      key: typeof ref === "string" ? ref : ref.key,
    };
    let inCache = false;
    let cachedValue = undefined;
    for (let [operation, values] of manifest.pendingWrites) {
      if (values.has(contentRef)) {
        inCache = true;
        cachedValue = values.get(contentRef);
      }
    }
    if (inCache) {
      return cachedValue;
    }

    const version = await manifest.getVersion(contentRef);
    if (version === undefined) return undefined;
    return this._getObject({
      ref: contentRef,
      version: version,
    });
  }

  async _getObject(args: {
    ref: ResolvedRef;
    version?: string;
  }): Promise<JSONValue | DeleteValue> {
    const command: GetObjectCommandInput = {
      Bucket: args.ref.bucket,
      Key: args.ref.key,
      ...(args.version && { VersionId: args.version }),
    };
    try {
      const response = await this.config.api.getObject(command);
      if (!response.Body) return undefined;
      else {
        const payload = await response.Body.transformToString("utf-8");
        console.log(
          `GET ${args.ref.bucket}/${args.ref.key}@${args.version} => ${response.VersionId}\n${payload}`
        );
        return JSON.parse(payload);
      }
    } catch (err: any) {
      if (err.name === "NoSuchKey") return undefined;
      else throw err;
    }
  }

  async _getObject2<T>(args: {
    ref: ResolvedRef;
    version?: string;
    ifNoneMatch?: string;
  }): Promise<GetObjectCommandOutput & { data: T | undefined }> {
    const command: GetObjectCommandInput = {
      Bucket: args.ref.bucket,
      Key: args.ref.key,
      IfNoneMatch: args.ifNoneMatch,
      ...(args.version && { VersionId: args.version }),
    };
    try {
      const response = {
        ...(await this.config.api.getObject(command)),
        data: <T | undefined>undefined,
      };
      if (response.Body) {
        response.data = <T>(
          JSON.parse(await response.Body.transformToString("utf-8"))
        );
        console.log(
          `GET ${args.ref.bucket}/${args.ref.key}@${args.version} => ${
            response.VersionId
          }\n${JSON.stringify(response.data)}`
        );
      }
      return response;
    } catch (err: any) {
      if (err?.name === "304") {
        return {
          $metadata: {
            httpStatusCode: 304,
          },
          data: undefined,
        };
      } else {
        throw err;
      }
    }
  }
  public async put(
    ref: string | Ref,
    value: JSONValue | DeleteValue,
    options: {
      manifests?: Ref[];
    } = {}
  ) {
    return this.putAll(new Map([[ref, value]]), options);
  }

  public async putAll(
    values: Map<string | Ref, JSONValue | DeleteValue>,
    options: {
      manifests?: Ref[];
    } = {}
  ) {
    const resolvedValues = new OMap<ResolvedRef, JSONValue | DeleteValue>(
      url,
      [...values].map(([ref, value]) => [
        {
          bucket:
            (<Ref>ref).bucket ||
            this.config.defaultBucket ||
            this.defaultManifest.bucket,
          key: typeof ref === "string" ? ref : ref.key,
        },
        value,
      ])
    );

    const manifests: ResolvedRef[] = (
      options?.manifests || [this.defaultManifest]
    ).map((ref) => ({
      ...this.defaultManifest,
      ...ref,
    }));

    const operation = this._putAll(resolvedValues, {
      manifests,
    });

    manifests.forEach((manifestRef) => {
      const manifest = this.getOrCreateManifest(manifestRef);
      manifest.pendingWrites.set(operation, resolvedValues);
      operation.catch(() => {
        manifest.pendingWrites.delete(operation);
      });
    });

    return operation;
  }

  async _putAll(
    values: OMap<ResolvedRef, JSONValue | DeleteValue>,
    options: {
      manifests: ResolvedRef[];
    }
  ) {
    const contentVersions: Map<ResolvedRef, string | undefined> = new Map();
    const contentOperations: Promise<void>[] = [];
    values.forEach((value, contentRef) => {
      if (value !== undefined) {
        contentOperations.push(
          this._putObject({
            ref: contentRef,
            value,
          }).then((fileUpdate) => {
            if (
              fileUpdate.VersionId === undefined ||
              !fileUpdate.VersionId.match(uuidRegex)
            ) {
              console.error(fileUpdate);
              throw Error(
                `Bucket ${contentRef.bucket} is not version enabled!`
              );
            }
            contentVersions.set(contentRef, fileUpdate.VersionId);
          })
        );
      } else {
        contentOperations.push(
          this._deleteObject({
            ref: contentRef,
          }).then((_) => {
            contentVersions.set(contentRef, undefined);
          })
        );
      }
    });

    await Promise.all(contentOperations);

    await Promise.all(
      options.manifests.map((ref) => {
        const manifest = this.getOrCreateManifest(ref);
        return manifest.updateContent(contentVersions);
      })
    );
  }

  async _putObject(args: {
    ref: ResolvedRef;
    value: any;
  }): Promise<PutObjectCommandOutput> {
    console.log(`putObject ${url(args.ref)}`);
    const content: string = JSON.stringify(args.value, null, 2);
    const checksum = await sha256(content);
    const command: PutObjectCommandInput = {
      Bucket: args.ref.bucket,
      Key: args.ref.key,
      ContentType: "application/json",
      Body: content,
      ChecksumSHA256: checksum,
    };

    const response = await this.config.api.putObject(command);
    console.log(
      `PUT ${args.ref.bucket}/${args.ref.key} => ${response.VersionId}\n${content}`
    );

    return response;
  }

  async _deleteObject(args: {
    ref: ResolvedRef;
  }): Promise<DeleteObjectCommandOutput> {
    const command: DeleteObjectCommandInput = {
      Bucket: args.ref.bucket,
      Key: args.ref.key,
    };
    const response = await this.config.api.putObject(command);
    console.log(
      `DELETE ${args.ref.bucket}/${args.ref.key} => ${response.VersionId}`
    );
    return response;
  }

  public subscribe(
    key: string,
    handler: (value: JSONValue | DeleteValue) => void,
    options?: {
      bucket?: string;
      manifest?: Ref;
    }
  ): () => void {
    const manifestRef: ResolvedRef = {
      ...this.defaultManifest,
      ...options?.manifest,
    };
    const keyRef: ResolvedRef = {
      key: key,
      bucket:
        options?.bucket || this.config.defaultBucket || manifestRef.bucket,
    };
    const manifest = this.getOrCreateManifest(manifestRef);
    const subscriber = new Subscriber(keyRef, manifest, handler);
    manifest.subscribers.add(subscriber);
    this.get(keyRef, {
      manifest: manifestRef,
    }).then((initial) => {
      queueMicrotask(() => {
        handler(initial);
        manifest.poll();
      });
    });

    return () => {
      manifest.subscribers.delete(subscriber);
    };
  }

  get subscriberCount(): number {
    return [...this.manifests.values()].reduce(
      (count, manifest) => count + manifest.subscriberCount,
      0
    );
  }
}
