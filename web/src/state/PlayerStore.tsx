import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import { withToken } from "../api/client";
import type { Track } from "../api/types";
import { useToast } from "./ToastStore";

export type RepeatMode = "off" | "all" | "one";

type PlayerValue = {
  current: Track | null;
  queue: Track[];
  playing: boolean;
  progress: number;
  duration: number;
  volume: number;
  muted: boolean;
  shuffle: boolean;
  repeat: RepeatMode;
  playQueue: (tracks: Track[], startIndex?: number) => void;
  toggle: () => void;
  next: () => void;
  prev: () => void;
  seek: (seconds: number) => void;
  setVolume: (value: number) => void;
  toggleMute: () => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  reset: () => void;
};

const PlayerContext = createContext<PlayerValue | null>(null);

export function PlayerProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { push } = useToast();

  const [queue, setQueue] = useState<Track[]>([]);
  const [index, setIndex] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(0.85);
  const [muted, setMuted] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState<RepeatMode>("off");

  const current = index >= 0 ? (queue[index] ?? null) : null;

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!current) {
      audio.removeAttribute("src");
      audio.load();
      setProgress(0);
      setDuration(0);
      return;
    }
    audio.src = withToken(current.streamUrl);
    audio.load();
  }, [current]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      void audio.play().catch(() => setPlaying(false));
    } else {
      audio.pause();
    }
  }, [playing, current]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = muted ? 0 : volume;
  }, [volume, muted]);

  const playQueue = useCallback((tracks: Track[], startIndex = 0) => {
    if (tracks.length === 0) return;
    const safeIndex = Math.min(Math.max(startIndex, 0), tracks.length - 1);
    setQueue(tracks);
    setIndex(safeIndex);
    setProgress(0);
    setPlaying(true);
  }, []);

  const toggle = useCallback(() => {
    if (!current) return;
    setPlaying((value) => !value);
  }, [current]);

  const next = useCallback(
    (auto = false) => {
      if (queue.length === 0) return;
      if (shuffle && queue.length > 1) {
        let target = index;
        while (target === index) target = Math.floor(Math.random() * queue.length);
        setIndex(target);
        setPlaying(true);
        return;
      }
      if (index + 1 < queue.length) {
        setIndex(index + 1);
        setPlaying(true);
        return;
      }
      if (repeat === "all") {
        setIndex(0);
        setPlaying(true);
        return;
      }
      if (auto) {
        setPlaying(false);
        setProgress(0);
      }
    },
    [queue.length, index, repeat, shuffle],
  );

  const prev = useCallback(() => {
    if (queue.length === 0) return;
    const audio = audioRef.current;
    if (audio && audio.currentTime > 3) {
      audio.currentTime = 0;
      setProgress(0);
      return;
    }
    if (index > 0) {
      setIndex(index - 1);
      setPlaying(true);
      return;
    }
    if (repeat === "all") {
      setIndex(queue.length - 1);
      setPlaying(true);
    }
  }, [queue.length, index, repeat]);

  const seek = useCallback((seconds: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!Number.isFinite(seconds)) return;
    audio.currentTime = seconds;
    setProgress(seconds);
  }, []);

  const setVolume = useCallback((value: number) => {
    setVolumeState(Math.min(1, Math.max(0, value)));
    setMuted(false);
  }, []);

  const toggleMute = useCallback(() => setMuted((value) => !value), []);

  const toggleShuffle = useCallback(() => setShuffle((value) => !value), []);

  const cycleRepeat = useCallback(() => {
    setRepeat((value) => (value === "off" ? "all" : value === "all" ? "one" : "off"));
  }, []);

  const reset = useCallback(() => {
    setQueue([]);
    setIndex(-1);
    setPlaying(false);
    setProgress(0);
    setDuration(0);
  }, []);

  const handleEnded = useCallback(() => {
    const audio = audioRef.current;
    if (repeat === "one" && audio) {
      audio.currentTime = 0;
      void audio.play();
      setProgress(0);
      return;
    }
    next(true);
  }, [next, repeat]);

  const value = useMemo<PlayerValue>(
    () => ({
      current,
      queue,
      playing,
      progress,
      duration,
      volume,
      muted,
      shuffle,
      repeat,
      playQueue,
      toggle,
      next: () => next(),
      prev,
      seek,
      setVolume,
      toggleMute,
      toggleShuffle,
      cycleRepeat,
      reset,
    }),
    [
      current,
      queue,
      playing,
      progress,
      duration,
      volume,
      muted,
      shuffle,
      repeat,
      playQueue,
      toggle,
      next,
      prev,
      seek,
      setVolume,
      toggleMute,
      toggleShuffle,
      cycleRepeat,
      reset,
    ],
  );

  return (
    <PlayerContext.Provider value={value}>
      {children}
      <audio
        ref={audioRef}
        preload="metadata"
        className="sr-only"
        onTimeUpdate={(event) => setProgress(event.currentTarget.currentTime)}
        onLoadedMetadata={(event) => {
          const value = event.currentTarget.duration;
          setDuration(Number.isFinite(value) ? value : 0);
        }}
        onEnded={handleEnded}
        onPlay={() => setPlaying(true)}
        onError={() => {
          setPlaying(false);
          push("音频加载失败，可能是音源暂时无法访问", "error");
        }}
      />
    </PlayerContext.Provider>
  );
}

export function usePlayer(): PlayerValue {
  const value = useContext(PlayerContext);
  if (!value) throw new Error("usePlayer must be used inside PlayerProvider");
  return value;
}

export function usePlayback() {
  const { current, playing, playQueue, toggle } = usePlayer();

  const play = useCallback(
    (tracks: Track[], index = 0) => {
      const target = tracks[index];
      if (!target) return;
      if (current && current.id === target.id) {
        toggle();
        return;
      }
      playQueue(tracks, index);
    },
    [current, playQueue, toggle],
  );

  return { currentId: current?.id ?? null, playing, play };
}
