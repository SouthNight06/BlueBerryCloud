function hashOf(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash);
}

export type ArtworkRecipe = {
  angle: number;
  fromMix: number;
  toMix: number;
  initial: string;
  offset: number;
};

export function artworkRecipe(seed: string): ArtworkRecipe {
  const hash = hashOf(seed || "blueberry");
  const initial = (seed.trim()[0] ?? "A").toUpperCase();
  return {
    angle: 120 + (hash % 100),
    fromMix: 18 + (hash % 12),
    toMix: 34 + ((hash >> 3) % 16),
    initial,
    offset: 42 + ((hash >> 7) % 30),
  };
}

export function artworkStyle(seed: string): Record<string, string> {
  const recipe = artworkRecipe(seed);
  return {
    "--art-angle": `${recipe.angle}deg`,
    "--art-from": `${recipe.fromMix}%`,
    "--art-to": `${recipe.toMix}%`,
    "--art-offset": `${recipe.offset}%`,
  };
}
