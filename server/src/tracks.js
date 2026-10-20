import fs from "node:fs";
import { get, run } from "./db.js";
import { int, notFound } from "./http.js";
import { resolveUploadPath } from "./upload.js";

export function ownedTrack(userId, rawId) {
  const id = int(rawId, { field: "id", min: 1 });
  const row = get("SELECT * FROM tracks WHERE id = ? AND owner_id = ?", [id, userId]);
  if (!row) throw notFound("track_not_found");
  return row;
}

export function findBySource(userId, source, sourceId) {
  if (!sourceId) return null;
  return get(
    "SELECT * FROM tracks WHERE owner_id = ? AND source = ? AND source_id = ?",
    [userId, source, sourceId],
  );
}

export function insertPrepared(userId, source, prepared) {
  const { lastInsertRowid } = run(
    `INSERT INTO tracks
      (owner_id, title, artist, album, duration, source, source_id, file_path, cover_url, license)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      userId,
      prepared.title,
      prepared.artist || "",
      prepared.album || "",
      prepared.duration ?? null,
      source,
      prepared.sourceId,
      prepared.filePath,
      prepared.coverUrl || null,
      prepared.license || null,
    ],
  );
  return get("SELECT * FROM tracks WHERE id = ?", [lastInsertRowid]);
}

export function discardFile(filePath) {
  const absolute = resolveUploadPath(filePath);
  if (!absolute) return;
  fs.rm(absolute, { force: true }, () => {});
}
