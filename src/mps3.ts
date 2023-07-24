import {
  GetObjectCommandInput,
  PutObjectCommandInput,
  S3,
} from "@aws-sdk/client-s3";
import { file } from "bun";

export interface MPS3Config {
  defaultBucket: string;
  defaultManifest?: Ref;
  api: S3;
}

export const uuidRegex =
  /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/gi;

export interface FileState {
  version: string;
}

export interface ManifestState {
  version: number;
  buckets: {
    [bucketKey: string]: {
      files: {
        [bucketKey: string]: FileState;
      };
    };
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
    Object.values(obj.buckets).every(
      (bucket: any) =>
        typeof bucket === "object" &&
        bucket.files !== undefined &&
        typeof bucket.files === "object" &&
        Object.values(obj.files).every(
          (file: any) =>
            file.version !== undefined && typeof file.version === "string"
        )
    )
  );
};

export interface Ref {
  bucket?: string;
  key: string;
}

const eq = (a: Ref, b: Ref) => a.bucket === b.bucket && a.key === b.key;
const files = (state: ManifestState): Set<File> =>
  Object.entries(state.buckets).reduce(
    (set, [bucketKey, bucket]) =>
      Object.entries(bucket.files).reduce(
        (set, [fileKey, file]) =>
          set.add(
            new File(
              {
                bucket: bucketKey,
                key: fileKey,
              },
              file
            )
          ),
        set
      ),
    new Set<File>()
  );

export interface ResolvedRef extends Ref {
  bucket: string;
  key: string;
}

export class Manifest {
  service: MPS3;
  ref: ResolvedRef;
  subscribers = new Set<Subscriber>();
  poller?: Timer;

  constructor(service: MPS3, ref: ResolvedRef, options?: {}) {
    this.service = service;
    this.ref = ref;
    // this.poller = setInterval(() => this.poll(), 1000);
  }

  async get(): Promise<ManifestState> {
    const response = await this.service.get(this.ref);
    if (response === undefined) {
      return {
        version: 0,
        buckets: {},
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
    const state = await this.get();
    this.subscribers.forEach((subscriber) => {
      files(state).forEach(async (file) => {
        if (eq(file.ref, subscriber.ref)) {
          const fileContent = await this.service.get(this.ref);
          subscriber.handler(fileContent);
        }
      });
    });
  }

  async updateContent(ref: ResolvedRef, version: string) {
    const state = await this.get();
    state.buckets[ref.bucket] = state.buckets[ref.bucket] || {};
    state.buckets[ref.bucket] = state.buckets[ref.bucket] || {
      files: {},
    };
    state.buckets[ref.bucket].files[ref.key] = {
      version: version,
    };

    await this.service.put(this.ref, state);
  }
}

export class Subscriber {
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

export async function sha256(message: string) {
  // encode as UTF-8
  const msgBuffer = new TextEncoder().encode(message);

  // hash the message
  const arrayBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);

  // convert ArrayBuffer to base64-encoded string
  return btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
}

export class MPS3 {
  config: MPS3Config;
  manifests = new Map<ResolvedRef, Manifest>();
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

  public async put(
    ref: string | Ref,
    value: any,
    options?: {
      manifests: Ref[];
    }
  ) {
    const contentRef: ResolvedRef = {
      bucket:
        (<Ref>ref).bucket ||
        this.config.defaultBucket ||
        this.defaultManifest.bucket,
      key: typeof ref === "string" ? ref : ref.key,
    };
    const content: string = JSON.stringify(value);
    const checksum = await sha256(content);
    const command: PutObjectCommandInput = {
      Bucket: contentRef.bucket,
      Key: contentRef.key,
      ContentType: "application/json",
      Body: content,
      ChecksumSHA256: checksum,
    };

    const fileUpdate = await this.config.api.putObject(command);

    if (
      fileUpdate.VersionId === undefined ||
      !fileUpdate.VersionId.match(uuidRegex)
    ) {
      console.error(fileUpdate);
      throw Error(`Bucket ${contentRef.bucket} is not version enabled!`);
    }
    console.log(command);
    console.log(fileUpdate);

    const manifests = options?.manifests || [this.defaultManifest];
    manifests.map((ref) => {
      const manifestRef: ResolvedRef = {
        ...this.defaultManifest,
        ...ref,
      };
      const manifest = this.getOrCreateManifest(manifestRef);
      manifest.updateContent(contentRef, fileUpdate.VersionId);
    });
  }

  public async get(ref: string | Ref) {
    const contentRef: ResolvedRef = {
      bucket:
        (<Ref>ref).bucket ||
        this.config.defaultBucket ||
        this.defaultManifest.bucket,
      key: typeof ref === "string" ? ref : ref.key,
    };
    const command: GetObjectCommandInput = {
      Bucket: contentRef.bucket,
      Key: contentRef.key,
    };
    try {
      const response = await this.config.api.getObject(command);
      if (!response.Body) return undefined;
      else {
        return JSON.parse(await response.Body.transformToString("utf-8"));
      }
    } catch (err: any) {
      if (err.name === "NoSuchKey") return undefined;
      else throw err;
    }
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
    return () => {
      throw new Error("Not implemented");
    };
  }
}
