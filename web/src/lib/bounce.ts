export const BOUNCE_KEYFRAMES: Keyframe[] = [
  { transform: "translateY(0) scale(1, 1)", offset: 0 },
  { transform: "translateY(3px) scale(1.18, 0.76)", offset: 0.16 },
  { transform: "translateY(-9px) scale(0.9, 1.2)", offset: 0.44 },
  { transform: "translateY(0) scale(1.08, 0.94)", offset: 0.66 },
  { transform: "translateY(-2px) scale(0.98, 1.03)", offset: 0.84 },
  { transform: "translateY(0) scale(1, 1)", offset: 1 },
];

export function bounceElement(el: Element | null) {
  if (!el || typeof (el as HTMLElement).animate !== "function") return;
  const target = el as HTMLElement;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    target.animate([{ transform: "scale(1)" }, { transform: "scale(1.05)" }, { transform: "scale(1)" }], {
      duration: 42,
      easing: "linear",
    });
    return;
  }
  target.animate(BOUNCE_KEYFRAMES, { duration: 680, easing: "cubic-bezier(0.34, 1.42, 0.62, 1)" });
}
