import { expect, test, describe } from "bun:test";
import { check, union } from "./consistency";
describe("check", () => {
  test("check (true)", () => {
    const result = check(
      {
        a: 0,
        b: 1,
      },
      {
        "a < b": null,
      }
    );
    expect(result).toBe(true);
  });

  test("check (false)", () => {
    const result = check(
      {
        a: 1,
        b: 0,
      },
      {
        "a < b": null,
      }
    );
    expect(result).toBe(false);
  });

  test("check clauses are added (true)", () => {
    const result = check(
      {
        a: 0,
        b: 1,
        c: 2,
      },
      {
        "a < b": null,
        "b < c": null,
      }
    );
    expect(result).toBe(true);
  });
  test("check clauses are added (false)", () => {
    const result = check(
      {
        a: 2,
        b: 1,
        c: 0,
      },
      {
        "a < b": null,
        "b < c": null,
      }
    );
    expect(result).toBe(false);
  });
});

describe("union", () => {
  test("union combined unique clauses", () => {
    const a = {
      "a < b": null,
    };
    const b = {
      "b < c": null,
    };
    const c = union(a, b);

    expect(c).toEqual({
      "a < b": null,
      "b < c": null,
    });
    expect(a).toEqual({
      "a < b": null,
    });
    expect(b).toEqual({
      "b < c": null,
    });
  });

  test("union deduplicates identical clauses", () => {
    const a = {
      "a < b": null,
    };
    const b = {
      "a < b": null,
    };
    const c = union(a, b);

    expect(c).toEqual({
      "a < b": null,
    });
  });
});
