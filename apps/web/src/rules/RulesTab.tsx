import { useEffect, useMemo, useRef, useState } from "react";
import { useGame } from "../game/GameProvider";
import { CitationChip, RuleCard } from "../game/RuleCard";
import { RuleLinks } from "../game/RuleSheet";
import { useL, useLocale, useTranslation } from "../i18n";
import { ModuleSlots } from "../modules/ModuleSlots";
import { OfflineButton } from "../offline/OfflineButton";
import { Icon } from "../ui/Icon";
import { Accordion, Button, Chip, EmptyState, SectionTitle } from "../ui/primitives";
import { buildRuleSearch } from "./search";

function MythVsRule() {
  const { guide } = useGame();
  const { t } = useTranslation();
  const L = useL();
  const myths = guide.guides.misconceptions;
  if (myths.length === 0) return null;
  return (
    <section>
      <SectionTitle icon="warning">{t("rules.myths")}</SectionTitle>
      <ul className="space-y-2">
        {myths.map((m) => (
          <li key={m.id} className="rounded-2xl border border-line bg-surface p-4">
            <p className="flex gap-2 text-bad">
              <Icon name="close" className="mt-0.5 shrink-0" />
              <span className="line-through decoration-2">{L(m.myth)}</span>
            </p>
            <p className="mt-2 flex gap-2 font-medium text-ok">
              <Icon name="check" className="mt-0.5 shrink-0" />
              {L(m.rule)}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {m.citations.map((c) => (
                <CitationChip key={JSON.stringify(c)} citation={c} />
              ))}
            </div>
            <RuleLinks ids={m.ruleRefs} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function EdgeCases() {
  const { guide, level } = useGame();
  const { t } = useTranslation();
  const L = useL();
  const cases = guide.guides.edgeCases;
  if (cases.length === 0) return null;
  return (
    <section>
      <SectionTitle icon="question">{t("rules.edgeCases")}</SectionTitle>
      <div className="space-y-2">
        {cases.map((e) => (
          <Accordion key={e.id} summary={L(e.question)} defaultOpen={level === "experienced"}>
            <p className="text-ink">{L(e.answer)}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {e.citations.map((c) => (
                <CitationChip key={JSON.stringify(c)} citation={c} />
              ))}
            </div>
            <RuleLinks ids={e.ruleRefs} />
          </Accordion>
        ))}
      </div>
    </section>
  );
}

export function RulesTab() {
  const { guide, isApplicable, level } = useGame();
  const { t } = useTranslation();
  const lang = useLocale();
  const [query, setQuery] = useState("");
  const [topic, setTopic] = useState<string | undefined>();
  const [allPlayerCounts, setAllPlayerCounts] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const index = useMemo(() => buildRuleSearch(guide, lang), [guide, lang]);
  const topics = useMemo(() => [...new Set(guide.rules.flatMap((r) => r.topics))].sort(), [guide]);

  // Experienced players come here to look something up: focus search on open.
  useEffect(() => {
    if (level === "experienced") inputRef.current?.focus({ preventScroll: true });
  }, [level]);

  const ordered = query.trim()
    ? index.search(query).flatMap((id) => guide.rules.find((r) => r.id === id) ?? [])
    : guide.rules;
  const byTopic = topic ? ordered.filter((r) => r.topics.includes(topic)) : ordered;
  const visible = allPlayerCounts ? byTopic : byTopic.filter((r) => isApplicable(r.conditions));
  const hiddenCount = byTopic.length - byTopic.filter((r) => isApplicable(r.conditions)).length;

  return (
    <div className="space-y-8 p-4">
      <section aria-label={t("rules.title")} className="space-y-3">
        <div className="sticky top-[7.5rem] z-10 -mx-4 bg-bg/95 px-4 pt-1 pb-2 backdrop-blur sm:top-16">
          <label className="flex items-center gap-2 rounded-xl border border-line bg-surface px-3 focus-within:border-accent">
            <Icon name="search" className="text-muted" />
            <span className="sr-only">{t("rules.search")}</span>
            <input
              ref={inputRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("rules.searchPlaceholder")}
              className="min-h-12 flex-1 bg-transparent text-base outline-none placeholder:text-muted focus-visible:outline-none"
            />
          </label>
          <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1">
            <Chip tone={topic ? "neutral" : "accent"} onClick={() => setTopic(undefined)}>
              {t("rules.allTopics")}
            </Chip>
            {topics.map((tp) => (
              <Chip
                key={tp}
                tone={tp === topic ? "accent" : "neutral"}
                onClick={() => setTopic(tp)}
              >
                #{tp}
              </Chip>
            ))}
          </div>
        </div>

        <p className="text-sm text-muted" aria-live="polite">
          {t("rules.count", { count: visible.length })}
        </p>
        {visible.length === 0 ? (
          <EmptyState icon="search" title={t("rules.noResults")} />
        ) : (
          <div className="space-y-3">
            {visible.map((r) => (
              <RuleCard key={r.id} rule={r} />
            ))}
          </div>
        )}
        {hiddenCount > 0 && (
          <Button variant="ghost" icon="users" onClick={() => setAllPlayerCounts((s) => !s)}>
            {allPlayerCounts
              ? t("rules.onlyThisSession")
              : t("rules.showOther", { count: hiddenCount })}
          </Button>
        )}
      </section>
      <MythVsRule />
      <EdgeCases />
      <ModuleSlots slot="ReferencePanel" />
      <OfflineButton />
    </div>
  );
}
