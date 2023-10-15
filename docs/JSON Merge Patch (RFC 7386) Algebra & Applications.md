
JSON Merge patch is a [standardised](https://datatracker.ietf.org/doc/html/rfc7386) way to encode *sparse* updates to a JSON document. It has some amazing properties that make it useful in collaberative systems like multiple databases.

### Intro

Given a document

```
doc = {
	a: "foo",
	b: "bar",
	nested: {
		c: 5
		d: "str"
	}
}
```

We can surgically delete the nested field `nested.d` with a patch using `null` as the value

```
{
	nested: {
		d: null
	}	
}
```

And we can add fields using values 

```
{
	nested: {
		new: "value"
	}
}
```

We can do multiple add, remove and delete operations all at once, at all levels of the hierarchy with RFC 7386 JSON merge patches:

```
{
	b: "new value", // update b
	nested: {
		d: null, // delete a single nested field
	}
	c: 21, // Add a new top-level field 
}
```


### Patches as to move state forward

If you view a JSON document as the state of a system, then patching can be seen as updating the state. As patches are small, the state can be large, and only the small *delta update* merge patch needs to be transmitted.

```
state_t+1 = merge(state_t, patch_t)
```

## Properties
### Merges are associative

You can apply a merge to a patch, to get a new patch that is the equivalent, meaning you have freedom to batch them

```
merge(merge(a, b), c) == merge(a, merge(b, c))
```

### Non-overlapping patches are commutative. Overlapping writes are last-write-wins

If two patches manipulate different parts of the document, they can be applied in either order and get the same result.

```
merge(merge(s, a), b) == merge(merge(s, b), a) if b intersect a == empty
```

This is useful for collaboration, sparse updates from different players can be merged nicely, and in most cases if the players are doing different things the outcome will not be affected by network delays. There is, however, a problem when players mutate the same resource, for example, if player one deletes a resource
```
{
	resource1: null
}
```
and another updates the same resource
```
{
	resource1: "new value"
}
```

Then if the patches are applied DELETE, UPDATE, the final state of resource1 is `new value`. If the patches are applied UPDATE, DELETE, the final state of resource1 is `null` i.e. DELETED. In this case the the operations to not commute. Thus the conflict resolution for overlapping or conflicting merges is last-write-wins.

### Merges are idempotent

If you apply the same patch twice, the result is the same

```
merge(merge(s, a), a) = merge(s, a)
// and
merge(a, a) = a
```

This is extremely useful for making network communication fault tolerant to network disconnects. It is safe for a player to retransmit if they are unsure that the server received the update, as applying the same update twice is safe.

### Arrays and nulls values don't work

Merge patches have a huge disadvantage that they only really work well with dictionaries. Furthermore, because `null` is used to represent delete, it is impossible to use `null` as a value. You *can* use arrays, but they are not merged efficiently, and thus array mutations tend to conflict with last-write-wins more frequently.

### The identity patch is `{}`

Patching anything with `{}` results in the same value

```
merge(x, {}) = x
```

## Applications
### A list of patches forms an ordered log.

You can think of a merge operation as addition. You can concatenate merges from the identity to array as a fold/reduce over the set of 

```
state = sum_merge_over_patches p
// or
state = fold({}, patches)
```

### Log can be coalesced

Because patches are associative, you can apply them all to form a compact summary.

```
log_patch = sum_merge p
```

This is useful for write **coalescing**. For example, if you allow one part of the system to continue to work while being disconnected, when it regains connectivity you can coalesce the log and transmit just a single big patch.

### Ordered Logs can be replayed multiple times

Because patches are idempotent (in contrast to addition), you can apply the same set of patches multiple times.

```
fold({}, patches) = fold(fold({}, patches), patches)
```

### Ordered Logs with missing entries can be repaired with replay

If you use a logs with a missing entry to generate a final state, that final state can be repaired by replaying the log. You cannot just apply the missing update to the final state because patches do not, in general, commute. But if you know the ordering you can fix the state by playing all updates that came after.

```
fold({}, patches) = fold(fold({}, patches - entry), patches)
```

This is useful for optimistic updates. You can apply all ordered entries as soon as you receive them, but if some are received out of some global order, you can fix the state without much book-keeping.

## JSON difference

If we think of merge as like addition, `s_1 = s_0 + p` there exists a subtraction `s_1 - s_0` for the difference.



