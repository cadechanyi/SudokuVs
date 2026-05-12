"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, LogIn } from "lucide-react";
import { useMultiplayer } from "@/context/MultiplayerContext";

export function JoinForm() {
  const router = useRouter();
  const mp = useMultiplayer();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const res = await mp.joinRoom(code, name.trim() || "Player");
    if (!res.ok) {
      setError(res.reason);
      return;
    }
    const normalized = code.replace(/\D/g, "").slice(0, 4);
    router.push(`/lobby?room=${normalized}`);
  };

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-12">
      <Link
        href="/"
        className="inline-flex w-fit items-center gap-1 rounded-lg border border-foreground/15 px-3 py-2 text-sm font-medium text-foreground/80 transition hover:bg-foreground/5"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Home
      </Link>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">Join a room</h1>
        <p className="mt-2 text-sm text-foreground/70">
          Enter the four-digit code from your host. Multiplayer uses a{" "}
          <span className="font-medium">WebSocket</span> server so anyone who can reach the same
          server URL can join.
        </p>
      </div>

      {mp.connectionError ? (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-900 dark:text-red-100">
          {mp.connectionError}
        </p>
      ) : null}

      <form onSubmit={submit} className="flex flex-col gap-4">
        <div className="space-y-2">
          <label htmlFor="room-code" className="text-sm font-medium text-foreground/80">
            Room code
          </label>
          <input
            id="room-code"
            inputMode="numeric"
            maxLength={4}
            pattern="[0-9]*"
            autoComplete="one-time-code"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 4))}
            placeholder="1234"
            className="w-full rounded-lg border border-foreground/15 bg-background px-3 py-2 font-mono text-2xl tracking-[0.35em] outline-none ring-sky-500/40 focus:ring-2"
            required
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="join-name" className="text-sm font-medium text-foreground/80">
            Your name
          </label>
          <input
            id="join-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Alex"
            className="w-full rounded-lg border border-foreground/15 bg-background px-3 py-2 text-sm outline-none ring-sky-500/40 focus:ring-2"
          />
        </div>
        {error && (
          <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-900 dark:text-red-100">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={!mp.wsConnected || Boolean(mp.connectionError)}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-sky-500 dark:hover:bg-sky-400"
        >
          <LogIn className="h-4 w-4" aria-hidden />
          Join lobby
        </button>
      </form>
    </div>
  );
}
