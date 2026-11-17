# Board Games Companion App — Architecture & Phase 1 Plan

## Context

Greenfield project (empty `/home/user`). Goal: a mobile-first, offline-capable EN/IT PWA that turns YouTube tutorials, official rulebook PDFs and web articles into structured, AI-reconciled guides (Newbie + Experienced modes, tappable hotspots linked to YouTube timestamps, guided walkthroughs).

Decisions from Q&A: curated catalog (by me), private use (me + gaming group, no auth), < $10/mo, Claude + Gemini. **Chosen architecture: Option C — static hybrid** (static PWA on Cloudflare Pages + offline ingestion CLI; no runtime backend). Options A (serverless) / B (container monorepo) were rejected for now; the upgrade path is to wrap the ingestion stages in durable jobs later.

Latest feedback: games differ widely (sequential turns, simultaneous, real-time, dice-driven, trick-taking, co-op, hidden roles...), so a fixed `turnStructure.phases[]` content model is too rigid. The content model below is redesigned around that.

---

## Architecture options (kept so we can switch later)

|                   | **C — Static hybrid (CHOSEN)**                  | A — Lean serverless                                                                     | B — Full-stack TS monorepo (containers)                                                |
| ----------------- | ----------------------------------------------- | --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Frontend          | Static React+Vite PWA, Cloudflare Pages         | Next.js on Vercel (or same Vite PWA + API routes)                                       | Same Vite PWA                                                                          |
| Content access    | Fetch static `<id>.guide.json` bundles from CDN | Supabase Postgres (JSONB) via REST/RPC                                                  | Hono/Fastify API over Postgres (Drizzle)                                               |
| Ingestion runtime | CLI, locally or GitHub Actions (6h limit)       | Durable step functions: Inngest / Trigger.dev / Cloudflare Workflows                    | BullMQ worker on Redis (can run ffmpeg, Chromium, Python)                              |
| Media             | Repo / R2 static files                          | Supabase Storage or R2                                                                  | S3-compatible (R2)                                                                     |
| Auth              | None                                            | Supabase Auth                                                                           | Lucia/Better-Auth or Supabase Auth                                                     |
| Infra cost        | ~$0                                             | ~$0–45/mo                                                                               | ~$20–80/mo                                                                             |
| Ops burden        | Near zero                                       | Low                                                                                     | High                                                                                   |
| Switch when…      | —                                               | You want "paste a URL → guide" for friends, or accounts/favorites synced across devices | You need heavy media processing, many users, multi-tenant, or full vendor independence |

### Design rules that keep switching cheap (applied from Phase 1)

All app/pipeline code talks to **interfaces (ports)**; only small adapters are architecture-specific:

- `GuideRepository` (`listGames()`, `getGuide(id)`) — Phase 1 adapter: `StaticGuideRepository` (fetch CDN JSON). Later: `SupabaseGuideRepository` / `ApiGuideRepository`. The web app only imports the interface via a provider.
- `BlobStore` (`put/get/url`) — Phase 1: local filesystem. Later: R2 / Supabase Storage.
- `JobRunner` (`run(stage, input)`) — Phase 2: in-process CLI runner. Later: Inngest/Workflows step wrapper (A) or BullMQ processor (B).
- Pipeline stages are **pure async functions** `(input, deps) => output` with every side effect (AI clients, storage, fetch) injected → the same stage code runs in CLI, serverless step or queue worker.
- `packages/schema` has zero runtime deps beyond Zod → shared by every option (validates API payloads and DB JSONB rows too).
- The guide bundle format = the API response format = the DB JSONB row format. One contract, three transports.
- Config via env vars read in one place (`packages/config`), no host-specific APIs in app code.

### Migration sketch

- **C → A:** add `apps/api` (or Supabase), import existing bundles into a `guides` JSONB table, implement `SupabaseGuideRepository`, wrap stages with the Inngest/Workflows `JobRunner` adapter, add a submission form. PWA, schema, stages unchanged.
- **C/A → B:** add `apps/api` (Hono) + `apps/worker` (BullMQ adapter), Postgres + R2 adapters, deploy as containers. Same contracts.

---

