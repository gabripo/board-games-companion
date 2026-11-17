import type { HotspotShape, NormalizedRect, Scene, SceneRef } from "@bgc/schema";

/** Bounding box of a hotspot shape in normalized (0–1) coordinates. */
export function shapeBounds(shape: HotspotShape): NormalizedRect {
  if (shape.kind === "rect") return shape.rect;
  const xs = shape.points.map((p) => p.x);
  const ys = shape.points.map((p) => p.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

/** Grows a rect by `pad` (relative to its size) while keeping it inside the image. */
export function padRect(r: NormalizedRect, pad = 0.25): NormalizedRect {
  const w = Math.min(1, r.w * (1 + 2 * pad));
  const h = Math.min(1, r.h * (1 + 2 * pad));
  const x = Math.min(Math.max(0, r.x - r.w * pad), 1 - w);
  const y = Math.min(Math.max(0, r.y - r.h * pad), 1 - h);
  return { x, y, w, h };
}

export function findHotspot(scenes: readonly Scene[], ref: SceneRef) {
  const scene = scenes.find((s) => s.id === ref.sceneId);
  const hotspot = ref.hotspotId ? scene?.hotspots.find((h) => h.id === ref.hotspotId) : undefined;
  return { scene, hotspot };
}

/**
 * CSS background settings that show only `rect` of an image inside a box — used for icon
 * crops, setup thumbnails and glossary icons without generating extra image files.
 */
export function cropStyle(imageUrl: string, rect: NormalizedRect) {
  const pos = (offset: number, size: number) => (size >= 1 ? 0 : (offset / (1 - size)) * 100);
  return {
    backgroundImage: `url("${imageUrl}")`,
    backgroundSize: `${100 / rect.w}% ${100 / rect.h}%`,
    backgroundPosition: `${pos(rect.x, rect.w)}% ${pos(rect.y, rect.h)}%`,
    backgroundRepeat: "no-repeat",
  } as const;
}
