/**
 * Contract test suites. Every adapter (current static/fs ones and future
 * Supabase/API/R2 ones) must pass these, which is what makes switching architectures safe.
 */
import type { GameGuide } from "@bgc/schema";
import { describe, expect, it } from "vitest";
import { type BlobStore, GuideNotFoundError, type GuideRepository } from "../src";

export function guideRepositoryContract(
  name: string,
  setup: (guides: GameGuide[]) => Promise<GuideRepository>,
  fixtures: GameGuide[],
): void {
  describe(`GuideRepository contract: ${name}`, () => {
    it("lists every game with its summary", async () => {
      const repo = await setup(fixtures);
      const games = await repo.listGames();
      expect(games.map((g) => g.id).sort()).toEqual(fixtures.map((g) => g.id).sort());
      for (const g of fixtures) {
        expect(games.find((s) => s.id === g.id)).toMatchObject({
          title: g.meta.title,
          schemaVersion: g.schemaVersion,
          classification: g.classification,
        });
      }
    });

    it("returns the full guide by id", async () => {
      const repo = await setup(fixtures);
      for (const g of fixtures) expect(await repo.getGuide(g.id)).toEqual(g);
    });

    it("rejects unknown ids with GuideNotFoundError", async () => {
      const repo = await setup(fixtures);
      await expect(repo.getGuide("does-not-exist")).rejects.toBeInstanceOf(GuideNotFoundError);
    });

    it("returns copies that callers cannot corrupt", async () => {
      const repo = await setup(fixtures);
      const id = fixtures[0]?.id ?? "";
      const a = await repo.getGuide(id);
      a.rules.length = 0;
      expect((await repo.getGuide(id)).rules.length).toBeGreaterThan(0);
    });

    it("resolves asset URLs per game", async () => {
      const repo = await setup(fixtures);
      const url = repo.assetUrl("some-game", "images/board.webp");
      expect(url).toContain("some-game");
      expect(url.endsWith("images/board.webp")).toBe(true);
    });

    it("works with an empty catalog", async () => {
      const repo = await setup([]);
      expect(await repo.listGames()).toEqual([]);
    });
  });
}

export function blobStoreContract(name: string, setup: () => Promise<BlobStore>): void {
  describe(`BlobStore contract: ${name}`, () => {
    const bytes = (s: string) => new TextEncoder().encode(s);

    it("stores and retrieves bytes", async () => {
      const store = await setup();
      await store.put("games/a/board.webp", bytes("hello"));
      expect(await store.get("games/a/board.webp")).toEqual(bytes("hello"));
    });

    it("returns undefined for missing keys", async () => {
      const store = await setup();
      expect(await store.get("missing")).toBeUndefined();
    });

    it("overwrites, deletes and lists by prefix", async () => {
      const store = await setup();
      await store.put("games/a/1.webp", bytes("1"));
      await store.put("games/a/2.webp", bytes("2"));
      await store.put("games/b/1.webp", bytes("3"));
      await store.put("games/a/1.webp", bytes("updated"));
      expect(await store.get("games/a/1.webp")).toEqual(bytes("updated"));
      expect(await store.list("games/a/")).toEqual(["games/a/1.webp", "games/a/2.webp"]);
      await store.delete("games/a/1.webp");
      expect(await store.list("games/")).toEqual(["games/a/2.webp", "games/b/1.webp"]);
      await store.delete("never-existed"); // no throw
    });

    it("is not affected by mutating the input buffer", async () => {
      const store = await setup();
      const data = bytes("abc");
      await store.put("k", data);
      data[0] = 0;
      expect(await store.get("k")).toEqual(bytes("abc"));
    });
  });
}