## Content model v2: core + flow graph + mechanic modules

Principle: **a small universal core every game has, a generic flow graph that can express any turn structure, and opt-in typed "mechanic modules" for mechanic-specific knowledge.** Adding support for a new kind of game = add one module (schema + renderer + extractor prompt + fixture), never change the core.

### 1. Classification (drives UI, filtering and which extractors run)

```
classification: {
  turnModel: sequential | simultaneous | real-time | phase-rounds | mixed
  interaction: competitive | cooperative | team | hidden-traitor | solo
  mechanics: MechanicId[]   // dice-rolling, worker-placement, deck-building, drafting,
                            // trick-taking, area-control, tile-placement, roll-and-write,
                            // set-collection, auction, hidden-roles, push-your-luck, ...
  playerCount: {min, max, best[]}, playtime, complexity (1–5)
}
```

### 2. Universal core atoms

- `sources[]` (pdf | video | web, with id, url, language, priority — PDF = ground truth).
- `components[]`: `{id, type: board|card|die|token|meeple|tile|sheet|timer|screen|other, name, quantity, imageRefs}`.
- `rules[]` — the single atom for "a rule": `{id, topic tags, summary{en,it}, detail{en,it}, appliesTo: {flowNodes[], components[], modules[]}, conditions?, citations[], conflicts[], confidence}`.
- `conditions` (reused everywhere: rules, setup steps, flow nodes): `{playerCount?: number[], variants?: string[], expansions?: string[]}` → handles 2-player variants, solo modes, advanced rules, expansions.
- `variants[]` / `expansions[]` declared once, referenced by `conditions`.
- `glossary[]` (terms + icons, EN/IT official names).

### 3. Flow graph (replaces `turnStructure`) — expresses any game rhythm

A tree of typed nodes, each with `title`, `description`, `actor`, `conditions`, `ruleRefs`, optional `clip` and `sceneRef`:

| node kind                                                                                                                        | expresses                                                     | example                                   |
| -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- | ----------------------------------------- |
| `sequence`                                                                                                                       | ordered children                                              | setup → rounds → final scoring            |
| `repeat`                                                                                                                         | loop with `until` (end condition text + ruleRef)              | rounds until deck empty                   |
| `turnOrder`                                                                                                                      | each player in order, children = a player's turn              | Carcassonne-like turns                    |
| `simultaneous`                                                                                                                   | all players act at once, optional sync point                  | card drafting, programming                |
| `choice`                                                                                                                         | pick N of options (each option a subtree)                     | worker-placement actions, "take 1 action" |
| `roll`                                                                                                                           | dice roll + `outcomes[]` (face/sum → subtree) + reroll policy | dice / push-your-luck                     |
| `timer`                                                                                                                          | real-time window with duration                                | real-time co-op                           |
| `step`                                                                                                                           | atomic instruction                                            | "draw 2 cards"                            |
| `trigger`                                                                                                                        | interrupt/reaction `when` condition                           | "when a player reaches 10 VP…"            |
| `actor`: activePlayer                                                                                                            | allPlayers                                                    | eachPlayer                                | team | leader/dealer | game(automa). |
| The same graph powers: the core-loop diagram (Newbie), the step-by-step turn simulator, and "where am I in the game" navigation. |

### 4. Mechanic modules (discriminated union on `kind`, all optional)

| module     | content                                                               | dedicated UI                                   |
| ---------- | --------------------------------------------------------------------- | ---------------------------------------------- |
| `dice`     | dice definitions (faces → value/icon), roll rules, rerolls, modifiers | dice face reference + auto-computed odds table |
| `cards`    | deck composition, card anatomy (scene+hotspots), hand/discard rules   | card anatomy explorer                          |
| `actions`  | action catalog: cost, effect, limits, blocking                        | filterable action cards                        |
| `tricks`   | lead/follow rules, trump, trick winner                                | follow-suit cheat card                         |
| `scoring`  | scoring categories, timing (immediate/end), tie-breakers, edge cases  | scoring sheet / end-game checklist             |
| `tracks`   | score/resource tracks, thresholds                                     | track diagram                                  |
| `roles`    | hidden/asymmetric roles and powers                                    | role cards (spoiler-safe toggle)               |
| `timer`    | real-time constraints, penalties                                      | in-app timer                                   |
| `economy`  | resources, conversions, limits                                        | resource chart                                 |
| `sections` | fallback: free-form ruled sections                                    | generic accordion                              |

