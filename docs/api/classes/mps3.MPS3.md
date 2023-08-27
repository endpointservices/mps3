[mps3](../API.md) / [mps3](../modules/mps3.md) / MPS3

# Class: MPS3

[mps3](../modules/mps3.md).MPS3

## Table of contents

### Constructors

- [constructor](mps3.MPS3.md#constructor)

### Properties

- [config](mps3.MPS3.md#config)
- [getCache](mps3.MPS3.md#getcache)
- [manifests](mps3.MPS3.md#manifests)
- [s3ClientLite](mps3.MPS3.md#s3clientlite)

### Accessors

- [subscriberCount](mps3.MPS3.md#subscribercount)

### Methods

- [\_deleteObject](mps3.MPS3.md#_deleteobject)
- [\_getObject](mps3.MPS3.md#_getobject)
- [\_putAll](mps3.MPS3.md#_putall)
- [\_putObject](mps3.MPS3.md#_putobject)
- [delete](mps3.MPS3.md#delete)
- [get](mps3.MPS3.md#get)
- [getOrCreateManifest](mps3.MPS3.md#getorcreatemanifest)
- [put](mps3.MPS3.md#put)
- [putAll](mps3.MPS3.md#putall)
- [refresh](mps3.MPS3.md#refresh)
- [subscribe](mps3.MPS3.md#subscribe)

## Constructors

### constructor

• **new MPS3**(`config`)

#### Parameters

| Name | Type |
| :------ | :------ |
| `config` | [`MPS3Config`](../interfaces/mps3.MPS3Config.md) |

#### Defined in

[mps3.ts:40](https://github.com/endpointservices/mps3/blob/f1b10b6/src/mps3.ts#L40)

## Properties

### config

• **config**: `ResolvedMPS3Config`

#### Defined in

[mps3.ts:36](https://github.com/endpointservices/mps3/blob/f1b10b6/src/mps3.ts#L36)

___

### getCache

• **getCache**: [`OMap`](OMap.OMap.md)<`GetObjectCommandInput`, `Promise`<`GetObjectCommandOutput` & { `data`: `any`  }\>\>

#### Defined in

[mps3.ts:121](https://github.com/endpointservices/mps3/blob/f1b10b6/src/mps3.ts#L121)

___

### manifests

• **manifests**: [`OMap`](OMap.OMap.md)<[`ResolvedRef`](../interfaces/types.ResolvedRef.md), [`Manifest`](manifest.Manifest.md)\>

#### Defined in

[mps3.ts:38](https://github.com/endpointservices/mps3/blob/f1b10b6/src/mps3.ts#L38)

___

### s3ClientLite

• **s3ClientLite**: [`S3ClientLite`](S3ClientLite.S3ClientLite.md)

#### Defined in

[mps3.ts:37](https://github.com/endpointservices/mps3/blob/f1b10b6/src/mps3.ts#L37)

## Accessors

### subscriberCount

• `get` **subscriberCount**(): `number`

#### Returns

`number`

#### Defined in

[mps3.ts:380](https://github.com/endpointservices/mps3/blob/f1b10b6/src/mps3.ts#L380)

## Methods

### \_deleteObject

▸ **_deleteObject**(`args`): `Promise`<`DeleteObjectCommandOutput`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `args` | `Object` |
| `args.ref` | [`ResolvedRef`](../interfaces/types.ResolvedRef.md) |

#### Returns

`Promise`<`DeleteObjectCommandOutput`\>

#### Defined in

[mps3.ts:327](https://github.com/endpointservices/mps3/blob/f1b10b6/src/mps3.ts#L327)

___

### \_getObject

▸ **_getObject**<`T`\>(`args`): `Promise`<`GetObjectCommandOutput` & { `data`: `undefined` \| `T`  }\>

#### Type parameters

| Name |
| :------ |
| `T` |

#### Parameters

| Name | Type |
| :------ | :------ |
| `args` | `Object` |
| `args.ifNoneMatch?` | `string` |
| `args.operation` | `string` |
| `args.ref` | [`ResolvedRef`](../interfaces/types.ResolvedRef.md) |
| `args.version?` | `string` |

#### Returns

`Promise`<`GetObjectCommandOutput` & { `data`: `undefined` \| `T`  }\>

#### Defined in

[mps3.ts:129](https://github.com/endpointservices/mps3/blob/f1b10b6/src/mps3.ts#L129)

___

### \_putAll

▸ **_putAll**(`values`, `options`): `Promise`<`PutObjectCommandOutput`[]\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `values` | [`OMap`](OMap.OMap.md)<[`ResolvedRef`](../interfaces/types.ResolvedRef.md), `undefined` \| [`JSONValue`](../modules/types.md#jsonvalue)\> |
| `options` | `Object` |
| `options.manifests` | [`ResolvedRef`](../interfaces/types.ResolvedRef.md)[] |

#### Returns

`Promise`<`PutObjectCommandOutput`[]\>

#### Defined in

[mps3.ts:234](https://github.com/endpointservices/mps3/blob/f1b10b6/src/mps3.ts#L234)

___

### \_putObject

▸ **_putObject**(`args`): `Promise`<`PutObjectCommandOutput`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `args` | `Object` |
| `args.operation` | `string` |
| `args.ref` | [`ResolvedRef`](../interfaces/types.ResolvedRef.md) |
| `args.value` | `any` |
| `args.version?` | `string` |

#### Returns

`Promise`<`PutObjectCommandOutput`\>

#### Defined in

[mps3.ts:289](https://github.com/endpointservices/mps3/blob/f1b10b6/src/mps3.ts#L289)

___

### delete

▸ **delete**(`ref`, `options?`): `Promise`<`PutObjectCommandOutput`[]\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `ref` | `string` \| [`Ref`](../interfaces/types.Ref.md) |
| `options` | `Object` |
| `options.manifests?` | [`Ref`](../interfaces/types.Ref.md)[] |

#### Returns

`Promise`<`PutObjectCommandOutput`[]\>

#### Defined in

[mps3.ts:183](https://github.com/endpointservices/mps3/blob/f1b10b6/src/mps3.ts#L183)

___

### get

▸ **get**(`ref`, `options?`): `Promise`<`undefined` \| [`JSONValue`](../modules/types.md#jsonvalue)\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `ref` | `string` \| [`Ref`](../interfaces/types.Ref.md) |
| `options` | `Object` |
| `options.manifest?` | [`Ref`](../interfaces/types.Ref.md) |

#### Returns

`Promise`<`undefined` \| [`JSONValue`](../modules/types.md#jsonvalue)\>

#### Defined in

[mps3.ts:79](https://github.com/endpointservices/mps3/blob/f1b10b6/src/mps3.ts#L79)

___

### getOrCreateManifest

▸ **getOrCreateManifest**(`ref`): [`Manifest`](manifest.Manifest.md)

#### Parameters

| Name | Type |
| :------ | :------ |
| `ref` | [`ResolvedRef`](../interfaces/types.ResolvedRef.md) |

#### Returns

[`Manifest`](manifest.Manifest.md)

#### Defined in

[mps3.ts:72](https://github.com/endpointservices/mps3/blob/f1b10b6/src/mps3.ts#L72)

___

### put

▸ **put**(`ref`, `value`, `options?`): `Promise`<`PutObjectCommandOutput`[]\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `ref` | `string` \| [`Ref`](../interfaces/types.Ref.md) |
| `value` | `undefined` \| [`JSONValue`](../modules/types.md#jsonvalue) |
| `options` | `Object` |
| `options.manifests?` | [`Ref`](../interfaces/types.Ref.md)[] |

#### Returns

`Promise`<`PutObjectCommandOutput`[]\>

#### Defined in

[mps3.ts:192](https://github.com/endpointservices/mps3/blob/f1b10b6/src/mps3.ts#L192)

___

### putAll

▸ **putAll**(`values`, `options?`): `Promise`<`PutObjectCommandOutput`[]\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `values` | `Map`<`string` \| [`Ref`](../interfaces/types.Ref.md), `undefined` \| [`JSONValue`](../modules/types.md#jsonvalue)\> |
| `options` | `Object` |
| `options.manifests?` | [`Ref`](../interfaces/types.Ref.md)[] |

#### Returns

`Promise`<`PutObjectCommandOutput`[]\>

#### Defined in

[mps3.ts:202](https://github.com/endpointservices/mps3/blob/f1b10b6/src/mps3.ts#L202)

___

### refresh

▸ **refresh**(): `Promise`<`unknown`\>

#### Returns

`Promise`<`unknown`\>

#### Defined in

[mps3.ts:375](https://github.com/endpointservices/mps3/blob/f1b10b6/src/mps3.ts#L375)

___

### subscribe

▸ **subscribe**(`key`, `handler`, `options?`): () => `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `key` | `string` |
| `handler` | (`value`: `undefined` \| [`JSONValue`](../modules/types.md#jsonvalue)) => `void` |
| `options?` | `Object` |
| `options.bucket?` | `string` |
| `options.manifest?` | [`Ref`](../interfaces/types.Ref.md) |

#### Returns

`fn`

▸ (): `void`

##### Returns

`void`

#### Defined in

[mps3.ts:341](https://github.com/endpointservices/mps3/blob/f1b10b6/src/mps3.ts#L341)
