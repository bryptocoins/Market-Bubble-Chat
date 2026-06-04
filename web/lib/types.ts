// Client-side mirror of the server message + config schema.

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
  id: string;
  platform: Platform;
  username: string;
  color: string | null;
  badges: string[];
  text: string;
  emotes: Emote[];
  ts: number;
  channel?: string;
  cashtags?: Cashtag[];
  sentiment?: Sentiment;
}

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

export interface ChannelConfig {
  twitch: string[];
  kick: string[];
  x: string[];
}

export interface DisplayConfig {
  colorMode: boolean;
  backdrop: string;
  backdropOpacity: number;
}

export interface AppConfig {
  filter: FilterConfig;
  channels: ChannelConfig;
  display: DisplayConfig;
}

export type StatusState = 'up' | 'down' | 'reconnecting';

export type ServerEvent =
  | { type: 'hello'; buffer: ChatMessage[]; config: AppConfig }
  | { type: 'message'; message: ChatMessage }
  | { type: 'config'; config: AppConfig }
  | { type: 'hype'; rate: number; spike: boolean; leader: Platform | null; leaderPct: number }
  | { type: 'status'; platform: Platform; state: StatusState; channel?: string };

export const PLATFORM_COLOR: Record<Platform, string> = {
  twitch: '#9146FF',
  kick: '#53FC18',
  x: '#E7E9EA',
};

export const PLATFORM_LABEL: Record<Platform, string> = {
  twitch: 'Twitch',
  kick: 'Kick',
  x: 'X',
};
