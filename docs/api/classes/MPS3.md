[mps3](../API.md) / MPS3

# Class: MPS3

## Table of contents

### Constructors

- [constructor](MPS3.md#constructor)

### Methods

- [delete](MPS3.md#delete)
- [get](MPS3.md#get)
- [put](MPS3.md#put)
- [putAll](MPS3.md#putall)
- [subscribe](MPS3.md#subscribe)

## Constructors

### constructor

• **new MPS3**(`config`)

#### Parameters

| Name | Type |
| :------ | :------ |
| `config` | [`MPS3Config`](../interfaces/MPS3Config.md) |

#### Defined in

[mps3.ts:85](https://github.com/endpointservices/mps3/blob/a43fb9a/src/mps3.ts#L85)

## Methods

### delete

▸ **delete**(`ref`, `options?`): `Promise`<`PutObjectCommandOutput`[]\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `ref` | `string` \| `Ref` |
| `options` | `Object` |
| `options.manifests?` | `Ref`[] |

#### Returns

`Promise`<`PutObjectCommandOutput`[]\>

#### Defined in

[mps3.ts:220](https://github.com/endpointservices/mps3/blob/a43fb9a/src/mps3.ts#L220)

___

### get

▸ **get**(`ref`, `options?`): `Promise`<`undefined` \| `JSONValue`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `ref` | `string` \| `Ref` |
| `options` | `Object` |
| `options.manifest?` | `Ref` |

#### Returns

`Promise`<`undefined` \| `JSONValue`\>

#### Defined in

[mps3.ts:124](https://github.com/endpointservices/mps3/blob/a43fb9a/src/mps3.ts#L124)

___

### put

▸ **put**(`ref`, `value`, `options?`): `Promise`<`PutObjectCommandOutput`[]\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `ref` | `string` \| `Ref` |
| `value` | `undefined` \| `JSONValue` |
| `options` | `Object` |
| `options.manifests?` | `Ref`[] |

#### Returns

`Promise`<`PutObjectCommandOutput`[]\>

#### Defined in

[mps3.ts:229](https://github.com/endpointservices/mps3/blob/a43fb9a/src/mps3.ts#L229)

___

### putAll

▸ **putAll**(`values`, `options?`): `Promise`<`PutObjectCommandOutput`[]\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `values` | `Map`<`string` \| `Ref`, `undefined` \| `JSONValue`\> |
| `options` | `Object` |
| `options.manifests?` | `Ref`[] |

#### Returns

`Promise`<`PutObjectCommandOutput`[]\>

#### Defined in

[mps3.ts:239](https://github.com/endpointservices/mps3/blob/a43fb9a/src/mps3.ts#L239)

___

### subscribe

▸ **subscribe**(`key`, `handler`, `options?`): () => `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `key` | `string` |
| `handler` | (`value`: `undefined` \| `JSONValue`) => `void` |
| `options?` | `Object` |
| `options.bucket?` | `string` |
| `options.manifest?` | `Ref` |

#### Returns

`fn`

▸ (): `void`

##### Returns

`void`

#### Defined in

[mps3.ts:378](https://github.com/endpointservices/mps3/blob/a43fb9a/src/mps3.ts#L378)
