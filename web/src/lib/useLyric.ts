import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";
import type { Lyric } from "../api/types";

type LyricState = {
  lyric: Lyric | null;
  loading: boolean;
  reload: () => void;
  apply: (value: Lyric | null) => void;
};

export function useLyric(trackId: number | null): LyricState {
  const [lyric, setLyric] = useState<Lyric | null>(null);
  const [loading, setLoading] = useState(false);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!trackId) {
      setLyric(null);
      setLoading(false);
      return;
    }

    let alive = true;
    setLoading(true);
    api
      .getLyric(trackId)
      .then(({ lyric: value }) => {
        if (alive) setLyric(value);
      })
      .catch(() => {
        if (alive) setLyric(null);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [trackId, version]);

  const reload = useCallback(() => setVersion((value) => value + 1), []);
  const apply = useCallback((value: Lyric | null) => setLyric(value), []);

  return { lyric, loading, reload, apply };
}
