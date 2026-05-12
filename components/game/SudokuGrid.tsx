"use client";

import { EyeOff } from "lucide-react";
import type { Digit, Grid } from "@/lib/sudoku/types";

function cn(...parts: (string | false | undefined | null)[]) {
  return parts.filter(Boolean).join(" ");
}

type SudokuGridProps = {
  playerGrid: Grid;
  solution: Grid;
  givenMask: boolean[][];
  selected: { row: number; col: number } | null;
  onSelectCell: (row: number, col: number) => void;
  notesHas: (row: number, col: number, digit: Digit) => boolean;
  /** When true, highlight cells that share a row, column, or 3x3 box with the selection. */
  highlightPeers?: boolean;
  /** When false, wrong placements are not styled differently from correct ones. */
  showMistakes?: boolean;
  /** When true, hide all cell contents behind a "Paused" overlay. */
  paused?: boolean;
};

export function SudokuGrid({
  playerGrid,
  solution,
  givenMask,
  selected,
  onSelectCell,
  notesHas,
  highlightPeers = true,
  showMistakes = true,
  paused = false,
}: SudokuGridProps) {
  const matchDigit =
    selected != null ? playerGrid[selected.row][selected.col] : (0 as Digit);
  const showMatch =
    matchDigit !== 0 ? (matchDigit as number) : 0;
  const selRow = selected?.row ?? -1;
  const selCol = selected?.col ?? -1;
  const selBoxR = selected ? Math.floor(selected.row / 3) : -1;
  const selBoxC = selected ? Math.floor(selected.col / 3) : -1;

  return (
    <div
      className="relative w-full max-w-lg mx-auto select-none"
      role="grid"
      aria-label="Sudoku board"
    >
      <div
        className={cn(
          "aspect-square w-full border-2 border-foreground/80 rounded-lg overflow-hidden bg-background transition",
          paused && "blur-md saturate-50 pointer-events-none",
        )}
        aria-hidden={paused}
      >
        <div className="grid h-full w-full grid-cols-9">
          {playerGrid.map((row, r) =>
            row.map((value, c) => {
              const isGiven = givenMask[r][c];
              const isSelected = selected?.row === r && selected?.col === c;
              const rightThick = (c + 1) % 3 === 0 && c < 8;
              const bottomThick = (r + 1) % 3 === 0 && r < 8;
              const hasNotes = value === 0 && [1, 2, 3, 4, 5, 6, 7, 8, 9].some((d) =>
                notesHas(r, c, d as Digit),
              );
              const isWrong =
                showMistakes &&
                !isGiven &&
                value !== 0 &&
                value !== solution[r][c];
              const isMatchHighlight =
                !isWrong && showMatch !== 0 && value === showMatch;
              const sharesRow = highlightPeers && selRow === r && !isSelected;
              const sharesCol = highlightPeers && selCol === c && !isSelected;
              const sharesBox =
                highlightPeers &&
                !isSelected &&
                Math.floor(r / 3) === selBoxR &&
                Math.floor(c / 3) === selBoxC;
              const isPeer = sharesRow || sharesCol || sharesBox;

              return (
                <button
                  type="button"
                  key={`${r}-${c}`}
                  role="gridcell"
                  aria-selected={isSelected}
                  aria-label={`Row ${r + 1} column ${c + 1}`}
                  tabIndex={-1}
                  onClick={() => onSelectCell(r, c)}
                  className={cn(
                    "relative flex items-center justify-center font-semibold text-lg sm:text-xl outline-none focus-visible:ring-2 focus-visible:ring-offset-0 focus-visible:ring-sky-500",
                    isWrong && "bg-red-500/15 text-red-700 dark:text-red-300",
                    !isWrong && isGiven && "text-foreground",
                    !isWrong &&
                      isGiven &&
                      !isMatchHighlight &&
                      !isPeer &&
                      "bg-foreground/10",
                    !isWrong && !isGiven && "text-foreground",
                    !isWrong && isPeer && !isMatchHighlight && !isGiven &&
                      "bg-sky-500/[0.08] dark:bg-sky-400/[0.08]",
                    !isWrong && isPeer && !isMatchHighlight && isGiven &&
                      "bg-sky-500/15 dark:bg-sky-400/15",
                    isMatchHighlight &&
                      "bg-sky-500/35 text-sky-950 shadow-[inset_0_0_0_2px_rgba(14,165,233,0.55)] dark:bg-sky-500/30 dark:text-sky-50 dark:shadow-[inset_0_0_0_2px_rgba(125,211,252,0.55)]",
                    isSelected &&
                      "z-[1] ring-[3px] ring-inset ring-sky-500 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.35)] dark:shadow-[inset_0_0_0_1px_rgba(0,0,0,0.25)]",
                    !isSelected && !isGiven && !isWrong && "hover:bg-foreground/5",
                    rightThick ? "border-r-2 border-foreground/70" : c < 8 && "border-r border-foreground/20",
                    bottomThick ? "border-b-2 border-foreground/70" : r < 8 && "border-b border-foreground/20",
                  )}
                >
                  {value !== 0 ? (
                    <span>{value}</span>
                  ) : hasNotes ? (
                    <div className="absolute inset-0.5 grid grid-cols-3 grid-rows-3 place-items-center text-[0.55rem] sm:text-[0.6rem] font-normal leading-none text-foreground/70">
                      {([1, 2, 3, 4, 5, 6, 7, 8, 9] as const).map((d) => (
                        <span
                          key={d}
                          className={cn(
                            "flex h-full w-full items-center justify-center",
                            !notesHas(r, c, d) && "invisible",
                          )}
                        >
                          {d}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </button>
              );
            }),
          )}
        </div>
      </div>
      {paused ? (
        <div
          className="pointer-events-none absolute inset-0 flex items-center justify-center"
          aria-live="polite"
        >
          <div className="pointer-events-none flex flex-col items-center gap-2 rounded-2xl border border-foreground/15 bg-background/85 px-6 py-5 text-center shadow-lg backdrop-blur-sm">
            <EyeOff className="h-6 w-6 opacity-70" aria-hidden />
            <p className="text-sm font-semibold uppercase tracking-[0.15em] text-foreground/70">
              Paused
            </p>
            <p className="text-xs text-foreground/60">Resume to continue</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
