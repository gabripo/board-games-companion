import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { gamePrefsStore } from "../src/settings/settings";
import { renderApp, setLevel } from "./render";

const open = async (gameId: string, tab = "learn", level: "newbie" | "experienced" = "newbie") => {
  setLevel(gameId, level);
  const r = renderApp(`/game/${gameId}?tab=${tab}`);
  await screen.findByRole("tab", { name: "Learn" });
  return r;
};

describe("game loop view", () => {
  it.each([
    ["tile-trek", ["flow-turns", "flow-turn", "flow-follower", "flow-score-features"]],
    ["card-feast", ["flow-game", "flow-draft-round"]],
    ["panic-kitchen", ["flow-game"]],
    ["dice-harbor", ["flow-roll", "flow-place-worker"]],
    ["trump-tide", ["flow-trick", "flow-lead"]],
  ])("renders the %s flow", async (gameId, ids) => {
    await open(gameId);
    const loop = screen.getByTestId("game-loop");
    for (const id of ids) expect(within(loop).getByTestId(id)).toBeInTheDocument();
  });

  it("shows the visual cues of each node kind", async () => {
    await open("tile-trek");
    expect(screen.getByText("until No tiles remain")).toBeInTheDocument();
    expect(screen.getByText("Choose 0–1 of 2")).toBeInTheDocument();
    expect(screen.getByText("When A feature is completed")).toBeInTheDocument();
  });

  it("simultaneous, roll and timer visuals", async () => {
    await open("card-feast");
    expect(screen.getByText("Everyone at once")).toBeInTheDocument();
    expect(screen.getByText("Everyone reveals together")).toBeInTheDocument();
  });
});

describe("setup checklist", () => {
  it("filters steps by player count and persists ticks", async () => {
    await open("tile-trek");
    expect(screen.queryByTestId("setup-duel-extra")).not.toBeInTheDocument();
    gamePrefsStore("tile-trek").set({ session: { playerCount: 2, variants: [], expansions: [] } });
    expect(await screen.findByTestId("setup-duel-extra")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("checkbox", { name: "Place the start tile." }));
    expect(gamePrefsStore("tile-trek").get().setupDone).toEqual(["start"]);
    expect(screen.getByRole("img", { name: "1 of 3 setup steps done" })).toBeInTheDocument();
  });
});

describe("rules tab", () => {
  it("searches and filters by session", async () => {
    await open("tile-trek", "rules", "experienced");
    expect(screen.getByText("2 rules")).toBeInTheDocument();
    await userEvent.type(screen.getByRole("searchbox"), "follower");
    expect(screen.getByTestId("rule-follower-limit")).toBeInTheDocument();
    expect(screen.queryByTestId("rule-place-tile")).not.toBeInTheDocument();
  });

  it("reveals rules for other player counts on demand", async () => {
    await open("tile-trek", "rules", "experienced");
    expect(screen.queryByTestId("rule-duel-followers")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Show 1 rule for other sessions" }));
    const card = screen.getByTestId("rule-duel-followers");
    expect(within(card).getByText("2 players · Duel")).toBeInTheDocument();
  });

  it("rule card shows citation chips and conflicts", async () => {
    await open("tile-trek", "rules", "experienced");
    const card = screen.getByTestId("rule-place-tile");
    expect(within(card).getByText("p. 3")).toBeInTheDocument();
    expect(within(card).getByRole("button", { name: "Watch at 1:35" })).toBeInTheDocument();
    await userEvent.click(within(card).getByRole("button", { name: /Common mistake/ }));
    expect(within(card).getByText("Only one edge must match.")).toBeInTheDocument();
    expect(within(card).getByText("The rulebook says all edges.")).toBeInTheDocument();
  });

  it("Watch opens the clip sheet at the cited time", async () => {
    await open("tile-trek", "rules", "experienced");
    await userEvent.click(
      within(screen.getByTestId("rule-place-tile")).getByRole("button", { name: "Watch" }),
    );
    const play = await screen.findByRole("button", { name: "Play clip from 1:35 to 2:20" });
    await userEvent.click(play);
    expect(screen.getByTitle("Video clip")).toHaveAttribute(
      "src",
      expect.stringContaining("abcDEF12345?start=95&end=140"),
    );
  });

  it("myths and edge cases render", async () => {
    await open("dice-harbor", "rules", "experienced");
    expect(screen.getByText("You may skip your turn.")).toBeInTheDocument();
    expect(screen.getByText("What if the supply runs out?")).toBeInTheDocument();
  });

  it("module reference panels render (sections module)", async () => {
    await open("panic-kitchen", "rules", "experienced");
    expect(screen.getByTestId("module-sections-ReferencePanel")).toBeInTheDocument();
    expect(screen.getByText("Penalties")).toBeInTheDocument();
  });
});
