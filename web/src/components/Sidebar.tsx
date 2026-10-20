import { formatDate } from "../lib/format";
import { routeHref } from "../lib/route";
import type { Route } from "../lib/route";
import { useApp } from "../state/AppStore";
import { Icon } from "./Icon";
import type { IconName } from "./Icon";

type NavItem = {
  route: Route;
  label: string;
  icon: IconName;
};

const NAV: NavItem[] = [
  { route: { name: "discover" }, label: "发现", icon: "search" },
  { route: { name: "library" }, label: "音乐库", icon: "disc" },
  { route: { name: "playlists" }, label: "歌单", icon: "list" },
  { route: { name: "themes" }, label: "外观", icon: "swatch" },
];

export function Sidebar({ route }: { route: Route }) {
  const { user, tracks, playlists, syncedAt, logout } = useApp();

  const activeName = route.name === "playlist" ? "playlists" : route.name;

  const countOf = (name: Route["name"]): number | null => {
    if (name === "library") return tracks.length;
    if (name === "playlists") return playlists.length;
    return null;
  };

  return (
    <aside className="rail">
      <a className="rail__brand" href={routeHref({ name: "discover" })}>
        <span className="rail__mark" />
        <span className="rail__word">
          小云畅听
          <small>小云屋</small>
        </span>
      </a>

      <nav className="rail__nav">
        {NAV.map((item) => {
          const count = countOf(item.route.name);
          return (
            <a
              key={item.route.name}
              className="navlink"
              href={routeHref(item.route)}
              data-active={activeName === item.route.name ? "true" : "false"}
            >
              <Icon name={item.icon} size={16} />
              <span>{item.label}</span>
              {count !== null && count > 0 ? (
                <span className="navlink__count num">{count}</span>
              ) : null}
            </a>
          );
        })}
      </nav>

      {playlists.length > 0 ? (
        <div className="rail__block">
          <div className="rail__label">
            <span>我的歌单</span>
            <span className="num">{playlists.length}</span>
          </div>
          <div className="rail__pls">
            {playlists.map((playlist) => (
              <a
                key={playlist.id}
                className="rail__pl"
                href={routeHref({ name: "playlist", id: playlist.id })}
                data-active={
                  route.name === "playlist" && route.id === playlist.id ? "true" : "false"
                }
              >
                <Icon name="note" size={14} />
                <span>{playlist.name}</span>
              </a>
            ))}
          </div>
        </div>
      ) : null}

      <div className="rail__foot">
        <span className="avatar">{user.username.slice(0, 1).toUpperCase()}</span>
        <span className="rail__who">
          <strong>{user.username}</strong>
          <span>{syncedAt ? `已同步 ${formatDate(syncedAt)}` : "云端存储"}</span>
        </span>
        <button type="button" className="ibtn" onClick={logout} aria-label="退出登录" title="退出登录">
          <Icon name="logout" size={16} />
        </button>
      </div>
    </aside>
  );
}
