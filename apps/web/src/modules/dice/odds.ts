/** Exact dice probabilities by convolution (fine for the handful of dice board games use). */

/** Distribution of the sum of `count` rolls of a die with these face values. */
export function sumDistribution(faceValues: readonly number[], count: number): Map<number, number> {
  let dist = new Map<number, number>([[0, 1]]);
  const p = 1 / faceValues.length;
  for (let i = 0; i < count; i++) {
    const nextDist = new Map<number, number>();
    for (const [sum, prob] of dist) {
      for (const v of faceValues) nextDist.set(sum + v, (nextDist.get(sum + v) ?? 0) + prob * p);
    }
    dist = nextDist;
  }
  return new Map([...dist.entries()].sort((a, b) => a[0] - b[0]));
}

/** P(sum of `count` dice is within [min, max]). */
export function probSumInRange(
  faceValues: readonly number[],
  count: number,
  min: number,
  max: number,
): number {
  let total = 0;
  for (const [sum, prob] of sumDistribution(faceValues, count))
    if (sum >= min && sum <= max) total += prob;
  return total;
}

/** P(at least one of `count` dice shows one of `matching` of `sides` faces). */
export function probAtLeastOne(matching: number, sides: number, count: number): number {
  return 1 - ((sides - matching) / sides) ** count;
}

export const percent = (p: number): string => `${(p * 100).toFixed(p < 0.1 ? 1 : 0)}%`;

export interface OutcomeMatcher {
  sum?: { min: number; max: number } | undefined;
  faces?: readonly string[] | undefined;
}

/**
 * Probability of each outcome when outcomes are checked in order and the first match wins
 * (how rulebooks read: "7 → bust; otherwise a six → bonus; otherwise …").
 * Enumerates every combination (sides^count, capped) for exact results.
 */
export function firstMatchOdds(
  faces: readonly { id: string; value?: number | undefined }[],
  count: number,
  outcomes: readonly OutcomeMatcher[],
): number[] {
  const odds = outcomes.map(() => 0);
  const sides = faces.length;
  const total = sides ** count;
  if (count < 1 || total > 200_000) return odds;
  const roll = new Array<number>(count).fill(0);
  for (let n = 0; n < total; n++) {
    let k = n;
    for (let i = 0; i < count; i++) {
      roll[i] = k % sides;
      k = Math.floor(k / sides);
    }
    const rolled = roll.map((i) => faces[i]);
    const sum = rolled.reduce((s, f) => s + (f?.value ?? 0), 0);
    const ids = new Set(rolled.map((f) => f?.id));
    const match = outcomes.findIndex(
      (o) =>
        (o.sum === undefined || (sum >= o.sum.min && sum <= o.sum.max)) &&
        (o.faces === undefined || o.faces.some((f) => ids.has(f))),
    );
    if (match >= 0) odds[match] = (odds[match] ?? 0) + 1 / total;
  }
  return odds;
}
