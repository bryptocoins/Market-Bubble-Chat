// Kick ingestor — anonymous read. Resolve chatroom id via the Cloudflare-
// protected channels endpoint (TLS-impersonating client), then subscribe to
// Pusher and listen for ChatMessageSentEvent.

import { WebSocket } from 'ws';
import type { ChatMessage, Emote } from '../types.js';

const PUSHER_URL =
  'wss://ws-us2.pusher.com/app/32cbd69e4b950bf97679?protocol=7&client=js&version=8.4.0-rc2&flash=false';

type Emit = (msg: ChatMessage) => void;
type Status = (state: 'up' | 'down' | 'reconnecting', channel?: string) => void;

interface KickChannel {
  chatroom?: { id?: number };
}

// Resolve a slug to its chatroom id. got-scraping impersonates a browser TLS
// fingerprint to get past Cloudflare. Falls back to plain fetch (often 403).
async function resolveChatroomId(slug: string): Promise<number | null> {
  const url = `https://kick.com/api/v2/channels/${slug}`;
  try {
    const { gotScraping } = await import('got-scraping');
    const res = await gotScraping({ url, responseType: 'json', timeout: { request: 10000 } });
    const body = res.body as KickChannel;
    return body.chatroom?.id ?? null;
  } catch (err) {
    console.warn(`[kick] got-scraping lookup failed for ${slug}, trying fetch:`, (err as Error).message);
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      if (!res.ok) return null;
      const body = (await res.json()) as KickChannel;
      return body.chatroom?.id ?? null;
    } catch {
      return null;
    }
  }
}

// Kick emotes arrive inline as [emote:ID:name]. Map into emotes[] (with display
// offsets relative to the cleaned text) and return the stripped text.
function parseKickEmotes(raw: string): { text: string; emotes: Emote[] } {
  const emotes: Emote[] = [];
  const re = /\[emote:(\d+):([^\]]+)\]/g;
  let out = '';
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    out += raw.slice(last, m.index);
    const start = out.length;
    out += m[2];
    emotes.push({ id: m[1], name: m[2], start, end: out.length - 1 });
    last = m.index + m[0].length;
  }
  out += raw.slice(last);
  return { text: out, emotes };
}

interface KickMsgPayload {
  id?: string;
  content?: string;
  created_at?: string;
  sender?: {
    username?: string;
    identity?: {
      color?: string;
      badges?: { type?: string; name?: string }[];
      badges_v2?: { name?: string; type?: string }[];
    };
  };
}

export function startKick(channels: string[], emit: Emit, status: Status): () => void {
  if (channels.length === 0) {
    status('down');
    return () => {};
  }

  let ws: WebSocket | null = null;
  let closed = false;
  let reconnectTimer: NodeJS.Timeout | null = null;
  const chatroomToSlug = new Map<number, string>();

  const connect = async () => {
    if (closed) return;
    status('reconnecting');

    // Resolve all slugs (best-effort; keep whichever succeed).
    chatroomToSlug.clear();
    await Promise.all(
      channels.map(async (slug) => {
        const id = await resolveChatroomId(slug.toLowerCase());
        if (id) chatroomToSlug.set(id, slug);
        else console.warn(`[kick] could not resolve chatroom id for ${slug}`);
      }),
    );

    if (chatroomToSlug.size === 0) {
      status('down');
      scheduleReconnect();
      return;
    }

    ws = new WebSocket(PUSHER_URL);

    const subscribeAll = () => {
      for (const id of chatroomToSlug.keys()) {
        ws?.send(
          JSON.stringify({
            event: 'pusher:subscribe',
            data: { channel: `chatrooms.${id}.v2` },
          }),
        );
      }
    };

    ws.on('open', () => {
      // Pusher sends pusher:connection_established next; we subscribe there to
      // avoid duplicate-subscription errors.
      status('up', [...chatroomToSlug.values()].join(','));
    });

    ws.on('message', (data) => {
      let frame: { event?: string; data?: string; channel?: string };
      try {
        frame = JSON.parse(data.toString());
      } catch {
        return;
      }
      if (frame.event === 'pusher:connection_established') {
        subscribeAll();
        return;
      }
      if (frame.event === 'pusher:ping') {
        ws?.send(JSON.stringify({ event: 'pusher:pong', data: {} }));
        return;
      }
      if (frame.event === 'pusher_internal:subscription_succeeded') {
        console.log(`[kick] subscribed: ${frame.channel}`);
        return;
      }
      if (frame.event === 'pusher:error') {
        console.warn('[kick] pusher error:', frame.data);
        return;
      }
      // Kick's chat message event. The name has shifted over time
      // (ChatMessageSentEvent → ChatMessageEvent); accept both, namespaced or not.
      const ev = frame.event || '';
      const isChat = /Chat(Message(Sent)?)Event$/.test(ev);
      if (!isChat) return;

      let payload: KickMsgPayload;
      try {
        payload = JSON.parse(frame.data || '{}');
      } catch {
        return;
      }

      const chatroomId = Number((frame.channel || '').split('.')[1]);
      const slug = chatroomToSlug.get(chatroomId) || '';
      const { text, emotes } = parseKickEmotes(payload.content || '');
      const identity = payload.sender?.identity;
      const badges = [...(identity?.badges_v2 || []), ...(identity?.badges || [])]
        .map((b) => b.type || b.name)
        .filter((b): b is string => !!b);

      emit({
        id: payload.id || `kick-${chatroomId}-${payload.created_at || Date.now()}`,
        platform: 'kick',
        username: payload.sender?.username || 'unknown',
        color: payload.sender?.identity?.color || null,
        badges,
        text,
        emotes,
        ts: payload.created_at ? Date.parse(payload.created_at) : Date.now(),
        channel: slug,
      });
    });

    ws.on('close', () => {
      status('down');
      scheduleReconnect();
    });
    ws.on('error', (err) => {
      console.warn('[kick] ws error:', (err as Error).message);
      ws?.close();
    });
  };

  const scheduleReconnect = () => {
    if (closed || reconnectTimer) return;
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      void connect();
    }, 4000);
  };

  void connect();

  return () => {
    closed = true;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    ws?.close();
  };
}
