import { describe, expect, it } from "vitest";
import { checkIntegrity, type GameGuide, parseGuide } from "../src";
import { clone, diceGame, L, sequentialGame } from "./fixtures/archetypes";

const errorsOf = (g: GameGuide) =>
  checkIntegrity(g)
    .filter((i) => i.severity === "error")
    .map((i) => `${i.path}: ${i.message}`);
const warningsOf = (g: GameGuide) =>
  checkIntegrity(g)
    .filter((i) => i.severity === "warning")
    .map((i) => `${i.path}: ${i.message}`);

function expectError(g: GameGuide, path: string, message: RegExp) {
  const errors = errorsOf(g);
  const match = errors.find((e) => e.startsWith(`${path}: `));
  expect(match, `expected error at "${path}", got:\n${errors.join("\n")}`).toBeDefined();
  expect(match).toMatch(message);
}

/** Navigates the sequential fixture to the turnOrder node. */
function turnNode(g: GameGuide) {
  const repeat = g.flow.kind === "sequence" ? g.flow.children[0] : undefined;
  const turn = repeat?.kind === "repeat" ? repeat.children[0] : undefined;
  if (turn?.kind !== "turnOrder") throw new Error("fixture");
  return turn;
}

describe("reference resolution", () => {
  it("dangling ruleRef in the flow graph", () => {
    const g = clone(sequentialGame);
    turnNode(g).children[0]!.ruleRefs = ["no-such-rule"];
    expectError(
      g,
      "flow.children[0].children[0].children[0].ruleRefs[0]",
      /unknown rule "no-such-rule"/,
    );
  });

  it("dangling ruleRef in a hotspot", () => {
    const g = clone(sequentialGame);
    g.scenes[0]!.hotspots[0]!.ruleRefs = ["ghost"];
    expectError(g, "scenes[0].hotspots[0].ruleRefs[0]", /unknown rule/);
  });

  it("citation to an unknown source", () => {
    const g = clone(sequentialGame);
    g.rules[1]!.citations = [{ kind: "page", sourceId: "nope", page: 1 }];
    expectError(g, "rules[1].citations[0].sourceId", /unknown source "nope"/);
  });

  it("citation kind must match the source type", () => {
    const g = clone(sequentialGame);
    g.rules[1]!.citations = [{ kind: "time", sourceId: "rulebook", tStart: 1, tEnd: 2 }];
    expectError(g, "rules[1].citations[0]", /must point at a video source/);
  });

  it("appliesTo must resolve flow nodes, components and modules", () => {
    const g = clone(sequentialGame);
    g.rules[0]!.appliesTo = { flowNodes: ["x"], components: ["y"], modules: ["z"] };
    const errors = errorsOf(g).join("\n");
    expect(errors).toMatch(/appliesTo\.flowNodes\[0\]: unknown flow node "x"/);
    expect(errors).toMatch(/appliesTo\.components\[0\]: unknown component "y"/);
    expect(errors).toMatch(/appliesTo\.modules\[0\]: unknown module "z"/);
  });

  it("scene and hotspot refs", () => {
    const g = clone(sequentialGame);
    g.setup.steps[0]!.sceneRef = { sceneId: "table", hotspotId: "nowhere" };
    g.components[2]!.sceneRefs = [{ sceneId: "attic" }];
    expectError(
      g,
      "setup.steps[0].sceneRef.hotspotId",
      /unknown hotspot "nowhere" in scene "table"/,
    );
    expectError(g, "components[2].sceneRefs[0].sceneId", /unknown scene "attic"/);
  });

  it("setup area and component refs", () => {
    const g = clone(sequentialGame);
    g.setup.steps[0]!.areaId = "garage";
    g.setup.steps[0]!.components = ["spaceship"];
    expectError(g, "setup.steps[0].areaId", /unknown setup area/);
    expectError(g, "setup.steps[0].components[0]", /unknown component/);
  });
});

