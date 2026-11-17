import { useEffect, useRef, useState } from "react";
import { formatTime, useTranslation } from "../i18n";
import { Button, cx } from "../ui/primitives";

const ALERTS = [30, 10, 0];

function vibrate(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // unsupported
  }
}

/** Countdown for real-time games: big ring, start/pause/reset, vibration at 30s / 10s / 0. */
export function TimerWidget(props: { durationSeconds: number }) {
  const { t } = useTranslation();
  const total = props.durationSeconds;
  const [remaining, setRemaining] = useState(total);
  const [running, setRunning] = useState(false);
  const endAt = useRef(0);
  const alerted = useRef(new Set<number>());

  useEffect(() => {
    setRemaining(total);
    setRunning(false);
  }, [total]);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      const left = Math.max(0, Math.round((endAt.current - Date.now()) / 1000));
      setRemaining(left);
      for (const a of ALERTS) {
        if (left <= a && !alerted.current.has(a)) {
          alerted.current.add(a);
          vibrate(a === 0 ? [400, 150, 400] : 150);
        }
      }
      if (left === 0) setRunning(false);
    }, 250);
    return () => clearInterval(id);
  }, [running]);

  const start = () => {
    endAt.current = Date.now() + remaining * 1000;
    setRunning(true);
  };
  const reset = () => {
    setRunning(false);
    setRemaining(total);
    alerted.current.clear();
  };

  const size = 168;
  const r = 72;
  const c = 2 * Math.PI * r;
  const ratio = remaining / total;
  const urgent = remaining <= 10;

  return (
    <section
      aria-label={t("timer.label")}
      className="flex flex-col items-center gap-3 rounded-2xl border border-bad/50 bg-bad/5 p-4"
    >
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90" aria-hidden>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="var(--line)"
            strokeWidth={10}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={urgent ? "var(--bad)" : "var(--accent)"}
            strokeWidth={10}
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - ratio)}
            className="transition-[stroke-dashoffset] duration-300"
          />
        </svg>
        <output
          aria-live={remaining === 0 || remaining === 10 ? "assertive" : "off"}
          data-testid="timer-remaining"
          className={cx(
            "absolute inset-0 flex items-center justify-center text-4xl font-bold tabular-nums",
            urgent && "text-bad",
          )}
        >
          {remaining === 0 ? t("timer.timeUp") : formatTime(remaining)}
        </output>
      </div>
      <div className="flex gap-2">
        {running ? (
          <Button onClick={() => setRunning(false)}>{t("timer.pause")}</Button>
        ) : (
          <Button variant="primary" icon="play" onClick={start} disabled={remaining === 0}>
            {remaining === total ? t("timer.start") : t("timer.resume")}
          </Button>
        )}
        <Button icon="replay" onClick={reset}>
          {t("timer.reset")}
        </Button>
      </div>
    </section>
  );
}
