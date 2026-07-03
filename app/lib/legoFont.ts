// 5x7 bitmap glyphs, row 0 = top. Only the letters needed for "JUSTIN".
const GLYPHS: Record<string, string[]> = {
  J: ["11111", "00010", "00010", "00010", "00010", "10010", "01100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  I: ["11111", "00100", "00100", "00100", "00100", "00100", "11111"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
};

export const GLYPH_W = 5;
export const GLYPH_H = 7;
const TRACKING = 1; // empty columns between letters

export interface LetterCell {
  x: number; // grid column
  y: number; // grid row, y-up
}

/**
 * Lay out a word as filled grid cells, centered horizontally on gridW,
 * with the glyph baseline starting at yBottom (y-up).
 */
export function layoutWord(
  word: string,
  gridW: number,
  yBottom: number,
): LetterCell[] {
  const letters = word.split("");
  const totalW = letters.length * GLYPH_W + (letters.length - 1) * TRACKING;
  const x0 = Math.floor((gridW - totalW) / 2);
  const cells: LetterCell[] = [];
  letters.forEach((ch, li) => {
    const glyph = GLYPHS[ch];
    if (!glyph) return;
    const gx = x0 + li * (GLYPH_W + TRACKING);
    glyph.forEach((row, ri) => {
      const y = yBottom + (GLYPH_H - 1 - ri);
      for (let c = 0; c < GLYPH_W; c++) {
        if (row[c] === "1") cells.push({ x: gx + c, y });
      }
    });
  });
  return cells;
}
