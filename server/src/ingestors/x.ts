// X ingestor — authenticated Playwright capture (the fragile leg). Reuses a
// persistent logged-in browser profile, navigates to the target, and injects a
// MutationObserver that streams new posts back to Node.
//
// Graceful degradation: if Playwright/Chromium isn't installed, the profile
// isn't logged in, or X breaks, this logs a clear hint + reports status and the
// merged feed keeps running on Twitch + Kick. It never throws into the process.

import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ChatMessage } from '../types.js';

// Browser-context globals — the page.evaluate / MutationObserver code below runs
// inside the X page, not in Node, so these aren't in the Node lib typings.
declare const document: any;
declare const window: any;
declare const MutationObserver: any;
type Element = any;

type Emit = (msg: ChatMessage) => void;
type Status = (state: 'up' | 'down' | 'reconnecting', channel?: string) => void;

interface RawXNode {
  username: string;
  text: string;
  ts: number;
  n?: number; // broadcast: per-row counter so repeated chat lines aren't deduped
}

// Default profile dir so X auto-enables whenever there's a target. Anchored to
// the server folder (this file lives at server/src/ingestors/x.ts) so the login
// script and the ingestor agree regardless of cwd. Override with X_USER_DATA_DIR.
export const X_PROFILE_DIR =
  process.env.X_USER_DATA_DIR || resolve(fileURLToPath(import.meta.url), '../../../.x-profile');

function hashId(n: RawXNode): string {
  // Timeline posts dedup by content (re-scanned every reload). Broadcast chat
  // lines include a per-row counter so identical lines ("W", "lol") all show.
  const key = n.n !== undefined ? `${n.username}|${n.text}|${n.n}` : `${n.username}|${n.text}`;
  return 'x-' + createHash('sha1').update(key).digest('hex').slice(0, 16);
}

// Injected into the X page verbatim (string, not a function — see note at call
// site). Scans existing <article> posts, then observes new ones and pushes
// {username,text} back to Node via the exposed window.__mbPush.
const X_INJECT_SCRIPT = `
(function () {
  var w = window;
  function extract(article) {
    if (!article || !article.querySelector) return;
    var textEl = article.querySelector('[data-testid="tweetText"]');
    var userEl = article.querySelector('[data-testid="User-Name"]');
    var text = ((textEl && textEl.textContent) || '').trim();
    var raw = ((userEl && userEl.textContent) || '').trim();
    var handle = raw.indexOf('@') >= 0 ? raw.split('@')[1].split('\\u00b7')[0].trim() : raw;
    if (text && w.__mbPush) w.__mbPush({ username: handle, text: text, ts: Date.now() });
  }
  function scan(node) {
    if (node && node.querySelectorAll) {
      var arts = node.querySelectorAll('article');
      for (var i = 0; i < arts.length; i++) extract(arts[i]);
    }
    if (node && node.tagName === 'ARTICLE') extract(node);
  }
  scan(document.body);
  if (w.__mbObs) w.__mbObs.disconnect();
  w.__mbObs = new MutationObserver(function (muts) {
    for (var i = 0; i < muts.length; i++) {
      var added = muts[i].addedNodes;
      for (var j = 0; j < added.length; j++) {
        if (added[j].nodeType === 1) scan(added[j]);
      }
    }
  });
  w.__mbObs.observe(document.querySelector('main') || document.body, { childList: true, subtree: true });
})();
`;

