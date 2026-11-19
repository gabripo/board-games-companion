# Board Games Companion — CLAUDE.md

Mobile-first, offline-capable EN/IT PWA with structured guides for board games
of any type (turn-based, simultaneous, real-time, dice, cards, co-op...).
Private use (me + my gaming group). Curated catalog, no accounts, ~$0 hosting.
Full design rationale: `docs/architecture-and-phase1.md`.

## Architecture (decided — do not change without discussion)

- **Static hybrid.** No runtime backend. Static PWA on Cloudflare Pages; each game
  is a validated JSON bundle + WebP images.
- **Ingestion is offline.** Node CLI (`pnpm ingest <gameId>`) run locally or in
  GitHub Actions writes `content/games/<id>/*.json`; output is reviewed as a git diff.
- **AI split:** Claude = PDF/web extraction, classification, reconciliation, synthesis,
  IT translation. Gemini = public YouTube URL analysis only (claims + MM:SS ranges).

## Alternative architectures (keep switching possible)

- **A — Lean serverless:** Supabase (Postgres JSONB, Storage, Auth) + durable steps
  (Inngest / Cloudflare Workflows). Switch when: on-demand "paste a URL" or synced accounts.
- **B — Container monorepo:** Hono API + BullMQ worker + Postgres + R2. Switch when:
  heavy media processing, many users, or full vendor independence.
- **Ports & adapters rule:** app and pipeline code depend only on interfaces in
  `packages/core-ports`: `GuideRepository`, `BlobStore`, `JobRunner`. Current adapters:
  static CDN fetch, local filesystem, in-process CLI. Never call fetch/fs/AI SDKs
  directly from UI components or pipeline stages — inject them.
- Pipeline stages are pure `(input, deps) => output`; the guide bundle format is also
  the future API response and DB JSONB row format.

## Stack

- pnpm workspaces + Turborepo, TypeScript `strict`, Node 22 LTS
- Web: React 19 + Vite + Tailwind + vite-plugin-pwa (Workbox), TanStack Router,
  i18next, MiniSearch, react-zoom-pan-pinch, Motion, YouTube IFrame Player API
- Schema: Zod (source of truth) → JSON Schema via `z.toJSONSchema`
- Quality: TypeScript 7 `tsc --noEmit` per package (via Turbo), Biome (lint + format), Vitest, Playwright
- Packages are "internal": `exports` point at `src/*.ts` (no build step); CLIs run with `tsx`.
  `erasableSyntaxOnly` is on — no enums, namespaces or constructor parameter properties.

## Layout

```
packages/schema/     Zod core, flow graph, modules, scenes; integrity checks; bundle + validate CLI
packages/core-ports/ GuideRepository, BlobStore, JobRunner interfaces + current adapters
packages/ingest/     pipeline stages (pure functions) + CLI       [Phase 2]
apps/web/            static PWA (hash routes; data only via GuideRepository context)
  src/{routes,game}/   screens; GameProvider = guide + session + level + rule/clip sheets
  src/{learn,rules,play,scenes}/  tabs; scenes = SceneViewer (zoom + SVG hotspots), story mode
  src/flow/            GameLoopView + pure stepper.ts (Play tab cursor)
  src/modules/<kind>/  one renderer per mechanic module (registry in src/modules/index.ts)
  src/{i18n,settings,offline,ui}/  locales, persisted stores, PWA/offline, primitives
  vite/games-plugin.ts serves /games from dist/games or dist/fixture-games (VITE_CONTENT)
apps/admin/          local-only review UI + hotspot editor        [Phase 2]
content/games/<id>/  game, flow, rules, setup, scenes, walkthroughs, guides .json; modules/<module-id>.json; images/
                     (folders starting with `_` are drafts and are skipped)
dist/games/          generated bundles: index.json + <id>/guide.json + <id>/images/ (gitignored)
sources/             raw PDFs/transcripts — GITIGNORED, never committed
```

## Commands

```
pnpm install
pnpm dev          # fixtures + web app on :5173 (VITE_CONTENT=games for real content)
pnpm fixtures     # archetype games + placeholder art → dist/fixture-games
pnpm typecheck    # tsc --noEmit in every package (turbo)
pnpm lint         # biome check .
pnpm format       # biome format --write .
pnpm test         # vitest (schema, integrity, content, unit)
pnpm validate     # validate content/games/* → write dist/games (--no-out, --strict, [dir])
pnpm schemas      # export JSON Schemas to dist/schemas (LLM structured output)
pnpm check        # typecheck + lint + test + validate
pnpm build        # validate + fixtures, then builds web (PWA + service worker) — ships fixtures
pnpm build:games  # same, shipping the real games (VITE_CONTENT=games)
pnpm preview:games # serve that build on :4173, also on the LAN (phone testing)
pnpm e2e          # Playwright on the prod build: Pixel 7 + iPad landscape (--trace off)
pnpm deploy:pages # build:games + upload to Cloudflare Pages, from the owner's Mac only (docs/DEPLOY.md)
```
Done means: `pnpm check` passes. `pnpm lint:fix` applies Biome's safe fixes.

