import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { renderApp, setLevel } from "./render";

describe("board tab", () => {
  it("tapping a hotspot opens its rules", async () => {
    setLevel("dice-harbor", "newbie");
    renderApp("/game/dice-harbor?tab=board");
    await userEvent.click(await screen.findByRole("button", { name: "Fishing dock" }));
    const sheet = await screen.findByTestId("hotspot-sheet-dock-fish");
    expect(within(sheet).getByText("An occupied dock is blocked.")).toBeInTheDocument();
    expect(within(sheet).getByRole("button", { name: "Watch" })).toBeInTheDocument();
  });

  it("list mode offers every hotspot as a button", async () => {
    setLevel("dice-harbor", "newbie");
    renderApp("/game/dice-harbor?tab=board");
    await userEvent.click(await screen.findByRole("button", { name: "List" }));
    for (const name of ["Dice tray", "Fishing dock", "Trading dock"]) {
      expect(screen.getByRole("button", { name: new RegExp(name) })).toBeInTheDocument();
    }
  });

  it("'Show on board' switches to the board and pulses the hotspot", async () => {
    setLevel("tile-trek", "experienced");
    renderApp("/game/tile-trek?tab=rules");
    const card = await screen.findByTestId("rule-place-tile");
    await userEvent.click(within(card).getByRole("button", { name: "Show on board" }));
    await waitFor(() =>
      expect(screen.getByRole("tab", { name: "Board" })).toHaveAttribute("aria-selected", "true"),
    );
    expect(screen.getByTestId("hotspot-map")).toHaveClass("hotspot-pulse");
  });

  it("games without scenes show an empty state", async () => {
    setLevel("card-feast", "newbie");
    renderApp("/game/card-feast?tab=board");
    expect(await screen.findByText("This game has no board pictures yet.")).toBeInTheDocument();
  });
});

describe("story mode", () => {
  it("walks through steps with annotations and a Try-it check", async () => {
    setLevel("dice-harbor", "newbie");
    renderApp("/game/dice-harbor/walkthrough/first-roll");
    expect(await screen.findByTestId("story-text")).toHaveTextContent(
      "Roll both dice in the tray.",
    );
    expect(screen.getByText("Step 1 of 2")).toBeInTheDocument();
    expect(screen.getByTestId("annotation-tray-glow")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /Next/ }));
    expect(await screen.findByText("Step 2 of 2")).toBeInTheDocument();
    expect(
      await screen.findByText("Which dock gives you fish?", { exact: false }),
    ).toBeInTheDocument();
    // Annotations must never swallow taps meant for the hotspots below them.
    expect(screen.getByTestId("annotation-to-dock")).toHaveAttribute("pointer-events", "none");
    expect(screen.getByTestId("annotation-worker-here")).toHaveAttribute("pointer-events", "none");
    const finish = screen.getByRole("button", { name: "Finish" });
    expect(finish).toBeDisabled();

    await userEvent.click(screen.getByRole("button", { name: "Trading dock" }));
    expect(screen.getByRole("status")).toHaveTextContent("Not quite — try again.");
    expect(finish).toBeDisabled();

    await userEvent.click(screen.getByRole("button", { name: "Fishing dock" }));
    expect(screen.getByRole("status")).toHaveTextContent("Correct!");
    expect(screen.getByText("The fishing dock, on the left.")).toBeInTheDocument();
    expect(finish).toBeEnabled();
  });

  it("'Show me' reveals the answer and unlocks Next", async () => {
    setLevel("tile-trek", "newbie");
    renderApp("/game/tile-trek/walkthrough/first-turn");
    await userEvent.click(await screen.findByRole("button", { name: /Next/ }));
    await userEvent.click(await screen.findByRole("button", { name: "Show me" }));
    expect(screen.getByRole("button", { name: "Finish" })).toBeEnabled();
  });

  it("unknown walkthroughs show a not-found state", async () => {
    setLevel("tile-trek", "newbie");
    renderApp("/game/tile-trek/walkthrough/nope");
    expect(await screen.findByText("Tutorial not found.")).toBeInTheDocument();
  });
});
