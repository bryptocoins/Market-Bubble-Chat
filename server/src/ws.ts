// WS fan-out + lightweight HTTP config API. The frontend (dashboard + overlay +
// settings) connects to one WS. Owner config writes come over HTTP (gated by
// OWNER_KEY) and are pushed live to every connected client.

import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import type { ChatMessage, ServerEvent, AppConfig, Platform } from './types.js';
import { RingBuffer } from './buffer.js';
import { ConfigStore, OWNER_KEY } from './config.js';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Owner-Key',
};

function json(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json', ...CORS });
  res.end(JSON.stringify(body));
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  return Buffer.concat(chunks).toString('utf8');
}

// Requests from the same machine (the streamer's own PC) are trusted — no owner
// key needed. The key only gates writes that arrive over the network (a hosted /
// shared deployment). This makes the common "run it locally" path frictionless.
function isLocalRequest(req: IncomingMessage): boolean {
  const addr = req.socket.remoteAddress || '';
  return addr === '127.0.0.1' || addr === '::1' || addr === '::ffff:127.0.0.1';
}

// Authorize a config/inject write: allowed if local, or if the key matches.
function isAuthorized(req: IncomingMessage): boolean {
  if (isLocalRequest(req)) return true;
  return req.headers['x-owner-key'] === OWNER_KEY;
}

export class FanOut {
  private wss: WebSocketServer;
  private clients = new Set<WebSocket>();
  public readonly statuses: Record<Platform, ServerEvent & { type: 'status' }> = {
    twitch: { type: 'status', platform: 'twitch', state: 'down' },
    kick: { type: 'status', platform: 'kick', state: 'down' },
    x: { type: 'status', platform: 'x', state: 'down' },
  };

  // Optional handler for owner-injected test messages (demo/QA aid).
  public onInject: ((raw: { platform?: string; username?: string; text?: string }) => void) | null =
    null;

  constructor(
    private readonly buffer: RingBuffer,
    private readonly store: ConfigStore,
    private readonly port: number,
  ) {
    const httpServer = createServer((req, res) => this.handleHttp(req, res));
    this.wss = new WebSocketServer({ server: httpServer });

    this.wss.on('connection', (ws) => {
      this.clients.add(ws);
      const hello: ServerEvent = {
        type: 'hello',
        buffer: this.buffer.snapshot(),
        config: this.store.get(),
      };
      ws.send(JSON.stringify(hello));
      // Replay current platform statuses to the new client.
      for (const s of Object.values(this.statuses)) ws.send(JSON.stringify(s));
      ws.on('close', () => this.clients.delete(ws));
      ws.on('error', () => this.clients.delete(ws));
    });

    // Push config changes live.
    this.store.on('change', (cfg: AppConfig) => {
      this.broadcast({ type: 'config', config: cfg });
    });

    httpServer.listen(this.port, () => {
      console.log(`[ws] fan-out + config API listening on :${this.port}`);
    });
  }

  broadcast(event: ServerEvent): void {
    const payload = JSON.stringify(event);
    for (const ws of this.clients) {
      if (ws.readyState === WebSocket.OPEN) ws.send(payload);
    }
  }

  emitMessage(msg: ChatMessage): void {
    this.broadcast({ type: 'message', message: msg });
  }

  emitStatus(platform: Platform, state: 'up' | 'down' | 'reconnecting', channel?: string): void {
    this.statuses[platform] = { type: 'status', platform, state, channel };
    this.broadcast(this.statuses[platform]);
  }

  get clientCount(): number {
    return this.clients.size;
  }

  private async handleHttp(req: IncomingMessage, res: ServerResponse): Promise<void> {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, CORS);
      res.end();
      return;
    }
    const url = new URL(req.url || '/', `http://localhost:${this.port}`);

    if (url.pathname === '/health') {
      json(res, 200, { ok: true, clients: this.clientCount, buffer: this.buffer.size });
      return;
    }

    if (url.pathname === '/config' && req.method === 'GET') {
      json(res, 200, this.store.get());
      return;
    }

    if (url.pathname === '/config' && req.method === 'POST') {
      if (!isAuthorized(req)) {
        json(res, 401, { error: 'invalid owner key' });
        return;
      }
      try {
        const body = JSON.parse(await readBody(req)) as AppConfig;
        const next = this.store.update(body);
        json(res, 200, next);
      } catch (err) {
        json(res, 400, { error: 'invalid config', detail: String(err) });
      }
      return;
    }

    // Owner-gated test injection — pushes a synthetic message through the full
    // pipeline (filter → enrich → buffer → fan-out). Handy for QA + seeding a
    // deterministic demo (e.g. guarantee a $BTC cashtag pill on cue).
    if (url.pathname === '/inject' && req.method === 'POST') {
      if (!isAuthorized(req)) {
        json(res, 401, { error: 'invalid owner key' });
        return;
      }
      if (!this.onInject) {
        json(res, 503, { error: 'inject not wired' });
        return;
      }
      try {
        const body = JSON.parse(await readBody(req));
        this.onInject(body);
        json(res, 200, { ok: true });
      } catch (err) {
        json(res, 400, { error: 'invalid body', detail: String(err) });
      }
      return;
    }

    json(res, 404, { error: 'not found' });
  }
}
