import { describe, expect, it } from "vitest";
import {
  checkIntegrity,
  GameGuide,
  MODULE_KINDS,
  MODULE_SCHEMAS,
  type Module,
  parseGuide,
  zodIssues,
} from "../src";
import {
  ARCHETYPES,
  clone,
  diceGame,
  sequentialGame,
  simultaneousGame,
} from "./fixtures/archetypes";

/** Parses a (mutated) guide and returns "path: message" strings for schema errors. */
function schemaErrors(raw: unknown): string[] {
  const r = GameGuide.safeParse(raw);
  return r.success ? [] : zodIssues(r.error).map((i) => `${i.path}: ${i.message}`);
}

/** Expects at least one schema error at exactly `path`. */
function expectErrorAt(raw: unknown, path: string, message?: RegExp) {
  const errors = schemaErrors(raw);
  const match = errors.find((e) => e.startsWith(`${path}: `));
  expect(match, `expected an error at "${path}", got:\n${errors.join("\n")}`).toBeDefined();
  if (message) expect(match).toMatch(message);
}

describe("archetype fixtures", () => {
  it.each(Object.entries(ARCHETYPES))("%s game parses and has no integrity errors", (_, game) => {
    expect(schemaErrors(game)).toEqual([]);
    const errors = checkIntegrity(game).filter((i) => i.severity === "error");
    expect(errors).toEqual([]);
  });

  it("covers every turn model", () => {
    const models = new Set(Object.values(ARCHETYPES).map((g) => g.classification.turnModel));
    expect(models).toEqual(new Set(["sequential", "simultaneous", "real-time", "phase-rounds"]));
  });

  it("covers every Phase 1 module kind", () => {
    const kinds = new Set(Object.values(ARCHETYPES).flatMap((g) => g.modules.map((m) => m.kind)));
    expect(kinds).toEqual(new Set(MODULE_KINDS));
  });

  it("parseGuide accepts a valid bundle", () => {
    const r = parseGuide(clone(sequentialGame));
    expect(r.ok).toBe(true);
  });
});

describe("module schemas", () => {
  const allModules: Module[] = Object.values(ARCHETYPES).flatMap((g) => g.modules);
  it.each(allModules.map((m) => [m.kind, m] as const))("%s module parses on its own", (kind, m) => {
    expect(MODULE_SCHEMAS[kind].safeParse(m).success).toBe(true);
  });

  it("rejects a die whose face count differs from `sides`", () => {
    const g = clone(diceGame);
    const dice = g.modules.find((m) => m.kind === "dice");
    if (dice?.kind !== "dice" || !dice.dice[0]) throw new Error("fixture");
    dice.dice[0].faces.pop();
    expectErrorAt(g, "modules[0].dice[0].faces", /number of faces must equal/);
  });

  it("rejects a deck whose composition does not add up", () => {
    const g = clone(simultaneousGame);
    const cards = g.modules[0];
    if (cards?.kind !== "cards" || !cards.decks[0]?.composition?.[0]) throw new Error("fixture");
    cards.decks[0].composition[0].count = 1;
    expectErrorAt(g, "modules[0].decks[0].composition", /add up/);
  });

  it("rejects an unknown module kind", () => {
    const g = clone(diceGame) as unknown as { modules: unknown[] };
    g.modules.push({ id: "weird", kind: "teleporter" });
    expectErrorAt(g, "modules[2].kind");
  });
});

