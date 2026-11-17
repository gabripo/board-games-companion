import { filterApplicable, type SetupStep } from "@bgc/schema";
import { useState } from "react";
import { useGame } from "../game/GameProvider";
import { useConditionLabel } from "../game/RuleCard";
import { RuleLinks } from "../game/RuleSheet";
import { useL, useTranslation } from "../i18n";
import { SceneCrop } from "../scenes/SceneCrop";
import { gamePrefsStore } from "../settings/settings";
import { Icon } from "../ui/Icon";
import { Button, Chip, cx, ProgressRing, SectionTitle } from "../ui/primitives";

/** Setup steps grouped by table area, filtered by session, ticks persisted per game. */
export function SetupChecklist() {
  const { guide, session, prefs, showOnBoard } = useGame();
  const { t } = useTranslation();
  const L = useL();
  const conditionLabel = useConditionLabel();
  const [showAll, setShowAll] = useState(false);

  const applicable = filterApplicable(guide.setup.steps, session);
  const steps = showAll ? guide.setup.steps : applicable;
  const hiddenCount = guide.setup.steps.length - applicable.length;
  const done = new Set(prefs.setupDone);
  const doneCount = applicable.filter((s) => done.has(s.id)).length;

  const toggle = (id: string) =>
    gamePrefsStore(guide.id).set((p) => ({
      ...p,
      setupDone: p.setupDone.includes(id)
        ? p.setupDone.filter((x) => x !== id)
        : [...p.setupDone, id],
    }));

  const areas = [
    ...guide.setup.areas.map((a) => ({ id: a.id as string | undefined, name: L(a.name) })),
    { id: undefined, name: t("setup.general") },
  ];
  const groups = areas
    .map((a) => ({ ...a, steps: steps.filter((s) => s.areaId === a.id) }))
    .filter((g) => g.steps.length > 0);

  return (
    <section aria-labelledby="setup-title">
      <SectionTitle
        icon="layers"
        action={
          <ProgressRing
            value={doneCount}
            max={applicable.length}
            label={t("setup.progress", { done: doneCount, total: applicable.length })}
          />
        }
      >
        <span id="setup-title">{t("setup.title")}</span>
      </SectionTitle>
      <div className="space-y-4">
        {groups.map((g) => (
          <div key={g.id ?? "general"}>
            {groups.length > 1 && (
              <h3 className="mb-2 text-sm font-semibold tracking-wide text-muted uppercase">
                {g.name}
              </h3>
            )}
            <ul className="space-y-2">
              {g.steps.map((step) => (
                <SetupItem
                  key={step.id}
                  step={step}
                  checked={done.has(step.id)}
                  applicable={applicable.includes(step)}
                  onToggle={() => toggle(step.id)}
                  conditionLabel={conditionLabel(step.conditions)}
                  onWhere={
                    step.sceneRef ? () => step.sceneRef && showOnBoard(step.sceneRef) : undefined
                  }
                />
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {hiddenCount > 0 && (
          <Button variant="ghost" icon="eye" onClick={() => setShowAll((s) => !s)}>
            {showAll ? t("setup.hideOther") : t("setup.showOther", { count: hiddenCount })}
          </Button>
        )}
        {doneCount > 0 && (
          <Button
            variant="ghost"
            icon="replay"
            onClick={() => gamePrefsStore(guide.id).set({ setupDone: [] })}
          >
            {t("setup.reset")}
          </Button>
        )}
      </div>
    </section>
  );
}

function SetupItem(props: {
  step: SetupStep;
  checked: boolean;
  applicable: boolean;
  onToggle: () => void;
  conditionLabel: string | undefined;
  onWhere: (() => void) | undefined;
}) {
  const { step } = props;
  const L = useL();
  const { t } = useTranslation();
  return (
    <li
      data-testid={`setup-${step.id}`}
      className={cx(
        "flex items-start gap-3 rounded-xl border bg-surface p-3",
        props.applicable ? "border-line" : "border-dashed border-line opacity-60",
      )}
    >
      <label className="relative flex size-8 shrink-0 cursor-pointer items-center justify-center">
        <input
          type="checkbox"
          checked={props.checked}
          onChange={props.onToggle}
          aria-label={L(step.text)}
          className="peer absolute inset-0 cursor-pointer opacity-0"
        />
        <span
          aria-hidden
          className={cx(
            "flex size-8 items-center justify-center rounded-lg border-2 transition peer-focus-visible:outline-3 peer-focus-visible:outline-accent",
            props.checked ? "border-ok bg-ok text-bg" : "border-line hover:border-accent",
          )}
        >
          {props.checked && <Icon name="check" size={18} />}
        </span>
      </label>
      <div className="min-w-0 flex-1">
        <p className={cx("font-medium", props.checked && "text-muted line-through")}>
          {L(step.text)}
        </p>
        {props.conditionLabel && (
          <Chip tone="accent" icon="users" className="mt-1">
            {props.conditionLabel}
          </Chip>
        )}
        <RuleLinks ids={step.ruleRefs} />
      </div>
      {step.sceneRef && (
        <button
          type="button"
          onClick={props.onWhere}
          aria-label={t("setup.where")}
          className="flex flex-col items-center gap-1 text-xs text-accent"
        >
          <SceneCrop sceneRef={step.sceneRef} className="size-12" />
          {t("setup.where")}
        </button>
      )}
    </li>
  );
}
