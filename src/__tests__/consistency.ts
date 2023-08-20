type Variable = string;
type Clause = string;
export type Knowledge = Record<Clause, null>;
export type Grounding = Record<Variable, number>;

export const check = (grounding: Grounding, kb: Knowledge): boolean => {
  if (Object.keys(kb).length === 0) return true;
  const expr = `const ${Object.entries(grounding)
    .map(([variable, number]) => `${variable} = ${number}`)
    .join(", ")};
    ${Object.keys(kb).join(" && ")}
  `;
  try {
    return eval?.(expr);
  } catch (err) {
    console.error(expr);
    throw err;
  }
};

export const union = (a: Knowledge, b: Knowledge): Knowledge =>
  Object.assign({}, a, b);

export class CausalSystem {
  global_time = 0;
  client_clocks = [1, 1, 1];
  client_labels = ["A", "B", "C"];
  grounding: Grounding = {
    [this.symbol(0, 0)]: 0,
    [this.symbol(1, 0)]: 0,
    [this.symbol(2, 0)]: 0,
  };
  knowledge_base: Knowledge = {};
  previous_seen: string[] = [];

  private symbol(client: number, clock: number) {
    return `${this.client_labels[client]}_${clock}`;
  }

  observe({
    receiver: client,
    sender: source,
    send_time: source_time,
  }: {
    receiver: number;
    sender: number;
    send_time: number;
  }) {
    this.global_time++;
    const client_clock = this.client_clocks[client]++;

    // Record the client's timestep in the global time
    Object.assign(this.grounding, {
      [this.symbol(client, client_clock)]: this.global_time,
    });
    // Record the client next step as Infinity
    Object.assign(this.grounding, {
      [`${this.symbol(client, client_clock + 1)}`]: Number.POSITIVE_INFINITY,
    });

    Object.assign(this.knowledge_base, {
      // Indicate the progression of time on the client clock
      [`${this.symbol(client, client_clock - 1)} < ${this.symbol(
        client,
        client_clock
      )}`]: null,
      // The source tick happened-before the client clock
      [`${this.symbol(source, source_time)} < ${this.symbol(
        client,
        client_clock
      )}`]: null,
    });
    if (this.previous_seen[client]) {
      Object.assign(this.knowledge_base, {
        // The previously seen message happens after
        [`${this.previous_seen[client]} < ${this.symbol(source, source_time)}`]:
          null,
      });
    }
    this.previous_seen[client] = `${this.symbol(source, source_time)}`;
  }

  causallyConsistent(): boolean {
    // Check facts are causally consistent so far
    return check(this.grounding, this.knowledge_base);
  }
}
