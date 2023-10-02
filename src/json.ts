import { JSONValue } from "types";

export function apply(target: JSONValue, patch: JSONValue): JSONValue {
  // If patch is an array or a primitive, just return it
  if (Array.isArray(patch) || typeof patch !== "object" || patch === null) {
    return patch;
  }

  // Ensure target is an object
  if (typeof target !== "object" || target === null) {
    target = {};
  }

  for (let key in patch) {
    if (patch[key] === null) {
      delete target[key];
    } else {
      target[key] = apply(target[key], patch[key]);
    }
  }

  return target;
}
