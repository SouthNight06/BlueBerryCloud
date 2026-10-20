import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

const DESKTOP_KEY = "xiaoyun.desktopLyrics";

type UiValue = {
  desktopLyrics: boolean;
  setDesktopLyrics: (value: boolean) => void;
  toggleDesktopLyrics: () => void;
  lyricsPanel: boolean;
  openLyrics: () => void;
  closeLyrics: () => void;
};

const UiContext = createContext<UiValue | null>(null);

function readDesktop(): boolean {
  try {
    return window.localStorage.getItem(DESKTOP_KEY) === "1";
  } catch {
    return false;
  }
}

function storeDesktop(value: boolean) {
  try {
    window.localStorage.setItem(DESKTOP_KEY, value ? "1" : "0");
  } catch {
    /* storage unavailable — keeps the in-memory value */
  }
}

export function UiProvider({ children }: { children: ReactNode }) {
  const [desktopLyrics, setDesktopState] = useState(readDesktop);
  const [lyricsPanel, setLyricsPanel] = useState(false);

  useEffect(() => {
    storeDesktop(desktopLyrics);
  }, [desktopLyrics]);

  const setDesktopLyrics = useCallback((value: boolean) => setDesktopState(value), []);
  const toggleDesktopLyrics = useCallback(() => setDesktopState((value) => !value), []);
  const openLyrics = useCallback(() => setLyricsPanel(true), []);
  const closeLyrics = useCallback(() => setLyricsPanel(false), []);

  const value = useMemo<UiValue>(
    () => ({
      desktopLyrics,
      setDesktopLyrics,
      toggleDesktopLyrics,
      lyricsPanel,
      openLyrics,
      closeLyrics,
    }),
    [desktopLyrics, setDesktopLyrics, toggleDesktopLyrics, lyricsPanel, openLyrics, closeLyrics],
  );

  return <UiContext.Provider value={value}>{children}</UiContext.Provider>;
}

export function useUi(): UiValue {
  const value = useContext(UiContext);
  if (!value) throw new Error("useUi must be used inside UiProvider");
  return value;
}
