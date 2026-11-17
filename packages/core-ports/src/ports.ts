import type { GameGuide, GameSummary } from "@bgc/schema";

/**
 * Ports: the only way app and pipeline code touch the outside world.
 * Architecture C (current) uses static/in-process adapters; A/B swap in
 * Supabase/API/queue adapters without changing callers.
 */

export class GuideNotFoundError extends Error {
  readonly gameId: string;

  constructor(gameId: string) {
    super(`game "${gameId}" not found`);
    this.name = "GuideNotFoundError";
    this.gameId = gameId;
  }
}

export class InvalidGuideError extends Error {
  readonly gameId: string;
  readonly details: readonly string[];

  constructor(gameId: string, details: readonly string[]) {
    super(`game "${gameId}" failed validation:\n${details.join("\n")}`);
    this.name = "InvalidGuideError";
    this.gameId = gameId;
    this.details = details;
  }
}

/** Read access to the game catalog. */
export interface GuideRepository {
  listGames(): Promise<GameSummary[]>;
  /** Rejects with GuideNotFoundError / InvalidGuideError. */
  getGuide(id: string): Promise<GameGuide>;
  /** Absolute/served URL for an asset referenced by a guide (e.g. scene image src). */
  assetUrl(gameId: string, src: string): string;
}

/** Binary storage for images and raw ingestion artifacts. */
export interface BlobStore {
  put(key: string, data: Uint8Array, contentType?: string): Promise<void>;
  get(key: string): Promise<Uint8Array | undefined>;
  delete(key: string): Promise<void>;
  list(prefix: string): Promise<string[]>;
}

/** A pipeline stage: a pure async function with every side effect injected via `deps`. */
export interface Stage<I, O, D = unknown> {
  readonly name: string;
  run(input: I, deps: D): Promise<O>;
}

/** Executes stages: in-process now; durable steps (A) or a queue worker (B) later. */
export interface JobRunner<D = unknown> {
  run<I, O>(stage: Stage<I, O, D>, input: I): Promise<O>;
}
