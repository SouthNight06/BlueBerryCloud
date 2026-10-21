import { BUILTIN_THEMES, DEFAULT_THEME_ID } from "../lib/builtinThemes";
import { ApiError } from "./errors";
import type {
  AuthResponse,
  BiliAccount,
  BiliFavPage,
  BiliFolder,
  BiliQr,
  BiliQrPoll,
  BiliVideo,
  CacheStats,
  Lyric,
  LyricSearchItem,
  Playlist,
  PublicUser,
  SearchResponse,
  Settings,
  SourceInfo,
  SyncResponse,
  Theme,
  ThemeTokens,
  Track,
} from "./types";

const DB_NAME = "xiaoyun-local";
const DB_VERSION = 1;
const SETTINGS_KEY = "current";

export const LOCAL_USER: PublicUser = {
  id: 1,
  username: "本地曲库",
  createdAt: "2000-01-01T00:00:00.000Z",
};

export const LOCAL_TOKEN = "local-device";

const LOCAL_SOURCES: SourceInfo[] = [
  {
    id: "local",
    name: "本机文件",
    description: "从这台设备导入音频，音频与元数据都只存在本机。",
    supportsDownload: false,
    offline: true,
  },
];

type StoredTrack = {
  id: number;
  title: string;
  artist: string;
  album: string;
  duration: number | null;
  source: string;
  sourceId: string | null;
  license: string | null;
  local: boolean;
  createdAt: string;
  audioMime: string;
  fileName: string;
  bytes: number;
  coverMime: string | null;
};

type StoredPlaylist = {
  id: number;
  name: string;
  description: string;
  trackIds: number[];
  createdAt: string;
  updatedAt: string;
};

type StoredTheme = {
  id: string;
  name: string;
  description: string;
  tokens: ThemeTokens;
  createdAt: string;
  updatedAt: string;
};

type StoredSettings = {
  activeTheme: string;
  preferences: Record<string, unknown>;
  updatedAt: string | null;
};

type StoredLyric = {
  trackId: number;
  lrc: string;
  source: string;
  updatedAt: string;
};

export type LocalBackup = {
  app: "xiaoyun-local";
  version: 1;
  exportedAt: string;
  settings: StoredSettings;
  tracks: (Omit<StoredTrack, "id"> & { id: number; audio: string; cover: string | null })[];
  playlists: StoredPlaylist[];
  themes: StoredTheme[];
  lyrics: StoredLyric[];
};

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new ApiError(500, "local_storage_unavailable"));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("tracks")) db.createObjectStore("tracks", { keyPath: "id" });
      if (!db.objectStoreNames.contains("playlists"))
        db.createObjectStore("playlists", { keyPath: "id" });
      if (!db.objectStoreNames.contains("themes")) db.createObjectStore("themes", { keyPath: "id" });
      if (!db.objectStoreNames.contains("lyrics"))
        db.createObjectStore("lyrics", { keyPath: "trackId" });
      if (!db.objectStoreNames.contains("settings")) db.createObjectStore("settings");
      if (!db.objectStoreNames.contains("files")) db.createObjectStore("files");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new ApiError(500, "local_storage_unavailable"));
  });
  return dbPromise;
}

function wrap<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new ApiError(500, "local_storage_failed"));
  });
}

async function withStore<T>(
  name: string,
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => Promise<T>,
): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(name, mode);
    const store = transaction.objectStore(name);
    let result: T | undefined;
    let settled = false;
    const fail = () => {
      if (settled) return;
      settled = true;
      reject(new ApiError(500, "local_storage_failed"));
    };
    transaction.oncomplete = () => {
      if (settled) return;
      settled = true;
      resolve(result as T);
    };
    transaction.onerror = fail;
    transaction.onabort = fail;
    run(store).then((value) => {
      result = value;
    }, fail);
  });
}

function list<T>(name: string): Promise<T[]> {
  return withStore<T[]>(name, "readonly", (store) => wrap(store.getAll() as IDBRequest<T[]>));
}

function read<T>(name: string, key: IDBValidKey): Promise<T | undefined> {
  return withStore<T | undefined>(name, "readonly", (store) =>
    wrap(store.get(key) as IDBRequest<T | undefined>),
  );
}

function write(name: string, value: unknown, key?: IDBValidKey): Promise<IDBValidKey> {
  return withStore<IDBValidKey>(name, "readwrite", (store) =>
    wrap(key === undefined ? store.put(value) : store.put(value, key)),
  );
}

