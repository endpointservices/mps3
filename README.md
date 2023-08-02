# mps3
Multiplayer over s3-compatible storage


## Algorithms


### The Manifest

Contains 
- all files and their version
- the previous JSON-merge-patch (used to resolve concurrent writes)
- ref to the previous manifest the update was based on

### Avoiding mid-air collision

The normal way is is etag and in-none-match headers, but s3 does not support this.

There is no conditional if-none-match PUT request on S3. Thus all writes will make it to the bucket, even those made concurrently. Thus the `previous` pointer does not necissaril include all writes made in parrallel. Resolution has do be done at read time. We query for all object bersions made from a manifest file to the previous pointer, using the `update` parameter to rebase over the current state.
