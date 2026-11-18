import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { gamePrefsStore } from "../src/settings/settings";
import { renderApp, setLevel } from "./render";

const open = async (gameId: string) => {
  setLevel(gameId, "newbie");
  renderApp(`/game/${gameId}?tab=learn`);
  await screen.findByRole("tab", { name: "Learn" });
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("learn tab shortcuts", () => {
  it("lists the sections below the overview and scrolls to them", async () => {
    const scroll = vi.fn();
    Element.prototype.scrollIntoView = scroll;
    await open("tile-trek");
    const nav = screen.getByRole("navigation", { name: "Jump to a section" });
    for (const name of ["How a game flows", "Setup", "Icons & terms"]) {
      expect(within(nav).getByRole("button", { name })).toBeInTheDocument();
    }
    await userEvent.click(within(nav).getByRole("button", { name: "Icons & terms" }));
    expect(scroll).toHaveBeenCalledTimes(1);
    expect(scroll.mock.contexts[0]).toBe(document.getElementById("learn-glossary"));
  });

  it("links module learn cards by their title", async () => {
    Element.prototype.scrollIntoView = vi.fn();
    await open("trump-tide");
    const nav = screen.getByRole("navigation", { name: "Jump to a section" });
    const moduleLinks = within(nav)
      .getAllByRole("button")
      .filter((b) => !["How a game flows", "Setup", "Icons & terms"].includes(b.textContent ?? ""));
    expect(moduleLinks.length).toBeGreaterThan(0);
  });
});

describe("expansion filtering", () => {
  it("hides expansion-only terms until the expansion is on, keeping them one tap away", async () => {
    await open("tile-trek");
    expect(screen.queryByText("River tile")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Show 1 term for other sessions" }));
    expect(screen.getByText("River tile")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Only this session" }));
    expect(screen.queryByText("River tile")).not.toBeInTheDocument();

    gamePrefsStore("tile-trek").set({
      session: { playerCount: 3, variants: [], expansions: ["river"] },
    });
    expect(await screen.findByText("River tile")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /terms? for other sessions/ })).toBeNull();
  });
});
