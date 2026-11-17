import { type GameGuide, GameIndex, type GameSummary, parseGuide } from "@bgc/schema";
import { GuideNotFoundError, type GuideRepository, InvalidGuideError } from "../ports";

export type FetchFn = (
  url: string,
) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

/**
 * Architecture C adapter: reads the static bundles produced by `pnpm validate`
 * (`<baseUrl>/index.json`, `<baseUrl>/<id>/guide.json`) from a CDN or the PWA cache.
 */
export class StaticGuideRepository implements GuideRepository {
  private readonly base: string;
  private readonly fetchFn: FetchFn;
  private indexPromise: Promise<GameSummary[]> | undefined;

  constructor(baseUrl: string, fetchFn: FetchFn = (url) => globalThis.fetch(url)) {
    this.base = baseUrl.replace(/\/+$/, "");
    this.fetchFn = fetchFn;
  }

  listGames(): Promise<GameSummary[]> {
    this.indexPromise ??= this.loadIndex().catch((e: unknown) => {
      this.indexPromise = undefined; // allow retry (e.g. after coming back online)
      throw e;
    });
    return this.indexPromise;
  }

  async getGuide(id: string): Promise<GameGuide> {
    const summary = (await this.listGames()).find((g) => g.id === id);
    if (!summary) throw new GuideNotFoundError(id);
    const res = await this.fetchFn(`${this.base}/${summary.bundle}`);
    if (res.status === 404) throw new GuideNotFoundError(id);
    if (!res.ok) throw new Error(`failed to load guide "${id}": HTTP ${res.status}`);
    const result = parseGuide(await res.json());
    if (!result.ok) {
      throw new InvalidGuideError(
        id,
        result.issues.map((i) => `${i.path}: ${i.message}`),
      );
    }
    return result.guide;
  }

  assetUrl(gameId: string, src: string): string {
    return `${this.base}/${gameId}/${src}`;
  }

  private async loadIndex(): Promise<GameSummary[]> {
    const res = await this.fetchFn(`${this.base}/index.json`);
    if (!res.ok) throw new Error(`failed to load game index: HTTP ${res.status}`);
    return GameIndex.parse(await res.json()).games;
  }
}
