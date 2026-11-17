import type { Annotation, Hotspot, NormalizedRect, Scene } from "@bgc/schema";
import { motion } from "motion/react";
import { type KeyboardEvent, useEffect, useRef } from "react";
import {
  type ReactZoomPanPinchRef,
  TransformComponent,
  TransformWrapper,
} from "react-zoom-pan-pinch";
import { useGame } from "../game/GameProvider";
import { useL, useTranslation } from "../i18n";
import { IconButton } from "../ui/primitives";
import { padRect, shapeBounds } from "./geometry";

export interface SceneViewerProps {
  scene: Scene;
  /** Zoom to this normalized viewport (story-mode steps). */
  focus?: NormalizedRect | undefined;
  /** Zoom to and pulse this hotspot ("Show on board"). */
  focusHotspotId?: string | undefined;
  /** Hotspots drawn emphasized. */
  highlight?: readonly string[] | undefined;
  /** Ids of scene annotations to show (animated in). */
  annotationIds?: readonly string[] | undefined;
  /** Draw every hotspot outline (otherwise only highlighted ones are visible). */
  outlines?: boolean | undefined;
  onHotspotTap?: ((h: Hotspot) => void) | undefined;
  /** Hotspot answer feedback in story mode. */
  feedback?: { hotspotId: string; correct: boolean } | undefined;
  className?: string | undefined;
}

/**
 * An image with an SVG layer in the image's own pixel space (viewBox = image size), so
 * normalized coordinates map exactly and arrows/markers keep their proportions. Hotspots
 * are SVG shapes with button semantics; react-zoom-pan-pinch provides pinch/zoom/pan.
 */
