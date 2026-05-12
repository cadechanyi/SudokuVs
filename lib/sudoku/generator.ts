import type { Difficulty, Digit, Grid, NewGame } from "./types";
import { CLUES_BY_DIFFICULTY, SIZE } from "./constants";
import { cloneGrid, countClues, emptyGrid } from "./grid";
import { countSolutions, isValidPlacement } from "./solver";

function shuffleDigits(): Digit[] {
  const digits: Digit[] = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  for (let i = digits.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [digits[i], digits[j]] = [digits[j], digits[i]];
  }
  return digits;
}

function shufflePositions(): [number, number][] {
  const positions: [number, number][] = [];
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) positions.push([r, c]);
  }
  for (let i = positions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [positions[i], positions[j]] = [positions[j], positions[i]];
  }
  return positions;
}

export function generateSolvedGrid(): Grid {
  const g = emptyGrid();

  function findEmpty(): [number, number] | null {
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if (g[r][c] === 0) return [r, c];
      }
    }
    return null;
  }

  function fill(): boolean {
    const cell = findEmpty();
    if (!cell) return true;
    const [row, col] = cell;
    for (const digit of shuffleDigits()) {
      if (isValidPlacement(g, row, col, digit)) {
        g[row][col] = digit;
        if (fill()) return true;
        g[row][col] = 0;
      }
    }
    return false;
  }

  fill();
  return g;
}

export function makePuzzle(solved: Grid, difficulty: Difficulty): NewGame {
  const targetClues = CLUES_BY_DIFFICULTY[difficulty];
  const puzzle = cloneGrid(solved);
  const solution = cloneGrid(solved);

  const maxPasses = 40;
  for (let pass = 0; pass < maxPasses && countClues(puzzle) > targetClues; pass++) {
    let progress = false;
    for (const [r, c] of shufflePositions()) {
      if (countClues(puzzle) <= targetClues) break;
      if (puzzle[r][c] === 0) continue;
      const saved = puzzle[r][c];
      puzzle[r][c] = 0;
      if (countSolutions(puzzle, 2) === 1) {
        progress = true;
      } else {
        puzzle[r][c] = saved;
      }
    }
    if (!progress) break;
  }

  return { puzzle, solution };
}

export function createNewGame(difficulty: Difficulty): NewGame {
  const solved = generateSolvedGrid();
  return makePuzzle(solved, difficulty);
}
