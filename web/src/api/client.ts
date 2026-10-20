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
  SyncResponse,
  Theme,
  ThemeTokens,
  Track,
} from "./types";

const TOKEN_KEY = "xiaoyun.token";
const API_BASE_KEY = "xiaoyun.apiBase";
const RESOLVED_BASE_KEY = "xiaoyun.apiBaseResolved";
const ENV_BASE = (import.meta.env.VITE_API_BASE ?? "").trim();
const DEFAULT_BASE = "https://music.lichenlc.cn";
const CONFIG_URLS = [
  (import.meta.env.VITE_CONFIG_URL ?? "").trim(),
  "https://cdn.jsdelivr.net/gh/SouthNight06/BlueBerryCloud@main/client-config.json",
  "https://fastly.jsdelivr.net/gh/SouthNight06/BlueBerryCloud@main/client-config.json",
].filter(Boolean);

const IP_HOST = /^\d{1,3}(\.\d{1,3}){3}$/;

export function normalizeApiBase(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, "");
  if (!trimmed) return "";
  return /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
}

function readRaw(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeRaw(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* storage unavailable — keeps the in-memory value */
  }
}

function dropRaw(key: string) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* storage unavailable */
  }
}

function readStoredBase(): string {
  const override = readRaw(API_BASE_KEY);
  if (override !== null) return normalizeApiBase(override);
  if (isNativeApp()) {
    const resolved = readRaw(RESOLVED_BASE_KEY);
    if (resolved) return normalizeApiBase(resolved);
    return normalizeApiBase(ENV_BASE) || DEFAULT_BASE;
  }
  return normalizeApiBase(ENV_BASE);
}

let apiBase = readStoredBase();

export function getApiBase(): string {
  return apiBase;
}

export function setApiBase(value: string) {
  apiBase = normalizeApiBase(value);
  writeRaw(API_BASE_KEY, apiBase);
}

export function resetApiBase(): string {
  dropRaw(API_BASE_KEY);
  dropRaw(RESOLVED_BASE_KEY);
  apiBase = readStoredBase();
  return apiBase;
}

export function describeApiBase(base = apiBase): string {
  if (!base) return "尚未设置服务器地址";
  try {
    const url = new URL(base);
    if (IP_HOST.test(url.hostname)) return "自定义服务器（地址已隐藏）";
    return `云端 · ${url.host}`;
  } catch {
    return "自定义服务器";
  }
}

type NativeWindow = Window & {
  Capacitor?: { isNativePlatform?: () => boolean };
};

export function isNativeApp(): boolean {
  try {
    return Boolean((window as NativeWindow).Capacitor?.isNativePlatform?.());
  } catch {
    return false;
  }
}

function resolveUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return apiBase ? `${apiBase}${path}` : path;
}

function fetchWithTimeout(url: string, init: RequestInit, ms: number): Promise<Response> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), ms);
  return fetch(url, { ...init, signal: controller.signal }).finally(() =>
    window.clearTimeout(timer),
  );
}

export type ProbeResult = "ok" | "foreign" | "unreachable";

export async function probeServer(value: string, timeoutMs = 6000): Promise<ProbeResult> {
  const base = normalizeApiBase(value);
  if (!base) return "unreachable";
  try {
    const response = await fetchWithTimeout(`${base}/api/health`, { method: "GET" }, timeoutMs);
    if (!response.ok) return "foreign";
    const payload = (await response.json()) as Record<string, unknown> | null;
    if (!payload || payload.ok !== true) return "foreign";
    if (typeof payload.name === "string" && payload.name) {
      return payload.name === "cloudmusic" || payload.name === "aurora-music" ? "ok" : "foreign";
    }
    const marked = typeof payload.authMode === "string" || "originalConnected" in payload;
    return marked ? "ok" : "foreign";
  } catch {
    return "unreachable";
  }
}

export async function checkServer(value: string): Promise<boolean> {
  return (await probeServer(value)) === "ok";
}

