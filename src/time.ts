export const lowerTimeBound = () => `${Date.now() - 200}`.padStart(14, "0");
export const upperTimeBound = () => `${Date.now() + 200}`.padStart(14, "0");

/**
 * Converts timestamps like LastModified to their seconds since UTC epoch
 */
export const dateToSecs = (dateTimestamp: string): number => {
  return Math.floor(new Date(dateTimestamp).getTime() / 1000);
};

export const measure = async <Result>(
  work: Promise<Result>
): Promise<[Result, number]> => {
  const start = Date.now();
  const result = await work;
  const end = Date.now();
  return [result, end - start];
};
