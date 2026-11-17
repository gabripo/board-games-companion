import type { FlowNode } from "@bgc/schema";

/**
 * A pure, game-agnostic cursor over a flow graph for the Play tab ("where are we?").
 *
 * Semantics per node kind:
 * - sequence / simultaneous / timer: visit children in order
 * - repeat: loop over children (round + 1 each pass) until the user ends it ("until" reached)
 * - turnOrder: run children once per player (1..N), then finish; a root turnOrder loops forever
 * - choice: the user picks an option and its subtree is visited (or skips when min = 0)
 * - roll: the user picks the rolled outcome and its children are visited
 * - trigger: never a stop — shown as a reminder while its parent is active
 * - step: a stop; Next moves on
 */

interface Frame {
  node: FlowNode | undefined; // undefined = virtual root
  children: readonly FlowNode[];
  index: number;
  /** repeat: completed passes; turnOrder: current player (1-based). */
  counter: number;
}

export interface StepperState {
  stack: readonly Frame[];
  playerCount: number;
  done: boolean;
  history: readonly Omit<StepperState, "history">[];
}

export type StepperAction =
  | { type: "next" }
  | { type: "back" }
  | { type: "choose"; option: number }
  | { type: "skipChoice" }
  | { type: "rolled"; outcome: number }
  | { type: "endLoop" }
  | { type: "restart"; flow: FlowNode | undefined; playerCount: number };

const CONTAINERS = new Set<FlowNode["kind"]>([
  "sequence",
  "simultaneous",
  "timer",
  "repeat",
  "turnOrder",
]);
const MAX_SETTLE = 1000;

function containerChildren(node: FlowNode): readonly FlowNode[] {
  switch (node.kind) {
    case "sequence":
    case "simultaneous":
    case "repeat":
    case "turnOrder":
      return node.children;
    case "timer":
      return node.children ?? [];
    default:
      return [];
  }
}

const top = (stack: readonly Frame[]) => stack[stack.length - 1];
const replaceTop = (stack: readonly Frame[], frame: Frame) => [...stack.slice(0, -1), frame];

/** Pops the finished top frame, applying loop / rotation semantics. */
function completeFrame(
  stack: readonly Frame[],
  playerCount: number,
): { stack: Frame[]; done: boolean } {
  const frame = top(stack);
  const rest = stack.slice(0, -1);
  if (!frame?.node) return { stack: [...stack], done: true }; // virtual root finished
  const parentIsRoot = rest.length === 1;

  if (frame.node.kind === "repeat") {
    return { stack: [...rest, { ...frame, index: 0, counter: frame.counter + 1 }], done: false };
  }
  if (frame.node.kind === "turnOrder") {
    if (frame.counter < playerCount) {
      return { stack: [...rest, { ...frame, index: 0, counter: frame.counter + 1 }], done: false };
    }
    if (parentIsRoot) {
      // A turn order at the top level is the whole game: keep rotating.
      return { stack: [...rest, { ...frame, index: 0, counter: 1 }], done: false };
    }
  }
  const parent = top(rest);
  if (!parent) return { stack: [], done: true };
  return { stack: replaceTop(rest, { ...parent, index: parent.index + 1 }), done: false };
}

/** Descends into containers / skips triggers / completes frames until reaching a stop. */
function settle(stack: readonly Frame[], playerCount: number): { stack: Frame[]; done: boolean } {
  let s = [...stack];
  for (let guard = 0; guard < MAX_SETTLE; guard++) {
    const frame = top(s);
    if (!frame) return { stack: s, done: true };
    const child = frame.children[frame.index];
    if (!child) {
      const r = completeFrame(s, playerCount);
      if (r.done) return r;
      s = r.stack;
      continue;
    }
    if (child.kind === "trigger") {
      s = replaceTop(s, { ...frame, index: frame.index + 1 });
      continue;
    }
    if (CONTAINERS.has(child.kind)) {
      s.push({
        node: child,
        children: containerChildren(child),
        index: 0,
        counter: child.kind === "turnOrder" ? 1 : 0,
      });
      continue;
    }
    return { stack: s, done: false }; // step, choice or roll
  }
  return { stack: s, done: true }; // degenerate graph (e.g. a loop of triggers only)
}

