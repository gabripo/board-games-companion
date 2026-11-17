/** pnpm schemas — writes JSON Schemas to dist/schemas/ (for LLM structured output / editors). */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { exportJsonSchemas } from "../json-schema";
import { findRepoRoot } from "../node/bundle";

const outDir = join(findRepoRoot(), "dist/schemas");
await mkdir(outDir, { recursive: true });
const schemas = exportJsonSchemas();
for (const [name, schema] of Object.entries(schemas)) {
  await writeFile(join(outDir, `${name}.schema.json`), `${JSON.stringify(schema, null, 2)}\n`);
}
console.log(`Wrote ${Object.keys(schemas).length} JSON Schemas to dist/schemas/`);
