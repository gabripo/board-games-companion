import { z } from "zod";
import {
  Conditions,
  Id,
  LocalizedString,
  NormalizedPoint,
  NormalizedRect,
  YouTubeClip,
} from "../core/primitives";

/** A scene = any image (board, player board, card, dice, setup photo) + interactive layers. */

export const HotspotShape = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("rect"), rect: NormalizedRect }),
  z.strictObject({
    kind: z.literal("polygon"),
    points: z.array(NormalizedPoint).min(3, "a polygon needs at least 3 points"),
  }),
]);
export type HotspotShape = z.infer<typeof HotspotShape>;

export const Hotspot = z.strictObject({
  id: Id,
  label: LocalizedString,
  description: LocalizedString.optional(),
  shape: HotspotShape,
  ruleRefs: z.array(Id).optional(),
  clip: YouTubeClip.optional(),
});
export type Hotspot = z.infer<typeof Hotspot>;

export const Annotation = z.discriminatedUnion("kind", [
  z.strictObject({
    id: Id,
    kind: z.literal("arrow"),
    from: NormalizedPoint,
    to: NormalizedPoint,
    label: LocalizedString.optional(),
  }),
  z.strictObject({
    id: Id,
    kind: z.literal("marker"),
    at: NormalizedPoint,
    label: LocalizedString.optional(),
    tone: z.enum(["info", "place", "remove", "warning"]).optional(),
  }),
  z.strictObject({
    id: Id,
    kind: z.literal("highlight"),
    rect: NormalizedRect,
    label: LocalizedString.optional(),
  }),
]);
export type Annotation = z.infer<typeof Annotation>;

export const Scene = z.strictObject({
  id: Id,
  title: LocalizedString,
  image: z.strictObject({
    /** Path relative to the game folder, e.g. "images/board.webp". */
    src: z
      .string()
      .regex(/^images\/[a-z0-9._-]+\.(webp|avif|png|jpg|jpeg|svg)$/, "must be images/<file>"),
    width: z.int().positive(),
    height: z.int().positive(),
    alt: LocalizedString,
  }),
  hotspots: z.array(Hotspot),
  annotations: z.array(Annotation).optional(),
});
export type Scene = z.infer<typeof Scene>;

export const WalkthroughStep = z.strictObject({
  id: Id,
  text: LocalizedString,
  flowNodeRef: Id.optional(),
  sceneId: Id.optional(),
  /** Zoom the scene to this viewport for the step. */
  focus: NormalizedRect.optional(),
  highlightHotspots: z.array(Id).optional(),
  /** Ids of annotations of the step's scene to show (animated in). */
  annotations: z.array(Id).optional(),
  clip: YouTubeClip.optional(),
  /** "Try it": the user must tap the right hotspot. */
  check: z
    .strictObject({
      question: LocalizedString,
      answerHotspotId: Id,
      explanation: LocalizedString.optional(),
    })
    .optional(),
});
export type WalkthroughStep = z.infer<typeof WalkthroughStep>;

export const Walkthrough = z.strictObject({
  id: Id,
  title: LocalizedString,
  level: z.enum(["newbie", "experienced", "any"]),
  conditions: Conditions.optional(),
  steps: z.array(WalkthroughStep).min(1),
});
export type Walkthrough = z.infer<typeof Walkthrough>;
