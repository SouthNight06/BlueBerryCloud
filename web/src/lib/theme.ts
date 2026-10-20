import type { ThemeTokens } from "../api/types";

export const DEFAULT_TOKENS: ThemeTokens = {
  bg: "#f3f6fd",
  "bg-soft": "#e8eef9",
  surface: "#fdfdff",
  "surface-raised": "#ffffff",
  border: "#d8e0f2",
  text: "#1b2035",
  "text-muted": "#6c7691",
  accent: "#4b56bd",
  "accent-soft": "rgba(75, 86, 189, 0.12)",
  "accent-contrast": "#f7f9ff",
  radius: "18px",
  glow: "0 26px 60px -30px rgba(32, 40, 96, 0.42)",
};

export const TOKEN_GROUPS: {
  label: string;
  hint: string;
  keys: { key: string; label: string; type: "color" | "text" }[];
}[] = [
  {
    label: "底色",
    hint: "整体纸张与浮层",
    keys: [
      { key: "bg", label: "背景", type: "color" },
      { key: "bg-soft", label: "背景层次", type: "color" },
      { key: "surface", label: "表面", type: "color" },
      { key: "surface-raised", label: "浮起表面", type: "color" },
      { key: "border", label: "描边", type: "color" },
    ],
  },
  {
    label: "文字",
    hint: "正文与次要信息",
    keys: [
      { key: "text", label: "正文", type: "color" },
      { key: "text-muted", label: "次要文字", type: "color" },
    ],
  },
  {
    label: "主色",
    hint: "强调与当前状态",
    keys: [
      { key: "accent", label: "主色", type: "color" },
      { key: "accent-soft", label: "主色浅底", type: "text" },
      { key: "accent-contrast", label: "主色前景", type: "color" },
    ],
  },
  {
    label: "形态",
    hint: "圆角与投影",
    keys: [
      { key: "radius", label: "圆角", type: "text" },
      { key: "glow", label: "投影", type: "text" },
    ],
  },
];

export const TOKEN_KEYS = TOKEN_GROUPS.flatMap((group) => group.keys.map((item) => item.key));

function luminance(hex: string): number {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return 0.85;
  const value = match[1];
  const channels = [0, 2, 4].map((offset) => {
    const channel = parseInt(value.slice(offset, offset + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

export function isDarkTheme(tokens: ThemeTokens): boolean {
  return luminance(tokens.bg ?? DEFAULT_TOKENS.bg) < 0.35;
}

export function applyTokens(tokens: ThemeTokens, target: HTMLElement = document.documentElement) {
  const merged = { ...DEFAULT_TOKENS, ...tokens };
  for (const [key, value] of Object.entries(merged)) {
    target.style.setProperty(`--${key}`, value);
  }
  document.documentElement.dataset.mode = isDarkTheme(merged) ? "dark" : "light";
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", merged.bg);
}

export function tokensToCssVars(tokens: ThemeTokens): Record<string, string> {
  const merged = { ...DEFAULT_TOKENS, ...tokens };
  const vars: Record<string, string> = {};
  for (const [key, value] of Object.entries(merged)) vars[`--${key}`] = value;
  return vars;
}

export function validateImportedTheme(value: unknown): { name: string; tokens: ThemeTokens } {
  if (!value || typeof value !== "object") throw new Error("JSON 需要是一个对象");
  const source = value as Record<string, unknown>;
  const nested =
    source.theme && typeof source.theme === "object"
      ? (source.theme as Record<string, unknown>)
      : source;

  const name = typeof nested.name === "string" ? nested.name.trim() : "";
  if (!name) throw new Error("缺少主题名称 name");
  if (name.length > 60) throw new Error("主题名称不能超过 60 个字符");

  const rawTokens = nested.tokens;
  if (!rawTokens || typeof rawTokens !== "object" || Array.isArray(rawTokens)) {
    throw new Error("缺少 tokens 对象");
  }

  const tokens: ThemeTokens = {};
  for (const [key, value] of Object.entries(rawTokens as Record<string, unknown>)) {
    if (!/^[a-z][a-z0-9-]{0,31}$/.test(key)) throw new Error(`token 名称不合法：${key}`);
    if (typeof value !== "string" || !value.trim()) throw new Error(`token 取值为空：${key}`);
    tokens[key] = value.trim();
  }

  for (const required of ["bg", "surface", "text", "accent"]) {
    if (!tokens[required]) throw new Error(`缺少必填 token：${required}`);
  }

  return { name, tokens };
}

export function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