### 5. Visual layer — scenes, not just "the board"

- `scenes[]`: `{id, image, width, height, hotspots[{id, shape rect|polygon, coords 0–1, label, ruleRefs, clip?}], annotations[]}` — used for boards, player boards, card anatomy, dice faces, setup layouts.
- `annotations`: arrows, highlights, token markers at normalized positions → lets a walkthrough step show "place this here" on the same photo without generating new images.
- `walkthroughs[]` (e.g. "First turn", "First round with 3 players"): ordered steps `{text, flowNodeRef, sceneRef, highlightHotspots[], annotations[], clip?}` — a scripted path through the flow graph.

### 6. Game session context (runtime filtering)

When opening a game the user picks player count, variant and expansions → setup, rules, flow nodes and walkthroughs are filtered by `conditions`. Experienced-mode search only returns applicable rules.

### 7. Storage layout per game (split files — smaller diffs, map 1:1 to pipeline stages, lazy-loadable)

```
content/games/<id>/
  game.json          meta, classification, sources, components, variants, glossary
  flow.json          flow graph
  rules.json         rules[]
  modules/<kind>.json one file per mechanic module
  scenes.json        scenes + hotspots + annotations
  walkthroughs.json
  setup.json         setup steps (with conditions)
  guides.json        newbie overview/core loop text, expert misconceptions
  images/*.webp
```
Build step merges + validates into one `dist/<id>.guide.json` bundle per game (what the PWA caches offline).

### 8. Consequences for ingestion (Phase 2)

Two-pass pipeline: **classify** (from PDF: turnModel + mechanics) → **run core extractors + only the module extractors for detected mechanics** (each with its own module JSON Schema for structured output) → **build flow graph** → reconcile vs PDF → translate → validate. Each stage writes its own file above, so stages re-run independently.

---

## Visual & UX design

### A. App structure, language and experience level

```
┌ Game header ─────────────────────────────┐
│ ← Catan-like      [Newbie|Experienced] ⚙ │   segmented toggle, always visible
│ 3 players · base game  ✎                 │   session-context chip (tap to change)
├──────────────────────────────────────────┤
│              (tab content)               │
├──────────────────────────────────────────┤
│  Learn   │   Play   │  Board  │  Rules   │   bottom nav (thumb reach)
└──────────────────────────────────────────┘
```

- **Experience level:** a segmented control in the game header — _Newbie / Experienced_ (IT: _Principiante / Esperto_).
  - **First open of a game:** a one-screen "Have you played this before?" → _No, teach me_ / _Yes, quick reference_. The choice is saved per game in localStorage (`level:<gameId>`).
  - **What it changes:** the default tab (Newbie → **Learn**, Experienced → **Rules**), tab order, and density. Newbie gets one-line summaries, expanded tutorials and "Why?" hints. Experienced gets collapsed cards, a search bar focused on open, and edge cases and misconceptions shown by default.
  - **Not hidden from either level:** every view stays reachable in both modes, because the level only changes emphasis.
- **Language:**
  - **First launch:** `navigator.language` (`it*` → IT, else EN) and a welcome screen with _English / Italiano_ buttons. Names are written out, with no flags.
  - **Switching:** an EN|IT switch in the global ⚙ settings sheet, with a long-press shortcut on the header ⚙. Switching is instant. i18next `changeLanguage` handles UI strings, and a `useL()` hook picks `{en,it}` content fields. `<html lang>` is updated and the choice is persisted.
  - **Search:** the index is built per language, with accent-insensitive matching and glossary aliases, so the IT term _"Ladrone"_ also finds _"Robber"_.
  - **Clips:** clips carry `lang`. The app prefers a clip in the current language and otherwise shows the other one with an "🎧 in English" badge.
