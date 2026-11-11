// Where the patient stopped reading each lesson, so going back to the topic and
// returning to the lesson opens at the same place. Kept in memory for this app
// session only: it is a convenience, not progress, so it is never stored.
const positions = new Map<string, number>();

export const readingPosition = {
  get: (key: string): number => positions.get(key) ?? 0,
  set: (key: string, y: number) => {
    if (y > 0) positions.set(key, y);
    else positions.delete(key);
  },
};