describe("ids", () => {
  it("duplicate rule ids", () => {
    const g = clone(sequentialGame);
    g.rules[1]!.id = "place-tile";
    expectError(g, "rules[1].id", /duplicate rule id "place-tile"/);
  });

  it("duplicate flow node ids across nesting levels report the real path", () => {
    const g = clone(sequentialGame);
    turnNode(g).children[1]!.id = "game";
    expectError(g, "flow.children[0].children[0].children[1].id", /duplicate flow node id "game"/);
  });

  it("duplicate hotspot ids within a scene", () => {
    const g = clone(sequentialGame);
    g.scenes[0]!.hotspots[1]!.id = "map";
    expectError(g, "scenes[0].hotspots[1].id", /duplicate hotspot id/);
  });
});

describe("conditions", () => {
  it("player count outside the game's range", () => {
    const g = clone(sequentialGame);
    g.rules[2]!.conditions = { playerCount: [9] };
    expectError(g, "rules[2].conditions.playerCount[0]", /outside the game's 2–5/);
  });

  it("unknown variant or expansion", () => {
    const g = clone(sequentialGame);
    g.rules[2]!.conditions = { variants: ["solo"], expansions: ["lake"] };
    expectError(g, "rules[2].conditions.variants[0]", /unknown variant "solo"/);
    expectError(g, "rules[2].conditions.expansions[0]", /unknown expansion "lake"/);
  });
});

describe("walkthroughs", () => {
  it("hotspot, annotation and check refs must exist in the step's scene", () => {
    const g = clone(sequentialGame);
    const step = g.walkthroughs[0]!.steps[1]!;
    step.highlightHotspots = ["ghost"];
    step.annotations = ["ghost-arrow"];
    step.check!.answerHotspotId = "ghost";
    const p = "walkthroughs[0].steps[1]";
    expectError(g, `${p}.highlightHotspots[0]`, /unknown hotspot "ghost"/);
    expectError(g, `${p}.annotations[0]`, /unknown annotation "ghost-arrow"/);
    expectError(g, `${p}.check.answerHotspotId`, /unknown hotspot/);
  });

  it("a step using scene features needs a sceneId", () => {
    const g = clone(sequentialGame);
    delete g.walkthroughs[0]!.steps[1]!.sceneId;
    expectError(g, "walkthroughs[0].steps[1]", /has no sceneId/);
  });

  it("flowNodeRef must exist", () => {
    const g = clone(sequentialGame);
    g.walkthroughs[0]!.steps[0]!.flowNodeRef = "nap";
    expectError(g, "walkthroughs[0].steps[0].flowNodeRef", /unknown flow node "nap"/);
  });
});

describe("dice and modules", () => {
  const rollNode = (g: GameGuide) => {
    const roll = g.flow.kind === "turnOrder" ? g.flow.children[0] : undefined;
    if (roll?.kind !== "roll") throw new Error("fixture");
    return roll;
  };

  it("roll must reference a defined die", () => {
    const g = clone(diceGame);
    rollNode(g).dieId = "d20";
    expectError(g, "flow.children[0].dieId", /unknown die "d20"/);
  });

  it("roll outcome faces must exist on the die", () => {
    const g = clone(diceGame);
    rollNode(g).outcomes[1]!.faces = ["f7"];
    expectError(g, "flow.children[0].outcomes[1].faces[0]", /has no face "f7"/);
  });

  it("module rule refs are checked", () => {
    const g = clone(diceGame);
    const actions = g.modules[1];
    if (actions?.kind !== "actions" || !actions.actions[0]) throw new Error("fixture");
    actions.actions[0].ruleRefs = ["nope"];
    expectError(g, "modules[1].actions[0].ruleRefs[0]", /unknown rule/);
  });

  it("duplicate ids inside a module", () => {
    const g = clone(diceGame);
    const actions = g.modules[1];
    if (actions?.kind !== "actions" || !actions.actions[1]) throw new Error("fixture");
    actions.actions[1].id = "fish";
    expectError(g, "modules[1].actions[1].id", /duplicate action id/);
  });
});

describe("warnings", () => {
  it("dice mechanic without a dice module", () => {
    const g = clone(diceGame);
    g.modules = g.modules.filter((m) => m.kind !== "dice");
    g.rules[0]!.appliesTo = { flowNodes: ["roll"] };
    if (g.flow.kind === "turnOrder" && g.flow.children[0]?.kind === "roll") {
      delete g.flow.children[0].dieId;
    }
    expect(errorsOf(g)).toEqual([]);
    expect(warningsOf(g).join("\n")).toMatch(/dice mechanic but has no dice module/);
  });

  it("rule not backed by an official source", () => {
    const g = clone(sequentialGame);
    g.rules[1]!.citations = [{ kind: "url", sourceId: "review" }];
    expect(warningsOf(g).join("\n")).toMatch(
      /rules\[1\]\.citations: .*not backed by an official source/,
    );
  });

  it("low confidence rule", () => {
    const g = clone(sequentialGame);
    g.rules[1]!.confidence = "low";
    expect(warningsOf(g).join("\n")).toMatch(/low confidence/);
  });

  it("clip from a video not declared as a source", () => {
    const g = clone(sequentialGame);
    turnNode(g).children[1]!.clip = { videoId: "zzzzzzzzzzz", start: 0, end: 5, lang: "it" };
    expect(warningsOf(g).join("\n")).toMatch(/not declared in sources/);
  });

  it("warnings do not make parseGuide fail", () => {
    const g = clone(sequentialGame);
    g.rules[1]!.confidence = "low";
    const r = parseGuide(g);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.warnings.length).toBeGreaterThan(0);
  });

  it("errors make parseGuide fail", () => {
    const g = clone(sequentialGame);
    g.glossary[0]!.term = L("Feature", "Elemento");
    g.glossary[0]!.ruleRefs = ["missing"];
    const r = parseGuide(g);
    expect(r.ok).toBe(false);
  });
});

