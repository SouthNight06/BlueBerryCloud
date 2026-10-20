import { useEffect, useState } from "react";

export type Route =
  | { name: "discover" }
  | { name: "library" }
  | { name: "playlists" }
  | { name: "playlist"; id: number }
  | { name: "bilibili" }
  | { name: "themes" }
  | { name: "settings" };

export function parseRoute(hash: string): Route {
  const path = hash.replace(/^#\/?/, "").split("?")[0];
  const [head, tail] = path.split("/");

  switch (head) {
    case "library":
      return { name: "library" };
    case "playlists":
      return { name: "playlists" };
    case "themes":
      return { name: "themes" };
    case "bilibili":
      return { name: "bilibili" };
    case "settings":
      return { name: "settings" };
    case "playlist": {
      const id = Number(tail);
      return Number.isInteger(id) && id > 0 ? { name: "playlist", id } : { name: "playlists" };
    }
    default:
      return { name: "discover" };
  }
}

export function routeHref(route: Route): string {
  switch (route.name) {
    case "library":
      return "#/library";
    case "playlists":
      return "#/playlists";
    case "themes":
      return "#/themes";
    case "bilibili":
      return "#/bilibili";
    case "settings":
      return "#/settings";
    case "playlist":
      return `#/playlist/${route.id}`;
    default:
      return "#/discover";
  }
}

export function navigate(route: Route) {
  const href = routeHref(route);
  if (window.location.hash !== href) window.location.hash = href;
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseRoute(window.location.hash));

  useEffect(() => {
    if (!window.location.hash) window.location.replace("#/discover");
    const sync = () => setRoute(parseRoute(window.location.hash));
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  return route;
}
