import { expect, type Page, test } from "@playwright/test";

/** Start with a chosen language and (optionally) a known level for a game. */
async function boot(
  page: Page,
  opts: { language?: "en" | "it"; levels?: Record<string, string> } = {},
) {
  await page.addInitScript(
    ({ language, levels }) => {
      if (sessionStorage.getItem("bgc:e2e-booted")) return; // keep state across reloads
      sessionStorage.setItem("bgc:e2e-booted", "1");
      localStorage.setItem(
        "bgc:settings",
        JSON.stringify({ language, theme: "dark", largeText: false }),
      );
      for (const [id, level] of Object.entries(levels)) {
        localStorage.setItem(`bgc:game:${id}`, JSON.stringify({ level, setupDone: [] }));
      }
    },
    { language: opts.language ?? "en", levels: opts.levels ?? {} },
  );
  // Never hit YouTube from tests: the embed URL is asserted, not loaded.
  await page.route(/youtube-nocookie\.com|ytimg\.com/, (route) => route.abort());
}

const current = (page: Page) => page.getByTestId("play-current").getByRole("heading");

test("newbie opens a game and learns the game loop", async ({ page }) => {
  await boot(page);
  await page.goto("/");
  await page.getByRole("link", { name: /Tile Trek/ }).click();
  await page.getByRole("button", { name: "No — teach me" }).click();
  await expect(page.getByRole("tab", { name: "Learn" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId("game-loop")).toBeVisible();
  await expect(page.getByText("until No tiles remain")).toBeVisible();
});

test("player count changes the setup checklist", async ({ page }) => {
  await boot(page, { levels: { "tile-trek": "newbie" } });
  await page.goto("/#/game/tile-trek");
  await expect(page.getByTestId("setup-duel-extra")).toHaveCount(0);
  await page.getByTestId("session-chip").click();
  await page.getByRole("button", { name: "Fewer players" }).click();
  await page.getByRole("button", { name: "Done" }).click();
  await expect(page.getByTestId("setup-duel-extra")).toBeVisible();
  await page.getByTestId("session-chip").click();
  await page.getByRole("button", { name: "More players" }).click();
  await page.getByRole("button", { name: "More players" }).click();
  await page.getByRole("button", { name: "Done" }).click();
  await expect(page.getByTestId("setup-duel-extra")).toHaveCount(0);
});

test("board hotspot → rule → clip at the right timestamp", async ({ page }) => {
  await boot(page, { levels: { "tile-trek": "experienced" } });
  await page.goto("/#/game/tile-trek?tab=board");
  await page.getByTestId("scene-table").getByRole("button", { name: "Map" }).click();
  const sheet = page.getByTestId("hotspot-sheet-map");
  await expect(sheet.getByText("Place the drawn tile adjacent and matching.")).toBeVisible();
  await sheet.getByRole("button", { name: "Watch", exact: true }).click();
  await page.getByRole("button", { name: "Play clip from 1:35 to 2:20" }).click();
  await expect(page.locator('iframe[title="Video clip"]')).toHaveAttribute(
    "src",
    /embed\/abcDEF12345\?start=95&end=140/,
  );
});

test("story mode with a Try-it check", async ({ page }) => {
  await boot(page, { levels: { "dice-harbor": "newbie" } });
  await page.goto("/#/game/dice-harbor");
  await page.getByRole("link", { name: /Your first roll/ }).click();
  await expect(page.getByTestId("story-text")).toHaveText("Roll both dice in the tray.");
  await page.getByRole("button", { name: /Next/ }).click();
  await expect(page.getByRole("button", { name: "Finish" })).toBeDisabled();
  await page.getByTestId("scene-harbor").getByRole("button", { name: "Trading dock" }).click();
  await expect(page.getByRole("status")).toHaveText("Not quite — try again.");
  await page.getByTestId("scene-harbor").getByRole("button", { name: "Fishing dock" }).click();
  await expect(page.getByRole("status")).toHaveText("Correct!");
  await page.getByRole("button", { name: "Finish" }).click();
  await expect(page.getByRole("tab", { name: "Learn" })).toHaveAttribute("aria-selected", "true");
});

test("play: step through a turn and follow a dice outcome", async ({ page }) => {
  await boot(page, { levels: { "tile-trek": "newbie", "dice-harbor": "newbie" } });
  await page.goto("/#/game/tile-trek?tab=play");
  await expect(current(page)).toHaveText("Draw a tile");
  await page.getByRole("button", { name: "Next" }).click();
  await expect(current(page)).toHaveText("Place it");

  await page.goto("/#/game/dice-harbor?tab=play");
  await page.getByRole("button", { name: "7: bust" }).click();
  await expect(current(page)).toHaveText("Lose this turn's gains");
});

test("switching to Italian translates UI and content", async ({ page }) => {
  await boot(page, { levels: { "tile-trek": "newbie" } });
  await page.goto("/#/settings");
  await page.getByRole("button", { name: "Italiano" }).click();
  await page.goto("/#/game/tile-trek");
  await expect(page.getByRole("tab", { name: "Impara" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Sentiero di Tessere" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "it");
});

test("a downloaded guide works offline", async ({ page, context }) => {
  await boot(page, { levels: { "tile-trek": "newbie" } });
  await page.goto("/");
  // Wait until the service worker controls the page (precached app shell).
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise((resolve) =>
        navigator.serviceWorker.addEventListener("controllerchange", resolve),
      );
    }
  });
  await page.goto("/#/game/tile-trek");
  await page.getByRole("button", { name: "Download for offline" }).click();
  await expect(page.getByTestId("offline-status")).toHaveText("Available offline");

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Tile Trek" })).toBeVisible();
  await expect(page.getByText("You are offline — downloaded guides still work.")).toBeVisible();
  await page.getByRole("tab", { name: "Board" }).click();
  const imageLoaded = await page
    .locator('img[alt="Table"]')
    .evaluate(
      (img) => (img as HTMLImageElement).complete && (img as HTMLImageElement).naturalWidth > 0,
    );
  expect(imageLoaded).toBe(true);
});

test("tap targets in the tab bar are at least 44px", async ({ page }) => {
  await boot(page, { levels: { "tile-trek": "newbie" } });
  await page.goto("/#/game/tile-trek");
  for (const tab of await page.getByRole("tab").all()) {
    const box = await tab.boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(44);
  }
});

test("landscape tablets keep the board beside the other tabs", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "tablet-landscape", "tablet layout only");
  await boot(page, { levels: { "dice-harbor": "newbie" } });
  await page.goto("/#/game/dice-harbor?tab=learn");
  await expect(page.getByTestId("game-loop")).toBeVisible();
  await expect(page.getByTestId("scene-harbor")).toBeVisible();
});
