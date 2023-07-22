import { isManifest } from "../manifest";

test("isManifest", () => {
  expect(isManifest({})).toBe(false);
  expect(isManifest({ version: 0 })).toBe(true);
});
