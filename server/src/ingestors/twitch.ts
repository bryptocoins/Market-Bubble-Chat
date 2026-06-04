// Twitch ingestor — anonymous read via IRC-over-WebSocket. No auth required.

import { WebSocket } from 'ws';
import type { ChatMessage, Emote } from '../types.js';

const IRC_URL = 'wss://irc-ws.chat.twitch.tv:443';

type Emit = (msg: ChatMessage) => void;
type Status = (state: 'up' | 'down' | 'reconnecting', channel?: string) => void;

// Parse IRCv3 @tags into a map.
function parseTags(raw: string): Record<string, string> {
  const tags: Record<string, string> = {};
  for (const part of raw.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    tags[part.slice(0, eq)] = part.slice(eq + 1);
  }
  return tags;
}

// Twitch emotes tag: "id:start-end,start-end/id2:start-end"
function parseEmotes(tag: string | undefined, text: string): Emote[] {
  if (!tag) return [];
  const emotes: Emote[] = [];
  const chars = [...text]; // codepoint-safe slicing for emote names
  for (const group of tag.split('/')) {
    const [id, positions] = group.split(':');
    if (!positions) continue;
    for (const range of positions.split(',')) {
      const [s, e] = range.split('-').map(Number);
      if (Number.isNaN(s) || Number.isNaN(e)) continue;
      emotes.push({ id, name: chars.slice(s, e + 1).join(''), start: s, end: e });
    }
  }
  return emotes;
}

function parseBadges(tag: string | undefined): string[] {
  if (!tag) return [];
  return tag
    .split(',')
    .map((b) => b.split('/')[0])
    .filter(Boolean);
}

export function startTwitch(channels: string[], emit: Emit, status: Status): () => void {
  if (channels.length === 0) {
    status('down');
    return () => {};
  }

  let ws: WebSocket | null = null;
  let closed = false;
  let reconnectTimer: NodeJS.Timeout | null = null;

  const connect = () => {
    if (closed) return;
    status('reconnecting');
    ws = new WebSocket(IRC_URL);

    ws.on('open', () => {
      if (!ws) return;
      ws.send('PASS SCHMOOPIIE');
      ws.send(`NICK justinfan${Math.floor(10000 + Math.random() * 89999)}`);
      ws.send('CAP REQ :twitch.tv/tags twitch.tv/commands');
      for (const ch of channels) ws.send(`JOIN #${ch.toLowerCase()}`);
      status('up', channels.join(','));
    });

    ws.on('message', (data) => {
      const raw = data.toString();
      for (const line of raw.split('\r\n')) {
        if (!line) continue;

        if (line.startsWith('PING')) {
          ws?.send('PONG :tmi.twitch.tv');
          continue;
        }

        // <@tags> :<prefix> PRIVMSG #channel :<message>
        let rest = line;
        let tags: Record<string, string> = {};
        if (rest.startsWith('@')) {
          const sp = rest.indexOf(' ');
          tags = parseTags(rest.slice(1, sp));
          rest = rest.slice(sp + 1);
        }
        if (!rest.startsWith(':')) continue;
        const sp2 = rest.indexOf(' ');
        const prefix = rest.slice(1, sp2);
        rest = rest.slice(sp2 + 1);

        if (!rest.startsWith('PRIVMSG')) continue;
        const hashIdx = rest.indexOf('#');
        const colonIdx = rest.indexOf(' :', hashIdx);
        if (hashIdx === -1 || colonIdx === -1) continue;
        const channel = rest.slice(hashIdx + 1, colonIdx).trim();
        const text = rest.slice(colonIdx + 2);

        const username = tags['display-name'] || prefix.split('!')[0];
        emit({
          id: tags['id'] || `twitch-${channel}-${tags['tmi-sent-ts'] || Date.now()}-${username}`,
          platform: 'twitch',
          username,
          color: tags['color'] || null,
          badges: parseBadges(tags['badges']),
          text,
          emotes: parseEmotes(tags['emotes'], text),
          ts: tags['tmi-sent-ts'] ? Number(tags['tmi-sent-ts']) : Date.now(),
          channel,
        });
      }
    });

    ws.on('close', () => {
      status('down');
      scheduleReconnect();
    });
    ws.on('error', (err) => {
      console.warn('[twitch] ws error:', (err as Error).message);
      ws?.close();
    });
  };

  const scheduleReconnect = () => {
    if (closed || reconnectTimer) return;
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connect();
    }, 3000);
  };

  connect();

  return () => {
    closed = true;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    ws?.close();
  };
}
