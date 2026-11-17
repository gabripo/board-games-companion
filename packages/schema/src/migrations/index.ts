import { CURRENT_SCHEMA_VERSION } from "../guide";

/**
 * Upgrades raw guide JSON from older schema versions to the current one.
 * When bumping CURRENT_SCHEMA_VERSION, add a `from: N` migration here and a fixture test.
 */
type Migration = {
  from: number;
  migrate: (raw: Record<string, unknown>) => Record<string, unknown>;
};

const MIGRATIONS: Migration[] = [];

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
