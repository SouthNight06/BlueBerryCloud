import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { MAX_UPLOAD_BYTES, UPLOAD_DIR } from "./config.js";

export async function saveRemoteAudio({
  url,
  headers = {},
  extension = ".m4a",
  maxBytes = MAX_UPLOAD_BYTES,
}) {
  const response = await fetch(url, {
    headers,
    redirect: "follow",
    signal: AbortSignal.timeout(300_000),
  });

  if (!response.ok || !response.body) {
    throw new Error(`download_http_${response.status}`);
  }

  const declared = Number(response.headers.get("content-length") ?? 0);
  if (declared > maxBytes) throw new Error("download_too_large");

  const filename = `${Date.now()}-${randomUUID()}${extension}`;
  const target = path.join(UPLOAD_DIR, filename);

  try {
    await pipeline(Readable.fromWeb(response.body), fs.createWriteStream(target));
    const size = fs.statSync(target).size;
    if (size === 0) throw new Error("download_empty");
    if (size > maxBytes) throw new Error("download_too_large");
    return { filename, bytes: size };
  } catch (error) {
    fs.rmSync(target, { force: true });
    throw error;
  }
}
