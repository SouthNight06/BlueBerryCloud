import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { Router } from "express";
import { authRequired } from "../auth.js";
import { all, get, run } from "../db.js";
import {
  asyncHandler,
  badRequest,
  HttpError,
  int,
  notFound,
  optionalInt,
  sanitizeFilename,
  str,
} from "../http.js";
import { toTrack } from "../serializers.js";
import { ALL_SOURCES, getSource, listSources, searchAll } from "../sources/index.js";
import { discardFile, findBySource, insertPrepared } from "../tracks.js";
import { audioUpload, resolveMediaPath, resolveUploadPath } from "../upload.js";

const router = Router();
const SEARCH_TTL_MS = 60_000;
const SEARCH_CACHE_LIMIT = 200;
const LOCAL_MEDIA_PATTERN = /^\/media\/[a-z0-9-]+\/[a-z0-9-]+\.wav$/;
const searchCache = new Map();

function cacheSearch(key, payload) {
  searchCache.set(key, { at: Date.now(), payload });
  if (searchCache.size > SEARCH_CACHE_LIMIT) {
    searchCache.delete(searchCache.keys().next().value);
  }
}

function ownedTrack(userId, rawId) {
  const id = int(rawId, { field: "id", min: 1 });
  const row = get("SELECT * FROM tracks WHERE id = ? AND owner_id = ?", [id, userId]);
  if (!row) throw notFound("track_not_found");
  return row;
}

function assertSafeStreamUrl(streamUrl) {
  if (!streamUrl) return null;
  if (LOCAL_MEDIA_PATTERN.test(streamUrl)) return streamUrl;

  let parsed;
  try {
    parsed = new URL(streamUrl);
  } catch {
    throw new HttpError(500, "invalid_stream_url");
  }
  if (parsed.protocol !== "https:" || !parsed.hostname.endsWith("archive.org")) {
    throw new HttpError(500, "blocked_stream_url");
  }
  return parsed.toString();
}

function localFileOf(track) {
  for (const candidate of [
    resolveUploadPath(track.file_path),
    resolveMediaPath(track.stream_url),
  ]) {
    if (candidate && fs.existsSync(candidate)) return candidate;
  }
  return null;
}

router.get("/sources", authRequired, (_req, res) => {
  res.json({ sources: listSources() });
});

router.get(
  "/search",
  authRequired,
  asyncHandler(async (req, res) => {
    const query = str(req.query.q, { field: "q", max: 120 });
    const sourceId = str(req.query.source, { field: "source", max: 40 }) || ALL_SOURCES;
    const limit = optionalInt(req.query.limit, { field: "limit", min: 1, max: 40 }) ?? 20;

    const key = `${sourceId}:${limit}:${query.toLowerCase()}`;
    const cached = searchCache.get(key);
    if (cached && Date.now() - cached.at < SEARCH_TTL_MS) {
      res.json({ ...cached.payload, cached: true });
      return;
    }

    if (sourceId === ALL_SOURCES) {
      const payload = await searchAll(query, { limit, userId: req.user.uid });
      cacheSearch(key, payload);
      res.json({ ...payload, cached: false });
      return;
    }

    const source = getSource(sourceId);
    if (!source) throw notFound("source_not_found");

    let results;
    try {
      results = await source.search(query, { limit, userId: req.user.uid });
    } catch (error) {
      throw new HttpError(502, `source_unavailable:${sourceId}:${error.message ?? "failed"}`);
    }

    const payload = {
      results,
      status: [{ id: source.id, name: source.name, ok: true, count: results.length }],
    };
    cacheSearch(key, payload);
    res.json({ ...payload, cached: false });
  }),
);

router.get(
  "/tracks",
  authRequired,
  asyncHandler(async (req, res) => {
    const rows = all(
      "SELECT * FROM tracks WHERE owner_id = ? ORDER BY datetime(created_at) DESC, id DESC",
      [req.user.uid],
    );
    res.json({ tracks: rows.map(toTrack) });
  }),
);

