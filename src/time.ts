export const lowerTimeBound = () => `${Date.now() - 2000}`.padStart(14, "0");
export const upperTimeBound = () => `${Date.now() + 2000}`.padStart(14, "0");
