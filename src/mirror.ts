// Mirroring copes writes from one S3 API to another and records progress in a sync log

import { S3ClientLite } from "S3ClientLite";
import { MPS3 } from "mps3";
import { DeleteValue, ManifestKey, ResolvedRef, parseUrl } from "types";
import { timestamp } from "time";
import { LAG_WINDOW_MILLIS } from "./constants";
import { Manifest } from "manifest";
import { FileState, ManifestFile, Syncer } from "syncer";
import { JSONArraylessObject, JSONValue, merge } from "json";

interface MirrorState extends JSONArraylessObject {
    /**
     * How far the mirror progress from the target
     */
    mark: ManifestKey;
    /**
     * Additional writes that have occurred afterwards
     */
    operations: Record<ManifestKey, {}>;
}

export async function mirror(
    target: MPS3,
    sourceManifest: Manifest,
    currentState: MirrorState
): Promise<MirrorState> {
    const toSync: Array<{
        key: ManifestKey;
        manifest: Promise<ManifestFile>;
    }> = [];
    const source = sourceManifest.service;
    const newMark = <ManifestKey>(
        `${sourceManifest.ref.key}@${timestamp(
            Date.now() + source.config.clockOffset - LAG_WINDOW_MILLIS
        )}`
    );

    // Read all mutations from source, after mark
    await source.s3ClientLite
        .listObjectV2({
            Bucket: sourceManifest.ref.bucket,
            Prefix: sourceManifest.ref.key + "@",
            StartAfter: `${sourceManifest.ref.key}@${timestamp(
                Date.now() + source.config.clockOffset + LAG_WINDOW_MILLIS
            )}`,
        })
        .then((response) => {
            for (let i = response.Contents!.length - 1; i >= 0; i--) {
                const obj = response.Contents![i];
                if (
                    Syncer.isValid(obj.Key!, obj.LastModified!) &&
                    !(obj.Key! in currentState.operations) &&
                    obj.Key! > currentState.mark
                ) {
                    const key: ManifestKey = <ManifestKey>obj.Key!;
                    const manifest = source
                        ._getObject<ManifestFile>({
                            operation: "MIRROR_REPLAY",
                            ref: {
                                bucket: sourceManifest.ref.bucket,
                                key,
                            },
                        })
                        .then((response) => response.data!);
                    toSync.push({
                        key,
                        manifest,
                    });
                }
            }
        });

    if (toSync.length == 0) return currentState;

    // Calculate manifest update
    let manifestUpdate: Promise<ManifestFile> = Promise.resolve({
        files: {},
        update: {},
    });
    for (const { key, manifest } of toSync) {
        manifestUpdate = manifestUpdate.then((delta) => {
            return manifest.then((manifest) => {
                return merge(<ManifestFile>delta, manifest.update)!;
            });
        });
    }

    // Now read all contents of key changes
    const values = new Map<string, JSONValue | DeleteValue>();

    const contentReads: Promise<unknown>[] = [];
    await manifestUpdate.then((delta: ManifestFile) => {
        for (const [url, state] of Object.entries(delta.files)) {
            const sourceRef = parseUrl(url);
            if (state === undefined) {
                // delete case
                values.set(sourceRef.key, undefined);
            } else {
                // we need to load the content
                const content = source._getObject<any>({
                    operation: "GET_CONTENT",
                    ref: sourceRef,
                    version: state.version,
                });

                contentReads.push(
                    content.then((read) => {
                        console.log("READ", sourceRef.key, read.data);
                        return values.set(sourceRef.key, read.data);
                    })
                );
            }
        }
    });

    // Compute new merge state if all these operations are applied
    const openOperations: Array<ManifestKey> = toSync
        .map((o) => o.key)
        .concat(Object.keys(currentState.operations) as ManifestKey[])
        .filter((key) => key > newMark);

    const newState: MirrorState = {
        mark: newMark,
        operations: Object.fromEntries(openOperations.map((key) => [key, {}])),
    };

    values.set("synclog", newState);

    await Promise.all(contentReads);

    // Bulk write changes
    await target.putAll(values);

    return newState;
}
