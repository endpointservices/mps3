# mps3 - A Causally Consistent Multiplayer Database over S3

⚠️ Under development - bugs and contributions welcome

### Multiplayer over any s3-compatible storage. 

Written to provide a fast path for multiplayer without vendor lockin.

You can use this library over S3, Backblaze, <strike>R2</strike>(no object versioning) or self-hosted solutions like Minio.

## Features

- Optimistic updates
- Atomic bulk s3 operations
- Multiplayer
- If-None-Match and ChecksumSHA256 header optimizations

coming soon
- Offline first


## How it works

The mps3 client wraps an S3 API and provides a key-value store interface: *put*, *get*, *subscribe*. Each key is a path of a JSON object into an s3 bucket. 

To enable additional semantics, groups of objects are managed by a manifest file. The manifest file enables atomic bulk updates, serializability and improves sync performance. The manifest primarily lists all objects *and their versions*.

When using *putAll*, the values are first written and then the manifest is written with the new object versions, so the bulk operation is observerved atomically. You can think of the manifest as the final commit step in a write-ahead-log.

#### Collision avoidance

It is possible multiple clients update the manifest at the same time. If we assumed the latest manifest was the source of truth this would lead to lost writes under contention. Instead, each manifest references the previous manifest version it was based upon and includes the JSON-merge-patch operation that was intended. At read time several manifest versions are read and the latest state is derived by applying the merge-patches sequentially if needed. Thanks to S3's recent [consistency](https://aws.amazon.com/s3/consistency/) upgrades this works out.

#### Optimistic Updates

Puts are buffered in a local cache, and raised to local subscriptions immediately. Long term it is indended we materialize the caching for local first experiences.

## API

### *new MPS3(config)*

Constructs a new client. 

```
config: {
    defaultBucket: string;
    defaultManifest?: {
        key: string
        bucket?: string
    }
    s3Config: S3ClientConfig;
}
```

### *put(key, value, options?)* or *putAll(Map<key, value>, options?)*

Writes a value (or values) as a JSON object in a bucket. To delete an object use the value `undefined` 

```
options: {
    bucket?: string,
    manifests?: {
        key: string
        bucket?: string
    }[]
}
```

### *get(key, options?): Promise\<value\>*

Reads a value

```
options: {
    bucket?: string,
    manifest?: {
        key: string
        bucket?: string
    }
}
```

### subscribe(key, callback, options?)

Subscribe to changes of a key.

```
options: {
    bucket?: string,
    manifest?: {
        key: string
        bucket?: string
    }
}
```

<!-- TSDOC_START -->

## :toolbox: Functions

- [uuid](#gear-uuid)
- [eq](#gear-eq)
- [url](#gear-url)
- [parseUrl](#gear-parseurl)

### :gear: uuid

| Function | Type |
| ---------- | ---------- |
| `uuid` | `() => string` |

### :gear: eq

| Function | Type |
| ---------- | ---------- |
| `eq` | `(a: Ref, b: Ref) => boolean` |

### :gear: url

| Function | Type |
| ---------- | ---------- |
| `url` | `(ref: Ref) => string` |

### :gear: parseUrl

| Function | Type |
| ---------- | ---------- |
| `parseUrl` | `(url: string) => ResolvedRef` |


## :factory: MPS3

### Methods

- [getOrCreateManifest](#gear-getorcreatemanifest)
- [get](#gear-get)
- [delete](#gear-delete)
- [put](#gear-put)
- [putAll](#gear-putall)
- [subscribe](#gear-subscribe)
- [refresh](#gear-refresh)

#### :gear: getOrCreateManifest

| Method | Type |
| ---------- | ---------- |
| `getOrCreateManifest` | `(ref: ResolvedRef) => Manifest` |

#### :gear: get

| Method | Type |
| ---------- | ---------- |
| `get` | `(ref: any, options?: { manifest?: Ref; }) => Promise<any>` |

#### :gear: delete

| Method | Type |
| ---------- | ---------- |
| `delete` | `(ref: any, options?: { manifests?: Ref[]; }) => Promise<any>` |

#### :gear: put

| Method | Type |
| ---------- | ---------- |
| `put` | `(ref: any, value: any, options?: { manifests?: Ref[]; }) => Promise<any>` |

#### :gear: putAll

| Method | Type |
| ---------- | ---------- |
| `putAll` | `(values: Map<any, any>, options?: { manifests?: Ref[]; }) => Promise<any>` |

#### :gear: subscribe

| Method | Type |
| ---------- | ---------- |
| `subscribe` | `(key: string, handler: (value: any) => void, options?: { bucket?: string; manifest?: Ref; }) => () => void` |

#### :gear: refresh

| Method | Type |
| ---------- | ---------- |
| `refresh` | `() => Promise<unknown>` |


<!-- TSDOC_END -->
