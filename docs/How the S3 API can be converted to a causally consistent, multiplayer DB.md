After working at Firebase in San Francisco, I returned to Europe to discover few companies want to hand over control of their data to a third party. This is a market truth that confronts all of the challenger BaaS companies too. Nobody wants to risk betting on their data being held hostage by an unproven tech.  It's *really* hard migrating databases... so best play it safe. Furthermore, in regulated markets, enterprises *must* control the data (Finance, Healthcare), 3rd party or off-shore is not an option.

So I thought "Is it possible to build a database as ergonomic as Firebase but that is unbundled from the storage?". The first challenge was thinking of a storage interface.
### S3 API is the ITs *de facto* storage API

The S3 API is *everywhere*. It started at Amazon but every storage vendor supports: on-prem, off-prem, industry verticals, tech companies, open source, closed source, startups and titans.

If you want to build a database with a decoupled storage interface, S3 is the API to use.
## S3 API is *simple*

The basic S3 API is very simple and intuitive. You use a HTTP `PUT <endpoint>/<bucket>/<key>` to set a file, and `GET <endpoint>/<bucket>/<key>` to retrieve it later. It is the obvious API if you wanted namespaced storage over a RESTFul interface.  To list the objects you `GET <endpoint>/<bucket>` which is paginated.

