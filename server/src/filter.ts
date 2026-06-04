// Owner-configurable filter. Shared evaluation logic for dashboard + overlay.
// Two layers: a built-in protected slur list (on by default, removes the whole
// message) and a fully custom owner-managed word list (per-word mask/remove).

import type { ChatMessage, FilterConfig, WordRule } from './types.js';
import { normalize, isEmojiOnlyText } from './normalize.js';

// Built-in protected slur list. Stored normalized so it survives obfuscation.
// Kept deliberately short + matched via the obfuscation-resistant normalizer.
const SLUR_SEEDS = ['nigger', 'nigga', 'faggot', 'fag', 'retard', 'kike', 'chink', 'spic', 'tranny', 'coon'];
const SLUR_NORMALIZED = SLUR_SEEDS.map(normalize);

export function hitsSlurList(text: string): boolean {
  const n = normalize(text);
  return SLUR_NORMALIZED.some((slur) => slur.length > 0 && n.includes(slur));
}

// Does a rule match the message text?
export function matches(text: string, rule: WordRule): boolean {
  if (!rule.word) return false;
  if (rule.normalize) {
    const n = normalize(text);
    const w = normalize(rule.word);
    return w.length > 0 && n.includes(w);
  }
  // Word-boundary, case-insensitive — avoids the Scunthorpe problem.
  const escaped = rule.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b${escaped}\\b`, 'i').test(text);
}

// Replace matches of the rule's term with maskChar (length-preserving).
export function maskTerm(text: string, rule: WordRule, maskChar: string): string {
  if (!rule.word) return text;

  if (!rule.normalize) {
    // Literal, word-boundary masking (avoids the Scunthorpe problem).
    const escaped = rule.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return text.replace(new RegExp(`\\b${escaped}\\b`, 'gi'), (m) => maskChar.repeat(m.length));
  }

  // Fuzzy masking: obfuscated forms (f.u.d, f u d, fff​uuud) don't survive a
  // literal regex, so mask any whitespace-delimited token whose normalized form
  // contains the normalized rule word. This guarantees the term never leaks.
  const w = normalize(rule.word);
  if (!w) return text;
  return text
    .split(/(\s+)/) // keep separators so we can rejoin verbatim
    .map((tok) => (tok.trim() && normalize(tok).includes(w) ? maskChar.repeat(tok.length) : tok))
    .join('');
}

export function isEmojiOnly(msg: ChatMessage): boolean {
  return isEmojiOnlyText(msg.text);
}

// Evaluation order per message. Returns null to drop the message entirely.
export function applyFilter(msg: ChatMessage, cfg: FilterConfig): ChatMessage | null {
  // 1. emoji/emote-only
  if (cfg.hideEmojiOnly && isEmojiOnly(msg)) return null;

  // 2. built-in slur list (protected, action = remove)
  if (cfg.defaultSlurListEnabled && hitsSlurList(msg.text)) return null;

  // 3. custom REMOVE rules first — any hit drops the message
  for (const r of cfg.rules) {
    if (r.enabled && r.action === 'remove' && matches(msg.text, r)) return null;
  }

  // 4. custom MASK rules — replace term in survivors
  let text = msg.text;
  const maskChar = cfg.maskChar || '*';
  for (const r of cfg.rules) {
    if (r.enabled && r.action === 'mask' && matches(text, r)) {
      text = maskTerm(text, r, maskChar);
      // Safety net: a fuzzy match spread across token boundaries (e.g. "f u d")
      // can't be localized by token masking. If it still matches the collapsed
      // text, scrub all visible chars so the term can never leak on-broadcast.
      if (r.normalize && matches(text, r)) {
        text = text.replace(/\S/g, maskChar);
      }
    }
  }
  return { ...msg, text };
}