export function initStepper(flow: FlowNode | undefined, playerCount: number): StepperState {
  const root: Frame = { node: undefined, children: flow ? [flow] : [], index: 0, counter: 0 };
  const { stack, done } = settle([root], playerCount);
  return { stack, done, playerCount, history: [] };
}

function advance(state: StepperState, stack: readonly Frame[]): StepperState {
  const { history, ...snapshot } = state;
  const settled = settle(stack, state.playerCount);
  return {
    ...state,
    stack: settled.stack,
    done: settled.done,
    history: [...history, snapshot].slice(-200),
  };
}

export function stepperReducer(state: StepperState, action: StepperAction): StepperState {
  const frame = top(state.stack);
  const current = frame?.children[frame.index];

  switch (action.type) {
    case "restart":
      return initStepper(action.flow, action.playerCount);

    case "back": {
      const prev = state.history[state.history.length - 1];
      return prev ? { ...prev, history: state.history.slice(0, -1) } : state;
    }

    case "next":
      if (state.done || !frame || !current) return state;
      // Next on a choice/roll without picking = skip it.
      return advance(state, replaceTop(state.stack, { ...frame, index: frame.index + 1 }));

    case "skipChoice":
      if (current?.kind !== "choice" || !frame) return state;
      return advance(state, replaceTop(state.stack, { ...frame, index: frame.index + 1 }));

    case "choose": {
      if (current?.kind !== "choice") return state;
      const option = current.options[action.option];
      if (!option) return state;
      return advance(state, [
        ...state.stack,
        { node: current, children: [option], index: 0, counter: 0 },
      ]);
    }

    case "rolled": {
      if (current?.kind !== "roll") return state;
      const outcome = current.outcomes[action.outcome];
      if (!outcome) return state;
      return advance(state, [
        ...state.stack,
        { node: current, children: outcome.children ?? [], index: 0, counter: 0 },
      ]);
    }

    case "endLoop": {
      const i = state.stack.findLastIndex((f) => f.node?.kind === "repeat");
      if (i < 1) return state;
      const parent = state.stack[i - 1];
      if (!parent) return state;
      return advance(state, [
        ...state.stack.slice(0, i - 1),
        { ...parent, index: parent.index + 1 },
      ]);
    }
  }
}

/** What the Play tab shows for the current state. */
export interface StepperView {
  current: FlowNode | undefined;
  /** Enclosing nodes, outermost first (breadcrumb). */
  context: FlowNode[];
  /** Current player (1-based) of the innermost turn order, if any. */
  player: number | undefined;
  /** Round number (1-based) of the innermost repeat, if any. */
  round: number | undefined;
  /** The innermost repeat (offer "end loop" when its condition is met). */
  loop: Extract<FlowNode, { kind: "repeat" }> | undefined;
  timer: Extract<FlowNode, { kind: "timer" }> | undefined;
  simultaneous: boolean;
  /** Trigger nodes active in the enclosing containers (reminders). */
  reminders: Extract<FlowNode, { kind: "trigger" }>[];
  done: boolean;
  canGoBack: boolean;
}

export function viewOf(state: StepperState): StepperView {
  const frames = state.stack.filter((f) => f.node !== undefined);
  const nodes = frames.flatMap((f) => (f.node ? [f.node] : []));
  const frame = top(state.stack);
  const lastOf = <K extends FlowNode["kind"]>(kind: K) =>
    frames.findLast((f) => f.node?.kind === kind) as
      | (Frame & { node: Extract<FlowNode, { kind: K }> })
      | undefined;

  const turn = lastOf("turnOrder");
  const repeat = lastOf("repeat");
  const timer = lastOf("timer");
  const reminders = state.stack.flatMap((f) =>
    f.children.filter((c): c is Extract<FlowNode, { kind: "trigger" }> => c.kind === "trigger"),
  );

  return {
    current: state.done ? undefined : frame?.children[frame.index],
    context: nodes,
    player: turn?.counter,
    round: repeat ? repeat.counter + 1 : undefined,
    loop: repeat?.node,
    timer: timer?.node,
    simultaneous: nodes.some((n) => n.kind === "simultaneous"),
    reminders,
    done: state.done,
    canGoBack: state.history.length > 0,
  };
}
