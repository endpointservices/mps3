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

export const clone = (state: JSONValue) => JSON.parse(JSON.stringify(state));

/**
 * JSON Merge Patch (RFC 7386)
 * Update target JSON with a merge patch
 */
export function merge<T>(target: T, patch: Partial<T>): T {
  // If patch is an array or a primitive, just return it
  if (Array.isArray(patch) || typeof patch !== "object" || patch === null) {
    return <T>patch;
  }

  // Ensure target is an object

  for (let key in patch) {
    if (patch[key] === null) {
      delete target[key];
    } else {
      target[key] = merge(target[key], patch[key]!);
    }
  }

  return target;
}
