import {
  applies,
  type Conditions,
  type FlowNode,
  type GameGuide,
  pruneFlow,
  type Rule,
  type SceneRef,
  type SessionContext,
  type YouTubeClip,
} from "@bgc/schema";
import { useNavigate } from "@tanstack/react-router";
import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from "react";
import { useAssetUrl } from "../data/repository";
import { type GamePrefs, gamePrefsStore, type Level, useGamePrefs } from "../settings/settings";
import { ClipSheet } from "./ClipSheet";
import { RuleSheet } from "./RuleSheet";

export type Tab = "learn" | "play" | "board" | "rules";
export const TABS: readonly Tab[] = ["learn", "play", "board", "rules"];

export interface GameContextValue {
  guide: GameGuide;
  prefs: GamePrefs;
  session: SessionContext;
  setSession(s: SessionContext): void;
  /** Undefined until the user answers the "played before?" prompt. */
  level: Level | undefined;
  setLevel(l: Level): void;
  /** Does content with these conditions apply to the current session? */
  isApplicable(c: Conditions | undefined): boolean;
  /** Flow graph pruned to the current session. */
  flow: FlowNode | undefined;
  rule(id: string): Rule | undefined;
  assetUrl(src: string): string;
  openClip(clip: YouTubeClip): void;
  openRule(id: string): void;
  showOnBoard(ref: SceneRef): void;
  defaultTab: Tab;
}

const GameContext = createContext<GameContextValue | undefined>(undefined);

export function useGame(): GameContextValue {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error("useGame must be used inside <GameProvider>");
  return ctx;
}

/** Session defaults: first "best" player count, otherwise the minimum; base game only. */
export function defaultSession(guide: GameGuide): SessionContext {
  const { min, best } = guide.classification.playerCount;
  return { playerCount: best?.[0] ?? min, variants: [], expansions: [] };
}

/** Repairs a stored session that no longer matches the guide (e.g. content was updated). */
function sanitizeSession(guide: GameGuide, s: SessionContext | undefined): SessionContext {
  if (!s) return defaultSession(guide);
  const { min, max } = guide.classification.playerCount;
  const variantIds = new Set(guide.variants.map((v) => v.id));
  const expansionIds = new Set(guide.expansions.map((e) => e.id));
  return {
    playerCount: Math.min(max, Math.max(min, s.playerCount)),
    variants: s.variants.filter((v) => variantIds.has(v)),
    expansions: s.expansions.filter((e) => expansionIds.has(e)),
  };
}

export function GameProvider(props: { guide: GameGuide; children: ReactNode }) {
  const { guide } = props;
  const prefs = useGamePrefs(guide.id);
  const store = gamePrefsStore(guide.id);
  const navigate = useNavigate();
  const assetUrlFor = useAssetUrl();
  const [clip, setClip] = useState<YouTubeClip | undefined>();
  const [ruleId, setRuleId] = useState<string | undefined>();

  const session = useMemo(() => sanitizeSession(guide, prefs.session), [guide, prefs.session]);
  const rulesById = useMemo(() => new Map(guide.rules.map((r) => [r.id, r])), [guide]);
  const flow = useMemo(() => pruneFlow(guide.flow, session), [guide, session]);

  const showOnBoard = useCallback(
    (ref: SceneRef) => {
      setRuleId(undefined);
      void navigate({
        to: "/game/$gameId",
        params: { gameId: guide.id },
        search: { tab: "board", scene: ref.sceneId, hotspot: ref.hotspotId },
      });
    },
    [guide.id, navigate],
  );

  const value = useMemo<GameContextValue>(
    () => ({
      guide,
      prefs,
      session,
      setSession: (s) => store.set({ session: s }),
      level: prefs.level,
      setLevel: (level) => store.set({ level }),
      isApplicable: (c) => applies(c, session),
      flow,
      rule: (id) => rulesById.get(id),
      assetUrl: (src) => assetUrlFor(guide.id, src),
      openClip: setClip,
      openRule: setRuleId,
      showOnBoard,
      defaultTab: prefs.level === "experienced" ? "rules" : "learn",
    }),
    [guide, prefs, session, store, flow, rulesById, assetUrlFor, showOnBoard],
  );

  return (
    <GameContext value={value}>
      {props.children}
      <RuleSheet ruleId={ruleId} onClose={() => setRuleId(undefined)} />
      <ClipSheet clip={clip} onClose={() => setClip(undefined)} />
    </GameContext>
  );
}
