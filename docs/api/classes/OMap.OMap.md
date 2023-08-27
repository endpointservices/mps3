[mps3](../API.md) / [OMap](../modules/OMap.md) / OMap

# Class: OMap<K, V\>

[OMap](../modules/OMap.md).OMap

## Type parameters

| Name |
| :------ |
| `K` |
| `V` |

## Table of contents

### Constructors

- [constructor](OMap.OMap.md#constructor)

### Properties

- [\_keys](OMap.OMap.md#_keys)
- [\_vals](OMap.OMap.md#_vals)
- [key](OMap.OMap.md#key)

### Accessors

- [size](OMap.OMap.md#size)

### Methods

- [delete](OMap.OMap.md#delete)
- [forEach](OMap.OMap.md#foreach)
- [get](OMap.OMap.md#get)
- [has](OMap.OMap.md#has)
- [keys](OMap.OMap.md#keys)
- [set](OMap.OMap.md#set)
- [values](OMap.OMap.md#values)

## Constructors

### constructor

• **new OMap**<`K`, `V`\>(`key`, `values?`)

#### Type parameters

| Name |
| :------ |
| `K` |
| `V` |

#### Parameters

| Name | Type |
| :------ | :------ |
| `key` | (`key`: `K`) => `string` |
| `values?` | `Iterable`<readonly [`K`, `V`]\> |

#### Defined in

[OMap.ts:6](https://github.com/endpointservices/mps3/blob/f1b10b6/src/OMap.ts#L6)

## Properties

### \_keys

• `Private` **\_keys**: `Map`<`string`, `K`\>

#### Defined in

[OMap.ts:4](https://github.com/endpointservices/mps3/blob/f1b10b6/src/OMap.ts#L4)

___

### \_vals

• `Private` **\_vals**: `Map`<`string`, `V`\>

#### Defined in

[OMap.ts:3](https://github.com/endpointservices/mps3/blob/f1b10b6/src/OMap.ts#L3)

___

### key

• **key**: (`key`: `K`) => `string`

#### Type declaration

▸ (`key`): `string`

##### Parameters

| Name | Type |
| :------ | :------ |
| `key` | `K` |

##### Returns

`string`

#### Defined in

[OMap.ts:2](https://github.com/endpointservices/mps3/blob/f1b10b6/src/OMap.ts#L2)

## Accessors

### size

• `get` **size**(): `number`

#### Returns

`number`

#### Defined in

[OMap.ts:16](https://github.com/endpointservices/mps3/blob/f1b10b6/src/OMap.ts#L16)

## Methods

### delete

▸ **delete**(`key`): `boolean`

#### Parameters

| Name | Type |
| :------ | :------ |
| `key` | `K` |

#### Returns

`boolean`

#### Defined in

[OMap.ts:28](https://github.com/endpointservices/mps3/blob/f1b10b6/src/OMap.ts#L28)

___

### forEach

▸ **forEach**(`callback`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `callback` | (`value`: `V`, `key`: `K`) => `void` |

#### Returns

`void`

#### Defined in

[OMap.ts:42](https://github.com/endpointservices/mps3/blob/f1b10b6/src/OMap.ts#L42)

___

### get

▸ **get**(`key`): `undefined` \| `V`

#### Parameters

| Name | Type |
| :------ | :------ |
| `key` | `K` |

#### Returns

`undefined` \| `V`

#### Defined in

[OMap.ts:25](https://github.com/endpointservices/mps3/blob/f1b10b6/src/OMap.ts#L25)

___

### has

▸ **has**(`key`): `boolean`

#### Parameters

| Name | Type |
| :------ | :------ |
| `key` | `K` |

#### Returns

`boolean`

#### Defined in

[OMap.ts:33](https://github.com/endpointservices/mps3/blob/f1b10b6/src/OMap.ts#L33)

___

### keys

▸ **keys**(): `IterableIterator`<`K`\>

#### Returns

`IterableIterator`<`K`\>

#### Defined in

[OMap.ts:39](https://github.com/endpointservices/mps3/blob/f1b10b6/src/OMap.ts#L39)

___

### set

▸ **set**(`key`, `value`): [`OMap`](OMap.OMap.md)<`K`, `V`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `key` | `K` |
| `value` | `V` |

#### Returns

[`OMap`](OMap.OMap.md)<`K`, `V`\>

#### Defined in

[OMap.ts:19](https://github.com/endpointservices/mps3/blob/f1b10b6/src/OMap.ts#L19)

___

### values

▸ **values**(): `IterableIterator`<`V`\>

#### Returns

`IterableIterator`<`V`\>

#### Defined in

[OMap.ts:36](https://github.com/endpointservices/mps3/blob/f1b10b6/src/OMap.ts#L36)
