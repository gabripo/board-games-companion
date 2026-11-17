import { walkFlow } from "@bgc/schema";
import { getRouteApi, Link, useNavigate } from "@tanstack/react-router";
import { motion } from "motion/react";
import { useMemo, useRef, useState } from "react";
import { ClipPlayer } from "../game/ClipSheet";
import { useGame } from "../game/GameProvider";
import { useL, useTranslation } from "../i18n";
import { useWakeLock } from "../offline/useWakeLock";
import { SceneViewer } from "../scenes/SceneViewer";
import { Icon } from "../ui/Icon";
import { Button, Chip, cx, EmptyState } from "../ui/primitives";

const route = getRouteApi("/game/$gameId/walkthrough/$walkthroughId");

type CheckState = { tapped: string; correct: boolean } | undefined;

/** Full-screen "story mode": scene zooms to each step, annotations animate in, "Try it" checks. */
export function WalkthroughScreen() {
  const { walkthroughId } = route.useParams();
  const { guide } = useGame();
  const { t } = useTranslation();
  const L = useL();
  const navigate = useNavigate();
  const [index, setIndex] = useState(0);
  const [check, setCheck] = useState<CheckState>();
  const [showClip, setShowClip] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const swipe = useRef<number | null>(null);
  useWakeLock();

  const walkthrough = guide.walkthroughs.find((w) => w.id === walkthroughId);
  const flowTitles = useMemo(
    () => new Map([...walkFlow(guide.flow)].map(({ node }) => [node.id, node.title])),
    [guide.flow],
  );

  if (!walkthrough) {
    return (
      <EmptyState icon="question" title={t("story.notFound")}>
        <Link to="/game/$gameId" params={{ gameId: guide.id }} className="text-accent">
          {t("common.back")}
        </Link>
      </EmptyState>
    );
  }

  const steps = walkthrough.steps;
  const step = steps[Math.min(index, steps.length - 1)];
  if (!step) return null;
  const scene = guide.scenes.find((s) => s.id === step.sceneId);
  const isLast = index === steps.length - 1;
  const locked = step.check !== undefined && !check?.correct && !revealed;
  const exit = () =>
    void navigate({ to: "/game/$gameId", params: { gameId: guide.id }, search: { tab: "learn" } });

  const go = (delta: number) => {
    const next = index + delta;
    if (next < 0) return;
    if (next >= steps.length) return exit();
    setIndex(next);
    setCheck(undefined);
    setShowClip(false);
    setRevealed(false);
  };

  const flowTitle = step.flowNodeRef ? flowTitles.get(step.flowNodeRef) : undefined;
  const answerId = step.check?.answerHotspotId;

  return (
    <div className="flex h-dvh flex-col bg-bg">
      <header className="pt-safe flex items-center gap-2 border-b border-line px-2 py-1.5">
        <button
          type="button"
          onClick={exit}
          aria-label={t("common.close")}
          className="inline-flex size-11 items-center justify-center rounded-xl hover:bg-surface-2"
        >
          <Icon name="close" size={22} />
        </button>
        <h1 className="min-w-0 flex-1 truncate font-semibold">{L(walkthrough.title)}</h1>
        <span className="pr-2 text-sm text-muted" aria-live="polite">
          {t("story.progress", { current: index + 1, total: steps.length })}
        </span>
      </header>

      <div className="relative min-h-0 flex-[3] p-2">
        {scene ? (
          <SceneViewer
            scene={scene}
            focus={step.focus}
            highlight={[
              ...(step.highlightHotspots ?? []),
              ...(revealed && answerId ? [answerId] : []),
            ]}
            annotationIds={step.annotations}
            outlines={step.check !== undefined}
            onHotspotTap={
              step.check
                ? (h) => setCheck({ tapped: h.id, correct: h.id === step.check?.answerHotspotId })
                : undefined
            }
            feedback={check ? { hotspotId: check.tapped, correct: check.correct } : undefined}
            className="flex h-full items-center"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-accent">
            <Icon name="sparkle" size={64} />
          </div>
        )}
      </div>

      <section
        aria-live="polite"
        className="pb-safe flex flex-[2] flex-col gap-3 overflow-y-auto border-t border-line bg-surface p-4"
        onPointerDown={(e) => {
          swipe.current = e.clientX;
        }}
        onPointerUp={(e) => {
          if (swipe.current === null) return;
          const dx = e.clientX - swipe.current;
          swipe.current = null;
          if (Math.abs(dx) > 70) {
            if (dx < 0 && !locked) go(1);
            if (dx > 0) go(-1);
          }
        }}
      >
        <motion.div
          key={step.id}
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.2 }}
          className="space-y-3"
        >
          {flowTitle && <Chip tone="accent">{L(flowTitle)}</Chip>}
          <p className="text-xl leading-snug font-medium" data-testid="story-text">
            {L(step.text)}
          </p>

          {step.check && (
            <div
              className={cx(
                "rounded-xl border p-3",
                check?.correct
                  ? "border-ok bg-ok/10"
                  : check
                    ? "border-bad bg-bad/10"
                    : "border-info bg-info/10",
              )}
            >
              <p className="flex items-center gap-2 font-semibold">
                <Icon name="target" />
                {t("story.tryIt")} {L(step.check.question)}
              </p>
              {check && (
                <p
                  className={cx("mt-1 font-medium", check.correct ? "text-ok" : "text-bad")}
                  role="status"
                >
                  {check.correct ? t("story.correct") : t("story.tryAgain")}
                </p>
              )}
              {(check?.correct || revealed) && step.check.explanation && (
                <p className="mt-1 text-muted">{L(step.check.explanation)}</p>
              )}
              {!check?.correct && !revealed && (
                <button
                  type="button"
                  className="mt-1 min-h-8 text-sm text-accent"
                  onClick={() => setRevealed(true)}
                >
                  {t("story.showMe")}
                </button>
              )}
            </div>
          )}

          {step.clip &&
            (showClip ? (
              <ClipPlayer clip={step.clip} />
            ) : (
              <Button icon="video" onClick={() => setShowClip(true)}>
                {t("story.seeIt")}
              </Button>
            ))}
        </motion.div>

        <div className="mt-auto flex items-center gap-3 pt-2">
          <Button
            icon="back"
            onClick={() => go(-1)}
            disabled={index === 0}
            className="min-h-14 flex-1"
            aria-label={t("common.previous")}
          />
          <ol className="flex gap-1.5" aria-hidden>
            {steps.map((s, i) => (
              <li
                key={s.id}
                className={cx(
                  "size-2 rounded-full",
                  i === index ? "bg-accent" : i < index ? "bg-ok" : "bg-line",
                )}
              />
            ))}
          </ol>
          <Button
            variant="primary"
            onClick={() => go(1)}
            disabled={locked}
            className="min-h-14 flex-[2] text-lg"
          >
            {isLast ? t("story.finish") : t("common.next")}
            {!isLast && <Icon name="forward" />}
          </Button>
        </div>
      </section>
    </div>
  );
}
