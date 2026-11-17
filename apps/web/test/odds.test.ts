import { describe, expect, it } from "vitest";
import {
  firstMatchOdds,
  percent,
  probAtLeastOne,
  probSumInRange,
  sumDistribution,
} from "../src/modules/dice/odds";

const d6 = [1, 2, 3, 4, 5, 6];

describe("dice odds", () => {
  it("2d6 sum distribution", () => {
    const dist = sumDistribution(d6, 2);
    expect([...dist.keys()]).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(dist.get(7)).toBeCloseTo(6 / 36);
    expect(dist.get(2)).toBeCloseTo(1 / 36);
    expect([...dist.values()].reduce((a, b) => a + b, 0)).toBeCloseTo(1);
  });

  it("range and at-least-one", () => {
    expect(probSumInRange(d6, 2, 7, 7)).toBeCloseTo(6 / 36);
    expect(probSumInRange(d6, 2, 2, 12)).toBeCloseTo(1);
    expect(probAtLeastOne(1, 6, 2)).toBeCloseTo(11 / 36);
    expect(probAtLeastOne(1, 6, 0)).toBe(0);
  });

  it("formats percentages", () => {
    expect(percent(6 / 36)).toBe("17%");
    expect(percent(1 / 36)).toBe("2.8%");
  });
});

describe("first-match outcome odds", () => {
  const faces = d6.map((v) => ({ id: `f${v}`, value: v }));
  it("dice-harbor outcomes are mutually exclusive in order", () => {
    const [bust, six, other] = firstMatchOdds(faces, 2, [
      { sum: { min: 7, max: 7 } },
      { faces: ["f6"] },
      { sum: { min: 2, max: 12 } },
    ]);
    expect(bust).toBeCloseTo(6 / 36);
    expect(six).toBeCloseTo(9 / 36); // a six, but not 1+6 / 6+1
    expect(other).toBeCloseTo(21 / 36);
  });
});
