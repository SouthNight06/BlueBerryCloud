export type Track = {
  id: number;
  title: string;
  artist: string;
  album: string;
  duration: number | null;
  source: string;
  sourceId: string | null;
  streamUrl: string;
  downloadUrl: string;
  coverUrl: string | null;
  license: string | null;
  local: boolean;
  createdAt: string;
};

export type Playlist = {
  id: number;
  name: string;
  description: string;
  trackCount: number;
  trackIds: number[];
  createdAt: string;
  updatedAt: string;
};

export type ThemeTokens = Record<string, string>;

export type Theme = {
  id: string;
  numericId?: number;
  name: string;
  description?: string;
  builtin: boolean;
  tokens: ThemeTokens;
  createdAt?: string;
  updatedAt?: string;
};

export type SourceInfo = {
  id: string;
  name: string;
  description: string;
  supportsDownload: boolean;
  offline: boolean;
};

export type SearchResult = {
  source: string;
  sourceId: string;
  title: string;
  artist: string;
  album: string;
  duration: number | null;
  coverUrl: string | null;
  license: string | null;
  resolved: boolean;
};

export type SourceStatus = {
  id: string;
  name: string;
  ok: boolean;
  count?: number;
  error?: string;
};

export type SearchResponse = {
  results: SearchResult[];
  status: SourceStatus[];
  cached: boolean;
};

export type Settings = {
  activeTheme: string;
  preferences: Record<string, unknown>;
  updatedAt: string | null;
};

export type PublicUser = {
  id: number;
  username: string;
  createdAt: string;
};

export type SyncResponse = {
  user: PublicUser;
  tracks: Track[];
  playlists: Playlist[];
  themes: Theme[];
  sources: SourceInfo[];
  syncedAt: string;
};

export type AuthResponse = {
  token: string;
  user: PublicUser;
};

export type BiliAccount = {
  mid: string;
  uname: string;
  face: string | null;
  vip: boolean;
  updatedAt: string;
};

export type BiliQr = {
  key: string;
  url: string;
  svg: string;
};

export type BiliQrState = "waiting" | "scanned" | "expired" | "ok" | "unknown";

export type BiliQrPoll = {
  state: BiliQrState;
  code: number;
  message: string;
  account: BiliAccount | null;
};

export type BiliFolder = {
  id: number;
  title: string;
  count: number;
  collected: boolean;
  cover: string | null;
};

export type BiliFavItem = {
  bvid: string;
  title: string;
  cover: string | null;
  author: string;
  duration: number;
  play: number | null;
};

export type BiliFavPage = {
  title: string;
  total: number;
  hasMore: boolean;
  items: BiliFavItem[];
  page: number;
  pageSize: number;
};

export type BiliPage = {
  cid: number;
  title: string;
  page: number;
  duration: number;
};

export type BiliVideo = {
  bvid: string;
  title: string;
  cover: string | null;
  author: string;
  duration: number;
  pages: BiliPage[];
};

export type Lyric = {
  trackId: number;
  lrc: string;
  source: string;
  updatedAt: string;
};

export type LyricSearchItem = {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: number | null;
  synced: boolean;
  lrc: string;
  provider: string;
};

export type CacheBucket = {
  files: number;
  bytes: number;
};

export type CacheStats = {
  covers: CacheBucket;
  audio: CacheBucket;
  orphans: CacheBucket;
};
