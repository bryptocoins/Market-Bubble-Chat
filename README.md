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

Works on **Windows and macOS** (and Linux). You'll need [Node.js](https://nodejs.org) 18+.

```bash
npm run install:all   # first time only
npm run app           # builds, then opens the app
```

Or use the one-click launcher:
- **Windows** → double-click **`Start Market Bubble Chat.bat`** (or the shortcut).
- **macOS** → double-click **`Start Market Bubble Chat (Mac Launcher).command`**.

> **macOS first run:** macOS blocks unsigned scripts ("Apple could not verify…"). Click **Done** (not *Move to Trash*), then either **right-click the `.command` → Open → Open**, or in **System Settings → Privacy & Security** click **Open Anyway**. One time only.
> Tidiest fix — in Terminal in this folder run `xattr -dr com.apple.quarantine .` once, then the launcher just works. (Or skip the launcher entirely and use `npm run app` in Terminal.)

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
