import {
  DeleteObjectCommand,
  DeleteObjectCommandInput,
  DeleteObjectCommandOutput,
  GetObjectCommand,
  GetObjectCommandInput,
  GetObjectCommandOutput,
  PutObjectCommand,
  PutObjectCommandInput,
  PutObjectCommandOutput,
  S3Client,
  S3ClientConfig,
} from "@aws-sdk/client-s3";
import { OMap } from "OMap";
import { Manifest } from "manifest";
import { DeleteValue, JSONValue, Ref, ResolvedRef, url, uuid } from "types";

export interface MPS3Config {
  defaultBucket: string;
  defaultManifest?: Ref;
  useVersioning?: boolean;
  useChecksum?: boolean;
  pollFrequency?: number;
  s3Config: S3ClientConfig;
}

interface ResolvedMPS3Config extends MPS3Config {
  defaultManifest: ResolvedRef;
  useVersioning: boolean;
  useChecksum: boolean;
  pollFrequency: number;
}

export class MPS3 {
  config: ResolvedMPS3Config;
  s3Client: S3Client;
  manifests = new OMap<ResolvedRef, Manifest>(url);

  constructor(config: MPS3Config) {
    this.config = {
      ...config,
      useChecksum: config.useChecksum === false ? false : true,
      useVersioning: config.useVersioning || false,
      pollFrequency: config.pollFrequency || 1000,
      defaultManifest: {
        bucket: config.defaultManifest?.bucket || config.defaultBucket,
        key: config.defaultManifest?.key || "manifest.json",
      },
    };

    this.s3Client = new S3Client(config.s3Config);
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
    let inCache = false;
    let cachedValue = undefined;
    for (const [_, values] of manifest.pendingWrites) {
      if (values.has(contentRef)) {
        inCache = true;
        cachedValue = values.get(contentRef);
      }
    }
    if (inCache) {
      console.log(`get (cached) ${url(contentRef)}`);
      return cachedValue;
    }

    const version = await manifest.getVersion(contentRef);
    if (version === undefined) return undefined;
    return (
      await this._getObject<any>({
        ref: contentRef,
        version: version,
      })
    ).data;
  }

  getCache = new OMap<
    GetObjectCommandInput,
    Promise<GetObjectCommandOutput & { data: any }>
  >(
    (input) =>
      `${input.Bucket}${input.Key}${input.VersionId}${input.IfNoneMatch}`,
  );

  async _getObject<T>(args: {
    ref: ResolvedRef;
    version?: string;
    ifNoneMatch?: string;
  }): Promise<GetObjectCommandOutput & { data: T | undefined }> {
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
    if (this.getCache.has(command)) {
      return await this.getCache.get(command)!;
    }

    const work = this.s3Client
      .send(new GetObjectCommand(command))
      .then(async (apiResponse) => {
        const response = {
          ...apiResponse,
          data: <T | undefined>undefined,
        };
        if (response.Body) {
          response.data = <T>(
            JSON.parse(await response.Body.transformToString("utf-8"))
          );
          console.log(
            `GET ${args.ref.bucket}/${args.ref.key}@${args.version} => ${
              response.VersionId
            }\n${JSON.stringify(response.data)}`,
          );
          this.getCache.set(command, work); // it be nice to cache this earlier but I hit some race conditions
        }
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
    } = {},
  ) {
    return this.putAll(new Map([[ref, value]]), options);
  }

  public async putAll(
    values: Map<string | Ref, JSONValue | DeleteValue>,
    options: {
      manifests?: Ref[];
    } = {},
  ) {
    const resolvedValues = new OMap<ResolvedRef, JSONValue | DeleteValue>(
      url,
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
    });
  }

  async _putAll(
    values: OMap<ResolvedRef, JSONValue | DeleteValue>,
    options: {
      manifests: ResolvedRef[];
    },
  ) {
    const contentVersions: Promise<Map<ResolvedRef, string | DeleteValue>> =
      new Promise(async (resolve, reject) => {
        const results = new Map<ResolvedRef, string | DeleteValue>();
        const contentOperations: Promise<any>[] = [];
        values.forEach((value, contentRef) => {
          if (value !== undefined) {
            let version = this.config.useVersioning ? undefined : uuid(); // TODO timestamped versions
            contentOperations.push(
              this._putObject({
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
        return manifest.updateContent(values, contentVersions);
      }),
    );
  }

  async _putObject(args: {
    ref: ResolvedRef;
    value: any;
    version?: string;
  }): Promise<PutObjectCommandOutput> {
    console.log(`putObject ${url(args.ref)}`);
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

    const response = await this.s3Client.send(new PutObjectCommand(command));
    console.log(
      `PUT ${command.Bucket}/${command.Key} => ${response.VersionId}\n${content}`,
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
    const response = await this.s3Client.send(new DeleteObjectCommand(command));
    console.log(
      `DELETE ${args.ref.bucket}/${args.ref.key} => ${response.VersionId}`,
    );
    return response;
  }

  public subscribe(
    key: string,
    handler: (value: JSONValue | DeleteValue) => void,
    options?: {
      bucket?: string;
      manifest?: Ref;
    },
  ): () => void {
    const manifestRef: ResolvedRef = {
      ...this.config.defaultManifest,
      ...options?.manifest,
    };
    const keyRef: ResolvedRef = {
      key: key,
      bucket:
        options?.bucket || this.config.defaultBucket || manifestRef.bucket,
    };
    const manifest = this.getOrCreateManifest(manifestRef);
    const unsubscribe = manifest.subscribe(keyRef, handler);
    this.get(keyRef, {
      manifest: manifestRef,
    }).then((initial) => {
      console.log(`NOTIFY (initial) ${url(keyRef)}`);
      // if the data is cached we don't want the subscriber called in the same tick as
      // the unsubscribe retun value will not be initialized
      queueMicrotask(() => {
        handler(initial);
        manifest.poll();
      });
    });

    return unsubscribe;
  }

  refresh(): Promise<unknown> {
    return Promise.all(
      [...this.manifests.values()].map((manifest) => manifest.poll()),
    );
  }
  get subscriberCount(): number {
    return [...this.manifests.values()].reduce(
      (count, manifest) => count + manifest.subscriberCount,
      0,
    );
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
