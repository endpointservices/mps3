[mps3](../API.md) / types

# Module: types

## Table of contents

### Interfaces

- [Ref](../interfaces/types.Ref.md)
- [ResolvedRef](../interfaces/types.ResolvedRef.md)

### Type Aliases

- [DeleteValue](types.md#deletevalue)
- [JSONValue](types.md#jsonvalue)
- [Operation](types.md#operation)
- [UUID](types.md#uuid)
- [VersionId](types.md#versionid)

### Functions

- [eq](types.md#eq)
- [parseUrl](types.md#parseurl)
- [url](types.md#url)
- [uuid](types.md#uuid-1)

## Type Aliases

### DeleteValue

Ƭ **DeleteValue**: `undefined`

#### Defined in

[types.ts:9](https://github.com/endpointservices/mps3/blob/f1b10b6/src/types.ts#L9)

___

### JSONValue

Ƭ **JSONValue**: `string` \| `number` \| `boolean` \| ``null`` \| { `[x: string]`: [`JSONValue`](types.md#jsonvalue);  } \| [`JSONValue`](types.md#jsonvalue)[]

#### Defined in

[types.ts:1](https://github.com/endpointservices/mps3/blob/f1b10b6/src/types.ts#L1)

___

### Operation

Ƭ **Operation**: `Promise`<`unknown`\>

#### Defined in

[types.ts:22](https://github.com/endpointservices/mps3/blob/f1b10b6/src/types.ts#L22)

___

### UUID

Ƭ **UUID**: `string`

#### Defined in

[types.ts:21](https://github.com/endpointservices/mps3/blob/f1b10b6/src/types.ts#L21)

___

### VersionId

Ƭ **VersionId**: `string`

#### Defined in

[types.ts:23](https://github.com/endpointservices/mps3/blob/f1b10b6/src/types.ts#L23)

## Functions

### eq

▸ **eq**(`a`, `b`): `boolean`

#### Parameters

| Name | Type |
| :------ | :------ |
| `a` | [`Ref`](../interfaces/types.Ref.md) |
| `b` | [`Ref`](../interfaces/types.Ref.md) |

#### Returns

`boolean`

#### Defined in

[types.ts:26](https://github.com/endpointservices/mps3/blob/f1b10b6/src/types.ts#L26)

___

### parseUrl

▸ **parseUrl**(`url`): [`ResolvedRef`](../interfaces/types.ResolvedRef.md)

#### Parameters

| Name | Type |
| :------ | :------ |
| `url` | `string` |

#### Returns

[`ResolvedRef`](../interfaces/types.ResolvedRef.md)

#### Defined in

[types.ts:28](https://github.com/endpointservices/mps3/blob/f1b10b6/src/types.ts#L28)

___

### url

▸ **url**(`ref`): `string`

#### Parameters

| Name | Type |
| :------ | :------ |
| `ref` | [`Ref`](../interfaces/types.Ref.md) |

#### Returns

`string`

#### Defined in

[types.ts:27](https://github.com/endpointservices/mps3/blob/f1b10b6/src/types.ts#L27)

___

### uuid

▸ **uuid**(): `string`

#### Returns

`string`

#### Defined in

[types.ts:25](https://github.com/endpointservices/mps3/blob/f1b10b6/src/types.ts#L25)
