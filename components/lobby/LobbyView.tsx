"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Copy, Play, RefreshCw, Sparkles } from "lucide-react";
import { useMultiplayer } from "@/context/MultiplayerContext";
import type { Difficulty } from "@/lib/sudoku/types";

const difficulties: Difficulty[] = ["easy", "medium", "hard"];

const MISTAKE_PRESETS = [0, 5, 15] as const;

function MistakePenaltyHostControls({
  value,
  onChange,
}: {
  value: number;
  onChange: (seconds: number) => void;
}) {
  const isPreset = (MISTAKE_PRESETS as readonly number[]).includes(value);
  const [customDraft, setCustomDraft] = useState(() => (!isPreset ? String(value) : "30"));

  useEffect(() => {
    if (isPreset) return;
    const id = window.setTimeout(() => {
      setCustomDraft(String(value));
    }, 0);
    return () => window.clearTimeout(id);
  }, [isPreset, value]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {MISTAKE_PRESETS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onChange(s)}
            className={[
              "rounded-full px-4 py-2 text-sm font-semibold transition",
              value === s
                ? "bg-violet-600 text-white dark:bg-violet-500"
                : "border border-foreground/15 bg-foreground/5 hover:bg-foreground/10",
            ].join(" ")}
          >
            {s === 0 ? "None (0s)" : `+${s}s`}
          </button>
        ))}
      </div>
      <div
        className={[
          "flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-end",
          !isPreset ? "border-violet-500/50 bg-violet-500/5" : "border-foreground/10 bg-background/80",
        ].join(" ")}
      >
        <div className="min-w-0 flex-1 space-y-1">
          <label htmlFor="mistake-custom" className="text-xs font-medium text-foreground/70">
            Custom (seconds per mistake, max 600)
          </label>
          <input
            id="mistake-custom"
            type="number"
            min={0}
            max={600}
            value={customDraft}
            onChange={(e) => setCustomDraft(e.target.value)}
            className="w-full max-w-[12rem] rounded-lg border border-foreground/15 bg-background px-3 py-2 text-sm tabular-nums outline-none ring-violet-500/30 focus:ring-2"
          />
        </div>
        <button
          type="button"
          onClick={() => {
            const n = Number.parseInt(customDraft, 10);
            if (!Number.isFinite(n)) return;
            onChange(n);
          }}
          className="shrink-0 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-700 dark:bg-violet-500 dark:hover:bg-violet-400"
        >
          Apply custom
        </button>
      </div>
    </div>
  );
}

