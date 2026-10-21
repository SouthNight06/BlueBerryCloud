import { useEffect, useRef } from "react";
import { normalizeDollMode } from "../lib/dolls";
import { useApp } from "../state/AppStore";

const PET_SRC = "/dj-pet.png";

const PET_FALLBACK =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">' +
      '<g fill="#dbe7ff" stroke="#8fb4e8" stroke-width="2">' +
      '<ellipse cx="34" cy="58" rx="22" ry="16"/>' +
      '<ellipse cx="58" cy="52" rx="20" ry="19"/>' +
      '<ellipse cx="48" cy="66" rx="26" ry="14"/>' +
      "</g>" +
      '<circle cx="42" cy="57" r="2.6" fill="#41506b"/>' +
      '<circle cx="56" cy="57" r="2.6" fill="#41506b"/>' +
      '<path d="M45 64q4 4 8 0" fill="none" stroke="#41506b" stroke-width="2" stroke-linecap="round"/>' +
      "</svg>",
  );

export function DjPet() {
  const { settings } = useApp();
  const djMode = Boolean(settings?.preferences?.djMode);
  const paradeMode = normalizeDollMode(settings?.preferences?.mascotMode) !== "single";
  const active = djMode || paradeMode;
  const artRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!active) return;
    const art = artRef.current;
    if (!art) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const stageWidth = () => Math.max(0, window.innerWidth - (art.offsetWidth || 76));

    let width = art.offsetWidth || 76;
    let x = Math.random() * stageWidth();
    let heading = Math.random() < 0.5 ? -1 : 1;
    let speed = 32;
    let turnAt = 0;
    let hopStart = -1;
    let hopMs = 640;
    let hopHeight = 20;
    let nextHopAt = 0;
    let elapsed = 0;
    let frames = 0;
    let last = performance.now();
    let raf = 0;

    const paint = (lift: number) => {
      art.style.transform = `translate3d(${x.toFixed(1)}px, ${(-lift).toFixed(1)}px, 0) scaleX(${
        heading >= 0 ? 1 : -1
      })`;
    };

    const settle = () => {
      width = art.offsetWidth || 76;
      x = Math.min(x, Math.max(0, window.innerWidth - width));
      paint(0);
    };

    if (!djMode) {
      const stand = () => {
        width = art.offsetWidth || 76;
        x = Math.max(0, window.innerWidth - width - 26);
        paint(0);
      };
      stand();
      window.addEventListener("resize", stand);
      return () => window.removeEventListener("resize", stand);
    }

    if (reduceMotion) {
      x = Math.max(0, (window.innerWidth - width) / 2);
      paint(0);
      window.addEventListener("resize", settle);
      return () => window.removeEventListener("resize", settle);
    }

    const begun = performance.now();
    turnAt = begun + 1200 + Math.random() * 2600;
    nextHopAt = begun + 900 + Math.random() * 1800;
    paint(0);

    const tick = (time: number) => {
      const delta = Math.min(64, time - last);
      last = time;
      elapsed += delta;
      frames += 1;

      if (frames % 30 === 0) {
        const measured = art.offsetWidth;
        if (measured && measured !== width) {
          width = measured;
          x = Math.min(x, Math.max(0, window.innerWidth - width));
        }
      }

      const maxX = Math.max(0, window.innerWidth - width);
      x += heading * speed * (delta / 1000);
      if (x <= 0) {
        x = 0;
        heading = 1;
        turnAt = time + 1200 + Math.random() * 2400;
      } else if (x >= maxX) {
        x = maxX;
        heading = -1;
        turnAt = time + 1200 + Math.random() * 2400;
      }

      if (time >= turnAt) {
        heading = Math.random() < 0.5 ? -1 : 1;
        speed = 26 + Math.random() * 26;
        turnAt = time + 1500 + Math.random() * 3800;
      }

      let hop = 0;
      if (hopStart < 0 && time >= nextHopAt) {
        hopStart = time;
        hopMs = 520 + Math.random() * 260;
        hopHeight = 14 + Math.random() * 16;
      }
      if (hopStart >= 0) {
        const phase = (time - hopStart) / hopMs;
        if (phase >= 1) {
          hopStart = -1;
          nextHopAt = time + 2400 + Math.random() * 4600;
        } else {
          hop = Math.sin(phase * Math.PI) * hopHeight;
        }
      }

      paint(hop + Math.sin(elapsed / 260) * 1.2);
      raf = window.requestAnimationFrame(tick);
    };

    raf = window.requestAnimationFrame(tick);
    window.addEventListener("resize", settle);
    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("resize", settle);
    };
  }, [active, djMode]);

  if (!active) return null;

  return (
    <div className="djpet" aria-hidden="true">
      <img
        ref={artRef}
        className="djpet__art"
        src={PET_SRC}
        alt=""
        draggable={false}
        onError={(event) => {
          const art = event.currentTarget;
          if (art.dataset.fallback === "1") {
            art.style.display = "none";
            return;
          }
          art.dataset.fallback = "1";
          art.src = PET_FALLBACK;
        }}
      />
    </div>
  );
}
