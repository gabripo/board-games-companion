import type { Module, ModuleKind } from "@bgc/schema";
import type { ComponentType } from "react";

/** Props every module slot receives: the module narrowed to its own kind. */
export interface ModuleSlotProps<K extends ModuleKind> {
  module: Extract<Module, { kind: K }>;
}

/**
 * The renderers for one mechanic module. Tabs assemble whatever slots the game's modules
 * provide, so supporting a new kind of game never touches tab code.
 */
export interface ModuleRenderer<K extends ModuleKind> {
  /** Rules tab: reference material (tables, catalogs). */
  ReferencePanel?: ComponentType<ModuleSlotProps<K>>;
  /** Play tab: at-the-table helper (odds, calculator…). */
  PlayWidget?: ComponentType<ModuleSlotProps<K>>;
  /** Learn tab: short newbie-oriented explanation. */
  LearnCard?: ComponentType<ModuleSlotProps<K>>;
}

export type ModuleRegistry = { [K in ModuleKind]: ModuleRenderer<K> };
export type SlotName = keyof ModuleRenderer<ModuleKind>;
