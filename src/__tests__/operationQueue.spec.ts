import { expect, test, describe } from "bun:test";
import { OperationQueue } from "../operationQueue";
import { OMap } from "../OMap";
import { JSONValue } from "types";

describe("operation_queue", () => {
  test("Proposed ops appear in mask", () => {
    const q = new OperationQueue();
    const op = Promise.resolve("a");
    const values = new OMap<URL, JSONValue>((a) => a.toString());
    const key = new URL("https://example.com/foo");
    values.set(key, "b");
    q.propose(op, values);
    expect(q.flatten().get(key)).toBe("b");
  });

  test("Proposed ops can be labelled and confirmed", () => {
    const q = new OperationQueue();
    const op = Promise.resolve("a");
    const values = new OMap<URL, JSONValue>((a) => a.toString());
    const key = new URL("https://example.com/foo");
    values.set(key, "b");
    q.propose(op, values);
    expect(q.flatten().get(key)).toBe("b");
    q.label(op, "a");
    q.confirm("a");
    expect(q.flatten().get(key)).toBe(undefined);
  });

  test("Proposed ops can be labelled and cancelled", () => {
    const q = new OperationQueue();
    const op = Promise.resolve("a");
    const values = new OMap<URL, JSONValue>((a) => a.toString());
    const key = new URL("https://example.com/foo");
    values.set(key, "b");
    q.propose(op, values);
    expect(q.flatten().get(key)).toBe("b");
    q.cancel(op);
    expect(q.flatten().get(key)).toBe(undefined);
  });
});
