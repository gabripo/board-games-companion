import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

type Variant = "primary" | "secondary" | "ghost";
const VARIANTS: Record<Variant, string> = {
  primary: "bg-accent text-accent-ink hover:brightness-110",
  secondary: "bg-surface-2 text-ink border border-line hover:bg-surface-3",
  ghost: "text-ink hover:bg-surface-2",
};

/** Buttons are at least 44px tall (table-friendly tap targets). */
export function Button({
  variant = "secondary",
  icon,
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; icon?: IconName }) {
  return (
    <button
      type="button"
      {...rest}
      className={cx(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 font-medium transition",
        "disabled:cursor-not-allowed disabled:opacity-40",
        VARIANTS[variant],
        className,
      )}
    >
      {icon && <Icon name={icon} />}
      {children}
    </button>
  );
}

export function IconButton({
  icon,
  label,
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { icon: IconName; label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      {...rest}
      className={cx(
        "inline-flex size-11 shrink-0 items-center justify-center rounded-xl text-ink hover:bg-surface-2",
        className,
      )}
    >
      <Icon name={icon} size={22} />
    </button>
  );
}

type Tone = "neutral" | "accent" | "info" | "ok" | "bad" | "warn";
const TONES: Record<Tone, string> = {
  neutral: "bg-surface-2 text-muted border-line",
  accent: "bg-accent/15 text-accent border-accent/40",
  info: "bg-info/15 text-info border-info/40",
  ok: "bg-ok/15 text-ok border-ok/40",
  bad: "bg-bad/15 text-bad border-bad/40",
  warn: "bg-warn/15 text-warn border-warn/40",
};

export function Chip(props: {
  children: ReactNode;
  tone?: Tone;
  icon?: IconName;
  onClick?: () => void;
  label?: string;
  className?: string;
}) {
  const cls = cx(
    "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium",
    TONES[props.tone ?? "neutral"],
    props.className,
  );
  const content = (
    <>
      {props.icon && <Icon name={props.icon} size={14} />}
      {props.children}
    </>
  );
  if (!props.onClick) return <span className={cls}>{content}</span>;
  return (
    <button
      type="button"
      onClick={props.onClick}
      aria-label={props.label}
      className={cx(cls, "min-h-8 hover:brightness-125")}
    >
      {content}
    </button>
  );
}

export function SegmentedControl<T extends string>(props: {
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
  className?: string;
  /** Fill the available width with equal-width options. */
  stretch?: boolean;
}) {
  return (
    <fieldset
      className={cx(
        "m-0 min-w-0 rounded-xl border border-line bg-surface-2 p-0.5",
        props.stretch ? "flex w-full" : "inline-flex",
        props.className,
      )}
    >
      <legend className="sr-only">{props.label}</legend>
      {props.options.map((o) => {
        const active = o.value === props.value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            onClick={() => props.onChange(o.value)}
            className={cx(
              "min-h-10 rounded-[10px] px-3 text-sm font-medium transition",
              props.stretch && "flex-1",
              active ? "bg-accent text-accent-ink" : "text-muted hover:text-ink",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </fieldset>
  );
}

export function Card(props: {
  children: ReactNode;
  className?: string;
  as?: "section" | "div" | "article";
}) {
  const Tag = props.as ?? "div";
  return (
    <Tag className={cx("rounded-2xl border border-line bg-surface p-4", props.className)}>
      {props.children}
    </Tag>
  );
}

export function SectionTitle(props: { children: ReactNode; icon?: IconName; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      {props.icon && <Icon name={props.icon} className="text-accent" />}
      <h2 className="flex-1 text-lg font-semibold">{props.children}</h2>
      {props.action}
    </div>
  );
}

export function EmptyState(props: { icon: IconName; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-12 text-center text-muted">
      <Icon name={props.icon} size={40} />
      <p className="font-medium text-ink">{props.title}</p>
      {props.children}
    </div>
  );
}

export function Spinner(props: { label: string }) {
  return (
    <div role="status" className="flex items-center justify-center gap-3 py-16 text-muted">
      <span className="size-5 animate-spin rounded-full border-2 border-line border-t-accent" />
      {props.label}
    </div>
  );
}

/** Disclosure built on <details> (keyboard + screen-reader support for free). */
export function Accordion(props: {
  summary: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
}) {
  return (
    <details
      open={props.defaultOpen}
      className={cx("group rounded-xl border border-line bg-surface", props.className)}
    >
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-4 py-2 font-medium [&::-webkit-details-marker]:hidden">
        <span className="flex-1">{props.summary}</span>
        <Icon name="chevron" className="text-muted transition group-open:rotate-180" />
      </summary>
      <div className="px-4 pb-4 text-muted">{props.children}</div>
    </details>
  );
}

/** Circular progress ring. */
export function ProgressRing(props: { value: number; max: number; size?: number; label: string }) {
  const size = props.size ?? 40;
  const r = (size - 6) / 2;
  const c = 2 * Math.PI * r;
  const ratio = props.max === 0 ? 0 : Math.min(1, props.value / props.max);
  return (
    <svg
      width={size}
      height={size}
      role="img"
      aria-label={props.label}
      className="-rotate-90"
      viewBox={`0 0 ${size} ${size}`}
    >
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth={4} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={ratio === 1 ? "var(--ok)" : "var(--accent)"}
        strokeWidth={4}
        strokeDasharray={c}
        strokeDashoffset={c * (1 - ratio)}
        strokeLinecap="round"
        className="transition-[stroke-dashoffset] duration-500"
      />
    </svg>
  );
}
