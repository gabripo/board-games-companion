import type { Conditions } from "./core/primitives";
import type { FlowNode, RollOutcome } from "./flow/flow";

/** What the players chose when opening a game. */
export interface SessionContext {
  playerCount: number;
  variants: readonly string[];
  expansions: readonly string[];
}

/**
 * True when content with these conditions applies to the session.
 * Every specified dimension must match; within a dimension any listed value matches.
 */
export function applies(conditions: Conditions | undefined, ctx: SessionContext): boolean {
  if (!conditions) return true;
  const { playerCount, variants, expansions } = conditions;
  if (playerCount && !playerCount.includes(ctx.playerCount)) return false;
  if (variants && !variants.some((v) => ctx.variants.includes(v))) return false;
  if (expansions && !expansions.some((e) => ctx.expansions.includes(e))) return false;
  return true;
}

/** Keeps only items that apply to the session. */
export function filterApplicable<T extends { conditions?: Conditions | undefined }>(
  items: readonly T[],
  ctx: SessionContext,
): T[] {
  return items.filter((i) => applies(i.conditions, ctx));
}

/**
 * Returns a copy of the flow tree without the nodes that do not apply to the session,
 * or `undefined` if the root itself does not apply.
 */
export function pruneFlow(node: FlowNode, ctx: SessionContext): FlowNode | undefined {
  if (!applies(node.conditions, ctx)) return undefined;
  const prune = (nodes: FlowNode[]): FlowNode[] =>
    nodes.flatMap((n) => {
      const p = pruneFlow(n, ctx);
      return p ? [p] : [];
    });

  switch (node.kind) {
    case "step":
      return node;
    case "choice":
      return { ...node, options: prune(node.options) };
    case "roll":
      return {
        ...node,
        outcomes: node.outcomes.map(
          (o): RollOutcome => (o.children ? { ...o, children: prune(o.children) } : o),
        ),
      };
    case "timer":
      return node.children ? { ...node, children: prune(node.children) } : node;
    default:
      return { ...node, children: prune(node.children) };
  }
}
