"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { GameShell } from "@/components/game/GameShell";
import { useMultiplayer } from "@/context/MultiplayerContext";

export default function RoomGamePage() {
  const params = useParams();
  const raw = params?.roomCode;
  const codeFromUrl = typeof raw === "string" ? raw.replace(/\D/g, "").slice(0, 4) : "";
  const mp = useMultiplayer();

  if (!mp.hydrated) {
    return (
      <div className="mx-auto max-w-lg px-4 py-24 text-center text-sm text-foreground/60">
        Loading…
      </div>
    );
  }

  if (mp.connectionError) {
    return (
      <div className="mx-auto max-w-lg space-y-4 px-4 py-16 text-center text-sm text-red-900 dark:text-red-100">
        <p>{mp.connectionError}</p>
        <Link href="/" className="font-medium text-sky-600 underline dark:text-sky-400">
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

  const ok =
    codeFromUrl.length === 4 &&
    mp.roomCode === codeFromUrl &&
    mp.phase === "playing" &&
    Boolean(mp.sharedGame);

  if (!ok) {
    return (
      <div className="mx-auto max-w-lg space-y-4 px-4 py-16 text-center text-sm text-foreground/80">
        <p>
          This room is not active in your multiplayer session, or the game has not started yet.
          Check the code or return to the lobby.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link href="/lobby" className="font-medium text-sky-600 underline dark:text-sky-400">
            Lobby
          </Link>
          <Link href="/" className="font-medium text-sky-600 underline dark:text-sky-400">
            Home
          </Link>
        </div>
      </div>
    );
  }

  return <GameShell mode="multi" />;
}
