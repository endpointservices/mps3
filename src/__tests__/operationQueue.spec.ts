import { expect, test, describe } from "bun:test";
import { OperationQueue } from "../operationQueue";
import { OMap } from "../OMap";
import { JSONValue, uuid } from "types";
import { createStore } from "idb-keyval";
import "fake-indexeddb/auto";

describe("operation_queue", () => {
  test("Proposed ops appear in mask", () => {
    const q = new OperationQueue();
    const op = Promise.resolve("a");
    const values = new Map<URL, JSONValue>();
    const key = new URL("https://example.com/foo");
    values.set(key, "b");
    q.propose(op, values);
    expect(q.flatten().get(key)).toBe("b");
  });

  test("Proposed ops can be labelled and confirmed", () => {
    const q = new OperationQueue();
    const op = Promise.resolve("a");
    const values = new Map<URL, JSONValue>();
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
    const values = new Map<URL, JSONValue>();
    const key = new URL("https://example.com/foo");
    values.set(key, "b");
    q.propose(op, values);
    expect(q.flatten().get(key)).toBe("b");
    q.cancel(op);
    expect(q.flatten().get(key)).toBe(undefined);
  });

  test("Proposed operations can be stored to disk and restored", async () => {
    const store = createStore(uuid(), uuid());
    const q = new OperationQueue(store);
    const op = Promise.resolve("a");
    const values = new Map<URL, JSONValue>();
    const key = new URL("https://example.com/foo");
    values.set(key, "b");
    q.propose(op, values);

    const restored = new OperationQueue();
    await restored.restore(store, (val) => op);

    expect(restored.flatten().get(key)).toBe("b");

    restored.label(op, "a");
    restored.confirm("a");

    expect(restored.flatten().get(key)).toBe(undefined);
  });

  test("Labelled operations can be stored to disk, restored and confirmed", async () => {
    const store = createStore(uuid(), uuid());
    const q = new OperationQueue(store);
    const op = Promise.resolve("a");
    const values = new Map<URL, JSONValue>();
    const key = new URL("https://example.com/foo");
    values.set(key, "b");
    q.propose(op, values);
    q.label(op, "a");

    const restored = new OperationQueue();
    await restored.restore(store, (val) => op);

    expect(restored.flatten().get(key)).toBe("b");
    restored.confirm("a");
    expect(restored.flatten().get(key)).toBe(undefined);
  });
});