function remove(name: string, key: IDBValidKey): Promise<undefined> {
  return withStore<undefined>(name, "readwrite", (store) =>
    wrap(store.delete(key) as IDBRequest<undefined>),
  );
}

function maxOf(values: number[]): number {
  return values.reduce((top, value) => (value > top ? value : top), 0);
}

const counters = { track: 0, playlist: 0, theme: 0 };
let countersReady: Promise<void> | null = null;

function numericThemeId(id: string): number {
  const tail = Number(id.split(":")[1] ?? 0);
  return Number.isFinite(tail) ? tail : 0;
}

function ensureCounters(): Promise<void> {
  if (!countersReady) {
    countersReady = (async () => {
      const [tracks, playlists, themes] = await Promise.all([
        list<StoredTrack>("tracks"),
        list<StoredPlaylist>("playlists"),
        list<StoredTheme>("themes"),
      ]);
      counters.track = maxOf(tracks.map((item) => item.id));
      counters.playlist = maxOf(playlists.map((item) => item.id));
      counters.theme = maxOf(themes.map((item) => numericThemeId(item.id)));
    })();
  }
  return countersReady;
}

function resetCounters() {
  countersReady = null;
  counters.track = 0;
  counters.playlist = 0;
  counters.theme = 0;
}

const mediaUrls = new Map<string, string>();

function mediaUrl(key: string, blob: Blob): string {
  const cached = mediaUrls.get(key);
  if (cached) return cached;
  const url = URL.createObjectURL(blob);
  mediaUrls.set(key, url);
  return url;
}

function dropMediaUrl(key: string) {
  const cached = mediaUrls.get(key);
  if (!cached) return;
  URL.revokeObjectURL(cached);
  mediaUrls.delete(key);
}

function nowIso(): string {
  return new Date().toISOString();
}

function fileStem(name: string): string {
  return name.replace(/\.[^.]+$/, "").trim();
}

async function toTrack(row: StoredTrack): Promise<Track> {
  const audio = await read<Blob>("files", `audio:${row.id}`);
  const streamUrl = audio ? mediaUrl(`audio:${row.id}`, audio) : "";
  const cover = row.coverMime ? await read<Blob>("files", `cover:${row.id}`) : undefined;
  return {
    id: row.id,
    title: row.title,
    artist: row.artist,
    album: row.album,
    duration: row.duration,
    source: row.source,
    sourceId: row.sourceId,
    streamUrl,
    downloadUrl: streamUrl,
    coverUrl: cover ? mediaUrl(`cover:${row.id}`, cover) : null,
    license: row.license,
    local: row.local,
    createdAt: row.createdAt,
  };
}

function toPlaylist(row: StoredPlaylist, known: Set<number>): Playlist {
  const trackIds = row.trackIds.filter((id) => known.has(id));
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    trackCount: trackIds.length,
    trackIds,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

async function themeList(): Promise<Theme[]> {
  const own = await list<StoredTheme>("themes");
  return [
    ...BUILTIN_THEMES,
    ...own
      .slice()
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map((item) => ({
        id: item.id,
        numericId: numericThemeId(item.id),
        name: item.name,
        description: item.description,
        builtin: false,
        tokens: item.tokens,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      })),
  ];
}

async function readSettings(): Promise<StoredSettings> {
  const stored = await read<StoredSettings>("settings", SETTINGS_KEY);
  if (stored) return stored;
  return { activeTheme: DEFAULT_THEME_ID, preferences: {}, updatedAt: null };
}

function settingsView(row: StoredSettings): Settings {
  return {
    activeTheme: row.activeTheme,
    preferences: row.preferences,
    updatedAt: row.updatedAt,
  };
}

async function writeSettings(next: StoredSettings): Promise<Settings> {
  await write("settings", next, SETTINGS_KEY);
  return settingsView(next);
}

async function cacheStats(): Promise<CacheStats> {
  const rows = await list<StoredTrack>("tracks");
  let coverFiles = 0;
  let audioFiles = 0;
  let audioBytes = 0;
  for (const row of rows) {
    audioFiles += 1;
    audioBytes += row.bytes;
    if (row.coverMime) coverFiles += 1;
  }
  return {
    covers: { files: coverFiles, bytes: 0 },
    audio: { files: audioFiles, bytes: audioBytes },
    orphans: { files: 0, bytes: 0 },
  };
}

async function tracksOf(ids: number[]): Promise<Track[]> {
  const rows = await list<StoredTrack>("tracks");
  const byId = new Map(rows.map((row) => [row.id, row]));
  const result: Track[] = [];
  for (const id of ids) {
    const row = byId.get(id);
    if (row) result.push(await toTrack(row));
  }
  return result;
}

async function probeDuration(blob: Blob): Promise<number | null> {
  return new Promise<number | null>((resolve) => {
    const url = URL.createObjectURL(blob);
    const audio = document.createElement("audio");
    let settled = false;
    const finish = (value: number | null) => {
      if (settled) return;
      settled = true;
      audio.removeAttribute("src");
      URL.revokeObjectURL(url);
      resolve(value);
    };
    audio.preload = "metadata";
    audio.onloadedmetadata = () =>
      finish(Number.isFinite(audio.duration) && audio.duration > 0 ? Math.round(audio.duration) : null);
    audio.onerror = () => finish(null);
    audio.src = url;
    window.setTimeout(() => finish(null), 6000);
  });
}

async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const raw = typeof reader.result === "string" ? reader.result : "";
      const comma = raw.indexOf(",");
      resolve(comma >= 0 ? raw.slice(comma + 1) : raw);
    };
    reader.onerror = () => reject(new ApiError(500, "local_backup_failed"));
    reader.readAsDataURL(blob);
  });
}

