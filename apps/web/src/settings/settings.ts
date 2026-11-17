import type { Locale, SessionContext } from "@bgc/schema";
import { createPersistentStore, type Store, useStore } from "./store";

export type Theme = "dark" | "light";
export type Level = "newbie" | "experienced";

export interface Settings {
  /** Undefined until the user picks a language on the welcome screen. */
  language?: Locale | undefined;
  theme: Theme;
  largeText: boolean;
}

export const settingsStore = createPersistentStore<Settings>("bgc:settings", {
  theme: "dark",
  largeText: false,
});

export const useSettings = (): Settings => useStore(settingsStore);

/** Language guess from the browser, used before the user chooses one. */
export function detectLanguage(): Locale {
  try {
    return globalThis.navigator?.language?.toLowerCase().startsWith("it") ? "it" : "en";
  } catch {
    return "en";
  }
}

/** Per-game preferences: experience level, session context and setup checklist ticks. */
export interface GamePrefs {
  level?: Level | undefined;
  session?: SessionContext | undefined;
  setupDone: string[];
  offline?: boolean | undefined;
}

const gameStores = new Map<string, Store<GamePrefs>>();

export function gamePrefsStore(gameId: string): Store<GamePrefs> {
  let store = gameStores.get(gameId);
  if (!store) {
    store = createPersistentStore<GamePrefs>(`bgc:game:${gameId}`, { setupDone: [] });
    gameStores.set(gameId, store);
  }
  return store;
}

export const useGamePrefs = (gameId: string): GamePrefs => useStore(gamePrefsStore(gameId));

/** Test helper: forget cached per-game stores (localStorage is cleared separately). */
export function resetGamePrefsCache(): void {
  gameStores.clear();
}
