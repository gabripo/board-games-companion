import {
  createHashHistory,
  createRootRoute,
  createRoute,
  createRouter,
  type RouterHistory,
} from "@tanstack/react-router";
import { TABS, type Tab } from "./game/GameProvider";
import { GameLayout } from "./routes/GameLayout";
import { GameScreen } from "./routes/GameScreen";
import { Home } from "./routes/Home";
import { NotFound, Root } from "./routes/Root";
import { SettingsScreen } from "./routes/Settings";
import { WalkthroughScreen } from "./routes/WalkthroughScreen";

export interface GameSearch {
  tab?: Tab | undefined;
  /** Board focus request: scene + optional hotspot to zoom to and pulse. */
  scene?: string | undefined;
  hotspot?: string | undefined;
}

const str = (v: unknown) => (typeof v === "string" && v.length > 0 ? v : undefined);

export function validateGameSearch(search: Record<string, unknown>): GameSearch {
  const tab = TABS.find((t) => t === search.tab);
  return { tab, scene: str(search.scene), hotspot: str(search.hotspot) };
}

const rootRoute = createRootRoute({ component: Root, notFoundComponent: NotFound });

const homeRoute = createRoute({ getParentRoute: () => rootRoute, path: "/", component: Home });

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "settings",
  component: SettingsScreen,
});

export const gameRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "game/$gameId",
  component: GameLayout,
});

export const gameIndexRoute = createRoute({
  getParentRoute: () => gameRoute,
  path: "/",
  validateSearch: validateGameSearch,
  component: GameScreen,
});

export const walkthroughRoute = createRoute({
  getParentRoute: () => gameRoute,
  path: "walkthrough/$walkthroughId",
  component: WalkthroughScreen,
});

const routeTree = rootRoute.addChildren([
  homeRoute,
  settingsRoute,
  gameRoute.addChildren([gameIndexRoute, walkthroughRoute]),
]);

/**
 * Hash history keeps every deep link working on any static host (and offline) without
 * server-side rewrites.
 */
export function createAppRouter(history: RouterHistory = createHashHistory()) {
  return createRouter({ routeTree, history, defaultPreload: false, scrollRestoration: true });
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof createAppRouter>;
  }
}
