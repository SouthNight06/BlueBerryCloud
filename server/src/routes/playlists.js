import { Router } from "express";
import { authRequired } from "../auth.js";
import { all, get, run, transaction } from "../db.js";
import { asyncHandler, HttpError, int, notFound, str } from "../http.js";
import { toPlaylist, toTrack } from "../serializers.js";

const router = Router();
const MAX_TRACKS_PER_PLAYLIST = 500;

function ownedPlaylist(userId, rawId) {
  const id = int(rawId, { field: "id", min: 1 });
  const row = get("SELECT * FROM playlists WHERE id = ? AND user_id = ?", [id, userId]);
  if (!row) throw notFound("playlist_not_found");
  return row;
}

function touch(playlistId) {
  run("UPDATE playlists SET updated_at = datetime('now') WHERE id = ?", [playlistId]);
}

function playlistWithCount(userId, playlistId) {
  const row = get(
    `SELECT p.*, (SELECT COUNT(*) FROM playlist_tracks pt WHERE pt.playlist_id = p.id) AS track_count
       FROM playlists p
      WHERE p.id = ? AND p.user_id = ?`,
    [playlistId, userId],
  );
  if (!row) throw notFound("playlist_not_found");
  return toPlaylist(row);
}

router.get(
  "/",
  authRequired,
  asyncHandler(async (req, res) => {
    const rows = all(
      `SELECT p.*, (SELECT COUNT(*) FROM playlist_tracks pt WHERE pt.playlist_id = p.id) AS track_count
         FROM playlists p
        WHERE p.user_id = ?
        ORDER BY datetime(p.updated_at) DESC, p.id DESC`,
      [req.user.uid],
    );
    res.json({ playlists: rows.map(toPlaylist) });
  }),
);

router.post(
  "/",
  authRequired,
  asyncHandler(async (req, res) => {
    const name = str(req.body?.name, { field: "name", max: 80, required: true });
    const description = str(req.body?.description, { field: "description", max: 300 });

    const { lastInsertRowid } = run(
      "INSERT INTO playlists (user_id, name, description) VALUES (?, ?, ?)",
      [req.user.uid, name, description],
    );
    res.status(201).json({ playlist: playlistWithCount(req.user.uid, lastInsertRowid) });
  }),
);

router.get(
  "/:id",
  authRequired,
  asyncHandler(async (req, res) => {
    const playlist = ownedPlaylist(req.user.uid, req.params.id);
    const tracks = all(
      `SELECT t.*
         FROM playlist_tracks pt
         JOIN tracks t ON t.id = pt.track_id
        WHERE pt.playlist_id = ?
        ORDER BY pt.position ASC, pt.added_at ASC`,
      [playlist.id],
    );
    res.json({
      playlist: playlistWithCount(req.user.uid, playlist.id),
      tracks: tracks.map(toTrack),
    });
  }),
);

router.patch(
  "/:id",
  authRequired,
  asyncHandler(async (req, res) => {
    const playlist = ownedPlaylist(req.user.uid, req.params.id);
    const name =
      req.body?.name === undefined
        ? playlist.name
        : str(req.body.name, { field: "name", max: 80, required: true });
    const description =
      req.body?.description === undefined
        ? playlist.description
        : str(req.body.description, { field: "description", max: 300 });

    run(
      "UPDATE playlists SET name = ?, description = ?, updated_at = datetime('now') WHERE id = ?",
      [name, description, playlist.id],
    );
    res.json({ playlist: playlistWithCount(req.user.uid, playlist.id) });
  }),
);

router.delete(
  "/:id",
  authRequired,
  asyncHandler(async (req, res) => {
    const playlist = ownedPlaylist(req.user.uid, req.params.id);
    transaction(() => {
      run("DELETE FROM playlist_tracks WHERE playlist_id = ?", [playlist.id]);
      run("DELETE FROM playlists WHERE id = ?", [playlist.id]);
    });
    res.json({ deleted: true });
  }),
);

router.post(
  "/:id/tracks",
  authRequired,
  asyncHandler(async (req, res) => {
    const playlist = ownedPlaylist(req.user.uid, req.params.id);
    const trackId = int(req.body?.trackId, { field: "trackId", min: 1 });

    const track = get("SELECT id FROM tracks WHERE id = ? AND owner_id = ?", [
      trackId,
      req.user.uid,
    ]);
    if (!track) throw notFound("track_not_found");

    const existing = get(
      "SELECT 1 AS present FROM playlist_tracks WHERE playlist_id = ? AND track_id = ?",
      [playlist.id, trackId],
    );
    if (existing) {
      res.json({ playlist: playlistWithCount(req.user.uid, playlist.id), duplicated: true });
      return;
    }

    const { count } = get(
      "SELECT COUNT(*) AS count FROM playlist_tracks WHERE playlist_id = ?",
      [playlist.id],
    );
    if (Number(count) >= MAX_TRACKS_PER_PLAYLIST) {
      throw new HttpError(409, "playlist_full");
    }

    const { nextPosition } = get(
      "SELECT COALESCE(MAX(position), -1) + 1 AS nextPosition FROM playlist_tracks WHERE playlist_id = ?",
      [playlist.id],
    );
    run(
      "INSERT INTO playlist_tracks (playlist_id, track_id, position) VALUES (?, ?, ?)",
      [playlist.id, trackId, Number(nextPosition)],
    );
    touch(playlist.id);

    res.status(201).json({
      playlist: playlistWithCount(req.user.uid, playlist.id),
      duplicated: false,
    });
  }),
);

router.delete(
  "/:id/tracks/:trackId",
  authRequired,
  asyncHandler(async (req, res) => {
    const playlist = ownedPlaylist(req.user.uid, req.params.id);
    const trackId = int(req.params.trackId, { field: "trackId", min: 1 });

    run("DELETE FROM playlist_tracks WHERE playlist_id = ? AND track_id = ?", [
      playlist.id,
      trackId,
    ]);
    touch(playlist.id);
    res.json({ playlist: playlistWithCount(req.user.uid, playlist.id) });
  }),
);

router.patch(
  "/:id/order",
  authRequired,
  asyncHandler(async (req, res) => {
    const playlist = ownedPlaylist(req.user.uid, req.params.id);
    const trackIds = req.body?.trackIds;
    if (!Array.isArray(trackIds) || trackIds.length === 0) {
      throw new HttpError(400, "trackIds_required");
    }

    const ordered = trackIds.map((value, index) =>
      int(value, { field: `trackIds[${index}]`, min: 1 }),
    );

    const existing = new Set(
      all("SELECT track_id FROM playlist_tracks WHERE playlist_id = ?", [playlist.id]).map(
        (row) => row.track_id,
      ),
    );
    if (ordered.length !== existing.size || ordered.some((id) => !existing.has(id))) {
      throw new HttpError(400, "trackIds_mismatch");
    }

    transaction(() => {
      ordered.forEach((trackId, index) => {
        run(
          "UPDATE playlist_tracks SET position = ? WHERE playlist_id = ? AND track_id = ?",
          [index, playlist.id, trackId],
        );
      });
    });
    touch(playlist.id);

    res.json({ playlist: playlistWithCount(req.user.uid, playlist.id) });
  }),
);

export default router;
