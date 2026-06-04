'use client';

import type { Platform } from '@/lib/types';
import { PLATFORM_COLOR, PLATFORM_LABEL } from '@/lib/types';

export interface ViewFilter {
  platforms: Record<Platform, boolean>;
  search: string;
  cashtagsOnly: boolean;
}

export const DEFAULT_VIEW_FILTER: ViewFilter = {
  platforms: { twitch: true, kick: true, x: true },
  search: '',
  cashtagsOnly: false,
};

// Client-side view filter (does not affect the broadcast/overlay — that's owner
// config). Platform toggles + search + cashtags-only.
export function FilterBar({
  value,
  onChange,
}: {
  value: ViewFilter;
  onChange: (v: ViewFilter) => void;
}) {
  const togglePlatform = (p: Platform) =>
    onChange({ ...value, platforms: { ...value.platforms, [p]: !value.platforms[p] } });

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {(['twitch', 'kick', 'x'] as Platform[]).map((p) => {
        const on = value.platforms[p];
        return (
          <button
            key={p}
            onClick={() => togglePlatform(p)}
            className="px-2.5 py-1 rounded-lg text-xs font-semibold border transition-opacity"
            style={{
              color: on ? (p === 'kick' ? '#0a0a0b' : PLATFORM_COLOR[p]) : '#5a5a5e',
              background: on ? (p === 'kick' ? PLATFORM_COLOR[p] : `${PLATFORM_COLOR[p]}22`) : 'transparent',
              borderColor: on ? `${PLATFORM_COLOR[p]}88` : '#323236',
              opacity: on ? 1 : 0.55,
            }}
          >
            {PLATFORM_LABEL[p]}
          </button>
        );
      })}

      <input
        value={value.search}
        onChange={(e) => onChange({ ...value, search: e.target.value })}
        placeholder="search…"
        className="px-2.5 py-1 rounded-lg text-xs bg-obsidian-700 border border-obsidian-500 outline-none focus:border-gold/60 w-32 text-[#eaeaea]"
      />

      <button
        onClick={() => onChange({ ...value, cashtagsOnly: !value.cashtagsOnly })}
        className="px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors"
        style={{
          color: value.cashtagsOnly ? '#0a0a0b' : '#ffffff',
          background: value.cashtagsOnly ? '#e9e9e6' : 'rgba(235, 235, 232,0.12)',
          borderColor: 'rgba(235, 235, 232,0.4)',
        }}
      >
        $ cashtags only
      </button>
    </div>
  );
}
