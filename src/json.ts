import { JSONValue } from "types";

export function apply<T>(target: T, patch: JSONValue): T {
  // If patch is an array or a primitive, just return it
  if (Array.isArray(patch) || typeof patch !== "object" || patch === null) {
    return <T>patch;
  }

  // Ensure target is an object
  const target_json: any =
    typeof target !== "object" || target === null ? {} : target;

  for (let key in patch) {
    if (patch[key] === null) {
      delete target_json[key];
    } else {
      target_json[key] = apply(target_json[key], patch[key]);
    }
  }

  return <T>target_json;
}
