import type { GameGuide, Locale } from "@bgc/schema";
import MiniSearch from "minisearch";

/** Lowercase + strip accents so "città" matches "citta" and vice versa. */
export function normalize(term: string): string {
  return term
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

interface RuleDoc {
  id: string;
  summary: string;
  detail: string;
  topics: string;
  /** Glossary terms + aliases (both languages) linked to the rule. */
  terms: string;
  /** The same rule in the other language — mixed-language tables search either way. */
  other: string;
}

export interface RuleSearch {
  search(query: string): string[];
}

/** Builds a per-language, accent-insensitive, typo-tolerant index over a guide's rules. */
export function buildRuleSearch(guide: GameGuide, lang: Locale): RuleSearch {
  const otherLang: Locale = lang === "en" ? "it" : "en";
  const termsByRule = new Map<string, string[]>();
  for (const g of guide.glossary) {
    const words = [g.term.en, g.term.it, ...(g.aliases?.en ?? []), ...(g.aliases?.it ?? [])];
    for (const r of g.ruleRefs ?? []) termsByRule.set(r, [...(termsByRule.get(r) ?? []), ...words]);
  }

  const docs: RuleDoc[] = guide.rules.map((r) => ({
    id: r.id,
    summary: r.summary[lang],
    detail: r.detail?.[lang] ?? "",
    topics: r.topics.join(" ").replaceAll("-", " "),
    terms: (termsByRule.get(r.id) ?? []).join(" "),
    other: `${r.summary[otherLang]} ${r.detail?.[otherLang] ?? ""}`,
  }));

  const index = new MiniSearch<RuleDoc>({
    fields: ["summary", "detail", "topics", "terms", "other"],
    processTerm: (t) => normalize(t),
    searchOptions: {
      boost: { summary: 3, terms: 2, topics: 1.5, detail: 1, other: 0.5 },
      prefix: true,
      fuzzy: 0.2,
      combineWith: "AND",
    },
  });
  index.addAll(docs);

  return {
    search: (query) => (query.trim() ? index.search(query).map((r) => String(r.id)) : []),
  };
}
