export const timestamp = (offset_ms: number = 0) =>
  `${Date.now() + offset_ms}`.padStart(14, "0");

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
  return [await work, Date.now() - start];
};
