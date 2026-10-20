import type { CSSProperties } from "react";
import { artworkRecipe, artworkStyle } from "../lib/artwork";

type ArtworkProps = {
  seed: string;
  size?: number;
  label?: string;
  className?: string;
};

export function Artwork({ seed, size = 44, label, className }: ArtworkProps) {
  const recipe = artworkRecipe(seed);
  const style = {
    ...artworkStyle(seed),
    width: `${size}px`,
    height: `${size}px`,
    fontSize: `${Math.max(10, Math.round(size * 0.33))}px`,
  } as CSSProperties;

  return (
    <span className={className ? `art ${className}` : "art"} style={style} aria-hidden="true">
      <span className="art__glyph">{label ?? recipe.initial}</span>
    </span>
  );
}
