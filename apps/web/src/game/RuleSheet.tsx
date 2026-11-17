import { useL, useTranslation } from "../i18n";
import { BottomSheet } from "../ui/BottomSheet";
import { useGame } from "./GameProvider";
import { RuleCard } from "./RuleCard";

/** Opens a single rule (from a flow step, a glossary entry, a module item…) in a sheet. */
export function RuleSheet(props: { ruleId: string | undefined; onClose: () => void }) {
  const { t } = useTranslation();
  const { rule } = useGame();
  const r = props.ruleId ? rule(props.ruleId) : undefined;
  return (
    <BottomSheet open={r !== undefined} onClose={props.onClose} title={t("rule.title")}>
      {r && <RuleCard rule={r} defaultExpanded />}
    </BottomSheet>
  );
}

/** Small inline links to rules, used by flow steps, hotspots and modules. */
export function RuleLinks(props: { ids: readonly string[] | undefined }) {
  const { rule, openRule } = useGame();
  const { t } = useTranslation();
  const L = useL();
  const rules = (props.ids ?? []).flatMap((id) => {
    const r = rule(id);
    return r ? [r] : [];
  });
  if (rules.length === 0) return null;
  return (
    <ul className="mt-2 flex flex-wrap gap-1.5" aria-label={t("rule.related")}>
      {rules.map((r) => (
        <li key={r.id}>
          <button
            type="button"
            onClick={() => openRule(r.id)}
            className="min-h-8 rounded-full border border-accent/40 bg-accent/10 px-3 py-1 text-left text-xs font-medium text-accent hover:bg-accent/20"
          >
            📖 {L(r.summary)}
          </button>
        </li>
      ))}
    </ul>
  );
}