- **Session context sheet:** player count stepper, variant and expansion toggles. Every view filters by `conditions`, and filtered-out content is reachable through "Show rules for other player counts".
- **Table ergonomics:**
  - **Theme and text:** dark theme by default and an A+ large-text toggle.
  - **Screen:** wake lock on.
  - **Layout:** on landscape tablets and desktop it becomes two panes, with the scene on the left and rules or tutorial on the right.

### B. How each game type is visualized

All games share a **Game Loop view** that renders the flow graph as a vertical stepper on mobile (SVG + CSS, no graph library):

| flow node      | visual                                                                                         |
| -------------- | ---------------------------------------------------------------------------------------------- |
| `sequence`     | numbered vertical steps                                                                        |
| `repeat`       | bracket with ↻ loop arrow and an "until …" chip                                                |
| `turnOrder`    | player-rotation ring (P1→P2→P3, sized from the session player count) wrapping the turn's steps |
| `simultaneous` | parallel lanes with an "Everyone at once" badge, ending in a sync bar                          |
| `choice`       | horizontal carousel of option cards: "Choose 1 of 3"                                           |
| `roll`         | die icon + outcome table rows (face/sum → consequence)                                         |
| `timer`        | countdown ring with duration                                                                   |
| `trigger`      | ⚡ callout pinned beside the node it interrupts                                                |

The **Play tab** (an at-the-table assistant) is composed from the flow graph and module "play widgets", picked by `classification`:

| game type                  | Play tab shows                                                                                                  |
| -------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Sequential turns           | whose-turn ring, current-turn checklist from the `turnOrder` subtree, big **Next** button                       |
| Phase rounds               | top bar "Round 3 · Phase 2/4" + phase stepper                                                                   |
| Simultaneous               | "Everyone now:" step list → **All ready?** button → reveal/resolve steps                                        |
| Real-time                  | full-screen countdown (timer module), vibration at thresholds, large-font cheat list                            |
| Dice-driven                | dice-face reference grid, odds bars (computed: P(sum), P(≥1 ×)), reroll-policy chip, "I rolled…" outcome lookup |
| Cards / deck-building      | card anatomy explorer (scene hotspots on a card), deck composition stacked bar                                  |
| Worker placement / actions | action grid (cost icons) → tap → rule card + "show on board" pulses the action-space hotspot                    |
| Trick-taking               | "Can you follow suit?" yes/no decision card, trump indicator                                                    |
| Hidden roles               | spoiler-safe role cards (press-and-hold to reveal), narrator script mode (read-aloud steps + timer)             |
| Any game with `scoring`    | end-game scoring calculator: per-player × category grid, auto-sum, tie-breaker hint                             |

Implementation: each module renderer exports optional slots `{ ReferencePanel, PlayWidget, LearnCard }`. The tabs assemble whatever slots the game's modules provide, so a new game type requires no tab code changes.

### C. How rules and mini-tutorials are visualized

- **Rule card** (the atomic UI unit):
  - **Front:** a 1-line summary in large type, with the detail behind an expander.
  - **Chips:**
    - topic and condition ("2 players only")
    - citation chip "📖 p.7" (opens the page reference) or "▶ 03:12" (opens the clip)
    - ⚠ conflict or common-mistake chip when relevant
  - **Actions:** **Show on board** (jumps to the scene, zooms to the hotspot, pulses it) and **Watch** (clip sheet).
- **Clip sheet:**
  - **Player:** a draggable bottom sheet with a lite facade (thumbnail + ▶) that plays `start→end` and offers ↺ replay segment.
  - **Context:** the rule text stays visible above it.
  - **Offline:** shows a "needs connection" state.
- **Scene viewer:**
  - **Image:** pinch/zoom (react-zoom-pan-pinch) with an SVG hotspot layer and outlines that can be toggled.
  - **Hotspots:** tap → a rule card in the bottom sheet, plus a "list mode" fallback for accessibility.
- **Mini-tutorials (walkthroughs) — "story mode":**
  - **Layout:** full screen, with the scene in the top ~60% and step text + large ◀ ▶ buttons + progress dots below. Swipe also works.
  - **Per step:** the camera pans and zooms to a `focus` rect and annotations animate in (arrows draw, token markers drop, regions pulse) with Motion (Framer Motion) + SVG.
  - **Extras:** an optional "▶ see it" mini-clip for each step, and "Try it" checkpoints that ask a 1-tap question ("Where does the worker go?" → tap the hotspot) for active learning.
