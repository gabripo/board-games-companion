import type { ModuleRegistry } from "./registry";
import { sectionsRenderer } from "./sections/SectionsModule";

/** One renderer per module kind — the type forces an entry for every kind in the schema. */
export const MODULE_RENDERERS: ModuleRegistry = {
  dice: {},
  scoring: {},
  actions: {},
  cards: {},
  sections: sectionsRenderer,
};
