import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { DATA_DIR } from "./config.js";

export const db = new DatabaseSync(path.join(DATA_DIR, "xiaoyun.db"));

db.exec("PRAGMA journal_mode = WAL;");
db.exec("PRAGMA foreign_keys = ON;");

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tracks (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id    INTEGER NOT NULL,
  title       TEXT NOT NULL,
  artist      TEXT NOT NULL DEFAULT '',
  album       TEXT NOT NULL DEFAULT '',
  duration    REAL,
  source      TEXT NOT NULL DEFAULT 'local',
  source_id   TEXT,
  stream_url  TEXT,
  file_path   TEXT,
  cover_url   TEXT,
  license     TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tracks_source_unique
  ON tracks (owner_id, source, source_id)
  WHERE source_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS playlists (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL,
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS playlist_tracks (
  playlist_id INTEGER NOT NULL,
  track_id    INTEGER NOT NULL,
  position    INTEGER NOT NULL DEFAULT 0,
  added_at    TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (playlist_id, track_id)
);

CREATE TABLE IF NOT EXISTS themes (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL,
  name       TEXT NOT NULL,
  tokens     TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS user_settings (
  user_id      INTEGER PRIMARY KEY,
  active_theme TEXT NOT NULL DEFAULT 'blueberry',
  preferences  TEXT NOT NULL DEFAULT '{}',
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS lyrics (
  track_id   INTEGER PRIMARY KEY,
  owner_id   INTEGER NOT NULL,
  lrc        TEXT NOT NULL,
  source     TEXT NOT NULL DEFAULT 'manual',
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS bili_accounts (
  user_id    INTEGER PRIMARY KEY,
  sessdata   TEXT NOT NULL,
  bili_jct   TEXT NOT NULL DEFAULT '',
  dedeuserid TEXT NOT NULL DEFAULT '',
  uname      TEXT NOT NULL DEFAULT '',
  face       TEXT,
  vip        INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`);

db.exec(
  "UPDATE user_settings SET active_theme = 'blueberry' WHERE active_theme = 'aurora'",
);

export function run(sql, params = []) {
  const result = db.prepare(sql).run(...params);
  return {
    changes: Number(result.changes),
    lastInsertRowid: Number(result.lastInsertRowid),
  };
}

export function get(sql, params = []) {
  return db.prepare(sql).get(...params);
}

export function all(sql, params = []) {
  return db.prepare(sql).all(...params);
}

export function transaction(fn) {
  db.exec("BEGIN");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
