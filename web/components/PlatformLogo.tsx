import type { Platform } from '@/lib/types';

// Real platform brand marks (not letter templates). Twitch glitch + X mark are
// the official glyph paths; Kick is its signature green rounded square + K
// (matches Kick's app icon / favicon).
export function PlatformLogo({ platform, size = 18 }: { platform: Platform; size?: number }) {
  if (platform === 'twitch') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="#9146FF" aria-label="Twitch" className="shrink-0">
        <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z" />
      </svg>
    );
  }

  if (platform === 'x') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="#E7E9EA" aria-label="X" className="shrink-0">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    );
  }

  // Kick — green rounded square + black K.
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-label="Kick" className="shrink-0">
      <rect x="0" y="0" width="24" height="24" rx="5" fill="#53FC18" />
      <path d="M6 4.5h4.2v5.2l5-5.2h5.3l-7.1 7.5 7.1 7.5h-5.3l-5-5.2v5.2H6z" fill="#0a0a0b" />
    </svg>
  );
}
