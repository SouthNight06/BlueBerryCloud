import { all, get, run } from "./db.js";
import { badRequest, HttpError, str } from "./http.js";
import { toTheme } from "./serializers.js";

export const BUILTIN_THEMES = [
  {
    id: "blueberry",
    name: "蓝莓与云朵",
    description: "云朵白打底，蓝莓紫点染",
    builtin: true,
    tokens: {
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
    },
  },
  {
    id: "midnight",
    name: "Midnight",
    description: "深夜灰蓝，冷色高光",
    builtin: true,
    tokens: {
      bg: "#0d0f12",
      "bg-soft": "#12151a",
      surface: "#151a20",
      "surface-raised": "#1b2129",
      border: "#262d36",
      text: "#eef2f7",
      "text-muted": "#8b97a6",
      accent: "#7cc2ff",
      "accent-soft": "rgba(124, 194, 255, 0.14)",
      "accent-contrast": "#04121f",
      radius: "16px",
      glow: "0 26px 70px -30px rgba(0, 0, 0, 0.85)",
    },
  },
  {
    id: "sage",
    name: "Sage",
    description: "雾绿植物感，安静留白",
    builtin: true,
    tokens: {
      bg: "#eef1e9",
      "bg-soft": "#e3e8db",
      surface: "#fbfcf7",
      "surface-raised": "#ffffff",
      border: "#d3dac6",
      text: "#1e2419",
      "text-muted": "#6b7561",
      accent: "#4c6b3f",
      "accent-soft": "rgba(76, 107, 63, 0.14)",
      "accent-contrast": "#f7fbf2",
      radius: "20px",
      glow: "0 26px 60px -30px rgba(52, 70, 42, 0.4)",
    },
  },
  {
    id: "graphite",
    name: "Graphite",
    description: "近黑石墨，米白细描",
    builtin: true,
    tokens: {
      bg: "#141414",
      "bg-soft": "#191919",
      surface: "#1d1d1d",
      "surface-raised": "#242424",
      border: "#2f2f2f",
      text: "#f2efe9",
      "text-muted": "#9a948b",
      accent: "#e6d9bf",
      "accent-soft": "rgba(230, 217, 191, 0.16)",
      "accent-contrast": "#1a1a1a",
      radius: "12px",
      glow: "0 24px 64px -28px rgba(0, 0, 0, 0.9)",
    },
  },
];

export const DEFAULT_THEME_ID = "blueberry";

const BUILTIN_BY_ID = new Map(BUILTIN_THEMES.map((theme) => [theme.id, theme]));

const TOKEN_KEY = /^[a-z][a-z0-9-]{0,31}$/;
const REQUIRED_TOKENS = ["bg", "surface", "text", "accent"];

export function normalizeTokens(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw badRequest("tokens_invalid");
  }
  const entries = Object.entries(input);
  if (entries.length === 0) throw badRequest("tokens_empty");
  if (entries.length > 48) throw badRequest("tokens_too_many");

  const tokens = {};
  for (const [key, value] of entries) {
    if (!TOKEN_KEY.test(key)) throw badRequest(`token_key_invalid:${key}`);
    if (typeof value !== "string") throw badRequest(`token_value_invalid:${key}`);
    const trimmed = value.trim();
    if (!trimmed || trimmed.length > 160) {
      throw badRequest(`token_value_invalid:${key}`);
    }
    if (/[;{}<>]/.test(trimmed)) throw badRequest(`token_value_unsafe:${key}`);
    tokens[key] = trimmed;
  }

  const missing = REQUIRED_TOKENS.filter((key) => !tokens[key]);
  if (missing.length > 0) {
    throw badRequest(`tokens_missing:${missing.join(",")}`);
  }
  return tokens;
}

export function listThemes(userId) {
  const own = all(
    "SELECT * FROM themes WHERE user_id = ? ORDER BY datetime(created_at) DESC",
    [userId],
  ).map(toTheme);
  return [...BUILTIN_THEMES, ...own];
}

export function isThemeAvailable(userId, themeId) {
  if (BUILTIN_BY_ID.has(themeId)) return true;
  if (!themeId.startsWith("user:")) return false;
  const numericId = Number(themeId.slice(5));
  if (!Number.isInteger(numericId)) return false;
  return Boolean(
    get("SELECT id FROM themes WHERE id = ? AND user_id = ?", [numericId, userId]),
  );
}

export function createTheme(userId, body) {
  const source = body?.theme && typeof body.theme === "object" ? body.theme : body;
  const name = str(source?.name, { field: "name", max: 60, required: true });
  const tokens = normalizeTokens(source?.tokens);
  const { lastInsertRowid } = run(
    "INSERT INTO themes (user_id, name, tokens) VALUES (?, ?, ?)",
    [userId, name, JSON.stringify(tokens)],
  );
  return toTheme(get("SELECT * FROM themes WHERE id = ?", [lastInsertRowid]));
}

export function updateTheme(userId, numericId, body) {
  const existing = get("SELECT * FROM themes WHERE id = ? AND user_id = ?", [
    numericId,
    userId,
  ]);
  if (!existing) throw new HttpError(404, "theme_not_found");

  const source = body?.theme && typeof body.theme === "object" ? body.theme : body;
  const name =
    source?.name === undefined
      ? existing.name
      : str(source.name, { field: "name", max: 60, required: true });
  const tokens =
    source?.tokens === undefined
      ? JSON.parse(existing.tokens)
      : normalizeTokens(source.tokens);

  run(
    "UPDATE themes SET name = ?, tokens = ?, updated_at = datetime('now') WHERE id = ?",
    [name, JSON.stringify(tokens), numericId],
  );
  return toTheme(get("SELECT * FROM themes WHERE id = ?", [numericId]));
}

export function deleteTheme(userId, numericId) {
  const existing = get("SELECT id FROM themes WHERE id = ? AND user_id = ?", [
    numericId,
    userId,
  ]);
  if (!existing) throw new HttpError(404, "theme_not_found");
  run("DELETE FROM themes WHERE id = ?", [numericId]);
}
