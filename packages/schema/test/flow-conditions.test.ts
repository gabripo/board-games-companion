import { describe, expect, it } from "vitest";
import {
  applies,
  childNodes,
  type FlowNode,
  filterApplicable,
  pruneFlow,
  type SessionContext,
  walkFlow,
} from "../src";
import { clone, diceGame, sequentialGame } from "./fixtures/archetypes";

const ctx = (
  playerCount: number,
  variants: string[] = [],
  expansions: string[] = [],
): SessionContext => ({
  playerCount,
  variants,
  expansions,
});

describe("applies()", () => {
  it("no conditions → always applies", () => {
    expect(applies(undefined, ctx(3))).toBe(true);
    expect(applies({}, ctx(3))).toBe(true);
  });

  it("player count must be listed", () => {
    expect(applies({ playerCount: [2] }, ctx(2))).toBe(true);
    expect(applies({ playerCount: [2] }, ctx(3))).toBe(false);
  });

  it("any listed variant / expansion matches", () => {
    expect(applies({ variants: ["a", "b"] }, ctx(2, ["b"]))).toBe(true);
    expect(applies({ variants: ["a"] }, ctx(2, []))).toBe(false);
    expect(applies({ expansions: ["river"] }, ctx(2, [], ["river"]))).toBe(true);
  });

  it("all specified dimensions must match", () => {
    const c = { playerCount: [2], variants: ["duel"] };
    expect(applies(c, ctx(2, ["duel"]))).toBe(true);
    expect(applies(c, ctx(2))).toBe(false);
    expect(applies(c, ctx(3, ["duel"]))).toBe(false);
  });

  it("filterApplicable filters setup steps by player count", () => {
    const steps = sequentialGame.setup.steps;
    expect(filterApplicable(steps, ctx(2)).map((s) => s.id)).toContain("duel-extra");
    expect(filterApplicable(steps, ctx(4)).map((s) => s.id)).not.toContain("duel-extra");
  });
});

describe("walkFlow()", () => {
  it("visits every node depth-first with JSON paths", () => {
    const visited = [...walkFlow(sequentialGame.flow)].map(({ node, path }) => [
      node.id,
      path.join("."),
    ]);
    expect(visited.slice(0, 4)).toEqual([
      ["game", ""],
      ["turns", "children.0"],
      ["turn", "children.0.children.0"],
      ["draw", "children.0.children.0.children.0"],
    ]);
    expect(visited.map(([id]) => id)).toEqual([
      "game",
      "turns",
      "turn",
      "draw",
      "place",
      "follower",
      "deploy",
      "pass",
      "score-features",
      "score-now",
      "final-scoring",
    ]);
  });

  it("descends into roll outcomes", () => {
    const ids = [...walkFlow(diceGame.flow)].map((n) => n.node.id);
    expect(ids).toEqual(["game", "roll", "lose", "place-worker", "fish", "trade"]);
  });

  it("childNodes() returns options for a choice", () => {
    const choice = [...walkFlow(sequentialGame.flow)].find((n) => n.node.kind === "choice")?.node;
    if (!choice) throw new Error("fixture");
    expect(childNodes(choice).map((c) => c.id)).toEqual(["deploy", "pass"]);
  });
});

describe("pruneFlow()", () => {
  const withConditionalNode = (): FlowNode => {
    const flow = clone(sequentialGame.flow);
    if (flow.kind !== "sequence") throw new Error("fixture");
    flow.children.push({
      id: "duel-bonus",
      kind: "step",
      title: { en: "Duel bonus", it: "Bonus duello" },
      conditions: { playerCount: [2] },
    });
    return flow;
  };

  it("removes nodes that do not apply", () => {
    const ids = (n: FlowNode | undefined) => (n ? [...walkFlow(n)].map((x) => x.node.id) : []);
    expect(ids(pruneFlow(withConditionalNode(), ctx(2)))).toContain("duel-bonus");
    expect(ids(pruneFlow(withConditionalNode(), ctx(4)))).not.toContain("duel-bonus");
  });

  it("returns undefined when the root does not apply", () => {
    const root: FlowNode = { ...clone(sequentialGame.flow), conditions: { playerCount: [5] } };
    expect(pruneFlow(root, ctx(3))).toBeUndefined();
  });

  it("does not mutate the input", () => {
    const flow = withConditionalNode();
    const before = JSON.stringify(flow);
    pruneFlow(flow, ctx(4));
    expect(JSON.stringify(flow)).toBe(before);
  });
});
