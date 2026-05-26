CREATE TABLE IF NOT EXISTS dives (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  date         TEXT NOT NULL,
  location     TEXT NOT NULL,
  depth_m      REAL,
  duration_min INTEGER,
  notes        TEXT,
  photo_key    TEXT,
  created_at   TEXT DEFAULT (datetime('now'))
);
