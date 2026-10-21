import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties, MouseEvent as ReactMouseEvent } from "react";
import { useApp } from "../state/AppStore";
import { DOLLS, DOLL_GROUPS, DOLL_MODES, DOLL_MODE_LABEL, dollArt, findDoll, normalizeDollMode } from "../lib/dolls";

const BOUNCE = [
  { transform: "translateY(0) scale(1, 1)", offset: 0 },
  { transform: "translateY(3px) scale(1.18, 0.76)", offset: 0.16 },
  { transform: "translateY(-9px) scale(0.9, 1.2)", offset: 0.44 },
  { transform: "translateY(0) scale(1.08, 0.94)", offset: 0.66 },
  { transform: "translateY(-2px) scale(0.98, 1.03)", offset: 0.84 },
  { transform: "translateY(0) scale(1, 1)", offset: 1 },
];

const PICKER_WIDTH = 276;

export function Mascot() {
  const { settings, updatePreferences } = useApp();
  const artRef = useRef<HTMLImageElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const pickerRef = useRef<HTMLDivElement | null>(null);
  const [picker, setPicker] = useState<{ left: number; bottom: number } | null>(null);

  const doll = findDoll(settings?.preferences?.mascot);
  const mode = normalizeDollMode(settings?.preferences?.mascotMode);
  const masked = settings?.preferences?.mascotMask === true;

  const bounce = useCallback(() => {
    const art = artRef.current;
    if (!art || typeof art.animate !== "function") return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      art.animate([{ transform: "scale(1)" }, { transform: "scale(1.05)" }, { transform: "scale(1)" }], {
        duration: 42,
        easing: "linear",
      });
      return;
    }
    art.animate(BOUNCE, { duration: 680, easing: "cubic-bezier(0.34, 1.42, 0.62, 1)" });
  }, []);

  const openPicker = useCallback(
    (event: ReactMouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      const rect = wrapRef.current?.getBoundingClientRect();
      if (!rect) return;
      const width = Math.min(PICKER_WIDTH, window.innerWidth - 16);
      setPicker({
        left: Math.min(Math.max(8, rect.right - width), window.innerWidth - width - 8),
        bottom: window.innerHeight - rect.top + 10,
      });
      bounce();
    },
    [bounce],
  );

  useEffect(() => {
    if (!picker) return;
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (target && pickerRef.current?.contains(target)) return;
      setPicker(null);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPicker(null);
    };
    window.addEventListener("pointerdown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [picker]);

  return (
    <div className="mascot__wrap" ref={wrapRef}>
      <button
        type="button"
        className="mascot"
        onClick={bounce}
        onContextMenu={openPicker}
        aria-label={`戳一下${doll.name}`}
        aria-haspopup="menu"
        aria-expanded={picker ? "true" : "false"}
        title={`${doll.name} · 右键换一只`}
      >
        <img ref={artRef} className="mascot__art" src={dollArt(doll, masked)} alt="" draggable={false} />
      </button>

      {picker ? (
        <div
          className="dollpick"
          ref={pickerRef}
          role="menu"
          aria-label="选择玩偶"
          style={{ left: picker.left, bottom: picker.bottom } as CSSProperties}
        >
          <div className="dollpick__head">
            <span>换一只</span>
            <span className="num">{doll.name}</span>
          </div>
          <div className="dollpick__modes">
            {DOLL_MODES.map((item) => (
              <button
                key={item}
                type="button"
                className="chip"
                aria-pressed={mode === item}
                onClick={() => void updatePreferences({ mascotMode: item })}
              >
                {DOLL_MODE_LABEL[item]}
              </button>
            ))}
            <button
              type="button"
              className="chip chip--mask"
              aria-pressed={masked}
              title="Ave Mujica 五只切换面具立绘"
              onClick={() => void updatePreferences({ mascotMask: !masked })}
            >
              面具 {masked ? "开" : "关"}
            </button>
          </div>
          <div className="dollpick__grid">
            {DOLLS.map((item) => (
              <button
                key={item.id}
                type="button"
                className="dollpick__item"
                aria-pressed={item.id === doll.id}
                title={`${item.name} · ${DOLL_GROUPS[item.group]}`}
                onClick={() => {
                  void updatePreferences({ mascot: item.id, mascotMode: "single" });
                  setPicker(null);
                  bounce();
                }}
              >
                <img src={dollArt(item, masked)} alt="" draggable={false} />
                <span>{item.name}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
