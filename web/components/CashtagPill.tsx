import type { Cashtag } from '@/lib/types';

// Inline markets pill: $SYMBOL with live price + 24h change tint.
export function CashtagPill({ tag }: { tag: Cashtag }) {
  const hasPrice = typeof tag.price === 'number';
  const up = (tag.change ?? 0) >= 0;
  const changeColor = up ? '#2ecc71' : '#ff5252';

  const fmtPrice = (p: number) =>
    p >= 1 ? p.toLocaleString(undefined, { maximumFractionDigits: 2 }) : p.toPrecision(4);

  return (
    <span
      className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 mx-0.5 align-middle text-[0.78em] font-semibold animate-pop"
      style={{
        background: 'rgba(235, 235, 232,0.12)',
        border: '1px solid rgba(235, 235, 232,0.4)',
        color: '#ffffff',
      }}
    >
      <span>${tag.symbol}</span>
      {hasPrice && <span className="text-gold-soft/90">${fmtPrice(tag.price!)}</span>}
      {typeof tag.change === 'number' && (
        <span style={{ color: changeColor }}>
          {up ? '▲' : '▼'}
          {Math.abs(tag.change).toFixed(1)}%
        </span>
      )}
    </span>
  );
}
