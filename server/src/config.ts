// Config store. JSON-file persistence (the spec permits this fast path over
// SQLite/Drizzle). Holds filter config + tracked channels. Emits change events
// so the WS layer can push live updates to dashboard + overlay.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EventEmitter } from 'node:events';
import { nanoid } from 'nanoid';
import type { AppConfig } from './types.js';

// Anchored to the server folder (this file is server/src/config.ts) so settings
// always save/load from the same place, no matter the working directory the app
// was launched from (Electron, browser launcher, npm script, etc.).
const CONFIG_PATH = resolve(fileURLToPath(import.meta.url), '../../data/config.json');

function parseChannels(env: string | undefined): string[] {
  if (!env) return [];
  return env
    .split(',')
    .map((s) => s.trim().replace(/^#/, ''))
    .filter(Boolean);
}

function defaultConfig(): AppConfig {
  return {
    filter: {
      hideEmojiOnly: false,
      maskChar: '*',
      defaultSlurListEnabled: true,
      rules: [
        { id: nanoid(8), word: 'fud', enabled: true, action: 'mask', normalize: true },
      ],
    },
    channels: {
      twitch: parseChannels(process.env.TWITCH_CHANNELS),
      kick: parseChannels(process.env.KICK_CHANNELS),
      x: parseChannels(process.env.X_TARGETS),
    },
    display: {
      colorMode: false,
      backdrop: '',
      backdropOpacity: 0.5,
    },
  };
}

export class ConfigStore extends EventEmitter {
  private config: AppConfig;

  constructor() {
    super();
    this.config = this.load();
  }

  private load(): AppConfig {
    if (existsSync(CONFIG_PATH)) {
      try {
        const raw = JSON.parse(readFileSync(CONFIG_PATH, 'utf8')) as Partial<AppConfig>;
        const base = defaultConfig();
        // Filter rules: persisted owner edits win over defaults.
        // Channels: an env var, when set, is authoritative on boot (lets an
        // operator force channels via .env); otherwise persisted values win.
        const persisted = raw.channels ?? base.channels;
        return {
          filter: { ...base.filter, ...raw.filter },
          channels: {
            twitch: process.env.TWITCH_CHANNELS ? base.channels.twitch : persisted.twitch,
            kick: process.env.KICK_CHANNELS ? base.channels.kick : persisted.kick,
            x: process.env.X_TARGETS ? base.channels.x : persisted.x,
          },
          display: { ...base.display, ...raw.display },
        };
      } catch (err) {
        console.warn('[config] failed to parse, using defaults:', err);
      }
    }
    const cfg = defaultConfig();
    this.persist(cfg);
    return cfg;
  }

  private persist(cfg: AppConfig): void {
    try {
      mkdirSync(dirname(CONFIG_PATH), { recursive: true });
      writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2), 'utf8');
    } catch (err) {
      console.warn('[config] persist failed:', err);
    }
  }

  get(): AppConfig {
    return this.config;
  }

  // Replace config (owner panel). Persists + emits 'change'.
  update(next: AppConfig): AppConfig {
    this.config = next;
    this.persist(next);
    this.emit('change', next);
    return next;
  }
}

export const OWNER_KEY = process.env.OWNER_KEY || 'dev-owner-key';
