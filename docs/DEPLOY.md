# Shipping the app

The app is a static site: `pnpm build:games` writes everything to `apps/web/dist`
(app shell + service worker + `games/` bundles and images). Host: Cloudflare Pages (free).

## Before every release

```bash
pnpm check        # typecheck + lint + unit/content tests + validate
pnpm e2e          # Playwright on the prod build (fixtures): Pixel 7 + iPad landscape
pnpm build:games  # the build you ship (real games, not fixtures)
```

`pnpm build` ships the synthetic fixture games — never deploy that one.
Stop any `pnpm preview:games` before `pnpm e2e`: Playwright reuses a server already on :4173,
and the e2e tests expect the fixture games.

## Test on a real phone first (no deploy needed)

With ADB over Wi-Fi, `localhost` on the phone can point at the Mac. Browsers treat
`localhost` as secure, so install, offline mode and Screen Wake Lock all work without HTTPS.

```bash
pnpm preview:games                     # serves dist on :4173
adb mdns services                      # find the phone (ADB_MDNS_OPENSCREEN=1 if empty)
adb connect <phone-ip>:<port>          # IP & port from Developer options › Wireless debugging
adb reverse tcp:4173 tcp:4173          # phone localhost:4173 → Mac
```

Then open `http://localhost:4173` on the phone. To test offline, tap "Download for offline"
on a game, run `adb reverse --remove tcp:4173`, and reload.

## One-time Cloudflare setup (owner)

1. Create a Cloudflare account, then the Pages project (Direct Upload):
   `pnpm dlx wrangler@4 login` and
   `pnpm dlx wrangler@4 pages project create board-games-companion --production-branch main`.
2. **Keep it private.** The guides contain publisher card art and rulebook page renders for
   private use. In Cloudflare Zero Trust › Access › Applications, add a self-hosted
   application for `board-games-companion.pages.dev` (and `*.board-games-companion.pages.dev`
   for previews) with an "Emails" policy listing the gaming group (one-time PIN login; free
   up to 50 users). The manifest is requested with credentials (`useCredentials` in
   `vite.config.ts`), so the PWA still installs behind Access. `_headers` and `robots.txt`
   also tell search engines not to index the site.

## Deploying

- **From the Mac:** `pnpm deploy:pages` (builds the real games and uploads `apps/web/dist`;
  set `CF_PAGES_PROJECT` if the project has another name). Don't run `pnpm deploy`: that's
  pnpm's own built-in command.
- **Automatically on push to `main`:** `.github/workflows/deploy.yml` runs after CI passes.
  It stays inactive until the repository has the variable `CLOUDFLARE_PAGES_PROJECT` and the
  secrets `CLOUDFLARE_API_TOKEN` (permission "Cloudflare Pages: Edit") and
  `CLOUDFLARE_ACCOUNT_ID`. It can also be started by hand from the Actions tab.

## After a deploy

Open the site on the phone, then "Install app" / "Add to Home screen". Updates arrive
automatically: the service worker takes over on the next launch (`autoUpdate`). Guides that
were downloaded for offline use refresh in the background when online.
