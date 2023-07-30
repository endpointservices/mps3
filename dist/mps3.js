var __commonJS = (cb, mod) => () => (mod || cb((mod = { exports: {} }).exports, mod), mod.exports);

// node_modules/json-merge-patch/lib/utils.js
var require_utils = __commonJS((exports, module) => {
  exports.serialize = function(value) {
    return value && typeof value.toJSON === "function" ? value.toJSON() : value;
  };
});

// node_modules/json-merge-patch/lib/apply.js
var require_apply = __commonJS((exports, module) => {
  var serialize = require_utils().serialize;
  module.exports = function apply(target, patch) {
    patch = serialize(patch);
    if (patch === null || typeof patch !== "object" || Array.isArray(patch)) {
      return patch;
    }
    target = serialize(target);
    if (target === null || typeof target !== "object" || Array.isArray(target)) {
      target = {};
    }
    var keys = Object.keys(patch);
    for (var i = 0;i < keys.length; i++) {
      var key = keys[i];
      if (key === "__proto__" || key === "constructor" || key === "prototype") {
        return target;
      }
      if (patch[key] === null) {
        if (target.hasOwnProperty(key)) {
          delete target[key];
        }
      } else {
        target[key] = apply(target[key], patch[key]);
      }
    }
    return target;
  };
});

// node_modules/fast-deep-equal/index.js
var require_fast_deep_equal = __commonJS((exports, module) => {
  module.exports = function equal(a, b) {
    if (a === b)
      return true;
    if (a && b && typeof a == "object" && typeof b == "object") {
      if (a.constructor !== b.constructor)
        return false;
      var length, i, keys;
      if (Array.isArray(a)) {
        length = a.length;
        if (length != b.length)
          return false;
        for (i = length;i-- !== 0; )
          if (!equal(a[i], b[i]))
            return false;
        return true;
      }
      if (a.constructor === RegExp)
        return a.source === b.source && a.flags === b.flags;
      if (a.valueOf !== Object.prototype.valueOf)
        return a.valueOf() === b.valueOf();
      if (a.toString !== Object.prototype.toString)
        return a.toString() === b.toString();
      keys = Object.keys(a);
      length = keys.length;
      if (length !== Object.keys(b).length)
        return false;
      for (i = length;i-- !== 0; )
        if (!Object.prototype.hasOwnProperty.call(b, keys[i]))
          return false;
      for (i = length;i-- !== 0; ) {
        var key = keys[i];
        if (!equal(a[key], b[key]))
          return false;
      }
      return true;
    }
    return a !== a && b !== b;
  };
});

// node_modules/json-merge-patch/lib/generate.js
var require_generate = __commonJS((exports, module) => {
  var arrayEquals = function(before, after) {
    if (before.length !== after.length) {
      return false;
    }
    for (var i = 0;i < before.length; i++) {
      if (!equal(after[i], before[i])) {
        return false;
      }
    }
    return true;
  };
  var equal = require_fast_deep_equal();
  var serialize = require_utils().serialize;
  module.exports = function generate(before, after) {
    before = serialize(before);
    after = serialize(after);
    if (before === null || after === null || typeof before !== "object" || typeof after !== "object" || Array.isArray(before) !== Array.isArray(after)) {
      return after;
    }
    if (Array.isArray(before)) {
      if (!arrayEquals(before, after)) {
        return after;
      }
      return;
    }
    var patch = {};
    var beforeKeys = Object.keys(before);
    var afterKeys = Object.keys(after);
    var key, i;
    var newKeys = {};
    for (i = 0;i < afterKeys.length; i++) {
      key = afterKeys[i];
      if (beforeKeys.indexOf(key) === -1) {
        newKeys[key] = true;
        patch[key] = serialize(after[key]);
      }
    }
    var removedKeys = {};
    for (i = 0;i < beforeKeys.length; i++) {
      key = beforeKeys[i];
      if (afterKeys.indexOf(key) === -1) {
        removedKeys[key] = true;
        patch[key] = null;
      } else {
        if (before[key] !== null && typeof before[key] === "object") {
          var subPatch = generate(before[key], after[key]);
          if (subPatch !== undefined) {
            patch[key] = subPatch;
          }
        } else if (before[key] !== after[key]) {
          patch[key] = serialize(after[key]);
        }
      }
    }
    return Object.keys(patch).length > 0 ? patch : undefined;
  };
});

