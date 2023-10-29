This is a focussed explanation of the core sync protocol of MPS3. The sync protocol upgrades an S3 API into a causally consistent, multiplayer datastore without the use of intermediate servers.
## Why build over S3?

1. Minimalism. Why bother maintaining server-side code or a database when the bucket holding the website is a serviceable persistent state store. 

2. Curiosity. Is it even possible to build a database on the S3 API? This project is a demonstration that yes it is.

3. Flexibility. Database are one of the least portable parts of a stack. Decoupling storage from the database enables many more options like self-hosting with ceph or minio or pick hosting on one of a myriad of cloud vendors that support the S3 API.

### S3 features used by MPS3

### `PUT and GET /<bucket>/<key>

The basic S3 API is very simple and intuitive. You use a HTTP `PUT <endpoint>/<bucket>/<key>` to set a file, and `GET <endpoint>/<bucket>/<key>` to retrieve it later. It is the obvious API if you wanted namespaced storage over a RESTFul interface. 

### Response headers: `etag`, `date`, `x-amz-version-id`, `LastModified`

There are additional features using standard HTTP features like `etag` which help with network efficiency. S3 returns the `Date` which is useful for as an authoritative clock source. There are also additional features like versioned objects which help with lifecycle management of resources. And `LastModified` which records the time the write was performed. Every vendor I have tested supports etags on `GET` requests but not object versioning (e.g. Cloudflare R2 doesn't).

### `GET /<bucket>?list-object-v2&prefix=<PREFIX> 

To list the objects you `GET <endpoint>/<bucket>` which returns XML and is ordered and paginated. The result set includes the keys and the etags of the resource. By providing a prefix you target a subset of the buckets contents.


### S3 Strong Consistency Guarantees

S3 states strong consistency between its GET, PUT and list operations.

*After a successful write of a new object, or an overwrite or delete of an existing object, any subsequent read request immediately receives the latest version of the object. S3 also provides strong consistency for list operations, so after a write, you can immediately perform a listing of the objects in a bucket with any changes reflected.* -- [S3 docs](https://aws.amazon.com/s3/consistency/)

## S3 is an Immutable Key-Value store with a single index

S3 is an immutable key value store for (potentially very large) binary blobs. The keys are limited in size (1kb), but you can to range queries by prefix query in one direction only.

It doesn't have some common features like conditional writes, and you cannot update objects in-place. So its tricky getting multiplayer out of this system, but possible thanks to the strong consistency guarantees.

## MPS3

MPS3 is a Key Value store. The values are stored in versioned storage locations on S3. There is a layer of indirection that maps DB logical keys to storage locations hosted in a *manifest*

### Atomic Multi key Operations

To enable consistent atomic updates of multiple keys, *first* the client writes the new values, then it updates the *manifest*, not dissimilar to write-ahead-logging. Other clients use the manifest to access the DB, thus, because individual S3 file updates are atomic, writing a new manifest file is also an atomic operation that can reveal a multiple of key updates at once.

### Multiplayer Safe

Concurrent writes would conflict if all clients wrote to the *same* manifest location. There is no conditional writes in S3 so some updates would just be lost. To support multiplayer each client updates a *different* file ordered by time.

The manifest records several major pieces of imperfect information.
- The time of the write, encoded in the key, as measured at the client. Client clocks are subject to clock skew so it might be a bit off.
- The state of the database, but this also might be lagging because a client doesn't know what writes are also in flight when it writes it. But it's the client's best guess.
- The operation that was applied, encoded a JSON merge patch to the DB state.

```
// manifest.json@01698260777020_53a_0001
{
	state: { // Best *guess* of current state
		keys: {
			"myBucket/myKey": {
				version: "2eefe4fb-c540-4482-abb7-f3dfedfc424d"
			}
		}
	},
	operation: { // JSON-merge-PATCH
		keys: {
			"myBucket/oldKey": null, // DELETE
			"myBucket/myKey": {
				version: "2eefe4fb-c540-4482-abb7-f3dfedfc424d"
			}
		}
	}
}
```

Much of the engineering of the MPS3 sync protocol is about transforming that imperfect information known at client endpoint into a causally consistent, atomic, multiplayer safe representation client-side.

### Reconciling concurrent writes

Note the client sends the operation as a [JSON_merge_patch](JSON_merge_patch.md). The database state at time *t* is the merge concatenation of all the operations up to *t* (see [a list of patches forms an ordered log](JSON_merge_patch.md#a-list-of-patches-forms-an-ordered-log))

$$state_t = \sum_{i=0}^{t} merge(patch_i)$$
Now it is inefficient for a client to replay the entire DB history every time it connects. But we can use the [idempotency property of JSON-merge-patch](JSON_merge_patch.md#a-list-of-patches-forms-an-ordered-log#Ordered Logs can be replayed multiple times) to avoid it.

A client only needs to read an imperfect guess of the latest state, then replay all patches within the lag window to integrate an improved estimate of the final state (see [Ordered Logs with missing entries can be repaired with replay](JSON_merge_patch.md#Ordered Logs with missing entries can be repaired with replay))

$$\begin{eqnarray} 
state_t &=& state_{t-lag} + \sum_{i=lag}^{t} merge(patch_i) \\
&=& est_t + \sum_{i=lag}^{t} merge(patch_i)
\end{eqnarray}$$

So this is the key insight encoded within MPS3 manifest representation. The state field provides a good guess, but clients need to look back "a bit" and apply a sequence of operations to correct for missing writes.

### Causal Consistency

If clients clocks are skewed, their manifest keys will not order between them correctly. This does not matter though! As clients are always repairing the logs and preserving order, delayed entries will be integrated at the appropriate place, just delayed. As long as client writes are written in order (i.e. their clock is monotonic) clock skew does not break causal consistency. Ultimately clock skew is no different to network latency.

### Mitigating Large clock skew

Clock skew becomes a consistency threatening problem if exceeding the *lag* parameter. Then clients *might* miss an update. Client clocks are not reliable. However, S3 records a `LastModified` header for each object which is an immutable server provided time source.

Large clock skew can be detected by every client by comparing the manifest key  timestamp against the server provided `LastModified` time. If the skew is above a *stale* write threshold it can be ignore from the log. As long as the *stale* write threshold is sufficiently below the *lag* parameter, all clients will converge to the same state regardless of clock skew.

### Automatic Clock Adjustment

In addition, clients use the `Date` header to continuously correct their clocks, so clients with heavily skewed clocks are able to be corrected reactively and continuously and thus capable of contributing. To a degree, they can do this even without a clock, which boils down to polling S3 for a Date header, then using that to make a write and hoping it was fast enough to be accepted *ad infinitum*.

### Subtleties of the manifest key

The manifest key is primarily time ordered, but some extra information is needed to fix edge cases such as: writing on the exact same millisecond or using a sub millisecond S3 API (such as local-first). So the manifest key format is actually

```
<TIMESTAMP>_<SESSION>_<COUNTER>
```

### Minimising list-object-v2 calls

List API calls are costly on S3. To avoid polling the list API, a further optimisation is enabled by default. After writing a manifest with key *k*, clients upload the key to a `last_change` file. Clients with active subscriptions poll this file and only if the content changes (efficiently detected with `If-None-Match` header), does the algorithm proceed to syncing the latest state via the list-object-v2 API call.

For APIs where listing is cheap (e.g. local-first/IndexDB), this optimisation is disabled. 

## The Sync Algorithm

Loop:
1. Poll the `last_change` file using `If-None-Match` headers, if it hasn't changed go no further
2. List objects starting from the `last_change` timestamp - *lag*
3. Filter out entries whose `abs(timestamp - LastModified) > stale` 
4. merge all `operations` in order on top of the most recent `state`
5. notify subscribers of changes

Operations seen on S3 are exposed to clients as soon as they are read, there is no waiting. The existence of clock skew neither compromises causal consistency nor end-to-end latency.
### Summary

The algorithm is deceptively simply in implementation but leans heavily on the algebraic property of JSON-merge-patch and wiggle room in causal consistency to accommodate client-side clock_skew. The same algorithm is used also to synchronise state transfer between tabs in the local-first setting. By designing for a relatively small set of underlying primitives, it is to apply this sync protocol to more expressive storage system.