/**
 * Standalone WebSocket server for SudokuVs multiplayer rooms.
 * Run: `npm run dev:ws` (see package.json). Default port 3847.
 */
import { randomUUID } from "node:crypto";
import { WebSocketServer, WebSocket } from "ws";
import { createNewGame } from "../lib/sudoku/generator";
import type { Difficulty, NewGame } from "../lib/sudoku/types";
import type { ClientToServerMessage, WireRoom } from "../lib/realtime/protocol";

type Phase = "lobby" | "playing";

type RoomPlayer = {
  id: string;
  name: string;
  isHost: boolean;
  connected: boolean;
};

type RoomState = {
  roomCode: string;
  players: RoomPlayer[];
  difficulty: Difficulty;
  /** Seconds added to displayed / finish time per mistake. */
  mistakePenaltySeconds: number;
  /** Host-controlled: when false, wrong cells aren't highlighted and mistake counters render as "--". */
  showMistakes: boolean;
  phase: Phase;
  sharedGame: NewGame | null;
  startedAt: number | null;
  frozenProgressByPlayerId: Record<string, number>;
  progressByPlayerId: Record<string, number>;
  finishElapsedMsByPlayerId: Record<string, number>;
  mistakesByPlayerId: Record<string, number>;
  frozenMistakesByPlayerId: Record<string, number>;
};

type RoomRuntime = {
  state: RoomState;
  playerSockets: Map<string, WebSocket>;
  broadcastTimer?: ReturnType<typeof setTimeout>;
};

const roomRuntimes = new Map<string, RoomRuntime>();
const socketMeta = new Map<WebSocket, { playerId: string; roomCode: string }>();

const PORT = Number(process.env.REALTIME_PORT ?? "3847");

function clampPercent(n: number): number {
  return Math.min(100, Math.max(0, Math.round(n)));
}

function clampMistakes(n: number): number {
  return Math.min(999, Math.max(0, Math.round(n)));
}

function clampPenaltySeconds(n: number): number {
  return Math.min(600, Math.max(0, Math.round(n)));
}

