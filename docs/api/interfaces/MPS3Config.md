[mps3](../API.md) / MPS3Config

# Interface: MPS3Config

## Table of contents

### Properties

- [adaptiveClock](MPS3Config.md#adaptiveclock)
- [autoclean](MPS3Config.md#autoclean)
- [clockOffset](MPS3Config.md#clockoffset)
- [defaultBucket](MPS3Config.md#defaultbucket)
- [defaultManifest](MPS3Config.md#defaultmanifest)
- [log](MPS3Config.md#log)
- [offlineStorage](MPS3Config.md#offlinestorage)
- [online](MPS3Config.md#online)
- [parser](MPS3Config.md#parser)
- [pollFrequency](MPS3Config.md#pollfrequency)
- [s3Config](MPS3Config.md#s3config)
- [useVersioning](MPS3Config.md#useversioning)

## Properties

### adaptiveClock

• `Optional` **adaptiveClock**: `boolean`

Update clock on detection of skewed clock

#### Defined in

[mps3.ts:86](https://github.com/endpointservices/mps3/blob/3127fb5/src/mps3.ts#L86)

___

### autoclean

• `Optional` **autoclean**: `boolean`

Should the client delete expired references?

#### Defined in

[mps3.ts:76](https://github.com/endpointservices/mps3/blob/3127fb5/src/mps3.ts#L76)

___

### clockOffset

• `Optional` **clockOffset**: `number`

Clock offset in milliseconds

#### Defined in

[mps3.ts:81](https://github.com/endpointservices/mps3/blob/3127fb5/src/mps3.ts#L81)

___

### defaultBucket

• **defaultBucket**: `string`

Bucket to use by default

#### Defined in

[mps3.ts:25](https://github.com/endpointservices/mps3/blob/3127fb5/src/mps3.ts#L25)

___

### defaultManifest

• `Optional` **defaultManifest**: `string` \| `Ref`

Default manifest to use if one is not specified in an
operation's options

**`Default Value`**

```ts
{ bucket: defaultBucket, key: "manifest.json" }
```

#### Defined in

[mps3.ts:31](https://github.com/endpointservices/mps3/blob/3127fb5/src/mps3.ts#L31)

___

### log

• `Optional` **log**: (...`args`: `any`) => `void`

#### Type declaration

▸ (`...args`): `void`

Bring your own logger

##### Parameters

| Name | Type |
| :------ | :------ |
| `...args` | `any` |

##### Returns

`void`

#### Defined in

[mps3.ts:91](https://github.com/endpointservices/mps3/blob/3127fb5/src/mps3.ts#L91)

___

### offlineStorage

• `Optional` **offlineStorage**: `boolean`

Should the client store writes locally?

#### Defined in

[mps3.ts:71](https://github.com/endpointservices/mps3/blob/3127fb5/src/mps3.ts#L71)

___

### online

• `Optional` **online**: `boolean`

Should the client write to upstreams?

#### Defined in

[mps3.ts:66](https://github.com/endpointservices/mps3/blob/3127fb5/src/mps3.ts#L66)

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

[mps3.ts:61](https://github.com/endpointservices/mps3/blob/3127fb5/src/mps3.ts#L61)

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

[mps3.ts:48](https://github.com/endpointservices/mps3/blob/3127fb5/src/mps3.ts#L48)

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

[mps3.ts:54](https://github.com/endpointservices/mps3/blob/3127fb5/src/mps3.ts#L54)

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

[mps3.ts:38](https://github.com/endpointservices/mps3/blob/3127fb5/src/mps3.ts#L38)
