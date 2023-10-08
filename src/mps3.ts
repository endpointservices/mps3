import {
  DeleteObjectCommandInput,
  DeleteObjectCommandOutput,
  GetObjectCommandInput,
  GetObjectCommandOutput,
  PutObjectCommandInput,
  PutObjectCommandOutput,
  S3ClientConfig,
} from "@aws-sdk/client-s3";
import { AwsClient } from "aws4fetch";
import { FetchFn, S3ClientLite } from "S3ClientLite";
import { OMap } from "OMap";
import { Manifest } from "manifest";
import { DeleteValue, JSONValue, Ref, ResolvedRef, url, uuid } from "types";
import { UseStore, createStore, get, set } from "idb-keyval";

export interface MPS3Config {
  /** @internal */
  label?: string;
  /**
   * Bucket to use by default
   */
  defaultBucket: string;
  /**
   * Default manifest to use if one is not specified in an
   * operation's options
   * @defaultValue { bucket: defaultBucket, key: "manifest.json" }
   */
  defaultManifest?: string | Ref;
  /**
   * Feature toggle to use versioning on content objects. If not
   * using versioning content keys are appended with `@<version>`.
   * Host bucket must have versioning enabled for this to work.
   * @defaultValue false
   */
  useVersioning?: boolean;
  /** @internal TODO we broke this */
  useChecksum?: boolean;

  /**
   * Frequency in milliseconds subscribers poll for changes.
   * Each poll consumes a GET API request, but minimal egress
   * due to If-None-Match request optimizations.
   * @defaultValue 1000
   */
  pollFrequency?: number;
  /**
   * S3ClientConfig, only some features are supported. Please report feature requests.
   * @see https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-s3/interfaces/s3clientconfig.html
   * @defaultValue 1000
   */
  s3Config: S3ClientConfig;

  /**
   * DOMParser to use to parse XML responses from S3. The browser has one
   * but in other Javascript environments you may need to provide one.
   * @defaultValue new window.DOMParser()
   */
  parser?: DOMParser;

  /**
   * Should the client write to upstreams?
   */
  online?: boolean;

  /**
   * Should the client write to upstreams?
   */
  offlineStorage?: boolean;
}

interface ResolvedMPS3Config extends MPS3Config {
  label: string;
  defaultManifest: ResolvedRef;
  useVersioning: boolean;
  useChecksum: boolean;
  pollFrequency: number;
  online: boolean;
  offlineStorage: boolean;
}

interface GetResponse<T> {
  $metadata: {
    httpStatusCode?: number;
  };
  ETag?: string;
  data: T | undefined;
}

export class MPS3 {
  /** @internal */
  config: ResolvedMPS3Config;
  /** @internal */
  s3ClientLite: S3ClientLite;
  /** @internal */
  manifests = new OMap<ResolvedRef, Manifest>(url);
  /** @internal */
  memCache = new OMap<
    GetObjectCommandInput,
    Promise<GetObjectCommandOutput & { data: any }>
  >(
    (input) =>
      `${input.Bucket}${input.Key}${input.VersionId}${input.IfNoneMatch}`,
  );

  /** @internal */
  diskCache?: UseStore;

  /** @internal */
  endpoint: string;

