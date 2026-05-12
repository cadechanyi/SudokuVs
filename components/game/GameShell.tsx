"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { House, X } from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useMultiplayer } from "@/context/MultiplayerContext";
import { useSudokuGame, type SudokuResumeSnapshot } from "@/hooks/useSudokuGame";
import {
  buildSinglePlayerSave,
  clearSinglePlayerSave,
  saveSinglePlayerSave,
} from "@/lib/singlePlayerSave";
import { formatElapsed } from "@/lib/formatTime";
import { readSettingsOnce } from "@/lib/settings";
import type { Difficulty, Digit } from "@/lib/sudoku/types";
import { Confetti } from "@/components/effects/Confetti";
import { GameControls } from "./GameControls";
import { GameTopBar, type PlayerProgressRow } from "./GameTopBar";
import { NumberPad } from "./NumberPad";
import { SudokuGrid } from "./SudokuGrid";

export type GameShellProps = {
  mode: "single" | "multi";
  difficulty?: Difficulty;
  singleResume?: SudokuResumeSnapshot | null;
  /** Forces a fresh mount for new solo games at the same difficulty. */
  remountSeed?: string;
};

function puzzleSignature(puzzle: number[][]): string {
  return puzzle.map((row) => row.join("")).join("");
}

function GameShellInner({
  mode,
  difficulty = "medium",
  singleResume = null,
}: GameShellProps) {
  const router = useRouter();
  const mp = useMultiplayer();
  const reportProgress = mp.reportProgress;
  const reportMistakes = mp.reportMistakes;
  const initialGame = mode === "multi" ? mp.sharedGame : null;
  const effectiveDifficulty = mode === "multi" ? mp.difficulty : difficulty;

  const game = useSudokuGame({
    difficulty: effectiveDifficulty,
    initialGame,
    resume: mode === "single" ? singleResume : null,
  });

  const [homeLeaveOpen, setHomeLeaveOpen] = useState(false);
  const [restartOpen, setRestartOpen] = useState(false);

  // Captured once at mount and never changed during the game. For multiplayer the host's
  // room setting wins (and the server locks it once `phase !== "lobby"`). For solo, the
  // player's last choice from the home-screen difficulty modal is locked in.
  const [showMistakesAtStart] = useState(() => readSettingsOnce().showMistakes);
  const effectiveShowMistakes =
    mode === "multi" ? mp.showMistakes : showMistakesAtStart;

  const [soloGameStartMs, setSoloGameStartMs] = useState(() => Date.now());
  const [isPaused, setIsPaused] = useState(false);
  const pauseStartedAtRef = useRef<number | null>(null);

  const gameStartedAtMs =
    mode === "multi" ? (mp.startedAt ?? soloGameStartMs) : soloGameStartMs;

  const canPause = mode === "single" && !game.isComplete;

  const togglePause = useCallback(() => {
    if (!canPause) return;
    setIsPaused((prev) => {
      const next = !prev;
      if (next) {
        pauseStartedAtRef.current = Date.now();
      } else {
        const startedAt = pauseStartedAtRef.current;
        if (startedAt != null) {
          const delta = Date.now() - startedAt;
          setSoloGameStartMs((prev2) => prev2 + delta);
        }
        pauseStartedAtRef.current = null;
      }
      return next;
    });
  }, [canPause]);

  const [completedLocalSeconds, setCompletedLocalSeconds] = useState<number | null>(null);
  useEffect(() => {
    if (!game.isComplete || completedLocalSeconds !== null) return;
    const id = window.setTimeout(() => {
      setCompletedLocalSeconds(Math.max(0, Math.floor((Date.now() - gameStartedAtMs) / 1000)));
    }, 0);
    return () => window.clearTimeout(id);
  }, [game.isComplete, completedLocalSeconds, gameStartedAtMs]);

  const finishSentRef = useRef(false);
  const reportFinish = mp.reportFinish;
  useEffect(() => {
    if (!game.isComplete || mode !== "multi") return;
    if (finishSentRef.current) return;
    finishSentRef.current = true;
    reportFinish();
  }, [game.isComplete, mode, reportFinish]);

  useEffect(() => {
    if (mode !== "single") return;
    if (!game.isComplete) return;
    clearSinglePlayerSave();
  }, [mode, game.isComplete]);

  useEffect(() => {
    if (mode !== "multi") return;
    reportProgress(game.completionPercent);
  }, [mode, reportProgress, game.completionPercent]);

  useEffect(() => {
    if (mode !== "multi") return;
    reportMistakes(game.mistakeCount);
  }, [mode, reportMistakes, game.mistakeCount]);

  const playersProgress: PlayerProgressRow[] = useMemo(() => {
    if (mode === "single") {
      return [
        {
          id: "local",
          name: "You",
          percent: game.completionPercent,
          mistakes: game.mistakeCount,
          connected: true,
        },
      ];
    }
    return mp.players.map((p) => ({
      id: p.id,
      name: p.name,
      connected: p.connected !== false,
      percent:
        p.id === mp.myPlayerId
          ? game.completionPercent
          : (mp.frozenProgressByPlayerId[p.id] ?? mp.mockProgressByPlayerId[p.id] ?? 0),
      mistakes:
        p.id === mp.myPlayerId
          ? game.mistakeCount
          : (mp.frozenMistakesByPlayerId[p.id] ?? mp.mockMistakesByPlayerId[p.id] ?? 0),
    }));
  }, [
    mode,
    mp.frozenProgressByPlayerId,
    mp.mockProgressByPlayerId,
    mp.frozenMistakesByPlayerId,
    mp.mockMistakesByPlayerId,
    mp.myPlayerId,
    mp.players,
    game.completionPercent,
    game.mistakeCount,
  ]);

  const headlineSeconds = useMemo(() => {
    if (mode === "multi" && mp.myPlayerId != null) {
      const srv = mp.finishElapsedMsByPlayerId[mp.myPlayerId];
      if (srv !== undefined) return Math.floor(srv / 1000);
    }
    const raw = completedLocalSeconds ?? 0;
    if (mode === "multi") {
      return raw + game.mistakeCount * mp.mistakePenaltySeconds;
    }
    return raw;
  }, [
    mode,
    mp.myPlayerId,
    mp.finishElapsedMsByPlayerId,
    mp.mistakePenaltySeconds,
    completedLocalSeconds,
    game.mistakeCount,
  ]);

  const finishRankRows = useMemo(() => {
    if (mode !== "multi") return [];
    const fin = mp.finishElapsedMsByPlayerId;
    return [...mp.players]
      .map((p) => {
        const mistakes =
          p.id === mp.myPlayerId
            ? game.mistakeCount
            : (mp.frozenMistakesByPlayerId[p.id] ?? mp.mockMistakesByPlayerId[p.id] ?? 0);
        return { id: p.id, name: p.name, ms: fin[p.id], mistakes };
      })
      .sort((a, b) => {
        const aDone = a.ms !== undefined;
        const bDone = b.ms !== undefined;
        if (aDone && bDone) return a.ms! - b.ms!;
        if (aDone) return -1;
        if (bDone) return 1;
        return 0;
      });
  }, [
    mode,
    mp.players,
    mp.myPlayerId,
    mp.finishElapsedMsByPlayerId,
    mp.frozenMistakesByPlayerId,
    mp.mockMistakesByPlayerId,
    game.mistakeCount,
  ]);

  const digitCounts = useMemo(() => {
    const counts = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const v = game.playerGrid[r][c];
        if (v >= 1 && v <= 9) counts[v]++;
      }
    }
    return counts;
  }, [game.playerGrid]);

  const confirmLeaveHome = () => {
    if (mode === "single") {
      if (!game.isComplete) {
        saveSinglePlayerSave(
          buildSinglePlayerSave(
            effectiveDifficulty,
            { puzzle: game.puzzle, solution: game.solution },
            game.playerGrid,
            game.notes,
          ),
        );
      }
    } else {
      mp.leavePlayingGameAsDisconnected(game.completionPercent);
    }
    setHomeLeaveOpen(false);
    router.push("/");
  };

  const goHomeFromComplete = () => {
    if (mode === "multi") mp.leaveRoom();
    router.push("/");
  };

  const confirmRestart = () => {
    game.restart();
    setRestartOpen(false);
    if (mode === "single") {
      setSoloGameStartMs(Date.now());
      setCompletedLocalSeconds(null);
      if (isPaused) {
        setIsPaused(false);
        pauseStartedAtRef.current = null;
      }
    }
  };

  // Keyboard controls (desktop play). Disabled while any modal is open or game is complete.
  const anyModalOpen = homeLeaveOpen || restartOpen;
  const {
    isComplete: gameIsComplete,
    moveSelection,
    undo,
    erase,
    applyDigit,
    setNotesMode,
  } = game;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      if (t) {
        const tag = t.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || t.isContentEditable) {
          return;
        }
      }
      if (anyModalOpen) return;
      if (gameIsComplete) return;

      // Space toggles pause (solo). Allowed even while paused (to resume).
      if (e.key === " " || e.code === "Space") {
        if (mode === "single") {
          e.preventDefault();
          togglePause();
        }
        return;
      }

      if (isPaused) return;

      if ((e.metaKey || e.ctrlKey) && (e.key === "z" || e.key === "Z")) {
        e.preventDefault();
        undo();
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      switch (e.key) {
        case "ArrowUp":
          e.preventDefault();
          moveSelection(-1, 0);
          return;
        case "ArrowDown":
          e.preventDefault();
          moveSelection(1, 0);
          return;
        case "ArrowLeft":
          e.preventDefault();
          moveSelection(0, -1);
          return;
        case "ArrowRight":
          e.preventDefault();
          moveSelection(0, 1);
          return;
        case "Backspace":
        case "Delete":
          e.preventDefault();
          erase();
          return;
        case "n":
        case "N":
          setNotesMode((v) => !v);
          return;
        case "z":
        case "Z":
          undo();
          return;
      }

      if (e.key >= "1" && e.key <= "9") {
        const d = Number.parseInt(e.key, 10) as Digit;
        applyDigit(d, e.shiftKey ? "notes" : undefined);
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    anyModalOpen,
    mode,
    isPaused,
    gameIsComplete,
    togglePause,
    moveSelection,
    undo,
    erase,
    applyDigit,
    setNotesMode,
  ]);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-6">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setHomeLeaveOpen(true)}
          className="inline-flex items-center gap-2 rounded-lg border border-foreground/15 bg-foreground/5 px-3 py-2 text-sm font-medium transition hover:bg-foreground/10"
        >
          <House className="h-4 w-4" aria-hidden />
          Home
        </button>
      </div>

      <GameTopBar
        players={playersProgress}
        gameStartedAtMs={gameStartedAtMs}
        isComplete={game.isComplete}
        isMultiplayer={mode === "multi"}
        mistakePenaltySeconds={mode === "multi" ? mp.mistakePenaltySeconds : 0}
        myPlayerId={mode === "multi" ? mp.myPlayerId : "local"}
        isPaused={mode === "single" && isPaused}
        showMistakes={effectiveShowMistakes}
      />

      <SudokuGrid
        playerGrid={game.playerGrid}
        solution={game.solution}
        givenMask={game.givenMask}
        selected={game.selected}
        onSelectCell={(row, col) => {
          if (isPaused) return;
          game.setSelected({ row, col });
        }}
        notesHas={game.notesHas}
        highlightPeers
        showMistakes={effectiveShowMistakes}
        paused={isPaused}
      />

      <NumberPad
        onDigit={game.applyDigit}
        disabled={!game.selected || isPaused}
        digitSaturated={(d) => digitCounts[d] >= 9}
      />

      <GameControls
        notesMode={game.notesMode}
        onToggleNotes={() => game.setNotesMode((v) => !v)}
        onErase={game.erase}
        onUndo={game.undo}
        canUndo={game.canUndo}
        onRestart={() => setRestartOpen(true)}
        onTogglePause={mode === "single" ? togglePause : undefined}
        isPaused={isPaused}
        disabledByPause={isPaused}
      />

      <p className="hidden text-center text-[0.7rem] text-foreground/45 sm:block">
        Keyboard: arrows to move · 1–9 to enter · Shift+1–9 for notes · N notes · Z undo
        {mode === "single" ? " · Space pause" : ""}
      </p>

      {homeLeaveOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setHomeLeaveOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="leave-home-title"
            className="relative w-full max-w-md rounded-2xl border border-foreground/15 bg-background p-6 shadow-lg"
          >
            <button
              type="button"
              onClick={() => setHomeLeaveOpen(false)}
              className="absolute right-3 top-3 rounded-lg p-2 text-foreground/60 transition hover:bg-foreground/10 hover:text-foreground"
              aria-label="Close"
            >
              <X className="h-5 w-5" aria-hidden />
            </button>
            <h2 id="leave-home-title" className="pr-10 text-lg font-semibold">
              Leave game?
            </h2>
            <p className="mt-2 text-sm text-foreground/70">
              {mode === "single" ? (
                <>
                  {game.isComplete
                    ? "Return to the home screen?"
                    : "Your unfinished solo game will be saved on this device. You can continue later from Single Player on the home screen."}
                </>
              ) : (
                <>
                  You will leave this match and cannot rejoin. Other players will see you as
                  disconnected with your progress frozen.
                </>
              )}
            </p>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setHomeLeaveOpen(false)}
                className="rounded-lg border border-foreground/15 px-4 py-2 text-sm font-medium transition hover:bg-foreground/5"
              >
                Stay in game
              </button>
              <button
                type="button"
                onClick={confirmLeaveHome}
                className="rounded-lg bg-foreground/90 px-4 py-2 text-sm font-semibold text-background transition hover:bg-foreground dark:bg-foreground dark:text-background"
              >
                Leave to home
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {restartOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setRestartOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="restart-title"
            className="relative w-full max-w-md rounded-2xl border border-foreground/15 bg-background p-6 shadow-lg"
          >
            <button
              type="button"
              onClick={() => setRestartOpen(false)}
              className="absolute right-3 top-3 rounded-lg p-2 text-foreground/60 transition hover:bg-foreground/10 hover:text-foreground"
              aria-label="Close"
            >
              <X className="h-5 w-5" aria-hidden />
            </button>
            <h2 id="restart-title" className="pr-10 text-lg font-semibold">
              Restart this puzzle?
            </h2>
            <p className="mt-2 text-sm text-foreground/70">
              {mode === "single"
                ? "Your entries, pencil marks, and timer for this puzzle will be cleared. The puzzle itself stays the same."
                : "Your board, pencil marks, and mistake count will reset. Other players' progress is not affected; the shared timer keeps running."}
            </p>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setRestartOpen(false)}
                className="rounded-lg border border-foreground/15 px-4 py-2 text-sm font-medium transition hover:bg-foreground/5"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmRestart}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-400"
              >
                Restart puzzle
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <Confetti active={game.isComplete} />

      {game.isComplete ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="complete-title"
            className="relative w-full max-w-md rounded-2xl border border-foreground/15 bg-background p-6 shadow-lg"
          >
            <h2 id="complete-title" className="text-lg font-semibold text-emerald-800 dark:text-emerald-200">
              Puzzle complete
            </h2>
            <p className="mt-3 text-sm text-foreground/80">
              Your time:{" "}
              <span className="font-semibold tabular-nums text-foreground">{formatElapsed(headlineSeconds)}</span>
              {mode === "multi" && mp.mistakePenaltySeconds > 0 ? (
                <span className="mt-1 block text-xs text-foreground/55">
                  Includes +{mp.mistakePenaltySeconds}s per mistake ({game.mistakeCount} mistakes).
                </span>
              ) : null}
            </p>
            {mode === "multi" && finishRankRows.length > 0 ? (
              <div className="mt-4">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-foreground/60">
                  Ranking
                </p>
                <ol className="max-h-48 space-y-2 overflow-y-auto text-sm">
                  {finishRankRows.map((row, i) => (
                    <li
                      key={row.id}
                      className="flex items-center justify-between gap-3 rounded-md border border-foreground/10 bg-foreground/[0.03] px-3 py-2"
                    >
                      <span className="tabular-nums text-foreground/50">{i + 1}.</span>
                      <span className="min-w-0 flex-1 truncate font-medium">{row.name}</span>
                      <span className="shrink-0 text-right">
                        {row.ms !== undefined ? (
                          <span className="block">
                            <span className="tabular-nums font-semibold text-foreground/90">
                              {formatElapsed(Math.floor(row.ms / 1000))}
                            </span>
                            <span className="mt-0.5 block text-[0.7rem] font-normal text-foreground/55">
                              {row.mistakes} mistake{row.mistakes === 1 ? "" : "s"}
                            </span>
                          </span>
                        ) : (
                          <span className="tabular-nums text-foreground/50">—</span>
                        )}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            ) : null}
            <div className="mt-6">
              <button
                type="button"
                onClick={goHomeFromComplete}
                className="w-full rounded-lg bg-foreground/90 px-4 py-2.5 text-sm font-semibold text-background transition hover:bg-foreground sm:w-auto dark:bg-foreground dark:text-background"
              >
                Back to home
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function GameShell(props: GameShellProps) {
  const mp = useMultiplayer();
  if (props.mode === "multi" && !mp.sharedGame) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center text-sm text-foreground/70">
        <p className="mb-4">
          This room does not have an active puzzle yet. The host must start the game, and this
          profile must be able to read the same saved room state (local mock storage).
        </p>
        <Link href="/lobby" className="font-medium text-sky-600 underline dark:text-sky-400">
          Back to lobby
        </Link>
      </div>
    );
  }

  const remountKey =
    props.mode === "multi" && mp.sharedGame
      ? `${mp.roomCode}-${puzzleSignature(mp.sharedGame.puzzle)}`
      : props.singleResume
        ? `single-resume-${puzzleSignature(props.singleResume.game.puzzle)}`
        : `single-${props.difficulty ?? "medium"}-${props.remountSeed ?? ""}`;

  return <GameShellInner key={remountKey} {...props} />;
}
