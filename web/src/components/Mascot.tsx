import { useCallback, useRef } from "react";

const MASCOT_SRC = "/ksm.png";

const BOUNCE = [
  { transform: "translateY(0) scale(1, 1)", offset: 0 },
  { transform: "translateY(3px) scale(1.18, 0.76)", offset: 0.16 },
  { transform: "translateY(-9px) scale(0.9, 1.2)", offset: 0.44 },
  { transform: "translateY(0) scale(1.08, 0.94)", offset: 0.66 },
  { transform: "translateY(-2px) scale(0.98, 1.03)", offset: 0.84 },
  { transform: "translateY(0) scale(1, 1)", offset: 1 },
];

export function Mascot() {
  const artRef = useRef<HTMLImageElement | null>(null);

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

  return (
    <button
      type="button"
      className="mascot"
      onClick={bounce}
      aria-label="戳一下小玩偶"
      title="戳我"
    >
      <img ref={artRef} className="mascot__art" src={MASCOT_SRC} alt="" draggable={false} />
    </button>
  );
}
