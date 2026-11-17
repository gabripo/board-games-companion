import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import type { GameGuide, GameIndex } from "@bgc/schema";
import { ARCHETYPES, clone, sequentialGame } from "@bgc/schema/testing";
import { afterAll, describe, expect, it } from "vitest";
import {
  type FetchFn,
  InMemoryGuideRepository,
  InProcessJobRunner,
  InvalidGuideError,
  MemoryBlobStore,
  type Stage,
  StaticGuideRepository,
} from "../src";
import { FsBlobStore } from "../src/node";
import { blobStoreContract, guideRepositoryContract } from "./contracts";

const fixtures = Object.values(ARCHETYPES).map(clone);
const tmpDirs: string[] = [];
const tmp = async () => {
  const d = await mkdtemp(join(tmpdir(), "bgc-ports-"));
  tmpDirs.push(d);
  return d;
};
afterAll(async () => {
  await Promise.all(tmpDirs.map((d) => rm(d, { recursive: true, force: true })));
});

/** Serves a map of path → JSON like a static CDN would. */
function fakeCdn(files: Record<string, unknown>, calls: string[] = []): FetchFn {
  return async (url) => {
    calls.push(url);
    const path = url.replace(/^https:\/\/cdn\.test\/games\//, "");
    const body = files[path];
    return {
      ok: body !== undefined,
      status: body === undefined ? 404 : 200,
      json: async () => body,
    };
  };
}

function cdnFiles(guides: GameGuide[]): Record<string, unknown> {
  const index: GameIndex = {
    generatedAt: new Date().toISOString(),
    games: guides.map((g) => ({
      id: g.id,
      schemaVersion: g.schemaVersion,
      title: g.meta.title,
      classification: g.classification,
      bundle: `${g.id}/guide.json`,
    })),
  };
  return {
    "index.json": index,
    ...Object.fromEntries(guides.map((g) => [`${g.id}/guide.json`, g])),
  };
}

guideRepositoryContract(
  "InMemoryGuideRepository",
  async (g) => new InMemoryGuideRepository(g),
  fixtures,
);
guideRepositoryContract(
  "StaticGuideRepository",
  async (g) => new StaticGuideRepository("https://cdn.test/games/", fakeCdn(cdnFiles(g))),
  fixtures,
);

blobStoreContract("MemoryBlobStore", async () => new MemoryBlobStore());
blobStoreContract("FsBlobStore", async () => new FsBlobStore(await tmp()));

describe("StaticGuideRepository specifics", () => {
  it("rejects a bundle that fails validation", async () => {
    const broken = clone(sequentialGame);
    const files = cdnFiles([broken]);
    (files[`${broken.id}/guide.json`] as GameGuide).rules[0]!.citations = [];
    const repo = new StaticGuideRepository("https://cdn.test/games", fakeCdn(files));
    await expect(repo.getGuide(broken.id)).rejects.toBeInstanceOf(InvalidGuideError);
  });

  it("caches the index but retries after a failure", async () => {
    const calls: string[] = [];
    const files = cdnFiles(fixtures);
    let fail = true;
    const cdn = fakeCdn(files, calls);
    const repo = new StaticGuideRepository("https://cdn.test/games", async (url) =>
      fail ? { ok: false, status: 503, json: async () => ({}) } : cdn(url),
    );
    await expect(repo.listGames()).rejects.toThrow(/503/);
    fail = false;
    await repo.listGames();
    await repo.listGames();
    expect(calls.filter((c) => c.endsWith("index.json"))).toHaveLength(1);
  });

  it("builds asset URLs relative to the base", () => {
    const repo = new StaticGuideRepository("https://cdn.test/games/", fakeCdn({}));
    expect(repo.assetUrl("tile-trek", "images/table.webp")).toBe(
      "https://cdn.test/games/tile-trek/images/table.webp",
    );
  });
});

describe("FsBlobStore specifics", () => {
  it("refuses keys that escape the root", async () => {
    const store = new FsBlobStore(await tmp());
    await expect(store.put("../evil", new Uint8Array([1]))).rejects.toThrow(/escapes/);
  });

  it("writes real files", async () => {
    const root = await tmp();
    const store = new FsBlobStore(root);
    await store.put("a/b.txt", new TextEncoder().encode("hi"));
    expect(await readFile(join(root, "a/b.txt"), "utf8")).toBe("hi");
    expect(relative(root, join(root, "a/b.txt"))).toBe("a/b.txt");
  });
});

describe("InProcessJobRunner", () => {
  it("runs a stage with injected deps", async () => {
    const stage: Stage<string, string, { prefix: string }> = {
      name: "greet",
      run: async (input, deps) => `${deps.prefix} ${input}`,
    };
    const runner = new InProcessJobRunner({ prefix: "hello" });
    expect(await runner.run(stage, "world")).toBe("hello world");
  });
});
