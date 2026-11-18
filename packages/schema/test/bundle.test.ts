import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GameIndex, parseGuide } from "../src";
import { bundleAll, loadGameDir, writeGameDir } from "../src/node";
import { ARCHETYPES, clone, diceGame, sequentialGame } from "./fixtures/archetypes";

let tmp: string;
beforeEach(async () => {
  tmp = await mkdtemp(join(tmpdir(), "bgc-bundle-"));
});
afterEach(async () => {
  await rm(tmp, { recursive: true, force: true });
});

/** Writes a game folder including placeholder files for every scene image. */
async function writeGame(root: string, game = sequentialGame) {
  const dir = join(root, game.id);
  await writeGameDir(dir, game);
  await mkdir(join(dir, "images"), { recursive: true });
  for (const scene of game.scenes) await writeFile(join(dir, scene.image.src), "fake-image");
  return dir;
}

const sortModules = <T extends { modules: { id: string }[] }>(g: T) => ({
  ...g,
  modules: [...g.modules].sort((a, b) => a.id.localeCompare(b.id)),
});

describe("loadGameDir()", () => {
  it.each(Object.entries(ARCHETYPES))(
    "round-trips the %s archetype through split files",
    async (_, game) => {
      const dir = await writeGame(tmp, game);
      const r = await loadGameDir(dir);
      expect(r.issues.filter((i) => i.severity === "error")).toEqual([]);
      expect(sortModules(r.guide ?? { modules: [] })).toEqual(sortModules(game));
    },
  );

  it("migrates a v1 game folder (topics derived from rules.json)", async () => {
    const dir = await writeGame(tmp);
    const game = JSON.parse(await readFile(join(dir, "game.json"), "utf8"));
    delete game.topics;
    game.schemaVersion = 1;
    await writeFile(join(dir, "game.json"), JSON.stringify(game));
    const r = await loadGameDir(dir);
    expect(r.issues.filter((i) => i.severity === "error")).toEqual([]);
    expect(r.guide?.schemaVersion).toBe(3);
    expect(r.guide?.topics).toHaveLength(4);
  });

  it("rejects a game folder from a newer schema version", async () => {
    const dir = await writeGame(tmp);
    const game = JSON.parse(await readFile(join(dir, "game.json"), "utf8"));
    game.schemaVersion = 99;
    await writeFile(join(dir, "game.json"), JSON.stringify(game));
    const r = await loadGameDir(dir);
    expect(r.guide).toBeUndefined();
    expect(r.issues.map((i) => i.message).join()).toMatch(/newer than supported/);
  });

  it("reports a missing required file", async () => {
    const dir = await writeGame(tmp);
    await rm(join(dir, "rules.json"));
    const r = await loadGameDir(dir);
    expect(r.guide).toBeUndefined();
    expect(r.issues).toContainEqual({
      severity: "error",
      path: "rules.json",
      message: "file is missing",
    });
  });

  it("reports invalid JSON", async () => {
    const dir = await writeGame(tmp);
    await writeFile(join(dir, "flow.json"), "{ nope");
    const r = await loadGameDir(dir);
    expect(r.issues[0]?.path).toBe("flow.json");
    expect(r.issues[0]?.message).toMatch(/invalid JSON/);
  });

  it("prefixes schema errors with the file name", async () => {
    const dir = await writeGame(tmp);
    const rules = JSON.parse(await readFile(join(dir, "rules.json"), "utf8"));
    rules[0].summary.it = "";
    await writeFile(join(dir, "rules.json"), JSON.stringify(rules));
    const r = await loadGameDir(dir);
    expect(r.issues.map((i) => i.path)).toContain("rules.json › [0].summary.it");
  });

  it("validates module files individually", async () => {
    const dir = await writeGame(tmp, diceGame);
    const dice = JSON.parse(await readFile(join(dir, "modules/dice.json"), "utf8"));
    dice.dice[0].sides = 8;
    await writeFile(join(dir, "modules/dice.json"), JSON.stringify(dice));
    const r = await loadGameDir(dir);
    expect(r.issues.map((i) => i.path)).toContain("modules/dice.json › dice[0].faces");
  });

  it("requires the folder name to match the game id", async () => {
    await writeGameDir(join(tmp, "wrong-name"), clone(diceGame));
    const r = await loadGameDir(join(tmp, "wrong-name"));
    expect(r.issues.map((i) => i.message).join()).toMatch(/must match folder name/);
  });

  it("reports missing scene images", async () => {
    const dir = await writeGame(tmp);
    await rm(join(dir, "images/table.svg"));
    const r = await loadGameDir(dir);
    expect(r.issues).toContainEqual(
      expect.objectContaining({ path: "scenes[0].image.src", severity: "error" }),
    );
  });

  it("runs integrity checks on the merged guide", async () => {
    const g = clone(sequentialGame);
    g.rules[0]!.appliesTo = { flowNodes: ["nowhere"] };
    const dir = await writeGame(tmp, g);
    const r = await loadGameDir(dir);
    expect(r.issues.map((i) => i.message).join()).toMatch(/unknown flow node "nowhere"/);
  });
});

describe("bundleAll()", () => {
  it("writes bundles, images and an index when everything is valid", async () => {
    const content = join(tmp, "content");
    const out = join(tmp, "dist");
    await writeGame(content, sequentialGame);
    await writeGame(content, diceGame);

    const { results, index } = await bundleAll(content, out);
    expect(results).toHaveLength(2);
    expect(index?.games.map((g) => g.id)).toEqual(["dice-harbor", "tile-trek"]);

    const writtenIndex = GameIndex.parse(
      JSON.parse(await readFile(join(out, "index.json"), "utf8")),
    );
    expect(writtenIndex.games.find((g) => g.id === "tile-trek")).toMatchObject({
      bundle: "tile-trek/guide.json",
      cover: "tile-trek/images/table.svg",
    });
    expect(existsSync(join(out, "tile-trek/images/table.svg"))).toBe(true);

    const bundle = JSON.parse(await readFile(join(out, "tile-trek/guide.json"), "utf8"));
    expect(parseGuide(bundle).ok).toBe(true);
  });

  it("writes nothing when any game is invalid", async () => {
    const content = join(tmp, "content");
    const out = join(tmp, "dist");
    await writeGame(content, sequentialGame);
    const bad = await writeGame(content, diceGame);
    await rm(join(bad, "guides.json"));

    const { index } = await bundleAll(content, out);
    expect(index).toBeUndefined();
    expect(existsSync(out)).toBe(false);
  });

  it("ignores folders starting with _ or .", async () => {
    const content = join(tmp, "content");
    await writeGame(content, sequentialGame);
    await writeGameDir(join(content, "_draft"), clone(diceGame));
    const { results } = await bundleAll(content);
    expect(results).toHaveLength(1);
  });

  it("handles a missing content directory", async () => {
    const { results } = await bundleAll(join(tmp, "nope"));
    expect(results).toEqual([]);
  });
});
