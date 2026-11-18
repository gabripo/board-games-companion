import type { Module, ModuleKind } from "@bgc/schema";
import type { ComponentType } from "react";
import { useGame } from "../game/GameProvider";
import { useSessionFilter } from "../game/useSessionFilter";
import { useTranslation } from "../i18n";
import { Button } from "../ui/primitives";
import { MODULE_RENDERERS } from "./index";
import type { ModuleSlotProps, SlotName } from "./registry";

/** Renders one slot of a module, if its renderer provides it. */
export function ModuleSlot(props: { module: Module; slot: SlotName }) {
  const renderer = MODULE_RENDERERS[props.module.kind];
  // The registry is keyed by kind, so the component matches this module's kind.
  const Slot = renderer[props.slot] as ComponentType<ModuleSlotProps<ModuleKind>> | undefined;
  if (!Slot) return null;
  return (
    <div
      id={moduleAnchor(props.module.id, props.slot)}
      className="scroll-mt-4"
      data-testid={`module-${props.module.id}-${props.slot}`}
    >
      <Slot module={props.module as never} />
    </div>
  );
}

/** DOM id of a module's slot, used by the Learn tab shortcuts. */
export const moduleAnchor = (moduleId: string, slot: SlotName) => `${slot}-${moduleId}`;

/** Modules that render this slot (all of them, regardless of the session). */
export function useSlotModules(slot: SlotName): Module[] {
  const { guide } = useGame();
  return guide.modules.filter((m) => MODULE_RENDERERS[m.kind][slot] !== undefined);
}

/**
 * Renders a slot for every module of the current game, in content order. Modules that
 * don't apply to the session (e.g. another expansion's cards) stay one tap away.
 */
export function ModuleSlots(props: { slot: SlotName }) {
  const { t } = useTranslation();
  const filter = useSessionFilter(useSlotModules(props.slot));
  if (filter.items.length === 0 && filter.hiddenCount === 0) return null;
  return (
    <div className="space-y-6">
      {filter.items.map((m) => (
        <div key={m.id} className={filter.isApplicable(m) ? undefined : "opacity-70"}>
          <ModuleSlot module={m} slot={props.slot} />
        </div>
      ))}
      {filter.hiddenCount > 0 && (
        <Button variant="ghost" icon="eye" onClick={filter.toggle}>
          {filter.showAll
            ? t("modules.hideOther")
            : t("modules.showOther", { count: filter.hiddenCount })}
        </Button>
      )}
    </div>
  );
}
