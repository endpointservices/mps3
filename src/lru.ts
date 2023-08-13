import { OMap } from "OMap";

export const lru = <T extends (...args: any[]) => any>(
  options: {
    key: (key: Parameters<T>) => string;
    max?: number;
  },
  fn: T
): ((...args: Parameters<T>) => ReturnType<T>) => {
  const cache = new OMap<Parameters<T>, ReturnType<T>>(options.key);

  return (...args: Parameters<T>) => {
    const cached = cache.get(args);
    if (cached) {
      // reinsert to promote to recently used
      cache.delete(args);
      cache.set(args, cached);
      return cached;
    } else {
      const result = fn(...args);
      cache.set(args, result);
      if (options.max && cache.size > options.max) {
        cache.delete(cache.keys().next().value);
      }
      return result;
    }
  };
};
