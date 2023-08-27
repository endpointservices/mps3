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

Puts are buffered in a local cache, and raised to local subscriptions immediately. Long term it is intended we materialize the caching for local first experiences.

## API

To use this library you construct an MP3S class as the public interface.

[mps3 class](docs/api/classes/mps3.MPS3.md)

### Quick start
```
import {MPS3} from 'https://cdn.skypack.dev/mps3@0.0.58?min'

const mp3s = new MPS3({
  defaultBucket: "<BUCKET>",
  s3Config: {
    region: "<REGION>",
    credentials: {
      accessKeyId: "<ACCESS_KEY>",
      secretAccessKey: "<SECRET_KEY>"
    }
  }
});

mp3s.put("key", "myValue"); // can await for confirmation

mps3.subscribe("key", (val) => console.log(val));

const value = await mps3.get("key");
```



### CORS

For the client to work properly some CORS configuration is required on the bucket so the Javascript environment can observe some metadata.

```
[{
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
    "AllowedOrigins": ["*"],
    "ExposeHeaders": ["X-Amz-Version-Id", "ETag"]
}]
```

### Advanced Usage

Consult the [API Documentation
](docs/api/classes/mps3.MPS3.md) for advanced usage.
- atomic batch operations
- multiple manifests
