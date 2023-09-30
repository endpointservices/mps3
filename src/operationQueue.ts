import { OMap } from "OMap";
import { JSONValue, DeleteValue } from "./types";
import { UseStore, get, set, del, keys } from "idb-keyval";

export type Operation = Promise<unknown>;

export class OperationQueue {
  proposedOperations: Map<Operation, Map<URL, JSONValue | DeleteValue>> =
    new Map();
  operationLabels: Map<string, [Operation, string?]> = new Map(); // Second value is the IndexedDB key if used
  private db?: UseStore;
  private lastIndex: number = 0;

  constructor(store?: UseStore) {
    this.db = store;
  }

  async propose(write: Operation, values: Map<URL, JSONValue | DeleteValue>) {
    this.proposedOperations.set(write, values);
    if (this.db) {
      this.lastIndex++;
      const key = `entry-${this.lastIndex}`;
      await set(
        key,
        [...values.entries()].map(([url, val]) => [url.toString(), val]),
        this.db
      );
    }
  }

  async label(write: Operation, version: string) {
    const key = this.db ? `entry-${this.lastIndex}` : undefined;
    this.operationLabels.set(version, [write, key]);
  }

  async confirm(label: string) {
    if (this.operationLabels.has(label)) {
      const [operation, key] = this.operationLabels.get(label)!;
      this.proposedOperations.delete(operation);
      this.operationLabels.delete(label);
      if (key && this.db) {
        await del(key, this.db);
      }
    }
  }

  async cancel(write: Operation) {
    let keyToDelete: string | undefined;
    this.operationLabels.forEach((value, key) => {
      if (value[0] === write) {
        keyToDelete = value[1];
        this.operationLabels.delete(key);
      }
    });
    this.proposedOperations.delete(write);
    if (keyToDelete && this.db) {
      await del(keyToDelete, this.db);
    }
  }

  flatten(): OMap<URL, JSONValue | undefined> {
    const mask = new OMap<URL, JSONValue | undefined>((a) => a.toString());
    this.proposedOperations.forEach((values) => {
      values.forEach((value: any, ref: URL) => {
        mask.set(ref, value);
      });
    });
    return mask;
  }

  async restore(
    store: UseStore,
    schedule: (write: Map<URL, JSONValue | DeleteValue>) => Promise<unknown>
  ) {
    this.db = store;

    const allKeys: string[] = await keys(this.db);
    const entries = allKeys
      .filter((key: any) => key.startsWith("entry-"))
      .sort();

    for (const key of entries) {
      const entriesRaw = await get<[string, JSONValue | DeleteValue][]>(
        key,
        this.db
      );
      const entries: [URL, JSONValue | DeleteValue][] = entriesRaw!.map(
        ([url, val]) => [new URL(url), val]
      );
      const values = new Map<URL, JSONValue | DeleteValue>(entries);
      const op = schedule(values);
      this.propose(op, values);
      this.lastIndex = Math.max(this.lastIndex, parseInt(key.split("-")[1]));
    }
  }
}