function randomRoomCode(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

function allocateRoomCode(): string {
  for (let i = 0; i < 80; i++) {
    const c = randomRoomCode();
    if (!roomRuntimes.has(c)) return c;
  }
  return randomUUID().replace(/\D/g, "").slice(0, 4);
}

function serializeRoom(state: RoomState): WireRoom {
  return {
    roomCode: state.roomCode,
    players: state.players.map((p) => ({
      id: p.id,
      name: p.name,
      isHost: p.isHost,
      connected: p.connected,
    })),
    difficulty: state.difficulty,
    mistakePenaltySeconds: state.mistakePenaltySeconds,
    showMistakes: state.showMistakes,
    phase: state.phase,
    sharedGame: state.sharedGame,
    startedAt: state.startedAt,
    frozenProgressByPlayerId: { ...state.frozenProgressByPlayerId },
    progressByPlayerId: { ...state.progressByPlayerId },
    finishElapsedMsByPlayerId: { ...state.finishElapsedMsByPlayerId },
    mistakesByPlayerId: { ...state.mistakesByPlayerId },
    frozenMistakesByPlayerId: { ...state.frozenMistakesByPlayerId },
  };
}

function broadcastSnapshot(rt: RoomRuntime) {
  const wire = serializeRoom(rt.state);
  for (const p of rt.state.players) {
    const ws = rt.playerSockets.get(p.id);
    if (!ws || ws.readyState !== WebSocket.OPEN) continue;
    ws.send(
      JSON.stringify({
        type: "snapshot",
        room: wire,
        self: { playerId: p.id, isHost: p.isHost },
      }),
    );
  }
}

function scheduleBroadcast(rt: RoomRuntime) {
  if (rt.broadcastTimer) return;
  rt.broadcastTimer = setTimeout(() => {
    rt.broadcastTimer = undefined;
    broadcastSnapshot(rt);
  }, 120);
}

function getRuntime(roomCode: string): RoomRuntime | undefined {
  return roomRuntimes.get(roomCode);
}

function removePlayerFromLobby(rt: RoomRuntime, playerId: string) {
  const { state } = rt;
  const idx = state.players.findIndex((p) => p.id === playerId);
  if (idx === -1) return;
  const wasHost = state.players[idx].isHost;
  state.players.splice(idx, 1);
  rt.playerSockets.delete(playerId);
  if (state.players.length === 0) {
    roomRuntimes.delete(state.roomCode);
    return;
  }
  if (wasHost && !state.players.some((p) => p.isHost)) {
    state.players[0].isHost = true;
  }
}

function detachSocket(ws: WebSocket, opts: { playingLeavePercent?: number } = {}) {
  const meta = socketMeta.get(ws);
  if (!meta) return;
  socketMeta.delete(ws);
  const rt = getRuntime(meta.roomCode);
  if (!rt) return;

  const idx = rt.state.players.findIndex((p) => p.id === meta.playerId);
  if (idx === -1) {
    rt.playerSockets.delete(meta.playerId);
    return;
  }

  rt.playerSockets.delete(meta.playerId);

  if (rt.state.phase === "lobby") {
    removePlayerFromLobby(rt, meta.playerId);
    if (getRuntime(meta.roomCode)) broadcastSnapshot(rt);
    return;
  }

  // playing: mark disconnected (socket gone or explicit leave_game)
  const p = rt.state.players[idx];
  p.connected = false;
  const pct =
    opts.playingLeavePercent !== undefined
      ? clampPercent(opts.playingLeavePercent)
      : clampPercent(rt.state.progressByPlayerId[meta.playerId] ?? 0);
  rt.state.frozenProgressByPlayerId[meta.playerId] = pct;
  rt.state.frozenMistakesByPlayerId[meta.playerId] =
    rt.state.mistakesByPlayerId[meta.playerId] ?? 0;
  broadcastSnapshot(rt);
}

function safeParse(raw: unknown): ClientToServerMessage | null {
  if (typeof raw !== "string") return null;
  try {
    const o = JSON.parse(raw) as Record<string, unknown>;
    if (!o || typeof o.type !== "string") return null;
    return o as ClientToServerMessage;
  } catch {
    return null;
  }
}

function sendError(ws: WebSocket, message: string) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: "error", message }));
  }
}

function handleHost(ws: WebSocket, displayName?: string) {
  detachSocket(ws);
  const roomCode = allocateRoomCode();
  const playerId = randomUUID();
  const name = (displayName ?? "You").trim() || "You";
  const state: RoomState = {
    roomCode,
    players: [{ id: playerId, name, isHost: true, connected: true }],
    difficulty: "medium",
    mistakePenaltySeconds: 0,
    showMistakes: true,
    phase: "lobby",
    sharedGame: null,
    startedAt: null,
    frozenProgressByPlayerId: {},
    progressByPlayerId: {},
    finishElapsedMsByPlayerId: {},
    mistakesByPlayerId: {},
    frozenMistakesByPlayerId: {},
  };
  const rt: RoomRuntime = { state, playerSockets: new Map([[playerId, ws]]) };
  roomRuntimes.set(roomCode, rt);
  socketMeta.set(ws, { playerId, roomCode });
  broadcastSnapshot(rt);
}

function handleJoin(ws: WebSocket, roomCode: string, displayName?: string) {
  detachSocket(ws);
  const normalized = roomCode.replace(/\D/g, "").slice(0, 4);
  if (normalized.length !== 4) {
    ws.send(JSON.stringify({ type: "join_result", ok: false, reason: "Enter a 4-digit room code." }));
    return;
  }
  const rt = getRuntime(normalized);
  if (!rt) {
    ws.send(JSON.stringify({ type: "join_result", ok: false, reason: "No room found for that code." }));
    return;
  }
  if (rt.state.phase !== "lobby") {
    ws.send(JSON.stringify({ type: "join_result", ok: false, reason: "That game has already started." }));
    return;
  }
  if (rt.state.players.length >= 4) {
    ws.send(JSON.stringify({ type: "join_result", ok: false, reason: "Room is full (4 players max)." }));
    return;
  }
  const playerId = randomUUID();
  const name = (displayName ?? "Player").trim() || "Player";
  rt.state.players.push({ id: playerId, name, isHost: false, connected: true });
  rt.playerSockets.set(playerId, ws);
  socketMeta.set(ws, { playerId, roomCode: normalized });
  ws.send(JSON.stringify({ type: "join_result", ok: true }));
  broadcastSnapshot(rt);
}

