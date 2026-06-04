# Market Bubble Chat — Architecture & Developer Guide

> ← Back to the [README](../README.md). This is the deep-dive: how it's built, every option, and how to extend it.

**Twitch + Kick + X chat merged into one real-time, markets-native overlay** — with live cashtag price pills, a cross-platform hype meter, sentiment tinting, real emote rendering, and owner-configurable filtering that never lets a slur hit your broadcast. Runs as a local desktop app; you copy one URL into OBS.

Built for the Market Bubble Vibe Code Challenge. Every visual leans markets culture: cashtags, polymarket, hype, sentiment.

## Run it as a desktop app

```bash
npm run install:all   # installs server, web, and desktop deps (first time)
npm run app           # builds the web, then opens the Market Bubble Chat window
```

On Windows you can also double-click **`Start Market Bubble Chat.bat`**. The window opens on the Setup page; connect channels, pick your overlay look, and copy the `localhost` overlay URL into OBS. Everything runs on your PC — no hosting, no login, no owner key.

> `npm run app:dev` skips the rebuild (after the first build). `npm run dist` runs electron-builder — see [Packaging an installer](#packaging) for the standalone-bundle step that's still needed for a distributable `.exe`.

---

## What it does

```
Twitch ─┐
Kick   ─┼─→ Normalize ─→ Filter ─→ Enrich ─→ Ring buffer ─→ WS fan-out ─→ /  (dashboard)
X      ─┘                                                              └─→ /overlay (OBS)
                                      ▲
                              Owner config (persisted, pushed live)
```

A single Node service runs all three ingestors + the fan-out WebSocket. The Next.js frontend connects to it. Owner config changes persist and push live over the same socket, so the overlay updates **without a refresh**.

### Highlights
- **One merged feed, source-labeled** — real platform logo (Twitch / Kick / X) per message, brand-colored username, **white message text** for a clean read. A **Color Mode** switch in the owner panel adds sentiment edges + richer coloring and pushes live.
- **Live cashtag pills** — `$BTC`, `$SOL`, `$PEPE`… resolved to live price + 24h change (CoinGecko, with a Binance.US fallback). Polymarket links auto-highlighted.
- **Cross-platform hype meter** — rolling msgs/sec across all platforms; flashes `🔥 HYPE` with the leading platform (`Kick +340%`) on a 2.5× spike.
- **Sentiment tint** — bull/bear lexicon paints a green/red left edge per message.
- **Broadcast-safe filtering** — a protected slur list (obfuscation-resistant: catches `n1gg3r`, `f.u.d`, `f u d`) plus owner-managed per-word mask/remove rules. Masking never leaks the term.
- **OBS overlay** — transparent, bottom-up, auto-fade, fully URL-param driven.
- **Owner panel** — manage channels, filters, and word rules; gated by `OWNER_KEY`; changes push live.

---

## Quick start

```bash
# 1. install both packages
npm run install:all            # or: npm --prefix server install && npm --prefix web install

# 2. configure the backend
cp server/.env.example server/.env
#   set TWITCH_CHANNELS / KICK_CHANNELS to BIG LIVE channels so chat flows.

# 3. run both (server on :4000, web on :3000)
npm run dev                    # needs the root concurrently dev-dep (npm install at root)
#   …or run them in two terminals:
#   npm run dev:server
#   npm run dev:web
```

Open:
- **Setup app** → http://localhost:3000 — connect channels, pick overlay modes, **copy your overlay URL**
- **All chat** → http://localhost:3000/chat — clean full-screen merged feed, source-labeled (the demo view)
- **Overlay** → http://localhost:3000/overlay — the clean feed your stream software loads
- **Mod dashboard** → http://localhost:3000/dashboard — busy operator view: search / filter / hype
- **Advanced filters** → http://localhost:3000/settings — word rules, slur list, mask char

> Channels set via env vars are authoritative on boot. After that, set them in the Setup app (or owner panel) — it restarts the affected ingestors. Delete `server/data/config.json` to fully reset.

### The flow (what a streamer actually does)
1. Open the **Setup app** (`/`).
2. **Connect your channels** — type Twitch / Kick / X names, enter the owner key, hit **Connect**.
3. **Choose your look** — Clean vs Color, Bottom/Top, density, fade, optional green-screen.
4. Watch the **live preview**, then **Copy** the overlay URL.
5. Paste it into OBS / Streamlabs / vMix / XSplit as a **Browser Source**. Done.

---

## Runs on your PC — nothing to host (the default)

Tape is **local-first**. For the normal case — one streamer, one machine — everything (ingestors, control panel, overlay) runs on your own PC, and your stream software loads the overlay from `localhost`. Because OBS / Streamlabs / vMix run a browser on the *same machine*, a `localhost` browser source **just works** — no hosting, no account, no monthly cost.

- **Owner key is auto-skipped on localhost.** It exists only to stop a stranger from changing your settings *over a network*. Same-machine requests are trusted, so the local Setup app never asks for it.
- **A public URL is only needed for multi-location collabs** — co-streamers in different cities all loading the same merged feed. Then you host the feed engine and share its URL (and the owner key starts mattering again). See [Different locations](#not-using-obs--streaming-from-different-locations).

So the everyday flow is: run it → open `localhost:3000` → connect channels → copy the `localhost` overlay URL → paste into OBS. That's the whole thing.

## Connecting channels (gathering all the chats)

You don't link or log into any accounts — you just tell the aggregator **which channels to read**, and it connects out to each platform's chat for you (Twitch IRC + Kick Pusher are anonymous read; X uses your own logged-in browser profile).

Two ways:

1. **Owner panel** → `/settings` → **Tracked Channels** — type the names per platform and hit **Save & push live**:
   - **Twitch** → the channel's login name (e.g. `ansem`)
   - **Kick** → the channel slug from `kick.com/<slug>` (e.g. `xqc`)
   - **X** → `@handle`, a `$CASHTAG` live search, or a broadcast URL
   Saving restarts the affected ingestors and immediately starts merging those chats. Add as many as you want per platform (comma-separated).

2. **Env vars** (authoritative on first boot) — set `TWITCH_CHANNELS`, `KICK_CHANNELS`, `X_TARGETS` in `server/.env`.

That's the whole "connection": the single backend opens one Twitch IRC socket (multi-JOIN), one Kick Pusher socket (multi-subscribe), and one X capture, normalizes everything, and fans it out to the dashboard + overlay.

## OBS overlay

Add a **Browser Source** pointing at:

```
http://localhost:3000/overlay?channels=kick:xqc,twitch:ansem,x:@handle&pos=bottom&max=12&fade=8000
```

| param      | meaning                                              |
|------------|------------------------------------------------------|
| `channels` | `platform:channel` allow-list (omit a channel = all of that platform; omit param = everything) |
| `pos`      | `bottom` (default) or `top`                          |
| `max`      | max messages shown (default 12)                      |
| `fade`     | ms before a message fades out (default 8000)         |
| `color`    | `0` clean (default) / `1` color mode (overrides owner config for this source) |
| `bg`       | solid page background (e.g. `%2300FF00` for chroma key) — default transparent. For stream software without a transparent browser source. |

The **Setup app** builds this URL for you — you usually never type it by hand.

The source is transparent + chroma-safe and reads the owner filter config live. Drop it into your scene; your restream multiplexes it to Twitch/Kick/YouTube at once.

---

## Ingestors

| Platform | Method | Auth |
|----------|--------|------|
| **Twitch** | anonymous IRC-over-WS (`justinfan`) | none |
| **Kick** | chatroom id via Cloudflare-protected API (`got-scraping`) → Pusher subscribe | none |
| **X** | authenticated Playwright capture (persistent profile + MutationObserver) | your logged-in session |

X is the fragile leg and **degrades gracefully**: if Playwright isn't installed or `X_USER_DATA_DIR` is unset, X is simply disabled and the merged feed runs on Twitch + Kick. A status chip shows `X: reconnecting` rather than crashing.

To enable X:
```bash
npm --prefix server install   # playwright is an optional dep
npx --prefix server playwright install chromium
# in server/.env:
X_USER_DATA_DIR=C:\path\to\persistent\profile   # a Chromium profile already logged into x.com
X_TARGETS=@handle                                # or a $CASHTAG live search, or a broadcast URL
```

> ⚠️ Kick's Pusher chat event is `App\Events\ChatMessageEvent` (it has changed over time). If Kick stops flowing, find the new event/app-key in the browser Network tab filtered by "pusher".

---

## Desktop app

`desktop/` is an Electron shell. `main.js` launches the backend (`:4000`) and the web server (`:3000`) as child processes, waits for the port, then opens a window on the Setup page. External links (cashtags, polymarket) open in the system browser; closing the window stops the child servers (`tree-kill`).

- `npm run app` — build web + open the app.
- `npm run app:dev` — open the app against an existing build (no rebuild).

### Packaging

`npm run dist` runs electron-builder (config in `desktop/package.json`). As-is it packages the Electron shell only — to ship a **self-contained `.exe`** that runs without the repo, two more steps are needed:

1. **Web** → set `output: 'standalone'` in `web/next.config.js`, `next build`, and bundle `.next/standalone` + `.next/static` + `public` as electron-builder `extraResources`.
2. **Server** → compile `server/src` to JS (a build `tsconfig` that emits, instead of `noEmit`) and bundle `server/dist`.

Then point `main.js` at the bundled paths (via `process.resourcesPath` when packaged) and run them with Electron's embedded Node (`ELECTRON_RUN_AS_NODE`). The current local-run path (`npm run app`) already gives a real desktop app for the streamer's own machine.

---

## Filtering (broadcast safety)

Two layers, evaluated per message:
1. **emoji/emote-only** drop (toggle).
2. **Protected slur list** — on by default, action = *remove*. Matched against obfuscation-normalized text, so leetspeak / spacers / repeats don't slip through. This renders on-stream — keep it on.
3. **Custom remove rules** — any hit drops the whole message.
4. **Custom mask rules** — replaces the term with the mask char in survivors; fuzzy rules can't leak (token masking + a full-message safety net).

Each custom word has its own `enabled` toggle, `mask | remove` action, and `fuzzy` (obfuscation-resistant) flag — so `fud` can mask while a slur removes the whole message.

---

## Demo / testing aid

An owner-gated inject endpoint pushes a synthetic message through the **full** pipeline (filter → enrich → buffer → fan-out) — handy for QA and for seeding a deterministic cashtag pill on cue while recording:

```bash
curl -X POST http://localhost:4000/inject \
  -H "Content-Type: application/json" -H "X-Owner-Key: <OWNER_KEY>" \
  -d '{"platform":"x","username":"AnsemDAO","text":"$BTC reclaiming, $SOL leading alts 🚀"}'
```

---

## Project layout

```
server/                  Node 20+ + TS (single process)
  src/index.ts           boot: ingestors + WS fan-out + config API + inject
  src/ingestors/*.ts     twitch · kick · x
  src/normalize.ts       obfuscation-resistant text + emoji detection
  src/filter.ts          config model + applyFilter + mask/normalize
  src/enrich.ts          cashtags · sentiment · hype meter
  src/buffer.ts          ring buffer + dedup
  src/config.ts          JSON-persisted settings store + OWNER_KEY
  src/ws.ts              fan-out + config HTTP API + live push
web/                     Next.js 15 (App Router) + Tailwind + Zustand
  app/page.tsx           dashboard (the demo view)
  app/overlay/page.tsx   OBS browser source
  app/settings/page.tsx  owner panel
  lib/useFeed.ts         WS client hook (Zustand store)
  components/            Message · HypeMeter · FilterBar · CashtagPill · …
```

## Stack
Node + TypeScript · `ws` · `got-scraping` · `playwright` · Next.js 15 · Tailwind (Warm Obsidian theme) · Zustand. Config persists to a JSON file (swap to SQLite/Drizzle later without touching the pipeline).
