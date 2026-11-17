import { InMemoryGuideRepository } from "@bgc/core-ports";
import type { GameGuide } from "@bgc/schema";
import { ARCHETYPES, clone } from "@bgc/schema/testing";
import { createMemoryHistory, RouterProvider } from "@tanstack/react-router";
import { render } from "@testing-library/react";
import { RepositoryProvider } from "../src/data/repository";
import { createAppRouter } from "../src/router";
import { gamePrefsStore, settingsStore } from "../src/settings/settings";

export const fixtureGames = (): GameGuide[] => Object.values(ARCHETYPES).map(clone);

/** Renders the full app at `path` with an in-memory repository (no network). */
export function renderApp(
  path: string,
  opts: { language?: "en" | "it"; guides?: GameGuide[] } = {},
) {
  settingsStore.set({ language: opts.language ?? "en", theme: "dark", largeText: false });
  const router = createAppRouter(createMemoryHistory({ initialEntries: [path] }));
  const repo = new InMemoryGuideRepository(opts.guides ?? fixtureGames());
  const utils = render(
    <RepositoryProvider repository={repo}>
      <RouterProvider router={router} />
    </RepositoryProvider>,
  );
  return { ...utils, router };
}

/** Skips the "played before?" prompt for a game. */
export function setLevel(gameId: string, level: "newbie" | "experienced") {
  gamePrefsStore(gameId).set({ level });
}
