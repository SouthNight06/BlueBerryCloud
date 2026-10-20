import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { COVER_CACHE_DIR } from "../config.js";
import { normalizeImage } from "./client.js";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const BILI_IMAGE_HOST = /(^|\.)hdslb\.com$/i;
const EXTENSIONS = [".jpg", ".png", ".webp", ".gif"];
const EXT_BY_MIME = {
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

function cachedName(hash) {
  for (const extension of EXTENSIONS) {
    if (fs.existsSync(path.join(COVER_CACHE_DIR, `${hash}${extension}`))) {
      return `${hash}${extension}`;
    }
  }
  return null;
}

export async function cacheCover(url) {
  const normalized = normalizeImage(url);
  if (!normalized) return null;

  let parsed;
  try {
    parsed = new URL(normalized);
  } catch {
    return normalized;
  }
  if (!BILI_IMAGE_HOST.test(parsed.hostname)) return normalized;

  const hash = crypto.createHash("sha1").update(normalized).digest("hex").slice(0, 32);
  const existing = cachedName(hash);
  if (existing) return `/covers/${existing}`;

  try {
    const response = await fetch(normalized, {
      headers: { "User-Agent": USER_AGENT, Referer: "https://www.bilibili.com/" },
      redirect: "follow",
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok || !response.body) return normalized;

    const mime = String(response.headers.get("content-type") ?? "")
      .split(";")[0]
      .trim()
      .toLowerCase();
    const extension = EXT_BY_MIME[mime] ?? ".jpg";
    const target = path.join(COVER_CACHE_DIR, `${hash}${extension}`);
    await pipeline(Readable.fromWeb(response.body), fs.createWriteStream(target));
    if (fs.statSync(target).size === 0) {
      fs.rmSync(target, { force: true });
      return normalized;
    }
    return `/covers/${hash}${extension}`;
  } catch {
    return normalized;
  }
}

export function clearCoverCache() {
  let removed = 0;
  for (const entry of fs.readdirSync(COVER_CACHE_DIR, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    fs.rmSync(path.join(COVER_CACHE_DIR, entry.name), { force: true });
    removed += 1;
  }
  return removed;
}

export function coverCacheStats() {
  let bytes = 0;
  let files = 0;
  for (const entry of fs.readdirSync(COVER_CACHE_DIR, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    files += 1;
    bytes += fs.statSync(path.join(COVER_CACHE_DIR, entry.name)).size;
  }
  return { files, bytes };
}
