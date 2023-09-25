import { OMap } from "OMap";
import {
  JSONValue,
  Operation,
  Ref,
  ResolvedRef,
  url,
  DeleteValue,
  VersionId,
} from "./types";

export class OperationQueue {
  // Pending writes iterate in insertion order
  // The key, promise, indicated the pending IO operations
  pendingWrites: Map<Operation, OMap<ResolvedRef, JSONValue | DeleteValue>> =
    new Map();

  writtenOperations: Map<VersionId, Operation> = new Map();

  observeVersionId(versionId: string) {
    if (this.writtenOperations.has(versionId)) {
      //console.log(`clearing pending write for observeVersionId ${versionId}`);
      const operation = this.writtenOperations.get(versionId)!;
      this.pendingWrites.delete(operation);
      this.writtenOperations.delete(versionId);
    }
  }

  flatten(): Map<string, JSONValue | undefined> {
    // Also play all pending writes over the top
    const mask = new Map();
    this.pendingWrites.forEach((values) => {
      values.forEach((value: any, ref: Ref) => {
        mask.set(url(ref), value);
      });
    });
    return mask;
  }
}
