import { z } from "zod";
import { GameGuide } from "./guide";
import { MODULE_SCHEMAS } from "./modules/modules";

/**
 * JSON Schemas for LLM structured output (Phase 2 ingestion) and editor tooling.
 * Key = output file name without extension.
 */
export function exportJsonSchemas(): Record<string, unknown> {
  const out: Record<string, unknown> = {
    "game-guide": z.toJSONSchema(GameGuide, { target: "draft-2020-12" }),
  };
  for (const [kind, schema] of Object.entries(MODULE_SCHEMAS)) {
    out[`module-${kind}`] = z.toJSONSchema(schema, { target: "draft-2020-12" });
  }
  return out;
}
