import type { CSSProperties, SyntheticEvent } from "react";
import { artworkRecipe, artworkStyle } from "../lib/artwork";

const PLACEHOLDER = "/artwork-placeholder.jpg";

type ArtworkProps = {
  seed: string;
  size?: number;
  label?: string;
  className?: string;
  cover?: string | null;
};

export function Artwork({ seed, size = 44, label, className, cover }: ArtworkProps) {
  const recipe = artworkRecipe(seed);
  const style = {
    ...artworkStyle(seed),
    width: `${size}px`,
    height: `${size}px`,
    fontSize: `${Math.max(10, Math.round(size * 0.33))}px`,
  } as CSSProperties;

  const remote = typeof cover === "string" ? cover.trim() : "";
  const src = cover === undefined ? null : remote || PLACEHOLDER;

  return (
    <span className={className ? `art ${className}` : "art"} style={style} aria-hidden="true">
      {src ? (
        <img
          className="art__img"
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          onError={(event: SyntheticEvent<HTMLImageElement>) => {
            const img = event.currentTarget;
            if (img.src.endsWith(PLACEHOLDER)) return;
            img.src = PLACEHOLDER;
          }}
        />
      ) : (
        <span className="art__glyph">{label ?? recipe.initial}</span>
      )}
    </span>
  );
}
