'use client';

// All-chat mode — like the mod dashboard stripped to just the merged feed.
// Clean, readable, source-labeled. Built for the demo recording.
//   ?popout=1  → header hidden (its own contained chat window)
// Backdrop image + opacity come from owner settings (not configured here).

import { useEffect, useRef, useState } from 'react';
import { useFeedStore, useFeedConnection } from '@/lib/useFeed';
import { Message } from '@/components/Message';
import { ChannelTags } from '@/components/ChannelTags';
import { Logo } from '@/components/Logo';
import type { Platform } from '@/lib/types';
import { PLATFORM_COLOR, PLATFORM_LABEL } from '@/lib/types';

const PLATFORMS: Platform[] = ['twitch', 'kick', 'x'];

export default function AllChat() {
  useFeedConnection();

  // Detect pop-out from the URL on the client (avoids useSearchParams/Suspense).
  const [popout, setPopout] = useState(false);
  useEffect(() => {
    setPopout(new URLSearchParams(window.location.search).get('popout') === '1');
  }, []);

  const messages = useFeedStore((s) => s.messages);
  const connected = useFeedStore((s) => s.connected);
  const counts = useFeedStore((s) => s.counts);
  const statuses = useFeedStore((s) => s.statuses);
  const colorMode = useFeedStore((s) => s.config?.display?.colorMode ?? false);
  const backdrop = useFeedStore((s) => s.config?.display?.backdrop ?? '');
  const backdropOpacity = useFeedStore((s) => s.config?.display?.backdropOpacity ?? 0.5);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages.length]);

  const openPopout = () => {
    window.open('/chat?popout=1', 'mbAllChat', 'width=460,height=820,menubar=no,toolbar=no,location=no');
  };

  return (
    <main className="group obsidian-bg h-screen flex flex-col relative overflow-hidden">
      {/* Frameless pop-out chrome: a thin strip to drag the window + a ✕ that
          fades in on hover (top-right). Only in pop-out mode. */}
      {popout && (
        <>
          <div className="app-drag fixed top-0 left-0 right-0 h-6 z-40" aria-hidden />
          <button
            onClick={() => window.close()}
            title="Close"
            className="app-no-drag fixed top-1.5 right-1.5 z-50 w-6 h-6 flex items-center justify-center rounded-md text-sm text-white/80 bg-black/40 hover:bg-bear hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
          >
            ✕
          </button>
        </>
      )}

      {/* Custom backdrop (owner-configured), shown behind the chats. */}
      {backdrop && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-center bg-cover"
          style={{ backgroundImage: `url("${backdrop}")`, opacity: backdropOpacity }}
        />
      )}

      {!popout && (
        <header className="relative z-10 flex items-center justify-between px-5 py-3 border-b border-obsidian-600 bg-obsidian-900/80 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <Logo size={34} />
            <div>
              <div className="font-bold text-gold tracking-tight leading-none">MARKET BUBBLE</div>
              <div className="text-[10px] text-obsidian-500 tracking-[0.3em]">ALL CHAT</div>
            </div>
            <div className="h-7 w-px bg-obsidian-600 mx-1" />
            <ChannelTags />
          </div>

          <div className="flex items-center gap-3">
            {PLATFORMS.map((p) => (
              <div key={p} className="flex items-center gap-1.5 text-xs" title={statuses[p]}>
                <span
                  className="w-2 h-2 rounded-full"
                  style={{
                    background:
                      statuses[p] === 'up' ? '#2ecc71' : statuses[p] === 'reconnecting' ? '#e9e9e6' : '#ff5252',
                    boxShadow: statuses[p] === 'up' ? '0 0 6px #2ecc71' : 'none',
                  }}
                />
                <span className="font-semibold" style={{ color: PLATFORM_COLOR[p] }}>
                  {PLATFORM_LABEL[p]}
                </span>
                <span className="tabular-nums text-obsidian-500">{counts[p]}</span>
              </div>
            ))}
            <button
              onClick={openPopout}
              className="text-xs px-2.5 py-1 rounded-lg font-semibold bg-gold/15 border border-gold/40 text-gold-soft hover:bg-gold/25"
              title="Open in its own window"
            >
              ⧉ pop out
            </button>
            <a
              href="/"
              className="text-xs px-2.5 py-1 rounded-lg border border-obsidian-500 text-obsidian-500 hover:text-gold hover:border-gold/50"
            >
              setup
            </a>
          </div>
        </header>
      )}

      <div ref={scrollRef} className="feed-scroll relative z-10 flex-1 overflow-y-auto py-2 text-[17px]">
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center text-obsidian-500">
            {connected ? 'waiting for chat…' : 'connecting…'}
          </div>
        ) : (
          messages.map((m) => <Message key={m.id} msg={m} colorMode={colorMode} showChannel />)
        )}
      </div>
    </main>
  );
}
