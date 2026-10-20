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
import { useApp } from "./AppStore";
import { useToast } from "./ToastStore";

export type RepeatMode = "off" | "all" | "one";

export const DJ_STRENGTH_MIN = 0.4;
export const DJ_STRENGTH_MAX = 2.4;
export const DJ_STRENGTH_DEFAULT = 1.6;

export function normalizeDjStrength(value: unknown): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return DJ_STRENGTH_DEFAULT;
  return Math.min(DJ_STRENGTH_MAX, Math.max(DJ_STRENGTH_MIN, numeric));
}

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
  const { settings } = useApp();
  const balance = Boolean(settings?.preferences?.volumeBalance);
  const djMode = Boolean(settings?.preferences?.djMode);
  const djStrength = normalizeDjStrength(settings?.preferences?.djStrength);

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

  const audioCtxRef = useRef<AudioContext | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const balanceTimer = useRef(0);
  const smoothRef = useRef(1);
  const levelRef = useRef({ volume, muted });

  useEffect(() => {
    levelRef.current = { volume, muted };
  }, [volume, muted]);

  const ensureGraph = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const existing = audioCtxRef.current;
    if (existing) {
      if (existing.state === "suspended") void existing.resume();
      return;
    }
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    try {
      const ctx = new Ctor();
      const source = ctx.createMediaElementSource(audio);
      const gain = ctx.createGain();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.25;
      source.connect(gain);
      gain.connect(analyser);
      analyser.connect(ctx.destination);
      audioCtxRef.current = ctx;
      gainRef.current = gain;
      analyserRef.current = analyser;
      if (ctx.state === "suspended") void ctx.resume();
    } catch {
      audioCtxRef.current = null;
      gainRef.current = null;
      analyserRef.current = null;
    }
  }, []);

  useEffect(() => {
    const gain = gainRef.current;
    if (!gain || balance) return;
    smoothRef.current = 1;
    gain.gain.setTargetAtTime(1, gain.context.currentTime, 0.1);
  }, [balance]);

  useEffect(() => {
    if (!balance || !playing) return;
    ensureGraph();
    const analyser = analyserRef.current;
    const gain = gainRef.current;
    if (!analyser || !gain) return;
    const buffer = new Float32Array(analyser.fftSize);
    balanceTimer.current = window.setInterval(() => {
      analyser.getFloatTimeDomainData(buffer);
      let sum = 0;
      for (let i = 0; i < buffer.length; i += 1) sum += buffer[i] * buffer[i];
      const rms = Math.sqrt(sum / buffer.length);
      const level = levelRef.current;
      if (level.muted || level.volume <= 0.01) {
        smoothRef.current = 1;
        gain.gain.setTargetAtTime(1, gain.context.currentTime, 0.15);
        return;
      }
      if (rms < 0.003) return;
      const target = 0.1 * (level.volume / 0.85);
      const desired = Math.min(1.9, Math.max(0.55, target / rms));
      smoothRef.current = smoothRef.current * 0.82 + desired * 0.18;
      gain.gain.setTargetAtTime(smoothRef.current, gain.context.currentTime, 0.12);
    }, 120);
    return () => {
      window.clearInterval(balanceTimer.current);
      balanceTimer.current = 0;
    };
  }, [balance, playing, ensureGraph]);

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
    const root = document.documentElement;
    if (!djMode) {
      delete root.dataset.dj;
      root.style.removeProperty("--dj-energy");
      root.style.removeProperty("--dj-beat");
      root.style.removeProperty("--dj-strength");
      return;
    }
    root.style.setProperty("--dj-strength", djStrength.toFixed(2));
    root.dataset.dj = playing ? "on" : "idle";
  }, [djMode, playing, djStrength]);

  useEffect(
    () => () => {
      const root = document.documentElement;
      delete root.dataset.dj;
      root.style.removeProperty("--dj-energy");
      root.style.removeProperty("--dj-beat");
      root.style.removeProperty("--dj-strength");
    },
    [],
  );

  useEffect(() => {
    if (!djMode || !playing) return;
    ensureGraph();
    const analyser = analyserRef.current;
    if (!analyser) return;
    const root = document.documentElement;
    const time = new Float32Array(analyser.fftSize);
    const freq = new Uint8Array(analyser.frequencyBinCount);
    let energy = 0;
    let beat = 0;
    let bassFloor = 0;
    let last = 0;
    let frame = 0;
    const tick = (now: number) => {
      frame = window.requestAnimationFrame(tick);
      if (now - last < 32) return;
      last = now;
      analyser.getFloatTimeDomainData(time);
      let sum = 0;
      for (let i = 0; i < time.length; i += 1) sum += time[i] * time[i];
      const rms = Math.sqrt(sum / time.length);
      analyser.getByteFrequencyData(freq);
      let bass = 0;
      for (let i = 1; i < 12; i += 1) bass += freq[i];
      bass = bass / 11 / 255;
      energy = energy * 0.76 + Math.min(1, rms / 0.12) * 0.24;
      bassFloor = bassFloor * 0.9 + bass * 0.1;
      if (bass > 0.3 && bass > bassFloor * 1.14 && beat < 0.45) beat = 1;
      beat *= 0.86;
      if (beat < 0.01) beat = 0;
      root.style.setProperty("--dj-energy", energy.toFixed(3));
      root.style.setProperty("--dj-beat", beat.toFixed(3));
    };
    frame = window.requestAnimationFrame(tick);
    return () => {
      window.cancelAnimationFrame(frame);
      root.style.setProperty("--dj-energy", "0");
      root.style.setProperty("--dj-beat", "0");
    };
  }, [djMode, playing, ensureGraph]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      if (balance || djMode) ensureGraph();
      void audio.play().catch(() => setPlaying(false));
    } else {
      audio.pause();
    }
  }, [playing, current, balance, djMode, ensureGraph]);

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
