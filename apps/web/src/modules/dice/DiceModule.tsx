import { type Die, type FlowNode, walkFlow } from "@bgc/schema";
import { useMemo } from "react";
import { useGame } from "../../game/GameProvider";
import { RuleLinks } from "../../game/RuleSheet";
import { useL, useTranslation } from "../../i18n";
import { SceneCrop } from "../../scenes/SceneCrop";
import { Chip, SectionTitle } from "../../ui/primitives";
import type { ModuleRenderer, ModuleSlotProps } from "../registry";
import { firstMatchOdds, percent, sumDistribution } from "./odds";

function Faces(props: { die: Die }) {
  const L = useL();
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label={L(props.die.name)}>
      {props.die.faces.map((f) => (
        <li
          key={f.id}
          className="flex size-11 items-center justify-center rounded-lg border-2 border-line bg-surface-2 text-lg font-bold"
        >
          {f.icon ? (
            <SceneCrop sceneRef={f.icon} className="size-9" />
          ) : f.label ? (
            <span className="text-xs">{L(f.label)}</span>
          ) : (
            f.value
          )}
        </li>
      ))}
    </ul>
  );
}

/** Sum distribution bars for `count` dice (numeric faces only). */
function SumBars(props: { die: Die; count: number }) {
  const { t } = useTranslation();
  const values = props.die.faces.map((f) => f.value);
  const numeric = values.every((v): v is number => typeof v === "number");
  const dist = useMemo(
    () => (numeric ? [...sumDistribution(values as number[], props.count)] : []),
    [numeric, values, props.count],
  );
  if (!numeric || dist.length === 0) return null;
  const max = Math.max(...dist.map(([, p]) => p));
  return (
    <figure>
      <figcaption className="mb-2 text-sm font-medium text-muted">
        {t("dice.sumOdds", { count: props.count })}
      </figcaption>
      <table className="w-full table-fixed border-separate border-spacing-x-0.5">
        <tbody>
          <tr className="h-24 align-bottom">
            {dist.map(([sum, p]) => (
              <td key={sum} title={`${sum}: ${percent(p)}`}>
                <div
                  className="mx-auto w-full rounded-t bg-accent/80"
                  style={{ height: `${Math.max(4, (p / max) * 88)}px` }}
                />
              </td>
            ))}
          </tr>
          <tr>
            {dist.map(([sum]) => (
              <th key={sum} scope="col" className="pt-1 text-center text-xs font-medium text-muted">
                {sum}
              </th>
            ))}
          </tr>
          <tr className="sr-only">
            {dist.map(([sum, p]) => (
              <td key={sum}>{percent(p)}</td>
            ))}
          </tr>
        </tbody>
      </table>
    </figure>
  );
}

/** For each roll in the flow using this die: chance of each outcome (first match wins). */
function OutcomeOdds(props: { die: Die }) {
  const { guide } = useGame();
  const { t } = useTranslation();
  const L = useL();
  const rolls = useMemo(
    () =>
      [...walkFlow(guide.flow)]
        .map((w) => w.node)
        .filter(
          (n): n is Extract<FlowNode, { kind: "roll" }> =>
            n.kind === "roll" && n.dieId === props.die.id,
        ),
    [guide.flow, props.die.id],
  );
  if (rolls.length === 0) return null;
  return (
    <div className="space-y-3">
      {rolls.map((roll) => {
        const odds = firstMatchOdds(props.die.faces, roll.count, roll.outcomes);
        return (
          <div key={roll.id}>
            <p className="mb-1 text-sm font-medium text-muted">
              {L(roll.title)} · {t("dice.outcomeOdds")}
            </p>
            <ul className="space-y-1" data-testid={`odds-${roll.id}`}>
              {roll.outcomes.map((o, i) => (
                <li key={L(o.label)} className="flex items-center gap-2">
                  <span className="w-36 shrink-0 truncate text-sm">{L(o.label)}</span>
                  <span className="h-3 flex-1 overflow-hidden rounded-full bg-surface-3">
                    <span
                      className="block h-full rounded-full bg-info"
                      style={{ width: `${(odds[i] ?? 0) * 100}%` }}
                    />
                  </span>
                  <span className="w-12 text-right text-sm font-semibold tabular-nums">
                    {percent(odds[i] ?? 0)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

function DicePanel({ module }: ModuleSlotProps<"dice">) {
  const { t } = useTranslation();
  const L = useL();
  return (
    <section className="space-y-4 rounded-2xl border border-line bg-surface p-4">
      <SectionTitle icon="dice">{module.title ? L(module.title) : t("dice.title")}</SectionTitle>
      {module.dice.map((die) => (
        <div key={die.id} className="space-y-3">
          <p className="font-medium">
            {L(die.name)} <span className="text-muted">× {die.count}</span>
          </p>
          <Faces die={die} />
          <OutcomeOdds die={die} />
          <SumBars die={die} count={die.count} />
        </div>
      ))}
      {module.rerollPolicy && (
        <Chip tone="info" icon="replay">
          {L(module.rerollPolicy)}
        </Chip>
      )}
      {module.modifiers?.map((m) => (
        <p key={m.id} className="text-sm text-muted">
          {L(m.text)}
        </p>
      ))}
      <RuleLinks ids={module.ruleRefs} />
    </section>
  );
}

function DiceLearnCard({ module }: ModuleSlotProps<"dice">) {
  const { t } = useTranslation();
  const L = useL();
  return (
    <section>
      <SectionTitle icon="dice">{t("dice.title")}</SectionTitle>
      <div className="space-y-3">
        {module.dice.map((die) => (
          <div key={die.id} className="space-y-2">
            <p className="font-medium">
              {L(die.name)} × {die.count}
            </p>
            <Faces die={die} />
          </div>
        ))}
        {module.rerollPolicy && <p className="text-muted">↻ {L(module.rerollPolicy)}</p>}
      </div>
    </section>
  );
}

export const diceRenderer: ModuleRenderer<"dice"> = {
  ReferencePanel: DicePanel,
  PlayWidget: DicePanel,
  LearnCard: DiceLearnCard,
};
