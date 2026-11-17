import type { SceneRef } from "@bgc/schema";
import { useGame } from "../game/GameProvider";
import { cx } from "../ui/primitives";
import { cropStyle, findHotspot, padRect, shapeBounds } from "./geometry";

/** Thumbnail of a scene region (a hotspot, or the whole scene). Renders nothing if unresolved. */
export function SceneCrop(props: { sceneRef: SceneRef; className?: string; label?: string }) {
  const { guide, assetUrl } = useGame();
  const { scene, hotspot } = findHotspot(guide.scenes, props.sceneRef);
  if (!scene) return null;
  const rect = hotspot ? padRect(shapeBounds(hotspot.shape), 0.1) : { x: 0, y: 0, w: 1, h: 1 };
  return (
    <div
      {...(props.label ? { role: "img", "aria-label": props.label } : { "aria-hidden": true })}
      className={cx("shrink-0 rounded-lg border border-line bg-surface-2", props.className)}
      style={cropStyle(assetUrl(scene.image.src), rect)}
    />
  );
}
