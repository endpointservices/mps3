// node_modules/aws4fetch/dist/aws4fetch.esm.mjs
async function hmac(key, string) {
  const cryptoKey = await crypto.subtle.importKey("raw", typeof key === "string" ? encoder.encode(key) : key, { name: "HMAC", hash: { name: "SHA-256" } }, false, ["sign"]);
  return crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(string));
}
async function hash(content) {
  return crypto.subtle.digest("SHA-256", typeof content === "string" ? encoder.encode(content) : content);
}
var buf2hex = function(buffer) {
  return Array.prototype.map.call(new Uint8Array(buffer), (x) => ("0" + x.toString(16)).slice(-2)).join("");
};
var encodeRfc3986 = function(urlEncodedStr) {
  return urlEncodedStr.replace(/[!'()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());
};
var guessServiceRegion = function(url, headers) {
  const { hostname, pathname } = url;
  if (hostname.endsWith(".r2.cloudflarestorage.com")) {
    return ["s3", "auto"];
  }
  if (hostname.endsWith(".backblazeb2.com")) {
    const match2 = hostname.match(/^(?:[^.]+\.)?s3\.([^.]+)\.backblazeb2\.com$/);
    return match2 != null ? ["s3", match2[1]] : ["", ""];
  }
  const match = hostname.replace("dualstack.", "").match(/([^.]+)\.(?:([^.]*)\.)?amazonaws\.com(?:\.cn)?$/);
  let [service, region] = (match || ["", ""]).slice(1, 3);
  if (region === "us-gov") {
    region = "us-gov-west-1";
  } else if (region === "s3" || region === "s3-accelerate") {
    region = "us-east-1";
    service = "s3";
  } else if (service === "iot") {
    if (hostname.startsWith("iot.")) {
      service = "execute-api";
    } else if (hostname.startsWith("data.jobs.iot.")) {
      service = "iot-jobs-data";
    } else {
      service = pathname === "/mqtt" ? "iotdevicegateway" : "iotdata";
    }
  } else if (service === "autoscaling") {
    const targetPrefix = (headers.get("X-Amz-Target") || "").split(".")[0];
    if (targetPrefix === "AnyScaleFrontendService") {
      service = "application-autoscaling";
    } else if (targetPrefix === "AnyScaleScalingPlannerFrontendService") {
      service = "autoscaling-plans";
    }
  } else if (region == null && service.startsWith("s3-")) {
    region = service.slice(3).replace(/^fips-|^external-1/, "");
    service = "s3";
  } else if (service.endsWith("-fips")) {
    service = service.slice(0, -5);
  } else if (region && /-\d$/.test(service) && !/-\d$/.test(region)) {
    [service, region] = [region, service];
  }
  return [HOST_SERVICES[service] || service, region];
};
var encoder = new TextEncoder;
var HOST_SERVICES = {
  appstream2: "appstream",
  cloudhsmv2: "cloudhsm",
  email: "ses",
  marketplace: "aws-marketplace",
  mobile: "AWSMobileHubService",
  pinpoint: "mobiletargeting",
  queue: "sqs",
  "git-codecommit": "codecommit",
  "mturk-requester-sandbox": "mturk-requester",
  "personalize-runtime": "personalize"
};
var UNSIGNABLE_HEADERS = new Set([
  "authorization",
  "content-type",
  "content-length",
  "user-agent",
  "presigned-expires",
  "expect",
  "x-amzn-trace-id",
  "range",
  "connection"
]);

class AwsClient {
  constructor({ accessKeyId, secretAccessKey, sessionToken, service, region, cache, retries, initRetryMs }) {
    if (accessKeyId == null)
      throw new TypeError("accessKeyId is a required option");
    if (secretAccessKey == null)
      throw new TypeError("secretAccessKey is a required option");
    this.accessKeyId = accessKeyId;
    this.secretAccessKey = secretAccessKey;
    this.sessionToken = sessionToken;
    this.service = service;
    this.region = region;
    this.cache = cache || new Map;
    this.retries = retries != null ? retries : 10;
    this.initRetryMs = initRetryMs || 50;
  }
  async sign(input, init) {
    if (input instanceof Request) {
      const { method, url, headers, body } = input;
      init = Object.assign({ method, url, headers }, init);
      if (init.body == null && headers.has("Content-Type")) {
        init.body = body != null && headers.has("X-Amz-Content-Sha256") ? body : await input.clone().arrayBuffer();
      }
      input = url;
    }
    const signer = new AwsV4Signer(Object.assign({ url: input }, init, this, init && init.aws));
    const signed = Object.assign({}, init, await signer.sign());
    delete signed.aws;
    try {
      return new Request(signed.url.toString(), signed);
    } catch (e) {
      if (e instanceof TypeError) {
        return new Request(signed.url.toString(), Object.assign({ duplex: "half" }, signed));
      }
      throw e;
    }
  }
  async fetch(input, init) {
    for (let i = 0;i <= this.retries; i++) {
      const fetched = fetch(await this.sign(input, init));
      if (i === this.retries) {
        return fetched;
      }
      const res = await fetched;
      if (res.status < 500 && res.status !== 429) {
        return res;
      }
      await new Promise((resolve) => setTimeout(resolve, Math.random() * this.initRetryMs * Math.pow(2, i)));
    }
    throw new Error("An unknown error occurred, ensure retries is not negative");
  }
}

class AwsV4Signer {
  constructor({ method, url, headers, body, accessKeyId, secretAccessKey, sessionToken, service, region, cache, datetime, signQuery, appendSessionToken, allHeaders, singleEncode }) {
    if (url == null)
      throw new TypeError("url is a required option");
    if (accessKeyId == null)
      throw new TypeError("accessKeyId is a required option");
    if (secretAccessKey == null)
      throw new TypeError("secretAccessKey is a required option");
    this.method = method || (body ? "POST" : "GET");
    this.url = new URL(url);
    this.headers = new Headers(headers || {});
    this.body = body;
    this.accessKeyId = accessKeyId;
    this.secretAccessKey = secretAccessKey;
    this.sessionToken = sessionToken;
    let guessedService, guessedRegion;
    if (!service || !region) {
      [guessedService, guessedRegion] = guessServiceRegion(this.url, this.headers);
    }
    this.service = service || guessedService || "";
    this.region = region || guessedRegion || "us-east-1";
    this.cache = cache || new Map;
    this.datetime = datetime || new Date().toISOString().replace(/[:-]|\.\d{3}/g, "");
    this.signQuery = signQuery;
    this.appendSessionToken = appendSessionToken || this.service === "iotdevicegateway";
    this.headers.delete("Host");
    if (this.service === "s3" && !this.signQuery && !this.headers.has("X-Amz-Content-Sha256")) {
      this.headers.set("X-Amz-Content-Sha256", "UNSIGNED-PAYLOAD");
    }
    const params = this.signQuery ? this.url.searchParams : this.headers;
    params.set("X-Amz-Date", this.datetime);
    if (this.sessionToken && !this.appendSessionToken) {
      params.set("X-Amz-Security-Token", this.sessionToken);
    }
    this.signableHeaders = ["host", ...this.headers.keys()].filter((header) => allHeaders || !UNSIGNABLE_HEADERS.has(header)).sort();
    this.signedHeaders = this.signableHeaders.join(";");
    this.canonicalHeaders = this.signableHeaders.map((header) => header + ":" + (header === "host" ? this.url.host : (this.headers.get(header) || "").replace(/\s+/g, " "))).join("\n");
    this.credentialString = [this.datetime.slice(0, 8), this.region, this.service, "aws4_request"].join("/");
    if (this.signQuery) {
      if (this.service === "s3" && !params.has("X-Amz-Expires")) {
        params.set("X-Amz-Expires", "86400");
      }
      params.set("X-Amz-Algorithm", "AWS4-HMAC-SHA256");
      params.set("X-Amz-Credential", this.accessKeyId + "/" + this.credentialString);
      params.set("X-Amz-SignedHeaders", this.signedHeaders);
    }
    if (this.service === "s3") {
      try {
        this.encodedPath = decodeURIComponent(this.url.pathname.replace(/\+/g, " "));
      } catch (e) {
        this.encodedPath = this.url.pathname;
      }
    } else {
      this.encodedPath = this.url.pathname.replace(/\/+/g, "/");
    }
    if (!singleEncode) {
      this.encodedPath = encodeURIComponent(this.encodedPath).replace(/%2F/g, "/");
    }
    this.encodedPath = encodeRfc3986(this.encodedPath);
    const seenKeys = new Set;
    this.encodedSearch = [...this.url.searchParams].filter(([k]) => {
      if (!k)
        return false;
      if (this.service === "s3") {
        if (seenKeys.has(k))
          return false;
        seenKeys.add(k);
      }
      return true;
    }).map((pair) => pair.map((p) => encodeRfc3986(encodeURIComponent(p)))).sort(([k1, v1], [k2, v2]) => k1 < k2 ? -1 : k1 > k2 ? 1 : v1 < v2 ? -1 : v1 > v2 ? 1 : 0).map((pair) => pair.join("=")).join("&");
  }
  async sign() {
    if (this.signQuery) {
      this.url.searchParams.set("X-Amz-Signature", await this.signature());
      if (this.sessionToken && this.appendSessionToken) {
        this.url.searchParams.set("X-Amz-Security-Token", this.sessionToken);
      }
    } else {
      this.headers.set("Authorization", await this.authHeader());
    }
    return {
      method: this.method,
      url: this.url,
      headers: this.headers,
      body: this.body
    };
  }
  async authHeader() {
    return [
      "AWS4-HMAC-SHA256 Credential=" + this.accessKeyId + "/" + this.credentialString,
      "SignedHeaders=" + this.signedHeaders,
      "Signature=" + await this.signature()
    ].join(", ");
  }
  async signature() {
    const date = this.datetime.slice(0, 8);
    const cacheKey = [this.secretAccessKey, date, this.region, this.service].join();
    let kCredentials = this.cache.get(cacheKey);
    if (!kCredentials) {
      const kDate = await hmac("AWS4" + this.secretAccessKey, date);
      const kRegion = await hmac(kDate, this.region);
      const kService = await hmac(kRegion, this.service);
      kCredentials = await hmac(kService, "aws4_request");
      this.cache.set(cacheKey, kCredentials);
    }
    return buf2hex(await hmac(kCredentials, await this.stringToSign()));
  }
  async stringToSign() {
    return [
      "AWS4-HMAC-SHA256",
      this.datetime,
      this.credentialString,
      buf2hex(await hash(await this.canonicalString()))
    ].join("\n");
  }
  async canonicalString() {
    return [
      this.method.toUpperCase(),
      this.encodedPath,
      this.encodedSearch,
      this.canonicalHeaders + "\n",
      this.signedHeaders,
      await this.hexBodyHash()
    ].join("\n");
  }
  async hexBodyHash() {
    let hashHeader = this.headers.get("X-Amz-Content-Sha256") || (this.service === "s3" && this.signQuery ? "UNSIGNED-PAYLOAD" : null);
    if (hashHeader == null) {
      if (this.body && typeof this.body !== "string" && !("byteLength" in this.body)) {
        throw new Error("body must be a string, ArrayBuffer or ArrayBufferView, unless you include the X-Amz-Content-Sha256 header");
      }
      hashHeader = buf2hex(await hash(this.body || ""));
    }
    return hashHeader;
  }
}

// src/time.ts
var timestamp = (epoch = 0) => `${epoch}`.padStart(14, "0");
var measure = async (work) => {
  const start = Date.now();
  return [await work, Date.now() - start];
};
var adjustClock = (response, config) => {
  if (config.adaptiveClock) {
    return measure(response).then(([response2, latency]) => {
      if (response2.status !== 200)
        return response2;
      const date_str = response2.headers.get("date");
      if (date_str) {
        let error = 0;
        const server_time = new Date(date_str).getTime();
        const local_time = Date.now() + config.clockOffset;
        if (local_time < server_time - latency) {
          error = server_time - local_time - latency;
        } else if (local_time > server_time + 1000 + latency) {
          error = server_time + 1000 - local_time + latency;
        }
        if (error > 0)
          config.clockOffset = config.clockOffset + error;
        if (error > 0) {
          console.log("latency", latency, "error", error, "local_time", local_time, "server_time", server_time, "config.clockOffset", config.clockOffset);
        }
      }
      return response2;
    });
  }
  return response;
};

// src/xml.ts
var parseListObjectsV2CommandOutput = (xml, domParser) => {
  const doc = domParser.parseFromString(xml, "text/xml");
  if (!doc)
    throw new Error(`Invalid XML: ${xml}`);
  const contents = doc.getElementsByTagName("Contents");
  const val = (el, name) => {
    const c = el.getElementsByTagName(name)[0]?.textContent;
    return c ? decodeURIComponent(c.replace(/\+/g, " ")) : undefined;
  };
  return {
    $metadata: {},
    Contents: Array.from(contents).map((content) => {
      const lm = val(content, "LastModified");
      return {
        ETag: val(content, "ETag"),
        Key: val(content, "Key"),
        LastModified: lm ? new Date(lm) : undefined
      };
    }),
    KeyCount: parseInt(val(doc, "KeyCount")),
    ContinuationToken: val(doc, "ContinuationToken"),
    NextContinuationToken: val(doc, "NextContinuationToken"),
    StartAfter: val(doc, "StartAfter")
  };
};

// src/S3ClientLite.ts
var retry = async (fn, { retries = Number.MAX_VALUE, delay = 100, max_delay = 1e4 } = {}) => {
  try {
    return await fn();
  } catch (e) {
    if (retries > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
      return retry(fn, {
        retries: retries - 1,
        max_delay,
        delay: Math.min(delay * 1.5, max_delay)
      });
    }
    throw e;
  }
};

class S3ClientLite {
  fetch2;
  endpoint;
  mps3;
  constructor(fetch2, endpoint, mps3) {
    this.fetch = fetch2;
    this.endpoint = endpoint;
    this.mps3 = mps3;
  }
  getUrl(bucket, key, additional) {
    return `${this.endpoint}/${bucket}${key ? `/${encodeURIComponent(key)}` : ""}${additional || ""}`;
  }
  async listObjectV2(command) {
    for (let i = 0;i < 10; i++) {
      const url = this.getUrl(command.Bucket, undefined, `/?list-type=2&prefix=${command.Prefix}&start-after=${command.StartAfter}`);
      const response = await retry(() => this.fetch(url, {}));
      if (response.status === 200) {
        return parseListObjectsV2CommandOutput(await response.text(), this.mps3.config.parser);
      } else if (response.status === 429) {
        console.warn("listObjectV2: 429, retrying");
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } else {
        throw new Error(`Unexpected response: ${response.status} ${await response.text()}`);
      }
    }
    throw new Error("Cannot contact server");
  }
  async putObject({
    Bucket,
    Key,
    Body,
    ChecksumSHA256
  }) {
    const url = this.getUrl(Bucket, Key);
    const response = await retry(() => adjustClock(this.fetch(url, {
      method: "PUT",
      body: Body,
      headers: {
        "Content-Type": "application/json",
        ...ChecksumSHA256 && { "x-amz-content-sha256": ChecksumSHA256 }
      }
    }), this.mps3.config));
    if (response.status !== 200)
      throw new Error(`Failed to PUT: ${await response.text()}`);
    return {
      $metadata: { httpStatusCode: response.status },
      Date: new Date(response.headers.get("date")),
      ETag: response.headers.get("ETag"),
      ...response.headers.get("x-amz-version-id") && {
        VersionId: response.headers.get("x-amz-version-id")
      }
    };
  }
  async deleteObject({
    Bucket,
    Key
  }) {
    const response = await retry(() => this.fetch(this.getUrl(Bucket, Key), { method: "DELETE" }));
    return { $metadata: { httpStatusCode: response.status } };
  }
  async getObject({
    Bucket,
    Key,
    VersionId,
    IfNoneMatch
  }) {
    const url = this.getUrl(Bucket, Key, VersionId ? `?versionId=${VersionId}` : "");
    const response = await retry(() => adjustClock(this.fetch(url, {
      method: "GET",
      headers: { "If-None-Match": IfNoneMatch }
    }), this.mps3.config));
    switch (response.status) {
      case 304:
        throw new Error("304");
      case 404:
        return { $metadata: { httpStatusCode: 404 } };
      case 403:
        throw new Error("Access denied");
      default: {
        let content;
        const type = response.headers.get("content-type");
        const text = await response.text();
        if (type === "application/json" || text && text !== "") {
          try {
            content = JSON.parse(text);
          } catch (e) {
            throw new Error(`Failed to parse response as JSON ${url}`);
          }
        }
        return {
          $metadata: { httpStatusCode: response.status },
          Body: content,
          ETag: response.headers.get("ETag"),
          ...response.headers.get("x-amz-version-id") && {
            VersionId: response.headers.get("x-amz-version-id")
          }
        };
      }
    }
  }
}

// src/OMap.ts
class OMap {
  key;
  _vals;
  _keys;
  constructor(key, values) {
    this.key = key;
    this._vals = new Map;
    this._keys = new Map;
    if (values) {
      for (const [k, v] of values) {
        this.set(k, v);
      }
    }
  }
  get size() {
    return this._vals.size;
  }
  set(key, value) {
    const k = this.key(key);
    this._vals.set(k, value);
    this._keys.set(k, key);
    return this;
  }
  get(key) {
    return this._vals.get(this.key(key));
  }
  delete(key) {
    const k = this.key(key);
    this._keys.delete(k);
    return this._vals.delete(k);
  }
  has(key) {
    return this._vals.has(this.key(key));
  }
  values() {
    return this._vals.values();
  }
  keys() {
    return this._keys.values();
  }
  forEach(callback) {
    return this._vals.forEach((v, k, map) => callback(v, this._keys.get(k)));
  }
}

// src/types.ts
var uuid = () => crypto.randomUUID();
var countKey = (number) => number.toString(36).padStart(4, "0");
var url = (ref) => `${ref.bucket}/${ref.key}`;

// node_modules/idb-keyval/dist/index.js
var promisifyRequest = function(request) {
  return new Promise((resolve, reject) => {
    request.oncomplete = request.onsuccess = () => resolve(request.result);
    request.onabort = request.onerror = () => reject(request.error);
  });
};
var createStore = function(dbName, storeName) {
  const request = indexedDB.open(dbName);
  request.onupgradeneeded = () => request.result.createObjectStore(storeName);
  const dbp = promisifyRequest(request);
  return (txMode, callback) => dbp.then((db) => callback(db.transaction(storeName, txMode).objectStore(storeName)));
};
var defaultGetStore = function() {
  if (!defaultGetStoreFunc) {
    defaultGetStoreFunc = createStore("keyval-store", "keyval");
  }
  return defaultGetStoreFunc;
};
var get = function(key, customStore = defaultGetStore()) {
  return customStore("readonly", (store) => promisifyRequest(store.get(key)));
};
var set = function(key, value, customStore = defaultGetStore()) {
  return customStore("readwrite", (store) => {
    store.put(value, key);
    return promisifyRequest(store.transaction);
  });
};
var getMany = function(keys, customStore = defaultGetStore()) {
  return customStore("readonly", (store) => Promise.all(keys.map((key) => promisifyRequest(store.get(key)))));
};
var del = function(key, customStore = defaultGetStore()) {
  return customStore("readwrite", (store) => {
    store.delete(key);
    return promisifyRequest(store.transaction);
  });
};
var delMany = function(keys, customStore = defaultGetStore()) {
  return customStore("readwrite", (store) => {
    keys.forEach((key) => store.delete(key));
    return promisifyRequest(store.transaction);
  });
};
var eachCursor = function(store, callback) {
  store.openCursor().onsuccess = function() {
    if (!this.result)
      return;
    callback(this.result);
    this.result.continue();
  };
  return promisifyRequest(store.transaction);
};
var keys = function(customStore = defaultGetStore()) {
  return customStore("readonly", (store) => {
    if (store.getAllKeys) {
      return promisifyRequest(store.getAllKeys());
    }
    const items = [];
    return eachCursor(store, (cursor) => items.push(cursor.key)).then(() => items);
  });
};
var defaultGetStoreFunc;

// src/operationQueue.ts
var PADDING = 6;
var entryKey = (index) => `write-${index.toString().padStart(PADDING, "0")}`;

class OperationQueue {
  session = uuid();
  proposedOperations = new Map;
  operationLabels = new Map;
  db;
  lastIndex = 0;
  load = undefined;
  op = 0;
  constructor(store) {
    this.db = store;
  }
  async propose(write, values, isLoad = false) {
    this.proposedOperations.set(write, [values, this.op++]);
    if (this.db) {
      if (this.load && !isLoad) {
        await this.load;
        this.proposedOperations.delete(write);
        this.proposedOperations.set(write, [values, this.op - 1]);
      }
      this.lastIndex++;
      const key = entryKey(this.lastIndex);
      write[this.session] = this.lastIndex;
      await set(key, [...values.entries()].map(([ref, val]) => [JSON.stringify(ref), val]), this.db);
      console.log(`STORE ${key} ${JSON.stringify([...values.entries()])}`);
    }
  }
  async label(write, label, isLoad = false) {
    this.operationLabels.set(label, write);
    if (this.db) {
      if (this.load && !isLoad)
        await this.load;
      const index = write[this.session];
      if (index === undefined)
        throw new Error("Cannot label an unproposed operation");
      const key = `label-${index}`;
      await set(key, label, this.db);
      console.log(`STORE ${key} ${label}`);
    }
  }
  async confirm(label, isLoad = false) {
    if (this.operationLabels.has(label)) {
      const operation = this.operationLabels.get(label);
      this.proposedOperations.delete(operation);
      this.operationLabels.delete(label);
      if (this.db) {
        if (this.load && !isLoad)
          await this.load;
        const index = operation[this.session];
        const keys2 = [entryKey(index), `label-${index}`];
        await delMany(keys2, this.db);
        console.log(`DEL ${keys2}`);
      }
    }
  }
  async cancel(operation, isLoad = false) {
    this.operationLabels.forEach((value, key) => {
      if (value === operation) {
        this.operationLabels.delete(key);
      }
    });
    this.proposedOperations.delete(operation);
    if (this.db) {
      if (this.load && !isLoad)
        await this.load;
      const index = operation[this.session];
      await delMany([`write-${index}`, `label-${index}`], this.db);
    }
  }
  async flatten() {
    if (this.load)
      await this.load;
    const mask = new OMap(url);
    this.proposedOperations.forEach(([values, op]) => {
      values.forEach((value, ref) => {
        mask.set(ref, [value, op]);
      });
    });
    return mask;
  }
  async restore(store, schedule) {
    this.db = store;
    this.proposedOperations.clear();
    this.operationLabels.clear();
    this.lastIndex = 0;
    this.load = new Promise(async (resolve) => {
      const allKeys = await keys(this.db);
      const entryKeys = allKeys.filter((key) => key.startsWith("write-")).sort();
      console.log("RESTORE", entryKeys);
      const entryValues = await getMany(entryKeys, this.db);
      for (let i = 0;i < entryKeys.length; i++) {
        const index = parseInt(entryKeys[i].split("-")[1]);
        this.lastIndex = Math.max(this.lastIndex, index);
      }
      for (let i = 0;i < entryKeys.length; i++) {
        const key = entryKeys[i];
        const index = parseInt(key.split("-")[1]);
        const entry = entryValues[i].map(([ref, val]) => [
          JSON.parse(ref),
          val
        ]);
        const label = await get(`label-${index}`, this.db);
        if (!entry)
          continue;
        const values = new Map(entry);
        await schedule(values, label);
        await delMany([`write-${index}`, `label-${index}`], this.db);
      }
      resolve(undefined);
    });
    return this.load;
  }
}

// src/json.ts
function merge(target, patch) {
  if (patch === undefined)
    return target;
  if (patch === null)
    return;
  if (typeof patch !== "object" || typeof target !== "object") {
    return patch;
  }
  const combined = typeof target === "object" ? { ...target } : {};
  for (let key in patch) {
    if (patch[key] === null) {
      delete combined[key];
    } else {
      combined[key] = merge(target[key], patch[key]);
    }
  }
  return combined;
}
var clone = (state) => JSON.parse(JSON.stringify(state));

// src/syncer.ts
var MANIFEST_KEY = "manifest";
var INITIAL_STATE = {
  previous: ".",
  files: {},
  update: {}
};

class Syncer {
  manifest;
  session_id = uuid().substring(0, 3);
  latest_key = "";
  latest_state = clone(INITIAL_STATE);
  loading;
  cache;
  db;
  latest_timestamp = 0;
  writes = 0;
  constructor(manifest) {
    this.manifest = manifest;
  }
  static manifestTimestamp = (key) => {
    const match = key.match(/@([0-9]+)_[0-9a-f]+_[0-9a-z]{4}$/);
    if (!match) {
      console.warn(`Rejecting manifest key ${key}`);
      return 0;
    }
    return Number.parseInt(match[1]);
  };
  static isValid(key, modified) {
    const match = key.match(/@([0-9]+)_[0-9a-f]+_[0-9a-z]{4}$/);
    if (!match) {
      console.warn(`Rejecting manifest key ${key}`);
      return false;
    }
    if (modified === undefined)
      return true;
    const manifestTimestamp = Number.parseInt(match[1]);
    const s3Timestamp = modified;
    const withinRange = Math.abs(manifestTimestamp - s3Timestamp.getTime()) < 5000;
    if (!withinRange) {
      console.warn(`Clock skew detected ${key} vs ${s3Timestamp.getTime()}`);
    }
    return withinRange;
  }
  async restore(db) {
    this.db = db;
    this.loading = get(MANIFEST_KEY, db).then((loaded) => {
      if (loaded) {
        this.latest_state = loaded;
        this.manifest.service.config.log(`RESTORE ${MANIFEST_KEY}`);
      }
    });
  }
  async getLatest() {
    if (this.loading)
      await this.loading;
    this.loading = undefined;
    if (!this.manifest.service.config.online) {
      return this.latest_state;
    }
    try {
      const poll = await this.manifest.service._getObject({
        operation: "POLL_TIME",
        ref: this.manifest.ref,
        ifNoneMatch: this.cache?.etag,
        useCache: false
      });
      if (poll.$metadata.httpStatusCode === 304) {
        return this.latest_state;
      }
      if (poll.data === undefined) {
        this.latest_key = ".";
      } else {
        this.latest_key = poll.data;
      }
      const timestamp2 = Syncer.manifestTimestamp(this.latest_key);
      const lag = Date.now() + this.manifest.service.config.clockOffset - 1e4;
      const lookback_time = Math.min(timestamp2, lag);
      const start_at = `${this.manifest.ref.key}@${lookback_time.toString().padStart(14, "0")}`;
      const [objects, dt] = await measure(this.manifest.service.s3ClientLite.listObjectV2({
        Bucket: this.manifest.ref.bucket,
        Prefix: this.manifest.ref.key + "@",
        StartAfter: start_at
      }));
      const manifests = objects.Contents?.filter((obj) => {
        if (!Syncer.isValid(obj.Key, obj.LastModified)) {
          if (this.manifest.service.config.autoclean) {
            this.manifest.service._deleteObject({
              operation: "CLEANUP",
              ref: {
                bucket: this.manifest.ref.bucket,
                key: obj.Key
              }
            });
          }
          return false;
        }
        return true;
      });
      this.manifest.service.config.log(`${dt}ms LIST ${this.manifest.ref.bucket}/${this.manifest.ref.key} from ${start_at}`);
      if (manifests === undefined) {
        this.latest_state = clone(INITIAL_STATE);
        return this.latest_state;
      }
      const gcPoint = `${this.manifest.ref.key}@${Math.max(Syncer.manifestTimestamp(this.latest_key) - 5000, 0).toString().padStart(14, "0")}`;
      this.latest_timestamp = Math.max(this.latest_timestamp, Syncer.manifestTimestamp(this.latest_key));
      let loadedFirst = false;
      for (let index = manifests.length - 1;index >= 0; index--) {
        const key = manifests[index].Key;
        const ref = {
          bucket: this.manifest.ref.bucket,
          key
        };
        const step = await this.manifest.service._getObject({
          operation: "LOOK_BACK",
          ref
        });
        if (step.data === undefined) {
          if (this.manifest.service.config.autoclean) {
            this.manifest.service._deleteObject({
              operation: "CLEANUP",
              ref
            });
          }
          continue;
        } else if (loadedFirst === false) {
          this.latest_state = step.data;
          this.latest_key = key;
          loadedFirst = true;
        }
      }
      for (let index = 0;index < manifests.length; index++) {
        const key = manifests[index].Key;
        if (key < this.latest_key && key < gcPoint) {
          if (this.manifest.service.config.autoclean) {
            this.manifest.service._deleteObject({
              operation: "CLEANUP",
              ref: {
                bucket: this.manifest.ref.bucket,
                key
              }
            });
          }
          continue;
        }
        const step = await this.manifest.service._getObject({
          operation: "SWEEP",
          ref: {
            bucket: this.manifest.ref.bucket,
            key
          }
        });
        const stepVersionid = key.substring(key.lastIndexOf("@") + 1);
        this.latest_state = merge(this.latest_state, step.data?.update);
        this.manifest.observeVersionId(stepVersionid);
      }
      if (this.db)
        set(MANIFEST_KEY, this.latest_state, this.db);
      return this.latest_state;
    } catch (err) {
      if (err.name === "NoSuchKey") {
        this.latest_state = INITIAL_STATE;
        return this.latest_state;
      } else {
        throw err;
      }
    }
  }
  updateContent(values, write, options) {
    const generate_manifest_key = () => timestamp(Math.max(Date.now() + this.manifest.service.config.clockOffset, this.latest_timestamp)) + "_" + this.session_id + "_" + countKey(this.writes++);
    let manifest_version = generate_manifest_key();
    const localPersistence = this.manifest.operationQueue.propose(write, values, options.isLoad);
    const remotePersistency = localPersistence.then(async () => {
      try {
        const update = await write;
        let response, manifest_key, retry2 = false;
        do {
          const state = await this.getLatest();
          state.previous = this.latest_key;
          state.update = {
            files: {}
          };
          for (let [ref, version] of update) {
            const fileUrl = url(ref);
            if (version) {
              const fileState = {
                version
              };
              state.update.files[fileUrl] = fileState;
            } else {
              state.update.files[fileUrl] = null;
            }
          }
          manifest_key = this.manifest.ref.key + "@" + manifest_version;
          this.manifest.operationQueue.label(write, manifest_version, options.isLoad);
          const putResponse = await this.manifest.service._putObject({
            operation: "PUT_MANIFEST",
            ref: {
              key: manifest_key,
              bucket: this.manifest.ref.bucket
            },
            value: state
          });
          if (this.manifest.service.config.adaptiveClock && !Syncer.isValid(manifest_key, putResponse.Date)) {
            this.manifest.service.config.clockOffset = putResponse.Date.getTime() - Date.now() + putResponse.latency;
            console.log(this.manifest.service.config.clockOffset);
            manifest_version = generate_manifest_key();
            retry2 = true;
          } else {
            retry2 = false;
          }
        } while (retry2);
        response = await this.manifest.service._putObject({
          operation: "PUT_POLL",
          ref: {
            key: this.manifest.ref.key,
            bucket: this.manifest.ref.bucket
          },
          value: this.latest_key
        });
        this.manifest.poll();
        return response;
      } catch (err) {
        console.error(err);
        this.manifest.operationQueue.cancel(write, options.isLoad);
        throw err;
      }
    });
    if (options.await === "local") {
      return localPersistence;
    } else {
      return remotePersistency;
    }
  }
}

// src/manifest.ts
class Subscriber {
  ref;
  handler;
  lastVersion;
  queue = Promise.resolve();
  constructor(ref, handler, lastVersion) {
    this.ref = ref;
    this.handler = handler;
    this.lastVersion = lastVersion;
  }
  notify(service, version, content) {
    this.queue = this.queue.then(() => content).then((response) => {
      if (version !== this.lastVersion) {
        service.config.log(`${service.config.label} NOTIFY ${url(this.ref)} ${version}`);
        this.lastVersion = version;
        this.handler(response);
      }
    });
  }
}

class Manifest {
  service;
  ref;
  subscribers = new Set;
  poller;
  pollInProgress = false;
  syncer = new Syncer(this);
  operationQueue = new OperationQueue;
  constructor(service, ref) {
    this.service = service;
    this.ref = ref;
    console.log("Create manifest", url(ref));
  }
  load(db) {
    this.syncer.restore(db);
    this.operationQueue.restore(db, async (values, label) => {
      if (!label) {
        await this.service._putAll(values, {
          manifests: [this.ref],
          await: "local",
          isLoad: true
        });
      } else {
        await this.updateContent(values, Promise.resolve(new Map([[this.ref, label]])), {
          await: "local",
          isLoad: true
        });
      }
    });
  }
  observeVersionId(versionId) {
    this.operationQueue.confirm(versionId);
  }
  async poll() {
    if (this.pollInProgress)
      return;
    this.pollInProgress = true;
    if (this.subscriberCount === 0 && this.poller) {
      clearInterval(this.poller);
      this.poller = undefined;
    }
    if (this.subscriberCount > 0 && !this.poller) {
      this.poller = setInterval(() => this.poll(), this.service.config.pollFrequency);
    }
    const state = await this.syncer.getLatest();
    if (state === undefined) {
      this.pollInProgress = false;
      return;
    }
    const mask = await this.operationQueue.flatten();
    this.subscribers.forEach(async (subscriber) => {
      if (mask.has(subscriber.ref)) {
        const [value, op] = mask.get(subscriber.ref);
        subscriber.notify(this.service, `local-${op}`, Promise.resolve(value));
      } else {
        const fileState = state.files[url(subscriber.ref)];
        if (fileState) {
          const content = this.service._getObject({
            operation: "GET_CONTENT",
            ref: subscriber.ref,
            version: fileState.version
          });
          subscriber.notify(this.service, fileState.version, content.then((res) => res.data));
        } else if (fileState === null) {
          subscriber.notify(this.service, undefined, Promise.resolve(undefined));
        }
      }
    });
    this.pollInProgress = false;
  }
  updateContent(values, write, options) {
    return this.syncer.updateContent(values, write, options);
  }
  async getVersion(ref) {
    return (await this.syncer.getLatest()).files[url(ref)]?.version;
  }
  subscribe(keyRef, handler) {
    this.service.config.log(`SUBSCRIBE ${url(keyRef)} ${this.subscriberCount + 1}`);
    const sub = new Subscriber(keyRef, handler);
    this.subscribers.add(sub);
    return () => this.subscribers.delete(sub);
  }
  get subscriberCount() {
    return this.subscribers.size;
  }
}

// src/indexdb.ts
var fetchFn = async (url_, init) => {
  const url2 = new URL(url_);
  const params = new URLSearchParams(url2.search);
  const segments = url2.pathname.split("/");
  const bucket = segments[1];
  const key = segments.slice(2).join("/");
  const db = createStore(bucket, "v0");
  let body;
  let status = 200;
  if (params.get("list-type")) {
    const prefix = encodeURIComponent(params.get("prefix") || "");
    const start_at = encodeURIComponent(params.get("start-after") || "");
    const list = (await keys(db)).filter((k) => `${k}`.startsWith(prefix) && `${k}` > start_at);
    body = `<ListBucketResult>${list.map((key2) => `<Contents><Key>${key2}</Key></Contents>`)}</ListBucketResult>`;
  } else if (init?.method === "GET") {
    body = await get(key, db);
    status = body === undefined ? 404 : 200;
  } else if (init?.method === "PUT") {
    body = await init.body;
    await set(key, body, db);
  } else if (init?.method === "DELETE") {
    await del(key, db);
  } else {
    throw new Error;
  }
  return new Response(body, { status });
};

// src/mps3.ts
async function sha256(message) {
  const msgBuffer = new TextEncoder().encode(message);
  const arrayBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
  return [...new Uint8Array(arrayBuffer)].map((bytes) => bytes.toString(16).padStart(2, "0")).join("");
}

class MPS3 {
  static LOCAL_ENDPOINT = "indexdb:";
  config;
  s3ClientLite;
  manifests = new OMap(url);
  memCache = new OMap((input) => `${input.Bucket}${input.Key}${input.VersionId}${input.IfNoneMatch}`);
  diskCache;
  endpoint;
  constructor(config) {
    this.config = {
      ...config,
      label: config.label || "default",
      useChecksum: config.useChecksum === false ? false : true,
      autoclean: config.autoclean === false ? false : true,
      online: config.online === false ? false : true,
      offlineStorage: config.offlineStorage === false ? false : true,
      useVersioning: config.useVersioning || false,
      pollFrequency: config.pollFrequency || 1000,
      clockOffset: Math.floor(config.clockOffset) || 0,
      adaptiveClock: config.adaptiveClock === false ? false : true,
      parser: config.parser || new DOMParser,
      defaultManifest: {
        bucket: config.defaultManifest?.bucket || config.defaultBucket,
        key: typeof config.defaultManifest == "string" ? config.defaultManifest : config.defaultManifest?.key || "manifest.json"
      },
      log: (...args) => (config.log || console.log)(this.config.label, ...args)
    };
    if (this.config.s3Config?.credentials instanceof Function)
      throw Error("We can't do that yet");
    this.endpoint = config.s3Config.endpoint || `https://s3.${config.s3Config.region}.amazonaws.com`;
    let fetchFn2;
    if (this.config.s3Config?.credentials) {
      const client = new AwsClient({
        accessKeyId: this.config.s3Config.credentials.accessKeyId,
        secretAccessKey: this.config.s3Config.credentials.secretAccessKey,
        sessionToken: this.config.s3Config.credentials.sessionToken,
        region: this.config.s3Config.region || "us-east-1",
        service: "s3",
        retries: 0
      });
      fetchFn2 = (...args) => client.fetch(...args);
    } else if (this.endpoint == MPS3.LOCAL_ENDPOINT) {
      fetchFn2 = fetchFn;
    } else {
      fetchFn2 = (global || window).fetch.bind(global || window);
    }
    if (this.config.offlineStorage) {
      const dbName = `mps3-${this.config.label}`;
      this.diskCache = createStore(dbName, "v0");
    }
    this.s3ClientLite = new S3ClientLite(this.config.online ? fetchFn2 : () => new Promise(() => {
    }), this.endpoint, this);
  }
  getOrCreateManifest(ref) {
    if (!this.manifests.has(ref)) {
      const manifest = new Manifest(this, ref);
      this.manifests.set(ref, manifest);
      if (this.config.offlineStorage) {
        const dbName = `mps3-${this.config.label}-${ref.bucket}-${ref.key}`;
        const db = createStore(dbName, "v0");
        this.config.log(`Restoring manifest from ${dbName}`);
        manifest.load(db);
      }
    }
    return this.manifests.get(ref);
  }
  async get(ref, options = {}) {
    const manifestRef = {
      ...this.config.defaultManifest,
      ...options.manifest
    };
    const manifest = this.getOrCreateManifest(manifestRef);
    const contentRef = {
      bucket: ref.bucket || this.config.defaultBucket || this.config.defaultManifest.bucket,
      key: typeof ref === "string" ? ref : ref.key
    };
    const inflight = await manifest.operationQueue.flatten();
    if (inflight.has(contentRef)) {
      this.config.log(`GET (cached) ${contentRef} ${inflight.get(contentRef)}`);
      return inflight.get(contentRef)[0];
    }
    const version = await manifest.getVersion(contentRef);
    if (version === undefined)
      return;
    return (await this._getObject({
      operation: "GET",
      ref: contentRef,
      version
    })).data;
  }
  async _getObject(args) {
    let command;
    if (this.config.useVersioning) {
      command = {
        Bucket: args.ref.bucket,
        Key: args.ref.key,
        IfNoneMatch: args.ifNoneMatch,
        ...args.version && { VersionId: args.version }
      };
    } else {
      command = {
        Bucket: args.ref.bucket,
        Key: `${args.ref.key}${args.version ? `@${args.version}` : ""}`,
        IfNoneMatch: args.ifNoneMatch
      };
    }
    const key = `${command.Bucket}|${command.Key}|${command.VersionId}`;
    if (args.useCache !== false) {
      if (this.memCache.has(command)) {
        return this.memCache.get(command);
      }
      if (this.diskCache) {
        const cached = await get(key, this.diskCache);
        if (cached) {
          this.config.log(`${args.operation} (disk cached) ${key}`);
          this.memCache.set(command, Promise.resolve(cached));
          return cached;
        }
      }
    }
    if (!this.config.online) {
      throw new Error(`${this.config.label} Offline and value not cached for ${key}`);
    }
    const work = measure(this.s3ClientLite.getObject(command)).then(async ([apiResponse, time]) => {
      const response = {
        $metadata: apiResponse.$metadata,
        ETag: apiResponse.ETag,
        data: apiResponse.Body
      };
      this.config.log(`${time}ms ${args.operation} ${args.ref.bucket}/${args.ref.key}@${args.version} => ${response.VersionId}`);
      return response;
    }).catch((err) => {
      if (err?.name === "304") {
        return {
          $metadata: {
            httpStatusCode: 304
          },
          data: undefined
        };
      } else {
        throw err;
      }
    });
    if (args.useCache !== false) {
      this.memCache.set(command, work);
      if (this.diskCache) {
        work.then((response) => {
          set(`${command.Bucket}${command.Key}${command.VersionId}`, response, this.diskCache).then(() => this.config.log(`STORE ${command.Bucket}${command.Key}`));
        });
      }
    }
    return work;
  }
  async delete(ref, options = {}) {
    return this.putAll(new Map([[ref, undefined]]), options);
  }
  async put(ref, value, options = {}) {
    return this.putAll(new Map([[ref, value]]), options);
  }
  async putAll(values, options = {}) {
    const resolvedValues = new Map([...values].map(([ref, value]) => [
      {
        bucket: ref.bucket || this.config.defaultBucket || this.config.defaultManifest.bucket,
        key: typeof ref === "string" ? ref : ref.key
      },
      value
    ]));
    const manifests = (options?.manifests || [this.config.defaultManifest]).map((ref) => ({
      ...this.config.defaultManifest,
      ...ref
    }));
    return this._putAll(resolvedValues, {
      manifests,
      await: options.await || this.config.online ? "remote" : "local"
    });
  }
  async _putAll(values, options) {
    const webValues = new Map;
    const contentVersions = new Promise(async (resolve, reject) => {
      const results = new Map;
      const contentOperations = [];
      values.forEach((value, contentRef) => {
        if (value !== undefined) {
          let version = this.config.useVersioning ? undefined : uuid();
          webValues.set(contentRef, value);
          contentOperations.push(this._putObject({
            operation: "PUT_CONTENT",
            ref: contentRef,
            value,
            version
          }).then((fileUpdate) => {
            if (this.config.useVersioning) {
              if (fileUpdate.VersionId === undefined) {
                console.error(fileUpdate);
                throw Error(`Bucket ${contentRef.bucket} is not version enabled!`);
              } else {
                version = fileUpdate.VersionId;
              }
            }
            results.set(contentRef, version);
          }));
        } else {
          contentOperations.push(this._deleteObject({
            ref: contentRef
          }).then((_) => {
            results.set(contentRef, undefined);
          }));
        }
      });
      await Promise.all(contentOperations).catch(reject);
      resolve(results);
    });
    return Promise.all(options.manifests.map((ref) => {
      const manifest = this.getOrCreateManifest(ref);
      return manifest.updateContent(webValues, contentVersions, {
        await: options.await,
        isLoad: options.isLoad === true
      });
    }));
  }
  async _putObject(args) {
    const content = JSON.stringify(args.value, null, 2);
    let command;
    if (this.config.useVersioning) {
      command = {
        Bucket: args.ref.bucket,
        Key: args.ref.key,
        ContentType: "application/json",
        Body: content,
        ...this.config.useChecksum && {
          ChecksumSHA256: await sha256(content)
        }
      };
    } else {
      command = {
        Bucket: args.ref.bucket,
        Key: `${args.ref.key}${args.version ? `@${args.version}` : ""}`,
        ContentType: "application/json",
        Body: content,
        ...this.config.useChecksum && {
          ChecksumSHA256: await sha256(content)
        }
      };
    }
    const [response, dt] = await measure(this.s3ClientLite.putObject(command));
    this.config.log(`${dt}ms ${args.operation} ${command.Bucket}/${command.Key} => ${response.VersionId}`);
    if (this.diskCache) {
      const diskKey = `${command.Bucket}${command.Key}${args.version || response.VersionId}`;
      await set(diskKey, {
        $metadata: {
          httpStatusCode: 200
        },
        etag: response.ETag,
        data: JSON.parse(content)
      }, this.diskCache).then(() => this.config.log(`STORE ${diskKey}`));
    }
    return { ...response, latency: dt };
  }
  async _deleteObject(args) {
    const command = {
      Bucket: args.ref.bucket,
      Key: args.ref.key
    };
    const [response, dt] = await measure(this.s3ClientLite.deleteObject(command));
    this.config.log(`${dt}ms ${args.operation || "DELETE"} ${args.ref.bucket}/${args.ref.key} (${response.$metadata.httpStatusCode})}`);
    return response;
  }
  subscribe(key, handler, options) {
    const manifestRef = {
      ...this.config.defaultManifest,
      ...options?.manifest
    };
    const keyRef = {
      key: typeof key === "string" ? key : key.key,
      bucket: key.bucket || this.config.defaultBucket || manifestRef.bucket
    };
    const manifest = this.getOrCreateManifest(manifestRef);
    const unsubscribe = manifest.subscribe(keyRef, handler);
    this.get(keyRef, {
      manifest: manifestRef
    }).then((initial) => {
      this.config.log(`NOTIFY (initial) ${url(keyRef)}`);
      queueMicrotask(() => {
        handler(initial, undefined);
        manifest.poll();
      });
    }).catch((error) => {
      handler(undefined, error);
    });
    return unsubscribe;
  }
  refresh() {
    return Promise.all([...this.manifests.values()].map((manifest) => manifest.poll()));
  }
  get subscriberCount() {
    return [...this.manifests.values()].reduce((count, manifest) => count + manifest.subscriberCount, 0);
  }
}
export {
  MPS3
};
