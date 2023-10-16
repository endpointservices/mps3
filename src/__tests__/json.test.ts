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
    const fields = Math.floor(Math.random() * 2);
    return {
      ...(fields > 0 && { a: rndDoc() }),
      ...(fields > 1 && { b: rndDoc() }),
    };
  }
};

const TRIALS = 1000;

const repeat = (fn: () => void) => {
  return () => {
    for (let i = 0; i < TRIALS; i++) {
      fn();
    }
  };
};

describe("JSON Merge Patch (RFC 7386)", () => {
  test(
    "identity: merge(x, {}) == x",
    repeat(() => {
      const doc = rndDoc();
      expect(merge(doc, {})).toEqual(doc);
    })
  );

  test(
    "deletion: merge(x, null) == {}",
    repeat(() => {
      const doc = rndDoc();
      expect(merge(doc, null)).toEqual({});
    })
  );

  test("case: merge(true, {a: {}}) == {a: {}}", () => {
    expect(merge(true, { a: {} })).toEqual({ a: {} });
  });

  test("case: merge({}, {a: {}}) == {a: {}}", () => {
    expect(merge({}, { a: {} })).toEqual({ a: {} });
  });

  test("case: merge({a: false}, true) == true", () => {
    expect(merge({ a: false }, true)).toEqual(true);
  });

  test("case: merge({a: false}, true) == true", () => {
    expect(merge({ a: false }, true)).toEqual(true);
  });

  test(
    "associative: merge(a, merge(b, c)) == merge(merge(a, b), c)",
    repeat(() => {
      const a = rndDoc();
      const b = rndDoc();
      const c = rndDoc();
      console.log("a", a, "b", b, "c", c);
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
  test(
    "identity: diff(a, {}) == a",
    repeat(() => {
      const a = rndDoc();
      expect(diff(a, {})).toEqual(a);
    })
  );

  test(
    "identity: diff(a, a) == {}",
    repeat(() => {
      const a = rndDoc();
      expect(diff(a, a)).toEqual({});
    })
  );

  test("case: diff({}, 0) == null", () => {
    expect(diff({}, 0)).toEqual(null);
  });

  test("case: diff({a: {}}, {}) == {a: {}}", () => {
    expect(diff({ a: {} }, {})).toEqual({ a: {} });
  });

  test("case: diff({a: false}, {a: 0}) == {a: false}", () => {
    expect(diff({ a: false }, { a: 0 })).toEqual({ a: false });
  });

  test("case: diff({a: {}}, {a: true}) == {a: null", () => {
    expect(diff({ a: {} }, { a: true })).toEqual({ a: null });
  });

  test(
    "inverse: merge(a, diff(b, a)) == b",
    repeat(() => {
      const a = rndDoc();
      const b = rndDoc();
      console.log("a", a, "b", b, "diff(b, a)", diff(b, a));
      expect(merge(a, diff(b, a))).toEqual(b);
    })
  );
});
