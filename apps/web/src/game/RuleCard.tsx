import type { Citation, Conditions, GameGuide, Rule, SceneRef, YouTubeClip } from "@bgc/schema";
import { useState } from "react";
import { formatTime, useL, useTranslation } from "../i18n";
import { Icon } from "../ui/Icon";
import { Button, Chip, cx } from "../ui/primitives";
import { useGame } from "./GameProvider";

/** Human label for content conditions, e.g. "2 players · Duel". */
export function useConditionLabel(): (c: Conditions | undefined) => string | undefined {
  const { t } = useTranslation();
  const L = useL();
  const { guide } = useGame();
  return (c) => {
    if (!c) return undefined;
    const parts: string[] = [];
    if (c.playerCount) parts.push(t("conditions.players", { list: c.playerCount.join(", ") }));
    for (const v of c.variants ?? []) {
      const name = guide.variants.find((x) => x.id === v)?.name;
      parts.push(name ? L(name) : v);
    }
    for (const e of c.expansions ?? []) {
      const name = guide.expansions.find((x) => x.id === e)?.name;
      parts.push(name ? L(name) : e);
    }
    return parts.length > 0 ? parts.join(" · ") : undefined;
  };
}

/** A clip for a time citation, built from its video source. */
export function citationClip(guide: GameGuide, c: Citation): YouTubeClip | undefined {
  if (c.kind !== "time") return undefined;
  const source = guide.sources.find((s) => s.id === c.sourceId);
  if (source?.type !== "video") return undefined;
  return {
    videoId: source.videoId,
    start: c.tStart,
    end: c.tEnd,
    lang: source.lang === "it" ? "it" : "en",
  };
}

export function CitationChip(props: { citation: Citation }) {
  const { t } = useTranslation();
  const { guide, openClip } = useGame();
  const c = props.citation;
  const source = guide.sources.find((s) => s.id === c.sourceId);
  const official = source?.official ? ` (${t("citation.official")})` : "";

  if (c.kind === "page") {
    return (
      <span title={`${source?.title ?? c.sourceId}${official}`}>
        <Chip icon="page" tone={source?.official ? "ok" : "neutral"}>
          {t("citation.page", { page: c.page })}
        </Chip>
      </span>
    );
  }
  if (c.kind === "time") {
    const clip = citationClip(guide, c);
    return (
      <Chip
        icon="video"
        tone="info"
        label={t("citation.watchAt", { time: formatTime(c.tStart) })}
        {...(clip ? { onClick: () => openClip(clip) } : {})}
      >
        {formatTime(c.tStart)}
      </Chip>
    );
  }
  const href =
    source?.type === "web" ? `${source.url}${c.anchor ? `#${c.anchor}` : ""}` : undefined;
  return (
    <a href={href} target="_blank" rel="noreferrer" title={source?.title}>
      <Chip icon="link" tone="info">
        {t("citation.web")}
      </Chip>
    </a>
  );
}

/** First place on a board this rule can be shown: its own sceneRefs, else a hotspot citing it. */
export function ruleSceneRef(guide: GameGuide, rule: Rule): SceneRef | undefined {
  if (rule.sceneRefs?.[0]) return rule.sceneRefs[0];
  for (const scene of guide.scenes) {
    const h = scene.hotspots.find((hs) => hs.ruleRefs?.includes(rule.id));
    if (h) return { sceneId: scene.id, hotspotId: h.id };
  }
  return undefined;
}

/** The atomic UI unit: summary, detail, chips, "Show on board" and "Watch". */
export function RuleCard(props: { rule: Rule; defaultExpanded?: boolean; compact?: boolean }) {
  const { rule } = props;
  const { t } = useTranslation();
  const L = useL();
  const game = useGame();
  const conditionLabel = useConditionLabel();
  const [expanded, setExpanded] = useState(props.defaultExpanded ?? game.level !== "experienced");
  const [showConflicts, setShowConflicts] = useState(false);
  const sceneRef = ruleSceneRef(game.guide, rule);
  const clip = rule.clips?.[0];
  const condition = conditionLabel(rule.conditions);
  const applicable = game.isApplicable(rule.conditions);

  return (
    <article
      aria-labelledby={`rule-${rule.id}`}
      data-testid={`rule-${rule.id}`}
      className={cx(
        "rounded-2xl border bg-surface p-4",
        applicable ? "border-line" : "border-dashed border-line opacity-70",
      )}
    >
      <h3
        id={`rule-${rule.id}`}
        className={cx("font-semibold", props.compact ? "text-base" : "text-lg")}
      >
        {L(rule.summary)}
      </h3>

      {rule.detail && (
        <>
          {expanded && <p className="mt-2 text-muted">{L(rule.detail)}</p>}
          <button
            type="button"
            className="mt-1 min-h-8 text-sm font-medium text-accent"
            aria-expanded={expanded}
            onClick={() => setExpanded((e) => !e)}
          >
            {expanded ? t("rule.less") : t("rule.more")}
          </button>
        </>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {condition && (
          <Chip tone="accent" icon="users">
            {condition}
          </Chip>
        )}
        {rule.citations.map((c) => (
          <CitationChip key={`${c.sourceId}-${JSON.stringify(c)}`} citation={c} />
        ))}
        {(rule.conflicts?.length ?? 0) > 0 && (
          <Chip tone="warn" icon="warning" onClick={() => setShowConflicts((s) => !s)}>
            {t("rule.commonMistake")}
          </Chip>
        )}
        {rule.confidence === "low" && (
          <Chip tone="warn" icon="question">
            {t("rule.unverified")}
          </Chip>
        )}
        {!props.compact &&
          rule.topics.map((topic) => (
            <Chip key={topic} className="opacity-80">
              #{L(game.topicName(topic))}
            </Chip>
          ))}
      </div>

      {showConflicts && (
        <ul className="mt-3 space-y-2">
          {rule.conflicts?.map((c) => (
            <li key={JSON.stringify(c.citation)} className="rounded-xl bg-surface-2 p-3 text-sm">
              <p className="text-bad line-through decoration-2">{L(c.claim)}</p>
              <p className="mt-1 flex gap-1.5 text-ok">
                <Icon name="check" size={16} className="mt-0.5 shrink-0" />
                {L(c.resolution)}
              </p>
            </li>
          ))}
        </ul>
      )}

      {(sceneRef || clip) && (
        <div className="mt-3 flex flex-wrap gap-2">
          {sceneRef && (
            <Button icon="target" onClick={() => game.showOnBoard(sceneRef)}>
              {t("rule.showOnBoard")}
            </Button>
          )}
          {clip && (
            <Button icon="video" onClick={() => game.openClip(clip)}>
              {t("rule.watch")}
            </Button>
          )}
        </div>
      )}
    </article>
  );
}
