import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { bundleAll, findRepoRoot } from "../src/node";

/**
 * Validates every real game in content/games. A broken guide fails CI.
 * (Bundles are not written here — `pnpm validate` does that.)
 */
describe("content/games", async () => {
  const { results } = await bundleAll(join(findRepoRoot(import.meta.dirname), "content/games"));

  if (results.length === 0) {
    it.skip("no games yet — add one under content/games/<id>/", () => {});
    return;
  }

  it.each(results.map((r) => [r.dir.split("/").pop(), r] as const))("%s is valid", (_, r) => {
    const errors = r.issues
      .filter((i) => i.severity === "error")
      .map((i) => `${i.path}: ${i.message}`);
    expect(errors).toEqual([]);
  });
});
