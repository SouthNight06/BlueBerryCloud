import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { api, withToken } from "../api/client";
import type {
  Playlist,
  PublicUser,
  SearchResult,
  Settings,
  SourceInfo,
  Theme,
  ThemeTokens,
  Track,
} from "../api/types";
import { describeError } from "../lib/format";
import { applyTokens } from "../lib/theme";
import { useToast } from "./ToastStore";

type AppValue = {
  user: PublicUser;
  tracks: Track[];
  playlists: Playlist[];
  themes: Theme[];
  sources: SourceInfo[];
  settings: Settings | null;
  activeThemeId: string;
  syncedAt: string;
  status: "loading" | "ready" | "error";
  trackById: (id: number) => Track | undefined;
  attempt: <T>(action: () => Promise<T>) => Promise<T | null>;
  refresh: () => Promise<void>;
  ensureTrack: (result: SearchResult) => Promise<Track>;
  adoptTrack: (track: Track) => void;
  updatePreferences: (patch: Record<string, unknown>) => Promise<void>;
  uploadTrack: (file: File) => Promise<Track>;
  deleteTrack: (id: number) => Promise<void>;
  downloadTrack: (track: Track) => void;
  createPlaylist: (name: string, description?: string) => Promise<Playlist>;
  updatePlaylist: (id: number, patch: { name?: string; description?: string }) => Promise<void>;
  deletePlaylist: (id: number) => Promise<void>;
  addToPlaylist: (playlistId: number, trackId: number) => Promise<boolean>;
  removeFromPlaylist: (playlistId: number, trackId: number) => Promise<void>;
  moveInPlaylist: (playlistId: number, trackId: number, direction: -1 | 1) => Promise<void>;
  saveTheme: (input: { id?: string; name: string; tokens: ThemeTokens }) => Promise<Theme>;
  deleteTheme: (id: string) => Promise<void>;
  setActiveTheme: (id: string) => Promise<void>;
  logout: () => void;
};

const AppContext = createContext<AppValue | null>(null);

