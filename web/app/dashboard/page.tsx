'use client';

// Mod dashboard — the busy operator view: full feed with search, platform
// toggles, cashtags-only, hype meter, live counts. Not the on-stream overlay.

import { useEffect, useMemo, useRef, useState } from 'react';
import { useFeedStore, useFeedConnection } from '@/lib/useFeed';
import { Message } from '@/components/Message';
import { HypeMeter } from '@/components/HypeMeter';
import { StatusChips } from '@/components/StatusChips';
import { FilterBar, DEFAULT_VIEW_FILTER, type ViewFilter } from '@/components/FilterBar';
import { ChannelTags } from '@/components/ChannelTags';
import { Logo } from '@/components/Logo';

export default function Dashboard() {
  useFeedConnection();
  const messages = useFeedStore((s) => s.messages);
  const connected = useFeedStore((s) => s.connected);
  const colorMode = useFeedStore((s) => s.config?.display?.colorMode ?? false);
  const [view, setView] = useState<ViewFilter>(DEFAULT_VIEW_FILTER);
  const [pinned, setPinned] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const q = view.search.trim().toLowerCase();
    return messages.filter((m) => {
      if (!view.platforms[m.platform]) return false;
      if (view.cashtagsOnly && !(m.cashtags && m.cashtags.length)) return false;
      if (q && !(m.text.toLowerCase().includes(q) || m.username.toLowerCase().includes(q)))
        return false;
      return true;
    });
  }, [messages, view]);

  // Auto-scroll to bottom unless the user scrolled up.
  useEffect(() => {
    if (pinned && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [filtered.length, pinned]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
    setPinned(atBottom);
  };

  return (
    <main className="obsidian-bg min-h-screen flex flex-col">
      {/* Top bar */}
      <header className="sticky top-0 z-10 border-b border-obsidian-600 backdrop-blur-md bg-obsidian-900/80">
        <div className="px-4 py-3 flex items-center gap-4 flex-wrap">
          <a href="/" className="flex items-center gap-2 group" title="Setup">
            <Logo size={30} />
            <div>
              <div className="font-bold text-gold tracking-tight leading-none text-lg group-hover:text-gold-soft">
                MARKET BUBBLE
              </div>
              <div className="text-[10px] text-obsidian-500 tracking-widest">CHAT · MOD DASHBOARD</div>
            </div>
          </a>

          <div className="h-6 w-px bg-obsidian-600" />
          <ChannelTags />

          <div className="flex-1 min-w-[200px] max-w-md">
            <HypeMeter />
          </div>

          <StatusChips />

          <a
            href="/"
            className="text-xs px-2.5 py-1.5 rounded-lg border border-obsidian-500 text-obsidian-500 hover:text-gold hover:border-gold/50"
          >
            ← setup
          </a>
          <a
            href="/settings"
            className="text-xs px-2.5 py-1.5 rounded-lg border border-obsidian-500 text-obsidian-500 hover:text-gold hover:border-gold/50"
          >
            ⚙ filters
          </a>
        </div>
        <div className="px-4 pb-3 flex items-center justify-between gap-3 flex-wrap">
          <FilterBar value={view} onChange={setView} />
          <div className="flex items-center gap-2 text-xs text-obsidian-500">
            <span
              className="w-2 h-2 rounded-full"
              style={{ background: connected ? '#2ecc71' : '#ff5252' }}
            />
            {connected ? 'live' : 'connecting…'}
            <span className="tabular-nums">· {filtered.length} shown</span>
          </div>
        </div>
      </header>

      {/* Feed */}
      <div ref={scrollRef} onScroll={onScroll} className="feed-scroll flex-1 overflow-y-auto py-2">
        {filtered.length === 0 ? (
          <div className="h-full flex items-center justify-center text-obsidian-500 text-sm">
            {connected ? 'waiting for chat…' : 'connecting to feed…'}
          </div>
        ) : (
          filtered.map((m) => <Message key={m.id} msg={m} colorMode={colorMode} showChannel />)
        )}
      </div>

      {!pinned && (
        <button
          onClick={() => setPinned(true)}
          className="fixed bottom-4 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-full bg-gold text-obsidian-900 text-xs font-bold shadow-lg"
        >
          ↓ jump to live
        </button>
      )}
    </main>
  );
}
