"use client";

import { useCallback, useMemo, useState } from "react";
import { createNewGame } from "@/lib/sudoku/generator";
import { BOX } from "@/lib/sudoku/constants";
import {
  buildGivenMask,
  cloneGrid,
  getCompletionPercent,
} from "@/lib/sudoku/grid";
import type { Difficulty, Digit, Grid, NewGame } from "@/lib/sudoku/types";

const SIZE = 9;

export type NotesGrid = number[][];

type Snapshot = { player: Grid; notes: NotesGrid };

function emptyNotes(): NotesGrid {
  return Array.from({ length: SIZE }, () => Array.from({ length: SIZE }, () => 0));
}

function cloneNotes(n: NotesGrid): NotesGrid {
  return n.map((row) => [...row]);
}

function notesHas(notes: NotesGrid, r: number, c: number, digit: Digit): boolean {
  const mask = notes[r][c];
  return ((mask >> (digit - 1)) & 1) === 1;
}

function notesToggle(notes: NotesGrid, r: number, c: number, digit: Digit): NotesGrid {
  const next = cloneNotes(notes);
  next[r][c] ^= 1 << (digit - 1);
  return next;
}

function notesClearCell(notes: NotesGrid, r: number, c: number): NotesGrid {
  const next = cloneNotes(notes);
  next[r][c] = 0;
  return next;
}

/** Clear placed cell and remove this digit from pencil marks in the same row, column, and box. */
function notesAfterPlacingDigit(
  notes: NotesGrid,
  row: number,
  col: number,
  digit: Digit,
): NotesGrid {
  const next = cloneNotes(notes);
  next[row][col] = 0;
  if (digit === 0) return next;
  const stripMask = ~(1 << (digit - 1));
  for (let c = 0; c < SIZE; c++) {
    if (c !== col) next[row][c] &= stripMask;
  }
  for (let r = 0; r < SIZE; r++) {
    if (r !== row) next[r][col] &= stripMask;
  }
  const br = Math.floor(row / BOX) * BOX;
  const bc = Math.floor(col / BOX) * BOX;
  for (let r = 0; r < BOX; r++) {
    for (let c = 0; c < BOX; c++) {
      const rr = br + r;
      const cc = bc + c;
      if (rr === row && cc === col) continue;
      next[rr][cc] &= stripMask;
    }
  }
  return next;
}

export type SudokuResumeSnapshot = {
  game: NewGame;
  playerGrid: Grid;
  notes: NotesGrid;
};

export type UseSudokuGameOptions = {
  difficulty: Difficulty;
  initialGame?: NewGame | null;
  /** Solo restore from local save; ignored when `initialGame` is set (multiplayer). */
  resume?: SudokuResumeSnapshot | null;
};

export function useSudokuGame({ difficulty, initialGame, resume }: UseSudokuGameOptions) {
  const [game] = useState<NewGame>(() => {
    if (initialGame) return initialGame;
    if (resume) return resume.game;
    return createNewGame(difficulty);
  });
  const puzzle = game.puzzle;
  const solution = game.solution;
  const givenMask = useMemo(() => buildGivenMask(puzzle), [puzzle]);

  const [playerGrid, setPlayerGrid] = useState<Grid>(() =>
    resume ? cloneGrid(resume.playerGrid) : cloneGrid(game.puzzle),
  );
  const [notes, setNotes] = useState<NotesGrid>(() =>
    resume ? cloneNotes(resume.notes) : emptyNotes(),
  );
  const [notesMode, setNotesMode] = useState(false);
  const [selected, setSelected] = useState<{ row: number; col: number } | null>(
    null,
  );
  const [history, setHistory] = useState<Snapshot[]>([]);
  const [mistakeCount, setMistakeCount] = useState(0);
  const canUndo = history.length > 0;

  const pushHistory = useCallback((player: Grid, n: NotesGrid) => {
    setHistory((h) => [...h, { player: cloneGrid(player), notes: cloneNotes(n) }]);
  }, []);

  const applyDigit = useCallback(
    (digit: Digit, forceMode?: "place" | "notes") => {
      if (!selected) return;
      const { row, col } = selected;
      if (givenMask[row][col]) return;

      const useNotes =
        forceMode === "notes" ? true : forceMode === "place" ? false : notesMode;

      if (useNotes) {
        if (playerGrid[row][col] !== 0) return;
        const nextNotes = notesToggle(notes, row, col, digit);
        pushHistory(playerGrid, notes);
        setNotes(nextNotes);
        return;
      }

      const next = cloneGrid(playerGrid);
      next[row][col] = digit;
      const clearedNotes = notesAfterPlacingDigit(notes, row, col, digit);
      pushHistory(playerGrid, notes);
      setPlayerGrid(next);
      setNotes(clearedNotes);
      if (digit !== solution[row][col]) {
        setMistakeCount((n) => n + 1);
      }
    },
    [givenMask, notes, notesMode, playerGrid, pushHistory, selected, solution],
  );

  const erase = useCallback(() => {
    if (!selected) return;
    const { row, col } = selected;
    if (givenMask[row][col]) return;
    pushHistory(playerGrid, notes);
    const next = cloneGrid(playerGrid);
    next[row][col] = 0;
    setPlayerGrid(next);
    setNotes(notesClearCell(notes, row, col));
  }, [givenMask, notes, playerGrid, pushHistory, selected]);

  const undo = useCallback(() => {
    setHistory((h) => {
      if (h.length === 0) return h;
      const prev = h[h.length - 1];
      setPlayerGrid(prev.player);
      setNotes(prev.notes);
      return h.slice(0, -1);
    });
  }, []);

  const restart = useCallback(() => {
    setPlayerGrid(cloneGrid(puzzle));
    setNotes(emptyNotes());
    setHistory([]);
    setMistakeCount(0);
    setNotesMode(false);
  }, [puzzle]);

  const moveSelection = useCallback(
    (dr: number, dc: number) => {
      setSelected((prev) => {
        if (!prev) return { row: 0, col: 0 };
        const row = ((prev.row + dr) % SIZE + SIZE) % SIZE;
        const col = ((prev.col + dc) % SIZE + SIZE) % SIZE;
        return { row, col };
      });
    },
    [],
  );

  const completionPercent = useMemo(
    () => getCompletionPercent(playerGrid, solution, givenMask),
    [givenMask, playerGrid, solution],
  );

  const isComplete = useMemo(() => {
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if (playerGrid[r][c] !== solution[r][c]) return false;
      }
    }
    return true;
  }, [playerGrid, solution]);

  return {
    puzzle,
    solution,
    givenMask,
    playerGrid,
    notes,
    notesMode,
    setNotesMode,
    selected,
    setSelected,
    moveSelection,
    applyDigit,
    erase,
    undo,
    restart,
    completionPercent,
    isComplete,
    mistakeCount,
    notesHas: (r: number, c: number, d: Digit) => notesHas(notes, r, c, d),
    canUndo,
  };
}
