"use client";

import { Eraser, Pause, Pencil, Play, RotateCcw, Undo2 } from "lucide-react";

type GameControlsProps = {
  notesMode: boolean;
  onToggleNotes: () => void;
  onErase: () => void;
  onUndo: () => void;
  canUndo: boolean;
  onRestart: () => void;
  /** When undefined, the Pause button is hidden (e.g. multiplayer). */
  onTogglePause?: () => void;
  isPaused?: boolean;
  /** When true, all action buttons except Pause/Resume are disabled. */
  disabledByPause?: boolean;
};

export function GameControls({
  notesMode,
  onToggleNotes,
  onErase,
  onUndo,
  canUndo,
  onRestart,
  onTogglePause,
  isPaused = false,
  disabledByPause = false,
}: GameControlsProps) {
  const baseBtn =
    "inline-flex min-h-11 items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-40";
  const neutralBtn =
    "border-foreground/20 bg-foreground/5 hover:bg-foreground/10";

  return (
    <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
      <button
        type="button"
        aria-pressed={notesMode}
        onClick={onToggleNotes}
        disabled={disabledByPause}
        className={[
          baseBtn,
          notesMode
            ? "border-sky-600 bg-sky-600/15 text-sky-800 dark:text-sky-100"
            : neutralBtn,
        ].join(" ")}
      >
        <Pencil className="h-4 w-4 shrink-0" aria-hidden />
        Notes
      </button>
      <button
        type="button"
        onClick={onErase}
        disabled={disabledByPause}
        className={[baseBtn, neutralBtn].join(" ")}
      >
        <Eraser className="h-4 w-4 shrink-0" aria-hidden />
        Erase
      </button>
      <button
        type="button"
        onClick={onUndo}
        disabled={!canUndo || disabledByPause}
        className={[baseBtn, neutralBtn].join(" ")}
      >
        <Undo2 className="h-4 w-4 shrink-0" aria-hidden />
        Undo
      </button>
      <button
        type="button"
        onClick={onRestart}
        disabled={disabledByPause}
        className={[baseBtn, neutralBtn].join(" ")}
      >
        <RotateCcw className="h-4 w-4 shrink-0" aria-hidden />
        Restart
      </button>
      {onTogglePause ? (
        <button
          type="button"
          aria-pressed={isPaused}
          onClick={onTogglePause}
          className={[
            baseBtn,
            isPaused
              ? "border-amber-500 bg-amber-500/15 text-amber-800 dark:text-amber-100"
              : neutralBtn,
          ].join(" ")}
        >
          {isPaused ? (
            <Play className="h-4 w-4 shrink-0" aria-hidden />
          ) : (
            <Pause className="h-4 w-4 shrink-0" aria-hidden />
          )}
          {isPaused ? "Resume" : "Pause"}
        </button>
      ) : null}
    </div>
  );
}
