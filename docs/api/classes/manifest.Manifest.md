[mps3](../API.md) / [manifest](../modules/manifest.md) / Manifest

# Class: Manifest

[manifest](../modules/manifest.md).Manifest

## Table of contents

### Constructors

- [constructor](manifest.Manifest.md#constructor)

### Properties

- [authoritative\_key](manifest.Manifest.md#authoritative_key)
- [authoritative\_state](manifest.Manifest.md#authoritative_state)
- [cache](manifest.Manifest.md#cache)
- [optimistic\_state](manifest.Manifest.md#optimistic_state)
- [pendingWrites](manifest.Manifest.md#pendingwrites)
- [pollInProgress](manifest.Manifest.md#pollinprogress)
- [poller](manifest.Manifest.md#poller)
- [ref](manifest.Manifest.md#ref)
- [service](manifest.Manifest.md#service)
- [subscribers](manifest.Manifest.md#subscribers)
- [writtenOperations](manifest.Manifest.md#writtenoperations)

### Accessors

- [subscriberCount](manifest.Manifest.md#subscribercount)

### Methods

- [get](manifest.Manifest.md#get)
- [getLatest](manifest.Manifest.md#getlatest)
- [getOptimisticVersion](manifest.Manifest.md#getoptimisticversion)
- [observeVersionId](manifest.Manifest.md#observeversionid)
- [poll](manifest.Manifest.md#poll)
- [subscribe](manifest.Manifest.md#subscribe)
- [updateContent](manifest.Manifest.md#updatecontent)

## Constructors

### constructor

• **new Manifest**(`service`, `ref`, `options?`)

#### Parameters

| Name | Type |
| :------ | :------ |
| `service` | [`MPS3`](mps3.MPS3.md) |
| `ref` | [`ResolvedRef`](../interfaces/types.ResolvedRef.md) |
| `options?` | `Object` |

#### Defined in

[manifest.ts:93](https://github.com/endpointservices/mps3/blob/f1b10b6/src/manifest.ts#L93)

## Properties

### authoritative\_key

• **authoritative\_key**: `string` = `""`

#### Defined in

[manifest.ts:82](https://github.com/endpointservices/mps3/blob/f1b10b6/src/manifest.ts#L82)

___

### authoritative\_state

• **authoritative\_state**: [`ManifestState`](../interfaces/manifest.ManifestState.md) = `INITIAL_STATE`

#### Defined in

[manifest.ts:83](https://github.com/endpointservices/mps3/blob/f1b10b6/src/manifest.ts#L83)

___

### cache

• `Optional` **cache**: `HttpCacheEntry`<[`ManifestState`](../interfaces/manifest.ManifestState.md)\>

#### Defined in

[manifest.ts:79](https://github.com/endpointservices/mps3/blob/f1b10b6/src/manifest.ts#L79)

___

### optimistic\_state

• **optimistic\_state**: [`ManifestState`](../interfaces/manifest.ManifestState.md) = `INITIAL_STATE`

#### Defined in

[manifest.ts:84](https://github.com/endpointservices/mps3/blob/f1b10b6/src/manifest.ts#L84)

___

### pendingWrites

• **pendingWrites**: `Map`<[`Operation`](../modules/types.md#operation), [`OMap`](OMap.OMap.md)<[`ResolvedRef`](../interfaces/types.ResolvedRef.md), `undefined` \| [`JSONValue`](../modules/types.md#jsonvalue)\>\>

#### Defined in

[manifest.ts:88](https://github.com/endpointservices/mps3/blob/f1b10b6/src/manifest.ts#L88)

___

### pollInProgress

• **pollInProgress**: `boolean` = `false`

#### Defined in

[manifest.ts:80](https://github.com/endpointservices/mps3/blob/f1b10b6/src/manifest.ts#L80)

___

### poller

• `Optional` **poller**: `Timer`

#### Defined in

[manifest.ts:78](https://github.com/endpointservices/mps3/blob/f1b10b6/src/manifest.ts#L78)

___

### ref

• **ref**: [`ResolvedRef`](../interfaces/types.ResolvedRef.md)

#### Defined in

[manifest.ts:76](https://github.com/endpointservices/mps3/blob/f1b10b6/src/manifest.ts#L76)

___

### service

• **service**: [`MPS3`](mps3.MPS3.md)

#### Defined in

[manifest.ts:75](https://github.com/endpointservices/mps3/blob/f1b10b6/src/manifest.ts#L75)

___

### subscribers

• **subscribers**: `Set`<[`Subscriber`](manifest.Subscriber.md)\>

#### Defined in

[manifest.ts:77](https://github.com/endpointservices/mps3/blob/f1b10b6/src/manifest.ts#L77)

___

### writtenOperations

• **writtenOperations**: `Map`<`string`, [`Operation`](../modules/types.md#operation)\>

#### Defined in

[manifest.ts:91](https://github.com/endpointservices/mps3/blob/f1b10b6/src/manifest.ts#L91)

## Accessors

### subscriberCount

• `get` **subscriberCount**(): `number`

#### Returns

`number`

#### Defined in

[manifest.ts:326](https://github.com/endpointservices/mps3/blob/f1b10b6/src/manifest.ts#L326)

## Methods

### get

▸ **get**(): `Promise`<[`ManifestState`](../interfaces/manifest.ManifestState.md)\>

#### Returns

`Promise`<[`ManifestState`](../interfaces/manifest.ManifestState.md)\>

#### Defined in

[manifest.ts:106](https://github.com/endpointservices/mps3/blob/f1b10b6/src/manifest.ts#L106)

___

### getLatest

▸ **getLatest**(): `Promise`<`undefined` \| [`ManifestState`](../interfaces/manifest.ManifestState.md)\>

#### Returns

`Promise`<`undefined` \| [`ManifestState`](../interfaces/manifest.ManifestState.md)\>

#### Defined in

[manifest.ts:110](https://github.com/endpointservices/mps3/blob/f1b10b6/src/manifest.ts#L110)

___

### getOptimisticVersion

▸ **getOptimisticVersion**(`ref`): `Promise`<`undefined` \| `string`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `ref` | [`ResolvedRef`](../interfaces/types.ResolvedRef.md) |

#### Returns

`Promise`<`undefined` \| `string`\>

#### Defined in

[manifest.ts:311](https://github.com/endpointservices/mps3/blob/f1b10b6/src/manifest.ts#L311)

___

### observeVersionId

▸ **observeVersionId**(`versionId`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `versionId` | `string` |

#### Returns

`void`

#### Defined in

[manifest.ts:97](https://github.com/endpointservices/mps3/blob/f1b10b6/src/manifest.ts#L97)

___

### poll

▸ **poll**(): `Promise`<`void`\>

#### Returns

`Promise`<`void`\>

#### Defined in

[manifest.ts:210](https://github.com/endpointservices/mps3/blob/f1b10b6/src/manifest.ts#L210)

___

### subscribe

▸ **subscribe**(`keyRef`, `handler`): () => `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `keyRef` | [`ResolvedRef`](../interfaces/types.ResolvedRef.md) |
| `handler` | (`value`: `undefined` \| [`JSONValue`](../modules/types.md#jsonvalue)) => `void` |

#### Returns

`fn`

▸ (): `void`

##### Returns

`void`

#### Defined in

[manifest.ts:316](https://github.com/endpointservices/mps3/blob/f1b10b6/src/manifest.ts#L316)

___

### updateContent

▸ **updateContent**(`values`, `write`): `Promise`<`PutObjectCommandOutput`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `values` | [`OMap`](OMap.OMap.md)<[`ResolvedRef`](../interfaces/types.ResolvedRef.md), `undefined` \| [`JSONValue`](../modules/types.md#jsonvalue)\> |
| `write` | `Promise`<`Map`<[`ResolvedRef`](../interfaces/types.ResolvedRef.md), `undefined` \| `string`\>\> |

#### Returns

`Promise`<`PutObjectCommandOutput`\>

#### Defined in

[manifest.ts:255](https://github.com/endpointservices/mps3/blob/f1b10b6/src/manifest.ts#L255)
