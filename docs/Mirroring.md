
An single homed MPS3 setup ensures that multiple clients can read and write to the same S3 compatible storage API without dataloss. However, it is possible for each device to sync the same storage to multiple S3 compatible APIs.

This can be useful for several situation
- a secondary sync to local storage. Local storage is faster and network independent
- sync to regional storage, for faster multiplayer within geographic areas
- reliability, particular across different vendors with different failure modes


###  bi-di mirroring

Conceptually multi-homing is implemented an a write mirroring protocol.

### Naive approach

Copy the oplog bit-for-bit. This would not work because the operations have to be written within the right time window for other clients to notice them

### Logical approach

Watch for changes, and copy them to the other. This has recursive problems when multiple clients are mirroring.


### Monotonic SyncLog

We can consider the sync to be "caught up" at some point in time on each upstream. Only writes after those points need to be considered. We can maintain a sync protocol all participants would choose if they had the same information availible, regardless of number of syncing client.

A sync client need to play the sync log forward from s, to e, by considering mutations that occurred between those timestamp. It is then able to assert that storage system has been caught up to e.

It can do this in a single transaction, in a single direction

##### local write buffer setup

dynamoDB primary storage
one-way sync to remote

Writes go to dynamoDB first. Changes are synced to a remote.

##### local first cache

dynamoDB primary storage

two-way sync to remote s3 API

This ends up mirroring the primary DB locally. Not always what you want to do so the remote -> local should be filterable.


### One-way mirror

sync log at position a,
read all operations from a to infinity. 
divide into options still in commit window vs. those before the commit window b.
In a single  bulk write operation,
- update synclog position to b
- record in sync log which subset of operations after b were replaced
- mirror all operations on target storage (with new operation ids like they were done from scratch)

We can thus sync optimistically 

sync log

```
// synclog/<target>/<source>.json
{
	mark: <operation_id>
	operations: {
		<operation_id>: {}
	}
}
```


Ccyle breaking

If two one-way syncs are deployed in a cycle, they can self trigger.

