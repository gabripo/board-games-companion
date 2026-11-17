import type { GameGuide, GameSummary } from "@bgc/schema";
import {
  type BlobStore,
  GuideNotFoundError,
  type GuideRepository,
  type JobRunner,
  type Stage,
} from "../ports";

/** In-memory repository for tests, Storybook-style previews and the admin app. */
export class InMemoryGuideRepository implements GuideRepository {
  private readonly guides = new Map<string, GameGuide>();

  constructor(guides: readonly GameGuide[] = []) {
    for (const g of guides) this.guides.set(g.id, g);
  }

  async listGames(): Promise<GameSummary[]> {
    return [...this.guides.values()].map((g) => ({
      id: g.id,
      schemaVersion: g.schemaVersion,
      title: g.meta.title,
      classification: g.classification,
      bundle: `${g.id}/guide.json`,
    }));
  }

  async getGuide(id: string): Promise<GameGuide> {
    const g = this.guides.get(id);
    if (!g) throw new GuideNotFoundError(id);
    return structuredClone(g);
  }

  assetUrl(gameId: string, src: string): string {
    return `memory://${gameId}/${src}`;
  }
}

export class MemoryBlobStore implements BlobStore {
  private readonly blobs = new Map<string, Uint8Array>();

  async put(key: string, data: Uint8Array): Promise<void> {
    this.blobs.set(key, data.slice());
  }

  async get(key: string): Promise<Uint8Array | undefined> {
    return this.blobs.get(key)?.slice();
  }

  async delete(key: string): Promise<void> {
    this.blobs.delete(key);
  }

  async list(prefix: string): Promise<string[]> {
    return [...this.blobs.keys()].filter((k) => k.startsWith(prefix)).sort();
  }
}

/** Runs stages directly in the current process (CLI ingestion). */
export class InProcessJobRunner<D> implements JobRunner<D> {
  private readonly deps: D;

  constructor(deps: D) {
    this.deps = deps;
  }

  run<I, O>(stage: Stage<I, O, D>, input: I): Promise<O> {
    return stage.run(input, this.deps);
  }
}
