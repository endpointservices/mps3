type Variable = string;
type Clause = string;
type Knowledge = Record<Clause, null>;
type Grounding = Record<Variable, number>;

export const check = (grounding: Grounding, kb: Knowledge): boolean => {
  return eval?.(`const ${Object.entries(grounding)
    .map(([variable, number]) => `${variable} = ${number}`)
    .join(", ")}
        ${Object.keys(kb).join(" && ")}`);
};
