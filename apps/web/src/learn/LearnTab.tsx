import { humanizeId } from "@bgc/schema";
import { Link } from "@tanstack/react-router";
import { GameLoopView } from "../flow/GameLoopView";
import { useGame } from "../game/GameProvider";
import { RuleLinks } from "../game/RuleSheet";
import { useSessionFilter } from "../game/useSessionFilter";
import { useL, useTranslation } from "../i18n";
import { ModuleSlots, moduleAnchor, useSlotModules } from "../modules/ModuleSlots";
import { OfflineButton } from "../offline/OfflineButton";
import { SceneCrop } from "../scenes/SceneCrop";
import { Icon } from "../ui/Icon";
import { Button, Card, Chip, EmptyState, SectionTitle } from "../ui/primitives";
import { SetupChecklist } from "./SetupChecklist";

function Overview() {
  const { guide } = useGame();
  const { t } = useTranslation();
  const L = useL();
  const o = guide.guides.overview;
  return (
    <Card as="section" className="space-y-3 bg-gradient-to-br from-accent/15 to-surface">
      <p className="text-lg leading-snug font-medium">{L(o.pitch)}</p>
      <dl className="grid gap-3 sm:grid-cols-2">
        <div>
          <dt className="text-sm font-semibold text-accent">{t("learn.goal")}</dt>
          <dd>{L(o.goal)}</dd>
        </div>
        <div>
          <dt className="text-sm font-semibold text-accent">{t("learn.howToWin")}</dt>
          <dd>{L(o.howToWin)}</dd>
        </div>
      </dl>
      {guide.guides.coreLoop && <p className="text-muted">{L(guide.guides.coreLoop)}</p>}
    </Card>
  );
}

const ANCHOR = {
  loop: "learn-loop",
  setup: "learn-setup",
  walkthroughs: "learn-walkthroughs",
  glossary: "learn-glossary",
} as const;

function jumpTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

/** Clickable shortcuts to the sections below the overview. */
function Shortcuts() {
  const { guide, isApplicable } = useGame();
  const { t } = useTranslation();
  const L = useL();
  const modules = useSlotModules("LearnCard").filter((m) => isApplicable(m.conditions));
  const links: { id: string; label: string }[] = [
    { id: ANCHOR.loop, label: t("learn.gameLoop") },
    { id: ANCHOR.setup, label: t("setup.title") },
    ...(guide.walkthroughs.some((w) => isApplicable(w.conditions))
      ? [{ id: ANCHOR.walkthroughs, label: t("learn.walkthroughs") }]
      : []),
    ...(guide.glossary.length > 0 ? [{ id: ANCHOR.glossary, label: t("learn.glossary") }] : []),
    ...modules.map((m) => ({
      id: moduleAnchor(m.id, "LearnCard"),
      label: m.title ? L(m.title) : humanizeId(m.id),
    })),
  ];
  return (
    <nav
      aria-label={t("learn.jumpTo")}
      className="flex flex-wrap gap-2"
      data-testid="learn-shortcuts"
    >
      {links.map((l) => (
        <Chip key={l.id} tone="accent" icon="forward" onClick={() => jumpTo(l.id)}>
          {l.label}
        </Chip>
      ))}
    </nav>
  );
}

function Walkthroughs() {
  const { guide, isApplicable } = useGame();
  const { t } = useTranslation();
  const L = useL();
  const list = guide.walkthroughs.filter((w) => isApplicable(w.conditions));
  if (list.length === 0) return null;
  return (
    <section id={ANCHOR.walkthroughs} className="scroll-mt-4">
      <SectionTitle icon="sparkle">{t("learn.walkthroughs")}</SectionTitle>
      <ul className="space-y-2">
        {list.map((w) => {
          const first = w.steps[0];
          return (
            <li key={w.id}>
              <Link
                to="/game/$gameId/walkthrough/$walkthroughId"
                params={{ gameId: guide.id, walkthroughId: w.id }}
                className="flex items-center gap-3 rounded-2xl border border-accent/50 bg-accent/10 p-3 hover:bg-accent/20"
              >
                {first?.sceneId ? (
                  <SceneCrop sceneRef={{ sceneId: first.sceneId }} className="h-14 w-20" />
                ) : (
                  <Icon name="sparkle" size={28} className="text-accent" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{L(w.title)}</span>
                  <span className="text-sm text-muted">
                    {t("learn.steps", { count: w.steps.length })}
                  </span>
                </span>
                <Icon name="forward" className="text-accent" />
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Glossary() {
  const { guide } = useGame();
  const { t } = useTranslation();
  const L = useL();
  const filter = useSessionFilter(guide.glossary);
  if (guide.glossary.length === 0) return null;
  return (
    <section id={ANCHOR.glossary} className="scroll-mt-4">
      <SectionTitle icon="learn">{t("learn.glossary")}</SectionTitle>
      <ul className="grid gap-2 sm:grid-cols-2">
        {filter.items.map((g) => (
          <li
            key={g.id}
            className={`flex gap-3 rounded-xl border bg-surface p-3 ${
              filter.isApplicable(g) ? "border-line" : "border-dashed border-line opacity-70"
            }`}
          >
            {g.icon && <SceneCrop sceneRef={g.icon} className="size-12" />}
            <div className="min-w-0">
              <p className="font-semibold">{L(g.term)}</p>
              <p className="text-sm text-muted">{L(g.definition)}</p>
              <RuleLinks ids={g.ruleRefs} />
            </div>
          </li>
        ))}
      </ul>
      {filter.hiddenCount > 0 && (
        <Button variant="ghost" icon="eye" className="mt-3" onClick={filter.toggle}>
          {filter.showAll
            ? t("learn.hideOtherTerms")
            : t("learn.showOtherTerms", { count: filter.hiddenCount })}
        </Button>
      )}
    </section>
  );
}

export function LearnTab() {
  const { flow, guide } = useGame();
  const { t } = useTranslation();
  return (
    <div className="space-y-8 p-4">
      <Overview />
      <Shortcuts />
      <OfflineButton />
      <section id={ANCHOR.loop} className="scroll-mt-4">
        <SectionTitle
          icon="loop"
          action={<Chip tone="accent">{t(`turnModel.${guide.classification.turnModel}`)}</Chip>}
        >
          {t("learn.gameLoop")}
        </SectionTitle>
        {flow ? (
          <GameLoopView node={flow} />
        ) : (
          <EmptyState icon="question" title={t("learn.noFlow")} />
        )}
      </section>
      <div id={ANCHOR.setup} className="scroll-mt-4">
        <SetupChecklist />
      </div>
      <Walkthroughs />
      <Glossary />
      <ModuleSlots slot="LearnCard" />
    </div>
  );
}
