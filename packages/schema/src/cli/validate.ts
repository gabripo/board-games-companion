/**
 * pnpm validate [contentDir] [--out <dir>] [--no-out] [--strict]
 *
 * Validates every content/games/<id>/ folder (schema + integrity + image files) and,
 * when everything is valid, writes the bundles to dist/games (or --out).
 * --strict also fails on warnings. Exit code 1 on failure.
 */
import { basename, join, relative, resolve } from "node:path";
import { parseArgs } from "node:util";
import { bundleAll, findRepoRoot } from "../node/bundle";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    out: { type: "string" },
    "no-out": { type: "boolean", default: false },
    strict: { type: "boolean", default: false },
  },
});

const root = findRepoRoot();
const contentDir = resolve(positionals[0] ?? join(root, "content/games"));
const outDir = values["no-out"] ? undefined : resolve(values.out ?? join(root, "dist/games"));

const { results, index } = await bundleAll(contentDir, outDir);

let errors = 0;
let warnings = 0;
for (const r of results) {
  const e = r.issues.filter((i) => i.severity === "error");
  const w = r.issues.filter((i) => i.severity === "warning");
  errors += e.length;
  warnings += w.length;
  const status = e.length > 0 ? "✗" : "✓";
  console.log(`${status} ${basename(r.dir)}  (${e.length} errors, ${w.length} warnings)`);
  for (const i of [...e, ...w]) {
    console.log(`    ${i.severity === "error" ? "error" : "warn "}  ${i.path}: ${i.message}`);
  }
}

if (results.length === 0) console.log(`No games found in ${relative(root, contentDir) || "."}`);
if (index && outDir) {
  console.log(`\nWrote ${index.games.length} bundle(s) to ${relative(root, outDir)}/`);
}

const failed = errors > 0 || (values.strict && warnings > 0);
console.log(`\n${failed ? "FAILED" : "OK"}: ${errors} errors, ${warnings} warnings`);
process.exit(failed ? 1 : 0);
