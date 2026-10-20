import type {
  AuthResponse,
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
const ENV_BASE = (import.meta.env.VITE_API_BASE ?? "").trim();

export function normalizeApiBase(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, "");
  if (!trimmed) return "";
  return /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
}

function readStoredBase(): string {
  try {
    const stored = window.localStorage.getItem(API_BASE_KEY);
    if (stored !== null) return normalizeApiBase(stored);
  } catch {
    /* storage unavailable */
  }
  return normalizeApiBase(ENV_BASE);
}

let apiBase = readStoredBase();

export function getApiBase(): string {
  return apiBase;
}

export function setApiBase(value: string) {
  apiBase = normalizeApiBase(value);
  try {
    window.localStorage.setItem(API_BASE_KEY, apiBase);
  } catch {
    /* storage unavailable — keeps the in-memory value */
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

export async function checkServer(value: string): Promise<boolean> {
  const base = normalizeApiBase(value);
  try {
    const response = await fetch(`${base}/api/health`, { method: "GET" });
    if (!response.ok) return false;
    const payload = (await response.json()) as { name?: string };
    return payload?.name === "xiaoyun-changting";
  } catch {
    return false;
  }
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
};
