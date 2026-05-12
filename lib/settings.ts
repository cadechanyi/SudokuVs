export type GameSettings = {
  showMistakes: boolean;
};

export const DEFAULT_SETTINGS: GameSettings = {
  showMistakes: true,
};

export const SETTINGS_STORAGE_KEY = "sudokuVs_settings";

function isGameSettings(v: unknown): v is GameSettings {
  return (
    typeof v === "object" &&
    v !== null &&
    "showMistakes" in v &&
    typeof (v as { showMistakes: unknown }).showMistakes === "boolean"
  );
}

function readFromStorage(): GameSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as unknown;
    if (!isGameSettings(parsed)) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

let cached: GameSettings | null = null;
let isHydrated = false;
const listeners = new Set<() => void>();

/** Subscriber for `useSyncExternalStore`. Triggers a one-time hydration from localStorage. */
export function subscribeSettings(onChange: () => void): () => void {
  listeners.add(onChange);
  if (!isHydrated) {
    cached = readFromStorage();
    isHydrated = true;
    // Notify the newly-subscribed listener so useSyncExternalStore re-reads the snapshot.
    onChange();
  }
  return () => {
    listeners.delete(onChange);
  };
}

/** Client snapshot. Returns defaults until the first `subscribeSettings` hydrates from storage. */
export function getSettingsSnapshot(): GameSettings {
  if (!isHydrated || !cached) return DEFAULT_SETTINGS;
  return cached;
}

/**
 * One-shot synchronous read direct from localStorage. Use for `useState` initializers
 * in components that must lock a setting at mount and never see later updates.
 * Safe to call only on the client (use the SSR snapshot during SSR).
 */
export function readSettingsOnce(): GameSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  if (!isHydrated) {
    cached = readFromStorage();
    isHydrated = true;
  }
  return cached ?? DEFAULT_SETTINGS;
}

/** Server snapshot — always defaults so SSR HTML matches initial client render. */
export function getSettingsServerSnapshot(): GameSettings {
  return DEFAULT_SETTINGS;
}

export function updateSettings(patch: Partial<GameSettings>): void {
  const current = cached ?? DEFAULT_SETTINGS;
  const next: GameSettings = { ...current, ...patch };
  cached = next;
  isHydrated = true;
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore quota / privacy errors
    }
  }
  for (const l of listeners) l();
}