  constructor(config: MPS3Config) {
    this.config = {
      ...config,
      label: config.label || "default",
      useChecksum: config.useChecksum === false ? false : true,
      online: config.online === false ? false : true,
      offlineStorage: config.offlineStorage === false ? false : true,
      useVersioning: config.useVersioning || false,
      pollFrequency: config.pollFrequency || 1000,
      defaultManifest: {
        bucket: (<Ref>config.defaultManifest)?.bucket || config.defaultBucket,
        key:
          typeof config.defaultManifest == "string"
            ? config.defaultManifest
            : config.defaultManifest?.key || "manifest.json",
      },
    };

    if (this.config.s3Config?.credentials instanceof Function)
      throw Error("We can't do that yet");

    this.endpoint =
      <string>config.s3Config.endpoint ||
      `https://s3.${config.s3Config.region}.amazonaws.com`;

    let fetchFn: FetchFn;

    if (this.config.s3Config?.credentials) {
      const client = new AwsClient({
        accessKeyId: this.config.s3Config.credentials.accessKeyId!, // required, akin to AWS_ACCESS_KEY_ID
        secretAccessKey: this.config.s3Config.credentials.secretAccessKey!, // required, akin to AWS_SECRET_ACCESS_KEY
        sessionToken: this.config.s3Config.credentials.sessionToken!, // akin to AWS_SESSION_TOKEN if using temp credentials
        region: <string>this.config.s3Config.region || "us-east-1",
        service: "s3",
        retries: 0,
      });
      fetchFn = (...args) => client.fetch(...args);
    } else {
      fetchFn = (global || window).fetch.bind(global || window);
    }

    if (this.config.offlineStorage) {
      const dbName = `mps3-${this.config.label}`;
      this.diskCache = createStore(dbName, "v0");
    }

    this.s3ClientLite = new S3ClientLite(
      this.config.online ? fetchFn : () => new Promise(() => {}),
      this.endpoint,
      config.parser || new DOMParser(),
    );
  }
  /** @internal */
  getOrCreateManifest(ref: ResolvedRef): Manifest {
    if (!this.manifests.has(ref)) {
      const manifest = new Manifest(this, ref);
      this.manifests.set(ref, manifest);
      if (this.config.offlineStorage) {
        const dbName = `mps3-${this.config.label}-${ref.bucket}-${ref.key}`;
        const db = createStore(dbName, "v0");
        console.log(`${this.config.label} Restoring manifest from ${dbName}`);
        manifest.load(db);
      }
    }
    return this.manifests.get(ref)!;
  }

  public async get(
    ref: string | Ref,
    options: {
      manifest?: Ref;
    } = {},
  ): Promise<JSONValue | DeleteValue> {
    const manifestRef: ResolvedRef = {
      ...this.config.defaultManifest,
      ...options.manifest,
    };
    const manifest = this.getOrCreateManifest(manifestRef);
    const contentRef: ResolvedRef = {
      bucket:
        (<Ref>ref).bucket ||
        this.config.defaultBucket ||
        this.config.defaultManifest.bucket,
      key: typeof ref === "string" ? ref : ref.key,
    };

    const inflight = await manifest.operationQueue.flatten();
    if (inflight.has(contentRef)) {
      console.log(
        `${this.config.label} GET (cached) ${contentRef} ${inflight.get(
          contentRef,
        )}`,
      );
      return inflight.get(contentRef);
    }
    const version = await manifest.getOptimisticVersion(contentRef);
    if (version === undefined) return undefined;

    return (
      await this._getObject<any>({
        operation: "GET",
        ref: contentRef,
        version: version,
      })
    ).data;
  }

  /** @internal */
  async _getObject<T>(args: {
    operation: string;
    ref: ResolvedRef;
    version?: string;
    ifNoneMatch?: string;
  }): Promise<GetResponse<T>> {
    let command: GetObjectCommandInput;
    if (this.config.useVersioning) {
      command = {
        Bucket: args.ref.bucket,
        Key: args.ref.key,
        IfNoneMatch: args.ifNoneMatch,
        ...(args.version && { VersionId: args.version }),
      };
    } else {
      command = {
        Bucket: args.ref.bucket,
        Key: `${args.ref.key}${args.version ? `@${args.version}` : ""}`,
        IfNoneMatch: args.ifNoneMatch,
      };
    }
    if (this.memCache.has(command)) {
      console.log(
        `${this.config.label} ${args.operation} (mem cached) ${command.Bucket}/${command.Key}`,
      );
      return this.memCache.get(command)!;
    }
    const key = `${command.Bucket}${command.Key}${command.VersionId}`;
    if (this.diskCache) {
      const cached = await get<
        GetObjectCommandOutput & { data: T | undefined }
      >(key, this.diskCache);
      if (cached) {
        console.log(
          `${this.config.label} ${args.operation} (disk cached) ${key}`,
        );
        this.memCache.set(command, Promise.resolve(cached));
        return cached;
      }
    }

    if (!this.config.online) {
      throw new Error(
        `${this.config.label} Offline and value not cached for ${key}`,
      );
    }

    const work = this.s3ClientLite
      .getObject(command)
      .then(async (apiResponse) => {
        const response: GetResponse<T> = {
          $metadata: apiResponse.$metadata,
          ETag: apiResponse.ETag,
          data: <T | undefined>apiResponse.Body,
        };
        console.log(
          `${this.config.label} ${args.operation} ${args.ref.bucket}/${args.ref.key}@${args.version} => ${response.VersionId}`,
        );
        return response;
      })
      .catch((err: any) => {
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
      });

    this.memCache.set(command, work);
    if (this.diskCache) {
      work.then((response) => {
        set(
          `${command.Bucket}${command.Key}${command.VersionId}`,
          response,
          this.diskCache!,
        ).then(() =>
          console.log(
            `${this.config.label} STORE ${command.Bucket}${command.Key}`,
          ),
        );
      });
    }
    return work;
  }

