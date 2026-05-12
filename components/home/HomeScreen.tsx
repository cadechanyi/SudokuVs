"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState, useSyncExternalStore } from "react";
import { DoorOpen, Gamepad2, Users, X } from "lucide-react";
import {
  clearSinglePlayerSave,
  hasResumableSingleSave,
} from "@/lib/singlePlayerSave";
import {
  getSettingsServerSnapshot,
  getSettingsSnapshot,
  subscribeSettings,
  updateSettings,
} from "@/lib/settings";
import type { Difficulty } from "@/lib/sudoku/types";

const difficulties: Difficulty[] = ["easy", "medium", "hard"];

type ModalKind = null | "resume" | "difficulty";

export function HomeScreen() {
  const router = useRouter();
  const [modal, setModal] = useState<ModalKind>(null);
  const settings = useSyncExternalStore(
    subscribeSettings,
    getSettingsSnapshot,
    getSettingsServerSnapshot,
  );

  const openSinglePlayer = useCallback(() => {
    if (typeof window !== "undefined" && hasResumableSingleSave()) {
      setModal("resume");
      return;
    }
    setModal("difficulty");
  }, []);

  const closeModal = useCallback(() => setModal(null), []);

  const onContinueGame = useCallback(() => {
    setModal(null);
    router.push("/game?resume=1");
  }, [router]);

  const onStartNewFromResume = useCallback(() => {
    clearSinglePlayerSave();
    setModal("difficulty");
  }, []);

  const onPickDifficulty = useCallback(
    (d: Difficulty) => {
      setModal(null);
      router.push(`/game?difficulty=${d}`);
    },
    [router],
  );

  return (
    <main className="mx-auto flex min-h-full w-full max-w-lg flex-col justify-center gap-8 px-6 py-16">
      <div className="text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-foreground/50">
          Welcome
        </p>
        <h1 className="mt-2 text-4xl font-bold tracking-tight sm:text-5xl">SudokuVs</h1>
        <p className="mt-3 text-balance text-foreground/70">
          Play solo or race friends to the finish line
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={openSinglePlayer}
          className="flex min-h-14 items-center justify-center gap-3 rounded-xl border border-foreground/15 bg-foreground/5 px-4 text-base font-semibold transition hover:bg-foreground/10"
        >
          <Gamepad2 className="h-5 w-5 shrink-0 opacity-80" aria-hidden />
          Single Player
        </button>
        <Link
          href="/lobby?new=1"
          className="flex min-h-14 items-center justify-center gap-3 rounded-xl border border-sky-600/40 bg-sky-600/10 px-4 text-base font-semibold text-sky-950 transition hover:bg-sky-600/15 dark:text-sky-50"
        >
          <Users className="h-5 w-5 shrink-0 opacity-80" aria-hidden />
          Multiplayer (2–4 players)
        </Link>
        <Link
          href="/join"
          className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-dashed border-foreground/25 px-4 text-sm font-medium text-foreground/80 transition hover:border-foreground/40 hover:bg-foreground/5"
        >
          <DoorOpen className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
          Have a room code? Join here
        </Link>
      </div>

      {modal === "resume" ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="resume-title"
            className="relative w-full max-w-md rounded-2xl border border-foreground/15 bg-background p-6 shadow-lg"
          >
            <button
              type="button"
              onClick={closeModal}
              className="absolute right-3 top-3 rounded-lg p-2 text-foreground/60 transition hover:bg-foreground/10 hover:text-foreground"
              aria-label="Close"
            >
              <X className="h-5 w-5" aria-hidden />
            </button>
            <h2 id="resume-title" className="pr-10 text-lg font-semibold">
              Unfinished single-player game
            </h2>
            <p className="mt-2 text-sm text-foreground/70">
              You have a saved puzzle in progress. Continue where you left off, or start a new game
              (your save will be cleared).
            </p>
            <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeModal}
                className="rounded-lg border border-foreground/15 px-4 py-2 text-sm font-medium transition hover:bg-foreground/5"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onStartNewFromResume}
                className="rounded-lg border border-foreground/15 px-4 py-2 text-sm font-medium transition hover:bg-foreground/5"
              >
                Start new
              </button>
              <button
                type="button"
                onClick={onContinueGame}
                className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700 dark:bg-sky-500 dark:hover:bg-sky-400"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {modal === "difficulty" ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="difficulty-title"
            className="relative w-full max-w-md rounded-2xl border border-foreground/15 bg-background p-6 shadow-lg"
          >
            <button
              type="button"
              onClick={closeModal}
              className="absolute right-3 top-3 rounded-lg p-2 text-foreground/60 transition hover:bg-foreground/10 hover:text-foreground"
              aria-label="Close"
            >
              <X className="h-5 w-5" aria-hidden />
            </button>
            <h2 id="difficulty-title" className="pr-10 text-lg font-semibold">
              New solo game
            </h2>
            <p className="mt-2 text-sm text-foreground/70">
              Choose difficulty and confirm your settings. These can&apos;t be changed mid-game.
            </p>
            <div className="mt-5 space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-foreground/60">
                Show mistakes immediately
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => updateSettings({ showMistakes: true })}
                  className={[
                    "rounded-full px-4 py-2 text-sm font-semibold transition",
                    settings.showMistakes
                      ? "bg-violet-600 text-white dark:bg-violet-500"
                      : "border border-foreground/15 bg-foreground/5 hover:bg-foreground/10",
                  ].join(" ")}
                >
                  Show
                </button>
                <button
                  type="button"
                  onClick={() => updateSettings({ showMistakes: false })}
                  className={[
                    "rounded-full px-4 py-2 text-sm font-semibold transition",
                    !settings.showMistakes
                      ? "bg-violet-600 text-white dark:bg-violet-500"
                      : "border border-foreground/15 bg-foreground/5 hover:bg-foreground/10",
                  ].join(" ")}
                >
                  Hide
                </button>
              </div>
              <p className="text-xs text-foreground/55">
                {settings.showMistakes
                  ? "Wrong placements turn red and your mistake count is shown."
                  : "Wrong placements look normal; the mistake counter is hidden as “--”."}
              </p>
            </div>
            <div className="mt-5 space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-foreground/60">
                Difficulty
              </p>
              <div className="flex flex-wrap gap-2">
                {difficulties.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => onPickDifficulty(d)}
                    className="rounded-full border border-foreground/15 bg-foreground/5 px-4 py-2 text-sm font-semibold capitalize transition hover:bg-foreground/10"
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