router.post(
  "/tracks/import",
  authRequired,
  asyncHandler(async (req, res) => {
    const sourceId = str(req.body?.source, { field: "source", max: 40, required: true });
    const sourceItemId = str(req.body?.sourceId, {
      field: "sourceId",
      max: 200,
      required: true,
    });

    const source = getSource(sourceId);
    if (!source) throw notFound("source_not_found");

    const existing = get(
      "SELECT * FROM tracks WHERE owner_id = ? AND source = ? AND source_id = ?",
      [req.user.uid, sourceId, sourceItemId],
    );
    if (existing) {
      res.json({ track: toTrack(existing), duplicated: true });
      return;
    }

    let resolved;
    try {
      resolved = await source.resolve(sourceItemId, { userId: req.user.uid });
    } catch (error) {
      throw new HttpError(502, `source_resolve_failed:${error.message ?? sourceId}`);
    }

    if (resolved?.filePath) {
      const clash =
        resolved.sourceId && resolved.sourceId !== sourceItemId
          ? findBySource(req.user.uid, sourceId, resolved.sourceId)
          : null;
      if (clash) {
        discardFile(resolved.filePath);
        res.json({ track: toTrack(clash), duplicated: true });
        return;
      }
      const row = insertPrepared(req.user.uid, sourceId, resolved);
      res.status(201).json({ track: toTrack(row), duplicated: false });
      return;
    }

    const { lastInsertRowid } = run(
      `INSERT INTO tracks
        (owner_id, title, artist, album, duration, source, source_id, stream_url, cover_url, license)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user.uid,
        resolved.title,
        resolved.artist || "",
        resolved.album || "",
        resolved.duration ?? null,
        sourceId,
        sourceItemId,
        assertSafeStreamUrl(resolved.streamUrl),
        resolved.coverUrl || null,
        resolved.license || null,
      ],
    );

    res.status(201).json({
      track: toTrack(get("SELECT * FROM tracks WHERE id = ?", [lastInsertRowid])),
      duplicated: false,
    });
  }),
);

router.post(
  "/tracks/upload",
  authRequired,
  audioUpload,
  asyncHandler(async (req, res) => {
    if (!req.file) throw badRequest("file_required");

    const title =
      str(req.body?.title, { field: "title", max: 200 }) ||
      path.parse(req.file.originalname).name;

    const { lastInsertRowid } = run(
      `INSERT INTO tracks
        (owner_id, title, artist, album, duration, source, file_path, license)
       VALUES (?, ?, ?, ?, ?, 'local', ?, ?)`,
      [
        req.user.uid,
        title.slice(0, 200),
        str(req.body?.artist, { field: "artist", max: 200 }),
        str(req.body?.album, { field: "album", max: 200 }),
        optionalInt(req.body?.duration, { field: "duration", min: 0, max: 86_400 }),
        req.file.filename,
        "本地导入",
      ],
    );

    res.status(201).json({
      track: toTrack(get("SELECT * FROM tracks WHERE id = ?", [lastInsertRowid])),
    });
  }),
);

router.patch(
  "/tracks/:id",
  authRequired,
  asyncHandler(async (req, res) => {
    const track = ownedTrack(req.user.uid, req.params.id);
    const title =
      req.body?.title === undefined
        ? track.title
        : str(req.body.title, { field: "title", max: 200, required: true });
    const artist =
      req.body?.artist === undefined
        ? track.artist
        : str(req.body.artist, { field: "artist", max: 200 });
    const album =
      req.body?.album === undefined
        ? track.album
        : str(req.body.album, { field: "album", max: 200 });
    const duration =
      req.body?.duration === undefined
        ? track.duration
        : optionalInt(req.body.duration, { field: "duration", min: 0, max: 86_400 });

    run("UPDATE tracks SET title = ?, artist = ?, album = ?, duration = ? WHERE id = ?", [
      title,
      artist,
      album,
      duration ?? null,
      track.id,
    ]);

    res.json({ track: toTrack(get("SELECT * FROM tracks WHERE id = ?", [track.id])) });
  }),
);

router.delete(
  "/tracks/:id",
  authRequired,
  asyncHandler(async (req, res) => {
    const track = ownedTrack(req.user.uid, req.params.id);
    run("DELETE FROM playlist_tracks WHERE track_id = ?", [track.id]);
    run("DELETE FROM tracks WHERE id = ?", [track.id]);

    const absolute = resolveUploadPath(track.file_path);
    if (absolute) fs.rm(absolute, { force: true }, () => {});

    res.json({ deleted: true });
  }),
);

router.get(
  "/tracks/:id/stream",
  authRequired,
  asyncHandler(async (req, res) => {
    const track = ownedTrack(req.user.uid, req.params.id);

    const localFile = localFileOf(track);
    if (localFile) {
      res.sendFile(localFile);
      return;
    }

    const target = assertSafeStreamUrl(track.stream_url);
    if (!target) throw notFound("no_audio_source");
    res.redirect(302, target);
  }),
);

router.get(
  "/tracks/:id/download",
  authRequired,
  asyncHandler(async (req, res) => {
    const track = ownedTrack(req.user.uid, req.params.id);
    const localFile = localFileOf(track);
    const extension = localFile ? path.extname(localFile) : ".mp3";
    const filename = `${sanitizeFilename(
      `${track.artist ? `${track.artist} - ` : ""}${track.title}`,
    )}${extension}`;

    if (localFile) {
      res.download(localFile, filename);
      return;
    }

    const target = assertSafeStreamUrl(track.stream_url);
    if (!target) throw notFound("no_audio_source");

    const upstream = await fetch(target, {
      signal: AbortSignal.timeout(60_000),
      headers: { "User-Agent": "CloudMusic/1.0.2 (personal music player)" },
    });
    if (!upstream.ok || !upstream.body) throw new HttpError(502, "download_failed");

    res.attachment(filename);
    res.setHeader("Content-Type", "application/octet-stream");
    Readable.fromWeb(upstream.body).pipe(res);
  }),
);

export default router;
