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
