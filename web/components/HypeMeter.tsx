'use client';

import { useFeedStore } from '@/lib/useFeed';
import { PLATFORM_COLOR, PLATFORM_LABEL } from '@/lib/types';

// Cross-platform hype meter: rolling msgs/sec with a HYPE badge on spike.
export function HypeMeter() {
  const hype = useFeedStore((s) => s.hype);
  const pct = Math.min(100, (hype.rate / 12) * 100); // visual scale; ~12 msg/s = full

  return (
    <div
      className={`flex items-center gap-3 rounded-xl px-3 py-2 border ${
        hype.spike ? 'animate-hype-pulse border-gold' : 'border-obsidian-500'
      }`}
      style={{ background: 'rgba(18,16,14,0.8)' }}
    >
      {hype.spike ? (
        <div className="flex items-center gap-1.5 font-bold text-gold whitespace-nowrap">
          <span className="text-lg">🔥</span>
          <span>HYPE</span>
          {hype.leader && (
            <span
              className="text-xs px-1.5 py-0.5 rounded"
              style={{
                color: hype.leader === 'kick' ? '#0a0a0b' : PLATFORM_COLOR[hype.leader],
                background: hype.leader === 'kick' ? PLATFORM_COLOR[hype.leader] : `${PLATFORM_COLOR[hype.leader]}22`,
              }}
            >
              {PLATFORM_LABEL[hype.leader]} {hype.leaderPct >= 0 ? '+' : ''}
              {hype.leaderPct}%
            </span>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-1.5 text-obsidian-500 font-semibold whitespace-nowrap text-sm">
          <span>⚡</span>
          <span>HYPE</span>
        </div>
      )}

      <div className="flex-1 min-w-[120px] h-2 rounded-full overflow-hidden bg-obsidian-700">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${pct}%`,
            background: hype.spike
              ? 'linear-gradient(90deg,#9a9a97,#ffffff)'
              : 'linear-gradient(90deg,#323236,#e9e9e6)',
          }}
        />
      </div>
      <div className="font-mono text-sm tabular-nums text-gold-soft whitespace-nowrap">
        {hype.rate.toFixed(1)} <span className="text-obsidian-500 text-xs">msg/s</span>
      </div>
    </div>
  );
}
