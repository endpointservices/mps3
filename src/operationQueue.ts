import { OMap } from "OMap";
import {
  JSONValue,
  Ref,
  ResolvedRef,
  url,
  DeleteValue,
  VersionId,
} from "./types";

export type Operation = Promise<unknown>;

export class OperationQueue {
  // Pending writes iterate in insertion order
  // The key, promise, indicated the pending IO operations
  proposedOperations: Map<
    Operation,
    OMap<ResolvedRef, JSONValue | DeleteValue>
  > = new Map();

  operationLabels: Map<VersionId, Operation> = new Map();

  propose(
    write: Operation,
    values: OMap<ResolvedRef, JSONValue | DeleteValue>
  ) {
    this.proposedOperations.set(write, values);
  }

  label(write: Operation, version: VersionId) {
    this.operationLabels.set(version, write);
  }

  confirm(versionId: VersionId) {
    if (this.operationLabels.has(versionId)) {
      //console.log(`clearing pending write for observeVersionId ${versionId}`);
      const operation = this.operationLabels.get(versionId)!;
      this.proposedOperations.delete(operation);
      this.operationLabels.delete(versionId);
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

  flatten(): Map<string, JSONValue | undefined> {
    // Also play all pending writes over the top
    const mask = new Map();
    this.proposedOperations.forEach((values) => {
      values.forEach((value: any, ref: Ref) => {
        mask.set(url(ref), value);
      });
    });
    return mask;
  }
}
