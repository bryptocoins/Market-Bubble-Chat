import { memo } from 'react';
import type { ChatMessage } from '@/lib/types';
import { PLATFORM_COLOR } from '@/lib/types';
import { useFeedStore } from '@/lib/useFeed';
import { PlatformLogo } from './PlatformLogo';
import { renderMessageContent } from './MessageContent';

const BADGE_STYLE: Record<string, { bg: string; label: string }> = {
  broadcaster: { bg: '#e8133b', label: 'HOST' },
  moderator: { bg: '#34d058', label: 'MOD' },
  mod: { bg: '#34d058', label: 'MOD' },
  vip: { bg: '#e056fd', label: 'VIP' },
  subscriber: { bg: '#9146FF', label: 'SUB' },
  sub: { bg: '#9146FF', label: 'SUB' },
  founder: { bg: '#e9e9e6', label: 'OG' },
  verified: { bg: '#1d9bf0', label: '✓' },
  og: { bg: '#e9e9e6', label: 'OG' },
};

function MessageRow({
  msg,
  colorMode = false,
  showChannel = false,
}: {
  msg: ChatMessage;
  colorMode?: boolean;
  showChannel?: boolean;
}) {
  // Clean look: brand-color username, white text. Color mode: user color +
  // sentiment edge + colored badges.
  const globalEmotes = useFeedStore((s) => s.globalEmotes);
  const nameColor = colorMode ? msg.color || PLATFORM_COLOR[msg.platform] : PLATFORM_COLOR[msg.platform];
  const edge = colorMode
    ? msg.sentiment === 'bull'
      ? '#2ecc71'
      : msg.sentiment === 'bear'
        ? '#ff5252'
        : `${PLATFORM_COLOR[msg.platform]}55`
    : 'transparent';

  return (
    <div
      className="group flex gap-2 px-3 py-1.5 items-start animate-slide-in border-l-2 hover:bg-white/5"
      style={{ borderLeftColor: edge }}
    >
      <div className="flex items-center gap-1.5 pt-0.5 shrink-0">
        <PlatformLogo platform={msg.platform} />
        {showChannel && msg.channel && (
          <span
            className="text-[11px] font-semibold whitespace-nowrap"
            style={{ color: `${PLATFORM_COLOR[msg.platform]}cc` }}
            title={`source: ${msg.channel}`}
          >
            {msg.channel.replace(/^[@#]/, '')}
          </span>
        )}
      </div>
      <div className="min-w-0 text-[15px] leading-snug">
        {msg.badges.slice(0, 3).map((b) => {
          const s = BADGE_STYLE[b.toLowerCase()];
          if (!s) return null;
          return (
            <span
              key={b}
              className="inline-block mr-1 px-1 rounded text-[10px] font-bold align-middle"
              style={
                colorMode
                  ? { background: s.bg, color: '#0a0a0b' }
                  : { background: 'rgba(255,255,255,0.12)', color: '#cccccc' }
              }
            >
              {s.label}
            </span>
          );
        })}
        <span className="font-bold" style={{ color: nameColor }}>
          {msg.username}
        </span>
        <span className="text-white/40 mx-1">:</span>
        <span className="text-white break-words">{renderMessageContent(msg, globalEmotes)}</span>
      </div>
    </div>
  );
}

export const Message = memo(MessageRow);