There are additional features using standard HTTP features like `etag` which help with network efficiency. \There are also additional features like versioned objects which help with lifecycle management of resources. Every vendor I have tested supports etags on `GET` requests but not object versioning (e.g. Cloudflare R2 doesn't).

## S3 is a Key-Value store with a single index

S3 is really a key value store for binary blobs. The blobs are immutable, if you want to change one you just write a new one over it. 

It also support prefix queries. You can list objects that start with a certain prefix. This is very valuable for building a database as this means we can implement a form of range queries on our dataset. By storing keys in a structured manner, and using prefixes wisely, we can use lexicographic ordering to retrieve a series of related objects at a complexity that scales linearly with result set size (not total database size). That said, prefix queries are limited compared to most DBs indexes, they can only return results in ascending order and they never return non-current versions of objects

## The S3 features used to build a DB

- GET/PUT/DELETE objects
- List objects by prefix

We also optionally use
- etag for performance
- object versioning for keeping keys 'nice' otherwise we use key suffixes.

## The desired feature for the DB

### OPerational simplicity

The thing that made Firebase successful was operational simplicity.It's just so easy to get started with Firebase. You click on the console, there's nothing to manage, your backups are done for you, and you can get started within 30 minutes. So, that magic, I would like for NPS 3. This is very important, so by using S3 as the storage backend, there's nothing to manage. This contrasts with setting up Postgres, for instance, where this is something that needs to be actively managed, monitored, etc. So, for true operational simplicity, the limit of this is literally no servers, no server-side code, no service, and that's why I love S3, is this is also a completely operationally trivial thing to run, a bucket. I mean, there's servers to serve the bucket, but there is nothing a customer needs to do, and this is true of all the different vendors that supply S3-compatible APIs as well. It's truly serverless, these technologies.

## Clientside only

As an extension to operational simplicity, you want the only interaction point with the database to be where you need data, and where you need data is in the application hosted in the browser. So this will be a client-side library like Firebase, and that will be the only interaction point a developer needs to do. It will talk directly with S3 or maybe via an authenticating proxy, but in simple setups directly to the S3 API. And this is just another layer of complexity you don't need to consider.

## Multiplayer safe

The other important thing for a database is it's got to be multiplayer safe. So by default, if you allow lots of different clients to write into an S3 bucket, they'll overwrite each other's writes and get into a mess. So the vanilla S3 API on its own is not multiplayer safe. So one of the big value adds that MP S3 is adding around the S3 API is the ability to support concurrent modifications in a safe way.

## Subscriptions/Realtime/Live Queries

One of the innovations of Firebase was to make databases push-based. So clients, instead of polling the database, saying, get me the value of key, whatever, the database could push changes directly to clients. Clients set up a register, a subscriber, and the database will notify the client when changes occur. In a browser situation, this is what you need to be reactive of data changes.

### Intuitive Programming Model a.k.a. Causal Consistency

It needs to be easy to use, I think Firebase got the developer experience, they did really tremendously well on the developer experience and by that the client is simple and it works the way you would naturally expect it to. Actually achieving this is not so easy in a distributed system, what you've got to deal with is that some participants may become disconnected from the internet, especially on mobile, so I think people are aware that there are different database consistency levels, so strong consistency means that everyone observes operations in the order that they occurred. This doesn't work in a distributed setting because when someone is disconnected from the internet, they won't be able to do a write, because the time that they do the write, they won't be in contact with the storage system for it to commit it, so therefore network partitions sees people, and in the world of mobile phones, this just doesn't work, and also the further you are from the storage system, the longer the delays are, so everyone has to work at the slowest participant, so the strong consistency level, that's not possible. There's another consistency level that I think is commonly understood, eventual consistency, and that means you're allowed to issue a write, but it's not clear when people, other participants will be aware of that write, and eventually consistent systems are notoriously difficult to work with, because, for instance, there's no reason that if you write something and then immediately read it, whether you'll get the value back that you just wrote, so DynamoDB can do this sometimes, if you write and read at its lower consistency levels. So that's not intuitive, but there's a middle ground between eventually consistent systems and strongly consistent systems called causally consistent systems, and this is the space that Firebase occupies, and what that implies is that the causal ordering of operations are preserved. Ordering the causal operator is happens before, and so if a participant does one thing, and then does another thing afterwards, and they've observed those two things, those two causal events, then everyone else in the system will see the same causal ordering of whoever observed it, so all participants share a common causal ordering of events, and this gives a little bit of wiggle room in network partitions, so when someone's disconnected from the storage system, they're unable to observe anyone else's reads and writes, so now they're causally separated. They can do their own write, and then they can do their own read, and they should read their own write. They can see a causal ordering of that. T
hey saw everything that happened into the database before they got disconnected, so they know that their write occurred causally after observing that, but the state of the system, everyone who's still connected, they're reading and writing and observing each other's writes, and they have their own little causal world. When that person eventually gets back online, they are able to flush their buffered writes into the system, so now the authority sees that person's write, and now all the other participants can observe that, and they will observe it not in wall clock ordering, but causal ordering, so then they'll be able to see their writes, but those writes could never depend on the things that will happen while that person was offline, so in a simplified setup where there's a single authority, causal ordering means you have to preserve the order of operations as they leave the client device, they have to hit the authority in the correct order, and when other people are observing the central authority, they have to be observing the writes in the order they occurred.

### Transactions

One of the superpowers of a database is it's few areas in an application where it can enforce atomicity of multiple things, and it does this through transactions. So if you've ever tried to do anything serious with S3, you'll know that it's impossible to do a batch put. You might, you know, for instance, you might want to add a record, and you also want to update an index of all the things that happen. There's no way of doing that in S3 natively. There's no batch put command. So there's enormous value, like it's basically table stakes in a database to be able to update multiple records, either all of them or none of them, but never partially half of them. This is useful for like in a shopping, in an e-commerce situation, you know, recording the customer, click buy, you know, filling out the order, removing the amount available to other customers, and, you know, issuing, you know, issuing an order to the warehouse, issuing an order to deduct money from the amount of available credit, that kind of thing. It's very common that you want lots of things to happen or none of them to happen, and databases, this is their superpower as they offer the ability to do multiple things all or nothing through the transaction mechanism. So a big desire for MPS3 is to offer transactions over vanilla S, over S3 APIs, and this is something achievable.

### Queries

Another important function databases provide is the ability to query over your data to retrieve a result set.

## How to get S3 to do what we want without an intermediate server

So, I think, you know, if you wanted to build a database with the features that we want, the natural way to achieve that would be to get some back-end programmers to knock up an API that proxied, that provided a different API and just used S3 as the storage for persistence. But I didn't want to do that because that is not operationally simple. Then you're asking customers to spin up a service and then, you know, then they have to monitor, patch it, keep it up to date. To me, that loses the magic, right? For operational simplicity, absolutely no servers involved, no services. It's all got to be driven from the client. So now, there's quite a tricky problem that, you know, S3 has a delightfully simple API and what we want to offer is quite a sophisticated interface over that. And I really enjoy these challenges of, you know, the S3 API is so constraining. It wasn't defined by us. It's been defined by industry adoption. So it is what it is. And now we've got to figure out how to get it to behave the way we want. And we have the all the code we need to write will go in the client. So, you know, the clients are going to have to be fairly sophisticated in order to expose the API that we wish. A little fun fact is that the clients at Firebase were nearly as much code as the server. So having been on this journey before, I know that, yeah, if you want a good client side database, you need a complex client anyway. So that's fine.

## Achieving Atomicity

The simplest place to start is how to achieve automaticity of bulk writes to S3. So, we can be inspired by write-ahead logging in traditional databases. 

In a traditional database, when a client wants to modify multiple things, it first says to the database, begin, and then it serially transmits each change it wants to make, and of course these have to travel over the wire in a sequence, so the database can't just write them straight into visible storage yet. It buffers them in the write-ahead log, and then when the client can list an indefinite amount of changes it wants to make, but when it's finished, it says commit, and then the database knows at that point when it can validate maybe that the write meets the constraints, and then it may acquire very transiently a lock to protect against any concurrent mutations at the same time, either writes all those things, somehow makes the changes visible, and then releases the lock. That's the basic principle of the write-ahead logging. In S3, we have no concept of locks, and it's blob storage, so we don't even have the concept of append-only log, so this concept has to be modified quite a lot to get it to fit in S3. What we do is, you know, a client wants to make changes to multiple logical keys, and we won't make those changes visible until something atomic occurs. The only thing atomic in S3 is an actual put of a file, so there is no such thing as locks, but there is a lock-like effect occurs when you write a file, so in order to represent a batch change, the thing that commits has to be represented as a single put through the S3 API, and what's the thing that... The only thing we can put is a recording of the visible changes, so we introduced the concept of a manifest file, and the manifest file is a mapping between logical keys, the keys that clients actually listen to, or write, or read, these logical keys, and they're mapped to physical storage locations, which, if you're using an S3 vendor that has object versioning, where possible, the logical key is the same as the storage key, and then what we're doing for the write-ahead bit is the client first writes the object as a unique version, and then the bit when the client commits, you know, tries to do a batch to represent the batch should be visible, we first serially write all the new object versions, and then to actually make it visible to everyone, we put the updated logical to storage key mapping in the manifest. Not all vendors have versioning like R2. In this case, instead of using the S3 concept of versioning, we take the logical key and append a random suffix to it. The disadvantage is it makes your bucket messy, and it's harder to make correspondence between what is logically visible and how it's stored. But, you know, it's worth making that sacrifice when necessary to support vendors like CloudFare. So, a central concept to enable various database-like semantics is this manifest file.

The manifest file is a layer of indirection which describes a snapshot of the database's state. So, when a client wants to get a value, they have to read the manifest file, lookup the logical key, and then fetch the concrete value from another location somewhere, which that other file is somewhat intuitively related to the logical key. So for operational simplicity, I want, you know, the system should be kind of intuitive on how it works, but we need this layer of indirection of a manifest file in order to provide automaticity and a few other things, like we're not ready to talk about exactly what the manifest file looks like, but this is the introduction that we need it for automaticity anyway.

### Achieving Concurrent Access

So, to achieve safety under concurrent access, we have to take the WART that we have, the additional manifest file, and we want to make that go even further to solve our conflict problems as well. So, if you had just a single manifest file, what could happen is two different clients, and remember clients are the ones that have to actually write the manifest file, two clients could read what was in the database, make some kind of computation on it, and then try and write back the result at exactly the same time, and then one would get lost. So, we've got to somehow make maintenance of this manifest file safe under concurrent mutation. 

In normal HTTP systems, you can make things concurrent-safe by using the if-match etag header on a conditional put. This is what it was designed for, and what that says is only update a resource if no one has changed it, and you can prove what the state of the system was by looking at the etag. This is how you do it in most APIs, but in S3, the put object method doesn't support a conditional put, so that's not possible.

Instead, to be concurrent safe, we need every update to the manifest to actually be a write to a different file. That way, concurrent writers will never overwrite each other's updates. So that implies the manifest file is actually a set of files, and to figure out what the actual logical representation of the manifest file is, clients will have to read several of them and derive what the truth is on read, which is a little different to how things are normally done.

## Manifest write key

```
timestamp-session-count
```


We don't want clients to have to read all files for all history, otherwise that gets expensive. So we want clients only to really be concentrated in the areas where there may be conflict, which is essentially recently, things that happened close to what the time is now. And this implies that these manifest files will be ordered by time, and then to resolve what the logical manifest file is, clients will have to read several in the recent history. So the primary sorting key for ordering these collections of manifests is a timestamp. We have a precision of a millisecond, which is not enough when you have a script writing lots of files. So the next sorting key is the session, and then the next sorting key is some kind of incrementing counter.

Because S3 only supports lexicographic sorting, then these counters and timestamps have to be padded, so this is a fixed key length. And then, to grab recent manifest records, the client has to do a list objects prefix query starting at a timestamp a little bit in the past.


### Manifest File Content

The core information the manifest encodes is the state of the database, that is, the mapping between logical keys and where the values are found in storage. However, a client when it writes it, it doesn't know all the information in the system because there may be other writes in flight. So one portion of the manifest file content is called the base, and that's the logical information that the client thinks is true, but that doesn't account for writes that might have occurred temporally close by.

To be able to integrate distinct operations that may also be in flight we need some way to encode also what an individual operation was and then we'll be able to take the list of all in-flight operations and merge them. So the operation we'll use is JSON merge patch because it has several nice properties enumerated elsewhere. So then when a client makes a mutation to the logical key space we will also encode, we would also transmit that operation as a JSON merge patch.

So this is what's represented in the manifest file, what the client thought was true when it made the operation, plus the operation itself. Furthermore, because truth in our system is related to the passage of time, not only do we state what we thought was true, but when we were sure that was true. And because our passage of time is denoted by manifest keys, there's a reference to the manifest key of which the base state was derived from.

### Deriving the Manifest State on Read

We can gloss over how a client exactly knows whether the base state was true or not, but if we assume for a minute that it did know that it was caught up to date at a specific point in time, we can inductively figure out what the true state is up to another point in time inductively.

Consider a client joining for the first time. It reads the latest manifest state, which contains a base set state that has ignored concurrent writes. It also contains an operation that occurred when that manifest was written. The important information is that it contains the confirmed base state at some point back in time. In order to catch up to reality, what the client needs to do is go back in the log of manifests to that base state and read all manifests from that point forward. And each contains an operation which it can merge on top of the base state to arrive at a new base, a new state that includes all writes that were written concurrently to when that base state was generated. Now, that gives it the most up-to-date version of the database. 

However, when it needs to do an operation and it would need to save a manifest state. It needs to decide what its base state is. Now, it can't be the very bleeding edge of the history, because what happens with clients with clock skew is that even though it's read up to a certain timestamp, other people might make writes with an incorrect timestamp and therefore the order in which you observe the documents written to the S3 bucket is not exactly in temporal order. So, what its base state is, it has to go back a bit to what it knows is confirmed to be true has to be back a little bit from now. But interestingly, it doesn't need to rewind the state. It can just save its current estimate of what the true state is. And this comes from some of the interesting properties of JSON merge Patch.

So, when a client makes an operation, it needs to write a base state which is just its best guess as to what the current state is, may not be totally correct, may not include lots of writes that are in flight, and it also needs to include a state that it knows is true for sure, and that state has to be back in time a bit before, early enough in time that even clients with clock skew wouldn't be writing before it in the Lexner Graphic Ordering Manifest Key Ordering. So, this is just some kind of slop, and it doesn't need to be precise. The larger number it is, the further back in time you go, you know, you'll be able to accommodate bigger clock skews. So, and you have to accommodate for skewed client clocks and also maybe how long it takes for the S3 service to do writes, so it's related to the file service latency. So, for now, we just go back 10 seconds. The nice thing about this sync algorithm is it is not actually that sensitive to, it doesn't actually require accurate clocks, and putting in a conservative value for time skew slop doesn't affect the reactive, the latency, the end-to-end latency of the system much.

JSON-merge-Patch is idempotent

The reason why we don't need to worry about having a precise determination of confirmed state comes from properties of JSONMergePatch. JSONMergePatch is idempotent, which means if you play a sequence of patches and reach a final state, you can play that same sequence of patches over the top and lead to the same state. This is the definition of idempotency but generalized to when you do more than one patch.

And one of the really cool tricks with JSONMergePatch is if you're missing a record, obviously your final state will be missing the effect of that operation. But if you take that damaged final state and then replay the log again, but with the final state, the final outcome will be the corrected final state. So it is also tolerant to missing entries, so long as you eventually are made aware of those entries. And this is why we can apply things optimistically. 

Of course, if an entry is missing, the client won't be able to observe the effect. So its subscribers and everything will fire on just what it can see. And then if a record's been affected by clock skew and ends up being inserted out of order, then it may have an effect or it may have been masked by a future operation. But either way, the causal effects of that missing entry will be delayed as a result. But this delay does not compromise the other important consistency guarantee that we want to give with is causal consistency.

Causal Consistency under slight clock skew.

For a centralised system, like writing to an S3 bucket, to maintain causal consistency, all writes from a given participant must be kept in the same order. But the wiggle room for causal consistency is that a given participant can be delayed indefinitely, for example a network partition. But that also carries over to clock skew as well. As long as a given device's clock skew is consistent, their writes will appear merged into the log at the wrong position, but that transformation does not permute the order. So this system is tolerant to clock skew without compromising causal consistency, which is the actual consistency model we want.

Dealing with excessive clock skep

If a client has a clock that is wildly incorrect, then their rights will be placed into the log far away from our tolerance zone. How this will manifest is that when a client tries to read the history with a little bit of buffer, their right will appear outside of that window, and so their rights won't affect the database state. But if you actually looked at all the records in the log, you would see some entries that nobody seemed to have integrated at the time. Now, this is a bad outcome for the system. Ideally what we would like to do is reject those rights, indicate to the client user that the right was rejected because the clock was wrong. If we know the clock is wrong, we could correct for it by using a time service. But there's always a risk that some rights are maybe on the edge of acceptability. To be truly fault-resistant, we need to be able to detect these cases, inform the user, and ignore the right, so that if there's any doubt one way or another, we don't have the situation where some clients use the write and other clients don't. 

Conditional Writes

To help us deal with wild clock skew and as a step towards transaction support, we'd like to be able to exclude log records deterministically based on metadata that is available in the S3 API. When a client tries to resolve the database state it can make a decision on whether to include that record or not. One of the interesting pieces of metadata available in S3 is the record creation time and we can observe if the difference between the creation time and the manifest key timestamp differs too much. S3 is an immutable blob store so metadata that is written will never be mutated. Observing these files will see exactly the same result. So if every client applies the same logic for including or excluding a file based on a pure computation on the metadata on the files created at timestamp, with a misbehaving clock.

We can use the same clause evaluation at read to implement semantics like compare and set operations. And we can take compare and set operations to locks and transactions. You have to be slightly careful though when making a condition on assertion of the database state. Here we do have problems if the log has not settled. For instance, if we say, write a key value foo, if the current value is bar, and C, and then a client might see the sequence of manifest log records suggest that the clause evaluates true and expose the consequence to the client, but a client with clock skew might end up inserting a record after that breaks that condition, in which case now the database state would flip to not applying that change, and the effect would be reversed.

Postgres calls this a dirty read where state during a transaction is visible to participants before the transaction has been finalized. In this case, the transaction should be aborted, but transiently, clients observed the intermediate state. So that's something we probably want to avoid, but to truly avoid that, you would have to delay effecting the transaction until the clock skew tolerance period had passed. So this has not been implemented yet. We might rethink that bit. But conditional writes work very well for clock skew rejection because the condition and data necessary is all hermetically deterministic from just a single record itself. So that does not have the same problem.













server reconciliation