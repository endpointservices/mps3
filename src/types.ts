export type JSONValue =
  | string
  | number
  | boolean
  | null
  | { [x: string]: JSONValue }
  | Array<JSONValue>;

export type DeleteValue = undefined;

export interface Ref {
  bucket?: string;
  key: string;
}

export interface ResolvedRef extends Ref {
  bucket: string;
  key: string;
}

export const eq = (a: Ref, b: Ref) => a.bucket === b.bucket && a.key === b.key;
export const url = (ref: Ref): string => `${ref.bucket}/${ref.key}`;
export const parseUrl = (url: string): ResolvedRef => {
  const [bucket, ...key] = url.split("/");
  return {
    bucket,
    key: key.join("/"),
  };
};
