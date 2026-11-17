import { useGame } from "../../game/GameProvider";
import { RuleLinks } from "../../game/RuleSheet";
import { useL, useTranslation } from "../../i18n";
import { Button, Chip, SectionTitle } from "../../ui/primitives";
import type { ModuleRenderer, ModuleSlotProps } from "../registry";

const SEGMENT_COLORS = ["var(--accent)", "var(--info)", "var(--ok)", "var(--bad)", "var(--muted)"];

/** Deck composition as a stacked bar + legend, hand limit and card anatomy link. */
function CardsPanel({ module }: ModuleSlotProps<"cards">) {
  const { showOnBoard } = useGame();
  const { t } = useTranslation();
  const L = useL();
  return (
    <section className="space-y-4">
      <SectionTitle icon="layers">{module.title ? L(module.title) : t("cards.title")}</SectionTitle>
      {module.decks.map((deck) => (
        <div key={deck.id} className="space-y-2 rounded-xl border border-line bg-surface p-3">
          <p className="font-semibold">
            {L(deck.name)}{" "}
            <span className="font-normal text-muted">
              · {t("cards.count", { count: deck.count })}
            </span>
          </p>
          {deck.composition && (
            <>
              <div className="flex h-4 overflow-hidden rounded-full" aria-hidden>
                {deck.composition.map((c, i) => (
                  <span
                    key={c.id}
                    style={{
                      width: `${(c.count / deck.count) * 100}%`,
                      background: SEGMENT_COLORS[i % SEGMENT_COLORS.length],
                    }}
                  />
                ))}
              </div>
              <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                {deck.composition.map((c, i) => (
                  <li key={c.id} className="flex items-center gap-1.5">
                    <span
                      className="size-3 rounded-sm"
                      style={{ background: SEGMENT_COLORS[i % SEGMENT_COLORS.length] }}
                    />
                    {L(c.label)} <span className="tabular-nums text-muted">× {c.count}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      ))}
      {module.handLimit && (
        <Chip tone="info" icon="layers">
          {t("cards.handLimit")}: {L(module.handLimit)}
        </Chip>
      )}
      {module.anatomy && (
        <Button
          icon="target"
          onClick={() => module.anatomy && showOnBoard({ sceneId: module.anatomy.sceneId })}
        >
          {t("cards.anatomy")}
        </Button>
      )}
      <RuleLinks ids={module.ruleRefs} />
    </section>
  );
}

export const cardsRenderer: ModuleRenderer<"cards"> = {
  ReferencePanel: CardsPanel,
  LearnCard: CardsPanel,
};
