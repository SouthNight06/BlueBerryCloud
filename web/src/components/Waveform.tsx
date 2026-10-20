import { useEffect, useRef } from "react";
import { WAVE_BANDS, waveBus } from "../lib/spectrum";
import { useApp } from "../state/AppStore";
import { usePlayer } from "../state/PlayerStore";

const MIN_BAR = 1.6;

export function Waveform() {
  const { playing } = usePlayer();
  const { settings } = useApp();
  const djMode = Boolean(settings?.preferences?.djMode);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef({ playing, djMode });

  useEffect(() => {
    stateRef.current = { playing, djMode };
  }, [playing, djMode]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const smoothed = new Float32Array(WAVE_BANDS);
    let width = 0;
    let height = 0;
    let accent = "#4b56bd";
    let raf = 0;
    let frames = 0;
    let alpha = 0;
    let painted = false;

    const readAccent = () => {
      const value = getComputedStyle(canvas).getPropertyValue("--accent").trim();
      if (value) accent = value;
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      width = Math.max(0, Math.round(rect.width));
      height = Math.max(0, Math.round(rect.height));
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      readAccent();
      painted = false;
    };

    const barPath = (x: number, y: number, w: number, h: number, r: number) => {
      const radius = Math.min(r, w / 2, h / 2);
      ctx.beginPath();
      if (typeof ctx.roundRect === "function") {
        ctx.roundRect(x, y, w, h, radius);
      } else {
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + w - radius, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
        ctx.lineTo(x + w, y + h);
        ctx.lineTo(x, y + h);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
      }
      ctx.closePath();
    };

    const draw = () => {
      raf = window.requestAnimationFrame(draw);
      if (!width || !height) return;
      frames += 1;
      if (frames % 60 === 0) readAccent();

      const live = stateRef.current.playing && waveBus.active;
      const target = live ? (stateRef.current.djMode ? 0.62 : 0.4) : 0;
      alpha += (target - alpha) * 0.12;

      if (!live && alpha < 0.01) {
        if (painted) {
          ctx.clearRect(0, 0, width, height);
          painted = false;
        }
        return;
      }

      painted = true;
      const bars = width < 480 ? 34 : width < 760 ? 44 : WAVE_BANDS;
      const cell = width / bars;
      const gap = Math.min(4, Math.max(1.2, cell * 0.34));
      const barW = Math.max(1, cell - gap);
      const ceiling = height * 0.88;
      const still = reduced.matches;

      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = accent;

      for (let i = 0; i < bars; i += 1) {
        const from = Math.floor((i * WAVE_BANDS) / bars);
        const to = Math.max(from + 1, Math.floor(((i + 1) * WAVE_BANDS) / bars));
        let peak = 0;
        for (let b = from; b < to; b += 1) {
          if (waveBus.levels[b] > peak) peak = waveBus.levels[b];
        }

        if (still) {
          smoothed[i] = 0.16 + (i % 3) * 0.05;
        } else {
          const prev = smoothed[i];
          smoothed[i] = peak > prev ? prev * 0.3 + peak * 0.7 : prev * 0.8 + peak * 0.2;
        }

        const taper = Math.sin((Math.PI * (i + 0.5)) / bars);
        const level = Math.min(1, Math.pow(smoothed[i] * 1.55, 0.82)) * (0.18 + taper * 0.82);
        const h = Math.max(MIN_BAR, level * ceiling);
        const x = i * cell + gap / 2;
        barPath(x, height - h, barW, h, barW / 2);
        ctx.globalAlpha = alpha * (0.55 + level * 0.45);
        ctx.fill();
      }

      ctx.globalAlpha = alpha * 0.5;
      ctx.fillRect(0, height - 1, width, 1);
      ctx.globalAlpha = 1;
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    raf = window.requestAnimationFrame(draw);

    const themeObserver = new MutationObserver(readAccent);
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme", "data-mode", "class", "style"],
    });

    return () => {
      window.cancelAnimationFrame(raf);
      observer.disconnect();
      themeObserver.disconnect();
    };
  }, []);

  return <canvas ref={canvasRef} className="player__wave" aria-hidden="true" />;
}
