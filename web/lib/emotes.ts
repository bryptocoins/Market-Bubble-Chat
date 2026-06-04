// Emote rendering helpers.
//  - Native Twitch / Kick emotes come per-message (msg.emotes has id + name).
//  - Third-party 7TV + BTTV GLOBAL emotes (KEKW, Prayge, catJAM, …) are loaded
//    once and matched by name. (Per-channel sets are a future add.)

import type { Platform } from './types';

export type EmoteMap = Map<string, string>; // emote name -> image url

// Native platform emote CDN URLs.
export function nativeEmoteUrl(platform: Platform, id: string): string {
  if (platform === 'twitch') {
    return `https://static-cdn.jtvnw.net/emoticons/v2/${id}/default/dark/2.0`;
  }
  if (platform === 'kick') {
    return `https://files.kick.com/emotes/${id}/fullsize`;
  }
  return '';
}

// Load 7TV + BTTV global emote sets into a name->url map. Best-effort; failures
// just mean fewer emotes render.
export async function loadGlobalEmotes(): Promise<EmoteMap> {
  const map: EmoteMap = new Map();

  const sevenTv = fetch('https://7tv.io/v3/emote-sets/global')
    .then((r) => r.json())
    .then((d: { emotes?: { id: string; name: string }[] }) => {
      for (const e of d.emotes || []) {
        if (e.name && e.id) map.set(e.name, `https://cdn.7tv.app/emote/${e.id}/2x.webp`);
      }
    })
    .catch(() => {});

  const bttv = fetch('https://api.betterttv.net/3/cached/emotes/global')
    .then((r) => r.json())
    .then((d: { id: string; code: string }[]) => {
      for (const e of d || []) {
        // Don't let BTTV overwrite a 7TV emote of the same name.
        if (e.code && e.id && !map.has(e.code)) {
          map.set(e.code, `https://cdn.betterttv.net/emote/${e.id}/2x.webp`);
        }
      }
    })
    .catch(() => {});

  await Promise.all([sevenTv, bttv]);
  return map;
}
