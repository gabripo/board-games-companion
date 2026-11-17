import { z } from "zod";
import { Conditions, Id, LocalizedString, SceneRef, YouTubeClip } from "../core/primitives";

/**
 * The flow graph describes the rhythm of any game as a tree of typed nodes.
 * UI code must render this graph instead of hard-coding a game's turn structure.
 */

export const Actor = z.enum([
  "active-player",
  "all-players",
  "each-player",
  "team",
  "leader",
  /** The game itself / automa / environment. */
  "game",
]);
export type Actor = z.infer<typeof Actor>;

export const FLOW_NODE_KINDS = [
  "sequence",
  "repeat",
  "turnOrder",
  "simultaneous",
  "choice",
  "roll",
  "timer",
  "step",
  "trigger",
] as const;
export type FlowNodeKind = (typeof FLOW_NODE_KINDS)[number];

interface FlowNodeBase {
  id: string;
  title: { en: string; it: string };
  description?: { en: string; it: string } | undefined;
  actor?: Actor | undefined;
  conditions?: Conditions | undefined;
  ruleRefs?: string[] | undefined;
  clip?: YouTubeClip | undefined;
  sceneRef?: SceneRef | undefined;
}

export interface RollOutcome {
  label: { en: string; it: string };
  /** Matches when the rolled total is within [min, max]. */
  sum?: { min: number; max: number } | undefined;
  /** Matches when any of these die-face ids is rolled. */
  faces?: string[] | undefined;
  children?: FlowNode[] | undefined;
}

export type FlowNode =
  | (FlowNodeBase & { kind: "sequence"; children: FlowNode[] })
  | (FlowNodeBase & {
      kind: "repeat";
      until: { en: string; it: string };
      untilRuleRef?: string | undefined;
      children: FlowNode[];
    })
  | (FlowNodeBase & {
      kind: "turnOrder";
      order: "clockwise" | "counterclockwise" | "track" | "other";
      firstPlayer?: { en: string; it: string } | undefined;
      children: FlowNode[];
    })
  | (FlowNodeBase & {
      kind: "simultaneous";
      syncPoint?: { en: string; it: string } | undefined;
      children: FlowNode[];
    })
  | (FlowNodeBase & {
      kind: "choice";
      pick: { min: number; max: number };
      options: FlowNode[];
    })
  | (FlowNodeBase & {
      kind: "roll";
      /** Id of a die defined in the `dice` module. */
      dieId?: string | undefined;
      count: number;
      reroll?: { en: string; it: string } | undefined;
      outcomes: RollOutcome[];
    })
  | (FlowNodeBase & {
      kind: "timer";
      durationSeconds: number;
      children?: FlowNode[] | undefined;
    })
  | (FlowNodeBase & { kind: "step" })
  | (FlowNodeBase & {
      kind: "trigger";
      when: { en: string; it: string };
      children: FlowNode[];
    });

const base = {
  id: Id,
  title: LocalizedString,
  description: LocalizedString.optional(),
  actor: Actor.optional(),
  conditions: Conditions.optional(),
  ruleRefs: z.array(Id).optional(),
  clip: YouTubeClip.optional(),
  sceneRef: SceneRef.optional(),
};

const children = (): z.ZodType<FlowNode[]> => z.array(FlowNode).min(1, "needs at least one child");

const RollOutcomeSchema: z.ZodType<RollOutcome> = z.lazy(() =>
  z
    .strictObject({
      label: LocalizedString,
      sum: z
        .strictObject({ min: z.int(), max: z.int() })
        .refine((s) => s.min <= s.max, { message: "sum.min must be ≤ sum.max" })
        .optional(),
      faces: z.array(Id).min(1).optional(),
      children: z.array(FlowNode).optional(),
    })
    .refine((o) => o.sum !== undefined || o.faces !== undefined, {
      message: "an outcome needs `sum` or `faces`",
    }),
);

export const FlowNode: z.ZodType<FlowNode> = z.lazy(() =>
  z.discriminatedUnion("kind", [
    z.strictObject({ ...base, kind: z.literal("sequence"), children: children() }),
    z.strictObject({
      ...base,
      kind: z.literal("repeat"),
      until: LocalizedString,
      untilRuleRef: Id.optional(),
      children: children(),
    }),
    z.strictObject({
      ...base,
      kind: z.literal("turnOrder"),
      order: z.enum(["clockwise", "counterclockwise", "track", "other"]),
      firstPlayer: LocalizedString.optional(),
      children: children(),
    }),
    z.strictObject({
      ...base,
      kind: z.literal("simultaneous"),
      syncPoint: LocalizedString.optional(),
      children: children(),
    }),
    z
      .strictObject({
        ...base,
        kind: z.literal("choice"),
        pick: z.strictObject({ min: z.int().nonnegative(), max: z.int().positive() }),
        options: z.array(FlowNode).min(2, "a choice needs at least two options"),
      })
      .superRefine((n, ctx) => {
        if (n.pick.min > n.pick.max) {
          ctx.addIssue({ code: "custom", message: "pick.min must be ≤ pick.max", path: ["pick"] });
        }
        if (n.pick.max > n.options.length) {
          ctx.addIssue({
            code: "custom",
            message: `pick.max (${n.pick.max}) exceeds number of options (${n.options.length})`,
            path: ["pick", "max"],
          });
        }
      }),
    z.strictObject({
      ...base,
      kind: z.literal("roll"),
      dieId: Id.optional(),
      count: z.int().positive(),
      reroll: LocalizedString.optional(),
      outcomes: z.array(RollOutcomeSchema).min(1, "a roll needs at least one outcome"),
    }),
    z.strictObject({
      ...base,
      kind: z.literal("timer"),
      durationSeconds: z.int().positive(),
      children: z.array(FlowNode).optional(),
    }),
    z.strictObject({ ...base, kind: z.literal("step") }),
    z.strictObject({
      ...base,
      kind: z.literal("trigger"),
      when: LocalizedString,
      children: children(),
    }),
  ]),
);

/** Direct child nodes of a flow node, regardless of kind. */
export function childNodes(node: FlowNode): FlowNode[] {
  switch (node.kind) {
    case "choice":
      return node.options;
    case "roll":
      return node.outcomes.flatMap((o) => o.children ?? []);
    case "timer":
      return node.children ?? [];
    case "step":
      return [];
    default:
      return node.children;
  }
}

/** Depth-first walk over the flow tree, yielding each node with its JSON path. */
export function* walkFlow(
  node: FlowNode,
  path: (string | number)[] = [],
): Generator<{ node: FlowNode; path: (string | number)[] }> {
  yield { node, path };
  switch (node.kind) {
    case "choice":
      for (const [i, c] of node.options.entries()) yield* walkFlow(c, [...path, "options", i]);
      return;
    case "roll":
      for (const [i, o] of node.outcomes.entries()) {
        for (const [j, c] of (o.children ?? []).entries()) {
          yield* walkFlow(c, [...path, "outcomes", i, "children", j]);
        }
      }
      return;
    case "step":
      return;
    default:
      for (const [i, c] of (node.children ?? []).entries()) {
        yield* walkFlow(c, [...path, "children", i]);
      }
  }
}
