import { expect, test, describe, beforeAll } from "bun:test";
import { check } from "./consistency";
describe("check", () => {
  test("check it can output to true", () => {
    check(
      {
        a: 0,
        b: 1,
      },
      {
        "a < b": null,
      },
    );
  });
});
