export class OMap<K, V> {
  key: (key: K) => string;
  store: Map<string, V> = new Map();

  constructor(key: (key: K) => string) {
    this.key = key;
  }
  set(key: K, value: V): this {
    this.store.set(this.key(key), value);
    return this;
  }
  get(key: K): V | undefined {
    return this.store.get(this.key(key));
  }
  has(key: K): boolean {
    return this.store.has(this.key(key));
  }
  values(): IterableIterator<V> {
    return this.store.values();
  }
}
