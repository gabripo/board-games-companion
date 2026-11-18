import { z } from "zod";
import {
  Classification,
  Component,
  Expansion,
  GameMeta,
  GlossaryEntry,
  Guides,
  Source,
  Topic,
  Variant,
} from "./core/game";
import { Id, LocalizedString } from "./core/primitives";
import { Rule, Setup } from "./core/rules";
import { FlowNode } from "./flow/flow";
import { Module } from "./modules/modules";
import { Scene, Walkthrough } from "./scenes/scenes";

export const CURRENT_SCHEMA_VERSION = 2;

// ── per-file schemas (content/games/<id>/…) ────────────────────────────────

/** game.json */
export const GameFile = z.strictObject({
  schemaVersion: z.literal(CURRENT_SCHEMA_VERSION),
  id: Id,
  meta: GameMeta,
  classification: Classification,
  sources: z.array(Source).min(1, "a game needs at least one source"),
  components: z.array(Component),
  variants: z.array(Variant),
  expansions: z.array(Expansion),
  glossary: z.array(GlossaryEntry),
  /** Rule topic tags with translated names (rules reference them by id). */
  topics: z.array(Topic),
});
export type GameFile = z.infer<typeof GameFile>;

export const RulesFile = z.array(Rule);
export const SetupFile = Setup;
/** flow.json holds the root node of the flow graph. */
export const FlowFile = FlowNode;
export const ScenesFile = z.array(Scene);
export const WalkthroughsFile = z.array(Walkthrough);
export const GuidesFile = Guides;
/** modules/<kind>.json — one module per file. */
export const ModuleFile = Module;

// ── merged bundle (what the PWA downloads and caches) ──────────────────────

export const GameGuide = z.strictObject({
  ...GameFile.shape,
  rules: RulesFile,
  setup: SetupFile,
  flow: FlowNode,
  modules: z.array(Module),
  scenes: ScenesFile,
  walkthroughs: WalkthroughsFile,
  guides: GuidesFile,
});
export type GameGuide = z.infer<typeof GameGuide>;

/** dist/games/index.json — the catalog listing. */
export const GameSummary = z.strictObject({
  id: Id,
  schemaVersion: z.int().positive(),
  title: LocalizedString,
  classification: Classification,
  /** Path of the bundle relative to the index, e.g. "catan.guide.json". */
  bundle: z.string().min(1),
  /** Cover image path relative to the index, if any. */
  cover: z.string().min(1).optional(),
});
export type GameSummary = z.infer<typeof GameSummary>;

export const GameIndex = z.strictObject({
  generatedAt: z.iso.datetime(),
  games: z.array(GameSummary),
});
export type GameIndex = z.infer<typeof GameIndex>;
