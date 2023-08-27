# MPS3
⚠️ Under development - bugs and contributions welcome

## Infraless Database over any s3 storage API. 

A browser database client for any S3-compatible API.

- Avoid vendor lock-in, your data stays with you.
- Built for operational simplicity
    - no infra to setup and manage beyond the storage bucket.
    - storage representation is intuitive and supports interventions  
- Designed for correctness
    - sync protocol is causally consistent under concurrent writes.

Tested with S3, Backblaze or self-hosted solutions like Minio. R2 should work.

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

mps3.subscribe("key", (val) => console.log(val)); // causally consist listeners

const value = await mps3.get("key"); // read-after-write consist
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
