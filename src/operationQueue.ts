import { OMap } from "OMap";
import { JSONValue, DeleteValue, uuid, ResolvedRef, url } from "./types";
import {
  UseStore,
  getMany,
  get,
  set,
  setMany,
  delMany,
  keys,
} from "idb-keyval";

export type Operation = Promise<unknown>;

const PADDING = 6;

export class OperationQueue {
  private session = uuid();
  proposedOperations: Map<
    Operation,
    Map<ResolvedRef, JSONValue | DeleteValue>
  > = new Map();
  operationLabels: Map<string, Operation> = new Map();
  private db?: UseStore;
  private lastIndex: number = 0;

  constructor(store?: UseStore) {
    this.db = store;
  }

  async propose(
    write: Operation,
    values: Map<ResolvedRef, JSONValue | DeleteValue>
  ) {
    this.proposedOperations.set(write, values);
    if (this.db) {
      this.lastIndex++;
      const key = `entry-${this.lastIndex.toString().padStart(PADDING, "0")}`;
      (<any>write)[this.session] = this.lastIndex;
      await setMany(
        [
          [
            key,
            [...values.entries()].map(([ref, val]) => [
              JSON.stringify(ref),
              val,
            ]),
          ],
        ],
        this.db
      );
    }
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
        await delMany([`entry-${index}`, `label-${index}`], this.db);
      }
    }
  }

  async cancel(operation: Operation) {
    this.operationLabels.forEach((value, key) => {
      if (value === operation) {
        this.operationLabels.delete(key);
      }
    });
    this.proposedOperations.delete(operation);
    if (this.db) {
      const index = (<any>operation)[this.session];
      await delMany([`entry-${index}`, `label-${index}`], this.db);
    }
  }

  flatten(): OMap<ResolvedRef, JSONValue | undefined> {
    const mask = new OMap<ResolvedRef, JSONValue | undefined>(url);
    this.proposedOperations.forEach((values) => {
      values.forEach((value: any, ref: ResolvedRef) => {
        mask.set(ref, value);
      });
    });
    return mask;
  }

  async restore(
    store: UseStore,
    schedule: (
      write: Map<ResolvedRef, JSONValue | DeleteValue>,
      label?: string
    ) => Promise<unknown>
  ) {
    this.db = store;
    this.proposedOperations.clear();
    this.operationLabels.clear();
    this.lastIndex = 0;

    const allKeys: string[] = await keys(this.db);
    const entryKeys = allKeys
      .filter((key: any) => key.startsWith("entry-"))
      .sort();
    const entryValues = await getMany(entryKeys, this.db);

    for (let i = 0; i < entryKeys.length; i++) {
      const key = entryKeys[i];
      const index = parseInt(key.split("-")[1]);
      const entry = entryValues[i].map(([ref, val]: [string, any]) => [
        JSON.parse(ref),
        val,
      ]);
      const label = await get<string>(`label-${index}`, this.db);
      if (!entry) continue;
      const values = new Map<ResolvedRef, JSONValue | DeleteValue>(entry);
      await schedule(values, label);
      // delete entries after confirmation
      await delMany([`entry-${index}`, `label-${index}`], this.db);
    }
  }
}
