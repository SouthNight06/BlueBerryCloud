import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = (() => {
  try {
    return path.dirname(fileURLToPath(import.meta.url));
  } catch {
    return process.cwd();
  }
})();

export const SERVER_ROOT = path.resolve(here, "..");

export const DATA_ROOT = process.env.XIAOYUN_DATA_DIR
  ? path.resolve(process.env.XIAOYUN_DATA_DIR)
  : SERVER_ROOT;

export const DATA_DIR = path.join(DATA_ROOT, "data");
export const UPLOAD_DIR = path.join(DATA_ROOT, "uploads");
export const MEDIA_DIR = path.join(DATA_ROOT, "media");
export const CACHE_DIR = path.join(DATA_DIR, "cache");
export const COVER_CACHE_DIR = path.join(CACHE_DIR, "covers");

export const WEB_DIST = process.env.XIAOYUN_WEB_DIST
  ? path.resolve(process.env.XIAOYUN_WEB_DIST)
  : path.resolve(SERVER_ROOT, "..", "web", "dist");

export const PORT = Number(process.env.PORT || 3001);
export const HOST = process.env.HOST || "127.0.0.1";

export const CORS_ORIGINS = (process.env.CORS_ORIGINS || "*")
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean);

export const JWT_SECRET =
  process.env.JWT_SECRET || "xiaoyun-changting-dev-secret-change-me";
export const MAX_UPLOAD_BYTES = Number(
  process.env.MAX_UPLOAD_BYTES || 200 * 1024 * 1024
);

export const AI_BASE_URL = (process.env.XIAOYUN_AI_BASE_URL || "").replace(/\/+$/, "");
export const AI_KEY = process.env.XIAOYUN_AI_KEY || "";
export const AI_MODEL = process.env.XIAOYUN_AI_MODEL || "gpt-4o-mini";

for (const dir of [DATA_DIR, UPLOAD_DIR, MEDIA_DIR, CACHE_DIR, COVER_CACHE_DIR]) {
  fs.mkdirSync(dir, { recursive: true });
}
