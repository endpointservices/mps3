import { isNull } from "node:sys";

export type JSONArrayless =
  | string
  | number
  | boolean
  | { [x: string]: JSONArrayless };

export type JSONValue =
  | string
  | number
  | boolean
  | null
  | { [x: string]: JSONValue }
  | Array<JSONValue>;

export const clone = <T>(state: T): T => JSON.parse(JSON.stringify(state));

/**
 * JSON Merge Patch (RFC 7386)
 * Update target JSON with a merge patch
 */
export function merge<T>(target: T, patch: Partial<T>): T {
  // If patch is an array or a primitive, just return it
  if (patch === undefined) return target;
  if (patch === null) return undefined;
  if (
    typeof patch !== "object" ||
    target === undefined ||
    typeof target !== "object"
  ) {
    return <T>patch;
  }
  target = typeof target === "object" ? clone(target) : <T>{};
  for (let key in patch) {
    if (patch[key] === null) {
      delete target[key];
    } else {
      target[key] = merge(target[key], patch[key]!);
    }
  }
  return <T>target;
}

export function diff<T>(target: T, source: T): Partial<T> {
  //console.log(target, source);
  if (source === target) return undefined;
  if (source !== undefined && target === undefined) return null;
  if (typeof target !== "object") return target;
  if (typeof source !== "object") return target;

  var targeKeys = Object.keys(target);
  var sourceKeys = Object.keys(source);

  var patch = {};

  // Object compare
  for (let i = 0; i < Math.max(targeKeys.length, sourceKeys.length); i++) {
    const key = targeKeys[i] || sourceKeys[i];
    const val = diff(target[key], source[key]);
    if (val !== undefined) patch[key] = val;
  }

  return patch;
}