describe("invalid content is rejected with a readable path", () => {
  it("missing Italian text", () => {
    const g = clone(sequentialGame) as unknown as { rules: { summary: { it?: string } }[] };
    delete g.rules[0]!.summary.it;
    expectErrorAt(g, "rules[0].summary.it");
  });

  it("blank Italian text", () => {
    const g = clone(sequentialGame);
    g.rules[0]!.summary.it = "   ";
    expectErrorAt(g, "rules[0].summary.it", /Italian text is required/);
  });

  it("hotspot coordinate outside 0–1", () => {
    const g = clone(sequentialGame);
    const shape = g.scenes[0]?.hotspots[0]?.shape;
    if (shape?.kind !== "rect") throw new Error("fixture");
    shape.rect.x = 1.2;
    expectErrorAt(g, "scenes[0].hotspots[0].shape.rect.x", /≤ 1/);
  });

  it("rect overflowing the image", () => {
    const g = clone(sequentialGame);
    const shape = g.scenes[0]?.hotspots[0]?.shape;
    if (shape?.kind !== "rect") throw new Error("fixture");
    shape.rect.w = 0.9;
    expectErrorAt(g, "scenes[0].hotspots[0].shape.rect", /inside the image/);
  });

  it("polygon with fewer than 3 points", () => {
    const g = clone(sequentialGame);
    const shape = g.scenes[0]?.hotspots[1]?.shape;
    if (shape?.kind !== "polygon") throw new Error("fixture");
    shape.points.pop();
    expectErrorAt(g, "scenes[0].hotspots[1].shape.points", /at least 3/);
  });

  it("clip that ends before it starts", () => {
    const g = clone(sequentialGame);
    const clip = g.rules[0]?.clips?.[0];
    if (!clip) throw new Error("fixture");
    clip.end = 10;
    expectErrorAt(g, "rules[0].clips[0].end", /after start/);
  });

  it("malformed YouTube id", () => {
    const g = clone(sequentialGame);
    const clip = g.rules[0]?.clips?.[0];
    if (!clip) throw new Error("fixture");
    clip.videoId = "bad id!";
    expectErrorAt(g, "rules[0].clips[0].videoId");
  });

  it("unknown citation kind", () => {
    const g = clone(sequentialGame) as unknown as { rules: { citations: unknown[] }[] };
    g.rules[0]!.citations[0] = { kind: "rumour", sourceId: "rulebook" };
    expectErrorAt(g, "rules[0].citations[0].kind");
  });

  it("rule without citations", () => {
    const g = clone(sequentialGame);
    g.rules[0]!.citations = [];
    expectErrorAt(g, "rules[0].citations", /at least one citation/);
  });

  it("non-kebab-case id", () => {
    const g = clone(sequentialGame);
    g.rules[0]!.id = "Place_Tile";
    expectErrorAt(g, "rules[0].id", /kebab-case/);
  });

  it("unknown keys (typos) are rejected", () => {
    const g = clone(sequentialGame) as unknown as { rules: Record<string, unknown>[] };
    g.rules[0]!.sumary = { en: "x", it: "x" };
    expectErrorAt(g, "rules[0]", /sumary/);
  });

  it("best player count outside the range", () => {
    const g = clone(sequentialGame);
    g.classification.playerCount.best = [6];
    expectErrorAt(g, "classification.playerCount.best[0]", /outside/);
  });

  it("wrong schemaVersion", () => {
    const g = { ...clone(sequentialGame), schemaVersion: 0 };
    expectErrorAt(g, "schemaVersion");
  });
});

describe("flow graph schema", () => {
  it("choice pick.max cannot exceed the options", () => {
    const g = clone(sequentialGame);
    const turn = g.flow.kind === "sequence" ? g.flow.children[0] : undefined;
    const turnOrder = turn?.kind === "repeat" ? turn.children[0] : undefined;
    const choice = turnOrder?.kind === "turnOrder" ? turnOrder.children[2] : undefined;
    if (choice?.kind !== "choice") throw new Error("fixture");
    choice.pick.max = 3;
    expectErrorAt(g, "flow.children[0].children[0].children[2].pick.max", /exceeds/);
  });

  it("repeat requires `until`", () => {
    const g = clone(simultaneousGame) as unknown as { flow: { until?: unknown } };
    delete g.flow.until;
    expectErrorAt(g, "flow.until");
  });

  it("container nodes need at least one child", () => {
    const g = clone(simultaneousGame);
    if (g.flow.kind !== "repeat") throw new Error("fixture");
    g.flow.children = [];
    expectErrorAt(g, "flow.children", /at least one child/);
  });

  it("roll outcome needs sum or faces", () => {
    const g = clone(diceGame);
    const roll = g.flow.kind === "turnOrder" ? g.flow.children[0] : undefined;
    if (roll?.kind !== "roll" || !roll.outcomes[1]) throw new Error("fixture");
    delete roll.outcomes[1].faces;
    expectErrorAt(g, "flow.children[0].outcomes[1]", /`sum` or `faces`/);
  });

  it("unknown node kind", () => {
    const g = clone(diceGame) as unknown as { flow: { children: unknown[] } };
    g.flow.children.push({ id: "x", kind: "teleport", title: { en: "x", it: "x" } });
    expectErrorAt(g, "flow.children[1].kind");
  });
});
