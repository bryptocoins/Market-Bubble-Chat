// MarketBubble brand mark (their @MarketBubble avatar) in a rounded badge.
// Used in headers / loading so the app reads as custom-built for the show.
export function Logo({ size = 32 }: { size?: number }) {
  return (
    <span
      className="inline-flex items-center justify-center overflow-hidden rounded-lg shrink-0"
      style={{
        width: size,
        height: size,
        border: '1px solid rgba(235, 235, 232,0.45)',
        boxShadow: '0 0 12px rgba(235, 235, 232,0.18)',
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/marketbubble.jpg" alt="Market Bubble" width={size} height={size} />
    </span>
  );
}