function handleRejoin(ws: WebSocket, playerId: string, roomCode: string) {
  const normalized = roomCode.replace(/\D/g, "").slice(0, 4);
  const rt = getRuntime(normalized);
  if (!rt || !playerId) {
    ws.send(JSON.stringify({ type: "rejoin_result", ok: false, reason: "Session expired." }));
    return;
  }
  const p = rt.state.players.find((x) => x.id === playerId);
  if (!p) {
    ws.send(JSON.stringify({ type: "rejoin_result", ok: false, reason: "Session expired." }));
    return;
  }

  detachSocket(ws);

  const oldWs = rt.playerSockets.get(playerId);
  if (oldWs && oldWs !== ws) {
    socketMeta.delete(oldWs);
    oldWs.removeAllListeners("close");
    oldWs.removeAllListeners("message");
    try {
      oldWs.close();
    } catch {
      /* ignore */
    }
  }

  rt.playerSockets.set(playerId, ws);
  socketMeta.set(ws, { playerId, roomCode: normalized });
  p.connected = true;
  ws.send(JSON.stringify({ type: "rejoin_result", ok: true }));
  broadcastSnapshot(rt);
}

function handleSetName(ws: WebSocket, name: string) {
  const meta = socketMeta.get(ws);
  if (!meta) return;
  const rt = getRuntime(meta.roomCode);
  if (!rt) return;
  const p = rt.state.players.find((x) => x.id === meta.playerId);
  if (!p) return;
  p.name = name.trim() || "Player";
  broadcastSnapshot(rt);
}

function handleSetDifficulty(ws: WebSocket, difficulty: Difficulty) {
  const meta = socketMeta.get(ws);
  if (!meta) return;
  const rt = getRuntime(meta.roomCode);
  if (!rt) return;
  const p = rt.state.players.find((x) => x.id === meta.playerId);
  if (!p?.isHost || rt.state.phase !== "lobby") return;
  rt.state.difficulty = difficulty;
  broadcastSnapshot(rt);
}

function handleSetMistakePenalty(ws: WebSocket, seconds: number) {
  const meta = socketMeta.get(ws);
  if (!meta) return;
  const rt = getRuntime(meta.roomCode);
  if (!rt) return;
  const p = rt.state.players.find((x) => x.id === meta.playerId);
  if (!p?.isHost || rt.state.phase !== "lobby") return;
  rt.state.mistakePenaltySeconds = clampPenaltySeconds(seconds);
  broadcastSnapshot(rt);
}

function handleSetShowMistakes(ws: WebSocket, show: boolean) {
  const meta = socketMeta.get(ws);
  if (!meta) return;
  const rt = getRuntime(meta.roomCode);
  if (!rt) return;
  const p = rt.state.players.find((x) => x.id === meta.playerId);
  if (!p?.isHost || rt.state.phase !== "lobby") return;
  rt.state.showMistakes = Boolean(show);
  broadcastSnapshot(rt);
}

function handleStartGame(ws: WebSocket) {
  const meta = socketMeta.get(ws);
  if (!meta) return;
  const rt = getRuntime(meta.roomCode);
  if (!rt) return;
  const p = rt.state.players.find((x) => x.id === meta.playerId);
  if (!p?.isHost || rt.state.phase !== "lobby") return;
  const game = createNewGame(rt.state.difficulty);
  const started = Date.now();
  rt.state.phase = "playing";
  rt.state.sharedGame = game;
  rt.state.startedAt = started;
  rt.state.frozenProgressByPlayerId = {};
  rt.state.finishElapsedMsByPlayerId = {};
  rt.state.mistakesByPlayerId = {};
  rt.state.frozenMistakesByPlayerId = {};
  for (const pl of rt.state.players) {
    pl.connected = true;
    rt.state.progressByPlayerId[pl.id] = 0;
    rt.state.mistakesByPlayerId[pl.id] = 0;
  }
  broadcastSnapshot(rt);
}

