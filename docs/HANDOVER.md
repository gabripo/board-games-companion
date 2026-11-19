# Handover — state of the project

Read this together with `CLAUDE.md` (conventions, enforced rules) and
`docs/architecture-and-phase1.md` (architecture options, content model, UX design).

## Where we are

- **Architecture C (static hybrid)** is chosen; A (serverless) and B (containers) stay possible
  through the ports in `packages/core-ports`.
- **Phase 1 is done on synthetic content.** The app runs on five invented "archetype" games
  (`packages/schema/test/fixtures/archetypes.ts`), one per turn model: sequential tile-laying,
  simultaneous drafting, real-time co-op, dice push-your-luck, team trick-taking.
  `content/games/` is still empty — there is **no real game yet**.
- **Content schema is v2** (topics declared in `game.json` with `{en,it}` names). The v1→v2
  migration runs on the merged raw guide before validation.
- **Quality gates:** `pnpm check` (typecheck, Biome, ~190 unit tests, validate) and `pnpm e2e`
  (17 Playwright tests on the production build, Pixel 7 + iPad landscape) are green.

## How to run

```bash
corepack enable && pnpm install
pnpm dev            # fixtures + app on http://localhost:5173
pnpm check          # the "done" gate
pnpm build && pnpm --filter @bgc/web preview   # PWA/offline on :4173
pnpm --filter @bgc/web exec playwright install chromium && pnpm e2e
```

## Next steps (in order)

1. **First real games.** Needed from the owner: two games of different types they own, board
   photos, 2–3 YouTube tutorial links each. Hand-write `content/games/<id>/` (EN+IT), cite
   rulebook pages, then `pnpm validate`. Run the app with `VITE_CONTENT=games`.
2. **Phase 2 — ingestion** (`packages/ingest`): classify → core + module extractors → flow
   builder → reconcile vs PDF → translate → validate. Claude for PDF/web/translation, Gemini
   for YouTube URLs only. Keys in `.env`. Stages are pure, tested against recorded responses.
3. **`apps/admin`** (local only): review AI output, drag-to-edit hotspots and annotations.
4. **Deploy** to Cloudflare Pages — config ready (`_headers`, `robots.txt`, `deploy.yml`,
   `pnpm deploy:pages`); the owner still has to create the project and Access policy.
   Steps in `docs/DEPLOY.md`.
5. **More modules** when a real game needs them: tricks, roles/narrator, timer, tracks, economy
   (follow "Adding a new mechanic" in CLAUDE.md).

## Gotchas already learned (don't re-learn them)

- `BottomSheet` (`<dialog>`): the native `close` event also fires on programmatic close —
  only report user-initiated closes (see `userClose` in `src/ui/BottomSheet.tsx`).
- Scene annotations must be `pointer-events: none`, or they swallow taps on hotspots.
- Unit tests set `MotionGlobalConfig.skipAnimations = true` (happy-dom cancels Web Animations).
  Don't make UI depend on exit animations completing (no `AnimatePresence mode="wait"`).
- The service worker needs `clientsClaim` + `skipWaiting`, otherwise runtime caching (offline
  download) only works after a second visit.
- The global `:focus-visible` style lives in `@layer base` so utilities can override it.
- `fieldset` doesn't support CSS grid in Chrome — `SegmentedControl` uses flex (`stretch`).
- Playwright is pinned to `1.63.0` to match the cloud image's browser; locally any machine
  works after `playwright install chromium` for that version.
- Heavy tabs (Board, Play, story mode) are lazy-loaded to keep the first load ~110 kB gzip.
- Topic tags, fixture art and the "demo content" notice exist only because there is no real
  content yet; real images replace the generated placeholder SVGs.
