import { useGame } from "../../game/GameProvider";
import { useConditionLabel } from "../../game/RuleCard";
import { RuleLinks } from "../../game/RuleSheet";
import { useL, useTranslation } from "../../i18n";
import { Button, Chip, cx, SectionTitle } from "../../ui/primitives";
import type { ModuleRenderer, ModuleSlotProps } from "../registry";

/** Action catalog (worker placement, action points…): cost, effect, limits, show on board. */
function ActionGrid({ module }: ModuleSlotProps<"actions">) {
  const { isApplicable, showOnBoard } = useGame();
  const { t } = useTranslation();
  const L = useL();
  const conditionLabel = useConditionLabel();
  return (
    <section>
      <SectionTitle icon="board">
        {module.title ? L(module.title) : t("actions.title")}
      </SectionTitle>
      <ul className="grid gap-2 sm:grid-cols-2">
        {module.actions.map((a) => {
          const applicable = isApplicable(a.conditions);
          const condition = conditionLabel(a.conditions);
          return (
            <li
              key={a.id}
              data-testid={`action-${a.id}`}
              className={cx(
                "flex flex-col gap-2 rounded-xl border bg-surface p-3",
                applicable ? "border-line" : "border-dashed border-line opacity-60",
              )}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-lg font-semibold">{L(a.name)}</span>
                {a.blocking && <Chip tone="warn">{t("actions.blocking")}</Chip>}
                {condition && (
                  <Chip tone="accent" icon="users">
                    {condition}
                  </Chip>
                )}
              </div>
              {a.cost && (
                <p className="text-sm">
                  <span className="font-medium text-muted">{t("actions.cost")}: </span>
                  {L(a.cost)}
                </p>
              )}
              <p>{L(a.effect)}</p>
              {a.limit && <p className="text-sm text-muted">{L(a.limit)}</p>}
              <RuleLinks ids={a.ruleRefs} />
              {a.sceneRef && (
                <Button
                  icon="target"
                  className="mt-auto self-start"
                  onClick={() => a.sceneRef && showOnBoard(a.sceneRef)}
                >
                  {t("rule.showOnBoard")}
                </Button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export const actionsRenderer: ModuleRenderer<"actions"> = {
  ReferencePanel: ActionGrid,
  PlayWidget: ActionGrid,
};
