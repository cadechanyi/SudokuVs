import type { Difficulty, Grid, NewGame } from "@/lib/sudoku/types";

export const SINGLE_SAVE_STORAGE_KEY = "sudokuVs_singleSave";
const SAVE_VERSION = 1 as const;

export type NotesGrid = number[][];

export type SinglePlayerSaveV1 = {
  v: typeof SAVE_VERSION;
  difficulty: Difficulty;
  game: NewGame;
  playerGrid: Grid;
  notes: NotesGrid;
};

const SIZE = 9;

function isDigitGrid(g: unknown): g is Grid {
  if (!Array.isArray(g) || g.length !== SIZE) return false;
  for (const row of g) {
    if (!Array.isArray(row) || row.length !== SIZE) return false;
    for (const cell of row) {
      if (typeof cell !== "number" || cell < 0 || cell > 9) return false;
    }
  }
  return true;
}

function isNotesGrid(n: unknown): n is NotesGrid {
  if (!Array.isArray(n) || n.length !== SIZE) return false;
  for (const row of n) {
    if (!Array.isArray(row) || row.length !== SIZE) return false;
    for (const cell of row) {
      if (typeof cell !== "number" || cell < 0) return false;
    }
  }
  return true;
}

function isDifficulty(d: unknown): d is Difficulty {
  return d === "easy" || d === "medium" || d === "hard";
}

function isComplete(playerGrid: Grid, solution: Grid): boolean {
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (playerGrid[r][c] !== solution[r][c]) return false;
    }
  }
  return true;
}

export function parseSinglePlayerSave(raw: string | null): SinglePlayerSaveV1 | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as unknown;
    if (!data || typeof data !== "object") return null;
    const o = data as Record<string, unknown>;
    if (o.v !== SAVE_VERSION) return null;
    if (!isDifficulty(o.difficulty)) return null;
    const game = o.game as NewGame | undefined;
    if (!game || !isDigitGrid(game.puzzle) || !isDigitGrid(game.solution)) return null;
    if (!isDigitGrid(o.playerGrid) || !isNotesGrid(o.notes)) return null;
    const save: SinglePlayerSaveV1 = {
      v: SAVE_VERSION,
      difficulty: o.difficulty,
      game: {
        puzzle: game.puzzle.map((row) => [...row]) as Grid,
        solution: game.solution.map((row) => [...row]) as Grid,
      },
      playerGrid: (o.playerGrid as Grid).map((row) => [...row]) as Grid,
      notes: (o.notes as NotesGrid).map((row) => [...row]) as NotesGrid,
    };
    if (isComplete(save.playerGrid, save.game.solution)) return null;
    return save;
  } catch {
    return null;
  }
}

export function loadSinglePlayerSave(): SinglePlayerSaveV1 | null {
  if (typeof window === "undefined") return null;
  try {
    return parseSinglePlayerSave(localStorage.getItem(SINGLE_SAVE_STORAGE_KEY));
  } catch {
    return null;
  }
}

export function clearSinglePlayerSave(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(SINGLE_SAVE_STORAGE_KEY);
}

export function saveSinglePlayerSave(payload: SinglePlayerSaveV1): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(SINGLE_SAVE_STORAGE_KEY, JSON.stringify(payload));
}

export function hasResumableSingleSave(): boolean {
  return loadSinglePlayerSave() !== null;
}

export function buildSinglePlayerSave(
  difficulty: Difficulty,
  game: NewGame,
  playerGrid: Grid,
  notes: NotesGrid,
): SinglePlayerSaveV1 {
  return {
    v: SAVE_VERSION,
    difficulty,
    game: {
      puzzle: game.puzzle.map((row) => [...row]) as Grid,
      solution: game.solution.map((row) => [...row]) as Grid,
    },
    playerGrid: playerGrid.map((row) => [...row]) as Grid,
    notes: notes.map((row) => [...row]) as NotesGrid,
  };
}
