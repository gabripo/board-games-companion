import { z } from "zod";

/** Stable kebab-case identifier used for every referenceable entity. */
export const Id = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "must be kebab-case (a-z, 0-9, single dashes)");
export type Id = z.infer<typeof Id>;

export const Locale = z.enum(["en", "it"]);
export type Locale = z.infer<typeof Locale>;
export const LOCALES = Locale.options;

/** Every user-facing content string must exist in both supported languages. */
export const LocalizedString = z.strictObject({
  en: z.string().trim().min(1, "English text is required"),
  it: z.string().trim().min(1, "Italian text is required"),
});
export type LocalizedString = z.infer<typeof LocalizedString>;

/** A coordinate relative to an image: 0 = left/top edge, 1 = right/bottom edge. */
export const Unit = z.number().min(0, "must be ≥ 0").max(1, "must be ≤ 1");

export const NormalizedPoint = z.strictObject({ x: Unit, y: Unit });
export type NormalizedPoint = z.infer<typeof NormalizedPoint>;

export const NormalizedRect = z
  .strictObject({
    x: Unit,
    y: Unit,
    w: z.number().positive().max(1),
    h: z.number().positive().max(1),
  })
  .refine((r) => r.x + r.w <= 1 + 1e-9 && r.y + r.h <= 1 + 1e-9, {
    message: "rect must stay inside the image (x + w ≤ 1 and y + h ≤ 1)",
  });
export type NormalizedRect = z.infer<typeof NormalizedRect>;

/** YouTube video id: 11 chars of [A-Za-z0-9_-]. */
export const YouTubeVideoId = z
  .string()
  .regex(/^[A-Za-z0-9_-]{11}$/, "must be an 11-character YouTube video id");

/** A segment of a YouTube video, played through the official IFrame embed only. */
export const YouTubeClip = z
  .strictObject({
    videoId: YouTubeVideoId,
    /** Seconds from the start of the video. */
    start: z.int().nonnegative(),
    end: z.int().positive(),
    /** Spoken language of the video. */
    lang: Locale,
  })
  .refine((c) => c.end > c.start, { message: "clip end must be after start", path: ["end"] });
export type YouTubeClip = z.infer<typeof YouTubeClip>;

/** Where a claim comes from. PDF page citations of the official rulebook are ground truth. */
export const PageCitation = z.strictObject({
  kind: z.literal("page"),
  sourceId: Id,
  page: z.int().positive(),
});
export const TimeCitation = z
  .strictObject({
    kind: z.literal("time"),
    sourceId: Id,
    /** Seconds. */
    tStart: z.int().nonnegative(),
    tEnd: z.int().positive(),
  })
  .refine((c) => c.tEnd > c.tStart, { message: "tEnd must be after tStart", path: ["tEnd"] });
export const UrlCitation = z.strictObject({
  kind: z.literal("url"),
  sourceId: Id,
  /** Optional fragment / section anchor within the source URL. */
  anchor: z.string().min(1).optional(),
});
export const Citation = z.discriminatedUnion("kind", [PageCitation, TimeCitation, UrlCitation]);
export type Citation = z.infer<typeof Citation>;

/**
 * Restricts content to some session contexts. Each specified dimension must match;
 * within a dimension any listed value matches.
 */
export const Conditions = z.strictObject({
  playerCount: z.array(z.int().positive()).min(1).optional(),
  variants: z.array(Id).min(1).optional(),
  expansions: z.array(Id).min(1).optional(),
});
export type Conditions = z.infer<typeof Conditions>;

/** Points at a scene, optionally at one hotspot within it. */
export const SceneRef = z.strictObject({
  sceneId: Id,
  hotspotId: Id.optional(),
});
export type SceneRef = z.infer<typeof SceneRef>;
