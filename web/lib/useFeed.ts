'use client';

// WS client hook backed by a Zustand store. Connects to the backend fan-out,
// hydrates from the hello buffer, then streams messages / hype / status / config
// live. Auto-reconnects.

import { create } from 'zustand';
import { useEffect, useRef } from 'react';
import type {
  ChatMessage,
  AppConfig,
  Platform,
  ServerEvent,
  StatusState,
} from './types';
import { loadGlobalEmotes, type EmoteMap } from './emotes';

const WS_URL =
  process.env.NEXT_PUBLIC_WS_URL ||
  (typeof window !== 'undefined'
    ? `ws://${window.location.hostname}:4000`
    : 'ws://localhost:4000');

const MAX_MESSAGES = 400;

interface HypeState {
  rate: number;
  spike: boolean;
  leader: Platform | null;
  leaderPct: number;
}

interface FeedState {
  messages: ChatMessage[];
  config: AppConfig | null;
  hype: HypeState;
  statuses: Record<Platform, StatusState>;
  connected: boolean;
  counts: Record<Platform, number>;
  globalEmotes: EmoteMap;
  push: (m: ChatMessage) => void;
  hydrate: (buffer: ChatMessage[], config: AppConfig) => void;
  setConfig: (c: AppConfig) => void;
  setHype: (h: HypeState) => void;
  setStatus: (p: Platform, s: StatusState) => void;
  setConnected: (v: boolean) => void;
  setGlobalEmotes: (m: EmoteMap) => void;
}

export const useFeedStore = create<FeedState>((set) => ({
  messages: [],
  config: null,
  hype: { rate: 0, spike: false, leader: null, leaderPct: 0 },
  statuses: { twitch: 'down', kick: 'down', x: 'down' },
  connected: false,
  counts: { twitch: 0, kick: 0, x: 0 },
  globalEmotes: new Map(),
  push: (m) =>
    set((st) => {
      const messages = [...st.messages, m];
      if (messages.length > MAX_MESSAGES) messages.splice(0, messages.length - MAX_MESSAGES);
      return {
        messages,
        counts: { ...st.counts, [m.platform]: st.counts[m.platform] + 1 },
      };
    }),
  hydrate: (buffer, config) =>
    set(() => {
      const counts: Record<Platform, number> = { twitch: 0, kick: 0, x: 0 };
      for (const m of buffer) counts[m.platform]++;
      return { messages: buffer.slice(-MAX_MESSAGES), config, counts };
    }),
  setConfig: (config) => set({ config }),
  setHype: (hype) => set({ hype }),
  setStatus: (p, s) => set((st) => ({ statuses: { ...st.statuses, [p]: s } })),
  setGlobalEmotes: (globalEmotes) => set({ globalEmotes }),
  setConnected: (connected) => set({ connected }),
}));

// Mount once (e.g. in the page) to open + maintain the WS connection.
export function useFeedConnection(): void {
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const s = useFeedStore.getState();
    let ws: WebSocket | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;
    let closedByUs = false;

    // Load 7TV + BTTV global emotes once.
    if (s.globalEmotes.size === 0) {
      void loadGlobalEmotes().then((m) => s.setGlobalEmotes(m));
    }

    const connect = () => {
      ws = new WebSocket(WS_URL);
      ws.onopen = () => s.setConnected(true);
      ws.onclose = () => {
        s.setConnected(false);
        if (!closedByUs) retry = setTimeout(connect, 2000);
      };
      ws.onerror = () => ws?.close();
      ws.onmessage = (ev) => {
        let event: ServerEvent;
        try {
          event = JSON.parse(ev.data as string);
        } catch {
          return;
        }
        switch (event.type) {
          case 'hello':
            s.hydrate(event.buffer, event.config);
            break;
          case 'message':
            s.push(event.message);
            break;
          case 'config':
            s.setConfig(event.config);
            break;
          case 'hype':
            s.setHype({
              rate: event.rate,
              spike: event.spike,
              leader: event.leader,
              leaderPct: event.leaderPct,
            });
            break;
          case 'status':
            s.setStatus(event.platform, event.state);
            break;
        }
      };
    };

    connect();
    return () => {
      closedByUs = true;
      if (retry) clearTimeout(retry);
      ws?.close();
    };
  }, []);
}

export const CONFIG_HTTP_URL =
  process.env.NEXT_PUBLIC_CONFIG_URL ||
  (typeof window !== 'undefined'
    ? `http://${window.location.hostname}:4000/config`
    : 'http://localhost:4000/config');