// node_modules/json-merge-patch/lib/merge.js
var require_merge = __commonJS((exports, module) => {
  module.exports = function merge(patch1, patch2) {
    if (patch1 === null || patch2 === null || typeof patch1 !== "object" || typeof patch2 !== "object" || Array.isArray(patch1) !== Array.isArray(patch2)) {
      return patch2;
    }
    var patch = JSON.parse(JSON.stringify(patch1));
    Object.keys(patch2).forEach(function(key) {
      if (patch1[key] !== undefined) {
        patch[key] = merge(patch1[key], patch2[key]);
      } else {
        patch[key] = patch2[key];
      }
    });
    return patch;
  };
});

// node_modules/json-merge-patch/index.js
var $apply = require_apply();
var $generate = require_generate();
var $merge = require_merge();

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
    try {
      const response = await this.service._getObject2({
        ref: this.ref
      });
      if (response.data === undefined) {
        return {
          version: 0,
          files: {},
          update: {}
        };
      }
      if (isManifest(response.data)) {
        const latestState = response.data;
        const previousVersion = await this.service.config.api.listObjectVersions({
          Bucket: this.ref.bucket,
          Prefix: this.ref.key,
          KeyMarker: this.ref.key,
          VersionIdMarker: response.VersionId,
          MaxKeys: 1
        });
        if (previousVersion.Versions === undefined || previousVersion.Versions?.length == 0 || previousVersion.Versions[0].VersionId === latestState.previous?.version) {
          latestState.previous = {
            url: url(this.ref),
            version: response.VersionId
          };
          return latestState;
        } else {
          const previousVersions = await this.service.config.api.listObjectVersions({
            Bucket: this.ref.bucket,
            Prefix: this.ref.key,
            KeyMarker: this.ref.key,
            VersionIdMarker: response.VersionId,
            MaxKeys: 10
          });
          if (previousVersions.Versions === undefined)
            throw new Error("No versions returned");
          const start = previousVersions.Versions?.findIndex((version) => version.VersionId === latestState.previous?.version);
          if (start === undefined)
            throw new Error("Can't find previous state in search window");
          const baseStateRead = await this.service._getObject2({
            ref: this.ref,
            version: latestState.previous?.version
          });
          if (baseStateRead.data === undefined)
            throw new Error("Can't find base state");
          let state = baseStateRead.data;
          console.log("replay state");
          for (let index = start - 1;index >= 0; index--) {
            const missingState = await this.service._getObject2({
              ref: this.ref,
              version: previousVersions.Versions[index].VersionId
            });
            const patch = missingState.data?.update;
            console.log("patch state", patch);
            state = $apply(state, patch);
          }
          state = $apply(state, response.data.update);
          state.previous = {
            url: url(this.ref),
            version: response.VersionId
          };
          console.log("resolved data", JSON.stringify(state));
          return state;
        }
      } else {
        throw new Error("Invalid manifest");
      }
    } catch (err) {
      if (err.name === "NoSuchKey") {
        return {
          version: 0,
          files: {},
          update: {}
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
            version: file.version
          });
          subscriber.handler(fileContent);
        }
      });
    });
  }
  async updateContent(ref, version) {
    console.log(`update_content ${url(ref)} => ${version}`);
    const state = await this.get();
    const fileUrl = url(ref);
    const fileState = {
      version
    };
    state.files[fileUrl] = fileState;
    state.update = {
      files: {
        [fileUrl]: fileState
      }
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
  async get(ref, options = {}) {
    const manifestRef = {
      ...this.defaultManifest,
      ...options.manifest
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
  async _getObject2(args) {
    const command = {
      Bucket: args.ref.bucket,
      Key: args.ref.key,
      ...args.version && { VersionId: args.version }
    };
    const response = {
      ...await this.config.api.getObject(command),
      data: undefined
    };
    if (response.Body) {
      response.data = JSON.parse(await response.Body.transformToString("utf-8"));
      console.log(`GET ${args.ref.bucket}/${args.ref.key}@${args.version} => ${response.VersionId}\n${JSON.stringify(response.data)}`);
    }
    return response;
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
