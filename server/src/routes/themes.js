import { Router } from "express";
import { authRequired } from "../auth.js";
import { get, run } from "../db.js";
import { asyncHandler, HttpError, int, str } from "../http.js";
import {
  createTheme,
  DEFAULT_THEME_ID,
  deleteTheme,
  isThemeAvailable,
  listThemes,
  updateTheme,
} from "../themes.js";

const router = Router();

function readSettings(userId) {
  const row = get(
    "SELECT active_theme, preferences, updated_at FROM user_settings WHERE user_id = ?",
    [userId],
  );
  if (!row) return { activeTheme: DEFAULT_THEME_ID, preferences: {}, updatedAt: null };
  return {
    activeTheme: row.active_theme,
    preferences: safeParse(row.preferences),
    updatedAt: row.updated_at,
  };
}

function safeParse(value) {
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

function userNumericId(rawId) {
  return int(String(rawId).replace(/^user:/, ""), { field: "id", min: 1 });
}

router.get(
  "/themes",
  authRequired,
  asyncHandler(async (req, res) => {
    res.json({ themes: listThemes(req.user.uid) });
  }),
);

router.post(
  "/themes",
  authRequired,
  asyncHandler(async (req, res) => {
    res.status(201).json({ theme: createTheme(req.user.uid, req.body) });
  }),
);

router.patch(
  "/themes/:id",
  authRequired,
  asyncHandler(async (req, res) => {
    res.json({ theme: updateTheme(req.user.uid, userNumericId(req.params.id), req.body) });
  }),
);

router.delete(
  "/themes/:id",
  authRequired,
  asyncHandler(async (req, res) => {
    const numericId = userNumericId(req.params.id);
    deleteTheme(req.user.uid, numericId);

    const settings = readSettings(req.user.uid);
    if (settings.activeTheme === `user:${numericId}`) {
      run(
        "UPDATE user_settings SET active_theme = ?, updated_at = datetime('now') WHERE user_id = ?",
        [DEFAULT_THEME_ID, req.user.uid],
      );
    }
    res.json({ deleted: true });
  }),
);

router.get(
  "/settings",
  authRequired,
  asyncHandler(async (req, res) => {
    res.json({ settings: readSettings(req.user.uid) });
  }),
);

router.patch(
  "/settings",
  authRequired,
  asyncHandler(async (req, res) => {
    const current = readSettings(req.user.uid);
    let activeTheme = current.activeTheme;

    if (req.body?.activeTheme !== undefined) {
      activeTheme = str(req.body.activeTheme, {
        field: "activeTheme",
        max: 40,
        required: true,
      });
      if (!isThemeAvailable(req.user.uid, activeTheme)) {
        throw new HttpError(400, "theme_not_found");
      }
    }

    let preferences = current.preferences;
    if (req.body?.preferences !== undefined) {
      const raw = req.body.preferences;
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
        throw new HttpError(400, "preferences_invalid");
      }
      const serialized = JSON.stringify(raw);
      if (serialized.length > 4000) throw new HttpError(413, "preferences_too_large");
      preferences = raw;
    }

    run(
      `INSERT INTO user_settings (user_id, active_theme, preferences, updated_at)
       VALUES (?, ?, ?, datetime('now'))
       ON CONFLICT(user_id) DO UPDATE SET
         active_theme = excluded.active_theme,
         preferences = excluded.preferences,
         updated_at = datetime('now')`,
      [req.user.uid, activeTheme, JSON.stringify(preferences)],
    );

    res.json({ settings: readSettings(req.user.uid) });
  }),
);

export default router;
