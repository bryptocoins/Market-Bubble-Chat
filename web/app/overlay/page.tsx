'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useFeedStore, useFeedConnection } from '@/lib/useFeed';
import type { ChatMessage, Platform } from '@/lib/types';
import { PLATFORM_COLOR } from '@/lib/types';
import { PlatformLogo } from '@/components/PlatformLogo';
import { renderMessageContent } from '@/components/MessageContent';

// Parse ?channels=kick:xqc,twitch:ansem,x:@handle into per-platform allow lists.
function parseChannels(raw: string | null): Partial<Record<Platform, Set<string>>> | null {
  if (!raw) return null;
  const map: Partial<Record<Platform, Set<string>>> = {};
  for (const tok of raw.split(',')) {
    const [p, ch] = tok.split(':');
    const plat = p?.trim() as Platform;
    if (!['twitch', 'kick', 'x'].includes(plat)) continue;
    (map[plat] ??= new Set()).add((ch || '').trim().toLowerCase().replace(/^[@#]/, ''));
  }
  return Object.keys(map).length ? map : null;
}

function OverlayInner() {
  useFeedConnection();
  const params = useSearchParams();
  const messages = useFeedStore((s) => s.messages);

  const max = Math.max(1, Number(params.get('max') || 12));
  const fade = Number(params.get('fade') || 8000);
  const pos = params.get('pos') || 'bottom';
  const channelFilter = useMemo(() => parseChannels(params.get('channels')), [params]);

  // Optional solid background for stream software without a transparent browser
  // source (e.g. ?bg=%2300FF00 for a chroma key). Default = transparent.
  const bgParam = params.get('bg');
  const pageBg = bgParam ? decodeURIComponent(bgParam) : 'transparent';

  // Color mode: URL param wins (self-contained copied URL), else owner config.
  const colorParam = params.get('color');
  const configColor = useFeedStore((s) => s.config?.display?.colorMode ?? false);
  const colorMode =
    colorParam === null ? configColor : colorParam === '1' || colorParam === 'true';

  // Re-render on a tick so fade-out + expiry recompute.
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 400);
    return () => clearInterval(t);
  }, []);

  // Force the page background (transparent by default so OBS composites over the
  // stream; a solid color when ?bg= is set for chroma-key capture workflows).
  useEffect(() => {
    const prevBody = document.body.style.background;
    const prevHtml = document.documentElement.style.background;
    document.body.style.background = pageBg;
    document.documentElement.style.background = pageBg;
    return () => {
      document.body.style.background = prevBody;
      document.documentElement.style.background = prevHtml;
    };
  }, [pageBg]);

  const now = Date.now();
  const visible = messages
    .filter((m) => {
      if (!channelFilter) return true;
      const allowed = channelFilter[m.platform];
      if (!allowed) return false;
      if (allowed.has('')) return true; // platform listed without a channel = all
      return allowed.has((m.channel || '').toLowerCase().replace(/^[@#]/, ''));
    })
    .filter((m) => now - m.ts < fade + 1500)
    .slice(-max);

  return (
    <div
      className={`fixed inset-0 p-3 flex flex-col gap-1 ${pos === 'top' ? 'justify-start' : 'justify-end'}`}
      style={{ background: pageBg }}
    >
      {visible.map((m) => {
        const age = now - m.ts;
        const fadeStart = fade - 1400;
        const opacity = age > fadeStart ? Math.max(0, 1 - (age - fadeStart) / 1400) : 1;
        return <OverlayRow key={m.id} msg={m} opacity={opacity} colorMode={colorMode} />;
      })}
    </div>
  );
}

function OverlayRow({ msg, opacity, colorMode }: { msg: ChatMessage; opacity: number; colorMode: boolean }) {
  // Clean look: brand-color username, white text, no sentiment edge.
  // Color mode: user color + sentiment edge.
  const globalEmotes = useFeedStore((s) => s.globalEmotes);
  const nameColor = colorMode ? msg.color || PLATFORM_COLOR[msg.platform] : PLATFORM_COLOR[msg.platform];
  const edge = colorMode
    ? msg.sentiment === 'bull'
      ? '#2ecc71'
      : msg.sentiment === 'bear'
        ? '#ff5252'
        : `${PLATFORM_COLOR[msg.platform]}99`
    : 'rgba(255,255,255,0.18)';
  return (
    <div
      className="flex items-start gap-2 animate-slide-in"
      style={{ opacity, transition: 'opacity 0.4s linear' }}
    >
      <div
        className="flex items-start gap-2 rounded-lg px-2.5 py-1.5 max-w-[90%]"
        style={{
          background: 'rgba(10,9,8,0.62)',
          borderLeft: `3px solid ${edge}`,
          backdropFilter: 'blur(2px)',
        }}
      >
        <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
          <PlatformLogo platform={msg.platform} size={16} />
          {msg.channel && (
            <span
              className="text-[12px] font-semibold whitespace-nowrap overlay-shadow"
              style={{ color: `${PLATFORM_COLOR[msg.platform]}dd` }}
            >
              {msg.channel.replace(/^[@#]/, '')}
            </span>
          )}
        </div>
        <div className="text-[17px] leading-snug overlay-shadow">
          <span className="font-bold" style={{ color: nameColor }}>
            {msg.username}
          </span>
          <span className="text-white/50 mx-1">:</span>
          <span className="text-white">{renderMessageContent(msg, globalEmotes)}</span>
        </div>
      </div>
    </div>
  );
}

export default function Overlay() {
  return (
    <Suspense fallback={null}>
      <OverlayInner />
    </Suspense>
  );
}
