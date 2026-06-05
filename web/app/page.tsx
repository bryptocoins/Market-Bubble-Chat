'use client';

// Setup app — the thing a streamer opens. Connect channels → pick overlay modes
// → see a live preview → copy the overlay URL to paste into their stream program.

import { useEffect, useMemo, useState } from 'react';
import { useFeedStore, useFeedConnection, CONFIG_HTTP_URL } from '@/lib/useFeed';
import type { AppConfig, Platform } from '@/lib/types';
import { PlatformLogo } from '@/components/PlatformLogo';
import { ChannelTags } from '@/components/ChannelTags';
import { Logo } from '@/components/Logo';

const PLATFORM_META: Record<Platform, { label: string; placeholder: string }> = {
  twitch: { label: 'Twitch', placeholder: 'channel name, e.g. ansem' },
  kick: { label: 'Kick', placeholder: 'channel slug, e.g. xqc' },
  x: { label: 'X', placeholder: '@handle, $CASHTAG, or broadcast URL' },
};

export default function Setup() {
  useFeedConnection();
  const connected = useFeedStore((s) => s.connected);
  const statuses = useFeedStore((s) => s.statuses);
  const counts = useFeedStore((s) => s.counts);
  const cfg = useFeedStore((s) => s.config);

  // Channel + owner-key state.
  const [ownerKey, setOwnerKey] = useState('');
  const [channels, setChannels] = useState<Record<Platform, string>>({ twitch: '', kick: '', x: '' });
  const [loaded, setLoaded] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [saving, setSaving] = useState(false);

  // Overlay look modes.
  const [color, setColor] = useState(false);
  const [pos, setPos] = useState<'bottom' | 'top'>('bottom');
  const [max, setMax] = useState(12);
  const [fadeSec, setFadeSec] = useState(8);
  const [greenScreen, setGreenScreen] = useState(false);
  const [copied, setCopied] = useState(false);

  // Local mode: running on the streamer's own machine. Same-machine writes are
  // trusted by the server, so there's no owner-key friction. (Set after mount.)
  const [isLocal, setIsLocal] = useState(false);
  useEffect(() => {
    const h = window.location.hostname;
    setIsLocal(h === 'localhost' || h === '127.0.0.1' || h === '[::1]');
  }, []);

  // Load current config once.
  useEffect(() => {
    setOwnerKey(localStorage.getItem('mb_owner_key') || '');
    // Instant pre-fill from the last channels you used (survives anything server-side).
    try {
      const cached = localStorage.getItem('mb_channels');
      if (cached) setChannels(JSON.parse(cached));
    } catch {
      /* ignore */
    }
    fetch(CONFIG_HTTP_URL)
      .then((r) => r.json())
      .then((c: AppConfig) => {
        const srv = {
          twitch: (c.channels?.twitch || []).join(', '),
          kick: (c.channels?.kick || []).join(', '),
          x: (c.channels?.x || []).join(', '),
        };
        // Server wins when it has channels; otherwise keep the cached ones.
        if (srv.twitch || srv.kick || srv.x) setChannels(srv);
        setColor(c.display?.colorMode ?? false);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  // Resolve origin after mount so SSR + client markup match (no hydration warning).
  const [origin, setOrigin] = useState('');
  useEffect(() => setOrigin(window.location.origin), []);

  // Relative path drives the iframe (same on server + client); the full URL
  // (with origin) is what the streamer copies into their stream software.
  const overlayPath = useMemo(() => {
    const p = new URLSearchParams();
    p.set('pos', pos);
    p.set('max', String(max));
    p.set('fade', String(fadeSec * 1000));
    p.set('color', color ? '1' : '0');
    if (greenScreen) p.set('bg', '#00FF00');
    return `/overlay?${p.toString()}`;
  }, [pos, max, fadeSec, color, greenScreen]);
  const overlayUrl = `${origin}${overlayPath}`;

  const parseList = (s: string) =>
    s.split(',').map((x) => x.trim().replace(/^[#@]/, '')).filter(Boolean);

  const connect = async () => {
    setSaving(true);
    setSaveMsg('');
    localStorage.setItem('mb_owner_key', ownerKey);
    localStorage.setItem('mb_channels', JSON.stringify(channels));
    const next: AppConfig = {
      filter: cfg?.filter ?? { hideEmojiOnly: false, maskChar: '*', defaultSlurListEnabled: true, rules: [] },
      channels: { twitch: parseList(channels.twitch), kick: parseList(channels.kick), x: parseList(channels.x) },
      display: {
        backdrop: cfg?.display?.backdrop ?? '',
        backdropOpacity: cfg?.display?.backdropOpacity ?? 0.5,
        colorMode: color,
      },
    };
    try {
      const res = await fetch(CONFIG_HTTP_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Owner-Key': ownerKey },
        body: JSON.stringify(next),
      });
      if (res.status === 401) setSaveMsg('✗ wrong owner key');
      else if (!res.ok) setSaveMsg('✗ save failed');
      else setSaveMsg('✓ connected — chats are merging');
    } catch {
      setSaveMsg('✗ can’t reach server');
    } finally {
      setSaving(false);
    }
  };

  // Color mode toggling also pushes live (local writes need no key; the preview
  // also reflects it instantly via the URL param regardless).
  const setColorLive = (v: boolean) => {
    setColor(v);
    if (cfg && (isLocal || ownerKey)) {
      fetch(CONFIG_HTTP_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Owner-Key': ownerKey },
        body: JSON.stringify({ ...cfg, display: { colorMode: v } }),
      }).catch(() => {});
    }
  };

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(overlayUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked — user can select manually */
    }
  };

  return (
    <main className="obsidian-bg min-h-screen">
      <div className="max-w-5xl mx-auto px-5 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Logo size={40} />
            <div>
              <div className="font-bold text-gold text-2xl leading-none tracking-tight">MARKET BUBBLE</div>
              <div className="text-[11px] text-obsidian-500 tracking-widest">CHAT · UNIFIED OVERLAY</div>
            </div>
            <div className="h-7 w-px bg-obsidian-600 ml-1" />
            <ChannelTags />
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span
              className="flex items-center gap-1.5 px-2 py-1 rounded-lg border border-obsidian-500"
              style={{ background: 'rgba(18,16,14,0.7)' }}
            >
              <span className="w-2 h-2 rounded-full" style={{ background: connected ? '#2ecc71' : '#ff5252' }} />
              {connected ? 'live' : 'connecting…'}
            </span>
            <a href="/chat" className="px-2.5 py-1 rounded-lg border border-obsidian-500 text-obsidian-500 hover:text-gold hover:border-gold/50">
              all chat
            </a>
            <a href="/dashboard" className="px-2.5 py-1 rounded-lg border border-obsidian-500 text-obsidian-500 hover:text-gold hover:border-gold/50">
              mod dashboard
            </a>
            <a href="/settings" className="px-2.5 py-1 rounded-lg border border-obsidian-500 text-obsidian-500 hover:text-gold hover:border-gold/50">
              advanced filters
            </a>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-5">
          {/* LEFT: controls */}
          <div className="space-y-5">
            {/* Step 1 — channels */}
            <Card step="1" title="Connect your channels">
              <p className="text-xs text-obsidian-500 mb-3">
                Add the channels whose chats you want merged. No logins — we read them for you.
              </p>
              {(['twitch', 'kick', 'x'] as Platform[]).map((p) => (
                <div key={p} className="flex items-center gap-2 mb-2">
                  <PlatformLogo platform={p} size={22} />
                  <input
                    value={channels[p]}
                    onChange={(e) => setChannels({ ...channels, [p]: e.target.value })}
                    placeholder={PLATFORM_META[p].placeholder}
                    className="flex-1 px-3 py-2 rounded-lg bg-obsidian-700 border border-obsidian-500 outline-none focus:border-gold/60 text-sm"
                  />
                  <StatusDot state={statuses[p]} n={counts[p]} />
                </div>
              ))}
              {statuses.x === 'reconnecting' && channels.x.trim() && (
                <p className="mt-1 text-[11px] flex items-center gap-1.5" style={{ color: '#E7E9EA' }}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#e9e9e6' }} />
                  An X window opened — <b>sign in to X there</b> to start its chat (one time; it’s remembered).
                </p>
              )}
              <div className="mt-3 flex items-center gap-2">
                {!isLocal && (
                  <input
                    type="password"
                    value={ownerKey}
                    onChange={(e) => setOwnerKey(e.target.value)}
                    placeholder="owner key"
                    className="w-40 px-3 py-2 rounded-lg bg-obsidian-700 border border-obsidian-500 outline-none focus:border-gold/60 text-sm"
                  />
                )}
                <button
                  onClick={connect}
                  disabled={saving || !loaded}
                  className="px-4 py-2 rounded-lg font-bold bg-gold text-obsidian-900 hover:bg-gold-soft disabled:opacity-50 text-sm"
                >
                  {saving ? 'connecting…' : 'Connect'}
                </button>
                {saveMsg && <span className="text-xs">{saveMsg}</span>}
              </div>
              {isLocal && (
                <p className="mt-2 text-[11px] text-obsidian-500">
                  🖥️ Running on this PC — no key needed. (A key is only required if you host &
                  share this over the internet.)
                </p>
              )}
            </Card>

            {/* Step 2 — modes */}
            <Card step="2" title="Choose your look">
              <Mode label="Style">
                <Segmented
                  value={color ? 'color' : 'clean'}
                  options={[
                    { v: 'clean', label: 'Clean' },
                    { v: 'color', label: 'Color' },
                  ]}
                  onChange={(v) => setColorLive(v === 'color')}
                />
              </Mode>
              <Mode label="Position">
                <Segmented
                  value={pos}
                  options={[
                    { v: 'bottom', label: 'Bottom' },
                    { v: 'top', label: 'Top' },
                  ]}
                  onChange={(v) => setPos(v as 'bottom' | 'top')}
                />
              </Mode>
              <Mode label={`Density · ${max} msgs`}>
                <input type="range" min={5} max={25} value={max} onChange={(e) => setMax(Number(e.target.value))} className="w-full accent-gold" />
              </Mode>
              <Mode label={`Fade · ${fadeSec}s`}>
                <input type="range" min={3} max={20} value={fadeSec} onChange={(e) => setFadeSec(Number(e.target.value))} className="w-full accent-gold" />
              </Mode>
              <label className="flex items-center gap-2 mt-1 cursor-pointer">
                <input type="checkbox" checked={greenScreen} onChange={(e) => setGreenScreen(e.target.checked)} className="accent-gold w-4 h-4" />
                <span className="text-sm text-[#eaeaea]">Green-screen background</span>
                <span className="text-[11px] text-obsidian-500">(for software without a transparent browser source)</span>
              </label>
            </Card>
          </div>

          {/* RIGHT: preview + URL */}
          <div className="space-y-5">
            <Card step="3" title="Live preview">
              <p className="text-xs text-obsidian-500 mb-3">Exactly what your stream program will show.</p>
              <div
                className="relative rounded-xl overflow-hidden border border-obsidian-600 aspect-video"
                style={{
                  background: greenScreen
                    ? '#00FF00'
                    : 'linear-gradient(135deg,#1b2735 0%,#2c1a3a 55%,#3a1a24 100%)',
                }}
              >
                {!greenScreen && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <span className="text-white/15 text-sm tracking-widest">YOUR STREAM</span>
                  </div>
                )}
                <iframe
                  key={overlayPath}
                  src={overlayPath}
                  title="overlay preview"
                  className="absolute inset-0 w-full h-full"
                  style={{ background: 'transparent', border: 'none' }}
                />
              </div>
              <div className="mt-2 flex items-center justify-between text-[11px] text-obsidian-500">
                <span>
                  up to <b className="text-gold-soft">{max}</b> messages · fade{' '}
                  <b className="text-gold-soft">{fadeSec}s</b> · {pos} · {color ? 'color' : 'clean'}
                </span>
                <span className="text-obsidian-500/80">fade shows when chat is calm</span>
              </div>
            </Card>

            <Card step="4" title="Your overlay URL">
              <p className="text-xs text-obsidian-500 mb-2">
                Add a <b className="text-gold-soft">Browser Source</b> in OBS / Streamlabs / vMix / XSplit and paste this:
              </p>
              <div className="flex gap-2">
                <input
                  readOnly
                  suppressHydrationWarning
                  value={overlayUrl}
                  onFocus={(e) => e.currentTarget.select()}
                  className="flex-1 px-3 py-2 rounded-lg bg-obsidian-900 border border-obsidian-500 text-xs text-gold-soft outline-none"
                />
                <button
                  onClick={copyUrl}
                  className="px-4 py-2 rounded-lg font-bold bg-gold text-obsidian-900 hover:bg-gold-soft text-sm whitespace-nowrap"
                >
                  {copied ? '✓ copied' : 'Copy'}
                </button>
              </div>
              <ol className="mt-3 text-xs text-obsidian-500 space-y-1 list-decimal list-inside">
                <li>In your stream software, add a <b className="text-[#eaeaea]">Browser Source</b>.</li>
                <li>Paste the URL. Set size to your canvas (e.g. 1920×1080).</li>
                <li>Done — chats appear over your stream, transparent.</li>
              </ol>
              {isLocal && (
                <p className="mt-3 text-[11px] text-obsidian-500 border-t border-obsidian-600 pt-2">
                  ✅ This <b className="text-gold-soft">localhost</b> URL works as-is when OBS runs on
                  this same PC — nothing to host. Co-streaming from different locations? You’d host
                  the feed and share a public URL instead.
                </p>
              )}
            </Card>
          </div>
        </div>
      </div>
    </main>
  );
}

function Card({ step, title, children }: { step: string; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-obsidian-600 bg-obsidian-800/60 p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="w-6 h-6 rounded-full bg-gold/15 border border-gold/40 text-gold-soft text-xs font-bold flex items-center justify-center">
          {step}
        </span>
        <h2 className="text-sm font-bold text-gold-soft uppercase tracking-wide">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Mode({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <div className="text-xs text-obsidian-500 mb-1">{label}</div>
      {children}
    </div>
  );
}

function Segmented({
  value,
  options,
  onChange,
}: {
  value: string;
  options: { v: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="inline-flex rounded-lg border border-obsidian-500 overflow-hidden">
      {options.map((o) => (
        <button
          key={o.v}
          onClick={() => onChange(o.v)}
          className="px-4 py-1.5 text-sm font-semibold transition-colors"
          style={
            value === o.v
              ? { background: '#e9e9e6', color: '#0a0a0b' }
              : { background: 'transparent', color: '#8a8a8e' }
          }
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function StatusDot({ state, n }: { state: string; n: number }) {
  const c = state === 'up' ? '#2ecc71' : state === 'reconnecting' ? '#e9e9e6' : '#5a5a5e';
  return (
    <span className="flex items-center gap-1 text-[11px] text-obsidian-500 w-12 shrink-0" title={state}>
      <span className="w-2 h-2 rounded-full" style={{ background: c }} />
      <span className="tabular-nums">{n}</span>
    </span>
  );
}