- **Setup checklist:**
  - **Grouping:** grouped by table area, with tappable ticks saved per game session and a progress ring.
  - **Per item:** each item has a thumbnail crop of its scene region and a "where?" button.
  - **Filtering:** items are filtered by player count.
- **Learn tab (Newbie) order:**
  1. 30-second overview card (goal + how to win)
  2. Game Loop view
  3. Setup checklist
  4. "First turn" story-mode walkthrough
  5. Key icons
- **Rules tab (Experienced):**
  - **Search:** sticky search bar.
  - **Lists:** topic chips, plus "Edge cases" Q&A accordions and **Myth vs Rule** cards (myth struck through in red, rule in green with a citation).
  - **Glossary:** an icon glossary grid whose icons are CSS crops of scene images, so no extra files are needed.

### Schema additions implied by the UI

- `walkthroughStep.focus` (normalized viewport rect) and `walkthroughStep.check?` (tap-the-hotspot question).
- `clip.lang`; `glossary.aliases{en[],it[]}`.
- `misconceptions[]: {myth, rule, citations}`; `edgeCases[]: {question, answer, citations}`.
- `guides.overview` (goal, howToWin, 30-sec pitch).

---

## Step 1 on approval: write `/home/user/CLAUDE.md` (exact draft, ~120 lines)