## Content model (packages/schema)

- **Core** (every game): classification (turnModel, interaction, mechanics, players),
  sources, components, rules, setup, variants/expansions, glossary, guides, and
  `topics` (rule tags declared once in game.json with `{en,it}` names; rules reference ids).
- **Flow graph** (every game): tree of nodes `sequence | repeat | turnOrder |
  simultaneous | choice | roll | timer | step | trigger`, each with `actor`,
  `conditions`, `ruleRefs`. Never hard-code a game rhythm in UI code — render the graph.
- **Mechanic modules** (opt-in, discriminated on `kind`): dice, cards, actions, tricks,
  scoring, tracks, roles, timer, economy, sections (fallback).
- **Scenes**: any image (board, player board, card, dice) + normalized 0–1 hotspots
  - annotations. Walkthroughs are scripted paths over flow nodes + scenes, with a
    per-step `focus` rect and optional "Try it" check.
- **Conditions** `{playerCount?, variants?, expansions?}` filter rules, setup, flow, components, glossary,
  modules and scenes at runtime (schema v3); filtered items stay one tap away in the UI.

### Adding a new mechanic

1. `packages/schema/src/modules/<kind>.ts` + add to `Module` union
2. Integrity checks for it in `integrity/modules.ts`
3. Use it in an archetype in `packages/schema/test/fixtures/archetypes.ts` + invalid cases in `schema.test.ts`
4. Renderer `apps/web/src/modules/<kind>/` (slots `{ReferencePanel, PlayWidget, LearnCard}`) + register it
5. (Phase 2) extractor prompt `packages/ingest/src/extractors/<kind>.ts`
   Unknown mechanics go into the `sections` module — never extend the core ad hoc.

## Content rules

- **Schema-first:** change Zod, bump `schemaVersion`, add a migration (runs on the merged raw guide).
- Every rule has ≥1 citation `{sourceId, page}` | `{sourceId, tStart, tEnd}` | `{sourceId, url}`.
- **Official PDF is ground truth.** Conflicting video/web claims stay in `conflicts[]`
  with a resolution; never silently merged.
- All user-facing content strings are `{ en, it }`, both required. Italian uses the
  official Italian-edition terms from the game glossary (with aliases for search).
- Ids are kebab-case and stable; every reference must resolve (`checkIntegrity()`).

## Media & legal rules

- Never download YouTube videos or extract frames. Clips = IFrame embed with `start`/`end`/`lang`.
- Images: own photos, rulebook page renders, or official publisher card/component images
  (private use only). Raw downloads go in `sources/<game>/`; composed WebP scenes go in
  `content/games/<id>/images/`, which is **gitignored** (public repo): never commit images.
  Deploy only from the owner's machine; CI validates with `BGC_IMAGES=optional`.
- Do not commit rulebook PDFs or long verbatim rule text; paraphrase + cite page.
- API keys only in `.env` (gitignored): `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`.

## UX structure

- Game screen: header with Newbie|Experienced toggle (asked on first open, saved per game)
  - session chip (players/variant/expansions); bottom tabs Learn · Play · Board · Rules.
    Level changes default tab and density, never hides features.
- Language: auto-detect on first launch, EN|IT in settings, instant switch;
  UI strings via i18next, content via `useL()`.
- Game Loop view renders the flow graph; Play tab = flow stepper + module `PlayWidget`s.
- Mini-tutorials = story mode: scene + per-step `focus` zoom + animated annotations (Motion + SVG).
- Rule card is the atomic UI unit: summary, detail, citation chips, Show on board, Watch.

## Frontend conventions

- Mobile-first: tap targets ≥ 44px, dark theme default, A+ large text,
  Screen Wake Lock while a guide is open; two-pane layout on landscape tablet/desktop.
- All views filter by session `conditions`; filtered content stays reachable on demand.
- Offline: app shell precached; per-game "Download for offline" caches bundle + images;
  `navigator.storage.persist()`. YouTube clips degrade to "needs connection".
- UI strings in `apps/web/src/i18n/locales/{en,it}.json` (same keys; `test/i18n.test.ts` checks
  every `t("…")` key exists); no hard-coded text.
- Hotspots render as SVG overlay (not canvas) with accessible labels + list-mode fallback.
- Scene annotations are decoration (`pointer-events: none`); hotspots must stay tappable.

## Testing conventions

- Every schema/module change ships with valid + invalid fixtures.
- Archetype fixtures (synthetic, not real games) cover each turnModel:
  sequential, simultaneous, real-time, dice-driven, trick-taking.
- `content.test.ts` bundles + validates every real game; a broken guide fails CI.
- Adapters must pass the contract suites in `packages/core-ports/test/contracts.ts`.
- Shared fixtures are importable as `@bgc/schema/testing`; mutate copies via `clone()`.
- Pipeline stages (Phase 2) are tested against recorded AI responses, never live APIs.
