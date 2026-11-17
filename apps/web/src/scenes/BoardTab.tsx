import type { Hotspot, Scene } from "@bgc/schema";
import { useEffect, useState } from "react";
import { useGame } from "../game/GameProvider";
import { RuleCard } from "../game/RuleCard";
import { useL, useTranslation } from "../i18n";
import { BottomSheet } from "../ui/BottomSheet";
import { Button, Chip, EmptyState, SegmentedControl } from "../ui/primitives";
import { SceneViewer } from "./SceneViewer";

/** What a hotspot explains: label, description, linked rules and an optional clip. */
export function HotspotSheet(props: { hotspot: Hotspot | undefined; onClose: () => void }) {
  const { rule, openClip } = useGame();
  const { t } = useTranslation();
  const L = useL();
  const h = props.hotspot;
  const rules = (h?.ruleRefs ?? []).flatMap((id) => rule(id) ?? []);
  return (
    <BottomSheet open={h !== undefined} onClose={props.onClose} title={h ? L(h.label) : ""}>
      {h && (
        <div className="space-y-3" data-testid={`hotspot-sheet-${h.id}`}>
          {h.description && <p className="text-muted">{L(h.description)}</p>}
          {h.clip && (
            <Button icon="video" onClick={() => h.clip && openClip(h.clip)}>
              {t("rule.watch")}
            </Button>
          )}
          {rules.map((r) => (
            <RuleCard key={r.id} rule={r} defaultExpanded compact />
          ))}
          {rules.length === 0 && !h.description && (
            <p className="text-muted">{t("board.noRules")}</p>
          )}
        </div>
      )}
    </BottomSheet>
  );
}

function HotspotList(props: { scene: Scene; onTap: (h: Hotspot) => void }) {
  const L = useL();
  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {props.scene.hotspots.map((h) => (
        <li key={h.id}>
          <button
            type="button"
            onClick={() => props.onTap(h)}
            className="flex min-h-11 w-full items-center justify-between gap-2 rounded-xl border border-line bg-surface px-4 py-2 text-left hover:border-accent"
          >
            <span className="font-medium">{L(h.label)}</span>
            {(h.ruleRefs?.length ?? 0) > 0 && <Chip tone="accent">{h.ruleRefs?.length}</Chip>}
          </button>
        </li>
      ))}
    </ul>
  );
}

export function BoardTab(props: {
  focusScene?: string | undefined;
  focusHotspot?: string | undefined;
}) {
  const { guide } = useGame();
  const { t } = useTranslation();
  const L = useL();
  const initial = guide.scenes.find((s) => s.id === props.focusScene) ?? guide.scenes[0];
  const [sceneId, setSceneId] = useState(initial?.id);
  const [view, setView] = useState<"board" | "list">("board");
  const [outlines, setOutlines] = useState(true);
  const [open, setOpen] = useState<Hotspot | undefined>();
  const [focusHotspot, setFocusHotspot] = useState(props.focusHotspot);

  // Follow new "Show on board" requests.
  useEffect(() => {
    if (props.focusScene) setSceneId(props.focusScene);
    setFocusHotspot(props.focusHotspot);
  }, [props.focusScene, props.focusHotspot]);

  const scene = guide.scenes.find((s) => s.id === sceneId) ?? guide.scenes[0];
  if (!scene) return <EmptyState icon="board" title={t("board.empty")} />;

  return (
    <div className="space-y-3 p-4">
      {guide.scenes.length > 1 && (
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {guide.scenes.map((s) => (
            <Chip
              key={s.id}
              tone={s.id === scene.id ? "accent" : "neutral"}
              onClick={() => {
                setSceneId(s.id);
                setFocusHotspot(undefined);
              }}
            >
              {L(s.title)}
            </Chip>
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="flex-1 text-lg font-semibold">{L(scene.title)}</h2>
        <SegmentedControl<"board" | "list">
          label={t("board.view")}
          value={view}
          onChange={setView}
          options={[
            { value: "board", label: t("board.picture") },
            { value: "list", label: t("board.list") },
          ]}
        />
      </div>
      {view === "board" ? (
        <>
          <SceneViewer
            scene={scene}
            focusHotspotId={focusHotspot}
            outlines={outlines}
            onHotspotTap={setOpen}
          />
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
            <Button variant="ghost" icon="eye" onClick={() => setOutlines((o) => !o)}>
              {outlines ? t("board.hideOutlines") : t("board.showOutlines")}
            </Button>
            <span>{t("board.hint")}</span>
          </div>
        </>
      ) : (
        <HotspotList scene={scene} onTap={setOpen} />
      )}
      <HotspotSheet hotspot={open} onClose={() => setOpen(undefined)} />
    </div>
  );
}