function handleLeave(ws: WebSocket) {
  detachSocket(ws);
}

function handleLeaveGame(ws: WebSocket, percent: number) {
  const meta = socketMeta.get(ws);
  if (!meta) return;
  const rt = getRuntime(meta.roomCode);
  if (!rt || rt.state.phase !== "playing") {
    detachSocket(ws);
    return;
  }
  detachSocket(ws, { playingLeavePercent: percent });
}

function handleProgress(ws: WebSocket, percent: number) {
  const meta = socketMeta.get(ws);
  if (!meta) return;
  const rt = getRuntime(meta.roomCode);
  if (!rt || rt.state.phase !== "playing") return;
  const pl = rt.state.players.find((x) => x.id === meta.playerId);
  if (!pl?.connected) return;
  rt.state.progressByPlayerId[meta.playerId] = clampPercent(percent);
  scheduleBroadcast(rt);
}

function handleMistakes(ws: WebSocket, count: number) {
  const meta = socketMeta.get(ws);
  if (!meta) return;
  const rt = getRuntime(meta.roomCode);
  if (!rt || rt.state.phase !== "playing") return;
  const pl = rt.state.players.find((x) => x.id === meta.playerId);
  if (!pl?.connected) return;
  rt.state.mistakesByPlayerId[meta.playerId] = clampMistakes(count);
  scheduleBroadcast(rt);
}

function handleFinish(ws: WebSocket) {
  const meta = socketMeta.get(ws);
  if (!meta) return;
  const rt = getRuntime(meta.roomCode);
  if (!rt || rt.state.phase !== "playing") return;
  const pl = rt.state.players.find((x) => x.id === meta.playerId);
  if (!pl?.connected) return;
  const started = rt.state.startedAt;
  if (started == null) return;
  if (rt.state.finishElapsedMsByPlayerId[meta.playerId] !== undefined) return;
  const raw = Math.max(0, Date.now() - started);
  const mistakes = rt.state.mistakesByPlayerId[meta.playerId] ?? 0;
  const pen = rt.state.mistakePenaltySeconds;
  rt.state.finishElapsedMsByPlayerId[meta.playerId] = raw + mistakes * pen * 1000;
  broadcastSnapshot(rt);
}

function onMessage(ws: WebSocket, raw: unknown) {
  const msg = safeParse(raw as string);
  if (!msg) {
    sendError(ws, "Invalid message");
    return;
  }
  switch (msg.type) {
    case "host":
    case "host_new":
      handleHost(ws, msg.displayName);
      break;
    case "join":
      handleJoin(ws, msg.roomCode, msg.displayName);
      break;
    case "rejoin":
      handleRejoin(ws, msg.playerId, msg.roomCode);
      break;
    case "set_name":
      handleSetName(ws, msg.name);
      break;
    case "set_difficulty":
      handleSetDifficulty(ws, msg.difficulty);
      break;
    case "set_mistake_penalty":
      handleSetMistakePenalty(ws, msg.seconds);
      break;
    case "set_show_mistakes":
      handleSetShowMistakes(ws, msg.show);
      break;
    case "start_game":
      handleStartGame(ws);
      break;
    case "leave":
      handleLeave(ws);
      break;
    case "leave_game":
      handleLeaveGame(ws, msg.percent);
      break;
    case "progress":
      handleProgress(ws, msg.percent);
      break;
    case "mistakes":
      handleMistakes(ws, msg.count);
      break;
    case "finish":
      handleFinish(ws);
      break;
    default:
      sendError(ws, "Unknown message type");
  }
}

const wss = new WebSocketServer({ port: PORT, host: "0.0.0.0" });

wss.on("connection", (ws) => {
  ws.on("message", (data) => {
    onMessage(ws, data.toString());
  });
  ws.on("close", () => {
    detachSocket(ws);
  });
});

// eslint-disable-next-line no-console -- dev server
console.log(`[realtime] WebSocket listening on ws://0.0.0.0:${PORT}`);
