import { expect, test, describe, beforeAll } from "bun:test";
import { OperationQueue } from "../OperationQueue";
import { OMap } from "../OMap";
import { JSONValue, ResolvedRef, url } from "types";

describe("operation_queue", () => {
  test("Proposed ops appear in mask", () => {
    const q = new OperationQueue();
    const op = Promise.resolve("a");
    const values = new OMap<ResolvedRef, JSONValue>((a) => url(a));
    values.set({ bucket: "foo", key: "a" }, "b");
    q.propose(op, values);
    console.log(JSON.stringify(q.flatten()));
    expect(q.flatten().get(url({ bucket: "foo", key: "a" }))).toBe("b");
  });
});
