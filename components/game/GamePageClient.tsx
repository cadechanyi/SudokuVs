"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { GameShell } from "@/components/game/GameShell";
import { loadSinglePlayerSave } from "@/lib/singlePlayerSave";
import type { Difficulty } from "@/lib/sudoku/types";

export function GamePageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const resumeParam = searchParams.get("resume");
  const difficultyRaw = searchParams.get("difficulty");

  const resumeSnapshot = useMemo(() => {
    if (resumeParam !== "1") return null;
    return loadSinglePlayerSave();
  }, [resumeParam]);

  const difficulty: Difficulty | null =
    difficultyRaw === "easy" || difficultyRaw === "medium" || difficultyRaw === "hard"
      ? difficultyRaw
      : null;

  useEffect(() => {
    if (resumeParam === "1") {
      if (!resumeSnapshot) {
        router.replace("/");
      }
      return;
    }
    if (!difficulty) {
      router.replace("/");
    }
  }, [resumeParam, resumeSnapshot, difficulty, router]);

  const remountSeed = useMemo(
    () => crypto.randomUUID(),
    [difficultyRaw, resumeParam],
  );

  if (resumeParam === "1") {
    if (!resumeSnapshot) {
      return (
        <div className="mx-auto max-w-lg px-4 py-24 text-center text-sm text-foreground/60">
          Loading…
        </div>
      );
    }
    return (
      <GameShell
        mode="single"
        difficulty={resumeSnapshot.difficulty}
        singleResume={{
          game: resumeSnapshot.game,
          playerGrid: resumeSnapshot.playerGrid,
          notes: resumeSnapshot.notes,
        }}
        remountSeed={remountSeed}
      />
    );
  }

  if (!difficulty) {
    return (
      <div className="mx-auto max-w-lg px-4 py-24 text-center text-sm text-foreground/60">
        Loading…
      </div>
    );
  }

  return (
    <GameShell mode="single" difficulty={difficulty} remountSeed={remountSeed} />
  );
}
