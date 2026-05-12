"use client";

import { Timer } from "lucide-react";
import { useEffect, useState } from "react";
import { formatElapsed } from "@/lib/formatTime";

export type PlayerProgressRow = {
  id: string;
  name: string;
  percent: number;
  mistakes: number;
  /** When false, row is styled as disconnected (grey, frozen). */
  connected?: boolean;
};

type GameTopBarProps = {
  players: PlayerProgressRow[];
  /** Wall-clock ms when this game started (solo or multi). */
  gameStartedAtMs: number;
  isComplete: boolean;
  /** When true, each row shows an adjusted clock; header shows “Your time” with penalty. */
  isMultiplayer?: boolean;
  /** Seconds added to displayed time per mistake (multiplayer). */
  mistakePenaltySeconds?: number;
  myPlayerId?: string | null;
  /** When true, the timer stops ticking (solo pause). */
  isPaused?: boolean;
  /** When false, the local player's mistake count renders as "--". */
  showMistakes?: boolean;
};

export function GameTopBar({
  players,
  gameStartedAtMs,
  isComplete,
  isMultiplayer = false,
  mistakePenaltySeconds = 0,
  myPlayerId = null,
  isPaused = false,
  showMistakes = true,
}: GameTopBarProps) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const start = gameStartedAtMs;
    const tick = () => {
      setElapsed(Math.max(0, Math.floor((Date.now() - start) / 1000)));
    };
    tick();
    if (isComplete || isPaused) return;
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [gameStartedAtMs, isComplete, isPaused]);

  const penalty = mistakePenaltySeconds;
  const myRow = isMultiplayer && myPlayerId ? players.find((p) => p.id === myPlayerId) : undefined;
  const yourAdjusted = elapsed + (myRow?.mistakes ?? 0) * penalty;

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      {isMultiplayer ? (
        <div className="inline-flex flex-col gap-0.5 rounded-lg border border-foreground/15 bg-foreground/5 px-3 py-2 text-sm font-medium tabular-nums">
          <div className="flex items-center gap-2">
            <Timer className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
            <span className="text-xs font-semibold uppercase tracking-wide text-foreground/55">
              Your time
            </span>
          </div>
          <span aria-live="polite" className="pl-6 sm:pl-0">
            {formatElapsed(yourAdjusted)}
          </span>
          {penalty > 0 ? (
            <p className="pl-6 text-[0.65rem] font-normal normal-case text-foreground/50 sm:pl-0">
              +{penalty}s per mistake
            </p>
          ) : null}
        </div>
      ) : (
        <div
          className={[
            "inline-flex items-center gap-2 rounded-lg border border-foreground/15 bg-foreground/5 px-3 py-2 text-sm font-medium tabular-nums",
            isPaused ? "opacity-60" : "",
          ].join(" ")}
        >
          <Timer className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
          <span aria-live="polite">{formatElapsed(elapsed)}</span>
          {isPaused ? (
            <span className="text-[0.7rem] font-semibold uppercase tracking-wide text-foreground/55">
              Paused
            </span>
          ) : null}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="mb-1 text-xs font-medium uppercase tracking-wide text-foreground/60">
          Progress
        </p>
        <ul className="flex flex-wrap gap-2" aria-label="Player progress">
          {players.map((p) => {
            const connected = p.connected !== false;
            const pct = Math.min(100, Math.max(0, p.percent));
            const isMe = myPlayerId != null && p.id === myPlayerId;
            const hideMistakeNum = !showMistakes && (isMe || !isMultiplayer);
            const displayTime = elapsed + p.mistakes * penalty;
            return (
              <li
                key={p.id}
                className={[
                  "min-w-[9rem] flex-1 rounded-md border px-2 py-1.5 text-xs sm:text-sm",
                  connected
                    ? "border-foreground/15 bg-foreground/5"
                    : "border-foreground/10 bg-foreground/[0.02] opacity-70",
                ].join(" ")}
                aria-label={
                  connected
                    ? `${p.name}, ${pct}%, ${hideMistakeNum ? "mistakes hidden" : `${p.mistakes} mistakes`}`
                    : `${p.name}, disconnected, ${pct}%, ${hideMistakeNum ? "mistakes hidden" : `${p.mistakes} mistakes`}`
                }
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={[
                      "truncate font-medium",
                      connected ? "" : "text-foreground/55",
                    ].join(" ")}
                  >
                    {p.name}
                  </span>
                  <span
                    className={[
                      "tabular-nums",
                      connected ? "text-foreground/80" : "text-foreground/50",
                    ].join(" ")}
                  >
                    {pct}%
                  </span>
                </div>
                <div
                  className="mt-1 h-1.5 overflow-hidden rounded-full bg-foreground/10"
                  role="progressbar"
                  aria-valuenow={pct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div
                    className={[
                      "h-full rounded-full",
                      connected
                        ? "bg-sky-600/80 transition-[width] duration-500 dark:bg-sky-400/80"
                        : "bg-foreground/25 transition-none dark:bg-foreground/35",
                    ].join(" ")}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[0.65rem] font-medium uppercase tracking-wide text-foreground/55">
                  <span>Mistakes</span>
                  <span
                    className={[
                      "tabular-nums",
                      hideMistakeNum ? "text-foreground/40" : "text-foreground/80",
                    ].join(" ")}
                  >
                    {hideMistakeNum ? "--" : p.mistakes}
                  </span>
                </div>
                {isMultiplayer ? (
                  <div className="mt-1 flex items-center justify-between border-t border-foreground/10 pt-1.5 text-[0.65rem] font-medium uppercase tracking-wide text-foreground/55">
                    <span>Time</span>
                    <span className="tabular-nums text-foreground/85">{formatElapsed(displayTime)}</span>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
