import { useRoute } from "../lib/route";
import { BiliView } from "../screens/BiliView";
import { DiscoverView } from "../screens/DiscoverView";
import { LibraryView } from "../screens/LibraryView";
import { PlaylistView } from "../screens/PlaylistView";
import { PlaylistsView } from "../screens/PlaylistsView";
import { SettingsView } from "../screens/SettingsView";
import { ThemesView } from "../screens/ThemesView";
import { usePlayer } from "../state/PlayerStore";
import { useUi } from "../state/UiStore";
import { DesktopLyrics } from "./DesktopLyrics";
import { LyricsModal } from "./LyricsModal";
import { PlayerBar } from "./PlayerBar";
import { Sidebar } from "./Sidebar";

export function AppShell() {
  const route = useRoute();
  const { current } = usePlayer();
  const { lyricsPanel, closeLyrics } = useUi();

  return (
    <div className="app">
      <Sidebar route={route} />
      <main className="main scroll">
        {route.name === "discover" ? <DiscoverView /> : null}
        {route.name === "library" ? <LibraryView /> : null}
        {route.name === "playlists" ? <PlaylistsView /> : null}
        {route.name === "playlist" ? <PlaylistView id={route.id} /> : null}
        {route.name === "bilibili" ? <BiliView /> : null}
        {route.name === "themes" ? <ThemesView /> : null}
        {route.name === "settings" ? <SettingsView /> : null}
      </main>
      <PlayerBar />
      <DesktopLyrics />
      {lyricsPanel && current ? <LyricsModal track={current} onClose={closeLyrics} /> : null}
    </div>
  );
}
