import type { Conditions, SceneRef } from "../core/primitives";
import type { Module } from "../modules/modules";
import type { IssueCollector, Path } from "./issues";

/** Hooks the module checks need from the guide-level checker. */
export interface ModuleCheckContext {
  issues: IssueCollector;
  checkRuleRefs(refs: readonly string[] | undefined, path: Path): void;
  checkSceneRef(ref: SceneRef | undefined, path: Path): void;
  checkConditions(c: Conditions | undefined, path: Path): void;
}

/** Module-specific integrity checks (shape-level checks live in the Zod schemas). */
export function checkModule(m: Module, path: Path, ctx: ModuleCheckContext): void {
  const { issues } = ctx;
  ctx.checkRuleRefs(m.ruleRefs, [...path, "ruleRefs"]);

  switch (m.kind) {
    case "dice": {
      issues.unique(m.dice, [...path, "dice"], "die");
      for (const [i, die] of m.dice.entries()) {
        issues.unique(die.faces, [...path, "dice", i, "faces"], "die face");
        for (const [j, face] of die.faces.entries()) {
          ctx.checkSceneRef(face.icon, [...path, "dice", i, "faces", j, "icon"]);
        }
      }
      for (const [i, mod] of (m.modifiers ?? []).entries()) {
        ctx.checkRuleRefs(mod.ruleRefs, [...path, "modifiers", i, "ruleRefs"]);
      }
      return;
    }
    case "scoring": {
      issues.unique(m.categories, [...path, "categories"], "scoring category");
      for (const [i, c] of m.categories.entries()) {
        ctx.checkRuleRefs(c.ruleRefs, [...path, "categories", i, "ruleRefs"]);
      }
      ctx.checkSceneRef(m.sheet, [...path, "sheet"]);
      return;
    }
    case "actions": {
      issues.unique(m.actions, [...path, "actions"], "action");
      for (const [i, a] of m.actions.entries()) {
        ctx.checkRuleRefs(a.ruleRefs, [...path, "actions", i, "ruleRefs"]);
        ctx.checkSceneRef(a.sceneRef, [...path, "actions", i, "sceneRef"]);
        ctx.checkConditions(a.conditions, [...path, "actions", i, "conditions"]);
      }
      return;
    }
    case "cards": {
      issues.unique(m.decks, [...path, "decks"], "deck");
      for (const [i, d] of m.decks.entries()) {
        issues.unique(d.composition ?? [], [...path, "decks", i, "composition"], "deck entry");
      }
      if (m.anatomy) ctx.checkSceneRef(m.anatomy, [...path, "anatomy"]);
      return;
    }
    case "sections": {
      issues.unique(m.sections, [...path, "sections"], "section");
      for (const [i, s] of m.sections.entries()) {
        ctx.checkRuleRefs(s.ruleRefs, [...path, "sections", i, "ruleRefs"]);
      }
      return;
    }
  }
}
