import { Router } from "express";
import { authRequired, publicUser } from "../auth.js";
import { all, get } from "../db.js";
import { asyncHandler, HttpError } from "../http.js";
import { toPlaylist, toTrack } from "../serializers.js";
import { listSources } from "../sources/index.js";
import { listThemes } from "../themes.js";

const router = Router();

router.get(
  "/sync",
  authRequired,
  asyncHandler(async (req, res) => {
    const user = get("SELECT * FROM users WHERE id = ?", [req.user.uid]);
    if (!user) throw new HttpError(401, "user_not_found");

    const tracks = all(
      "SELECT * FROM tracks WHERE owner_id = ? ORDER BY datetime(created_at) DESC, id DESC",
      [req.user.uid],
    );
    const playlists = all(
      `SELECT p.*, (SELECT COUNT(*) FROM playlist_tracks pt WHERE pt.playlist_id = p.id) AS track_count
         FROM playlists p
        WHERE p.user_id = ?
        ORDER BY datetime(p.updated_at) DESC, p.id DESC`,
      [req.user.uid],
    );
    const membership = all(
      `SELECT pt.playlist_id, pt.track_id, pt.position
         FROM playlist_tracks pt
         JOIN playlists p ON p.id = pt.playlist_id
        WHERE p.user_id = ?
        ORDER BY pt.position ASC`,
      [req.user.uid],
    );

    const trackIdsByPlaylist = {};
    for (const row of membership) {
      const bucket = (trackIdsByPlaylist[row.playlist_id] ??= []);
      bucket.push(row.track_id);
    }

    res.json({
      user: publicUser(user),
      tracks: tracks.map(toTrack),
      playlists: playlists.map((row) => ({
        ...toPlaylist(row),
        trackIds: trackIdsByPlaylist[row.id] ?? [],
      })),
      themes: listThemes(req.user.uid),
      sources: listSources(),
      syncedAt: new Date().toISOString(),
    });
  }),
);

export default router;