export function AppProvider({
  user,
  onLogout,
  children,
}: {
  user: PublicUser;
  onLogout: () => void;
  children: ReactNode;
}) {
  const { push } = useToast();
  const [tracks, setTracks] = useState<Track[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [themes, setThemes] = useState<Theme[]>([]);
  const [sources, setSources] = useState<SourceInfo[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [activeThemeId, setActiveThemeId] = useState("");
  const [syncedAt, setSyncedAt] = useState("");
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  const attempt = useCallback(
    async <T,>(action: () => Promise<T>): Promise<T | null> => {
      try {
        return await action();
      } catch (error) {
        push(describeError(error), "error");
        return null;
      }
    },
    [push],
  );

  const refresh = useCallback(async () => {
    const [data, remote] = await Promise.all([api.sync(), api.getSettings()]);
    setTracks(data.tracks);
    setPlaylists(data.playlists);
    setThemes(data.themes);
    setSources(data.sources);
    setSyncedAt(data.syncedAt);
    setSettings(remote.settings);
    setActiveThemeId(remote.settings.activeTheme);
    setStatus("ready");
  }, []);

  useEffect(() => {
    refresh().catch((error) => {
      setStatus("error");
      push(describeError(error), "error");
    });
  }, [refresh, push]);

  useEffect(() => {
    if (themes.length === 0) return;
    const active = themes.find((theme) => theme.id === activeThemeId) ?? themes[0];
    applyTokens(active.tokens);
  }, [themes, activeThemeId]);

  const trackIndex = useMemo(
    () => new Map(tracks.map((track) => [track.id, track])),
    [tracks],
  );

  const trackById = useCallback((id: number) => trackIndex.get(id), [trackIndex]);

  const ensureTrack = useCallback(
    async (result: SearchResult) => {
      const existing = tracks.find(
        (track) => track.source === result.source && track.sourceId === result.sourceId,
      );
      if (existing) return existing;

      const { track } = await api.importTrack(result.source, result.sourceId);
      setTracks((list) => (list.some((item) => item.id === track.id) ? list : [track, ...list]));
      return track;
    },
    [tracks],
  );

  const adoptTrack = useCallback((track: Track) => {
    setTracks((list) => (list.some((item) => item.id === track.id) ? list : [track, ...list]));
  }, []);

  const updatePreferences = useCallback(
    async (patch: Record<string, unknown>) => {
      const previous = settings?.preferences ?? {};
      const next = { ...previous, ...patch };
      setSettings((current) => (current ? { ...current, preferences: next } : current));
      try {
        const { settings: saved } = await api.patchSettings({ preferences: next });
        setSettings(saved);
      } catch (error) {
        setSettings((current) => (current ? { ...current, preferences: previous } : current));
        throw error;
      }
    },
    [settings],
  );

  const uploadTrack = useCallback(async (file: File) => {
    const title = file.name.replace(/\.[^.]+$/, "");
    const { track } = await api.uploadTrack(file, { title });
    setTracks((list) => [track, ...list]);
    return track;
  }, []);

  const deleteTrack = useCallback(async (id: number) => {
    await api.deleteTrack(id);
    setTracks((list) => list.filter((track) => track.id !== id));
    setPlaylists((list) =>
      list.map((playlist) =>
        playlist.trackIds.includes(id)
          ? {
              ...playlist,
              trackIds: playlist.trackIds.filter((trackId) => trackId !== id),
              trackCount: Math.max(0, playlist.trackCount - 1),
            }
          : playlist,
      ),
    );
  }, []);

  const downloadTrack = useCallback((track: Track) => {
    const anchor = document.createElement("a");
    anchor.href = withToken(track.downloadUrl);
    anchor.download = `${track.artist ? `${track.artist} - ` : ""}${track.title}`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
  }, []);

  const createPlaylist = useCallback(async (name: string, description = "") => {
    const { playlist } = await api.createPlaylist(name, description);
    const withIds: Playlist = { ...playlist, trackIds: [] };
    setPlaylists((list) => [withIds, ...list]);
    return withIds;
  }, []);

  const updatePlaylist = useCallback(
    async (id: number, patch: { name?: string; description?: string }) => {
      const { playlist } = await api.updatePlaylist(id, patch);
      setPlaylists((list) =>
        list.map((item) =>
          item.id === id ? { ...playlist, trackIds: item.trackIds } : item,
        ),
      );
    },
    [],
  );

  const deletePlaylist = useCallback(async (id: number) => {
    await api.deletePlaylist(id);
    setPlaylists((list) => list.filter((playlist) => playlist.id !== id));
  }, []);

  const addToPlaylist = useCallback(async (playlistId: number, trackId: number) => {
    const { playlist, duplicated } = await api.addTrackToPlaylist(playlistId, trackId);
    setPlaylists((list) =>
      list.map((item) =>
        item.id === playlistId
          ? {
              ...playlist,
              trackIds: item.trackIds.includes(trackId)
                ? item.trackIds
                : [...item.trackIds, trackId],
            }
          : item,
      ),
    );
    return duplicated;
  }, []);

  const removeFromPlaylist = useCallback(async (playlistId: number, trackId: number) => {
    const { playlist } = await api.removeTrackFromPlaylist(playlistId, trackId);
    setPlaylists((list) =>
      list.map((item) =>
        item.id === playlistId
          ? { ...playlist, trackIds: item.trackIds.filter((id) => id !== trackId) }
          : item,
      ),
    );
  }, []);

  const moveInPlaylist = useCallback(
    async (playlistId: number, trackId: number, direction: -1 | 1) => {
      const playlist = playlists.find((item) => item.id === playlistId);
      if (!playlist) return;
      const order = [...playlist.trackIds];
      const from = order.indexOf(trackId);
      const to = from + direction;
      if (from < 0 || to < 0 || to >= order.length) return;

      [order[from], order[to]] = [order[to], order[from]];
      setPlaylists((list) =>
        list.map((item) => (item.id === playlistId ? { ...item, trackIds: order } : item)),
      );

      await api.reorderPlaylist(playlistId, order);
    },
    [playlists],
  );

  const saveTheme = useCallback(async (input: { id?: string; name: string; tokens: ThemeTokens }) => {
    if (input.id) {
      const { theme } = await api.updateTheme(input.id, {
        name: input.name,
        tokens: input.tokens,
      });
      setThemes((list) => list.map((item) => (item.id === theme.id ? theme : item)));
      return theme;
    }
    const { theme } = await api.createTheme(input.name, input.tokens);
    setThemes((list) => [...list, theme]);
    return theme;
  }, []);

  const deleteTheme = useCallback(
    async (id: string) => {
      await api.deleteTheme(id);
      setThemes((list) => list.filter((theme) => theme.id !== id));
      if (activeThemeId === id) setActiveThemeId("blueberry");
    },
    [activeThemeId],
  );

  const setActiveTheme = useCallback(
    async (id: string) => {
      const previous = activeThemeId;
      setActiveThemeId(id);
      try {
        const { settings: next } = await api.patchSettings({ activeTheme: id });
        setSettings(next);
      } catch (error) {
        setActiveThemeId(previous);
        throw error;
      }
    },
    [activeThemeId],
  );

  const logout = useCallback(() => {
    onLogout();
  }, [onLogout]);

  const value = useMemo<AppValue>(
    () => ({
      user,
      tracks,
      playlists,
      themes,
      sources,
      settings,
      activeThemeId,
      syncedAt,
      status,
      trackById,
      attempt,
      refresh,
      ensureTrack,
      adoptTrack,
      updatePreferences,
      uploadTrack,
      deleteTrack,
      downloadTrack,
      createPlaylist,
      updatePlaylist,
      deletePlaylist,
      addToPlaylist,
      removeFromPlaylist,
      moveInPlaylist,
      saveTheme,
      deleteTheme,
      setActiveTheme,
      logout,
    }),
    [
      user,
      tracks,
      playlists,
      themes,
      sources,
      settings,
      activeThemeId,
      syncedAt,
      status,
      trackById,
      attempt,
      refresh,
      ensureTrack,
      adoptTrack,
      updatePreferences,
      uploadTrack,
      deleteTrack,
      downloadTrack,
      createPlaylist,
      updatePlaylist,
      deletePlaylist,
      addToPlaylist,
      removeFromPlaylist,
      moveInPlaylist,
      saveTheme,
      deleteTheme,
      setActiveTheme,
      logout,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppValue {
  const value = useContext(AppContext);
  if (!value) throw new Error("useApp must be used inside AppProvider");
  return value;
}
