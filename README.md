<div align="center">

<img src="web/public/marketbubble.png" width="90" alt="Market Bubble Chat" />

# Market Bubble Chat

**Twitch + Kick + X chat, merged into one clean feed — with live cashtag prices, real emotes, and a drop-in OBS overlay.**

</div>

---

Market Bubble Chat is a desktop app that pulls chat from **Twitch, Kick, and X at the same time** and shows it as one unified, markets-native feed. Built for streamers covering crypto/markets.

## What it does

- 🟣🟢⚫ **One merged chat** from Twitch, Kick & X — each message labelled with its source.
- 💸 **Live cashtag pills** — type `$BTC` and it shows the price + 24h change.
- 😂 **Real emotes** — Twitch, Kick, and 7TV/BTTV emotes render as images, not text.
- 📺 **OBS overlay** — copy one URL into a Browser Source; transparent, drop-in.
- 🪟 **Pop-out chat** — a clean, frameless chat window for your scene or a second monitor.
- 🛡️ **Broadcast-safe filtering** — built-in slur blocking + your own word rules.

## Run it

Just **double-click a launcher** for your platform. It auto-installs everything it needs (Node, dependencies, etc.), rebuilds after updates, and starts. Two modes:

| | What it is | Use it when |
|---|---|---|
| **App Mode** | the full desktop app window | normal Mac / PC |
| **Web Mode** | runs the app and opens it in your **browser** | virtual machines, or anywhere the desktop window won't open |

- **Windows** → `App Mode (Windows).bat` or `Web Mode (Windows).bat`
- **macOS** → `App Mode (Mac).command` or `Web Mode (Mac).command`

> **Clone with GitHub Desktop** (not a ZIP download) so the launchers run cleanly.
> **macOS first run:** if it says "Apple could not verify…", click **Done** (not *Move to Trash*), then **right-click the launcher → Open**. One time only.

Prefer the terminal? `npm run install:all` then `npm run app`.

Then:
1. **Connect your channels** — type your Twitch / Kick / X names.
2. **Choose your look** and **copy the overlay URL**.
3. Paste it into OBS / Streamlabs / vMix as a **Browser Source**. Done.

Everything runs **on your own PC** — no hosting, no account, no cost. (X is the only one that needs a one-time sign-in, in a window the app opens for you.)

## Learn more

See **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** for the full picture — how each platform is ingested, the overlay URL options, filtering, the markets enrichment, local-first design, and packaging.

---

<div align="center">
<sub>Built for the Market Bubble Vibe Code Challenge.</sub>
</div>
