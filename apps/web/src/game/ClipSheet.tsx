import type { YouTubeClip } from "@bgc/schema";
import { useEffect, useState } from "react";
import { formatTime, useLocale, useTranslation } from "../i18n";
import { useOnline } from "../offline/useOnline";
import { BottomSheet } from "../ui/BottomSheet";
import { Icon } from "../ui/Icon";
import { Button, Chip } from "../ui/primitives";

/** Embed URL for a clip segment. Only the official IFrame embed is used — never downloads. */
export function clipEmbedUrl(clip: YouTubeClip, autoplay = true): string {
  const q = new URLSearchParams({
    start: String(clip.start),
    end: String(clip.end),
    rel: "0",
    playsinline: "1",
    modestbranding: "1",
  });
  if (autoplay) q.set("autoplay", "1");
  return `https://www.youtube-nocookie.com/embed/${clip.videoId}?${q}`;
}

/** Plays a YouTube segment behind a lightweight facade (no YouTube requests until tapped). */
export function ClipPlayer(props: { clip: YouTubeClip }) {
  const { clip } = props;
  const { t } = useTranslation();
  const locale = useLocale();
  const online = useOnline();
  const [playing, setPlaying] = useState(false);
  const [run, setRun] = useState(0);

  const clipKey = `${clip.videoId}:${clip.start}`;
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset when the clip changes
  useEffect(() => setPlaying(false), [clipKey]);

  return (
    <div className="space-y-3">
      <div className="relative aspect-video overflow-hidden rounded-2xl bg-black">
        {!online ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center text-muted">
            <Icon name="offline" size={32} />
            <p>{t("clip.offline")}</p>
          </div>
        ) : playing ? (
          <iframe
            key={run}
            title={t("clip.title")}
            src={clipEmbedUrl(clip)}
            className="size-full"
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <button
            type="button"
            onClick={() => setPlaying(true)}
            className="group relative size-full"
            aria-label={t("clip.play", { from: formatTime(clip.start), to: formatTime(clip.end) })}
          >
            <img
              src={`https://i.ytimg.com/vi/${clip.videoId}/hqdefault.jpg`}
              alt=""
              className="size-full object-cover opacity-70"
              loading="lazy"
            />
            <span className="absolute inset-0 m-auto flex size-16 items-center justify-center rounded-full bg-accent text-accent-ink shadow-lg transition group-hover:scale-105">
              <Icon name="play" size={28} />
            </span>
          </button>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Chip icon="video">
          {formatTime(clip.start)}–{formatTime(clip.end)}
        </Chip>
        {clip.lang !== locale && <Chip tone="info">{t(`clip.lang.${clip.lang}`)}</Chip>}
        <span className="flex-1" />
        {playing && online && (
          <Button icon="replay" onClick={() => setRun((r) => r + 1)}>
            {t("clip.replay")}
          </Button>
        )}
      </div>
    </div>
  );
}

export function ClipSheet(props: { clip: YouTubeClip | undefined; onClose: () => void }) {
  const { t } = useTranslation();
  return (
    <BottomSheet open={props.clip !== undefined} onClose={props.onClose} title={t("clip.title")}>
      {props.clip && <ClipPlayer clip={props.clip} />}
    </BottomSheet>
  );
}
