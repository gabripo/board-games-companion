/**
 * pnpm fixtures — turns the synthetic archetype games into served bundles for the web app
 * (dist/fixture-games), with generated placeholder SVG art for every scene.
 * Real content goes through `pnpm validate` → dist/games instead.
 */
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { ARCHETYPES } from "../../test/fixtures/archetypes";
import { bundleAll, findRepoRoot, writeGameDir } from "../node/bundle";
import type { Scene } from "../scenes/scenes";

const PALETTE = ["#2f6f8f", "#8f5a2f", "#4f7f3f", "#7f3f6f", "#6f6f2f", "#3f4f8f"];

const esc = (s: string) =>
  s.replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[c] ?? c);

/** Placeholder board art: a tinted table, a grid and each hotspot region drawn as a "component". */
export function placeholderSvg(scene: Scene): string {
  const { width: w, height: h } = scene.image;
  const shapes = scene.hotspots.map((hs, i) => {
    const color = PALETTE[i % PALETTE.length];
    if (hs.shape.kind === "rect") {
      const r = hs.shape.rect;
      const [x, y, rw, rh] = [r.x * w, r.y * h, r.w * w, r.h * h];
      return `<g><rect x="${x}" y="${y}" width="${rw}" height="${rh}" rx="18" fill="${color}" fill-opacity="0.55" stroke="#f5ecd7" stroke-opacity="0.5" stroke-width="4"/>
<text x="${x + rw / 2}" y="${y + rh / 2}" font-size="${Math.min(rh / 4, 48)}" text-anchor="middle" dominant-baseline="middle" fill="#f5ecd7" font-family="sans-serif">${esc(hs.label.en)}</text></g>`;
    }
    const pts = hs.shape.points.map((p) => `${p.x * w},${p.y * h}`).join(" ");
    return `<polygon points="${pts}" fill="${color}" fill-opacity="0.55" stroke="#f5ecd7" stroke-opacity="0.5" stroke-width="4"/>`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
<defs>
  <radialGradient id="felt" cx="50%" cy="45%" r="75%"><stop offset="0" stop-color="#2d5a46"/><stop offset="1" stop-color="#13261e"/></radialGradient>
  <pattern id="grid" width="80" height="80" patternUnits="userSpaceOnUse"><path d="M80 0H0V80" fill="none" stroke="#ffffff" stroke-opacity="0.05" stroke-width="2"/></pattern>
</defs>
<rect width="${w}" height="${h}" fill="url(#felt)"/>
<rect width="${w}" height="${h}" fill="url(#grid)"/>
${shapes.join("\n")}
<text x="${w - 24}" y="${h - 24}" font-size="28" text-anchor="end" fill="#ffffff" fill-opacity="0.35" font-family="sans-serif">${esc(scene.title.en)} · placeholder art</text>
</svg>
`;
}

const root = findRepoRoot();
const outDir = join(root, "dist/fixture-games");
const work = await mkdtemp(join(tmpdir(), "bgc-fixtures-"));

try {
  for (const game of Object.values(ARCHETYPES)) {
    const dir = join(work, game.id);
    await writeGameDir(dir, game);
    await mkdir(join(dir, "images"), { recursive: true });
    for (const scene of game.scenes) {
      await writeFile(join(dir, scene.image.src), placeholderSvg(scene));
    }
  }
  await rm(outDir, { recursive: true, force: true });
  const { results, index } = await bundleAll(work, outDir);
  const errors = results.flatMap((r) => r.issues.filter((i) => i.severity === "error"));
  if (!index || errors.length > 0) {
    for (const e of errors) console.error(`  ${e.path}: ${e.message}`);
    throw new Error("fixture games failed validation");
  }
  console.log(`Wrote ${index.games.length} fixture games to ${relative(root, outDir)}/`);
} finally {
  await rm(work, { recursive: true, force: true });
}
