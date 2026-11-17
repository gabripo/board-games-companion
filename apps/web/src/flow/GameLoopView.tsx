import type { FlowNode } from "@bgc/schema";
import type { ReactNode } from "react";
import { useGame } from "../game/GameProvider";
import { RuleLinks } from "../game/RuleSheet";
import { formatTime, useL, useTranslation } from "../i18n";
import { Icon, type IconName } from "../ui/Icon";
import { Chip, cx } from "../ui/primitives";

/**
 * Renders any game's flow graph (already pruned to the session) as a vertical, mobile-first
 * diagram. One visual per node kind — never game-specific code.
 */
export function GameLoopView(props: { node: FlowNode }) {
  return (
    <div className="space-y-3" data-testid="game-loop">
      <FlowNodeView node={props.node} depth={0} />
    </div>
  );
}

function NodeHeader(props: { node: FlowNode; icon?: IconName; badge?: ReactNode }) {
  const { node } = props;
  const L = useL();
  const { t } = useTranslation();
  const { openClip } = useGame();
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        {props.icon && <Icon name={props.icon} className="text-accent" />}
        <h3 className="font-semibold">{L(node.title)}</h3>
        {props.badge}
        {node.actor && <Chip>{t(`actor.${node.actor}`)}</Chip>}
        {node.clip && (
          <Chip icon="video" tone="info" onClick={() => node.clip && openClip(node.clip)}>
            {formatTime(node.clip.start)}
          </Chip>
        )}
      </div>
      {node.description && <p className="mt-1 text-sm text-muted">{L(node.description)}</p>}
      <RuleLinks ids={node.ruleRefs} />
    </div>
  );
}

function Frame(props: {
  children: ReactNode;
  tone: "loop" | "turn" | "parallel" | "timer";
  testId: string;
}) {
  const tones = {
    loop: "border-accent/50 bg-accent/5",
    turn: "border-info/50 bg-info/5",
    parallel: "border-ok/50 bg-ok/5",
    timer: "border-bad/50 bg-bad/5",
  };
  return (
    <section
      data-testid={props.testId}
      className={cx("space-y-3 rounded-2xl border-2 border-dashed p-3", tones[props.tone])}
    >
      {props.children}
    </section>
  );
}

/** Ordered children with numbered dots on a connecting line. */
function Steps(props: { nodes: FlowNode[]; depth: number }) {
  return (
    <ol className="relative space-y-3">
      {props.nodes.map((child, i) => (
        <li key={child.id} className="relative flex gap-3">
          <div className="flex flex-col items-center">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-surface-3 text-sm font-bold">
              {i + 1}
            </span>
            {i < props.nodes.length - 1 && <span className="w-0.5 flex-1 bg-line" />}
          </div>
          <div className="min-w-0 flex-1 pb-1">
            <FlowNodeView node={child} depth={props.depth + 1} />
          </div>
        </li>
      ))}
    </ol>
  );
}

function PlayerRing(props: { count: number; order: string }) {
  const { t } = useTranslation();
  const n = Math.min(props.count, 8);
  const size = 56;
  const r = 20;
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={t("flow.playerRing", {
        count: props.count,
        order: t(`flow.order.${props.order}`),
      })}
      className="shrink-0"
    >
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth={2} />
      {Array.from({ length: n }, (_, i) => {
        const a = (i / n) * 2 * Math.PI - Math.PI / 2;
        return (
          <circle
            // biome-ignore lint/suspicious/noArrayIndexKey: seats are positional
            key={i}
            cx={size / 2 + r * Math.cos(a)}
            cy={size / 2 + r * Math.sin(a)}
            r={5}
            fill={i === 0 ? "var(--accent)" : "var(--info)"}
          />
        );
      })}
      <path
        d={`M ${size / 2 + 8} ${size / 2 - 3} l 4 3 l -4 3`}
        fill="none"
        stroke="var(--muted)"
        strokeWidth={2}
        transform={
          props.order === "counterclockwise" ? `scale(-1 1) translate(-${size} 0)` : undefined
        }
      />
    </svg>
  );
}

