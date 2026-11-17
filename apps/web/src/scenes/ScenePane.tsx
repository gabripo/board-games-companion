import type { Hotspot } from "@bgc/schema";
import { useState } from "react";
import { useGame } from "../game/GameProvider";
import { useL } from "../i18n";
import { Chip } from "../ui/primitives";
import { HotspotSheet } from "./BoardTab";
import { SceneViewer } from "./SceneViewer";

/** Landscape tablet/desktop: the board stays visible next to Learn/Play/Rules. */
export function ScenePane() {
  const { guide } = useGame();
  const L = useL();
  const [sceneId, setSceneId] = useState(guide.scenes[0]?.id);
  const [open, setOpen] = useState<Hotspot | undefined>();
  const scene = guide.scenes.find((s) => s.id === sceneId);
  if (!scene) return null;
  return (
    <div className="space-y-2">
      {guide.scenes.length > 1 && (
        <div className="flex gap-1.5">
          {guide.scenes.map((s) => (
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
