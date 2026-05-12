import type { Digit, Grid } from "./types";
import { BOX, SIZE } from "./constants";

export function emptyGrid(): Grid {
  return Array.from({ length: SIZE }, () =>
    Array.from({ length: SIZE }, () => 0 as Digit),
  );
}

export function cloneGrid(grid: Grid): Grid {
  return grid.map((row) => [...row]) as Grid;
}

export function getBoxIndex(row: number, col: number): number {
  return Math.floor(row / BOX) * BOX + Math.floor(col / BOX);
}

/** Player value matches solution for non-given cells; givens ignored in numerator/denominator split */
export function getCompletionPercent(
  playerGrid: Grid,
  solution: Grid,
  givenMask: boolean[][],
): number {
  let total = 0;
  let correct = 0;
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (givenMask[r][c]) continue;
      total++;
      const v = playerGrid[r][c];
      if (v !== 0 && v === solution[r][c]) correct++;
    }
  }
  if (total === 0) return 100;
  return Math.round((correct / total) * 100);
}

export function buildGivenMask(puzzle: Grid): boolean[][] {
  return puzzle.map((row) => row.map((cell) => cell !== 0));
}

export function countClues(puzzle: Grid): number {
  let n = 0;
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (puzzle[r][c] !== 0) n++;
    }
  }
  return n;
}
