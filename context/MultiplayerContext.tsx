"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Difficulty, NewGame } from "@/lib/sudoku/types";
import type { ServerToClientMessage, WireRoom } from "@/lib/realtime/protocol";

const STORAGE_MP_SESSION = "sudokuVs_ws_mp";

export type LobbyPhase = "idle" | "lobby" | "playing";

export type RoomPlayer = {
  id: string;
  name: string;
  isHost: boolean;
  connected?: boolean;
};

type MpSession = {
  playerId: string;
  roomCode: string;
};

type MultiplayerContextValue = {
  hydrated: boolean;
  wsConnected: boolean;
  connectionError: string | null;
  roomCode: string | null;
  players: RoomPlayer[];
  difficulty: Difficulty;
  phase: LobbyPhase;
  isHost: boolean;
  myPlayerId: string | null;
  sharedGame: NewGame | null;
  startedAt: number | null;
  /** Seconds added to clock per mistake (lobby + playing). */
  mistakePenaltySeconds: number;
  /** Host setting: reveal wrong placements and mistake counts (lobby + playing). */
  showMistakes: boolean;
  mockProgressByPlayerId: Record<string, number>;
  frozenProgressByPlayerId: Record<string, number>;
  finishElapsedMsByPlayerId: Record<string, number>;
  mockMistakesByPlayerId: Record<string, number>;
  frozenMistakesByPlayerId: Record<string, number>;
  hostRoom: (displayName?: string) => void;
  joinRoom: (code: string, displayName: string) => Promise<{ ok: true } | { ok: false; reason: string }>;
  setMyDisplayName: (name: string) => void;
  setDifficulty: (d: Difficulty) => void;
  setMistakePenaltySeconds: (seconds: number) => void;
  setShowMistakes: (show: boolean) => void;
  startGame: () => void;
  leaveRoom: () => void;
  startNewHostLobby: () => void;
  leavePlayingGameAsDisconnected: (lastCompletionPercent: number) => void;
  resetMockProgress: () => void;
  reportProgress: (percent: number) => void;
  reportMistakes: (count: number) => void;
  reportFinish: () => void;
};

const MultiplayerContext = createContext<MultiplayerContextValue | null>(null);

function loadSession(): MpSession | null {
  if (typeof window === "undefined") return null;
  try {
    return JSON.parse(localStorage.getItem(STORAGE_MP_SESSION) ?? "null") as MpSession | null;
  } catch {
    return null;
  }
}

function saveSession(me: MpSession | null) {
  if (typeof window === "undefined") return;
  if (!me) localStorage.removeItem(STORAGE_MP_SESSION);
  else localStorage.setItem(STORAGE_MP_SESSION, JSON.stringify(me));
}

function resolveWsUrl(): string {
  if (typeof window === "undefined") return "";
  const env = process.env.NEXT_PUBLIC_WS_URL?.trim();
  if (env) return env;
  const h = window.location.hostname;
  if (h === "localhost" || h === "127.0.0.1") {
    return `ws://${h}:3847`;
  }
  return "";
}

function normalizeRoomPlayer(p: RoomPlayer): RoomPlayer {
  return { ...p, connected: p.connected !== false };
}

function normalizePlayers(players: RoomPlayer[]): RoomPlayer[] {
  return players.map(normalizeRoomPlayer);
}

function resetIdleState() {
  return {
    roomCode: null as string | null,
    players: [] as RoomPlayer[],
    difficulty: "medium" as Difficulty,
    phase: "idle" as LobbyPhase,
    isHost: false,
    myPlayerId: null as string | null,
    sharedGame: null as NewGame | null,
    startedAt: null as number | null,
    mistakePenaltySeconds: 0,
    showMistakes: true,
    mockProgressByPlayerId: {} as Record<string, number>,
    frozenProgressByPlayerId: {} as Record<string, number>,
    finishElapsedMsByPlayerId: {} as Record<string, number>,
    mockMistakesByPlayerId: {} as Record<string, number>,
    frozenMistakesByPlayerId: {} as Record<string, number>,
  };
}

