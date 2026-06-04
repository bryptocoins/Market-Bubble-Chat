// Markets-native enrichment: cashtag price pills, polymarket auto-link,
// sentiment tint, and a cross-platform hype meter.

import type { ChatMessage, Cashtag, Sentiment, Platform } from './types.js';

const CASHTAG_RE = /\$([A-Za-z]{1,6})\b/g;

// ---- Price lookup -------------------------------------------------------
// Crypto via Binance public ticker (free, no key). Cached briefly to avoid
// hammering the endpoint while chat floods in.

interface Quote {
  price: number;
  change: number; // percent
}

const quoteCache = new Map<string, { quote: Quote | null; at: number }>();
const QUOTE_TTL = 20_000;

// Common crypto cashtags → CoinGecko ids (primary) and Binance.US pairs (fallback).
const COINGECKO_IDS: Record<string, string> = {
  BTC: 'bitcoin', ETH: 'ethereum', SOL: 'solana', DOGE: 'dogecoin', XRP: 'ripple',
  BNB: 'binancecoin', ADA: 'cardano', AVAX: 'avalanche-2', LINK: 'chainlink', MATIC: 'matic-network',
  PEPE: 'pepe', SHIB: 'shiba-inu', WIF: 'dogwifcoin', BONK: 'bonk', SUI: 'sui',
  TRUMP: 'official-trump', TON: 'the-open-network', LTC: 'litecoin', NEAR: 'near', APT: 'aptos',
  USDC: 'usd-coin', USDT: 'tether', HYPE: 'hyperliquid', FART: 'fartcoin', POPCAT: 'popcat',
};

const BINANCE_PAIRS: Record<string, string> = {
  BTC: 'BTCUSDT', ETH: 'ETHUSDT', SOL: 'SOLUSDT', DOGE: 'DOGEUSDT', XRP: 'XRPUSDT',
  BNB: 'BNBUSDT', ADA: 'ADAUSDT', AVAX: 'AVAXUSDT', LINK: 'LINKUSDT', LTC: 'LTCUSDT',
  PEPE: 'PEPEUSDT', SHIB: 'SHIBUSDT', SUI: 'SUIUSDT', NEAR: 'NEARUSDT', APT: 'APTUSDT',
};

// CoinGecko: works globally, free, includes 24h change. Primary source.
async function coingeckoQuote(id: string): Promise<Quote | null> {
  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd&include_24hr_change=true`,
      { signal: AbortSignal.timeout(4000), headers: { accept: 'application/json' } },
    );
    if (!res.ok) return null;
    const j = (await res.json()) as Record<string, { usd?: number; usd_24h_change?: number }>;
    const row = j[id];
    if (!row || typeof row.usd !== 'number') return null;
    return { price: row.usd, change: row.usd_24h_change ?? 0 };
  } catch {
    return null;
  }
}

// Binance.US fallback (binance.com is geo-restricted in some regions).
async function binanceQuote(pair: string): Promise<Quote | null> {
  try {
    const res = await fetch(`https://api.binance.us/api/v3/ticker/24hr?symbol=${pair}`, {
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    const j = (await res.json()) as { lastPrice?: string; priceChangePercent?: string };
    if (!j.lastPrice) return null;
    return { price: parseFloat(j.lastPrice), change: parseFloat(j.priceChangePercent || '0') };
  } catch {
    return null;
  }
}

async function lookupQuote(symbol: string): Promise<Quote | null> {
  const key = symbol.toUpperCase();
  const cached = quoteCache.get(key);
  const now = Date.now();
  if (cached && now - cached.at < QUOTE_TTL) return cached.quote;

  let quote: Quote | null = null;
  const id = COINGECKO_IDS[key];
  if (id) quote = await coingeckoQuote(id);
  if (!quote && BINANCE_PAIRS[key]) quote = await binanceQuote(BINANCE_PAIRS[key]);
  // (Equities could be added here via a free quote API; left best-effort.)

  quoteCache.set(key, { quote, at: now });
  return quote;
}

