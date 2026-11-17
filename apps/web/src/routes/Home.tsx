import type { GameSummary, Locale } from "@bgc/schema";
import { Link } from "@tanstack/react-router";
import { useAssetUrl, useGames } from "../data/repository";
import { useL, useTranslation } from "../i18n";
import { detectLanguage, settingsStore, useSettings } from "../settings/settings";
import { Icon } from "../ui/Icon";
import { Button, Chip, EmptyState, Spinner } from "../ui/primitives";

/** First launch: pick the language (pre-selected from the browser). */
export function Welcome() {
  const { t } = useTranslation();
  const suggested = detectLanguage();
  const choose = (language: Locale) => settingsStore.set({ language });
  const options: { value: Locale; label: string }[] = [
    { value: "en", label: "English" },
    { value: "it", label: "Italiano" },
  ];
  return (
    <main className="pt-safe mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-8 px-6">
      <div className="space-y-3 text-center">
        <span className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-accent text-accent-ink">
          <Icon name="dice" size={36} />
        </span>
        <h1 className="text-3xl font-bold">{t("app.title")}</h1>
        <p className="text-muted">{t("welcome.subtitle")}</p>
      </div>
      <div className="space-y-3">
        <p className="text-center font-medium">{t("welcome.chooseLanguage")}</p>
        {options.map((o) => (
          <Button
            key={o.value}
            variant={o.value === suggested ? "primary" : "secondary"}
            className="w-full text-lg"
            onClick={() => choose(o.value)}
          >
            {o.label}
          </Button>
        ))}
      </div>
    </main>
  );
}

function ComplexityDots(props: { value: number; label: string }) {
  return (
    <span className="inline-flex gap-0.5" role="img" aria-label={props.label}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span
          key={n}
          className={`size-1.5 rounded-full ${n <= Math.round(props.value) ? "bg-accent" : "bg-line"}`}
        />
      ))}
    </span>
  );
}

function GameCard(props: { game: GameSummary }) {
  const { game } = props;
  const { t } = useTranslation();
  const L = useL();
  const assetUrl = useAssetUrl();
  const c = game.classification;
  const players =
    c.playerCount.min === c.playerCount.max
      ? String(c.playerCount.min)
      : `${c.playerCount.min}–${c.playerCount.max}`;
  const time =
    c.playtimeMinutes.min === c.playtimeMinutes.max
      ? String(c.playtimeMinutes.min)
      : `${c.playtimeMinutes.min}–${c.playtimeMinutes.max}`;
  // `cover` is relative to the games index; the repository resolves assets per game.
  const cover = game.cover?.replace(`${game.id}/`, "");

  return (
    <li>
      <Link
        to="/game/$gameId"
        params={{ gameId: game.id }}
        search={{}}
        className="group flex overflow-hidden rounded-2xl border border-line bg-surface transition hover:border-accent/60"
      >
        <div className="flex w-24 shrink-0 items-center justify-center bg-surface-2 sm:w-32">
          {cover ? (
            <img
              src={assetUrl(game.id, cover)}
              alt=""
              className="size-full object-cover"
              loading="lazy"
            />
          ) : (
            <Icon name="dice" size={32} className="text-muted" />
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-2 p-4">
          <h2 className="truncate text-lg font-semibold group-hover:text-accent">
            {L(game.title)}
          </h2>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
            <span className="inline-flex items-center gap-1">
              <Icon name="users" size={16} />
              {players}
            </span>
            <span className="inline-flex items-center gap-1">
              <Icon name="clock" size={16} />
              {t("common.minutes", { value: time })}
            </span>
            <ComplexityDots
              value={c.complexity}
              label={t("home.complexity", { value: c.complexity })}
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Chip tone="accent">{t(`turnModel.${c.turnModel}`)}</Chip>
            <Chip>{t(`interaction.${c.interaction}`)}</Chip>
          </div>
        </div>
      </Link>
    </li>
  );
}

export function Home() {
  const settings = useSettings();
  const { t } = useTranslation();
  const games = useGames();

  if (!settings.language) return <Welcome />;

  return (
    <div className="mx-auto min-h-dvh max-w-3xl">
      <header className="pt-safe sticky top-0 z-10 flex items-center gap-2 border-b border-line bg-bg/90 px-4 py-2 backdrop-blur">
        <span className="flex size-9 items-center justify-center rounded-xl bg-accent text-accent-ink">
          <Icon name="dice" size={20} />
        </span>
        <h1 className="flex-1 text-xl font-bold">{t("app.title")}</h1>
        <Link
          to="/settings"
          aria-label={t("settings.title")}
          className="inline-flex size-11 items-center justify-center rounded-xl hover:bg-surface-2"
        >
          <Icon name="gear" size={22} />
        </Link>
      </header>
      <main className="space-y-4 p-4">
        {__CONTENT_SOURCE__ === "fixtures" && (
          <p className="rounded-xl border border-info/40 bg-info/10 px-3 py-2 text-sm text-info">
            {t("home.fixturesNotice")}
          </p>
        )}
        {games.status === "loading" && <Spinner label={t("common.loading")} />}
        {games.status === "error" && (
          <EmptyState icon="warning" title={t("home.loadError")}>
            <Button onClick={games.retry}>{t("common.retry")}</Button>
          </EmptyState>
        )}
        {games.status === "ready" &&
          (games.data.length === 0 ? (
            <EmptyState icon="dice" title={t("home.empty")} />
          ) : (
            <ul className="space-y-3" aria-label={t("home.gamesList")}>
              {games.data.map((g) => (
                <GameCard key={g.id} game={g} />
              ))}
            </ul>
          ))}
      </main>
    </div>
  );
}
