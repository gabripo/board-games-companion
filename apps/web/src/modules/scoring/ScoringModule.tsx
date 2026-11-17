import { useState } from "react";
import { useGame } from "../../game/GameProvider";
import { RuleLinks } from "../../game/RuleSheet";
import { useL, useTranslation } from "../../i18n";
import { readJson, writeJson } from "../../settings/store";
import { Button, Chip, SectionTitle } from "../../ui/primitives";
import type { ModuleRenderer, ModuleSlotProps } from "../registry";

type Scores = Record<string, Record<number, number>>;

function sessionStore(): Storage | undefined {
  try {
    return globalThis.sessionStorage;
  } catch {
    return undefined;
  }
}

/** End-game calculator: players × categories, totals and tie-breakers (kept for this tab session). */
function ScoringCalculator({ module }: ModuleSlotProps<"scoring">) {
  const { guide, session } = useGame();
  const { t } = useTranslation();
  const L = useL();
  const key = `bgc:scores:${guide.id}:${module.id}`;
  const [scores, setScores] = useState<Scores>(() => readJson<Scores>(key, {}, sessionStore()));
  const players = Array.from({ length: session.playerCount }, (_, i) => i + 1);

  const update = (next: Scores) => {
    setScores(next);
    writeJson(key, next, sessionStore());
  };
  const setScore = (category: string, player: number, raw: string) => {
    const n = Number.parseInt(raw, 10);
    const row = { ...(scores[category] ?? {}) };
    if (Number.isNaN(n)) delete row[player];
    else row[player] = n;
    update({ ...scores, [category]: row });
  };
  const total = (p: number) =>
    module.categories.reduce((sum, c) => sum + (scores[c.id]?.[p] ?? 0), 0);
  const totals = players.map(total);
  const best = Math.max(...totals);
  const anyScore = totals.some((v) => v !== 0);

  return (
    <section className="space-y-3 rounded-2xl border border-line bg-surface p-4">
      <SectionTitle icon="list">{t("scoring.calculator")}</SectionTitle>
      <div className="-mx-4 overflow-x-auto px-4">
        <table className="w-full border-separate border-spacing-1 text-sm">
          <thead>
            <tr>
              <th scope="col" className="text-left font-medium text-muted">
                {t("scoring.category")}
              </th>
              {players.map((p) => (
                <th key={p} scope="col" className="min-w-14 font-semibold">
                  {t("scoring.playerShort", { n: p })}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {module.categories.map((c) => (
              <tr key={c.id}>
                <th scope="row" className="max-w-32 text-left font-medium">
                  {L(c.name)}
                </th>
                {players.map((p) => (
                  <td key={p}>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={c.allowsNegative ? undefined : 0}
                      aria-label={t("scoring.cell", { category: L(c.name), n: p })}
                      value={scores[c.id]?.[p] ?? ""}
                      onChange={(e) => setScore(c.id, p, e.target.value)}
                      className="h-11 w-full min-w-14 rounded-lg border border-line bg-surface-2 text-center text-base tabular-nums focus:border-accent focus:outline-none"
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row" className="text-left font-bold">
                {t("scoring.total")}
              </th>
              {players.map((p, i) => (
                <td
                  key={p}
                  data-testid={`total-${p}`}
                  className={`text-center text-lg font-bold tabular-nums ${anyScore && totals[i] === best ? "text-accent" : ""}`}
                >
                  {totals[i]}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
      {module.tieBreakers.length > 0 && (
        <div className="text-sm">
          <p className="font-medium">{t("scoring.tieBreakers")}</p>
          <ol className="list-inside list-decimal text-muted">
            {module.tieBreakers.map((tb) => (
              <li key={L(tb)}>{L(tb)}</li>
            ))}
          </ol>
        </div>
      )}
      {anyScore && (
        <Button variant="ghost" icon="replay" onClick={() => update({})}>
          {t("scoring.reset")}
        </Button>
      )}
    </section>
  );
}

function ScoringReference({ module }: ModuleSlotProps<"scoring">) {
  const { t } = useTranslation();
  const L = useL();
  return (
    <section>
      <SectionTitle icon="list">{module.title ? L(module.title) : t("scoring.title")}</SectionTitle>
      <ul className="space-y-2">
        {module.categories.map((c) => (
          <li key={c.id} className="rounded-xl border border-line bg-surface p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">{L(c.name)}</span>
              <Chip tone={c.timing === "end-game" ? "accent" : "info"}>
                {t(`scoring.timing.${c.timing}`)}
              </Chip>
            </div>
            <p className="mt-1 text-sm text-muted">{L(c.description)}</p>
            <RuleLinks ids={c.ruleRefs} />
          </li>
        ))}
      </ul>
      {module.tieBreakers.length > 0 && (
        <p className="mt-2 text-sm text-muted">
          {t("scoring.tieBreakers")}: {module.tieBreakers.map((tb) => L(tb)).join(" → ")}
        </p>
      )}
    </section>
  );
}

export const scoringRenderer: ModuleRenderer<"scoring"> = {
  ReferencePanel: ScoringReference,
  PlayWidget: ScoringCalculator,
};