export async function syncApiBase(): Promise<string> {
  if (!isNativeApp() || readRaw(API_BASE_KEY) !== null) return apiBase;
  for (const url of CONFIG_URLS) {
    try {
      const response = await fetchWithTimeout(url, { cache: "no-store" }, 2200);
      if (!response.ok) continue;
      const payload = (await response.json()) as { apiBase?: unknown };
      const candidate = normalizeApiBase(
        typeof payload?.apiBase === "string" ? payload.apiBase : "",
      );
      if (!candidate || candidate === apiBase) continue;
      if ((await probeServer(candidate, 4000)) !== "ok") continue;
      writeRaw(RESOLVED_BASE_KEY, candidate);
      apiBase = candidate;
      return apiBase;
    } catch {
      /* 换下一个镜像 */
    }
  }
  return apiBase;
}

export class ApiError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string) {
    super(code);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

export function readStoredToken(): string | null {
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function storeToken(token: string | null) {
  try {
    if (token) window.localStorage.setItem(TOKEN_KEY, token);
    else window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage unavailable — session stays in memory */
  }
}

let inMemoryToken = readStoredToken();

export function setToken(token: string | null) {
  inMemoryToken = token;
  storeToken(token);
}

export function currentToken(): string | null {
  return inMemoryToken;
}

export function withToken(url: string): string {
  const absolute = resolveUrl(url);
  if (!inMemoryToken) return absolute;
  const separator = absolute.includes("?") ? "&" : "?";
  return `${absolute}${separator}token=${encodeURIComponent(inMemoryToken)}`;
}

type RequestOptions = {
  method?: string;
  json?: unknown;
  form?: FormData;
  signal?: AbortSignal;
};

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (inMemoryToken) headers.Authorization = `Bearer ${inMemoryToken}`;
  if (options.json !== undefined) headers["Content-Type"] = "application/json";

  let response: Response;
  try {
    response = await fetch(resolveUrl(path), {
      method: options.method ?? (options.json !== undefined || options.form ? "POST" : "GET"),
      headers,
      body:
        options.json !== undefined
          ? JSON.stringify(options.json)
          : options.form
            ? options.form
            : undefined,
      signal: options.signal,
    });
  } catch {
    throw new ApiError(0, "network_unreachable");
  }

  if (response.status === 204) return undefined as T;

  const raw = await response.text();
  const payload = raw ? safeJson(raw) : {};

  if (!response.ok) {
    const code = typeof payload?.error === "string" ? payload.error : `http_${response.status}`;
    if (response.status === 401 && path !== "/api/auth/login" && path !== "/api/auth/register") {
      setToken(null);
      window.dispatchEvent(new Event("xiaoyun:unauthorized"));
    }
    throw new ApiError(response.status, code);
  }

  return payload as T;
}

function safeJson(raw: string): Record<string, unknown> | null {
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export const api = {
  register(username: string, password: string) {
    return request<AuthResponse>("/api/auth/register", { json: { username, password } });
  },

  login(username: string, password: string) {
    return request<AuthResponse>("/api/auth/login", { json: { username, password } });
  },

  me() {
    return request<{ user: PublicUser }>("/api/auth/me");
  },

  sync() {
    return request<SyncResponse>("/api/sync");
  },

  search(query: string, source: string, signal?: AbortSignal) {
    const params = new URLSearchParams({ q: query, source });
    return request<SearchResponse>(`/api/search?${params.toString()}`, { signal });
  },

  importTrack(source: string, sourceId: string) {
    return request<{ track: Track; duplicated: boolean }>("/api/tracks/import", {
      json: { source, sourceId },
    });
  },

  uploadTrack(file: File, meta: { title?: string; artist?: string; album?: string } = {}) {
    const form = new FormData();
    form.append("file", file);
    if (meta.title) form.append("title", meta.title);
    if (meta.artist) form.append("artist", meta.artist);
    if (meta.album) form.append("album", meta.album);
    return request<{ track: Track }>("/api/tracks/upload", { form });
  },

  deleteTrack(id: number) {
    return request<{ deleted: boolean }>(`/api/tracks/${id}`, { method: "DELETE" });
  },

  updateTrack(id: number, patch: Partial<Pick<Track, "title" | "artist" | "album">>) {
    return request<{ track: Track }>(`/api/tracks/${id}`, {
      method: "PATCH",
      json: patch,
    });
  },

  createPlaylist(name: string, description = "") {
    return request<{ playlist: Playlist }>("/api/playlists", {
      json: { name, description },
    });
  },

  playlist(id: number) {
    return request<{ playlist: Playlist; tracks: Track[] }>(`/api/playlists/${id}`);
  },

  updatePlaylist(id: number, patch: { name?: string; description?: string }) {
    return request<{ playlist: Playlist }>(`/api/playlists/${id}`, {
      method: "PATCH",
      json: patch,
    });
  },

  deletePlaylist(id: number) {
    return request<{ deleted: boolean }>(`/api/playlists/${id}`, { method: "DELETE" });
  },

  addTrackToPlaylist(playlistId: number, trackId: number) {
    return request<{ playlist: Playlist; duplicated: boolean }>(
      `/api/playlists/${playlistId}/tracks`,
      { json: { trackId } },
    );
  },

  removeTrackFromPlaylist(playlistId: number, trackId: number) {
    return request<{ playlist: Playlist }>(`/api/playlists/${playlistId}/tracks/${trackId}`, {
      method: "DELETE",
    });
  },

  reorderPlaylist(playlistId: number, trackIds: number[]) {
    return request<{ playlist: Playlist }>(`/api/playlists/${playlistId}/order`, {
      method: "PATCH",
      json: { trackIds },
    });
  },

  createTheme(name: string, tokens: ThemeTokens) {
    return request<{ theme: Theme }>("/api/themes", { json: { name, tokens } });
  },

  updateTheme(id: string, patch: { name?: string; tokens?: ThemeTokens }) {
    return request<{ theme: Theme }>(`/api/themes/${encodeURIComponent(id)}`, {
      method: "PATCH",
      json: patch,
    });
  },

  deleteTheme(id: string) {
    return request<{ deleted: boolean }>(`/api/themes/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  },

  getSettings() {
    return request<{ settings: Settings }>("/api/settings");
  },

  patchSettings(patch: { activeTheme?: string; preferences?: Record<string, unknown> }) {
    return request<{ settings: Settings }>("/api/settings", {
      method: "PATCH",
      json: patch,
    });
  },

  biliQr() {
    return request<BiliQr>("/api/bilibili/qr");
  },

  biliQrPoll(key: string) {
    return request<BiliQrPoll>(`/api/bilibili/qr/poll?key=${encodeURIComponent(key)}`);
  },

  biliAccount() {
    return request<{ account: BiliAccount | null; expired?: boolean }>("/api/bilibili/account");
  },

  biliLogout() {
    return request<{ removed: boolean }>("/api/bilibili/account", { method: "DELETE" });
  },

  biliFolders() {
    return request<{ folders: BiliFolder[] }>("/api/bilibili/folders");
  },

  biliFolderItems(id: number, page = 1, pageSize = 20) {
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    return request<BiliFavPage>(`/api/bilibili/folders/${id}/items?${params.toString()}`);
  },

  biliVideo(bvid: string) {
    return request<{ video: BiliVideo }>(`/api/bilibili/video/${encodeURIComponent(bvid)}`);
  },

  biliDownload(bvid: string, cid?: number) {
    return request<{ track: Track; duplicated: boolean }>("/api/bilibili/download", {
      json: cid ? { bvid, cid } : { bvid },
    });
  },

  getLyric(trackId: number) {
    return request<{ lyric: Lyric | null }>(`/api/tracks/${trackId}/lyric`);
  },

  saveLyric(trackId: number, lrc: string, source = "manual") {
    return request<{ lyric: Lyric }>(`/api/tracks/${trackId}/lyric`, {
      method: "PUT",
      json: { lrc, source },
    });
  },

  deleteLyric(trackId: number) {
    return request<{ removed: boolean }>(`/api/tracks/${trackId}/lyric`, { method: "DELETE" });
  },

  searchLyrics(query: string, artist = "", duration = 0) {
    const params = new URLSearchParams({ q: query });
    if (artist) params.set("artist", artist);
    if (duration > 0) params.set("duration", String(Math.round(duration)));
    return request<{ results: LyricSearchItem[] }>(`/api/lyrics/search?${params.toString()}`);
  },

  generateLyric(trackId: number, input: { duration?: number; hint?: string; language?: string } = {}) {
    return request<{ lyric: Lyric }>(`/api/tracks/${trackId}/lyric/ai`, { json: input });
  },

  getCache() {
    return request<{ cache: CacheStats }>("/api/cache");
  },

  clearCache(target: "covers" | "orphans" | "all") {
    return request<{ removed: number; cache: CacheStats }>("/api/cache/clear", {
      json: { target },
    });
  },
};
