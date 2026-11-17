import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import en from "../src/i18n/locales/en.json";
import it_ from "../src/i18n/locales/it.json";

type Tree = { [k: string]: string | Tree };
const flatten = (t: Tree, prefix = ""): string[] =>
  Object.entries(t).flatMap(([k, v]) =>
    typeof v === "string" ? [`${prefix}${k}`] : flatten(v, `${prefix}${k}.`),
  );

const enKeys = new Set(flatten(en as Tree));
const itKeys = new Set(flatten(it_ as Tree));

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) return sourceFiles(p);
    return /\.tsx?$/.test(f) && !/\.test\./.test(f) ? [p] : [];
  });
}

describe("locales", () => {
  it("English and Italian have exactly the same keys", () => {
    expect([...enKeys].filter((k) => !itKeys.has(k))).toEqual([]);
    expect([...itKeys].filter((k) => !enKeys.has(k))).toEqual([]);
  });

  it("no empty translations", () => {
    const empty = (t: Tree): boolean =>
      Object.values(t).some((v) => (typeof v === "string" ? v.trim() === "" : empty(v)));
    expect(empty(en as Tree)).toBe(false);
    expect(empty(it_ as Tree)).toBe(false);
  });

  it("every static t() key used in the source exists", () => {
    const srcDir = join(import.meta.dirname, "../src");
    const missing: string[] = [];
    for (const file of sourceFiles(srcDir)) {
      const code = readFileSync(file, "utf8");
      for (const m of code.matchAll(/\bt\(\s*"([a-zA-Z0-9_.-]+)"/g)) {
        const key = m[1] as string;
        const exists = enKeys.has(key) || enKeys.has(`${key}_one`) || enKeys.has(`${key}_other`);
        if (!exists) missing.push(`${file.replace(srcDir, "src")}: ${key}`);
      }
      // Dynamic keys like t(`tabs.${tab}`): the prefix must exist.
      for (const m of code.matchAll(/\bt\(\s*`([a-zA-Z0-9_.-]+)\.\$\{/g)) {
        const prefix = `${m[1]}.`;
        if (![...enKeys].some((k) => k.startsWith(prefix))) {
          missing.push(`${file.replace(srcDir, "src")}: ${prefix}*`);
        }
      }
    }
    expect(missing).toEqual([]);
  });
});