export function extractCashtags(text: string): string[] {
  const out = new Set<string>();
  let m: RegExpExecArray | null;
  CASHTAG_RE.lastIndex = 0;
  while ((m = CASHTAG_RE.exec(text)) !== null) {
    out.add(m[1].toUpperCase());
  }
  return [...out];
}

// ---- Sentiment ----------------------------------------------------------

const BULL = ['moon', 'pump', 'bull', 'long', 'buy', 'send', 'lfg', 'green', 'up', 'rip', 'breakout', 'ath', 'wagmi', 'gm', 'rocket', '🚀', '📈', '🟢'];
const BEAR = ['dump', 'bear', 'short', 'sell', 'rug', 'rekt', 'red', 'down', 'crash', 'fud', 'ngmi', 'liquidated', 'rekt', 'capitulate', '📉', '🔴', '💀'];

export function scoreSentiment(text: string): Sentiment {
  const t = text.toLowerCase();
  let score = 0;
  for (const w of BULL) if (t.includes(w)) score += 1;
  for (const w of BEAR) if (t.includes(w)) score -= 1;
  if (score > 0) return 'bull';
  if (score < 0) return 'bear';
  return 'neutral';
}

// ---- Per-message enrichment --------------------------------------------

export async function enrich(msg: ChatMessage): Promise<ChatMessage> {
  msg.sentiment = scoreSentiment(msg.text);

  const symbols = extractCashtags(msg.text);
  if (symbols.length) {
    const cashtags: Cashtag[] = await Promise.all(
      symbols.slice(0, 4).map(async (symbol) => {
        const q = await lookupQuote(symbol);
        return q ? { symbol, price: q.price, change: q.change } : { symbol };
      }),
    );
    msg.cashtags = cashtags;
  }
  return msg;
}

// ---- Hype meter ---------------------------------------------------------
// Rolling msgs/sec across all platforms with spike detection.

export class HypeMeter {
  private events: { ts: number; platform: Platform }[] = [];
  private baseline = 0;

  constructor(
    private readonly windowMs = 5000,
    private readonly spikeFactor = 2.5,
  ) {}

  record(platform: Platform, ts: number): void {
    this.events.push({ ts, platform });
  }

  // Compute the current window rate + spike status. Call on an interval.
  sample(now: number): { rate: number; spike: boolean; leader: Platform | null; leaderPct: number } {
    const cutoff = now - this.windowMs;
    this.events = this.events.filter((e) => e.ts >= cutoff - this.windowMs); // keep 2 windows

    const cur = this.events.filter((e) => e.ts >= cutoff);
    const prev = this.events.filter((e) => e.ts < cutoff);

    const rate = cur.length / (this.windowMs / 1000);

    // Trailing baseline (exponential-ish) from the previous window.
    const prevRate = prev.length / (this.windowMs / 1000);
    this.baseline = this.baseline === 0 ? prevRate : this.baseline * 0.7 + prevRate * 0.3;

    const spike = this.baseline > 0.2 && rate > this.baseline * this.spikeFactor;

    // Leading platform in the current window + its growth vs previous window.
    const counts: Record<Platform, number> = { twitch: 0, kick: 0, x: 0 };
    for (const e of cur) counts[e.platform]++;
    let leader: Platform | null = null;
    let max = 0;
    (Object.keys(counts) as Platform[]).forEach((p) => {
      if (counts[p] > max) {
        max = counts[p];
        leader = p;
      }
    });

    let leaderPct = 0;
    if (leader) {
      const prevCount = prev.filter((e) => e.platform === leader).length || 1;
      leaderPct = Math.round(((counts[leader] - prevCount) / prevCount) * 100);
    }

    return { rate: Math.round(rate * 10) / 10, spike, leader, leaderPct };
  }
}
