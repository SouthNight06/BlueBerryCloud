import { useRoute } from "../lib/route";
import { DiscoverView } from "../screens/DiscoverView";
import { LibraryView } from "../screens/LibraryView";
import { PlaylistView } from "../screens/PlaylistView";
import { PlaylistsView } from "../screens/PlaylistsView";
import { ThemesView } from "../screens/ThemesView";
import { PlayerBar } from "./PlayerBar";
import { Sidebar } from "./Sidebar";

export function AppShell() {
  const route = useRoute();

  return (
    <div className="app">
      <Sidebar route={route} />
      <main className="main scroll">
        {route.name === "discover" ? <DiscoverView /> : null}
        {route.name === "library" ? <LibraryView /> : null}
        {route.name === "playlists" ? <PlaylistsView /> : null}
        {route.name === "playlist" ? <PlaylistView id={route.id} /> : null}
        {route.name === "themes" ? <ThemesView /> : null}
      </main>
      <PlayerBar />
    </div>
  );
}
