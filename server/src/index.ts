// Boot: start ingestors + WS fan-out + config API. Wires the pipeline:
// ingest → normalize → filter → enrich → ring buffer → WS fan-out.

import type { ChatMessage, AppConfig } from './types.js';
import { RingBuffer } from './buffer.js';
import { ConfigStore } from './config.js';
import { FanOut } from './ws.js';
import { applyFilter } from './filter.js';
import { enrich, HypeMeter } from './enrich.js';
import { startTwitch } from './ingestors/twitch.js';
import { startKick } from './ingestors/kick.js';
import { startX } from './ingestors/x.js';

const PORT = Number(process.env.PORT || 4000);

const buffer = new RingBuffer(500);
const store = new ConfigStore();
const fan = new FanOut(buffer, store, PORT);
const hype = new HypeMeter(5000, 2.5);

// Pipeline entry: every ingestor calls this with a normalized-ish ChatMessage.
async function ingest(msg: ChatMessage): Promise<void> {
  const cfg = store.get();

  // Filter (drops or masks). Runs before enrichment so we never spend a quote
  // lookup on a message that gets removed.
  const filtered = applyFilter(msg, cfg.filter);
  if (!filtered) return;

  // Hype is measured on raw arrival rate (pre-dedup is fine; ids are unique).
  hype.record(filtered.platform, filtered.ts);

  // Enrich (cashtags / sentiment).
  const enriched = await enrich(filtered);

  // Dedup + buffer, then fan out.
  if (buffer.add(enriched)) {
    fan.emitMessage(enriched);
  }
}

// Owner test injection → run through the same pipeline as real messages.
fan.onInject = (raw) => {
  const platform = (['twitch', 'kick', 'x'].includes(raw.platform as string)
    ? raw.platform
    : 'twitch') as ChatMessage['platform'];
  void ingest({
    id: `inject-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    platform,
    username: raw.username || 'demo',
    color: null,
    badges: [],
    text: raw.text || '',
    emotes: [],
    ts: Date.now(),
    channel: 'inject',
  }).catch((e) => console.warn('[inject]', e));
};

// ---- Start ingestors from config ---------------------------------------

let stopFns: Array<() => void> = [];

function startIngestors(cfg: AppConfig): void {
  for (const stop of stopFns) stop();
  stopFns = [];

  const onMsg = (m: ChatMessage) => void ingest(m).catch((e) => console.warn('[ingest]', e));
  stopFns.push(
    startTwitch(cfg.channels.twitch, onMsg, (s, ch) => fan.emitStatus('twitch', s, ch)),
    startKick(cfg.channels.kick, onMsg, (s, ch) => fan.emitStatus('kick', s, ch)),
    startX(cfg.channels.x, onMsg, (s, ch) => fan.emitStatus('x', s, ch)),
  );

  console.log('[boot] ingestors started:', {
    twitch: cfg.channels.twitch,
    kick: cfg.channels.kick,
    x: cfg.channels.x,
  });
}

startIngestors(store.get());

// Restart ingestors when tracked channels change (owner panel edit).
let lastChannels = JSON.stringify(store.get().channels);
store.on('change', (cfg: AppConfig) => {
  const next = JSON.stringify(cfg.channels);
  if (next !== lastChannels) {
    lastChannels = next;
    console.log('[boot] channels changed — restarting ingestors');
    startIngestors(cfg);
  }
});

// ---- Hype sampling loop -------------------------------------------------

setInterval(() => {
  const sample = hype.sample(Date.now());
  fan.broadcast({
    type: 'hype',
    rate: sample.rate,
    spike: sample.spike,
    leader: sample.leader,
    leaderPct: sample.leaderPct,
  });
}, 1000);

console.log(`[boot] MBChat aggregator up. WS + config API on :${PORT}`);
