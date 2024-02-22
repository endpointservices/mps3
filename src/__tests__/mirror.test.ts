import { expect, test, it, describe } from "bun:test";
import { MPS3 } from "mps3";
import { DOMParser } from "@xmldom/xmldom";
import { ManifestKey, uuid } from "types";
import "fake-indexeddb/auto";

import { mirror } from "mirror";
import { timestamp } from "time";
import { LAG_WINDOW_MILLIS } from "../constants";

describe("mirror", () => {
    const client = () =>
        new MPS3({
            pollFrequency: 1,
            parser: new DOMParser(),
            defaultBucket: uuid().substring(0, 8),
            offlineStorage: false,
            adaptiveClock: false,
            minimizeListObjectsCalls: false,
            s3Config: {
                endpoint: MPS3.LOCAL_ENDPOINT,
            },
        });

    test.only("smoke", async () => {
        const target = client();
        const source = client();

        await source.put("a", true);

        const before = timestamp(Date.now() - LAG_WINDOW_MILLIS);

        const mirrorResult = await mirror(
            target,
            source.getOrCreateManifest(source.config.defaultManifest),
            {
                mark: <ManifestKey>`${source.config.defaultManifest.key}@.`,
                operations: {},
            }
        );
        const after = timestamp(Date.now());

        // Check mark is brought forward
        expect(
            mirrorResult.mark <=
                `${source.config.defaultManifest.key}@${before}`
        ).toBeTrue();
        expect(
            mirrorResult.mark >= `${source.config.defaultManifest.key}@${after}`
        ).toBeTrue();

        // Check that the new object is mirrored
        expect(await target.get("a")).toBeTrue();
    });

    describe("ordering", () => {
        it.each<[(string | undefined)[], string | undefined]>([
            [["a", "b"], "b"],
            [["a", undefined], undefined],
            [[undefined, "a"], "a"],
            [["a", undefined, "b"], "b"],
            [["a", "b", undefined], undefined],
        ])(
            "Write values %p mirror to %p",
            async (
                ops: (string | undefined)[],
                expected: string | undefined
            ) => {
                const target = client();
                const source = client();
                const key = uuid();
                const sourceManifest = source.getOrCreateManifest(
                    source.config.defaultManifest
                );
                const currentState = {
                    mark: <ManifestKey>`${source.config.defaultManifest.key}@.`,
                    operations: {},
                };
                let last_put = undefined;
                for (const op of ops) {
                    last_put = source.put(key, op);
                }
                await last_put;
                const mirrorLog = await mirror(
                    target,
                    sourceManifest,
                    currentState
                );
                expect(await target.get(key)).toBe(expected);
                expect(Object.keys(mirrorLog.operations).length).toBe(
                    ops.length
                );
            }
        );
    });
});
