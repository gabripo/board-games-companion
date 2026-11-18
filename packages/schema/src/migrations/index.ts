import { CURRENT_SCHEMA_VERSION } from "../guide";

/**
 * Upgrades raw guide JSON from older schema versions to the current one.
 * When bumping CURRENT_SCHEMA_VERSION, add a `from: N` migration here and a fixture test.
 */
type Migration = {
  from: number;
  migrate: (raw: Record<string, unknown>) => Record<string, unknown>;
};

/** "turn-order" → "Turn order" (fallback name for topics that were never translated). */
export function humanizeId(id: string): string {
  const words = id.replaceAll("-", " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

const MIGRATIONS: Migration[] = [
  {
    // v2: topic tags are declared with translated names. Derive them from the rules;
    // names fall back to the humanized id (integrity warns they are untranslated).
    from: 1,
    migrate: (doc) => {
      if (Array.isArray(doc.topics)) return doc;
      const ids = new Set<string>();
      for (const rule of Array.isArray(doc.rules) ? doc.rules : []) {
        const topics = (rule as { topics?: unknown }).topics;
        if (Array.isArray(topics)) for (const t of topics) if (typeof t === "string") ids.add(t);
      }
      const topics = [...ids].map((id) => {
        const name = humanizeId(id);
        return { id, name: { en: name, it: name } };
      });
      return { ...doc, topics };
    },
  },
];

export class UnsupportedSchemaVersionError extends Error {}

export function migrateToCurrent(raw: unknown): unknown {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return raw;
  let doc = raw as Record<string, unknown>;
  let version = doc.schemaVersion;
  if (typeof version !== "number") return raw; // let the schema report it

  if (version > CURRENT_SCHEMA_VERSION) {
    throw new UnsupportedSchemaVersionError(
      `guide schemaVersion ${version} is newer than supported ${CURRENT_SCHEMA_VERSION} — update the app`,
    );
  }
  while (version < CURRENT_SCHEMA_VERSION) {
    const step = MIGRATIONS.find((m) => m.from === version);
    if (!step)
      throw new UnsupportedSchemaVersionError(`no migration from schemaVersion ${version}`);
    doc = { ...step.migrate(doc), schemaVersion: version + 1 };
    version += 1;
  }
  return doc;
}
