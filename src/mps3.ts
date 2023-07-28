import {
  GetObjectCommandInput,
  PutObjectCommandInput,
  PutObjectCommandOutput,
  S3,
} from "@aws-sdk/client-s3";
import { OMap } from "OMap";

export interface MPS3Config {
  defaultBucket: string;
  defaultManifest?: Ref;
  api: S3;
}

export const uuidRegex =
  /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/gi;

interface FileState {
  version: string;
}

interface ManifestState {
  version: number;
  // TODO: the manifest should just be URLs which corresponde to the s3 URLs
  // this would scale beyond the s3 usecase and include regional endpoints etc.
  files: {
    [url: string]: FileState;
  };
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

  constructor(service: MPS3, ref: ResolvedRef, options?: {}) {
    this.service = service;
    this.ref = ref;
  }
  async get(): Promise<ManifestState> {
    const response = await this.service._getObject({
      ref: this.ref,
    });
    if (response === undefined) {
      return {
        version: 0,
        files: {},
      };
    }
    if (isManifest(response)) {
      return response;
    } else {
      console.error("Invalid manifest", response);
      throw new Error("Invalid manifest");
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

  async updateContent(ref: ResolvedRef, version: string) {
    console.log(`update_content ${url(ref)} => ${version}`);
    const state = await this.get();

    state.files[url(ref)] = {
      version: version,
    };

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

  public async get(ref: string | Ref) {
    const manifestRef: ResolvedRef = {
      ...this.defaultManifest,
    };
    const manifest = this.getOrCreateManifest(manifestRef);
    const contentRef: ResolvedRef = {
      bucket:
        (<Ref>ref).bucket ||
        this.config.defaultBucket ||
        this.defaultManifest.bucket,
      key: typeof ref === "string" ? ref : ref.key,
    };
    const version = await manifest.getVersion(contentRef);
    if (version === undefined) return undefined;
    return this._getObject({
      ref: contentRef,
      version: version,
    });
  }

  async _getObject(args: { ref: ResolvedRef; version?: string }): Promise<any> {
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

  public async put(
    ref: string | Ref,
    value: any,
    options: {
      manifests?: Ref[];
    } = {}
  ) {
    const manifests = options?.manifests || [this.defaultManifest];
    const contentRef: ResolvedRef = {
      bucket:
        (<Ref>ref).bucket ||
        this.config.defaultBucket ||
        this.defaultManifest.bucket,
      key: typeof ref === "string" ? ref : ref.key,
    };

    const fileUpdate = await this._putObject({
      ref: contentRef,
      value,
    });

    if (
      fileUpdate.VersionId === undefined ||
      !fileUpdate.VersionId.match(uuidRegex)
    ) {
      console.error(fileUpdate);
      throw Error(`Bucket ${contentRef.bucket} is not version enabled!`);
    }
    const versionId = fileUpdate.VersionId;

    await Promise.all(
      manifests.map((ref) => {
        const manifestRef: ResolvedRef = {
          ...this.defaultManifest,
          ...ref,
        };
        const manifest = this.getOrCreateManifest(manifestRef);
        return manifest.updateContent(contentRef, versionId);
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

  public subscribe(
    key: string,
    handler: (value: any) => void,
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
    manifest.poll();
    // TODO send initial state
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
