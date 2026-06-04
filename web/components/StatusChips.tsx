'use client';

import { useFeedStore } from '@/lib/useFeed';
import type { Platform, StatusState } from '@/lib/types';
import { PLATFORM_COLOR, PLATFORM_LABEL } from '@/lib/types';

const PLATFORMS: Platform[] = ['twitch', 'kick', 'x'];

function dotColor(state: StatusState): string {
  return state === 'up' ? '#2ecc71' : state === 'reconnecting' ? '#e9e9e6' : '#ff5252';
}

// Per-platform connection chips. "X: reconnecting" surfaces graceful degradation.
export function StatusChips() {
  const statuses = useFeedStore((s) => s.statuses);
  const counts = useFeedStore((s) => s.counts);

  return (
    <div className="flex items-center gap-2">
      {PLATFORMS.map((p) => {
        const state = statuses[p];
        return (
          <div
            key={p}
            className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs border border-obsidian-500"
            style={{ background: 'rgba(18,16,14,0.7)' }}
            title={`${PLATFORM_LABEL[p]}: ${state}`}
          >
            <span
              className="w-2 h-2 rounded-full"
              style={{
                background: dotColor(state),
                boxShadow: state === 'up' ? `0 0 6px ${dotColor(state)}` : 'none',
              }}
            />
            <span className="font-semibold" style={{ color: PLATFORM_COLOR[p] }}>
              {PLATFORM_LABEL[p]}
            </span>
            <span className="tabular-nums text-obsidian-500">{counts[p]}</span>
            {state === 'reconnecting' && <span className="text-gold/80">…</span>}
          </div>
        );
      })}
    </div>
  );
}
