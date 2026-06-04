'use client';

import { useFeedStore } from '@/lib/useFeed';
import type { Platform } from '@/lib/types';
import { PlatformLogo } from './PlatformLogo';

const ORDER: Platform[] = ['twitch', 'kick', 'x'];

// Compact display of the connected channel(s) per platform — shown next to the
// logo. These don't change often, so they read as a static "what's connected".
export function ChannelTags() {
  const channels = useFeedStore((s) => s.config?.channels);
  if (!channels) return null;

  const entries = ORDER.map((p) => ({ p, names: channels[p] || [] })).filter((e) => e.names.length);
  if (!entries.length) return null;

  return (
    <div className="flex items-center gap-3 flex-wrap">
      {entries.map(({ p, names }) => (
        <div key={p} className="flex items-center gap-1.5" title={`${p}: ${names.join(', ')}`}>
          <PlatformLogo platform={p} size={15} />
          <span className="text-sm text-[#eaeaea] font-semibold">
            {names.map((n) => n.replace(/^[@#]/, '')).join(', ')}
          </span>
        </div>
      ))}
    </div>
  );
}