function FlowNodeView(props: { node: FlowNode; depth: number }): ReactNode {
  const { node, depth } = props;
  const L = useL();
  const { t } = useTranslation();
  const { session } = useGame();

  switch (node.kind) {
    case "step":
      return (
        <div data-testid={`flow-${node.id}`}>
          <NodeHeader node={node} />
        </div>
      );

    case "sequence":
      return (
        <div data-testid={`flow-${node.id}`} className="space-y-3">
          {depth > 0 && <NodeHeader node={node} />}
          <Steps nodes={node.children} depth={depth} />
        </div>
      );

    case "repeat":
      return (
        <Frame tone="loop" testId={`flow-${node.id}`}>
          <NodeHeader
            node={node}
            icon="loop"
            badge={<Chip tone="accent">{t("flow.until", { condition: L(node.until) })}</Chip>}
          />
          <Steps nodes={node.children} depth={depth} />
        </Frame>
      );

    case "turnOrder":
      return (
        <Frame tone="turn" testId={`flow-${node.id}`}>
          <div className="flex items-center gap-3">
            <PlayerRing count={session.playerCount} order={node.order} />
            <div className="min-w-0 flex-1">
              <NodeHeader node={node} />
              <p className="text-sm text-info">
                {t("flow.eachPlayerTurn", { order: t(`flow.order.${node.order}`) })}
                {node.firstPlayer && ` · ${L(node.firstPlayer)}`}
              </p>
            </div>
          </div>
          <Steps nodes={node.children} depth={depth} />
        </Frame>
      );

    case "simultaneous":
      return (
        <Frame tone="parallel" testId={`flow-${node.id}`}>
          <NodeHeader
            node={node}
            icon="users"
            badge={<Chip tone="ok">{t("flow.everyoneAtOnce")}</Chip>}
          />
          <div className="grid gap-2 sm:grid-cols-2">
            {node.children.map((c) => (
              <div key={c.id} className="rounded-xl border-l-4 border-ok bg-surface p-3">
                <FlowNodeView node={c} depth={depth + 1} />
              </div>
            ))}
          </div>
          {node.syncPoint && (
            <div className="flex items-center gap-2 text-sm font-medium text-ok">
              <span className="h-1 flex-1 rounded bg-ok" />
              {L(node.syncPoint)}
              <span className="h-1 flex-1 rounded bg-ok" />
            </div>
          )}
        </Frame>
      );

    case "choice": {
      const { min, max } = node.pick;
      const label =
        min === max
          ? t("flow.chooseN", { count: max, total: node.options.length })
          : t("flow.chooseRange", { min, max, total: node.options.length });
      return (
        <div data-testid={`flow-${node.id}`} className="space-y-2">
          <NodeHeader node={node} badge={<Chip tone="info">{label}</Chip>} />
          <ul className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-1">
            {node.options.map((o) => (
              <li
                key={o.id}
                className="min-w-40 shrink-0 snap-start rounded-xl border border-line bg-surface-2 p-3"
              >
                <FlowNodeView node={o} depth={depth + 1} />
              </li>
            ))}
          </ul>
        </div>
      );
    }

    case "roll":
      return (
        <div
          data-testid={`flow-${node.id}`}
          className="space-y-2 rounded-2xl border border-line bg-surface p-3"
        >
          <NodeHeader
            node={node}
            icon="dice"
            badge={<Chip tone="accent">{t("flow.rollDice", { count: node.count })}</Chip>}
          />
          {node.reroll && <p className="text-sm text-muted">↻ {L(node.reroll)}</p>}
          <ul className="divide-y divide-line">
            {node.outcomes.map((o) => (
              <li key={L(o.label)} className="flex flex-col gap-2 py-2 sm:flex-row sm:items-start">
                <span className="w-32 shrink-0 font-semibold text-accent">{L(o.label)}</span>
                {o.children && o.children.length > 0 && (
                  <div className="min-w-0 flex-1 space-y-2">
                    {o.children.map((c) => (
                      <FlowNodeView key={c.id} node={c} depth={depth + 1} />
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      );

    case "timer":
      return (
        <Frame tone="timer" testId={`flow-${node.id}`}>
          <NodeHeader
            node={node}
            icon="timer"
            badge={<Chip tone="bad">{formatTime(node.durationSeconds)}</Chip>}
          />
          {node.children && node.children.length > 0 && (
            <Steps nodes={node.children} depth={depth} />
          )}
        </Frame>
      );

    case "trigger":
      return (
        <aside
          data-testid={`flow-${node.id}`}
          className="space-y-2 rounded-2xl border border-warn/50 bg-warn/10 p-3"
        >
          <NodeHeader node={node} icon="bolt" />
          <p className="text-sm font-medium text-warn">
            {t("flow.when", { condition: L(node.when) })}
          </p>
          <div className="space-y-2 border-l-2 border-warn/50 pl-3">
            {node.children.map((c) => (
              <FlowNodeView key={c.id} node={c} depth={depth + 1} />
            ))}
          </div>
        </aside>
      );
  }
}
