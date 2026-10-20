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
import { bandRanges, resetWaveBus, waveBus } from "../lib/spectrum";
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
      root.style.removeProperty("--dj-squash");
      root.style.removeProperty("--dj-lift");
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
      root.style.removeProperty("--dj-squash");
      root.style.removeProperty("--dj-lift");
      root.style.removeProperty("--dj-strength");
    },
    [],
  );

  useEffect(() => {
    if (!playing) {
      resetWaveBus();
      return;
    }
    ensureGraph();
    const analyser = analyserRef.current;
    if (!analyser) return;

    const root = document.documentElement;
    const bins = analyser.frequencyBinCount;
    const time = new Float32Array(analyser.fftSize);
    const freq = new Uint8Array(bins);
    const ranges = bandRanges(bins, analyser.context.sampleRate);
    const levels = waveBus.levels;
    const lowBins = Math.max(4, Math.min(bins - 1, Math.round(240 / (analyser.context.sampleRate / 2 / bins))));
    const previous = new Float32Array(lowBins + 1);

    let energy = 0;
    let fluxFloor = 0;
    let lastHit = -1;
    let gap = 320;
    let squash = 0;
    let lift = 0;
    let beat = 0;
    let last = 0;
    let raf = 0;

    const tick = (now: number) => {
      raf = window.requestAnimationFrame(tick);
      if (now - last < 18) return;
      last = now;

      analyser.getByteFrequencyData(freq);
      analyser.getFloatTimeDomainData(time);

      let sum = 0;
      for (let i = 0; i < time.length; i += 1) sum += time[i] * time[i];
      const rms = Math.sqrt(sum / time.length);

      for (let i = 0; i < ranges.length; i += 1) {
        const [from, to] = ranges[i];
        let value = 0;
        for (let j = from; j <= to; j += 1) value += freq[j];
        value = value / (to - from + 1) / 255;
        const prev = levels[i];
        levels[i] = value > prev ? value : prev * 0.78 + value * 0.22;
      }

      let flux = 0;
      for (let i = 1; i <= lowBins; i += 1) {
        const value = freq[i] / 255;
        const diff = value - previous[i];
        if (diff > 0) flux += diff;
        previous[i] = value;
      }
      flux /= lowBins;

      fluxFloor = fluxFloor * 0.92 + flux * 0.08;
      const threshold = Math.max(0.006, fluxFloor * 1.22);
      const sinceHit = lastHit < 0 ? Infinity : now - lastHit;
      const cycle = Math.min(430, Math.max(250, gap));
      const starved = sinceHit > cycle * 1.9;
      const onset = flux > threshold || (starved && rms > 0.02 && flux > threshold * 0.4);

      if (onset && sinceHit > 150) {
        if (lastHit > 0 && sinceHit < 900) gap = gap * 0.55 + sinceHit * 0.45;
        lastHit = now;
      }

      const age = lastHit < 0 ? Infinity : now - lastHit;
      const crouch = cycle * 0.26;
      if (age < crouch) {
        squash = Math.sin((age / crouch) * Math.PI);
      } else {
        squash = 0;
      }
      const launch = cycle * 0.12;
      const span = cycle - launch;
      if (age >= launch && age < cycle) {
        const phase = (age - launch) / span;
        lift =
          phase < 0.3
            ? Math.sin((phase / 0.3) * Math.PI * 0.5)
            : Math.cos(((phase - 0.3) / 0.7) * Math.PI * 0.5);
      } else {
        lift = 0;
      }
      beat = Math.max(squash, lift);

      energy = energy * 0.9 + Math.min(1, rms / 0.14) * 0.1;

      waveBus.energy = energy;
      waveBus.beat = beat;
      waveBus.squash = squash;
      waveBus.lift = lift;
      waveBus.active = true;

      if (djMode) {
        root.style.setProperty("--dj-energy", energy.toFixed(3));
        root.style.setProperty("--dj-beat", beat.toFixed(3));
        root.style.setProperty("--dj-squash", squash.toFixed(3));
        root.style.setProperty("--dj-lift", lift.toFixed(3));
      }
    };

    raf = window.requestAnimationFrame(tick);
    return () => {
      window.cancelAnimationFrame(raf);
      resetWaveBus();
      if (djMode) {
        root.style.setProperty("--dj-energy", "0");
        root.style.setProperty("--dj-beat", "0");
        root.style.setProperty("--dj-squash", "0");
        root.style.setProperty("--dj-lift", "0");
      }
    };
  }, [playing, djMode, ensureGraph]);

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
