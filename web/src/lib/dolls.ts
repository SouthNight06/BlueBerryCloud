export type DollGroup = "popipa" | "roselia" | "mygo" | "mujica";

export const DOLL_GROUPS: Record<DollGroup, string> = {
  popipa: "Poppin'Party",
  roselia: "Roselia",
  mygo: "MyGO!!!!!",
  mujica: "Ave Mujica",
};

export type Doll = {
  id: string;
  name: string;
  group: DollGroup;
  vocal: boolean;
  art: string;
  maskArt?: string;
};

const doll = (id: string, name: string, group: DollGroup, vocal = false): Doll => ({
  id,
  name,
  group,
  vocal,
  art: `/dolls/${id}.png`,
  ...(group === "mujica" ? { maskArt: `/dolls/${id}-mask.png` } : {}),
});

export function dollArt(item: Doll, masked: boolean): string {
  return masked && item.maskArt ? item.maskArt : item.art;
}

export const DOLLS: readonly Doll[] = [
  doll("ksm", "户山香澄", "popipa", true),
  doll("otae", "花园多惠", "popipa"),
  doll("saaya", "山吹沙绫", "popipa"),
  doll("rimi", "牛込里美", "popipa"),
  doll("arisa", "市谷有咲", "popipa"),
  doll("yukina", "凑友希那", "roselia", true),
  doll("lisa", "今井莉莎", "roselia"),
  doll("ako", "宇田川亚子", "roselia"),
  doll("rinrin", "白金磷子", "roselia"),
  doll("sayo", "冰川纱夜", "roselia"),
  doll("tomori", "高松灯", "mygo", true),
  doll("anon", "千早爱音", "mygo"),
  doll("rana", "要乐奈", "mygo"),
  doll("soyo", "长崎素世", "mygo"),
  doll("taki", "椎名立希", "mygo"),
  doll("uika", "三角初华", "mujica", true),
  doll("sakiko", "丰川祥子", "mujica"),
  doll("mutsumi", "若叶睦", "mujica"),
  doll("umirin", "八幡海铃", "mujica"),
  doll("nyamu", "祐天寺若麦", "mujica"),
];

export const DEFAULT_DOLL = "ksm";

export type DollMode = "single" | "all" | "vocal";

export const DOLL_MODES: readonly DollMode[] = ["single", "all", "vocal"];

export const DOLL_MODE_LABEL: Record<DollMode, string> = {
  single: "单个",
  all: "全员出动",
  vocal: "主唱",
};

export function normalizeDollMode(value: unknown): DollMode {
  return value === "all" || value === "vocal" ? value : "single";
}

export function findDoll(id: unknown): Doll {
  const hit = typeof id === "string" ? DOLLS.find((item) => item.id === id) : undefined;
  return hit ?? DOLLS[0];
}

export function dollsForMode(mode: DollMode): readonly Doll[] {
  if (mode === "all") return DOLLS;
  if (mode === "vocal") return DOLLS.filter((item) => item.vocal);
  return [];
}
