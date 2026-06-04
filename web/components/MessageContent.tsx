import type { ReactNode } from 'react';
import type { ChatMessage } from '@/lib/types';
import { nativeEmoteUrl, type EmoteMap } from '@/lib/emotes';
import { CashtagPill } from './CashtagPill';

const CASHTAG_RE = /^\$([A-Za-z]{1,6})$/;

// Render message text with: native emotes (from msg.emotes), 7TV/BTTV global
// emotes (from globalEmotes), live $cashtag pills, and auto-linked URLs.
export function renderMessageContent(msg: ChatMessage, globalEmotes?: EmoteMap): ReactNode[] {
  // name -> url for this message's native emotes.
  const native = new Map<string, string>();
  for (const e of msg.emotes || []) {
    if (e.id) native.set(e.name, nativeEmoteUrl(msg.platform, e.id));
  }
  const cashBySymbol = new Map((msg.cashtags ?? []).map((c) => [c.symbol.toUpperCase(), c]));

  const out: ReactNode[] = [];
  // Split on whitespace, keeping the separators so spacing is preserved.
  const parts = msg.text.split(/(\s+)/);
  parts.forEach((part, i) => {
    if (part === '') return;
    if (/^\s+$/.test(part)) {
      out.push(part);
      return;
    }

    // Emote (native first, then 7TV/BTTV global).
    const emoteUrl = native.get(part) || globalEmotes?.get(part);
    if (emoteUrl) {
      out.push(
        <img
          key={i}
          src={emoteUrl}
          alt={part}
          title={part}
          loading="lazy"
          className="inline-block align-middle h-[1.6em] mx-px"
        />,
      );
      return;
    }

    // URL.
    if (/^https?:\/\//.test(part)) {
      const isPoly = /polymarket\.com/i.test(part);
      out.push(
        <a
          key={i}
          href={part}
          target="_blank"
          rel="noreferrer"
          className="underline"
          style={{ color: isPoly ? '#e9e9e6' : '#7fb4ff' }}
        >
          {isPoly ? '◈ ' : ''}
          {part.length > 42 ? part.slice(0, 40) + '…' : part}
        </a>,
      );
      return;
    }

    // Cashtag.
    const m = part.match(CASHTAG_RE);
    if (m) {
      const symbol = m[1].toUpperCase();
      out.push(<CashtagPill key={i} tag={cashBySymbol.get(symbol) ?? { symbol }} />);
      return;
    }

    out.push(<span key={i}>{part}</span>);
  });
  return out;
}
