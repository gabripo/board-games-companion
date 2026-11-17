import { z } from "zod";
import { Citation, Conditions, Id, LocalizedString, SceneRef, YouTubeClip } from "./primitives";

/** A claim from a secondary source (video/web) that disagrees with the ground truth. */
export const Conflict = z.strictObject({
  claim: LocalizedString,
  citation: Citation,
  /** How it was resolved — normally "the official rulebook says…". */
  resolution: LocalizedString,
});
export type Conflict = z.infer<typeof Conflict>;

export const Rule = z.strictObject({
  id: Id,
  /** Kebab-case topic tags, used for filtering and search facets. */
  topics: z.array(Id).min(1),
  summary: LocalizedString,
  detail: LocalizedString.optional(),
  appliesTo: z
    .strictObject({
      flowNodes: z.array(Id),
      components: z.array(Id),
      modules: z.array(Id),
    })
    .partial()
    .optional(),
  conditions: Conditions.optional(),
  citations: z.array(Citation).min(1, "every rule needs at least one citation"),
  conflicts: z.array(Conflict).optional(),
  confidence: z.enum(["high", "medium", "low"]),
  sceneRefs: z.array(SceneRef).optional(),
  clips: z.array(YouTubeClip).optional(),
});
export type Rule = z.infer<typeof Rule>;

export const SetupArea = z.strictObject({
  id: Id,
  name: LocalizedString,
});

export const SetupStep = z.strictObject({
  id: Id,
  areaId: Id.optional(),
  text: LocalizedString,
  components: z.array(Id).optional(),
  sceneRef: SceneRef.optional(),
  conditions: Conditions.optional(),
  ruleRefs: z.array(Id).optional(),
});
export type SetupStep = z.infer<typeof SetupStep>;

export const Setup = z.strictObject({
  areas: z.array(SetupArea),
  steps: z.array(SetupStep).min(1),
});
export type Setup = z.infer<typeof Setup>;