describe("topics", () => {
  it("rule topics must be declared", () => {
    const g = clone(sequentialGame);
    g.rules[0]!.topics = ["tiles", "scoring"];
    expectError(g, "rules[0].topics[1]", /unknown topic "scoring"/);
  });

  it("topic ids are unique", () => {
    const g = clone(sequentialGame);
    g.topics[1]!.id = "tiles";
    expectError(g, "topics[1].id", /duplicate topic id "tiles"/);
  });

  it("warns about unused and untranslated topics", () => {
    const g = clone(sequentialGame);
    g.topics.push({ id: "endgame", name: L("Endgame", "Endgame") });
    const warnings = warningsOf(g).join("\n");
    expect(warnings).toMatch(/topics\[4\]: topic "endgame" is not used by any rule/);
    expect(warnings).toMatch(/topics\[4\]\.name: topic "endgame" is not translated/);
  });
});

describe("conditions on components, glossary, modules and scenes (v3)", () => {
  it("accepts an expansion-only component and glossary entry", () => {
    expect(errorsOf(clone(sequentialGame))).toEqual([]);
  });

  it("flags unknown expansions and out-of-range player counts", () => {
    const g = clone(sequentialGame);
    g.components[1]!.conditions = { expansions: ["lake"] };
    g.glossary[0]!.conditions = { playerCount: [9] };
    g.modules[0]!.conditions = { expansions: ["lake"] };
    g.scenes[0]!.conditions = { variants: ["solo"] };
    expectError(g, "components[1].conditions.expansions[0]", /unknown expansion "lake"/);
    expectError(g, "glossary[0].conditions.playerCount[0]", /outside the game's 2–5/);
    expectError(g, "modules[0].conditions.expansions[0]", /unknown expansion "lake"/);
    expectError(g, "scenes[0].conditions.variants[0]", /unknown variant "solo"/);
  });
});
