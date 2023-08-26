import { expect, test, describe, beforeAll } from "bun:test";
import { dateToSecs } from "time";

describe("timestampToSecs", () => {
  test("Mon, 3 Oct 2016 22:32:00 GMT", () => {
    const result = dateToSecs("Mon, 3 Oct 2016 22:32:00 GMT");
    expect(result).toBe(1475533920);
  });

  test("Mon, 3 Oct 2016 22:32:01 GMT", () => {
    const result = dateToSecs("Mon, 3 Oct 2016 22:32:01 GMT");
    expect(result).toBe(1475533921);
  });
});
