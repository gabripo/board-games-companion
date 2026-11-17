import { getRouteApi, Link, Outlet } from "@tanstack/react-router";
import { useGuide } from "../data/repository";
import { GameProvider } from "../game/GameProvider";
import { useTranslation } from "../i18n";
import { Button, EmptyState, Spinner } from "../ui/primitives";

const gameRoute = getRouteApi("/game/$gameId");

/** Loads the guide once for the game screen and its walkthroughs. */
export function GameLayout() {
  const { gameId } = gameRoute.useParams();
  const guide = useGuide(gameId);
  const { t } = useTranslation();

  if (guide.status === "loading") return <Spinner label={t("common.loading")} />;
  if (guide.status === "error") {
    return (
      <EmptyState icon="warning" title={guide.notFound ? t("game.notFound") : t("game.loadError")}>
        {!guide.notFound && <Button onClick={guide.retry}>{t("common.retry")}</Button>}
        <Link to="/" className="font-medium text-accent">
          {t("common.home")}
        </Link>
      </EmptyState>
    );
  }
  return (
    <GameProvider key={guide.data.id} guide={guide.data}>
      <Outlet />
    </GameProvider>
  );
}
