import type { Digit, Grid } from "./types";
import { BOX, SIZE } from "./constants";
import { cloneGrid } from "./grid";

export function isValidPlacement(
  grid: Grid,
  row: number,
  col: number,
  digit: Digit,
): boolean {
  if (digit === 0) return true;
  for (let c = 0; c < SIZE; c++) {
    if (c !== col && grid[row][c] === digit) return false;
  }
  for (let r = 0; r < SIZE; r++) {
    if (r !== row && grid[r][col] === digit) return false;
  }
  const br = Math.floor(row / BOX) * BOX;
  const bc = Math.floor(col / BOX) * BOX;
  for (let r = br; r < br + BOX; r++) {
    for (let c = bc; c < bc + BOX; c++) {
      if ((r !== row || c !== col) && grid[r][c] === digit) return false;
    }
  }
  return true;
}

/** Count solutions; stops early once count reaches `limit` (default 2). */
export function countSolutions(grid: Grid, limit = 2): number {
  const g = cloneGrid(grid);
  let count = 0;

  function findEmpty(): [number, number] | null {
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if (g[r][c] === 0) return [r, c];
      }
    }
    return null;
  }

  function dfs(): void {
    if (count >= limit) return;
    const cell = findEmpty();
    if (!cell) {
      count++;
      return;
    }
    const [row, col] = cell;
    const order = shuffleDigits();
    for (const d of order) {
      const digit = d as Digit;
      if (isValidPlacement(g, row, col, digit)) {
        g[row][col] = digit;
        dfs();
        g[row][col] = 0;
        if (count >= limit) return;
      }
    }
  }

  dfs();
  return count;
}

function shuffleDigits(): Digit[] {
  const digits: Digit[] = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  for (let i = digits.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [digits[i], digits[j]] = [digits[j], digits[i]];
  }
  return digits;
}
