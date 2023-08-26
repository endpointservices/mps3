// src/OMap.ts
class OMap {
  key;
  store = new Map;
  constructor(key) {
    this.key = key;
  }
  set(key, value) {
    this.store.set(this.key(key), value);
    return this;
  }
  get(key) {
    return this.store.get(this.key(key));
  }
  has(key) {
    return this.store.has(this.key(key));
  }
  values() {
    return this.store.values();
  }
}

// src/mps3.ts
async function sha256(message) {
  const msgBuffer = new TextEncoder().encode(message);
  const arrayBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
  return btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
}
var uuidRegex = /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/gi;

class File {
  ref;
  version;
  constructor(ref, state) {
    this.ref = ref;
    this.version = state.version;
  }
}
var isManifest = (obj) => {
  if (!obj)
    return false;
  return obj.version !== undefined && typeof obj.version === "number" && obj.files !== undefined && typeof obj.files === "object" && Object.values(obj.files).every((file) => typeof file === "object" && file.version !== undefined && typeof file.version === "string");
};
var url = (ref) => `${ref.bucket}/${ref.key}`;
var parseUrl = (url2) => {
  const [bucket, ...key] = url2.split("/");
  return {
    bucket,
    key: key.join("/")
  };
};
var eq = (a, b) => a.bucket === b.bucket && a.key === b.key;
var files = (state) => Object.entries(state.files).reduce((set, [url2, file]) => set.add(new File(parseUrl(url2), file)), new Set);

class Manifest {
  service;
  ref;
  subscribers = new Set;
  poller;
  constructor(service, ref, options) {
    this.service = service;
    this.ref = ref;
  }
  async get() {
    const response = await this.service._getObject({
      ref: this.ref
    });
    if (response === undefined) {
      return {
        version: 0,
        files: {}
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
          const fileContent = await this.service.get(file.ref);
          subscriber.handler(fileContent);
        }
      });
    });
  }
  async updateContent(ref, version) {
    console.log(`update_content ${url(ref)} => ${version}`);
    const state = await this.get();
    state.files[url(ref)] = {
      version
    };
    return this.service._putObject({
      ref: this.ref,
      value: state
    });
  }
  async getVersion(ref) {
    const state = await this.get();
    return state.files[url(ref)]?.version;
  }
  get subscriberCount() {
    return this.subscribers.size;
  }
}

class Subscriber {
  manifest;
  ref;
  handler;
  constructor(ref, manifest, handler) {
    this.manifest = manifest;
    this.ref = ref;
    this.handler = handler;
  }
}

class MPS3 {
  config;
  manifests = new OMap(url);
  defaultManifest;
  constructor(config) {
    this.config = config;
    this.defaultManifest = {
      bucket: config.defaultManifest?.bucket || config.defaultBucket,
      key: config.defaultManifest?.key || "manifest.json"
    };
  }
  getOrCreateManifest(ref) {
    if (!this.manifests.has(ref)) {
      this.manifests.set(ref, new Manifest(this, ref));
    }
    return this.manifests.get(ref);
  }
  async get(ref) {
    const manifestRef = {
      ...this.defaultManifest
    };
    const manifest = this.getOrCreateManifest(manifestRef);
    const contentRef = {
      bucket: ref.bucket || this.config.defaultBucket || this.defaultManifest.bucket,
      key: typeof ref === "string" ? ref : ref.key
    };
    const version = await manifest.getVersion(contentRef);
    if (version === undefined)
      return;
    return this._getObject({
      ref: contentRef,
      version
    });
  }
  async _getObject(args) {
    const command = {
      Bucket: args.ref.bucket,
      Key: args.ref.key,
      ...args.version && { VersionId: args.version }
    };
    try {
      const response = await this.config.api.getObject(command);
      if (!response.Body)
        return;
      else {
        const payload = await response.Body.transformToString("utf-8");
        console.log(`GET ${args.ref.bucket}/${args.ref.key}@${args.version} => ${response.VersionId}\n${payload}`);
        return JSON.parse(payload);
      }
    } catch (err) {
      if (err.name === "NoSuchKey")
        return;
      else
        throw err;
    }
  }
  async put(ref, value, options = {}) {
    const manifests = options?.manifests || [this.defaultManifest];
    const contentRef = {
      bucket: ref.bucket || this.config.defaultBucket || this.defaultManifest.bucket,
      key: typeof ref === "string" ? ref : ref.key
    };
    const fileUpdate = await this._putObject({
      ref: contentRef,
      value
    });
    if (fileUpdate.VersionId === undefined || !fileUpdate.VersionId.match(uuidRegex)) {
      console.error(fileUpdate);
      throw Error(`Bucket ${contentRef.bucket} is not version enabled!`);
    }
    const versionId = fileUpdate.VersionId;
    await Promise.all(manifests.map((ref2) => {
      const manifestRef = {
        ...this.defaultManifest,
        ...ref2
      };
      const manifest = this.getOrCreateManifest(manifestRef);
      return manifest.updateContent(contentRef, versionId);
    }));
  }
  async _putObject(args) {
    console.log(`putObject ${url(args.ref)}`);
    const content = JSON.stringify(args.value, null, 2);
    const checksum = await sha256(content);
    const command = {
      Bucket: args.ref.bucket,
      Key: args.ref.key,
      ContentType: "application/json",
      Body: content,
      ChecksumSHA256: checksum
    };
    const response = await this.config.api.putObject(command);
    console.log(`PUT ${args.ref.bucket}/${args.ref.key} => ${response.VersionId}\n${content}`);
    return response;
  }
  subscribe(key, handler, options) {
    const manifestRef = {
      ...this.defaultManifest,
      ...options?.manifest
    };
    const keyRef = {
      key,
      bucket: options?.bucket || this.config.defaultBucket || manifestRef.bucket
    };
    const manifest = this.getOrCreateManifest(manifestRef);
    const subscriber = new Subscriber(keyRef, manifest, handler);
    manifest.subscribers.add(subscriber);
    manifest.poll();
    return () => {
      manifest.subscribers.delete(subscriber);
    };
  }
  get subscriberCount() {
    return [...this.manifests.values()].reduce((count, manifest) => count + manifest.subscriberCount, 0);
  }
}
export {
  uuidRegex,
  MPS3
};
