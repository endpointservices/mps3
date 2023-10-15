import { OMap } from "OMap";
import { JSONValue, DeleteValue, uuid, ResolvedRef, url } from "./types";
import { UseStore, getMany, get, set, delMany, keys } from "idb-keyval";

export type Operation = Promise<unknown>;

const PADDING = 6;

const entryKey = (index: number): string =>
  `write-${index.toString().padStart(PADDING, "0")}`;

export class OperationQueue {
  private session = uuid();
  proposedOperations: Map<
    Operation,
    Map<ResolvedRef, JSONValue | DeleteValue>
  > = new Map();
  operationLabels: Map<string, Operation> = new Map();
  private db?: UseStore;
  private lastIndex: number = 0;
  private load?: Promise<unknown> = undefined;

  constructor(store?: UseStore) {
    this.db = store;
  }

  async propose(
    write: Operation,
    values: Map<ResolvedRef, JSONValue | DeleteValue>,
    isLoad: boolean = false,
  ) {
    this.proposedOperations.set(write, values);
    if (this.db) {
      if (this.load && !isLoad) {
        await this.load;
        // Get operations in the right order
        this.proposedOperations.delete(write);
        this.proposedOperations.set(write, values);
      }
      this.lastIndex++;
      const key = entryKey(this.lastIndex);
      (<any>write)[this.session] = this.lastIndex;
      await set(
        key,
        [...values.entries()].map(([ref, val]) => [JSON.stringify(ref), val]),
        this.db,
      );
      console.log(`STORE ${key} ${JSON.stringify([...values.entries()])}`);
    }
  }

  async label(write: Operation, label: string, isLoad: boolean = false) {
    this.operationLabels.set(label, write);

    if (this.db) {
      if (this.load && !isLoad) await this.load;
      const index = (<any>write)[this.session];

      if (index === undefined)
        throw new Error("Cannot label an unproposed operation");
      const key = `label-${index}`;
      await set(key, label, this.db);
      console.log(`STORE ${key} ${label}`);
    }
  }

  async confirm(label: string, isLoad: boolean = false) {
    if (this.operationLabels.has(label)) {
      const operation = this.operationLabels.get(label)!;
      this.proposedOperations.delete(operation);
      this.operationLabels.delete(label);
      if (this.db) {
        if (this.load && !isLoad) await this.load;
        const index = (<any>operation)[this.session];
        const keys = [entryKey(index), `label-${index}`];
        await delMany(keys, this.db);
        console.log(`DEL ${keys}`);
      }
    }
  }

  async cancel(operation: Operation, isLoad: boolean = false) {
    this.operationLabels.forEach((value, key) => {
      if (value === operation) {
        this.operationLabels.delete(key);
      }
    });
    this.proposedOperations.delete(operation);
    if (this.db) {
      if (this.load && !isLoad) await this.load;
      const index = (<any>operation)[this.session];
      await delMany([`write-${index}`, `label-${index}`], this.db);
    }
  }

  async flatten(): Promise<OMap<ResolvedRef, JSONValue | undefined>> {
    if (this.load) await this.load;
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
      label?: string,
    ) => Promise<unknown>,
  ) {
    this.db = store;
    this.proposedOperations.clear();
    this.operationLabels.clear();
    this.lastIndex = 0;
    this.load = new Promise(async (resolve) => {
      const allKeys: string[] = await keys(this.db);
      const entryKeys = allKeys
        .filter((key: any) => key.startsWith("write-"))
        .sort();
      console.log("RESTORE", entryKeys);
      const entryValues = await getMany(entryKeys, this.db);

      for (let i = 0; i < entryKeys.length; i++) {
        const index = parseInt(entryKeys[i].split("-")[1]);
        this.lastIndex = Math.max(this.lastIndex, index);
      }

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
        await delMany([`write-${index}`, `label-${index}`], this.db);
      }
      resolve(undefined);
    });
    return this.load;
  }
}