export function MultiplayerProvider({ children }: { children: React.ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [players, setPlayers] = useState<RoomPlayer[]>([]);
  const [difficulty, setDifficultyState] = useState<Difficulty>("medium");
  const [phase, setPhase] = useState<LobbyPhase>("idle");
  const [isHost, setIsHost] = useState(false);
  const [myPlayerId, setMyPlayerId] = useState<string | null>(null);
  const [sharedGame, setSharedGame] = useState<NewGame | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [mistakePenaltySeconds, setMistakePenaltySecondsState] = useState(0);
  const [showMistakes, setShowMistakesState] = useState(true);
  const [mockProgressByPlayerId, setMockProgressByPlayerId] = useState<Record<string, number>>({});
  const [frozenProgressByPlayerId, setFrozenProgressByPlayerId] = useState<Record<string, number>>(
    {},
  );
  const [finishElapsedMsByPlayerId, setFinishElapsedMsByPlayerId] = useState<Record<string, number>>(
    {},
  );
  const [mockMistakesByPlayerId, setMockMistakesByPlayerId] = useState<Record<string, number>>({});
  const [frozenMistakesByPlayerId, setFrozenMistakesByPlayerId] = useState<Record<string, number>>(
    {},
  );

  const wsRef = useRef<WebSocket | null>(null);
  const pendingSends = useRef<string[]>([]);
  const joinResolverRef = useRef<
    ((r: { ok: true } | { ok: false; reason: string }) => void) | null
  >(null);
  const joinTimeoutRef = useRef<number | null>(null);

  const send = useCallback((msg: unknown) => {
    const raw = JSON.stringify(msg);
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) ws.send(raw);
    else pendingSends.current.push(raw);
  }, []);

  const clearJoinWait = useCallback(() => {
    if (joinTimeoutRef.current) {
      clearTimeout(joinTimeoutRef.current);
      joinTimeoutRef.current = null;
    }
    joinResolverRef.current = null;
  }, []);

  useEffect(() => {
    let cancelled = false;
    const url = resolveWsUrl();
    if (!url) {
      /* eslint-disable react-hooks/set-state-in-effect -- one-shot bootstrap when WS URL is unavailable */
      setConnectionError(
        "Multiplayer needs a WebSocket server. Set NEXT_PUBLIC_WS_URL (e.g. wss://your-host/realtime) or open the app on localhost (defaults to ws://localhost:3847).",
      );
      setHydrated(true);
      /* eslint-enable react-hooks/set-state-in-effect */
      return () => {
        cancelled = true;
      };
    }

    const ws = new WebSocket(url);
    wsRef.current = ws;

    const applySnapshot = (room: WireRoom, self: { playerId: string; isHost: boolean }) => {
      saveSession({ playerId: self.playerId, roomCode: room.roomCode });
      setRoomCode(room.roomCode);
      setPlayers(normalizePlayers(room.players as RoomPlayer[]));
      setDifficultyState(room.difficulty);
      setPhase(room.phase === "playing" ? "playing" : "lobby");
      setSharedGame(room.sharedGame);
      setStartedAt(room.startedAt);
      setMistakePenaltySecondsState(room.mistakePenaltySeconds ?? 0);
      setShowMistakesState(room.showMistakes ?? true);
      setIsHost(self.isHost);
      setMyPlayerId(self.playerId);
      setFrozenProgressByPlayerId(room.frozenProgressByPlayerId ?? {});
      setMockProgressByPlayerId(room.progressByPlayerId ?? {});
      setFinishElapsedMsByPlayerId(room.finishElapsedMsByPlayerId ?? {});
      setMockMistakesByPlayerId(room.mistakesByPlayerId ?? {});
      setFrozenMistakesByPlayerId(room.frozenMistakesByPlayerId ?? {});
    };

    const onMessage = (raw: string) => {
      let msg: ServerToClientMessage;
      try {
        msg = JSON.parse(raw) as ServerToClientMessage;
      } catch {
        return;
      }
      if (!msg || typeof msg !== "object" || !("type" in msg)) return;

      if (msg.type === "snapshot") {
        applySnapshot(msg.room, msg.self);
        return;
      }
      if (msg.type === "join_result") {
        const res = joinResolverRef.current;
        joinResolverRef.current = null;
        if (joinTimeoutRef.current) {
          clearTimeout(joinTimeoutRef.current);
          joinTimeoutRef.current = null;
        }
        if (res) {
          if (msg.ok) res({ ok: true });
          else res({ ok: false, reason: msg.reason ?? "Could not join room." });
        }
        return;
      }
      if (msg.type === "rejoin_result") {
        if (!msg.ok) {
          saveSession(null);
          const idle = resetIdleState();
          setRoomCode(idle.roomCode);
          setPlayers(idle.players);
          setDifficultyState(idle.difficulty);
          setPhase(idle.phase);
          setIsHost(idle.isHost);
          setMyPlayerId(idle.myPlayerId);
          setSharedGame(idle.sharedGame);
          setStartedAt(idle.startedAt);
          setMistakePenaltySecondsState(idle.mistakePenaltySeconds);
          setShowMistakesState(idle.showMistakes);
          setMockProgressByPlayerId(idle.mockProgressByPlayerId);
          setFrozenProgressByPlayerId(idle.frozenProgressByPlayerId);
          setFinishElapsedMsByPlayerId(idle.finishElapsedMsByPlayerId);
          setMockMistakesByPlayerId(idle.mockMistakesByPlayerId);
          setFrozenMistakesByPlayerId(idle.frozenMistakesByPlayerId);
        }
        return;
      }
      if (msg.type === "error") {
        setConnectionError(msg.message);
      }
    };

    ws.onopen = () => {
      if (cancelled) return;
      setWsConnected(true);
      setConnectionError(null);
      setHydrated(true);
      const w = wsRef.current;
      if (w && w.readyState === WebSocket.OPEN) {
        for (const m of pendingSends.current) w.send(m);
        pendingSends.current = [];
      }
      const s = loadSession();
      if (s?.playerId && s?.roomCode) {
        const raw = JSON.stringify({
          type: "rejoin",
          playerId: s.playerId,
          roomCode: s.roomCode,
        });
        if (ws.readyState === WebSocket.OPEN) ws.send(raw);
        else pendingSends.current.push(raw);
      }
    };

    ws.onmessage = (ev) => {
      if (cancelled) return;
      if (typeof ev.data === "string") onMessage(ev.data);
    };

    ws.onerror = () => {
      if (cancelled) return;
      setConnectionError("Could not connect to the multiplayer server.");
      setHydrated(true);
    };

    ws.onclose = () => {
      if (cancelled) return;
      setWsConnected(false);
      if (joinTimeoutRef.current) {
        clearTimeout(joinTimeoutRef.current);
        joinTimeoutRef.current = null;
      }
      const pendingJoin = joinResolverRef.current;
      joinResolverRef.current = null;
      if (pendingJoin) {
        pendingJoin({ ok: false, reason: "Disconnected from multiplayer server." });
      }
    };

    return () => {
      cancelled = true;
      if (joinTimeoutRef.current) {
        clearTimeout(joinTimeoutRef.current);
        joinTimeoutRef.current = null;
      }
      joinResolverRef.current = null;
      ws.close();
      wsRef.current = null;
    };
  }, []);

  const hostRoom = useCallback(
    (displayName = "You") => {
      send({ type: "host", displayName });
    },
    [send],
  );

  const joinRoom = useCallback(
    (code: string, displayName: string): Promise<{ ok: true } | { ok: false; reason: string }> => {
      return new Promise((resolve) => {
        const ws = wsRef.current;
        if (!ws || ws.readyState !== WebSocket.OPEN) {
          resolve({ ok: false, reason: "Not connected to multiplayer server." });
          return;
        }
        clearJoinWait();
        joinResolverRef.current = resolve;
        joinTimeoutRef.current = window.setTimeout(() => {
          if (joinResolverRef.current === resolve) {
            joinResolverRef.current = null;
            resolve({ ok: false, reason: "Request timed out." });
          }
          joinTimeoutRef.current = null;
        }, 12000);
        ws.send(
          JSON.stringify({
            type: "join",
            roomCode: code.replace(/\D/g, "").slice(0, 4),
            displayName: displayName.trim() || "Player",
          }),
        );
      });
    },
    [clearJoinWait],
  );

  const setMyDisplayName = useCallback(
    (name: string) => {
      send({ type: "set_name", name: name.trim() || "Player" });
    },
    [send],
  );

  const setDifficulty = useCallback(
    (d: Difficulty) => {
      send({ type: "set_difficulty", difficulty: d });
    },
    [send],
  );

  const setMistakePenaltySeconds = useCallback(
    (seconds: number) => {
      send({ type: "set_mistake_penalty", seconds });
    },
    [send],
  );

  const setShowMistakes = useCallback(
    (show: boolean) => {
      send({ type: "set_show_mistakes", show });
    },
    [send],
  );

  const startGame = useCallback(() => {
    send({ type: "start_game" });
  }, [send]);

  const leaveRoom = useCallback(() => {
    send({ type: "leave" });
    saveSession(null);
    const idle = resetIdleState();
    setRoomCode(idle.roomCode);
    setPlayers(idle.players);
    setDifficultyState(idle.difficulty);
    setPhase(idle.phase);
    setIsHost(idle.isHost);
    setMyPlayerId(idle.myPlayerId);
    setSharedGame(idle.sharedGame);
    setStartedAt(idle.startedAt);
    setMistakePenaltySecondsState(idle.mistakePenaltySeconds);
    setShowMistakesState(idle.showMistakes);
    setMockProgressByPlayerId(idle.mockProgressByPlayerId);
    setFrozenProgressByPlayerId(idle.frozenProgressByPlayerId);
    setFinishElapsedMsByPlayerId(idle.finishElapsedMsByPlayerId);
    setMockMistakesByPlayerId(idle.mockMistakesByPlayerId);
    setFrozenMistakesByPlayerId(idle.frozenMistakesByPlayerId);
  }, [send]);

  const startNewHostLobby = useCallback(() => {
    leaveRoom();
    send({ type: "host", displayName: "You" });
  }, [leaveRoom, send]);

  const leavePlayingGameAsDisconnected = useCallback(
    (lastCompletionPercent: number) => {
      send({ type: "leave_game", percent: lastCompletionPercent });
      saveSession(null);
      const idle = resetIdleState();
      setRoomCode(idle.roomCode);
      setPlayers(idle.players);
      setDifficultyState(idle.difficulty);
      setPhase(idle.phase);
      setIsHost(idle.isHost);
      setMyPlayerId(idle.myPlayerId);
      setSharedGame(idle.sharedGame);
      setStartedAt(idle.startedAt);
      setMistakePenaltySecondsState(idle.mistakePenaltySeconds);
      setShowMistakesState(idle.showMistakes);
      setMockProgressByPlayerId(idle.mockProgressByPlayerId);
      setFrozenProgressByPlayerId(idle.frozenProgressByPlayerId);
      setFinishElapsedMsByPlayerId(idle.finishElapsedMsByPlayerId);
      setMockMistakesByPlayerId(idle.mockMistakesByPlayerId);
      setFrozenMistakesByPlayerId(idle.frozenMistakesByPlayerId);
    },
    [send],
  );

  const resetMockProgress = useCallback(() => {}, []);

  const reportProgress = useCallback(
    (percent: number) => {
      send({ type: "progress", percent });
    },
    [send],
  );

  const reportFinish = useCallback(() => {
    send({ type: "finish" });
  }, [send]);

  const reportMistakes = useCallback(
    (count: number) => {
      send({ type: "mistakes", count });
    },
    [send],
  );

  const value = useMemo<MultiplayerContextValue>(
    () => ({
      hydrated,
      wsConnected,
      connectionError,
      roomCode,
      players,
      difficulty,
      phase,
      isHost,
      myPlayerId,
      sharedGame,
      startedAt,
      mistakePenaltySeconds,
      showMistakes,
      mockProgressByPlayerId,
      frozenProgressByPlayerId,
      finishElapsedMsByPlayerId,
      mockMistakesByPlayerId,
      frozenMistakesByPlayerId,
      hostRoom,
      joinRoom,
      setMyDisplayName,
      setDifficulty,
      setMistakePenaltySeconds,
      setShowMistakes,
      startGame,
      leaveRoom,
      startNewHostLobby,
      leavePlayingGameAsDisconnected,
      resetMockProgress,
      reportProgress,
      reportMistakes,
      reportFinish,
    }),
    [
      hydrated,
      wsConnected,
      connectionError,
      roomCode,
      players,
      difficulty,
      phase,
      isHost,
      myPlayerId,
      sharedGame,
      startedAt,
      mistakePenaltySeconds,
      showMistakes,
      mockProgressByPlayerId,
      frozenProgressByPlayerId,
      finishElapsedMsByPlayerId,
      mockMistakesByPlayerId,
      frozenMistakesByPlayerId,
      hostRoom,
      joinRoom,
      setMyDisplayName,
      setDifficulty,
      setMistakePenaltySeconds,
      setShowMistakes,
      startGame,
      leaveRoom,
      startNewHostLobby,
      leavePlayingGameAsDisconnected,
      resetMockProgress,
      reportProgress,
      reportMistakes,
      reportFinish,
    ],
  );

  return (
    <MultiplayerContext.Provider value={value}>{children}</MultiplayerContext.Provider>
  );
}

export function useMultiplayer(): MultiplayerContextValue {
  const ctx = useContext(MultiplayerContext);
  if (!ctx) throw new Error("useMultiplayer must be used within MultiplayerProvider");
  return ctx;
}