function base64ToBlob(base64: string, mime: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type: mime });
}

function requireString(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new ApiError(400, code);
  return value.trim();
}

function unsupported(code: string): Promise<never> {
  return Promise.reject(new ApiError(409, code));
}

export const localApi = {
  register(_username: string, _password: string) {
    return Promise.resolve<AuthResponse>({ token: LOCAL_TOKEN, user: LOCAL_USER });
  },

  login(_username: string, _password: string) {
    return Promise.resolve<AuthResponse>({ token: LOCAL_TOKEN, user: LOCAL_USER });
  },

  me() {
    return Promise.resolve({ user: LOCAL_USER });
  },

  async sync(): Promise<SyncResponse> {
    const [rows, playlists, themes] = await Promise.all([
      list<StoredTrack>("tracks"),
      list<StoredPlaylist>("playlists"),
      themeList(),
    ]);
    const known = new Set(rows.map((row) => row.id));
    const tracks: Track[] = [];
    for (const row of rows.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt))) {
      tracks.push(await toTrack(row));
    }
    return {
      user: LOCAL_USER,
      tracks,
      playlists: playlists
        .slice()
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        .map((item) => toPlaylist(item, known)),
      themes,
      sources: LOCAL_SOURCES,
      syncedAt: nowIso(),
    };
  },

  search(query: string): Promise<SearchResponse> {
    void query;
    return Promise.resolve({
      results: [],
      status: LOCAL_SOURCES.map((item) => ({
        id: item.id,
        name: item.name,
        ok: true,
        count: 0,
      })),
      cached: false,
    });
  },

  importTrack(): Promise<{ track: Track; duplicated: boolean }> {
    return unsupported("local_import_unsupported");
  },

  async uploadTrack(
    file: File,
    meta: { title?: string; artist?: string; album?: string } = {},
  ): Promise<{ track: Track }> {
    await ensureCounters();
    counters.track += 1;
    const id = counters.track;
    const duration = await probeDuration(file);
    const row: StoredTrack = {
      id,
      title: meta.title?.trim() || fileStem(file.name) || `本地曲目 ${id}`,
      artist: meta.artist?.trim() || "本地文件",
      album: meta.album?.trim() || "未分类",
      duration,
      source: "local",
      sourceId: null,
      license: null,
      local: true,
      createdAt: nowIso(),
      audioMime: file.type || "audio/mpeg",
      fileName: file.name,
      bytes: file.size,
      coverMime: null,
    };
    await write("files", file, `audio:${id}`);
    await write("tracks", row);
    return { track: await toTrack(row) };
  },

  async deleteTrack(id: number): Promise<{ deleted: boolean }> {
    await remove("tracks", id);
    await remove("files", `audio:${id}`);
    await remove("files", `cover:${id}`);
    await remove("lyrics", id);
    dropMediaUrl(`audio:${id}`);
    dropMediaUrl(`cover:${id}`);
    const playlists = await list<StoredPlaylist>("playlists");
    const touched = playlists.filter((item) => item.trackIds.includes(id));
    for (const item of touched) {
      const next = { ...item, trackIds: item.trackIds.filter((value) => value !== id), updatedAt: nowIso() };
      await write("playlists", next);
    }
    return { deleted: true };
  },

  async updateTrack(
    id: number,
    patch: Partial<Pick<Track, "title" | "artist" | "album">>,
  ): Promise<{ track: Track }> {
    const row = await read<StoredTrack>("tracks", id);
    if (!row) throw new ApiError(404, "track_not_found");
    const next: StoredTrack = {
      ...row,
      title: patch.title?.trim() || row.title,
      artist: patch.artist?.trim() || row.artist,
      album: patch.album?.trim() || row.album,
    };
    await write("tracks", next);
    return { track: await toTrack(next) };
  },

  async createPlaylist(name: string, description = ""): Promise<{ playlist: Playlist }> {
    await ensureCounters();
    counters.playlist += 1;
    const stamp = nowIso();
    const row: StoredPlaylist = {
      id: counters.playlist,
      name: requireString(name, "playlist_name_required"),
      description: description.trim(),
      trackIds: [],
      createdAt: stamp,
      updatedAt: stamp,
    };
    await write("playlists", row);
    return { playlist: toPlaylist(row, new Set()) };
  },

  async playlist(id: number): Promise<{ playlist: Playlist; tracks: Track[] }> {
    const row = await read<StoredPlaylist>("playlists", id);
    if (!row) throw new ApiError(404, "playlist_not_found");
    const rows = await list<StoredTrack>("tracks");
    const known = new Set(rows.map((item) => item.id));
    return { playlist: toPlaylist(row, known), tracks: await tracksOf(row.trackIds) };
  },

  async updatePlaylist(
    id: number,
    patch: { name?: string; description?: string },
  ): Promise<{ playlist: Playlist }> {
    const row = await read<StoredPlaylist>("playlists", id);
    if (!row) throw new ApiError(404, "playlist_not_found");
    const next: StoredPlaylist = {
      ...row,
      name: patch.name?.trim() || row.name,
      description: patch.description !== undefined ? patch.description.trim() : row.description,
      updatedAt: nowIso(),
    };
    await write("playlists", next);
    const rows = await list<StoredTrack>("tracks");
    return { playlist: toPlaylist(next, new Set(rows.map((item) => item.id))) };
  },

  async deletePlaylist(id: number): Promise<{ deleted: boolean }> {
    await remove("playlists", id);
    return { deleted: true };
  },

  async addTrackToPlaylist(
    playlistId: number,
    trackId: number,
  ): Promise<{ playlist: Playlist; duplicated: boolean }> {
    const row = await read<StoredPlaylist>("playlists", playlistId);
    if (!row) throw new ApiError(404, "playlist_not_found");
    const track = await read<StoredTrack>("tracks", trackId);
    if (!track) throw new ApiError(404, "track_not_found");
    const duplicated = row.trackIds.includes(trackId);
    const next: StoredPlaylist = duplicated
      ? row
      : { ...row, trackIds: [...row.trackIds, trackId], updatedAt: nowIso() };
    if (!duplicated) await write("playlists", next);
    const rows = await list<StoredTrack>("tracks");
    return { playlist: toPlaylist(next, new Set(rows.map((item) => item.id))), duplicated };
  },

  async removeTrackFromPlaylist(
    playlistId: number,
    trackId: number,
  ): Promise<{ playlist: Playlist }> {
    const row = await read<StoredPlaylist>("playlists", playlistId);
    if (!row) throw new ApiError(404, "playlist_not_found");
    const next: StoredPlaylist = {
      ...row,
      trackIds: row.trackIds.filter((id) => id !== trackId),
      updatedAt: nowIso(),
    };
    await write("playlists", next);
    const rows = await list<StoredTrack>("tracks");
    return { playlist: toPlaylist(next, new Set(rows.map((item) => item.id))) };
  },

  async reorderPlaylist(playlistId: number, trackIds: number[]) {
    const row = await read<StoredPlaylist>("playlists", playlistId);
    if (!row) throw new ApiError(404, "playlist_not_found");
    const allowed = new Set(row.trackIds);
    const ordered = trackIds.filter((id) => allowed.has(id));
    for (const id of row.trackIds) {
      if (!ordered.includes(id)) ordered.push(id);
    }
    const next: StoredPlaylist = { ...row, trackIds: ordered, updatedAt: nowIso() };
    await write("playlists", next);
    const rows = await list<StoredTrack>("tracks");
    return { playlist: toPlaylist(next, new Set(rows.map((item) => item.id))) };
  },

  async createTheme(name: string, tokens: ThemeTokens): Promise<{ theme: Theme }> {
    await ensureCounters();
    counters.theme += 1;
    const stamp = nowIso();
    const row: StoredTheme = {
      id: `user:${counters.theme}`,
      name: requireString(name, "theme_name_required"),
      description: "自定义主题",
      tokens,
      createdAt: stamp,
      updatedAt: stamp,
    };
    await write("themes", row);
    return {
      theme: {
        id: row.id,
        numericId: counters.theme,
        name: row.name,
        description: row.description,
        builtin: false,
        tokens: row.tokens,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      },
    };
  },

  async updateTheme(id: string, patch: { name?: string; tokens?: ThemeTokens }) {
    if (!id.startsWith("user:")) throw new ApiError(400, "theme_builtin_readonly");
    const row = await read<StoredTheme>("themes", id);
    if (!row) throw new ApiError(404, "theme_not_found");
    const next: StoredTheme = {
      ...row,
      name: patch.name?.trim() || row.name,
      tokens: patch.tokens ? { ...row.tokens, ...patch.tokens } : row.tokens,
      updatedAt: nowIso(),
    };
    await write("themes", next);
    return {
      theme: {
        id: next.id,
        numericId: numericThemeId(next.id),
        name: next.name,
        description: next.description,
        builtin: false,
        tokens: next.tokens,
        createdAt: next.createdAt,
        updatedAt: next.updatedAt,
      },
    };
  },

  async deleteTheme(id: string): Promise<{ deleted: boolean }> {
    if (!id.startsWith("user:")) throw new ApiError(400, "theme_builtin_readonly");
    await remove("themes", id);
    const current = await readSettings();
    if (current.activeTheme === id) {
      await writeSettings({ ...current, activeTheme: DEFAULT_THEME_ID, updatedAt: nowIso() });
    }
    return { deleted: true };
  },

  async getSettings(): Promise<{ settings: Settings }> {
    return { settings: settingsView(await readSettings()) };
  },

  async patchSettings(patch: {
    activeTheme?: string;
    preferences?: Record<string, unknown>;
  }): Promise<{ settings: Settings }> {
    const current = await readSettings();
    let activeTheme = current.activeTheme;
    if (typeof patch.activeTheme === "string") {
      const themes = await themeList();
      if (themes.some((item) => item.id === patch.activeTheme)) activeTheme = patch.activeTheme;
    }
    const next: StoredSettings = {
      activeTheme,
      preferences: patch.preferences
        ? { ...current.preferences, ...patch.preferences }
        : current.preferences,
      updatedAt: nowIso(),
    };
    return { settings: await writeSettings(next) };
  },

  biliQr(): Promise<BiliQr> {
    return unsupported("local_bili_unavailable");
  },

  biliQrPoll(_key: string): Promise<BiliQrPoll> {
    return unsupported("local_bili_unavailable");
  },

  biliAccount(): Promise<{ account: BiliAccount | null; expired?: boolean }> {
    return Promise.resolve({ account: null });
  },

  biliLogout(): Promise<{ removed: boolean }> {
    return Promise.resolve({ removed: false });
  },

  biliFolders(): Promise<{ folders: BiliFolder[] }> {
    return unsupported("local_bili_unavailable");
  },

  biliFolderItems(_id: number, _page = 1, _pageSize = 20): Promise<BiliFavPage> {
    return unsupported("local_bili_unavailable");
  },

  biliVideo(_bvid: string): Promise<{ video: BiliVideo }> {
    return unsupported("local_bili_unavailable");
  },

  biliDownload(_bvid: string, _cid?: number): Promise<{ track: Track; duplicated: boolean }> {
    return unsupported("local_bili_unavailable");
  },

  async getLyric(trackId: number): Promise<{ lyric: Lyric | null }> {
    const row = await read<StoredLyric>("lyrics", trackId);
    if (!row) return { lyric: null };
    return {
      lyric: {
        trackId: row.trackId,
        lrc: row.lrc,
        source: row.source,
        updatedAt: row.updatedAt,
      },
    };
  },

  async saveLyric(trackId: number, lrc: string, source = "manual"): Promise<{ lyric: Lyric }> {
    const row: StoredLyric = { trackId, lrc, source, updatedAt: nowIso() };
    await write("lyrics", row);
    return { lyric: { ...row } };
  },

  async deleteLyric(trackId: number): Promise<{ removed: boolean }> {
    await remove("lyrics", trackId);
    return { removed: true };
  },

  searchLyrics(): Promise<{ results: LyricSearchItem[] }> {
    return Promise.resolve({ results: [] });
  },

  generateLyric(): Promise<{ lyric: Lyric }> {
    return unsupported("local_lyrics_unavailable");
  },

  async getCache(): Promise<{ cache: CacheStats }> {
    return { cache: await cacheStats() };
  },

  async clearCache(target: "covers" | "orphans" | "all"): Promise<{
    removed: number;
    cache: CacheStats;
  }> {
    const rows = await list<StoredTrack>("tracks");
    let removed = 0;
    if (target !== "orphans") {
      for (const row of rows) {
        if (!row.coverMime) continue;
        await remove("files", `cover:${row.id}`);
        await write("tracks", { ...row, coverMime: null });
        dropMediaUrl(`cover:${row.id}`);
        removed += 1;
      }
    }
    return { removed, cache: await cacheStats() };
  },

  async exportData(): Promise<LocalBackup> {
    const [rows, playlists, themes, lyrics, settings] = await Promise.all([
      list<StoredTrack>("tracks"),
      list<StoredPlaylist>("playlists"),
      list<StoredTheme>("themes"),
      list<StoredLyric>("lyrics"),
      readSettings(),
    ]);
    const tracks: LocalBackup["tracks"] = [];
    for (const row of rows) {
      const audio = await read<Blob>("files", `audio:${row.id}`);
      if (!audio) continue;
      const cover = row.coverMime ? await read<Blob>("files", `cover:${row.id}`) : undefined;
      tracks.push({
        ...row,
        audio: await blobToBase64(audio),
        cover: cover ? await blobToBase64(cover) : null,
      });
    }
    return {
      app: "xiaoyun-local",
      version: 1,
      exportedAt: nowIso(),
      settings,
      tracks,
      playlists,
      themes,
      lyrics,
    };
  },

  async importData(payload: LocalBackup): Promise<{ tracks: number; playlists: number }> {
    if (!payload || payload.app !== "xiaoyun-local" || payload.version !== 1) {
      throw new ApiError(400, "local_backup_invalid");
    }
    for (const row of await list<StoredTrack>("tracks")) {
      dropMediaUrl(`audio:${row.id}`);
      dropMediaUrl(`cover:${row.id}`);
    }
    for (const store of ["tracks", "playlists", "themes", "lyrics", "files"]) {
      await withStore<undefined>(store, "readwrite", (item) => wrap(item.clear() as IDBRequest<undefined>));
    }
    for (const item of payload.tracks ?? []) {
      const { audio, cover, ...row } = item;
      const audioBlob = base64ToBlob(audio, row.audioMime || "audio/mpeg");
      await write("files", audioBlob, `audio:${row.id}`);
      if (cover) {
        const coverBlob = base64ToBlob(cover, row.coverMime || "image/jpeg");
        await write("files", coverBlob, `cover:${row.id}`);
      }
      await write("tracks", row);
    }
    for (const row of payload.playlists ?? []) await write("playlists", row);
    for (const row of payload.themes ?? []) await write("themes", row);
    for (const row of payload.lyrics ?? []) await write("lyrics", row);
    await write(
      "settings",
      {
        activeTheme: payload.settings?.activeTheme ?? DEFAULT_THEME_ID,
        preferences: payload.settings?.preferences ?? {},
        updatedAt: nowIso(),
      },
      SETTINGS_KEY,
    );
    resetCounters();
    await ensureCounters();
    return { tracks: payload.tracks?.length ?? 0, playlists: payload.playlists?.length ?? 0 };
  },

  async clearAll(): Promise<{ cleared: boolean }> {
    for (const row of await list<StoredTrack>("tracks")) {
      dropMediaUrl(`audio:${row.id}`);
      dropMediaUrl(`cover:${row.id}`);
    }
    for (const store of ["tracks", "playlists", "themes", "lyrics", "files", "settings"]) {
      await withStore<undefined>(store, "readwrite", (item) => wrap(item.clear() as IDBRequest<undefined>));
    }
    resetCounters();
    return { cleared: true };
  },
};
