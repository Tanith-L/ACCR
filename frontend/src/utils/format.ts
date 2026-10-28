const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];

/** "two" for 2, "12" for 12: the Figma copy spells out small counts. */
export const numberWord = (n: number) => WORDS[n] ?? String(n);

/** "1 question", "3 questions". */
export const plural = (n: number, word: string, count: string | number = n) =>
  `${count} ${word}${n === 1 ? '' : 's'}`;

/** Whole percent, never above 100. */
export const percent = (done: number, total: number) =>
  total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
