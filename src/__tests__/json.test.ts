import { expect, test, describe } from "bun:test";
import { JSONArrayless, diff, merge } from "json";
import { uuid } from "types";

const doc = {
  boolean: true,
  number: 0,
  string: "",
  object: {
    nested: {},
  },
};

const rndDoc = (): JSONArrayless => {
  const choice = Math.floor(Math.random() * 4);
  if (choice === 0) {
    return Math.random() - 0.5;
  } else if (choice === 1) {
    return Math.random() > 0.5;
  } else if (choice === 2) {
    return uuid().substring(0, 8);
  } else {
    const fields = Math.floor(Math.random() * 3);
    return {
      ...(fields > 0 && { a: rndDoc() }),
      ...(fields > 1 && { b: rndDoc() }),
    };
  }
};

const rndStructuredDoc = () => {
  const doc: Record<string, any> = {};
  if (Math.random() > 0.5) {
    // add a scalar
    const key = "scalar-" + Math.floor(Math.random() * 2);
    const choice = Math.floor(Math.random() * 3);
    if (choice === 0) {
      doc[key] = Math.random() - 0.5;
    } else if (choice === 1) {
      doc[key] = Math.random() > 0.5;
    } else {
      doc[key] = uuid().substring(0, 8);
    }
  }
  if (Math.random() > 0.5) {
    // add a nested doc
    const key = "subdoc-" + Math.floor(Math.random() * 2);
    doc[key] = rndStructuredDoc();
  }
};

const testCase = (
  label,
  expr: (...args: any[]) => any,
  expected: (...args: any[]) => any
) =>
  test(`${label}: ${expr.toString()} == ${expected}`, () => {
    if (expr.length > 0) {
      repeat(() => {
        const args = Array.from({ length: expr.length }).map(rndDoc);
        expect(expr(...args)).toEqual(expected(...args));
      })();
    } else {
      expect(expr()).toEqual(expected());
    }
  });

const TRIALS = 10000;

const repeat = (fn: () => void) => {
  return () => {
    for (let i = 0; i < TRIALS; i++) {
      fn();
    }
  };
};

describe("JSON Merge Patch (RFC 7386)", () => {
  testCase(
    "identity",
    (a) => merge(a, undefined),
    (a) => a
  );

  testCase(
    "case",
    () => merge(0, {}),
    () => ({})
  );

  testCase(
    "case",
    () => merge({ a: "" }, {}),
    () => ({ a: "" })
  );

  testCase(
    "deletion",
    (a) => merge(a, null),
    (a) => undefined
  );

  testCase(
    "case",
    () => merge(true, { a: {} }),
    () => ({ a: {} })
  );

  testCase(
    "case",
    () => merge({}, { a: {} }),
    () => ({ a: {} })
  );

  testCase(
    "case",
    () => merge({ a: false }, true),
    () => true
  );

  test(
    "associative: merge(a, merge(b, c)) == merge(merge(a, b), c) for structured docs",
    repeat(() => {
      const a = rndStructuredDoc();
      const b = rndStructuredDoc();
      const c = rndStructuredDoc();
      expect(merge(a, merge(b, c))).toEqual(merge(merge(a, b), c));
    })
  );

  test(
    "idempotent: merge(a, a) == a",
    repeat(() => {
      const a = rndDoc();
      expect(merge(a, a)).toEqual(a);
    })
  );
});

// describe diff
describe("JSON-merge-diff", () => {
  testCase(
    "identity",
    (a) => diff(a, undefined),
    (a) => a
  );

  test(
    "identity: diff(a, a) == undefined",
    repeat(() => {
      const a = rndDoc();
      expect(diff(a, a)).toEqual(undefined);
    })
  );

  testCase(
    "case",
    () => diff({}, 0),
    () => ({})
  );

  testCase(
    "case",
    () => diff({ a: {} }, {}),
    () => ({ a: {} })
  );

  testCase(
    "case",
    () => diff({}, { a: {} }),
    () => ({ a: null })
  );

  test("case: diff({a: false}, {a: 0}) == {a: false}", () => {
    expect(diff({ a: false }, { a: 0 })).toEqual({ a: false });
  });

  testCase(
    "case",
    () => diff({ a: {} }, { a: true }),
    () => ({ a: {} })
  );

  test(
    "inverse: merge(a, diff(b, a)) == b",
    repeat(() => {
      const a = rndDoc();
      const b = rndDoc();
      /*
      console.log(
        "a",
        a,
        "b",
        b,
        "diff(b, a)",
        diff(b, a),
        "merge(a, diff(b, a))",
        merge(a, diff(b, a))
      );*/
      expect(merge(a, diff(b, a))).toEqual(b);
    })
  );
});
