# Testing on other phones

_Italiano: [TESTING.it.md](TESTING.it.md)_

The live app is at **https://whatweplay.pages.dev**. Any phone with a browser can open it — no
account, no app store. This page is the checklist for friends who try it, plus the owner's
side (sharing the link, shipping fixes).

## 1. Share the link

Send the link plus the install guide. A ready-to-paste message:

> Try our board games app: https://whatweplay.pages.dev
> Open it in Chrome/Firefox (Android) or Safari (iPhone), not inside WhatsApp, and add it to
> the home screen — steps: https://github.com/gabripo/board-games-companion/blob/main/docs/INSTALL.md

To hand it over in person, show a QR code: in Chrome on a computer open the link, then
**⋮** menu › **Cast, save and share** › **Create QR code**, and let friends scan it with the
phone camera.

## 2. Tester checklist (about 10 minutes)

1. **Open** the link in the phone's browser (not in a chat app's built-in browser).
2. **Install** it on the home screen — [INSTALL.md](INSTALL.md) — and from now on open it from
   that icon. It should open full screen, without the browser's address bar.
3. **Language:** pick one, then switch it in ⚙ Settings: everything changes at once.
4. **Each game** (BANG!, Horrified, Munchkin): open it, answer "Have you played before?", then
   look at the four tabs at the bottom — **Learn**, **Play**, **Board**, **Rules**.
   - Learn: tap a shortcut chip (Setup, Icons & terms…): the section appears just below the top bar.
   - Board: pictures load; pinch to zoom; tap a highlighted area to see its rules.
   - Play: step through a turn with **Next**.
   - Rules: search for a word (e.g. "jail", "beholder").
   - Tap the line under the game title (players · base game) and change the players or turn on
     an expansion/monster: the content adapts.
5. **Offline:** on one game tap **Download for offline** (allow storage if asked) and wait for
   "Available offline". Switch on **airplane mode**, close the app completely, reopen it from
   the icon: that game must still open with its pictures. Video clips may say they need a
   connection — that's expected. Switch airplane mode off afterwards.
6. **Screen stays on:** leave a guide open for a couple of minutes without touching it; the
   screen should not dim.

## 3. Reporting a problem

Send the owner:

- phone model and system version (e.g. _Pixel 7, Android 17_ / _iPhone 15, iOS 26_);
- browser (Chrome, Firefox, Samsung Internet, Safari) and whether you used the installed icon;
- the game, the tab and what you did;
- a screenshot (Android: power + volume down; iPhone: side button + volume up).

## 4. Owner: shipping a fix

1. Fix it, then run `pnpm check` and `pnpm e2e`.
2. `pnpm deploy:pages` from the Mac (it has the private images — see [DEPLOY.md](DEPLOY.md)).
3. Testers get the new version automatically: the app downloads it while online and uses it
   the next time it's opened. If someone still sees the old one, they close the app
   completely and open it again.

To test on your own Android phone _before_ deploying (over Wi-Fi, no upload), use the
`adb reverse` steps in [DEPLOY.md](DEPLOY.md#test-on-a-real-phone-first-no-deploy-needed).
iPhones can't do that: test them on the deployed site.
