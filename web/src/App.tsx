import { useCallback, useEffect, useState } from "react";
import { api, currentToken, setToken } from "./api/client";
import type { AuthResponse, PublicUser } from "./api/types";
import { AppShell } from "./components/AppShell";
import { AuthScreen } from "./screens/AuthScreen";
import { AppProvider } from "./state/AppStore";
import { PlayerProvider } from "./state/PlayerStore";
import { UiProvider } from "./state/UiStore";

export function App() {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [booting, setBooting] = useState(() => Boolean(currentToken()));

  useEffect(() => {
    if (!currentToken()) return;
    let alive = true;
    api
      .me()
      .then(({ user: restored }) => {
        if (alive) setUser(restored);
      })
      .catch(() => {
        setToken(null);
      })
      .finally(() => {
        if (alive) setBooting(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const onUnauthorized = () => setUser(null);
    window.addEventListener("xiaoyun:unauthorized", onUnauthorized);
    return () => window.removeEventListener("xiaoyun:unauthorized", onUnauthorized);
  }, []);

  const handleAuthed = useCallback((auth: AuthResponse) => {
    setToken(auth.token);
    setUser(auth.user);
  }, []);

  const handleLogout = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  if (booting) {
    return (
      <div className="booting">
        <span className="booting__word">小云畅听</span>
      </div>
    );
  }

  if (!user) return <AuthScreen onAuthed={handleAuthed} />;

  return (
    <AppProvider user={user} onLogout={handleLogout}>
      <UiProvider>
        <PlayerProvider>
          <AppShell />
        </PlayerProvider>
      </UiProvider>
    </AppProvider>
  );
}
