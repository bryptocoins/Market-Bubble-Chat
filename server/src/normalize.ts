// Text normalization helpers used by the filter (obfuscation-resistant matching)
// and shared emoji detection.

// Obfuscation-resistant normalizer. Collapses leetspeak, strips accents,
// repeats and any non-letter spacers so 'n1gger', 'b@ld', 'f.u.d' all match.
export const normalize = (s: string): string =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // strip accents
    .replace(/[1!|]/g, 'i')
    .replace(/0/g, 'o')
    .replace(/3/g, 'e')
    .replace(/[$5]/g, 's')
    .replace(/[@4]/g, 'a')
    .replace(/(.)\1{2,}/g, '$1$1') // collapse 3+ repeats
    .replace(/[^a-z]/g, ''); // drop spacers/dots/punct

// Unicode emoji matcher (covers most pictographic ranges + variation selectors +
// ZWJ sequences + regional indicators + skin-tone modifiers).
const EMOJI_RE =
  /(\p{Extended_Pictographic}|\p{Emoji_Presentation}|[\u{1F1E6}-\u{1F1FF}]|[\u{1F3FB}-\u{1F3FF}]|️|‍)/gu;

export const stripEmoji = (s: string): string => s.replace(EMOJI_RE, '');

// Strip platform emote tokens that arrive inline (Kick: [emote:ID:name]).
const EMOTE_TOKEN_RE = /\[emote:[^\]]+\]/g;

export const stripEmoteTokens = (s: string): string => s.replace(EMOTE_TOKEN_RE, '');

// A message is "emoji only" if removing all unicode emoji AND platform emote
// tokens leaves nothing but whitespace.
export const isEmojiOnlyText = (text: string): boolean =>
  stripEmoteTokens(stripEmoji(text)).trim().length === 0;