export function SceneViewer(props: SceneViewerProps) {
  const { scene } = props;
  const { assetUrl } = useGame();
  const { t } = useTranslation();
  const L = useL();
  const zoom = useRef<ReactZoomPanPinchRef>(null);
  const focusEl = useRef<HTMLDivElement>(null);
  const { width: W, height: H } = scene.image;

  const focusHotspot = props.focusHotspotId
    ? scene.hotspots.find((h) => h.id === props.focusHotspotId)
    : undefined;
  const focusRect =
    props.focus ?? (focusHotspot ? padRect(shapeBounds(focusHotspot.shape), 0.6) : undefined);
  const focusKey = focusRect ? `${focusRect.x},${focusRect.y},${focusRect.w},${focusRect.h}` : "";

  // biome-ignore lint/correctness/useExhaustiveDependencies: re-run when the target rect changes
  useEffect(() => {
    const z = zoom.current;
    if (!z) return;
    // Let layout settle (image size) before computing the zoom.
    const id = requestAnimationFrame(() => {
      if (focusRect && focusEl.current) {
        void z.zoomToElement(focusEl.current, { maxScale: 4, animationTime: 450 });
      } else {
        void z.resetTransform(300);
      }
    });
    return () => cancelAnimationFrame(id);
  }, [focusKey, scene.id]);

  const visibleAnnotations = (scene.annotations ?? []).filter((a) =>
    props.annotationIds?.includes(a.id),
  );
  const highlight = new Set(props.highlight ?? []);
  if (props.focusHotspotId) highlight.add(props.focusHotspotId);

  const onKey = (h: Hotspot) => (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      props.onHotspotTap?.(h);
    }
  };

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-line bg-black ${props.className ?? ""}`}
    >
      <TransformWrapper
        ref={zoom}
        minScale={1}
        maxScale={6}
        doubleClick={{ mode: "zoomIn" }}
        centerOnInit
      >
        <TransformComponent wrapperStyle={{ width: "100%" }} contentStyle={{ width: "100%" }}>
          <div className="relative w-full" style={{ aspectRatio: `${W} / ${H}` }}>
            <img
              src={assetUrl(scene.image.src)}
              alt={L(scene.image.alt)}
              className="absolute inset-0 size-full select-none"
              draggable={false}
            />
            {focusRect && (
              <div
                ref={focusEl}
                aria-hidden
                className="pointer-events-none absolute"
                style={{
                  left: `${focusRect.x * 100}%`,
                  top: `${focusRect.y * 100}%`,
                  width: `${focusRect.w * 100}%`,
                  height: `${focusRect.h * 100}%`,
                }}
              />
            )}
            <svg
              viewBox={`0 0 ${W} ${H}`}
              preserveAspectRatio="none"
              className="absolute inset-0 size-full"
              data-testid={`scene-${scene.id}`}
            >
              <title>{L(scene.title)}</title>
              <defs>
                <marker
                  id={`arrow-${scene.id}`}
                  viewBox="0 0 10 10"
                  refX="8"
                  refY="5"
                  markerWidth="5"
                  markerHeight="5"
                  orient="auto-start-reverse"
                >
                  <path d="M0 0L10 5L0 10z" fill="var(--accent)" />
                </marker>
              </defs>
              {scene.hotspots.map((h) => (
                <HotspotShapeView
                  key={h.id}
                  hotspot={h}
                  W={W}
                  H={H}
                  label={L(h.label)}
                  visible={props.outlines !== false || highlight.has(h.id)}
                  highlighted={highlight.has(h.id)}
                  pulse={h.id === props.focusHotspotId}
                  feedback={props.feedback?.hotspotId === h.id ? props.feedback.correct : undefined}
                  interactive={props.onHotspotTap !== undefined}
                  onTap={() => props.onHotspotTap?.(h)}
                  onKeyDown={onKey(h)}
                />
              ))}
              {/* Annotations are decoration: taps must reach the hotspots underneath. */}
              {visibleAnnotations.map((a, i) => (
                <AnnotationView
                  key={a.id}
                  annotation={a}
                  W={W}
                  H={H}
                  delay={0.15 + i * 0.35}
                  sceneId={scene.id}
                />
              ))}
            </svg>
          </div>
        </TransformComponent>
      </TransformWrapper>
      <div className="absolute right-2 bottom-2 flex gap-1">
        <IconButton
          icon="minus"
          label={t("board.zoomOut")}
          className="bg-surface/80"
          onClick={() => zoom.current?.zoomOut()}
        />
        <IconButton
          icon="plus"
          label={t("board.zoomIn")}
          className="bg-surface/80"
          onClick={() => zoom.current?.zoomIn()}
        />
        <IconButton
          icon="replay"
          label={t("board.resetZoom")}
          className="bg-surface/80"
          onClick={() => zoom.current?.resetTransform()}
        />
      </div>
    </div>
  );
}

function HotspotShapeView(props: {
  hotspot: Hotspot;
  W: number;
  H: number;
  label: string;
  visible: boolean;
  highlighted: boolean;
  pulse: boolean;
  feedback: boolean | undefined;
  interactive: boolean;
  onTap: () => void;
  onKeyDown: (e: KeyboardEvent) => void;
}) {
  const { hotspot: h, W, H } = props;
  const color =
    props.feedback === true
      ? "var(--ok)"
      : props.feedback === false
        ? "var(--bad)"
        : "var(--accent)";
  const common = {
    "data-testid": `hotspot-${h.id}`,
    fill: color,
    fillOpacity: props.highlighted || props.feedback !== undefined ? 0.3 : props.visible ? 0.08 : 0,
    stroke: color,
    strokeOpacity: props.visible || props.feedback !== undefined ? 1 : 0,
    strokeWidth: props.highlighted ? 4 : 2,
    vectorEffect: "non-scaling-stroke" as const,
    className: `${props.pulse ? "hotspot-pulse" : ""} ${props.interactive ? "cursor-pointer" : ""} outline-none focus-visible:stroke-[6]`,
    ...(props.interactive
      ? {
          role: "button",
          tabIndex: 0,
          "aria-label": props.label,
          onClick: props.onTap,
          onKeyDown: props.onKeyDown,
        }
      : { "aria-hidden": true }),
  };
  if (h.shape.kind === "rect") {
    const r = h.shape.rect;
    return (
      <rect
        x={r.x * W}
        y={r.y * H}
        width={r.w * W}
        height={r.h * H}
        rx={Math.min(W, H) * 0.012}
        {...common}
      />
    );
  }
  return (
    <polygon points={h.shape.points.map((p) => `${p.x * W},${p.y * H}`).join(" ")} {...common} />
  );
}

function AnnotationView(props: {
  annotation: Annotation;
  W: number;
  H: number;
  delay: number;
  sceneId: string;
}) {
  const { annotation: a, W, H, delay } = props;
  const L = useL();
  const unit = Math.min(W, H);
  const fontSize = unit * 0.045;
  const label = a.label ? L(a.label) : undefined;
  const textProps = {
    fontSize,
    fill: "var(--ink)",
    stroke: "var(--bg)",
    strokeWidth: fontSize * 0.25,
    paintOrder: "stroke" as const,
    fontWeight: 700,
    fontFamily: "sans-serif",
  };

  switch (a.kind) {
    case "arrow":
      return (
        <g data-testid={`annotation-${a.id}`} pointerEvents="none">
          <motion.line
            x1={a.from.x * W}
            y1={a.from.y * H}
            x2={a.to.x * W}
            y2={a.to.y * H}
            stroke="var(--accent)"
            strokeWidth={unit * 0.012}
            strokeLinecap="round"
            markerEnd={`url(#arrow-${props.sceneId})`}
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 0.6, delay }}
          />
          {label && (
            <motion.text
              x={((a.from.x + a.to.x) / 2) * W}
              y={((a.from.y + a.to.y) / 2) * H - fontSize * 0.6}
              textAnchor="middle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: delay + 0.5 }}
              {...textProps}
            >
              {label}
            </motion.text>
          )}
        </g>
      );
    case "marker": {
      const tone = {
        info: "var(--info)",
        place: "var(--ok)",
        remove: "var(--bad)",
        warning: "var(--warn)",
      }[a.tone ?? "info"];
      return (
        <g data-testid={`annotation-${a.id}`} pointerEvents="none">
          <motion.circle
            cx={a.at.x * W}
            cy={a.at.y * H}
            r={unit * 0.035}
            fill={tone}
            stroke="var(--bg)"
            strokeWidth={unit * 0.008}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: [0, 1.3, 1], opacity: 1 }}
            transition={{ duration: 0.5, delay }}
            style={{ transformBox: "fill-box", transformOrigin: "center" }}
          />
          {label && (
            <text x={a.at.x * W} y={a.at.y * H - unit * 0.06} textAnchor="middle" {...textProps}>
              {label}
            </text>
          )}
        </g>
      );
    }
    case "highlight":
      return (
        <motion.rect
          data-testid={`annotation-${a.id}`}
          pointerEvents="none"
          x={a.rect.x * W}
          y={a.rect.y * H}
          width={a.rect.w * W}
          height={a.rect.h * H}
          rx={unit * 0.015}
          fill="var(--accent)"
          fillOpacity={0.18}
          stroke="var(--accent)"
          strokeWidth={unit * 0.008}
          strokeDasharray={`${unit * 0.02} ${unit * 0.012}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 1, 0.6, 1] }}
          transition={{ duration: 1.2, delay }}
        />
      );
  }
}
