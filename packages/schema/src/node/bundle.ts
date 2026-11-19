import { existsSync } from "node:fs";
import { cp, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import type { z } from "zod";
import {
  FlowFile,
  GameFile,
  type GameGuide,
  GameGuide as GameGuideSchema,
  type GameIndex,
  GuidesFile,
  ModuleFile,
  RulesFile,
  ScenesFile,
  SetupFile,
  WalkthroughsFile,
} from "../guide";
import { checkIntegrity } from "../integrity/check";
import type { IntegrityIssue } from "../integrity/issues";
import { migrateToCurrent } from "../migrations";
import { zodIssues } from "../parse";

/** Split files that make up one game folder. `modules/*.json` is handled separately. */
const GAME_FILES = {
  game: { file: "game.json", schema: GameFile, required: true },
  rules: { file: "rules.json", schema: RulesFile, required: true },
  setup: { file: "setup.json", schema: SetupFile, required: true },
  flow: { file: "flow.json", schema: FlowFile, required: true },
  scenes: { file: "scenes.json", schema: ScenesFile, required: false },
  walkthroughs: { file: "walkthroughs.json", schema: WalkthroughsFile, required: false },
  guides: { file: "guides.json", schema: GuidesFile, required: true },
} as const;

export interface GameLoadResult {
  dir: string;
  guide?: GameGuide;
  /** Paths are prefixed with the file they come from, e.g. `rules.json › [2].summary.it`. */
  issues: IntegrityIssue[];
}

async function readJson(
  path: string,
): Promise<{ ok: true; value: unknown } | { ok: false; error: string }> {
  try {
    return { ok: true, value: JSON.parse(await readFile(path, "utf8")) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

function prefixed(file: string, issues: IntegrityIssue[]): IntegrityIssue[] {
  return issues.map((i) => ({ ...i, path: `${file} › ${i.path}` }));
}

/** Reads, validates and merges one `content/games/<id>/` folder into a GameGuide bundle. */
export async function loadGameDir(dir: string): Promise<GameLoadResult> {
  const issues: IntegrityIssue[] = [];

  // 1. Read every file raw.
  const raw: Record<string, unknown> = {};
  for (const [key, { file, required }] of Object.entries(GAME_FILES)) {
    const path = join(dir, file);
    if (!existsSync(path)) {
      if (required) issues.push({ severity: "error", path: file, message: "file is missing" });
      else raw[key] = [];
      continue;
    }
    const json = await readJson(path);
    if (json.ok) raw[key] = json.value;
    else issues.push({ severity: "error", path: file, message: `invalid JSON: ${json.error}` });
  }
  const moduleFiles: string[] = [];
  const rawModules: unknown[] = [];
  const modulesDir = join(dir, "modules");
  if (existsSync(modulesDir)) {
    for (const f of (await readdir(modulesDir)).filter((x) => x.endsWith(".json")).sort()) {
      const json = await readJson(join(modulesDir, f));
      if (!json.ok) {
        issues.push({
          severity: "error",
          path: `modules/${f}`,
          message: `invalid JSON: ${json.error}`,
        });
        continue;
      }
      moduleFiles.push(`modules/${f}`);
      rawModules.push(json.value);
    }
  }

  // 2. Migrate the whole guide at once (a migration may need several files, e.g. game + rules).
  if (raw.game && typeof raw.game === "object" && !Array.isArray(raw.game)) {
    const { game, ...others } = raw;
    try {
      const migrated = migrateToCurrent({
        ...(game as object),
        ...others,
        modules: rawModules,
      }) as Record<string, unknown>;
      const { rules, setup, flow, scenes, walkthroughs, guides, modules, ...gameOnly } = migrated;
      Object.assign(raw, { game: gameOnly, rules, setup, flow, scenes, walkthroughs, guides });
      if (Array.isArray(modules)) rawModules.splice(0, rawModules.length, ...modules);
    } catch (e) {
      issues.push({ severity: "error", path: "game.json › schemaVersion", message: String(e) });
    }
  }

  // 3. Validate each file with its own schema (errors keep their file prefix).
  const parts: Record<string, unknown> = {};
  for (const [key, { file, schema }] of Object.entries(GAME_FILES)) {
    if (!(key in raw)) continue;
    const parsed = (schema as z.ZodType).safeParse(raw[key]);
    if (parsed.success) parts[key] = parsed.data;
    else issues.push(...prefixed(file, zodIssues(parsed.error)));
  }
  const modules: unknown[] = [];
  for (const [i, value] of rawModules.entries()) {
    const parsed = ModuleFile.safeParse(value);
    if (parsed.success) modules.push(parsed.data);
    else issues.push(...prefixed(moduleFiles[i] ?? `modules[${i}]`, zodIssues(parsed.error)));
  }

  if (issues.length > 0) return { dir, issues };

  const { game, ...rest } = parts as { game: z.infer<typeof GameFile> } & Record<string, unknown>;
  if (game.id !== basename(dir)) {
    issues.push({
      severity: "error",
      path: "game.json › id",
      message: `id "${game.id}" must match folder name "${basename(dir)}"`,
    });
  }

  const merged = GameGuideSchema.safeParse({ ...game, ...rest, modules });
  if (!merged.success) return { dir, issues: [...issues, ...zodIssues(merged.error)] };

  const guide = merged.data;
  issues.push(...checkIntegrity(guide));
  // Game images are private (gitignored, kept only on the owner's machine). CI checkouts
  // don't have them: BGC_IMAGES=optional turns a missing image into a warning there.
  const imagesOptional = process.env.BGC_IMAGES === "optional";
  for (const [i, scene] of guide.scenes.entries()) {
    if (!existsSync(join(dir, scene.image.src))) {
      issues.push({
        severity: imagesOptional ? "warning" : "error",
        path: `scenes[${i}].image.src`,
        message: `image file "${scene.image.src}" not found in ${basename(dir)}/`,
      });
    }
  }
  return { dir, guide, issues };
}

export interface BundleAllResult {
  results: GameLoadResult[];
  index?: GameIndex;
}

/**
 * Validates every game folder in `contentDir`. When all are valid and `outDir` is given,
 * writes `<outDir>/<id>/guide.json`, copies `<id>/images/`, and writes `<outDir>/index.json`.
 */
export async function bundleAll(contentDir: string, outDir?: string): Promise<BundleAllResult> {
  const root = resolve(contentDir);
  const entries = existsSync(root) ? await readdir(root, { withFileTypes: true }) : [];
  const dirs = entries
    .filter((e) => e.isDirectory() && !e.name.startsWith(".") && !e.name.startsWith("_"))
    .map((e) => join(root, e.name))
    .sort();

  const results = await Promise.all(dirs.map(loadGameDir));
  const failed = results.some((r) => !r.guide || r.issues.some((i) => i.severity === "error"));
  if (failed || !outDir) return { results };

  const out = resolve(outDir);
  await mkdir(out, { recursive: true });
  const index: GameIndex = { generatedAt: new Date().toISOString(), games: [] };
  for (const r of results) {
    const g = r.guide;
    if (!g) continue;
    const gameOut = join(out, g.id);
    await mkdir(gameOut, { recursive: true });
    await writeFile(join(gameOut, "guide.json"), JSON.stringify(g));
    if (existsSync(join(r.dir, "images"))) {
      await cp(join(r.dir, "images"), join(gameOut, "images"), { recursive: true });
    }
    const cover = g.scenes[0]?.image.src;
    index.games.push({
      id: g.id,
      schemaVersion: g.schemaVersion,
      title: g.meta.title,
      classification: g.classification,
      bundle: `${g.id}/guide.json`,
      ...(cover ? { cover: `${g.id}/${cover}` } : {}),
    });
  }
  await writeFile(join(out, "index.json"), JSON.stringify(index, null, 2));
  return { results, index };
}

/** Walks up from `start` to the directory containing pnpm-workspace.yaml. */
export function findRepoRoot(start = process.cwd()): string {
  let dir = resolve(start);
  for (;;) {
    if (existsSync(join(dir, "pnpm-workspace.yaml"))) return dir;
    const parent = resolve(dir, "..");
    if (parent === dir) return resolve(start);
    dir = parent;
  }
}

/**
 * Splits a guide into the `content/games/<id>/` file layout (inverse of `loadGameDir`).
 * Used by tests and by the ingestion pipeline to write its output for review.
 */
export async function writeGameDir(dir: string, guide: GameGuide): Promise<void> {
  const { rules, setup, flow, modules, scenes, walkthroughs, guides, ...game } = guide;
  const files: Record<string, unknown> = {
    "game.json": game,
    "rules.json": rules,
    "setup.json": setup,
    "flow.json": flow,
    "scenes.json": scenes,
    "walkthroughs.json": walkthroughs,
    "guides.json": guides,
  };
  for (const m of modules) files[`modules/${m.id}.json`] = m;

  for (const [rel, value] of Object.entries(files)) {
    const path = join(dir, rel);
    await mkdir(join(path, ".."), { recursive: true });
    await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
  }
}
