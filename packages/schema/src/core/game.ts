import { z } from "zod";
import { Citation, Id, LocalizedString, SceneRef, YouTubeVideoId } from "./primitives";

export const TurnModel = z.enum([
  "sequential",
  "simultaneous",
  "real-time",
  "phase-rounds",
  "mixed",
]);
export type TurnModel = z.infer<typeof TurnModel>;

export const Interaction = z.enum(["competitive", "cooperative", "team", "hidden-traitor", "solo"]);
export type Interaction = z.infer<typeof Interaction>;

export const MechanicId = z.enum([
  "action-points",
  "area-control",
  "auction",
  "bluffing",
  "card-drafting",
  "deck-building",
  "deduction",
  "dice-rolling",
  "engine-building",
  "hand-management",
  "hidden-roles",
  "network-building",
  "pattern-building",
  "pick-up-and-deliver",
  "programming",
  "push-your-luck",
  "resource-management",
  "roll-and-write",
  "route-building",
  "set-collection",
  "take-that",
  "tile-placement",
  "trading",
  "trick-taking",
  "voting",
  "worker-placement",
  "other",
]);
export type MechanicId = z.infer<typeof MechanicId>;

const IntRange = (label: string) =>
  z
    .strictObject({ min: z.int().positive(), max: z.int().positive() })
    .refine((r) => r.min <= r.max, { message: `${label}: min must be ≤ max`, path: ["max"] });

export const Classification = z
  .strictObject({
    turnModel: TurnModel,
    interaction: Interaction,
    mechanics: z.array(MechanicId).min(1),
    playerCount: z.strictObject({
      min: z.int().positive(),
      max: z.int().positive(),
      best: z.array(z.int().positive()).optional(),
    }),
    playtimeMinutes: IntRange("playtimeMinutes"),
    /** 1 = very light, 5 = very heavy. */
    complexity: z.number().min(1).max(5),
    minAge: z.int().positive().optional(),
  })
  .superRefine((c, ctx) => {
    const { min, max, best } = c.playerCount;
    if (min > max) {
      ctx.addIssue({ code: "custom", message: "min must be ≤ max", path: ["playerCount", "max"] });
    }
    for (const [i, n] of (best ?? []).entries()) {
      if (n < min || n > max) {
        ctx.addIssue({
          code: "custom",
          message: `best player count ${n} is outside ${min}–${max}`,
          path: ["playerCount", "best", i],
        });
      }
    }
  });
export type Classification = z.infer<typeof Classification>;

export const SourceLang = z.enum(["en", "it", "other"]);

const SourceBase = {
  id: Id,
  title: z.string().min(1),
  lang: SourceLang,
  /** Official publisher material. An official PDF is the ground truth for rules. */
  official: z.boolean(),
};
export const Source = z.discriminatedUnion("type", [
  z.strictObject({
    ...SourceBase,
    type: z.literal("pdf"),
    /** Public download page of the publisher; the PDF itself is never committed. */
    url: z.url().optional(),
    edition: z.string().min(1).optional(),
  }),
  z.strictObject({
    ...SourceBase,
    type: z.literal("video"),
    videoId: YouTubeVideoId,
    channel: z.string().min(1).optional(),
  }),
  z.strictObject({ ...SourceBase, type: z.literal("web"), url: z.url() }),
]);
export type Source = z.infer<typeof Source>;

export const ComponentType = z.enum([
  "board",
  "player-board",
  "card",
  "die",
  "token",
  "meeple",
  "tile",
  "sheet",
  "timer",
  "screen",
  "money",
  "other",
]);

export const Component = z.strictObject({
  id: Id,
  type: ComponentType,
  name: LocalizedString,
  quantity: z.int().positive().optional(),
  description: LocalizedString.optional(),
  sceneRefs: z.array(SceneRef).optional(),
});
export type Component = z.infer<typeof Component>;

export const Variant = z.strictObject({
  id: Id,
  kind: z.enum(["variant", "solo", "two-player", "beginner", "advanced"]),
  name: LocalizedString,
  description: LocalizedString,
});
export type Variant = z.infer<typeof Variant>;

export const Expansion = z.strictObject({
  id: Id,
  name: LocalizedString,
});
export type Expansion = z.infer<typeof Expansion>;

/** A rule topic tag (e.g. "tiles"), declared once with its name in every language. */
export const Topic = z.strictObject({
  id: Id,
  name: LocalizedString,
});
export type Topic = z.infer<typeof Topic>;

export const GlossaryEntry = z.strictObject({
  id: Id,
  /** Official term in each language's edition. */
  term: LocalizedString,
  definition: LocalizedString,
  /** Extra search terms (e.g. community names, other editions). */
  aliases: z
    .strictObject({ en: z.array(z.string().min(1)), it: z.array(z.string().min(1)) })
    .partial()
    .optional(),
  /** Icon = crop of a hotspot in a scene. */
  icon: SceneRef.optional(),
  ruleRefs: z.array(Id).optional(),
});
export type GlossaryEntry = z.infer<typeof GlossaryEntry>;

export const GameMeta = z.strictObject({
  /** Titles can differ between editions (e.g. Italian edition name). */
  title: LocalizedString,
  publisher: z.string().min(1).optional(),
  year: z.int().min(1800).max(2100).optional(),
  designers: z.array(z.string().min(1)).optional(),
  bggId: z.int().positive().optional(),
});
export type GameMeta = z.infer<typeof GameMeta>;

export const Misconception = z.strictObject({
  id: Id,
  myth: LocalizedString,
  rule: LocalizedString,
  citations: z.array(Citation).min(1, "every misconception needs a citation"),
  ruleRefs: z.array(Id).optional(),
});

export const EdgeCase = z.strictObject({
  id: Id,
  question: LocalizedString,
  answer: LocalizedString,
  citations: z.array(Citation).min(1, "every edge case needs a citation"),
  ruleRefs: z.array(Id).optional(),
});

export const Guides = z.strictObject({
  overview: z.strictObject({
    /** 30-second pitch. */
    pitch: LocalizedString,
    goal: LocalizedString,
    howToWin: LocalizedString,
  }),
  coreLoop: LocalizedString.optional(),
  misconceptions: z.array(Misconception),
  edgeCases: z.array(EdgeCase),
});
export type Guides = z.infer<typeof Guides>;
