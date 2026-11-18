import { describe, expect, it } from "vitest";
import {
  CURRENT_SCHEMA_VERSION,
  humanizeId,
  migrateToCurrent,
  parseGuide,
  UnsupportedSchemaVersionError,
} from "../src";
import { exportJsonSchemas } from "../src/json-schema";
import { clone, sequentialGame } from "./fixtures/archetypes";

describe("JSON Schema export", () => {
  const schemas = exportJsonSchemas();

  it("exports the guide and one schema per module kind", () => {
    expect(Object.keys(schemas).sort()).toEqual([
      "game-guide",
      "module-actions",
      "module-cards",
      "module-dice",
      "module-scoring",
      "module-sections",
    ]);
  });

  it("describes the guide as a strict object with required core fields", () => {
    const guide = schemas["game-guide"] as {
      type: string;
      required: string[];
      additionalProperties: boolean;
    };
    expect(guide.type).toBe("object");
    expect(guide.additionalProperties).toBe(false);
    expect(guide.required).toEqual(expect.arrayContaining(["id", "rules", "flow", "modules"]));
  });

  it("serializes the recursive flow graph", () => {
    expect(() => JSON.stringify(schemas["game-guide"])).not.toThrow();
  });
});

describe("migrations", () => {
  it("passes the current version through unchanged", () => {
    const g = clone(sequentialGame);
    expect(migrateToCurrent(g)).toEqual(g);
  });

  it("rejects guides from a newer app version", () => {
    const g = { ...clone(sequentialGame), schemaVersion: CURRENT_SCHEMA_VERSION + 1 };
    expect(() => migrateToCurrent(g)).toThrow(UnsupportedSchemaVersionError);
  });

  it("leaves non-objects for the schema to reject", () => {
    expect(migrateToCurrent("nope")).toBe("nope");
    expect(migrateToCurrent({})).toEqual({});
  });
});

describe("v1 → v2 migration (translated topics)", () => {
  const v1 = () => {
    const { topics: _topics, ...rest } = clone(sequentialGame);
    return { ...rest, schemaVersion: 1 };
  };

  it("humanizes ids", () => {
    expect(humanizeId("turn-order")).toBe("Turn order");
  });

  it("derives topics from the rules so v1 bundles still parse", () => {
    const r = parseGuide(v1());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.guide.schemaVersion).toBe(2);
    expect(r.guide.topics.map((t) => t.id).sort()).toEqual(["followers", "setup", "tiles", "turn"]);
    expect(r.guide.topics.find((t) => t.id === "tiles")?.name).toEqual({
      en: "Tiles",
      it: "Tiles",
    });
    expect(r.warnings.some((w) => /not translated/.test(w.message))).toBe(true);
  });

  it("keeps explicitly declared topics", () => {
    const doc = { ...v1(), topics: clone(sequentialGame).topics };
    expect((migrateToCurrent(doc) as { topics: unknown }).topics).toEqual(sequentialGame.topics);
  });
});
