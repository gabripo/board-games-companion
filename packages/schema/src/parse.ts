import type { z } from "zod";
import { type GameGuide, GameGuide as GameGuideSchema } from "./guide";
import { checkIntegrity } from "./integrity/check";
import { formatPath, type IntegrityIssue } from "./integrity/issues";
import { migrateToCurrent } from "./migrations";

/** Converts a ZodError into the same issue shape used by integrity checks. */
export function zodIssues(error: z.ZodError, pathPrefix: readonly (string | number)[] = []) {
  return error.issues.map(
    (i): IntegrityIssue => ({
      severity: "error",
      path: formatPath([
        ...pathPrefix,
        ...i.path.map((p) => (typeof p === "symbol" ? String(p) : p)),
      ]),
      message: i.message,
    }),
  );
}

export type GuideParseResult =
  | { ok: true; guide: GameGuide; warnings: IntegrityIssue[] }
  | { ok: false; issues: IntegrityIssue[] };

/** Migrate → schema-parse → integrity-check a raw guide bundle. */
export function parseGuide(raw: unknown): GuideParseResult {
  const parsed = GameGuideSchema.safeParse(migrateToCurrent(raw));
  if (!parsed.success) return { ok: false, issues: zodIssues(parsed.error) };
  const issues = checkIntegrity(parsed.data);
  const errors = issues.filter((i) => i.severity === "error");
  if (errors.length > 0) return { ok: false, issues };
  return { ok: true, guide: parsed.data, warnings: issues };
}
