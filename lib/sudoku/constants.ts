import type { Difficulty } from "./types";

/** Target number of given (non-empty) cells for generated puzzles */
export const CLUES_BY_DIFFICULTY: Record<Difficulty, number> = {
  easy: 42,
  medium: 34,
  hard: 28,
};

export const SIZE = 9;
export const BOX = 3;
