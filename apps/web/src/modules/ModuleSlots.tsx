import type { Module, ModuleKind } from "@bgc/schema";
import type { ComponentType } from "react";
import { useGame } from "../game/GameProvider";
import { MODULE_RENDERERS } from "./index";
import type { ModuleSlotProps, SlotName } from "./registry";

/** Renders one slot of a module, if its renderer provides it. */
export function ModuleSlot(props: { module: Module; slot: SlotName }) {
  const renderer = MODULE_RENDERERS[props.module.kind];
  // The registry is keyed by kind, so the component matches this module's kind.
  const Slot = renderer[props.slot] as ComponentType<ModuleSlotProps<ModuleKind>> | undefined;
  if (!Slot) return null;
  return (
    <div data-testid={`module-${props.module.id}-${props.slot}`}>
      <Slot module={props.module as never} />
    </div>
  );
}

/** Renders a slot for every module of the current game, in content order. */
export function ModuleSlots(props: { slot: SlotName }) {
  const { guide } = useGame();
  const modules = guide.modules.filter((m) => MODULE_RENDERERS[m.kind][props.slot] !== undefined);
  if (modules.length === 0) return null;
  return (
    <div className="space-y-6">
      {modules.map((m) => (
        <ModuleSlot key={m.id} module={m} slot={props.slot} />
      ))}
    </div>
  );
}
