import { useSyncExternalStore } from "react";

/**
 * Tiny persistent store over localStorage. Every access is wrapped in try/catch so the app
 * works in private windows, with blocked storage or when the quota is exceeded.
 */

type StorageLike = Pick<Storage, "getItem" | "setItem">;

function defaultStorage(): StorageLike | undefined {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}

export function readJson<T>(key: string, fallback: T, storage = defaultStorage()): T {
  try {
    const raw = storage?.getItem(key);
    return raw ? { ...fallback, ...(JSON.parse(raw) as T) } : fallback;
  } catch {
    return fallback;
  }
}

export function writeJson(key: string, value: unknown, storage = defaultStorage()): void {
  try {
    storage?.setItem(key, JSON.stringify(value));
  } catch {
    // storage unavailable or full: keep the in-memory value only
  }
}

export interface Store<T> {
  get(): T;
  set(update: Partial<T> | ((prev: T) => T)): void;
  subscribe(listener: () => void): () => void;
}

export function createPersistentStore<T extends object>(
  key: string,
  initial: T,
  storage?: StorageLike,
): Store<T> {
  let state = readJson(key, initial, storage ?? defaultStorage());
  const listeners = new Set<() => void>();
  return {
    get: () => state,
    set(update) {
      state = typeof update === "function" ? update(state) : { ...state, ...update };
      writeJson(key, state, storage ?? defaultStorage());
      for (const l of listeners) l();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export function useStore<T>(store: Store<T>): T {
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}
