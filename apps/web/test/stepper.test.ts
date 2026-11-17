import { pruneFlow } from "@bgc/schema";
import { ARCHETYPES, clone, diceGame, sequentialGame, simultaneousGame } from "@bgc/schema/testing";
import { describe, expect, it } from "vitest";
import {
  initStepper,
  type StepperAction,
  type StepperState,
  stepperReducer,
  viewOf,
} from "../src/flow/stepper";

const run = (state: StepperState, ...actions: StepperAction[]) =>
  actions.reduce(stepperReducer, state);
const next = { type: "next" } as const;
const currentId = (s: StepperState) => viewOf(s).current?.id;

describe("flow stepper", () => {
  it("starts at the first stop of every archetype", () => {
    const first = Object.fromEntries(
      Object.values(ARCHETYPES).map((g) => [
        g.id,
        currentId(initStepper(g.flow, g.classification.playerCount.min)),
      ]),
    );
    expect(first).toEqual({
      "tile-trek": "draw",
      "card-feast": "pick",
      "panic-kitchen": "grab",
      "dice-harbor": "roll",
      "trump-tide": "lead",
    });
  });

  it("sequential: steps, choice branch, triggers as reminders, player rotation and rounds", () => {
    let s = initStepper(sequentialGame.flow, 2);
    const v = viewOf(s);
    expect(v).toMatchObject({ player: 1, round: 1 });
    expect(v.reminders.map((r) => r.id)).toEqual(["score-features"]);
    expect(v.context.map((n) => n.id)).toEqual(["game", "turns", "turn"]);

    s = run(s, next, next); // draw → place → follower choice
    expect(currentId(s)).toBe("follower");
    s = run(s, { type: "choose", option: 0 });
    expect(currentId(s)).toBe("deploy");
    s = run(s, next); // choice done; trigger skipped; turn ends → player 2
    expect(currentId(s)).toBe("draw");
    expect(viewOf(s)).toMatchObject({ player: 2, round: 1 });

    s = run(s, next, next, { type: "skipChoice" }); // player 2 done → round 2, player 1
    expect(currentId(s)).toBe("draw");
    expect(viewOf(s)).toMatchObject({ player: 1, round: 2 });
  });

  it("ending the loop moves on to final scoring and then finishes", () => {
    let s = run(initStepper(sequentialGame.flow, 3), { type: "endLoop" });
    expect(currentId(s)).toBe("final-scoring");
    expect(viewOf(s).loop).toBeUndefined();
    s = run(s, next);
    expect(viewOf(s).done).toBe(true);
    expect(run(s, next)).toBe(s); // no-op once done
  });

  it("back restores the previous position, including player and round", () => {
    const s0 = initStepper(sequentialGame.flow, 2);
    const s1 = run(s0, next, next, { type: "skipChoice" });
    expect(viewOf(s1).player).toBe(2);
    const back = run(s1, { type: "back" });
    expect(currentId(back)).toBe("follower");
    expect(viewOf(back).player).toBe(1);
    expect(viewOf(run(s0, { type: "back" })).canGoBack).toBe(false);
  });

  it("simultaneous rounds loop with a round counter", () => {
    let s = initStepper(simultaneousGame.flow, 4);
    expect(viewOf(s).simultaneous).toBe(true);
    s = run(s, next, next);
    expect(currentId(s)).toBe("pick");
    expect(viewOf(s).round).toBe(2);
  });

  it("dice: the rolled outcome chooses the branch; a root turn order keeps rotating", () => {
    let s = initStepper(diceGame.flow, 2);
    s = run(s, { type: "rolled", outcome: 0 }); // 7: bust
    expect(currentId(s)).toBe("lose");
    s = run(s, next);
    expect(currentId(s)).toBe("roll");
    expect(viewOf(s).player).toBe(2);

    s = run(s, { type: "rolled", outcome: 1 }); // outcome without children → turn ends
    expect(viewOf(s).player).toBe(1);
    s = run(s, { type: "rolled", outcome: 2 }, { type: "choose", option: 1 });
    expect(currentId(s)).toBe("trade");
  });

  it("real-time: timer frame is exposed for the countdown widget", () => {
    const s = initStepper(ARCHETYPES["real-time"].flow, 3);
    expect(viewOf(s).timer?.durationSeconds).toBe(180);
    expect(viewOf(run(s, next, next)).done).toBe(true);
  });

  it("follows the session-pruned flow (2-player-only nodes)", () => {
    const flow = clone(sequentialGame.flow);
    if (flow.kind !== "sequence") throw new Error("fixture");
    flow.children.unshift({
      id: "duel-setup",
      kind: "step",
      title: { en: "Duel", it: "Duello" },
      conditions: { playerCount: [2] },
    });
    expect(
      currentId(initStepper(pruneFlow(flow, { playerCount: 2, variants: [], expansions: [] }), 2)),
    ).toBe("duel-setup");
    expect(
      currentId(initStepper(pruneFlow(flow, { playerCount: 4, variants: [], expansions: [] }), 4)),
    ).toBe("draw");
  });

  it("handles an empty flow and degenerate loops without hanging", () => {
    expect(viewOf(initStepper(undefined, 2)).done).toBe(true);
    const onlyTriggers = {
      id: "r",
      kind: "repeat" as const,
      title: { en: "r", it: "r" },
      until: { en: "x", it: "x" },
      children: [
        {
          id: "t",
          kind: "trigger" as const,
          title: { en: "t", it: "t" },
          when: { en: "w", it: "w" },
          children: [{ id: "s", kind: "step" as const, title: { en: "s", it: "s" } }],
        },
      ],
    };
    expect(viewOf(initStepper(onlyTriggers, 2)).done).toBe(true);
  });
});
