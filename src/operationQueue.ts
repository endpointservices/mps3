import { OMap } from "OMap";
import { JSONValue, DeleteValue, uuid } from "./types";
import { UseStore, get, set, del, keys } from "idb-keyval";

export type Operation = Promise<unknown>;

export class OperationQueue {
  private session = uuid();
  proposedOperations: Map<Operation, Map<URL, JSONValue | DeleteValue>> =
    new Map();
  operationLabels: Map<string, Operation> = new Map();
  private db?: UseStore;
  private lastIndex: number = 0;

  constructor(store?: UseStore) {
    this.db = store;
  }

  async propose(write: Operation, values: Map<URL, JSONValue | DeleteValue>) {
    if (this.db) {
      this.lastIndex++;
      const key = `entry-${this.lastIndex}`;
      (<any>write)[this.session] = this.lastIndex;
      await set(
        key,
        [...values.entries()].map(([url, val]) => [url.toString(), val]),
        this.db
      );
    }

    this.proposedOperations.set(write, values);
  }

  async label(write: Operation, label: string) {
    this.operationLabels.set(label, write);

    if (this.db) {
      const index = (<any>write)[this.session];

      if (index === undefined)
        throw new Error("Cannot label an unproposed operation");
      await set(`label-${index}`, label, this.db);
    }
  }

  async confirm(label: string) {
    if (this.operationLabels.has(label)) {
      const operation = this.operationLabels.get(label)!;
      this.proposedOperations.delete(operation);
      this.operationLabels.delete(label);
      if (this.db) {
        const index = (<any>operation)[this.session];
        await del(`entry-${index}`, this.db);
        await del(`label-${index}`, this.db);
      }
    }
  }

  async cancel(operation: Operation) {
    let keyToDelete: string | undefined;
    this.operationLabels.forEach((value, key) => {
      if (value === operation) {
        this.operationLabels.delete(key);
      }
    });
    this.proposedOperations.delete(operation);
    if (this.db) {
      const index = (<any>operation)[this.session];
      await del(`entry-${index}`, this.db);
      await del(`label-${index}`, this.db);
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
    schedule: (write: Map<URL, JSONValue | DeleteValue>) => Operation
  ) {
    this.db = store;
    this.proposedOperations.clear();
    this.operationLabels.clear();
    this.lastIndex = 0;

    const allKeys: string[] = await keys(this.db);
    const entries = allKeys
      .filter((key: any) => key.startsWith("entry-"))
      .sort();

    for (const key of entries) {
      const index = parseInt(key.split("-")[1]);
      const entry = await get<[string, JSONValue | DeleteValue][]>(
        key,
        this.db
      );
      const label = await get<string>(`label-${index}`, this.db);
      if (!entry) continue;

      const entries: [URL, JSONValue | DeleteValue][] = entry.map(
        ([url, val]) => [new URL(url), val]
      );
      const values = new Map<URL, JSONValue | DeleteValue>(entries);
      const op = schedule(values);
      (<any>op)[this.session] = index;
      this.proposedOperations.set(op, values);

      if (label) {
        console.log("about to label");
        this.label(op, label);
      }

      this.lastIndex = Math.max(this.lastIndex, index);
    }
  }
}
