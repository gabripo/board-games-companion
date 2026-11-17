import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { gamePrefsStore, settingsStore } from "../src/settings/settings";
import { renderApp, setLevel } from "./render";

describe("home", () => {
  it("asks for a language on first launch", async () => {
    renderApp("/");
    settingsStore.set({ language: undefined });
    expect(await screen.findByText("Choose your language")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Italiano" }));
    expect(await screen.findByText("Marea di Briscole")).toBeInTheDocument();
  });

  it("lists every game with players and turn model", async () => {
    renderApp("/");
    const list = await screen.findByRole("list", { name: "Games" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(5);
    expect(within(list).getByText("Dice Harbor")).toBeInTheDocument();
    expect(within(list).getAllByText("Turn-based").length).toBeGreaterThan(0);
  });
});

describe("game screen", () => {
  it("asks 'played before?' and opens Rules for experienced players", async () => {
    renderApp("/game/tile-trek");
    await userEvent.click(await screen.findByRole("button", { name: "Yes — quick reference" }));
    expect(gamePrefsStore("tile-trek").get().level).toBe("experienced");
    await waitFor(() =>
      expect(screen.getByRole("tab", { name: "Rules" })).toHaveAttribute("aria-selected", "true"),
    );
  });

  it("defaults to Learn for newbies and switches tabs", async () => {
    setLevel("dice-harbor", "newbie");
    renderApp("/game/dice-harbor");
    const learn = await screen.findByRole("tab", { name: "Learn" });
    expect(learn).toHaveAttribute("aria-selected", "true");
    await userEvent.click(screen.getByRole("tab", { name: "Play" }));
    expect(screen.getByRole("tab", { name: "Play" })).toHaveAttribute("aria-selected", "true");
  });

  it("clamps the player count to the game's range", async () => {
    setLevel("trump-tide", "newbie");
    renderApp("/game/trump-tide");
    await userEvent.click(await screen.findByTestId("session-chip"));
    expect(screen.getByTestId("player-count")).toHaveTextContent("4");
    expect(screen.getByRole("button", { name: "More players" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Fewer players" })).toBeDisabled();
  });

  it("shows a not-found state for unknown games", async () => {
    renderApp("/game/nope");
    expect(await screen.findByText("This game does not exist.")).toBeInTheDocument();
  });

  it("switches UI and content to Italian", async () => {
    setLevel("tile-trek", "newbie");
    renderApp("/game/tile-trek", { language: "it" });
    expect(await screen.findByRole("tab", { name: "Impara" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Sentiero di Tessere" })).toBeInTheDocument();
  });
});
