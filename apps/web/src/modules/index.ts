import { actionsRenderer } from "./actions/ActionsModule";
import { cardsRenderer } from "./cards/CardsModule";
import { diceRenderer } from "./dice/DiceModule";
import type { ModuleRegistry } from "./registry";
import { scoringRenderer } from "./scoring/ScoringModule";
import { sectionsRenderer } from "./sections/SectionsModule";

/** One renderer per module kind — the type forces an entry for every kind in the schema. */
export const MODULE_RENDERERS: ModuleRegistry = {
  dice: diceRenderer,
  scoring: scoringRenderer,
  actions: actionsRenderer,
  cards: cardsRenderer,
  sections: sectionsRenderer,
};
