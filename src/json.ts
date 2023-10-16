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
  if (patch === null) return {};
  if (typeof patch !== "object" || target === undefined) {
    return <T>patch;
  }
  if (Object.keys(patch).length == 0) return target;
  if (typeof target !== "object") return <T>patch;
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
  if (source === target) return {};
  if (typeof target !== "object") return target;

  var targeKeys = Object.keys(target);
  if (typeof source !== "object" && targeKeys.length == 0) return null;
  if (typeof source !== "object") return target;
  var patch = {};
  var sourceKeys = Object.keys(source);

  var key, i;

  // new elements
  for (i = 0; i < Math.max(targeKeys.length, sourceKeys.length); i++) {
    key = targeKeys[i];
    if (source[key] === undefined) {
      patch[key] = target[key];
    } else if (target[key] === undefined) {
      patch[key] = null;
    } else {
      patch[key] = diff(target[key], source[key]);
    }
  }

  return patch;
}