  public async delete(
    ref: string | Ref,
    options: {
      manifests?: Ref[];
    } = {},
  ) {
    return this.putAll(new Map([[ref, undefined]]), options);
  }

  public async put(
    ref: string | Ref,
    value: JSONValue | DeleteValue,
    options: {
      manifests?: Ref[];
      await?: "local" | "remote";
    } = {},
  ) {
    if (!this.diskCache) throw new Error("No store");
    return this.putAll(new Map([[ref, value]]), options);
  }

  public async putAll(
    values: Map<string | Ref, JSONValue | DeleteValue>,
    options: {
      manifests?: Ref[];
      await?: "local" | "remote";
      isLoad?: boolean;
    } = {},
  ) {
    const resolvedValues = new Map<ResolvedRef, JSONValue | DeleteValue>(
      [...values].map(([ref, value]) => [
        {
          bucket:
            (<Ref>ref).bucket ||
            this.config.defaultBucket ||
            this.config.defaultManifest.bucket,
          key: typeof ref === "string" ? ref : ref.key,
        },
        value,
      ]),
    );

    const manifests: ResolvedRef[] = (
      options?.manifests || [this.config.defaultManifest]
    ).map((ref) => ({
      ...this.config.defaultManifest,
      ...ref,
    }));

    return this._putAll(resolvedValues, {
      manifests,
      await: options.await || this.config.online ? "remote" : "local",
    });
  }
  /** @internal */
  async _putAll(
    values: Map<ResolvedRef, JSONValue | DeleteValue>,
    options: {
      manifests: ResolvedRef[];
      await: "local" | "remote";
      isLoad?: boolean;
    },
  ) {
    const webValues: Map<ResolvedRef, JSONValue | DeleteValue> = new Map();
    const contentVersions: Promise<Map<ResolvedRef, string | DeleteValue>> =
      new Promise(async (resolve, reject) => {
        const results = new Map<ResolvedRef, string | DeleteValue>();
        const contentOperations: Promise<any>[] = [];
        values.forEach((value, contentRef) => {
          if (value !== undefined) {
            let version = this.config.useVersioning ? undefined : uuid(); // TODO timestamped versions
            webValues.set(contentRef, value);

            contentOperations.push(
              this._putObject({
                operation: "PUT_CONTENT",
                ref: contentRef,
                value,
                version,
              }).then((fileUpdate) => {
                if (this.config.useVersioning) {
                  if (fileUpdate.VersionId === undefined) {
                    console.error(fileUpdate);
                    throw Error(
                      `Bucket ${contentRef.bucket} is not version enabled!`,
                    );
                  } else {
                    version = fileUpdate.VersionId;
                  }
                }
                results.set(contentRef, version);
              }),
            );
          } else {
            contentOperations.push(
              this._deleteObject({
                ref: contentRef,
              }).then((_) => {
                results.set(contentRef, undefined);
              }),
            );
          }
        });
        await Promise.all(contentOperations).catch(reject);
        resolve(results);
      });

    return Promise.all(
      options.manifests.map((ref) => {
        const manifest = this.getOrCreateManifest(ref);
        return manifest.updateContent(webValues, contentVersions, {
          await: options.await,
          isLoad: options.isLoad === true,
        });
      }),
    );
  }
  /** @internal */
  async _putObject(args: {
    operation: string;
    ref: ResolvedRef;
    value: any;
    version?: string;
  }): Promise<PutObjectCommandOutput> {
    const content: string = JSON.stringify(args.value, null, 2);
    let command: PutObjectCommandInput;
    if (this.config.useVersioning) {
      command = {
        Bucket: args.ref.bucket,
        Key: args.ref.key,
        ContentType: "application/json",
        Body: content,
        ...(this.config.useChecksum && {
          ChecksumSHA256: await sha256(content),
        }),
      };
    } else {
      command = {
        Bucket: args.ref.bucket,
        Key: `${args.ref.key}${args.version ? `@${args.version}` : ""}`,
        ContentType: "application/json",
        Body: content,
        ...(this.config.useChecksum && {
          ChecksumSHA256: await sha256(content),
        }),
      };
    }

    const response = await this.s3ClientLite.putObject(command);
    console.log(
      `${this.config.label} ${args.operation} ${command.Bucket}/${command.Key} => ${response.VersionId}`,
    );

    if (this.diskCache) {
      const diskKey = `${command.Bucket}${command.Key}${
        args.version || response.VersionId
      }`;
      await set(
        diskKey,
        {
          $metadata: {
            httpStatusCode: 200,
          },
          etag: response.ETag,
          data: JSON.parse(content),
        },
        this.diskCache,
      ).then(() => console.log(`${this.config.label} STORE ${diskKey}`));
    }

    return response;
  }
  /** @internal */
  async _deleteObject(args: {
    operation?: string;
    ref: ResolvedRef;
  }): Promise<DeleteObjectCommandOutput> {
    const command: DeleteObjectCommandInput = {
      Bucket: args.ref.bucket,
      Key: args.ref.key,
    };
    const response = await this.s3ClientLite.deleteObject(command);
    console.log(
      `${this.config.label} ${args.operation || "DELETE"} ${args.ref.bucket}/${
        args.ref.key
      } => ${response.VersionId}`,
    );
    return response;
  }