export function LobbyView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mp = useMultiplayer();
  const [copyDone, setCopyDone] = useState(false);

  const roomQuery = searchParams.get("room");
  const wantsFreshLobby = searchParams.get("new") === "1";
  const freshLobbyOnceRef = useRef(false);

  useEffect(() => {
    if (!mp.hydrated) return;
    if (mp.connectionError) return;
    if (!mp.wsConnected) return;
    if (roomQuery) return;

    if (!wantsFreshLobby) {
      freshLobbyOnceRef.current = false;
    }

    if (wantsFreshLobby) {
      if (freshLobbyOnceRef.current) return;
      freshLobbyOnceRef.current = true;
      queueMicrotask(() => {
        mp.startNewHostLobby();
        router.replace("/lobby");
      });
      return;
    }

    if (mp.phase === "lobby" && mp.roomCode) return;
    if (mp.phase === "playing") return;
    queueMicrotask(() => mp.hostRoom());
  }, [
    mp.hydrated,
    mp.phase,
    mp.roomCode,
    mp.hostRoom,
    mp.startNewHostLobby,
    mp.connectionError,
    mp.wsConnected,
    roomQuery,
    wantsFreshLobby,
    router,
  ]); // eslint-disable-line react-hooks/exhaustive-deps -- avoid re-hosting on unrelated `mp` updates

  useEffect(() => {
    if (mp.connectionError) return;
    if (!mp.wsConnected) return;
    if (mp.phase === "playing" && mp.roomCode && mp.sharedGame) {
      queueMicrotask(() => router.replace(`/game/room/${mp.roomCode}`));
    }
  }, [mp.phase, mp.roomCode, mp.sharedGame, mp.connectionError, mp.wsConnected, router]);

  const queryMismatch =
    mp.hydrated &&
    roomQuery &&
    mp.roomCode &&
    roomQuery.replace(/\D/g, "") !== mp.roomCode;

  const copyCode = async () => {
    if (!mp.roomCode) return;
    try {
      await navigator.clipboard.writeText(mp.roomCode);
      setCopyDone(true);
      window.setTimeout(() => setCopyDone(false), 1600);
    } catch {
      setCopyDone(false);
    }
  };

  if (!mp.hydrated) {
    return (
      <div className="mx-auto max-w-lg px-4 py-24 text-center text-sm text-foreground/60">
        Loading lobby…
      </div>
    );
  }

  if (mp.connectionError) {
    return (
      <div className="mx-auto max-w-lg space-y-4 px-4 py-16 text-center">
        <p className="text-sm text-red-900 dark:text-red-100">{mp.connectionError}</p>
        <p className="text-xs text-foreground/60">
          Start the realtime server with <span className="font-mono">npm run dev:ws</span> (default{" "}
          <span className="font-mono">ws://localhost:3847</span>) or set{" "}
          <span className="font-mono">NEXT_PUBLIC_WS_URL</span>.
        </p>
        <Link
          href="/"
          className="inline-flex items-center justify-center rounded-lg bg-foreground/10 px-4 py-2 text-sm font-medium"
        >
          Home
        </Link>
      </div>
    );
  }

  if (!mp.wsConnected) {
    return (
      <div className="mx-auto max-w-lg px-4 py-24 text-center text-sm text-foreground/60">
        Connecting to multiplayer server…
      </div>
    );
  }

  if (queryMismatch) {
    return (
      <div className="mx-auto max-w-lg space-y-4 px-4 py-16 text-center">
        <p className="text-sm text-foreground/80">
          The room in the URL does not match your saved session. Open the Join page and enter the
          code again.
        </p>
        <Link
          href="/join"
          className="inline-flex items-center justify-center rounded-lg bg-foreground/10 px-4 py-2 text-sm font-medium"
        >
          Go to Join
        </Link>
      </div>
    );
  }

  if (!mp.roomCode) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center text-sm text-foreground/70">
        Preparing your room…
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-6 px-4 py-10">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/"
          className="inline-flex items-center gap-1 rounded-lg border border-foreground/15 px-3 py-2 text-sm font-medium text-foreground/80 transition hover:bg-foreground/5"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Home
        </Link>
        {mp.isHost && (
          <button
            type="button"
            onClick={() => {
              mp.startNewHostLobby();
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-foreground/15 px-3 py-2 text-sm font-medium text-foreground/80 transition hover:bg-foreground/5"
          >
            <RefreshCw className="h-4 w-4" aria-hidden />
            New room
          </button>
        )}
      </div>

      <div className="rounded-2xl border border-foreground/10 bg-foreground/[0.03] p-6 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-foreground/50">
              Room code
            </p>
            <p className="mt-1 font-mono text-4xl font-bold tracking-[0.25em]">{mp.roomCode}</p>
            <p className="mt-2 text-sm text-foreground/65">
              Share this code with up to three friends. They need the same WebSocket server URL
              (see <span className="font-mono">NEXT_PUBLIC_WS_URL</span>) and can join from the Join
              screen.
            </p>
          </div>
          <button
            type="button"
            onClick={copyCode}
            className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-foreground/15 bg-background px-3 py-2 text-xs font-medium transition hover:bg-foreground/5"
          >
            <Copy className="h-3.5 w-3.5" aria-hidden />
            {copyDone ? "Copied" : "Copy"}
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <label htmlFor="display-name" className="text-sm font-medium text-foreground/80">
          Your name
        </label>
        <input
          id="display-name"
          key={mp.myPlayerId ?? "me"}
          defaultValue={
            mp.players.find((p) => p.id === mp.myPlayerId)?.name ?? ""
          }
          onBlur={(e) => {
            const v = e.target.value.trim() || "Player";
            mp.setMyDisplayName(v);
          }}
          placeholder="Enter your name"
          className="w-full rounded-lg border border-foreground/15 bg-background px-3 py-2 text-sm outline-none ring-sky-500/40 focus:ring-2"
        />
      </div>

      {mp.isHost && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground/80">Difficulty</p>
          <div className="flex flex-wrap gap-2">
            {difficulties.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => mp.setDifficulty(d)}
                className={[
                  "rounded-full px-4 py-2 text-sm font-semibold capitalize transition",
                  mp.difficulty === d
                    ? "bg-sky-600 text-white dark:bg-sky-500"
                    : "border border-foreground/15 bg-foreground/5 hover:bg-foreground/10",
                ].join(" ")}
              >
                {d}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-3 rounded-xl border border-foreground/10 bg-foreground/[0.02] p-4">
        <div>
          <p className="text-sm font-medium text-foreground/85">Mistake time penalty</p>
          <p className="mt-1 text-xs text-foreground/60">
            Extra seconds added to each player&apos;s clock for every wrong number placed. Used for
            rankings when the game ends.
          </p>
        </div>
        {mp.isHost ? (
          <MistakePenaltyHostControls
            value={mp.mistakePenaltySeconds}
            onChange={mp.setMistakePenaltySeconds}
          />
        ) : (
          <p className="text-sm text-foreground/75">
            <span className="font-medium text-foreground/90">Host setting: </span>
            {mp.mistakePenaltySeconds === 0
              ? "No time added for mistakes."
              : `+${mp.mistakePenaltySeconds} second${mp.mistakePenaltySeconds === 1 ? "" : "s"} per mistake.`}
          </p>
        )}
      </div>

      <div className="space-y-3 rounded-xl border border-foreground/10 bg-foreground/[0.02] p-4">
        <div>
          <p className="text-sm font-medium text-foreground/85">Show mistakes immediately</p>
          <p className="mt-1 text-xs text-foreground/60">
            When on, wrong placements turn red and mistake counts are visible. When off, players
            must catch their own errors; counters display as &ldquo;--&rdquo;. Mistakes still count
            for the time penalty above.
          </p>
        </div>
        {mp.isHost ? (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => mp.setShowMistakes(true)}
              className={[
                "rounded-full px-4 py-2 text-sm font-semibold transition",
                mp.showMistakes
                  ? "bg-violet-600 text-white dark:bg-violet-500"
                  : "border border-foreground/15 bg-foreground/5 hover:bg-foreground/10",
              ].join(" ")}
            >
              Show
            </button>
            <button
              type="button"
              onClick={() => mp.setShowMistakes(false)}
              className={[
                "rounded-full px-4 py-2 text-sm font-semibold transition",
                !mp.showMistakes
                  ? "bg-violet-600 text-white dark:bg-violet-500"
                  : "border border-foreground/15 bg-foreground/5 hover:bg-foreground/10",
              ].join(" ")}
            >
              Hide
            </button>
          </div>
        ) : (
          <p className="text-sm text-foreground/75">
            <span className="font-medium text-foreground/90">Host setting: </span>
            {mp.showMistakes
              ? "Mistakes are revealed immediately."
              : "Mistakes are hidden; players must self-check."}
          </p>
        )}
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-foreground/80">Players ({mp.players.length}/4)</p>
        <ul className="divide-y divide-foreground/10 rounded-xl border border-foreground/10">
          {mp.players.map((p) => (
            <li key={p.id} className="flex items-center justify-between px-4 py-3 text-sm">
              <span className="font-medium">
                {p.name}
                {p.id === mp.myPlayerId ? <span className="text-foreground/50"> (you)</span> : null}
              </span>
              {p.isHost ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-900 dark:text-amber-100">
                  <Sparkles className="h-3 w-3" aria-hidden />
                  Host
                </span>
              ) : (
                <span className="text-xs text-foreground/50">Player</span>
              )}
            </li>
          ))}
        </ul>
      </div>

      {mp.isHost ? (
        <button
          type="button"
          onClick={() => mp.startGame()}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 text-sm font-semibold text-white transition hover:bg-sky-700 dark:bg-sky-500 dark:hover:bg-sky-400"
        >
          <Play className="h-4 w-4" aria-hidden />
          Start game
        </button>
      ) : (
        <p className="text-center text-sm text-foreground/65">
          Waiting for the host to start… Other players can open <span className="font-medium">Join</span>{" "}
          and enter this room code.
        </p>
      )}

      {mp.isHost && mp.players.length < 2 && (
        <p className="text-center text-xs text-foreground/55">
          Tip: open{" "}
          <Link href="/join" className="font-semibold underline">
            Join
          </Link>{" "}
          on another device or browser to add up to four players.
        </p>
      )}
    </div>
  );
}
