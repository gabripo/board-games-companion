import { clone, sequentialGame } from "@bgc/schema/testing";
import { describe, expect, it } from "vitest";
import { buildRuleSearch, normalize } from "../src/rules/search";

describe("rule search", () => {
  const game = clone(sequentialGame);

  it("normalizes accents and case", () => {
    expect(normalize("Città")).toBe("citta");
  });

  it("finds rules by summary words with typos and prefixes", () => {
    const en = buildRuleSearch(game, "en");
    expect(en.search("follower")[0]).toBe("follower-limit");
    expect(en.search("folower")[0]).toBe("follower-limit");
    expect(en.search("adjac")).toContain("place-tile");
  });

  it("an Italian glossary alias finds the rule from the English UI", () => {
    // glossary "feature" has IT alias "Zona" and links to rule place-tile
    expect(buildRuleSearch(game, "en").search("zona")).toContain("place-tile");
  });

  it("is accent-insensitive in Italian", () => {
    const it_ = buildRuleSearch(game, "it");
    expect(it_.search("tessera")).toContain("place-tile");
    expect(it_.search("piu")).toEqual(expect.any(Array));
    game.rules[0]!.summary.it = "Piazza la tessera in città";
    expect(buildRuleSearch(game, "it").search("citta")).toContain("place-tile");
  });

  it("matches the other language with a lower rank", () => {
    expect(buildRuleSearch(game, "en").search("seguace")).toContain("follower-limit");
  });

  it("finds rules by translated topic name in either language", () => {
    expect(buildRuleSearch(game, "it").search("preparazione")).toContain("duel-followers");
    expect(buildRuleSearch(game, "en").search("preparazione")).toContain("duel-followers");
  });

  it("empty query returns nothing", () => {
    expect(buildRuleSearch(game, "en").search("  ")).toEqual([]);
  });
});
