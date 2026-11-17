import type { SessionContext } from "@bgc/schema";
import { useL, useTranslation } from "../i18n";
import { BottomSheet } from "../ui/BottomSheet";
import { Button, cx, IconButton } from "../ui/primitives";
import { useGame } from "./GameProvider";

/** "3 players · Duel" */
export function useSessionLabel(): string {
  const { session, guide } = useGame();
  const { t } = useTranslation();
  const L = useL();
  const extras = [
    ...guide.variants.filter((v) => session.variants.includes(v.id)).map((v) => L(v.name)),
    ...guide.expansions.filter((e) => session.expansions.includes(e.id)).map((e) => L(e.name)),
  ];
  return [
    t("session.playersN", { count: session.playerCount }),
    ...(extras.length ? extras : [t("session.base")]),
  ].join(" · ");
}

function Toggle(props: { label: string; on: boolean; onChange: (on: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={props.on}
      onClick={() => props.onChange(!props.on)}
      className={cx(
        "flex min-h-11 w-full items-center justify-between rounded-xl border px-4 text-left",
        props.on ? "border-accent bg-accent/10" : "border-line bg-surface-2",
      )}
    >
      <span className="font-medium">{props.label}</span>
      <span
        className={cx(
          "relative h-6 w-10 rounded-full transition",
          props.on ? "bg-accent" : "bg-surface-3",
        )}
      >
        <span
          className={cx(
            "absolute top-0.5 size-5 rounded-full bg-white transition-all",
            props.on ? "left-[18px]" : "left-0.5",
          )}
        />
      </span>
    </button>
  );
}

export function SessionSheet(props: { open: boolean; onClose: () => void }) {
  const { guide, session, setSession } = useGame();
  const { t } = useTranslation();
  const L = useL();
  const { min, max, best } = guide.classification.playerCount;

  const update = (patch: Partial<SessionContext>) => setSession({ ...session, ...patch });
  const toggle = (list: readonly string[], id: string, on: boolean) =>
    on ? [...list, id] : list.filter((x) => x !== id);

  return (
    <BottomSheet open={props.open} onClose={props.onClose} title={t("session.title")}>
      <div className="space-y-6">
        <section>
          <h3 className="mb-2 font-semibold">{t("session.players")}</h3>
          <div className="flex items-center gap-4">
            <IconButton
              icon="minus"
              label={t("session.fewer")}
              disabled={session.playerCount <= min}
              onClick={() => update({ playerCount: session.playerCount - 1 })}
              className="border border-line disabled:opacity-30"
            />
            <output
              aria-live="polite"
              className="min-w-12 text-center text-3xl font-bold"
              data-testid="player-count"
            >
              {session.playerCount}
            </output>
            <IconButton
              icon="plus"
              label={t("session.more")}
              disabled={session.playerCount >= max}
              onClick={() => update({ playerCount: session.playerCount + 1 })}
              className="border border-line disabled:opacity-30"
            />
            {best && best.length > 0 && (
              <span className="text-sm text-muted">
                {t("session.best", { list: best.join(", ") })}
              </span>
            )}
          </div>
        </section>

        {guide.variants.length > 0 && (
          <section className="space-y-2">
            <h3 className="font-semibold">{t("session.variants")}</h3>
            {guide.variants.map((v) => (
              <div key={v.id}>
                <Toggle
                  label={L(v.name)}
                  on={session.variants.includes(v.id)}
                  onChange={(on) => update({ variants: toggle(session.variants, v.id, on) })}
                />
                <p className="mt-1 px-1 text-sm text-muted">{L(v.description)}</p>
              </div>
            ))}
          </section>
        )}

        {guide.expansions.length > 0 && (
          <section className="space-y-2">
            <h3 className="font-semibold">{t("session.expansions")}</h3>
            {guide.expansions.map((e) => (
              <Toggle
                key={e.id}
                label={L(e.name)}
                on={session.expansions.includes(e.id)}
                onChange={(on) => update({ expansions: toggle(session.expansions, e.id, on) })}
              />
            ))}
          </section>
        )}

        <Button variant="primary" className="w-full" onClick={props.onClose}>
          {t("common.done")}
        </Button>
      </div>
    </BottomSheet>
  );
}
