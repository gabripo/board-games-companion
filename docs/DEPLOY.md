# Shipping the app

The app is a static site: `pnpm build:games` writes everything to `apps/web/dist`
(app shell + service worker + `games/` bundles and images). Host: Cloudflare Pages (free).
To put it on a phone, see [INSTALL.md](INSTALL.md).

## Private game images

`content/games/*/images/` (publisher card art, rulebook page renders) is **gitignored**: the
public GitHub repo only has the JSON guides. The images live on the owner's machine (backup of
the composed WebPs in `sources/_images-backup/`, raw downloads in `sources/<game>/`, both
gitignored too). Consequences:

- **Deploy only from the owner's machine** (`pnpm deploy:pages`). A fresh clone or CI has no
  images, and `pnpm validate` fails on missing images — on purpose, so an incomplete build
  can't be shipped by accident.
- **CI** sets `BGC_IMAGES=optional`: missing images become warnings and everything else is
  still validated. Never set it when deploying.
- **New machine:** copy `content/games/*/images/` (or `sources/_images-backup/<id>/` into
  `content/games/<id>/images/`) by hand. Keep a copy somewhere private (cloud drive, private
  repo) — the images exist nowhere else.

## Before every release

```bash
pnpm check        # typecheck + lint + unit/content tests + validate
pnpm e2e          # Playwright on the prod build (fixtures): Pixel 7 + iPad landscape
```

`pnpm build` ships the synthetic fixture games — never deploy that one.
Stop any `pnpm preview:games` before `pnpm e2e`: Playwright reuses a server already on :4173,
and the e2e tests expect the fixture games.

## Test on a real phone first (no deploy needed)

With ADB over Wi-Fi, `localhost` on the phone can point at the Mac. Browsers treat
`localhost` as secure, so install, offline mode and Screen Wake Lock all work without HTTPS.

```bash
pnpm build:games && pnpm preview:games # serves dist on :4173
adb mdns services                      # find the phone (ADB_MDNS_OPENSCREEN=1 if empty)
adb connect <phone-ip>:<port>          # IP & port from Developer options › Wireless debugging
adb reverse tcp:4173 tcp:4173          # phone localhost:4173 → Mac
```

Then open `http://localhost:4173` on the phone. To test offline, tap "Download for offline"
on a game, run `adb reverse --remove tcp:4173`, and reload.

## Deploying

```bash
pnpm dlx wrangler@4 login   # once: authorize wrangler in the browser
pnpm deploy:pages           # build:games + upload apps/web/dist
```

`deploy:pages` uploads to the Pages project named by `CF_PAGES_PROJECT` (default
`board-games-companion`), creating it on the first run is a one-off:
`pnpm dlx wrangler@4 pages project create <name> --production-branch main`.
Don't run `pnpm deploy`: that's pnpm's own built-in command.

The site is reachable by anyone who has the link (not indexed: `_headers` sends `noindex`,
`robots.txt` disallows crawling). To restrict it to the gaming group later, add a Cloudflare
Access application (Zero Trust › Access › Applications › self-hosted, domain
`<project>.pages.dev`, policy "Emails" with the group's addresses; free up to 50 users). The
manifest is requested with credentials (`useCredentials` in `vite.config.ts`), so the app still
installs behind Access.

## After a deploy

Open the site on a phone and install it ([INSTALL.md](INSTALL.md)). Updates arrive
automatically: the service worker swaps in the new version on the next launch
(`autoUpdate`). Guides downloaded for offline use refresh in the background when online.