// Live-broadcast chat capture. Chat rows are keyed by the chatter's avatar
// [data-testid^="UserAvatar-Container-<handle>"]; the row text is
// "DisplayName@handle<message>" (the text lives a couple ancestors up). The chat
// is a virtualized list (nodes recycle), so we POLL the visible rows on a fast
// interval and dedup by author|text over a recent window — robust to recycling,
// and it keeps running minimized thanks to the anti-throttle launch flags.
const X_BROADCAST_SCRIPT = `
(function () {
  var w = window;
  if (w.__mbBroadcast) return; // already polling on this page
  w.__mbBroadcast = true;
  // Make X think the tab is always visible so it keeps streaming chat while the
  // window is minimized / backgrounded.
  try {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: function () { return 'visible'; } });
    Object.defineProperty(document, 'hidden', { configurable: true, get: function () { return false; } });
    document.addEventListener('visibilitychange', function (e) { e.stopImmediatePropagation(); }, true);
  } catch (e) {}
  var recent = [], recentSet = Object.create(null);
  function harvestOnce() {
    var avs = document.querySelectorAll('[data-testid^="UserAvatar-Container-"]');
    for (var i = 0; i < avs.length; i++) {
      var av = avs[i];
      var handle = (av.getAttribute('data-testid') || '').replace('UserAvatar-Container-', '');
      if (!handle || handle === 'unknown') continue;
      var marker = '@' + handle, node = av.parentElement, msg = '', ok = false;
      for (var up = 0; up < 5 && node; up++) {
        var txt = (node.textContent || '').replace(/\\s+/g, ' ').trim();
        var idx = txt.indexOf(marker);
        if (idx !== -1) { msg = txt.slice(idx + marker.length).trim(); ok = true; break; }
        node = node.parentElement;
      }
      if (!ok || !msg) continue;
      if (/click to follow/i.test(msg) || /^follow$/i.test(msg)) continue;
      var k = handle + '|' + msg;
      if (recentSet[k]) continue;
      recentSet[k] = 1; recent.push(k);
      if (recent.length > 300) { delete recentSet[recent.shift()]; }
      if (w.__mbPush) w.__mbPush({ username: handle, text: msg, ts: Date.now() });
    }
  }
  harvestOnce();
  if (w.__mbTimer) clearInterval(w.__mbTimer);
  w.__mbTimer = setInterval(harvestOnce, 1500);
})();
`;