```markdown
# Board Games Companion — CLAUDE.md

Mobile-first, offline-capable EN/IT PWA with structured guides for board games
of any type (turn-based, simultaneous, real-time, dice, cards, co-op...).
Private use (me + my gaming group). Curated catalog, no accounts, ~$0 hosting.

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
  i18next, MiniSearch, react-zoom-pan-pinch, YouTube IFrame Player API
- Schema: Zod (source of truth) → JSON Schema via `z.toJSONSchema`
- Quality: `tsc -b` (project references), Biome (lint + format), Vitest, Playwright

## Layout

packages/schema/ Zod core, flow graph, modules, scenes; integrity checks; bundle + validate CLI
packages/core-ports/ GuideRepository, BlobStore, JobRunner interfaces + current adapters
packages/ingest/ pipeline stages (pure functions) + CLI [Phase 2]
apps/web/ static PWA
src/modules/<kind>/ one renderer per mechanic module (registry in src/modules/index.ts)
src/flow/ generic flow-graph renderer + turn simulator
apps/admin/ local-only review UI + hotspot editor [Phase 2]
content/games/<id>/ game, flow, rules, setup, scenes, walkthroughs, guides .json; modules/; images/
sources/ raw PDFs/transcripts — GITIGNORED, never committed

## Commands

pnpm install
pnpm dev # web app on :5173
pnpm typecheck # tsc -b across workspace
pnpm lint # biome check .
pnpm format # biome format --write .
pnpm test # vitest (schema, integrity, content, unit)
pnpm validate # bundle + validate every content/games/<id>
pnpm e2e # playwright mobile viewport (use --trace off)
pnpm build # runs validate, then builds web
Done means: `pnpm typecheck && pnpm lint && pnpm test && pnpm validate` pass.

## Content model (packages/schema)

- **Core** (every game): classification, sources, components, rules, setup,
  variants/expansions, glossary, guides (newbie/expert text).
- **Flow graph** (every game): tree of nodes `sequence | repeat | turnOrder |
  simultaneous | choice | roll | timer | step | trigger`, each with `actor`,
  `conditions`, `ruleRefs`. Never hard-code a game rhythm in UI code — render the graph.
- **Mechanic modules** (opt-in, discriminated on `kind`): dice, cards, actions, tricks,
  scoring, tracks, roles, timer, economy, sections (fallback).
- **Scenes**: any image (board, player board, card, dice) + normalized 0–1 hotspots
  - annotations. Walkthroughs are scripted paths over flow nodes + scenes.
- **Conditions** `{playerCount?, variants?, expansions?}` filter rules/setup/flow at runtime.

### Adding a new mechanic

1. `packages/schema/src/modules/<kind>.ts` + add to `Module` union
2. Integrity checks for it in `integrity/modules.ts`
3. Valid + invalid fixtures in `packages/schema/test/fixtures/modules/<kind>/`
4. Renderer `apps/web/src/modules/<kind>/` + register it
5. (Phase 2) extractor prompt `packages/ingest/src/extractors/<kind>.ts`
   Unknown mechanics go into the `sections` module — never extend the core ad hoc.

## Content rules

- **Schema-first:** change Zod first, bump `schemaVersion`, add a migration, update fixtures.
- Every rule has ≥1 citation `{sourceId, page}` | `{sourceId, tStart, tEnd}` | `{sourceId, url}`.
- **Official PDF is ground truth.** Conflicting video/web claims stay in `conflicts[]`
  with a resolution; never silently merged.
- All user-facing content strings are `{ en, it }`, both required. Italian uses the
  official Italian-edition terms from the game glossary.
- Ids are kebab-case and stable; every reference must resolve (`checkIntegrity()`).

## Media & legal rules

- Never download YouTube videos or extract frames. Clips = IFrame embed with `start`/`end`.
- Images: own photos or rulebook page renders (private use only).
- Do not commit rulebook PDFs or long verbatim rule text; paraphrase + cite page.
- API keys only in `.env` (gitignored): `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`.

## UX structure

- Game screen: header with Newbie|Experienced toggle (saved per game) + session chip;
  bottom tabs Learn · Play · Board · Rules. Level changes default tab and density, never hides features.
- Language: auto-detect on first launch, EN|IT in settings, instant switch; content via `useL()`.
- Game Loop view renders the flow graph; Play tab = flow stepper + module `PlayWidget`s.
- Module renderers export optional `{ReferencePanel, PlayWidget, LearnCard}` slots.
- Mini-tutorials = story mode: scene + per-step `focus` zoom + animated annotations (Motion + SVG).
- Rule card is the atomic UI unit: summary, detail, citation chips, Show on board, Watch.

## Frontend conventions

- Mobile-first: tap targets ≥ 44px, dark theme default, A+ large text,
  Screen Wake Lock while a guide is open; two-pane layout on landscape tablet/desktop.
- Game session context (player count, variant, expansions) chosen on open;
  all views filter by `conditions`.
- Offline: app shell precached; per-game "Download for offline" caches bundle + images;
  `navigator.storage.persist()`. YouTube clips degrade to "needs connection".
- UI strings in `apps/web/src/locales/{en,it}.json`; no hard-coded text.
- Hotspots render as SVG overlay with accessible labels.

## Testing conventions

- Every schema/module change ships with valid + invalid fixtures.
- Archetype fixtures (synthetic, not real games) cover each turnModel:
  sequential, simultaneous, real-time, dice-driven, trick-taking.
- `content.test.ts` bundles + validates every real game; a broken guide fails CI.
- Pipeline stages (Phase 2) are tested against recorded AI responses, never live APIs.
```

---

## Phase 1 — Foundation, generic content model, two contrasting real games (no AI yet)

**Goal:** prove the content model handles different game types: a verifiable monorepo, the Zod core + flow graph + a first set of modules, and two hand-written guides of **different types** (e.g. one turn-based/board game and one dice-driven game) fully usable on a phone.

### 1a. Tooling & verification (first)

