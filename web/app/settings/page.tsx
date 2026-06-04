'use client';

import { useEffect, useState } from 'react';
import { CONFIG_HTTP_URL } from '@/lib/useFeed';
import type { AppConfig, FilterAction, Platform, WordRule } from '@/lib/types';

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

export default function Settings() {
  const [ownerKey, setOwnerKey] = useState('');
  const [cfg, setCfg] = useState<AppConfig | null>(null);
  const [status, setStatus] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [isLocal, setIsLocal] = useState(false);

  useEffect(() => {
    const h = window.location.hostname;
    setIsLocal(h === 'localhost' || h === '127.0.0.1' || h === '[::1]');
    setOwnerKey(localStorage.getItem('mb_owner_key') || '');
    fetch(CONFIG_HTTP_URL)
      .then((r) => r.json())
      .then(setCfg)
      .catch(() => setStatus('could not load config — is the server running?'));
  }, []);

  if (!cfg) {
    return (
      <main className="obsidian-bg min-h-screen flex items-center justify-center text-obsidian-500">
        {status || 'loading…'}
      </main>
    );
  }

  const save = async () => {
    setSaving(true);
    setStatus('');
    localStorage.setItem('mb_owner_key', ownerKey);
    try {
      const res = await fetch(CONFIG_HTTP_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Owner-Key': ownerKey },
        body: JSON.stringify(cfg),
      });
      if (res.status === 401) setStatus('✗ invalid owner key');
      else if (!res.ok) setStatus('✗ save failed');
      else setStatus('✓ saved & pushed live');
    } catch {
      setStatus('✗ network error');
    } finally {
      setSaving(false);
    }
  };

  const setFilter = (patch: Partial<AppConfig['filter']>) =>
    setCfg({ ...cfg, filter: { ...cfg.filter, ...patch } });

  const setDisplay = (patch: Partial<AppConfig['display']>) =>
    setCfg({ ...cfg, display: { ...cfg.display, ...patch } });

  // Read an uploaded backdrop into a data URL (kept small — it's stored in config
  // and pushed to every client).
  const onBackdropFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3_000_000) {
      setStatus('✗ image too large (max ~3MB) — use a URL instead');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setDisplay({ backdrop: String(reader.result || '') });
    reader.readAsDataURL(file);
  };

  const updateRule = (id: string, patch: Partial<WordRule>) =>
    setFilter({ rules: cfg.filter.rules.map((r) => (r.id === id ? { ...r, ...patch } : r)) });

  const addRule = () =>
    setFilter({
      rules: [...cfg.filter.rules, { id: uid(), word: '', enabled: true, action: 'mask', normalize: true }],
    });

  const removeRule = (id: string) =>
    setFilter({ rules: cfg.filter.rules.filter((r) => r.id !== id) });

  const setChannels = (p: Platform, raw: string) =>
    setCfg({
      ...cfg,
      channels: {
        ...cfg.channels,
        [p]: raw.split(',').map((s) => s.trim().replace(/^[#@]/, '')).filter(Boolean),
      },
    });

  return (
    <main className="obsidian-bg min-h-screen p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gold">Owner Panel</h1>
            <p className="text-xs text-obsidian-500">Changes persist + push live to dashboard & overlay.</p>
          </div>
          <a href="/" className="text-xs text-obsidian-500 hover:text-gold">← setup</a>
        </div>

        {/* Owner key — only needed when accessed over a network (hosted/shared). */}
        {!isLocal && (
          <Section title="Authentication">
            <label className="block text-xs text-obsidian-500 mb-1">OWNER_KEY</label>
            <input
              type="password"
              value={ownerKey}
              onChange={(e) => setOwnerKey(e.target.value)}
              placeholder="owner key"
              className="w-full px-3 py-2 rounded-lg bg-obsidian-700 border border-obsidian-500 outline-none focus:border-gold/60 text-sm"
            />
          </Section>
        )}

        {/* Channels */}
        <Section title="Tracked Channels">
          {(['twitch', 'kick', 'x'] as Platform[]).map((p) => (
            <div key={p} className="mb-3">
              <label className="block text-xs uppercase tracking-wide mb-1" style={{ color: p === 'x' ? '#E7E9EA' : p === 'kick' ? '#53FC18' : '#9146FF' }}>
                {p}
              </label>
              <input
                value={cfg.channels[p].join(', ')}
                onChange={(e) => setChannels(p, e.target.value)}
                placeholder={p === 'x' ? '@handle, $CASHTAG, broadcastUrl' : 'channel1, channel2'}
                className="w-full px-3 py-2 rounded-lg bg-obsidian-700 border border-obsidian-500 outline-none focus:border-gold/60 text-sm"
              />
            </div>
          ))}
          <p className="text-[11px] text-obsidian-500">Editing channels restarts the relevant ingestors.</p>
        </Section>

        {/* Display */}
        <Section title="Display">
          <Toggle
            label="Color mode (sentiment edges + colored names/badges). Off = clean: brand logo, brand-color name, white text."
            checked={cfg.display?.colorMode ?? false}
            onChange={(v) => setDisplay({ colorMode: v })}
          />
          <p className="text-[11px] text-obsidian-500 mt-1">
            Applies live to the dashboard and the OBS overlay. Keep off for a clean on-stream look.
          </p>
        </Section>

        {/* All-chat backdrop + opacity (the pop-out window has no controls of its own) */}
        <Section title="All-Chat Appearance">
          <p className="text-xs text-obsidian-500 mb-3">
            A custom backdrop image shown behind the <b className="text-gold-soft">All Chat</b> window (and its
            pop-out). Configured here — the pop-out itself stays clean.
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <label className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-gold/15 border border-gold/40 text-gold-soft hover:bg-gold/25 cursor-pointer">
              Upload image
              <input type="file" accept="image/*" className="hidden" onChange={onBackdropFile} />
            </label>
            {cfg.display?.backdrop && (
              <button
                onClick={() => setDisplay({ backdrop: '' })}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-obsidian-500 text-obsidian-500 hover:text-bear"
              >
                clear
              </button>
            )}
            {cfg.display?.backdrop && (
              <span
                className="w-10 h-10 rounded border border-obsidian-500 bg-center bg-cover"
                style={{ backgroundImage: `url("${cfg.display.backdrop}")` }}
              />
            )}
          </div>
          <div className="mt-2">
            <label className="block text-[11px] text-obsidian-500 mb-1">…or paste an image URL</label>
            <input
              value={cfg.display?.backdrop?.startsWith('data:') ? '' : cfg.display?.backdrop || ''}
              onChange={(e) => setDisplay({ backdrop: e.target.value.trim() })}
              placeholder="https://…/your-backdrop.jpg"
              className="w-full px-3 py-2 rounded-lg bg-obsidian-700 border border-obsidian-500 outline-none focus:border-gold/60 text-sm"
            />
          </div>
          <div className="mt-3">
            <label className="block text-xs text-obsidian-500 mb-1">
              Backdrop opacity · {Math.round((cfg.display?.backdropOpacity ?? 0.5) * 100)}%
            </label>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round((cfg.display?.backdropOpacity ?? 0.5) * 100)}
              onChange={(e) => setDisplay({ backdropOpacity: Number(e.target.value) / 100 })}
              className="w-full accent-gold"
            />
          </div>
        </Section>

        {/* Global filter toggles */}
        <Section title="Filtering">
          <Toggle
            label="Hide emoji/emote-only messages"
            checked={cfg.filter.hideEmojiOnly}
            onChange={(v) => setFilter({ hideEmojiOnly: v })}
          />
          <Toggle
            label="Built-in slur list (removes message — recommended ON for broadcast)"
            checked={cfg.filter.defaultSlurListEnabled}
            onChange={(v) => setFilter({ defaultSlurListEnabled: v })}
          />
          <div className="flex items-center gap-2 mt-2">
            <span className="text-sm text-[#eaeaea]">Mask character</span>
            <input
              value={cfg.filter.maskChar}
              maxLength={1}
              onChange={(e) => setFilter({ maskChar: e.target.value || '*' })}
              className="w-12 text-center px-2 py-1 rounded bg-obsidian-700 border border-obsidian-500 outline-none focus:border-gold/60"
            />
          </div>
        </Section>

        {/* Custom word rules */}
        <Section title="Custom Word Rules">
          <div className="space-y-2">
            {cfg.filter.rules.map((r) => (
              <div key={r.id} className="flex items-center gap-2 flex-wrap bg-obsidian-700/60 rounded-lg px-2 py-2">
                <input
                  type="checkbox"
                  checked={r.enabled}
                  onChange={(e) => updateRule(r.id, { enabled: e.target.checked })}
                  className="accent-gold"
                  title="enabled"
                />
                <input
                  value={r.word}
                  onChange={(e) => updateRule(r.id, { word: e.target.value })}
                  placeholder="word"
                  className="flex-1 min-w-[100px] px-2 py-1 rounded bg-obsidian-800 border border-obsidian-500 outline-none focus:border-gold/60 text-sm"
                />
                <select
                  value={r.action}
                  onChange={(e) => updateRule(r.id, { action: e.target.value as FilterAction })}
                  className="px-2 py-1 rounded bg-obsidian-800 border border-obsidian-500 text-sm"
                >
                  <option value="mask">mask word</option>
                  <option value="remove">remove msg</option>
                </select>
                <label className="flex items-center gap-1 text-xs text-obsidian-500" title="leetspeak/obfuscation-resistant">
                  <input
                    type="checkbox"
                    checked={r.normalize}
                    onChange={(e) => updateRule(r.id, { normalize: e.target.checked })}
                    className="accent-gold"
                  />
                  fuzzy
                </label>
                <button
                  onClick={() => removeRule(r.id)}
                  className="text-bear hover:text-red-400 text-sm px-1"
                  title="remove rule"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <button
            onClick={addRule}
            className="mt-3 px-3 py-1.5 rounded-lg text-xs font-semibold bg-gold/15 border border-gold/40 text-gold-soft hover:bg-gold/25"
          >
            + add word
          </button>
        </Section>

        {/* Save */}
        <div className="flex items-center gap-3 sticky bottom-4">
          <button
            onClick={save}
            disabled={saving}
            className="px-5 py-2.5 rounded-xl font-bold bg-gold text-obsidian-900 hover:bg-gold-soft disabled:opacity-50 shadow-lg"
          >
            {saving ? 'saving…' : 'Save & push live'}
          </button>
          {status && <span className="text-sm">{status}</span>}
        </div>
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-obsidian-600 bg-obsidian-800/60 p-4">
      <h2 className="text-sm font-bold text-gold-soft mb-3 uppercase tracking-wide">{title}</h2>
      {children}
    </section>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 py-1 cursor-pointer">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="accent-gold w-4 h-4" />
      <span className="text-sm text-[#eaeaea]">{label}</span>
    </label>
  );
}
