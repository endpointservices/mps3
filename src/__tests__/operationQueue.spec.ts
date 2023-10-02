import { expect, test, describe } from "bun:test";
import { OperationQueue } from "../operationQueue";
import { JSONValue, ResolvedRef, uuid } from "types";
import { createStore } from "idb-keyval";
import "fake-indexeddb/auto";

describe("operation_queue", () => {
  test("Proposed ops appear in mask", () => {
    const q = new OperationQueue();
    const op = Promise.resolve("a");
    const values = new Map<ResolvedRef, JSONValue>();
    const key = {
      key: "foo",
      bucket: "bar",
    };
    values.set(key, "b");
    q.propose(op, values);
    expect(q.flatten().get(key)).toBe("b");
  });

  test("Proposed ops can be labelled and confirmed", () => {
    const q = new OperationQueue();
    const op = Promise.resolve("a");
    const values = new Map<ResolvedRef, JSONValue>();
    const key = {
      key: "foo",
      bucket: "bar",
    };
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
    const values = new Map<ResolvedRef, JSONValue>();
    const key = {
      key: "foo",
      bucket: "bar",
    };
    values.set(key, "b");
    q.propose(op, values);
    expect(q.flatten().get(key)).toBe("b");
    q.cancel(op);
    expect(q.flatten().get(key)).toBe(undefined);
  });

  test("Order of operations is preserved after confirmations", async () => {
    const q = new OperationQueue();

    const key = {
      key: "foo",
      bucket: "bar",
    };
    const totalOps = 100;

    // Propose and label 100 operations
    for (let i = 0; i < totalOps; i++) {
      const op = Promise.resolve({});
      const values = new Map([[key, i]]);
      q.propose(op, values);
      q.label(op, i.toString());
    }

    expect(q.flatten().get(key)).toBe(totalOps - 1);
    // Confirm operations and check the decrement in flatten output
    for (let i = totalOps - 1; i > 0; i--) {
      q.confirm(i.toString());
      expect(q.flatten().get(key)).toBe(i - 1);
    }
  });

  test("Proposed operations can be stored to disk and restored", async () => {
    const store = createStore(uuid(), uuid());
    const q = new OperationQueue(store);
    const op = Promise.resolve("a");
    const values = new Map<ResolvedRef, JSONValue>();
    const key = {
      key: "foo",
      bucket: "bar",
    };
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
    const values = new Map<ResolvedRef, JSONValue>();
    const key = {
      key: "foo",
      bucket: "bar",
    };
    values.set(key, "b");
    q.propose(op, values);
    q.label(op, "a");

    const restored = new OperationQueue();
    await restored.restore(store, (val) => op);

    expect(restored.flatten().get(key)).toBe("b");
    restored.confirm("a");
    expect(restored.flatten().get(key)).toBe(undefined);
  });

  test("Order of operations is preserved after restore", async () => {
    const store = createStore(uuid(), uuid());
    const q = new OperationQueue(store);

    const key = {
      key: "foo",
      bucket: "bar",
    };
    const totalOps = 100;

    // Propose and label 100 operations
    for (let i = 0; i < totalOps; i++) {
      const op = Promise.resolve({});
      const values = new Map([[key, i]]);
      q.propose(op, values);
      q.label(op, i.toString());
    }

    const restored = new OperationQueue();
    await restored.restore(store, () => Promise.resolve(undefined));

    expect(restored.flatten().get(key)).toBe(totalOps - 1);
    // Confirm operations and check the decrement in flatten output
    for (let i = totalOps - 1; i > 0; i--) {
      restored.confirm(i.toString());
      expect(restored.flatten().get(key)).toBe(i - 1);
    }
  });
});
