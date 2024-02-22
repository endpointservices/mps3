import { expect, test, describe } from "bun:test";

import {
    b64,
    sha256b64,
    b642uint,
    uint2b64,
    toB64,
    or,
    inside,
} from "../hashing";
import { uuid } from "types";

describe("b64/uint", () => {
    test("round trip", () => {
        const start = <b64>"cool";
        expect(uint2b64(b642uint(start))).toBe(start);
    });
});

describe("or and in", () => {
    test("forall a, b: a inside (a or b) ", () => {
        for (let tries = 0; tries < 10; tries++) {
            const a = toB64(uuid());
            const b = toB64(uuid());

            const a_or_b = or(a, b);

            expect(inside(a, a_or_b)).toBeTrue();
        }
    });
});
