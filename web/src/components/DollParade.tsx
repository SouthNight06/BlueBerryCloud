import type { CSSProperties } from "react";
import { useApp } from "../state/AppStore";
import { dollsForMode, normalizeDollMode } from "../lib/dolls";

export function DollParade() {
  const { settings, updatePreferences } = useApp();
  const mode = normalizeDollMode(settings?.preferences?.mascotMode);
  const dolls = dollsForMode(mode);

  if (!dolls.length) return null;

  return (
    <div className="parade" data-mode={mode}>
      {dolls.map((doll, index) => (
        <button
          key={doll.id}
          type="button"
          className="parade__slot"
          style={{ "--i": index } as CSSProperties}
          title={`${doll.name} · 点一下让她单独站到底栏`}
          onClick={() => void updatePreferences({ mascot: doll.id, mascotMode: "single" })}
        >
          <img className="parade__art" src={doll.art} alt={doll.name} draggable={false} />
        </button>
      ))}
    </div>
  );
}