// Turn a target spec into an X URL.
//  - full URL            → as-is
//  - $CASHTAG / #hashtag → live search (the busy markets feed)
//  - @handle / bare word → that account's profile timeline
export function targetToUrl(target: string): string {
  const t = target.trim();
  if (/^https?:\/\//.test(t)) return t;
  if (t.startsWith('$') || t.startsWith('#')) {
    return `https://x.com/search?q=${encodeURIComponent(t)}&f=live`;
  }
  const handle = t.replace(/^@/, '');
  return `https://x.com/${handle}`;
}

export function startX(targets: string[], emit: Emit, status: Status): () => void {
  if (targets.length === 0) {
    status('down');
    return () => {};
  }
  const userDataDir = X_PROFILE_DIR;

  let closed = false;
  let launching = false; // single-flight: never launch while one is in progress
  let context: { close: () => Promise<void> } | null = null;
  let restartTimer: NodeJS.Timeout | null = null;
  const seen = new Set<string>();

  const run = async () => {
    if (closed || launching) return;
    launching = true;
    status('reconnecting');
    let chromium;
    try {
      ({ chromium } = await import('playwright'));
    } catch {
      console.warn('[x] playwright not installed — run `npm --prefix server install`. X disabled.');
      launching = false;
      status('down');
      return;
    }

    try {
      const ctx = await chromium.launchPersistentContext(userDataDir, {
        headless: false,
        viewport: { width: 1280, height: 900 },
        args: [
          '--disable-blink-features=AutomationControlled',
          // Keep capturing when the window is minimized / not focused.
          '--disable-background-timer-throttling',
          '--disable-renderer-backgrounding',
          '--disable-backgrounding-occluded-windows',
        ],
      });
      context = ctx;

      const page = ctx.pages()[0] ?? (await ctx.newPage());
      const target = targets[0]; // primary target; could rotate across pages
      const url = targetToUrl(target);

      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(2500); // let the nav render before checking auth

      // Logged-in? The left-nav account button only renders when authenticated.
      const isLoggedIn = async () =>
        (await page
          .locator('[data-testid="SideNav_AccountSwitcher_Button"], [data-testid="AppTabBar_Home_Link"]')
          .count()
          .catch(() => 0)) > 0;

      // Wait (with the window open) for the user to sign in. Self-heals: once
      // you're logged in, it navigates to the target and starts capturing.
      let warned = false;
      while (!closed && !(await isLoggedIn())) {
        if (!warned) {
          console.warn('[x] Waiting for X login — sign in to x.com in the open window…');
          warned = true;
        }
        status('reconnecting', target);
        await page.waitForTimeout(3000);
      }
      if (closed) return;
      if (warned) {
        // Just logged in — go to the target fresh.
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
      }
      await page.waitForTimeout(2500);

      // Capture mode. A /broadcasts/ URL is a live stream → capture its chat.
      // For an @handle, auto-detect a live broadcast on the profile and hop to it
      // (that's the "live stream chat"); otherwise fall back to the timeline.
      let mode: 'broadcast' | 'timeline' = /\/broadcasts\//.test(page.url()) ? 'broadcast' : 'timeline';
      if (mode === 'timeline' && !/\/broadcasts\//.test(url)) {
        const bc = await page
          .locator('a[href*="/broadcasts/"]')
          .first()
          .getAttribute('href')
          .catch(() => null);
        if (bc) {
          const full = bc.startsWith('http') ? bc : `https://x.com${bc}`;
          console.log(`[x] ${target} is live — capturing broadcast chat: ${full}`);
          await page.goto(full, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
          await page.waitForTimeout(4000);
          mode = 'broadcast';
        } else {
          console.log(`[x] ${target} not live — capturing profile timeline.`);
        }
      }

      // Bridge: page → Node. (Guard against double-registration on restart.)
      try {
        await page.exposeFunction('__mbPush', (n: RawXNode) => {
          const msg: ChatMessage = {
            id: hashId(n),
            platform: 'x',
            username: n.username || 'unknown',
            color: null,
            badges: [],
            text: n.text,
            emotes: [],
            ts: n.ts || Date.now(),
            channel: target,
          };
          if (!msg.text.trim()) return;
          if (seen.has(msg.id)) return;
          seen.add(msg.id);
          if (seen.size > 2000) seen.clear();
          emit(msg);
        });
      } catch {
        /* already exposed on this page */
      }

      // Inject as a STRING (not a function): tsx/esbuild rewrites passed
      // functions and injects a `__name` helper that doesn't exist in the page,
      // throwing `__name is not defined`. A raw string is sent verbatim.
      await page.evaluate(mode === 'broadcast' ? X_BROADCAST_SCRIPT : X_INJECT_SCRIPT);

      launching = false; // setup complete; window stays open capturing
      status('up', target);

      // Tuck the window away — it keeps running (and capturing) minimized, so it
      // isn't sitting on the user's screen. Set X_SHOW_WINDOW=1 to keep it visible.
      if (!process.env.X_SHOW_WINDOW) {
        try {
          const session = await ctx.newCDPSession(page);
          const { windowId } = (await session.send('Browser.getWindowForTarget')) as {
            windowId: number;
          };
          await session.send('Browser.setWindowBounds', {
            windowId,
            bounds: { windowState: 'minimized' },
          });
        } catch {
          /* minimize is best-effort */
        }
      }

      // Broadcast chat streams new rows live into the DOM, so just re-attach the
      // observer periodically (no reload — that would drop the live chat). For a
      // timeline, new posts hide behind a "Show N posts" pill, so reload + rescan.
      const refresher = setInterval(async () => {
        if (closed) return;
        try {
          if (mode === 'broadcast') {
            await page.evaluate(X_BROADCAST_SCRIPT);
          } else {
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
            await page.waitForTimeout(3000);
            await page.evaluate(X_INJECT_SCRIPT);
          }
        } catch {
          /* transient error; next tick retries */
        }
      }, mode === 'broadcast' ? 20000 : 30000);

      ctx.on('close', () => {
        clearInterval(refresher);
        launching = false;
        if (!closed) {
          status('down');
          scheduleRestart();
        }
      });
    } catch (err) {
      launching = false;
      const msg = (err as Error).message || '';
      // Stale lock from an orphaned Chromium — wait longer for it to clear.
      const locked = /already in use|SingletonLock|ProcessSingleton/i.test(msg);
      console.warn('[x] capture error:', msg.split('\n')[0]);
      status('down');
      scheduleRestart(locked ? 12000 : 8000);
    }
  };

  const scheduleRestart = (delay = 8000) => {
    if (closed || restartTimer) return;
    restartTimer = setTimeout(() => {
      restartTimer = null;
      void run();
    }, delay);
  };

  void run();

  return () => {
    closed = true;
    if (restartTimer) clearTimeout(restartTimer);
    void context?.close().catch(() => {});
  };
}
