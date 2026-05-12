import type { Difficulty, NewGame } from "@/lib/sudoku/types";

/** Wire shape for `RoomPlayer` (matches client context). */
export type WireRoomPlayer = {
  id: string;
  name: string;
  isHost: boolean;
  connected?: boolean;
};

export type WireRoom = {
  roomCode: string;
  players: WireRoomPlayer[];
  difficulty: Difficulty;
  /** Seconds added to clock per mistake; default 0 if omitted (older servers). */
  mistakePenaltySeconds?: number;
  /** Host-controlled: whether wrong placements / mistake counts are revealed to players. */
  showMistakes?: boolean;
  phase: "lobby" | "playing";
  sharedGame: NewGame | null;
  startedAt: number | null;
  frozenProgressByPlayerId?: Record<string, number>;
  progressByPlayerId?: Record<string, number>;
  /** Elapsed ms from room `startedAt` when each player finished (server clock). */
  finishElapsedMsByPlayerId?: Record<string, number>;
  mistakesByPlayerId?: Record<string, number>;
  frozenMistakesByPlayerId?: Record<string, number>;
};

export type ClientToServerMessage =
  | { type: "host"; displayName?: string }
  /** Same as `host`; used after leaving a room to start fresh. */
  | { type: "host_new"; displayName?: string }
  | { type: "join"; roomCode: string; displayName?: string }
  | { type: "rejoin"; playerId: string; roomCode: string }
  | { type: "set_name"; name: string }
  | { type: "set_difficulty"; difficulty: Difficulty }
  | { type: "set_mistake_penalty"; seconds: number }
  | { type: "set_show_mistakes"; show: boolean }
  | { type: "start_game" }
  | { type: "leave" }
  | { type: "leave_game"; percent: number }
  | { type: "progress"; percent: number }
  | { type: "mistakes"; count: number }
  | { type: "finish" };

export type ServerToClientMessage =
  | { type: "snapshot"; room: WireRoom; self: { playerId: string; isHost: boolean } }
  | { type: "join_result"; ok: boolean; reason?: string }
  | { type: "rejoin_result"; ok: boolean; reason?: string }
  | { type: "error"; message: string };

export function isDifficulty(x: unknown): x is Difficulty {
  return x === "easy" || x === "medium" || x === "hard";
}
