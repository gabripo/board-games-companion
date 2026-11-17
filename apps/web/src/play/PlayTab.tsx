import type { FlowNode } from "@bgc/schema";
import { useEffect, useReducer } from "react";
import { initStepper, stepperReducer, viewOf } from "../flow/stepper";
import { useGame } from "../game/GameProvider";
import { RuleLinks } from "../game/RuleSheet";
import { formatTime, useL, useTranslation } from "../i18n";
import { ModuleSlots } from "../modules/ModuleSlots";
import { Icon } from "../ui/Icon";
import { Button, Chip, cx, EmptyState } from "../ui/primitives";
import { TimerWidget } from "./TimerWidget";

/** Seats around the table; the active player is highlighted. */
function TurnIndicator(props: { player: number; count: number }) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-1" aria-hidden>
        {Array.from({ length: props.count }, (_, i) => i + 1).map((p) => (
          <span
            key={p}
            className={cx(
              "flex size-8 items-center justify-center rounded-full text-sm font-bold transition",
              p === props.player
                ? "scale-110 bg-accent text-accent-ink"
                : "bg-surface-3 text-muted",
            )}
          >
            {p}
          </span>
        ))}
      </div>
      <span className="text-sm font-medium" data-testid="current-player">
        {t("play.playerOf", { n: props.player, count: props.count })}
      </span>
    </div>
  );
}

function CurrentStep(props: {
  node: FlowNode;
  onChoose: (i: number) => void;
  onSkip: () => void;
  onRolled: (i: number) => void;
}) {
  const { node } = props;
  const L = useL();
  const { t } = useTranslation();
  const { openClip } = useGame();

  return (
    <article
      aria-live="polite"
      data-testid="play-current"
      className="space-y-3 rounded-2xl border-2 border-accent bg-surface p-5 shadow-lg"
    >
      <div className="flex flex-wrap items-center gap-2">
        {node.actor && <Chip tone="accent">{t(`actor.${node.actor}`)}</Chip>}
      </div>
      <h2 className="text-2xl leading-tight font-bold">{L(node.title)}</h2>
      {node.description && <p className="text-muted">{L(node.description)}</p>}
      {node.kind === "roll" && node.reroll && <p className="text-muted">↻ {L(node.reroll)}</p>}
      <RuleLinks ids={node.ruleRefs} />
      {node.clip && (
        <Button icon="video" onClick={() => node.clip && openClip(node.clip)}>
          {t("rule.watch")} · {formatTime(node.clip.start)}
        </Button>
      )}

      {node.kind === "choice" && (
        <div className="space-y-2 pt-1">
          <p className="font-medium">{t("play.pickOne")}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {node.options.map((o, i) => (
              <Button
                key={o.id}
                className="min-h-14 justify-start text-left"
                onClick={() => props.onChoose(i)}
              >
                {L(o.title)}
              </Button>
            ))}
          </div>
          {node.pick.min === 0 && (
            <Button variant="ghost" onClick={props.onSkip}>
              {t("play.skip")}
            </Button>
          )}
        </div>
      )}

      {node.kind === "roll" && (
        <div className="space-y-2 pt-1">
          <p className="font-medium">{t("play.iRolled")}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {node.outcomes.map((o, i) => (
              <Button
                key={L(o.label)}
                className="min-h-14 justify-start text-left"
                onClick={() => props.onRolled(i)}
              >
                <Icon name="dice" />
                {L(o.label)}
              </Button>
            ))}
          </div>
        </div>
      )}
    </article>
  );
}

function FlowStepper() {
  const { flow, session } = useGame();
  const { t } = useTranslation();
  const L = useL();
  const [state, dispatch] = useReducer(stepperReducer, undefined, () =>
    initStepper(flow, session.playerCount),
  );

  // Restart when the session changes the flow (player count, variants).
  useEffect(() => {
    dispatch({ type: "restart", flow, playerCount: session.playerCount });
  }, [flow, session.playerCount]);

  const view = viewOf(state);
  const pending = view.current?.kind === "choice" || view.current?.kind === "roll";

  if (!flow) return <EmptyState icon="question" title={t("learn.noFlow")} />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-surface-2 p-3">
        {view.player !== undefined ? (
          <TurnIndicator player={view.player} count={session.playerCount} />
        ) : view.simultaneous ? (
          <Chip tone="ok" icon="users">
            {t("flow.everyoneAtOnce")}
          </Chip>
        ) : (
          <span />
        )}
        {view.round !== undefined && (
          <span className="text-lg font-bold" data-testid="current-round">
            {t("play.round", { n: view.round })}
          </span>
        )}
      </div>

      {view.context.length > 0 && (
        <nav
          aria-label={t("play.whereAmI")}
          className="flex flex-wrap items-center gap-1 text-sm text-muted"
        >
          {view.context.map((n, i) => (
            <span key={n.id} className="flex items-center gap-1">
              {i > 0 && <Icon name="forward" size={14} />}
              {L(n.title)}
            </span>
          ))}
        </nav>
      )}

      {view.timer && <TimerWidget durationSeconds={view.timer.durationSeconds} />}

      {view.done || !view.current ? (
        <div className="space-y-3 rounded-2xl border-2 border-ok bg-ok/10 p-5 text-center">
          <Icon name="sparkle" size={36} className="mx-auto text-ok" />
          <p className="text-2xl font-bold">{t("play.gameOver")}</p>
          <Button
            variant="primary"
            onClick={() => dispatch({ type: "restart", flow, playerCount: session.playerCount })}
          >
            {t("play.restart")}
          </Button>
        </div>
      ) : (
        <CurrentStep
          node={view.current}
          onChoose={(option) => dispatch({ type: "choose", option })}
          onSkip={() => dispatch({ type: "skipChoice" })}
          onRolled={(outcome) => dispatch({ type: "rolled", outcome })}
        />
      )}

      {view.reminders.length > 0 && (
        <ul className="space-y-2" aria-label={t("play.reminders")}>
          {view.reminders.map((r) => (
            <li
              key={r.id}
              className="flex gap-2 rounded-xl border border-warn/50 bg-warn/10 p-3 text-sm"
            >
              <Icon name="bolt" className="mt-0.5 shrink-0 text-warn" />
              <span>
                <span className="font-semibold">{t("flow.when", { condition: L(r.when) })}</span>
                {" → "}
                {r.children.map((c) => L(c.title)).join(", ")}
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="sticky bottom-20 z-10 flex gap-2 rounded-2xl bg-bg/90 py-2 backdrop-blur">
        <Button
          icon="back"
          className="min-h-14 flex-1"
          disabled={!view.canGoBack}
          onClick={() => dispatch({ type: "back" })}
          aria-label={t("common.previous")}
        />
        <Button
          variant="primary"
          className="min-h-14 flex-[3] text-lg"
          disabled={view.done || pending}
          onClick={() => dispatch({ type: "next" })}
        >
          {t("common.next")}
          <Icon name="forward" />
        </Button>
      </div>

      {view.loop && !view.done && (
        <Button
          variant="ghost"
          icon="loop"
          className="w-full"
          onClick={() => dispatch({ type: "endLoop" })}
        >
          {t("play.endLoop", { condition: L(view.loop.until) })}
        </Button>
      )}
    </div>
  );
}

export function PlayTab() {
  return (
    <div className="space-y-8 p-4">
      <FlowStepper />
      <ModuleSlots slot="PlayWidget" />
    </div>
  );
}
