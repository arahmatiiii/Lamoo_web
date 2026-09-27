import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

/**
 * One SQLite file holds everything, images included. On a single small VPS that
 * is a feature rather than a compromise: a backup is `cp lamoo.db elsewhere`,
 * and there is no second service to keep alive.
 */
const SCHEMA = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  handle        TEXT NOT NULL,
  handle_lower  TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name  TEXT NOT NULL,
  friend_code   TEXT NOT NULL UNIQUE,
  household_id  TEXT REFERENCES households(id) ON DELETE SET NULL,
  created_at    INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS tokens (
  token_hash   TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at   INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS tokens_by_user ON tokens(user_id);

CREATE TABLE IF NOT EXISTS households (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  invite_code TEXT NOT NULL UNIQUE,
  seq         INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL
);

-- The shared collections, one row per entity, readable by the server.
CREATE TABLE IF NOT EXISTS records (
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  kind         TEXT NOT NULL,
  record_id    TEXT NOT NULL,
  updated_at   INTEGER NOT NULL,
  deleted      INTEGER NOT NULL DEFAULT 0,
  value_json   TEXT,
  seq          INTEGER NOT NULL,
  PRIMARY KEY (household_id, kind, record_id)
);
CREATE INDEX IF NOT EXISTS records_by_seq ON records(household_id, seq);

CREATE TABLE IF NOT EXISTS friendships (
  id           TEXT PRIMARY KEY,
  requester_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  addressee_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status       TEXT NOT NULL,
  created_at   INTEGER NOT NULL,
  UNIQUE (requester_id, addressee_id)
);
CREATE INDEX IF NOT EXISTS friendships_by_addressee ON friendships(addressee_id, status);

-- A share card: a recipe snapshot a friend can read and keep.
CREATE TABLE IF NOT EXISTS cards (
  id          TEXT PRIMARY KEY,
  author_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  note        TEXT NOT NULL DEFAULT '',
  recipe_json TEXT NOT NULL,
  image_id    TEXT REFERENCES media(id) ON DELETE SET NULL,
  created_at  INTEGER NOT NULL,
  expires_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS cards_by_author ON cards(author_id, created_at DESC);
CREATE INDEX IF NOT EXISTS cards_by_expiry ON cards(expires_at);

CREATE TABLE IF NOT EXISTS card_views (
  card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  seen_at INTEGER NOT NULL,
  PRIMARY KEY (card_id, user_id)
);

CREATE TABLE IF NOT EXISTS card_saves (
  card_id  TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  user_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  saved_at INTEGER NOT NULL,
  PRIMARY KEY (card_id, user_id)
);

CREATE TABLE IF NOT EXISTS media (
  id         TEXT PRIMARY KEY,
  owner_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mime       TEXT NOT NULL,
  bytes      BLOB NOT NULL,
  created_at INTEGER NOT NULL
);

-- One row per device that agreed to be notified.
CREATE TABLE IF NOT EXISTS push_subs (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint   TEXT NOT NULL UNIQUE,
  p256dh     TEXT NOT NULL,
  auth       TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS push_subs_by_user ON push_subs(user_id);

-- What has already been sent. Without this the minute-by-minute scan would
-- re-send the same overdue reminder every minute, forever.
CREATE TABLE IF NOT EXISTS push_log (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tag     TEXT NOT NULL,
  sent_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, tag)
);
CREATE INDEX IF NOT EXISTS push_log_by_time ON push_log(sent_at);
`;

export type Database = DatabaseSync;

export function openDatabase(path: string): Database {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(SCHEMA);
  return db;
}

/**
 * node:sqlite hands back null-prototype rows, which trip up anything that
 * expects a plain object (spreading into JSON, deep-equal in tests).
 */
export function plain<T>(row: unknown): T | null {
  return row ? ({ ...(row as object) } as T) : null;
}

export function plainAll<T>(rows: unknown[]): T[] {
  return rows.map((row) => ({ ...(row as object) }) as T);
}
