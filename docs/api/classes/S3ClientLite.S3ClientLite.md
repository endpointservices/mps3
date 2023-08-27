[mps3](../API.md) / [S3ClientLite](../modules/S3ClientLite.md) / S3ClientLite

# Class: S3ClientLite

[S3ClientLite](../modules/S3ClientLite.md).S3ClientLite

## Table of contents

### Constructors

- [constructor](S3ClientLite.S3ClientLite.md#constructor)

### Properties

- [client](S3ClientLite.S3ClientLite.md#client)
- [endpoint](S3ClientLite.S3ClientLite.md#endpoint)
- [parser](S3ClientLite.S3ClientLite.md#parser)

### Methods

- [deleteObject](S3ClientLite.S3ClientLite.md#deleteobject)
- [getObject](S3ClientLite.S3ClientLite.md#getobject)
- [listObjectV2](S3ClientLite.S3ClientLite.md#listobjectv2)
- [putObject](S3ClientLite.S3ClientLite.md#putobject)

## Constructors

### constructor

• **new S3ClientLite**(`client`, `endpoint`, `parser`)

#### Parameters

| Name | Type |
| :------ | :------ |
| `client` | `AwsClient` |
| `endpoint` | `string` |
| `parser` | `DOMParser` |

#### Defined in

[S3ClientLite.ts:18](https://github.com/endpointservices/mps3/blob/f1b10b6/src/S3ClientLite.ts#L18)

## Properties

### client

• **client**: `AwsClient`

#### Defined in

[S3ClientLite.ts:15](https://github.com/endpointservices/mps3/blob/f1b10b6/src/S3ClientLite.ts#L15)

___

### endpoint

• **endpoint**: `string`

#### Defined in

[S3ClientLite.ts:16](https://github.com/endpointservices/mps3/blob/f1b10b6/src/S3ClientLite.ts#L16)

___

### parser

• **parser**: `DOMParser`

#### Defined in

[S3ClientLite.ts:17](https://github.com/endpointservices/mps3/blob/f1b10b6/src/S3ClientLite.ts#L17)

## Methods

### deleteObject

▸ **deleteObject**(`command`): `Promise`<`DeleteObjectCommandOutput`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `command` | `DeleteObjectCommandInput` |

#### Returns

`Promise`<`DeleteObjectCommandOutput`\>

#### Defined in

[S3ClientLite.ts:56](https://github.com/endpointservices/mps3/blob/f1b10b6/src/S3ClientLite.ts#L56)

___

### getObject

▸ **getObject**(`command`): `Promise`<`GetObjectCommandOutput`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `command` | `GetObjectCommandInput` |

#### Returns

`Promise`<`GetObjectCommandOutput`\>

#### Defined in

[S3ClientLite.ts:70](https://github.com/endpointservices/mps3/blob/f1b10b6/src/S3ClientLite.ts#L70)

___

### listObjectV2

▸ **listObjectV2**(`command`): `Promise`<`ListObjectsV2CommandOutput`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `command` | `ListObjectsV2CommandInput` |

#### Returns

`Promise`<`ListObjectsV2CommandOutput`\>

#### Defined in

[S3ClientLite.ts:24](https://github.com/endpointservices/mps3/blob/f1b10b6/src/S3ClientLite.ts#L24)

___

### putObject

▸ **putObject**(`command`): `Promise`<`PutObjectCommandOutput`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `command` | `PutObjectCommandInput` |

#### Returns

`Promise`<`PutObjectCommandOutput`\>

#### Defined in

[S3ClientLite.ts:36](https://github.com/endpointservices/mps3/blob/f1b10b6/src/S3ClientLite.ts#L36)
