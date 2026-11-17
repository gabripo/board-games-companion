import { getRouteApi, Link } from "@tanstack/react-router";
import { lazy, type ReactNode, Suspense, useState } from "react";
import { TABS, type Tab, useGame } from "../game/GameProvider";
import { SessionSheet, useSessionLabel } from "../game/SessionSheet";
import { useL, useTranslation } from "../i18n";
import { LearnTab } from "../learn/LearnTab";
import { useWakeLock } from "../offline/useWakeLock";
import { RulesTab } from "../rules/RulesTab";
import type { Level } from "../settings/settings";
import { BottomSheet } from "../ui/BottomSheet";
import { Icon, type IconName } from "../ui/Icon";
import { Button, cx, SegmentedControl, Spinner } from "../ui/primitives";

// Heavier tabs (zoom/pan, animation, stepper) load on demand.
const PlayTab = lazy(() => import("../play/PlayTab").then((m) => ({ default: m.PlayTab })));
const BoardTab = lazy(() => import("../scenes/BoardTab").then((m) => ({ default: m.BoardTab })));
const ScenePane = lazy(() => import("../scenes/ScenePane").then((m) => ({ default: m.ScenePane })));

const route = getRouteApi("/game/$gameId/");

const TAB_ICONS: Record<Tab, IconName> = {
  learn: "learn",
  play: "play",
  board: "board",
  rules: "rules",
};

/** "Have you played this before?" — asked on first open, sets level + default tab. */
function LevelPrompt() {
  const { guide, level, setLevel } = useGame();
  const { t } = useTranslation();
  const L = useL();
  const navigate = route.useNavigate();
  const choose = (l: Level) => {
    setLevel(l);
    void navigate({ search: { tab: l === "experienced" ? "rules" : "learn" }, replace: true });
  };
  return (
    <BottomSheet
      open={level === undefined}
      onClose={() => setLevel("newbie")}
      title={t("level.promptTitle", { game: L(guide.meta.title) })}
    >
      <div className="space-y-3">
        <p className="text-muted">{t("level.promptBody")}</p>
        <Button variant="primary" className="w-full" icon="learn" onClick={() => choose("newbie")}>
          {t("level.teachMe")}
        </Button>
        <Button className="w-full" icon="rules" onClick={() => choose("experienced")}>
          {t("level.quickReference")}
        </Button>
      </div>
    </BottomSheet>
  );
}

function LevelToggle(props: { className: string }) {
  const { level, setLevel } = useGame();
  const { t } = useTranslation();
  const search = route.useSearch();
  const navigate = route.useNavigate();
  return (
    <div className={props.className}>
      <SegmentedControl<Level>
        label={t("level.label")}
        value={level ?? "newbie"}
        onChange={(l) => {
          setLevel(l);
          // Follow the level's default tab unless the user picked a tab explicitly.
          if (!search.tab)
            void navigate({ search: { tab: l === "experienced" ? "rules" : "learn" } });
        }}
        options={[
          { value: "newbie", label: t("level.newbie") },
          { value: "experienced", label: t("level.experienced") },
        ]}
        stretch
      />
    </div>
  );
}

function TabBar(props: { tab: Tab; onChange: (t: Tab) => void }) {
  const { t } = useTranslation();
  return (
    <nav
      aria-label={t("tabs.label")}
      className="pb-safe fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 backdrop-blur"
    >
      <div role="tablist" className="mx-auto grid max-w-3xl grid-cols-4">
        {TABS.map((tab) => {
          const active = tab === props.tab;
          return (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={active}
              aria-controls="game-tabpanel"
              onClick={() => props.onChange(tab)}
              className={cx(
                "flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs font-medium",
                active ? "text-accent" : "text-muted hover:text-ink",
              )}
            >
              <Icon name={TAB_ICONS[tab]} size={22} />
              {t(`tabs.${tab}`)}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export function GameScreen() {
  const game = useGame();
  const { guide } = game;
  const { t } = useTranslation();
  const L = useL();
  const search = route.useSearch();
  const navigate = route.useNavigate();
  const sessionLabel = useSessionLabel();
  const [sessionOpen, setSessionOpen] = useState(false);
  useWakeLock();

  const tab = search.tab ?? game.defaultTab;
  const setTab = (next: Tab) => void navigate({ search: { tab: next } });

  const panels: Record<Tab, ReactNode> = {
    learn: <LearnTab />,
    play: <PlayTab />,
    board: <BoardTab focusScene={search.scene} focusHotspot={search.hotspot} />,
    rules: <RulesTab />,
  };
  // Landscape tablets/desktop: keep the board visible beside the other tabs.
  const twoPane = tab !== "board" && guide.scenes.length > 0;

  return (
    <div className="min-h-dvh pb-24">
      <header className="pt-safe sticky top-0 z-20 border-b border-line bg-bg/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-1 px-2 py-1.5">
          <Link
            to="/"
            aria-label={t("common.back")}
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl hover:bg-surface-2"
          >
            <Icon name="back" size={22} />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg leading-tight font-bold">{L(guide.meta.title)}</h1>
            <button
              type="button"
              onClick={() => setSessionOpen(true)}
              className="inline-flex max-w-full items-center gap-1 truncate text-sm text-accent"
              data-testid="session-chip"
            >
              <Icon name="users" size={14} />
              <span className="truncate">{sessionLabel}</span>
              <Icon name="chevron" size={14} />
            </button>
          </div>
          <LevelToggle className="hidden w-64 sm:block" />
          <Link
            to="/settings"
            aria-label={t("settings.title")}
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl hover:bg-surface-2"
          >
            <Icon name="gear" size={22} />
          </Link>
        </div>
        {/* Phones: the level toggle gets its own full-width row. */}
        <div className="px-3 pb-2 sm:hidden">
          <LevelToggle className="w-full" />
        </div>
      </header>

      <div
        className={cx(
          "mx-auto max-w-6xl",
          twoPane &&
            "landscape:lg:grid landscape:lg:grid-cols-2 landscape:lg:gap-4 landscape:lg:px-4",
        )}
      >
        {twoPane && (
          <aside className="hidden landscape:lg:block">
            <div className="sticky top-24 pt-4">
              <Suspense fallback={null}>
                <ScenePane />
              </Suspense>
            </div>
          </aside>
        )}
        <main
          id="game-tabpanel"
          role="tabpanel"
          aria-label={t(`tabs.${tab}`)}
          className="mx-auto w-full max-w-3xl"
        >
          <Suspense fallback={<Spinner label={t("common.loading")} />}>{panels[tab]}</Suspense>
        </main>
      </div>

      <TabBar tab={tab} onChange={setTab} />
      <SessionSheet open={sessionOpen} onClose={() => setSessionOpen(false)} />
      <LevelPrompt />
    </div>
  );
}
