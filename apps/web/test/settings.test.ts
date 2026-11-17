import { describe, expect, it } from "vitest";
import { createPersistentStore, readJson, writeJson } from "../src/settings/store";

const throwingStorage = {
  getItem: () => {
    throw new Error("SecurityError");
  },
  setItem: () => {
    throw new Error("QuotaExceededError");
  },
};

describe("persistent store", () => {
  it("round-trips through storage", () => {
    const store = createPersistentStore("t:1", { a: 1, b: "x" });
    store.set({ a: 2 });
    expect(createPersistentStore("t:1", { a: 1, b: "x" }).get()).toEqual({ a: 2, b: "x" });
  });

  it("keeps working when storage throws", () => {
    expect(readJson("k", { v: 1 }, throwingStorage)).toEqual({ v: 1 });
    expect(() => writeJson("k", { v: 2 }, throwingStorage)).not.toThrow();
    const store = createPersistentStore("k", { v: 1 }, throwingStorage);
    store.set({ v: 3 });
    expect(store.get()).toEqual({ v: 3 });
  });

  it("ignores corrupt JSON", () => {
    localStorage.setItem("t:bad", "{nope");
    expect(readJson("t:bad", { ok: true })).toEqual({ ok: true });
  });

  it("notifies subscribers", () => {
    const store = createPersistentStore("t:sub", { n: 0 });
    let calls = 0;
    const unsub = store.subscribe(() => calls++);
    store.set((s) => ({ n: s.n + 1 }));
    unsub();
    store.set({ n: 5 });
    expect(calls).toBe(1);
  });
});
