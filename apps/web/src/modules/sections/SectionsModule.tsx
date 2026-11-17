import { RuleLinks } from "../../game/RuleSheet";
import { useL } from "../../i18n";
import { Accordion } from "../../ui/primitives";
import type { ModuleRenderer, ModuleSlotProps } from "../registry";

/** Fallback module: free-form ruled sections rendered as an accordion. */
function SectionsPanel({ module }: ModuleSlotProps<"sections">) {
  const L = useL();
  return (
    <div className="space-y-2">
      {module.title && <h3 className="font-semibold">{L(module.title)}</h3>}
      {module.sections.map((s) => (
        <Accordion key={s.id} summary={L(s.title)}>
          <p>{L(s.body)}</p>
          <RuleLinks ids={s.ruleRefs} />
        </Accordion>
      ))}
    </div>
  );
}

export const sectionsRenderer: ModuleRenderer<"sections"> = {
  ReferencePanel: SectionsPanel,
  LearnCard: SectionsPanel,
};