- Root `package.json` scripts, `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.base.json`
  (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`), project references,
  `biome.json` (recommended + a11y + `useExhaustiveDependencies`), `.gitignore`, `.nvmrc`, `.env.example`.
- GitHub Actions `ci.yml`: install → typecheck → lint → test → validate → build.
- `git init` + first commit; write `CLAUDE.md`.

### 1a'. `packages/core-ports`

- `GuideRepository` interface + `StaticGuideRepository` (fetch `/games/index.json`, `/games/<id>.guide.json`, parse with Zod).
- `BlobStore` interface + `FsBlobStore`; `JobRunner` interface only (adapter arrives in Phase 2).
- Contract tests (`repository.contract.test.ts`) that any future adapter must also pass.
- Web app gets the repository via a React context provider — swapping architecture = swapping the provider.

### 1b. `packages/schema`

- `src/core/`: primitives (`LocalizedString`, `Citation` union, `Conditions`, `NormalizedPoint`, `YouTubeClip` with end > start), classification, sources, components, rules, setup, variants, glossary, guides.
- `src/flow/`: recursive flow-node discriminated union (`z.lazy`), actor enum.
- `src/modules/`: Phase 1 set = `dice`, `scoring`, `actions`, `cards`, `sections`; `Module` union.
- `src/scenes/`: scenes, hotspots, annotations, walkthroughs.
- `src/bundle.ts`: load split files for a game → merged `GameGuide` → `dist/<id>.guide.json`.
- `src/integrity/`: dangling refs (ruleRefs, flowNode refs, scene/hotspot refs, sourceIds, variant/expansion names in conditions), duplicate ids, coords out of 0–1, rules without citations, unresolved conflicts, flow checks (non-empty choice/roll outcomes, `repeat` has `until`), module checks (dice faces count, scoring categories referenced).
- `src/conditions.ts`: `applies(conditions, sessionContext)` filter + tests.
- `src/json-schema.ts`: export JSON Schemas (whole guide + each module, for Phase 2 structured output).
- `src/cli/validate.ts` → `pnpm validate` with readable paths and non-zero exit.
- Tests: `schema.test.ts` (valid/invalid fixtures, per module), `flow.test.ts`, `integrity.test.ts`, `conditions.test.ts`, `content.test.ts`; **synthetic archetype fixtures** for sequential, simultaneous, real-time, dice-driven, trick-taking.

### 1c. Reference content (hand-written, EN+IT)

- Two games of different type that you own, each with: classification, flow graph, rules with page citations, setup with player-count conditions, 1–2 scenes (photo + 5–10 hotspots), 2–3 YouTube clips, a "first turn" walkthrough, relevant modules.
- _Needs from you: the two games, photos, and YouTube URLs._

### 1d. `apps/web`

- Vite + React + Tailwind + vite-plugin-pwa + TanStack Router + i18next; imports validated bundles at build time.
- Game list → session context picker (players/variant/expansions) → Game home with Newbie/Experienced toggle.
- Shell: welcome screen (language), settings sheet (EN|IT, A+ text, theme), game header with Newbie|Experienced toggle + "played before?" first-open prompt, session-context sheet, bottom tabs Learn · Play · Board · Rules.
- Shared components: `GameLoopView` (all flow node visuals), `FlowStepper` (Play), `SceneViewer` (zoom + SVG hotspots + annotations), `ClipSheet`, `RuleCard`, `StoryModePlayer` (focus zoom, animated annotations, "Try it" checks), `SetupChecklist`, `IconGlossary`, `MythVsRule`, `EdgeCaseAccordion`, `RulesSearch`.
- Module renderer registry with slots `{ReferencePanel, PlayWidget, LearnCard}`; Phase 1 renderers: dice (face grid + odds bars + outcome lookup), scoring (end-game calculator), actions (action grid → show on board), cards (anatomy explorer), sections.
- Deferred to Phase 3: timer/real-time, tricks, roles/narrator, tracks, economy widgets.
- Wake lock, offline download, manifest + icons, two-pane landscape layout.
- Tests: unit (flow simulator reducer, search, odds calculation), Playwright mobile e2e: open each reference game → set player count → tap hotspot → clip iframe `start` correct → step the simulator → switch to IT → offline reload.

### Out of scope → Phase 2

`packages/ingest` (classify → core + module extractors → flow builder → reconcile → translate), `apps/admin` (review + hotspot/annotation editor), more modules (tricks, roles, timer, tracks, economy).

## Verification for Phase 1

- `pnpm typecheck && pnpm lint && pnpm test && pnpm validate` green locally and in CI.
- Breaking content on purpose (drop an `it` string, coord = 1.2, ruleRef to a missing id, dice module with wrong face count) makes `pnpm validate` fail with a readable path.
- Both reference games render correctly despite different turn models; changing player count changes setup/rules shown.
- `pnpm build && pnpm preview` + Lighthouse installability; `pnpm e2e` passes; manual phone check in airplane mode.
