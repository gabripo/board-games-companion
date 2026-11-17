import { z } from "zod";
import { Conditions, Id, LocalizedString, SceneRef } from "../core/primitives";

/**
 * Mechanic modules hold mechanic-specific knowledge. All are optional; a game includes
 * only the ones it needs. To add one: see "Adding a new mechanic" in CLAUDE.md.
 */

const moduleBase = {
  id: Id,
  title: LocalizedString.optional(),
  ruleRefs: z.array(Id).optional(),
};

// ── dice ────────────────────────────────────────────────────────────────────
export const DieFace = z.strictObject({
  id: Id,
  /** Numeric value used for odds calculations (omit for symbol-only faces). */
  value: z.number().optional(),
  label: LocalizedString.optional(),
  icon: SceneRef.optional(),
});

export const Die = z
  .strictObject({
    id: Id,
    name: LocalizedString,
    /** How many of this die are in the box / rolled together by default. */
    count: z.int().positive(),
    sides: z.int().min(2),
    faces: z.array(DieFace).min(2),
  })
  .refine((d) => d.faces.length === d.sides, {
    message: "number of faces must equal `sides`",
    path: ["faces"],
  });
export type Die = z.infer<typeof Die>;

export const DiceModule = z.strictObject({
  ...moduleBase,
  kind: z.literal("dice"),
  dice: z.array(Die).min(1),
  rerollPolicy: LocalizedString.optional(),
  modifiers: z
    .array(z.strictObject({ id: Id, text: LocalizedString, ruleRefs: z.array(Id).optional() }))
    .optional(),
});

// ── scoring ────────────────────────────────────────────────────────────────
export const ScoringCategory = z.strictObject({
  id: Id,
  name: LocalizedString,
  timing: z.enum(["immediate", "end-game", "both"]),
  description: LocalizedString,
  /** Points can be negative (penalties). */
  allowsNegative: z.boolean().optional(),
  ruleRefs: z.array(Id).optional(),
});

export const ScoringModule = z.strictObject({
  ...moduleBase,
  kind: z.literal("scoring"),
  categories: z.array(ScoringCategory).min(1),
  tieBreakers: z.array(LocalizedString),
  sheet: SceneRef.optional(),
});

// ── actions ────────────────────────────────────────────────────────────────
export const GameAction = z.strictObject({
  id: Id,
  name: LocalizedString,
  cost: LocalizedString.optional(),
  effect: LocalizedString,
  limit: LocalizedString.optional(),
  /** Worker placement: once taken, other players cannot use it. */
  blocking: z.boolean().optional(),
  sceneRef: SceneRef.optional(),
  conditions: Conditions.optional(),
  ruleRefs: z.array(Id).optional(),
});

export const ActionsModule = z.strictObject({
  ...moduleBase,
  kind: z.literal("actions"),
  actions: z.array(GameAction).min(1),
});

// ── cards ──────────────────────────────────────────────────────────────────
export const Deck = z
  .strictObject({
    id: Id,
    name: LocalizedString,
    count: z.int().positive(),
    composition: z
      .array(z.strictObject({ id: Id, label: LocalizedString, count: z.int().positive() }))
      .optional(),
  })
  .refine(
    (d) =>
      d.composition === undefined || d.composition.reduce((s, c) => s + c.count, 0) === d.count,
    { message: "deck composition counts must add up to `count`", path: ["composition"] },
  );

export const CardsModule = z.strictObject({
  ...moduleBase,
  kind: z.literal("cards"),
  decks: z.array(Deck).min(1),
  /** Scene showing a card with hotspots on each of its parts. */
  anatomy: z.strictObject({ sceneId: Id }).optional(),
  handLimit: LocalizedString.optional(),
});

// ── sections (fallback) ────────────────────────────────────────────────────
export const SectionsModule = z.strictObject({
  ...moduleBase,
  kind: z.literal("sections"),
  sections: z
    .array(
      z.strictObject({
        id: Id,
        title: LocalizedString,
        body: LocalizedString,
        ruleRefs: z.array(Id).optional(),
      }),
    )
    .min(1),
});

export const Module = z.discriminatedUnion("kind", [
  DiceModule,
  ScoringModule,
  ActionsModule,
  CardsModule,
  SectionsModule,
]);
export type Module = z.infer<typeof Module>;
export type ModuleKind = Module["kind"];
export const MODULE_KINDS = [
  "dice",
  "scoring",
  "actions",
  "cards",
  "sections",
] as const satisfies readonly ModuleKind[];

/** Schemas per module kind (used for JSON Schema export and module-specific extractors). */
export const MODULE_SCHEMAS = {
  dice: DiceModule,
  scoring: ScoringModule,
  actions: ActionsModule,
  cards: CardsModule,
  sections: SectionsModule,
} as const satisfies Record<ModuleKind, z.ZodType>;
