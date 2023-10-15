[mps3](../API.md) / MPS3

# Class: MPS3

## Table of contents

### Constructors

- [constructor](MPS3.md#constructor)

### Properties

- [LOCAL\_ENDPOINT](MPS3.md#local_endpoint)

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

[mps3.ts:122](https://github.com/endpointservices/mps3/blob/ff04322/src/mps3.ts#L122)

## Properties

### LOCAL\_ENDPOINT

▪ `Static` **LOCAL\_ENDPOINT**: `string` = `"indexdb://"`

#### Defined in

[mps3.ts:99](https://github.com/endpointservices/mps3/blob/ff04322/src/mps3.ts#L99)

## Methods

### delete

▸ **delete**(`ref`, `options?`): `Promise`<`unknown`[]\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `ref` | `string` \| `Ref` |
| `options` | `Object` |
| `options.manifests?` | `Ref`[] |

#### Returns

`Promise`<`unknown`[]\>

#### Defined in

[mps3.ts:321](https://github.com/endpointservices/mps3/blob/ff04322/src/mps3.ts#L321)

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

[mps3.ts:192](https://github.com/endpointservices/mps3/blob/ff04322/src/mps3.ts#L192)

___

### put

▸ **put**(`ref`, `value`, `options?`): `Promise`<`unknown`[]\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `ref` | `string` \| `Ref` |
| `value` | `undefined` \| `JSONValue` |
| `options` | `Object` |
| `options.await?` | ``"local"`` \| ``"remote"`` |
| `options.manifests?` | `Ref`[] |

#### Returns

`Promise`<`unknown`[]\>

#### Defined in

[mps3.ts:330](https://github.com/endpointservices/mps3/blob/ff04322/src/mps3.ts#L330)

___

### putAll

▸ **putAll**(`values`, `options?`): `Promise`<`unknown`[]\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `values` | `Map`<`string` \| `Ref`, `undefined` \| `JSONValue`\> |
| `options` | `Object` |
| `options.await?` | ``"local"`` \| ``"remote"`` |
| `options.isLoad?` | `boolean` |
| `options.manifests?` | `Ref`[] |

#### Returns

`Promise`<`unknown`[]\>

#### Defined in

[mps3.ts:341](https://github.com/endpointservices/mps3/blob/ff04322/src/mps3.ts#L341)

___

### subscribe

▸ **subscribe**(`key`, `handler`, `options?`): () => `void`

Listen to a key for changes

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `key` | `string` \| `Ref` |  |
| `handler` | (`value`: `undefined` \| `JSONValue`, `error?`: `Error`) => `void` | callback to be notified of changes |
| `options?` | `Object` | - |
| `options.manifest?` | `Ref` | - |

#### Returns

`fn`

unsubscribe function

▸ (): `void`

Listen to a key for changes

##### Returns

`void`

unsubscribe function

#### Defined in

[mps3.ts:520](https://github.com/endpointservices/mps3/blob/ff04322/src/mps3.ts#L520)
