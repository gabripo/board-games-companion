import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { gamePrefsStore } from "../src/settings/settings";
import { renderApp, setLevel } from "./render";

const openPlay = async (gameId: string) => {
  setLevel(gameId, "newbie");
  renderApp(`/game/${gameId}?tab=play`);
  return screen.findByTestId("play-current");
};
const next = () => userEvent.click(screen.getByRole("button", { name: "Next" }));

describe("play tab", () => {
  it("steps through a turn, branches on a choice and rotates players", async () => {
    gamePrefsStore("tile-trek").set({ session: { playerCount: 2, variants: [], expansions: [] } });
    const current = await openPlay("tile-trek");
    expect(within(current).getByRole("heading")).toHaveTextContent("Draw a tile");
    expect(screen.getByTestId("current-player")).toHaveTextContent("Player 1 of 2");
    expect(screen.getByTestId("current-round")).toHaveTextContent("Round 1");
    expect(screen.getByText("When A feature is completed")).toBeInTheDocument();

    await next();
    await next();
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled(); // decision pending
    await userEvent.click(screen.getByRole("button", { name: "Deploy one" }));
    expect(within(screen.getByTestId("play-current")).getByRole("heading")).toHaveTextContent(
      "Deploy one",
    );
    await next();
    expect(screen.getByTestId("current-player")).toHaveTextContent("Player 2 of 2");

    await userEvent.click(screen.getByRole("button", { name: "Previous" }));
    expect(screen.getByTestId("current-player")).toHaveTextContent("Player 1 of 2");
  });

  it("ending the loop reaches final scoring and game over", async () => {
    await openPlay("tile-trek");
    await userEvent.click(screen.getByRole("button", { name: "Done: No tiles remain" }));
    expect(within(screen.getByTestId("play-current")).getByRole("heading")).toHaveTextContent(
      "Final scoring",
    );
    await next();
    expect(screen.getByText("End of the game!")).toBeInTheDocument();
  });

  it("dice: picking the rolled outcome follows its branch; odds are shown", async () => {
    await openPlay("dice-harbor");
    await userEvent.click(screen.getByRole("button", { name: "7: bust" }));
    expect(within(screen.getByTestId("play-current")).getByRole("heading")).toHaveTextContent(
      "Lose this turn's gains",
    );
    const odds = screen.getByTestId("odds-roll");
    expect(within(odds).getByText("17%")).toBeInTheDocument();
    expect(within(odds).getByText("25%")).toBeInTheDocument();
  });

  it("real-time games get a countdown", async () => {
    await openPlay("panic-kitchen");
    expect(screen.getByTestId("timer-remaining")).toHaveTextContent("3:00");
    expect(screen.getByRole("button", { name: "Start" })).toBeInTheDocument();
  });

  it("simultaneous games show 'everyone at once' instead of a player", async () => {
    await openPlay("card-feast");
    expect(screen.getAllByText("Everyone at once").length).toBeGreaterThan(0);
    expect(screen.queryByTestId("current-player")).not.toBeInTheDocument();
  });

  it("scoring calculator totals per player and highlights the leader", async () => {
    await openPlay("tile-trek");
    await userEvent.type(screen.getByRole("spinbutton", { name: "Roads, player 1" }), "4");
    await userEvent.type(screen.getByRole("spinbutton", { name: "Cities, player 1" }), "6");
    await userEvent.type(screen.getByRole("spinbutton", { name: "Roads, player 2" }), "3");
    expect(screen.getByTestId("total-1")).toHaveTextContent("10");
    expect(screen.getByTestId("total-2")).toHaveTextContent("3");
    expect(screen.getByTestId("total-1")).toHaveClass("text-accent");
  });

  it("actions not available for this player count are dimmed with their condition", async () => {
    await openPlay("dice-harbor"); // 2 players; Trade needs 3–4
    const trade = screen.getByTestId("action-trade");
    expect(trade).toHaveClass("opacity-60");
    expect(within(trade).getByText("3, 4 players")).toBeInTheDocument();
  });

  it("module slots appear only where the game has the module", async () => {
    await openPlay("card-feast");
    expect(screen.getByTestId("module-scoring-PlayWidget")).toBeInTheDocument();
    expect(screen.queryByTestId("module-dice-PlayWidget")).not.toBeInTheDocument();
  });
});
