export const timestamp = (epoch: number = 0) => `${epoch}`.padStart(14, "0");

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
