import { GuideNotFoundError, type GuideRepository, StaticGuideRepository } from "@bgc/core-ports";
import type { GameGuide, GameSummary } from "@bgc/schema";
import { createContext, type ReactNode, useContext, useEffect, useState } from "react";

/**
 * The app's only data source. Architecture C uses static bundles; swapping to an API or
 * Supabase repository means passing a different `repository` here — nothing else changes.
 */
const RepositoryContext = createContext<GuideRepository | undefined>(undefined);

export function defaultRepository(): GuideRepository {
  return new StaticGuideRepository(`${import.meta.env.BASE_URL}games`);
}

export function RepositoryProvider(props: { repository: GuideRepository; children: ReactNode }) {
  return <RepositoryContext value={props.repository}>{props.children}</RepositoryContext>;
}

export function useRepository(): GuideRepository {
  const repo = useContext(RepositoryContext);
  if (!repo) throw new Error("useRepository must be used inside <RepositoryProvider>");
  return repo;
}

export type AsyncState<T> =
  | { status: "loading" }
  | { status: "error"; error: Error; notFound: boolean }
  | { status: "ready"; data: T };

function useAsync<T>(load: () => Promise<T>, key: string): AsyncState<T> & { retry(): void } {
  const [state, setState] = useState<AsyncState<T>>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: `key` identifies `load`
  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    load().then(
      (data) => !cancelled && setState({ status: "ready", data }),
      (e: unknown) => {
        if (cancelled) return;
        const error = e instanceof Error ? e : new Error(String(e));
        setState({ status: "error", error, notFound: error instanceof GuideNotFoundError });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [key, attempt]);

  return { ...state, retry: () => setAttempt((a) => a + 1) };
}

export function useGames() {
  const repo = useRepository();
  return useAsync<GameSummary[]>(() => repo.listGames(), "games");
}

export function useGuide(id: string) {
  const repo = useRepository();
  return useAsync<GameGuide>(() => repo.getGuide(id), `guide:${id}`);
}

export function useAssetUrl(): (gameId: string, src: string) => string {
  const repo = useRepository();
  return (gameId, src) => repo.assetUrl(gameId, src);
}
