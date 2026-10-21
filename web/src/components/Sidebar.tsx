import { LOCAL_MODE } from "../api/mode";
import { formatDate } from "../lib/format";
import { routeHref } from "../lib/route";
import type { Route } from "../lib/route";
import { useApp } from "../state/AppStore";
import { useUi } from "../state/UiStore";
import { Icon } from "./Icon";
import type { IconName } from "./Icon";
import { Waveform } from "./Waveform";

type NavItem = {
  route: Route;
  label: string;
  icon: IconName;
};

const ALL_NAV: NavItem[] = [
  { route: { name: "discover" }, label: "发现", icon: "search" },
  { route: { name: "library" }, label: "音乐库", icon: "disc" },
  { route: { name: "playlists" }, label: "歌单", icon: "list" },
  { route: { name: "bilibili" }, label: "哔哩哔哩", icon: "bilibili" },
  { route: { name: "themes" }, label: "外观", icon: "swatch" },
];

const NAV: NavItem[] = ALL_NAV.filter(
  (item) => !(LOCAL_MODE && item.route.name === "bilibili"),
);

export function Sidebar({ route }: { route: Route }) {
  const { user, tracks, playlists, syncedAt, logout } = useApp();
  const { navOpen, closeNav } = useUi();

  const activeName = route.name === "playlist" ? "playlists" : route.name;

  const countOf = (name: Route["name"]): number | null => {
    if (name === "library") return tracks.length;
    if (name === "playlists") return playlists.length;
    return null;
  };

  return (
    <>
      <aside className="rail" data-open={navOpen ? "true" : "false"}>
        <div className="rail__top">
          <a className="rail__brand" href={routeHref({ name: "discover" })}>
            <span className="rail__mark" />
            <span className="rail__word">
              小云畅听
              <small>小云屋</small>
            </span>
          </a>
          <button
            type="button"
            className="ibtn rail__close"
            onClick={closeNav}
            aria-label="收起菜单"
            title="收起菜单"
          >
            <Icon name="close" size={17} />
          </button>
        </div>

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

        <div className="rail__wave">
          <div className="rail__wave-head">
            <span>律动</span>
            <span className="rail__wave-dot" />
          </div>
          <Waveform variant="rail" />
        </div>

        <div className="rail__foot">
          <span className="avatar">{user.username.slice(0, 1).toUpperCase()}</span>
          <span className="rail__who">
            <strong>{user.username}</strong>
            <span>
              {LOCAL_MODE ? "本地存储" : syncedAt ? `已同步 ${formatDate(syncedAt)}` : "云端存储"}
            </span>
          </span>
          <a
            className="ibtn"
            href={routeHref({ name: "settings" })}
            aria-label="设置"
            title="设置"
            data-on={route.name === "settings" ? "true" : "false"}
          >
            <Icon name="settings" size={16} />
          </a>
          <button
            type="button"
            className="ibtn"
            onClick={logout}
            aria-label="退出登录"
            title="退出登录"
          >
            <Icon name="logout" size={16} />
          </button>
        </div>
      </aside>

      <button
        type="button"
        className="scrim"
        data-on={navOpen ? "true" : "false"}
        onClick={closeNav}
        aria-label="关闭菜单"
        tabIndex={navOpen ? 0 : -1}
      />
    </>
  );
}
