import type { Hotspot } from "@bgc/schema";
import { useState } from "react";
import { useGame } from "../game/GameProvider";
import { useL } from "../i18n";
import { Chip } from "../ui/primitives";
import { HotspotSheet } from "./BoardTab";
import { SceneViewer } from "./SceneViewer";

/** Landscape tablet/desktop: the board stays visible next to Learn/Play/Rules. */
export function ScenePane() {
  const { guide, isApplicable } = useGame();
  const L = useL();
  const scenes = guide.scenes.filter((s) => isApplicable(s.conditions));
  const [sceneId, setSceneId] = useState(scenes[0]?.id);
  const [open, setOpen] = useState<Hotspot | undefined>();
  const scene = scenes.find((s) => s.id === sceneId) ?? scenes[0];
  if (!scene) return null;
  return (
    <div className="space-y-2">
      {scenes.length > 1 && (
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {scenes.map((s) => (
            <Chip
              key={s.id}
              tone={s.id === scene.id ? "accent" : "neutral"}
              onClick={() => setSceneId(s.id)}
            >
              {L(s.title)}
            </Chip>
          ))}
        </div>
      )}
      <SceneViewer scene={scene} onHotspotTap={setOpen} />
      <HotspotSheet hotspot={open} onClose={() => setOpen(undefined)} />
    </div>
  );
}
