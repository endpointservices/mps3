import { OMap } from "OMap";
import { JSONValue, DeleteValue } from "./types";

export type Operation = Promise<unknown>;

export class OperationQueue {
  // Pending writes iterate in insertion order
  // The key, promise, indicated the pending IO operations
  proposedOperations: Map<Operation, OMap<URL, JSONValue | DeleteValue>> =
    new Map();

  operationLabels: Map<string, Operation> = new Map();

  propose(write: Operation, values: OMap<URL, JSONValue | DeleteValue>) {
    this.proposedOperations.set(write, values);
  }

  label(write: Operation, version: string) {
    this.operationLabels.set(version, write);
  }

  confirm(label: string) {
    if (this.operationLabels.has(label)) {
      //console.log(`clearing pending write for observelabel ${label}`);
      const operation = this.operationLabels.get(label)!;
      this.proposedOperations.delete(operation);
      this.operationLabels.delete(label);
    }
  }

  cancel(write: Operation) {
    this.proposedOperations.delete(write);
    this.operationLabels.forEach((value, key) => {
      if (value === write) {
        this.operationLabels.delete(key);
      }
    });
  }

  flatten(): OMap<URL, JSONValue | undefined> {
    // Also play all pending writes over the top
    const mask = new OMap<URL, JSONValue | undefined>((a) => a.toString());
    this.proposedOperations.forEach((values) => {
      values.forEach((value: any, ref: URL) => {
        mask.set(ref, value);
      });
    });
    return mask;
  }
}
