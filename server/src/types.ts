// Shared message schema + config models for the Unified Chat Aggregator.

export type Platform = 'twitch' | 'kick' | 'x';

export interface Emote {
  name: string;
  id?: string;
  start: number;
  end: number;
}

export interface Cashtag {
  symbol: string;
  price?: number;
  change?: number;
}

export type Sentiment = 'bull' | 'bear' | 'neutral';

export interface ChatMessage {
  id: string; // platform-native id or hash; used for dedup
  platform: Platform;
  username: string;
  color: string | null; // platform-provided user color if any
  badges: string[]; // e.g. ['mod','sub','vip']
  text: string; // raw text (post-filter for display)
  emotes: Emote[]; // normalized across platforms
  ts: number; // epoch ms
  channel?: string; // source channel/slug
  // enrichment (added later in pipeline):
  cashtags?: Cashtag[];
  sentiment?: Sentiment;
}

// ---- Filter config ------------------------------------------------------

export type FilterAction = 'mask' | 'remove';

export interface WordRule {
  id: string;
  word: string;
  enabled: boolean;
  action: FilterAction;
  normalize: boolean;
}

export interface FilterConfig {
  hideEmojiOnly: boolean;
  maskChar: string;
  rules: WordRule[];
  defaultSlurListEnabled: boolean;
}

// ---- Channel config -----------------------------------------------------

export interface ChannelConfig {
  twitch: string[];
  kick: string[];
  x: string[];
}

export interface DisplayConfig {
  // false = clean look (brand logo + brand-color username + white text).
  // true  = color mode (sentiment edges, colored badges, richer coloring).
  colorMode: boolean;
  // All-chat window backdrop: an image URL or data URL ('' = none), and how
  // strongly it shows through (0 = hidden, 1 = full).
  backdrop: string;
  backdropOpacity: number;
}

export interface AppConfig {
  filter: FilterConfig;
  channels: ChannelConfig;
  display: DisplayConfig;
}

// ---- WS protocol --------------------------------------------------------

export type ServerEvent =
  | { type: 'hello'; buffer: ChatMessage[]; config: AppConfig }
  | { type: 'message'; message: ChatMessage }
  | { type: 'config'; config: AppConfig }
  | { type: 'hype'; rate: number; spike: boolean; leader: Platform | null; leaderPct: number }
  | { type: 'status'; platform: Platform; state: 'up' | 'down' | 'reconnecting'; channel?: string };
