type Variable = string;
type Clause = string;
export type Knowledge = Record<Clause, null>;
export type Grounding = Record<Variable, number>;

export const check = (grounding: Grounding, kb: Knowledge): boolean => {
  const expr = `const ${Object.entries(grounding)
    .map(([variable, number]) => `${variable} = ${number}`)
    .join(", ")};
    ${Object.keys(kb).join(" && ")}`;
  try {
    return eval?.(expr);
  } catch (err) {
    console.error(expr);
    throw err;
  }
};

export const union = (a: Knowledge, b: Knowledge): Knowledge =>
  Object.assign({}, a, b);