  /**
   * Listen to a key for changes
   * @param key
   * @param handler callback to be notified of changes
   * @returns unsubscribe function
   */
  public subscribe(
    key: string | Ref,
    handler: (value: JSONValue | DeleteValue, error?: Error) => void,
    options?: {
      manifest?: Ref;
    },
  ): () => void {
    const manifestRef: ResolvedRef = {
      ...this.config.defaultManifest,
      ...options?.manifest,
    };
    const keyRef: ResolvedRef = {
      key: typeof key === "string" ? key : key.key,
      bucket:
        (<Ref>key).bucket || this.config.defaultBucket || manifestRef.bucket,
    };
    const manifest = this.getOrCreateManifest(manifestRef);
    const unsubscribe = manifest.subscribe(keyRef, handler);
    this.get(keyRef, {
      manifest: manifestRef,
    })
      .then((initial) => {
        console.log(`${this.config.label} NOTIFY (initial) ${url(keyRef)}`);
        // if the data is cached we don't want the subscriber called in the same tick as
        // the unsubscribe return value will not be initialized
        queueMicrotask(() => {
          handler(initial, undefined);
          manifest.poll();
        });
      })
      .catch((error) => {
        handler(undefined, error);
      });

    return unsubscribe;
  }

  /** @internal */
  refresh(): Promise<unknown> {
    return Promise.all(
      [...this.manifests.values()].map((manifest) => manifest.poll()),
    );
  }
  /** @internal */
  get subscriberCount(): number {
    return [...this.manifests.values()].reduce(
      (count, manifest) => count + manifest.subscriberCount,
      0,
    );
  }
}
/** @internal */
async function sha256(message: string) {
  // TODO: this code is actually already in aws4fetch
  // encode as UTF-8
  const msgBuffer = new TextEncoder().encode(message);

  // hash the message
  const arrayBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);

  // convert ArrayBuffer to base64-encoded string
  return [...new Uint8Array(arrayBuffer)]
    .map((bytes) => bytes.toString(16).padStart(2, "0"))
    .join("");
}
