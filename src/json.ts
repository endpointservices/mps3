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
export function merge<T>(target: T, patch: JSONValue): T {
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
      target_json[key] = merge(target_json[key], patch[key]);
    }
  }

  return <T>target_json;
}
