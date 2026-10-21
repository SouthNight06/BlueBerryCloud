import { useEffect } from "react";
import type { CSSProperties, MouseEvent as ReactMouseEvent } from "react";
import { useApp } from "../state/AppStore";
import { bounceElement } from "../lib/bounce";
import { dollArt, dollsForMode, normalizeDollMode } from "../lib/dolls";

export function DollParade() {
  const { settings, updatePreferences } = useApp();
  const mode = normalizeDollMode(settings?.preferences?.mascotMode);
  const masked = settings?.preferences?.mascotMask === true;
  const dolls = dollsForMode(mode);

  useEffect(() => {
    const root = document.documentElement;
    if (!dolls.length) {
      root.style.removeProperty("--parade-count");
      return;
    }
    root.style.setProperty("--parade-count", String(dolls.length));
    return () => {
      root.style.removeProperty("--parade-count");
    };
  }, [dolls.length]);

  if (!dolls.length) return null;

  const poke = (event: ReactMouseEvent<HTMLButtonElement>) => {
    bounceElement(event.currentTarget.querySelector(".parade__art"));
  };

  const pick = (event: ReactMouseEvent<HTMLButtonElement>, id: string) => {
    event.preventDefault();
    bounceElement(event.currentTarget.querySelector(".parade__art"));
    void updatePreferences({ mascot: id, mascotMode: "single" });
  };

  return (
    <div
      className="parade"
      data-mode={mode}
      style={{ "--parade-count": dolls.length } as CSSProperties}
    >
      {dolls.map((doll, index) => (
        <button
          key={doll.id}
          type="button"
          className="parade__slot"
          style={{ "--i": index } as CSSProperties}
          title={`${doll.name} · 点一下 q 弹，右键让她单独站到底栏`}
          onClick={poke}
          onContextMenu={(event) => pick(event, doll.id)}
        >
          <img className="parade__art" src={dollArt(doll, masked)} alt={doll.name} draggable={false} />
        </button>
      ))}
    </div>
  );
}
