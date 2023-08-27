[mps3](../API.md) / MPS3Config

# Interface: MPS3Config

## Table of contents

### Properties

- [defaultBucket](MPS3Config.md#defaultbucket)
- [defaultManifest](MPS3Config.md#defaultmanifest)
- [parser](MPS3Config.md#parser)
- [pollFrequency](MPS3Config.md#pollfrequency)
- [s3Config](MPS3Config.md#s3config)
- [useVersioning](MPS3Config.md#useversioning)

## Properties

### defaultBucket

• **defaultBucket**: `string`

Bucket to use by default

#### Defined in

[mps3.ts:22](https://github.com/endpointservices/mps3/blob/4261d21/src/mps3.ts#L22)

___

### defaultManifest

• `Optional` **defaultManifest**: `Ref`

Default manifest to use if one is not specified in an
operation's options

**`Default Value`**

```ts
{ bucket: defaultBucket, key: "manifest.json" }
```

#### Defined in

[mps3.ts:28](https://github.com/endpointservices/mps3/blob/4261d21/src/mps3.ts#L28)

___

### parser

• `Optional` **parser**: `DOMParser`

DOMParser to use to parse XML responses from S3. The browser has one
but in other Javascript environments you may need to provide one.

**`Default Value`**

```ts
new window.DOMParser()
```

#### Defined in

[mps3.ts:58](https://github.com/endpointservices/mps3/blob/4261d21/src/mps3.ts#L58)

___

### pollFrequency

• `Optional` **pollFrequency**: `number`

Frequency in milliseconds subscribers poll for changes.
Each poll consumes a GET API request, but minimal egress
due to If-None-Match request optimizations.

**`Default Value`**

```ts
1000
```

#### Defined in

[mps3.ts:45](https://github.com/endpointservices/mps3/blob/4261d21/src/mps3.ts#L45)

___

### s3Config

• **s3Config**: `S3ClientConfig`

S3ClientConfig, only some features are supported. Please report feature requests.

**`See`**

https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-s3/interfaces/s3clientconfig.html

**`Default Value`**

```ts
1000
```

#### Defined in

[mps3.ts:51](https://github.com/endpointservices/mps3/blob/4261d21/src/mps3.ts#L51)

___

### useVersioning

• `Optional` **useVersioning**: `boolean`

Feature toggle to use versioning on content objects. If not
using versioning content keys are appended with `@<version>`.
Host bucket must have versioning enabled for this to work.

**`Default Value`**

```ts
false
```

#### Defined in

[mps3.ts:35](https://github.com/endpointservices/mps3/blob/4261d21/src/mps3.ts#L35)
