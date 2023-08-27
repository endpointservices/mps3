[mps3](../API.md) / [manifest](../modules/manifest.md) / Subscriber

# Class: Subscriber

[manifest](../modules/manifest.md).Subscriber

## Table of contents

### Constructors

- [constructor](manifest.Subscriber.md#constructor)

### Properties

- [handler](manifest.Subscriber.md#handler)
- [lastVersion](manifest.Subscriber.md#lastversion)
- [queue](manifest.Subscriber.md#queue)
- [ref](manifest.Subscriber.md#ref)

### Methods

- [notify](manifest.Subscriber.md#notify)

## Constructors

### constructor

• **new Subscriber**(`ref`, `handler`)

#### Parameters

| Name | Type |
| :------ | :------ |
| `ref` | [`ResolvedRef`](../interfaces/types.ResolvedRef.md) |
| `handler` | (`value`: `undefined` \| [`JSONValue`](../modules/types.md#jsonvalue)) => `void` |

#### Defined in

[manifest.ts:48](https://github.com/endpointservices/mps3/blob/f1b10b6/src/manifest.ts#L48)

## Properties

### handler

• **handler**: (`value`: `any`) => `void`

#### Type declaration

▸ (`value`): `void`

##### Parameters

| Name | Type |
| :------ | :------ |
| `value` | `any` |

##### Returns

`void`

#### Defined in

[manifest.ts:45](https://github.com/endpointservices/mps3/blob/f1b10b6/src/manifest.ts#L45)

___

### lastVersion

• `Optional` **lastVersion**: `string`

#### Defined in

[manifest.ts:46](https://github.com/endpointservices/mps3/blob/f1b10b6/src/manifest.ts#L46)

___

### queue

• **queue**: `Promise`<`void`\>

#### Defined in

[manifest.ts:47](https://github.com/endpointservices/mps3/blob/f1b10b6/src/manifest.ts#L47)

___

### ref

• **ref**: [`ResolvedRef`](../interfaces/types.ResolvedRef.md)

#### Defined in

[manifest.ts:44](https://github.com/endpointservices/mps3/blob/f1b10b6/src/manifest.ts#L44)

## Methods

### notify

▸ **notify**(`label`, `version`, `content`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `label` | `string` |
| `version` | `undefined` \| `string` |
| `content` | `Promise`<`undefined` \| [`JSONValue`](../modules/types.md#jsonvalue)\> |

#### Returns

`void`

#### Defined in

[manifest.ts:56](https://github.com/endpointservices/mps3/blob/f1b10b6/src/manifest.ts#L56)
