-- Schema for the rich shared dive log.
-- Running `npm run db:init` against an existing DB will recreate these tables;
-- data in the old `dives(date,location,depth_m,...)` shape will not migrate.
DROP TABLE IF EXISTS dives;
DROP TABLE IF EXISTS divers;

CREATE TABLE divers (
  id               TEXT PRIMARY KEY,            -- client-generated, stable across devices
  name             TEXT NOT NULL,
  color            TEXT,
  birthday         TEXT,
  cert_agency      TEXT,                        -- PADI, SDI, NAUI, SSI, etc.
  cert_level       TEXT,                        -- Open Water, AOW, Rescue, etc.
  cert_number      TEXT,
  cert_issue_date  TEXT,
  specialties      TEXT,                        -- JSON array
  avatar_key       TEXT,                        -- R2 key for profile photo
  created_at       TEXT DEFAULT (datetime('now'))
);

CREATE TABLE dives (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  diver_id       TEXT,
  site           TEXT,
  location       TEXT,
  dive_num       INTEGER,
  date           TEXT NOT NULL,
  surface_int    TEXT,
  time_in        TEXT,
  time_out       TEXT,
  lat            REAL,
  lng            REAL,
  max_depth_ft   REAL,
  avg_depth_ft   REAL,
  water_temp_f   REAL,
  viz_ft         REAL,
  start_psi      INTEGER,
  end_psi        INTEGER,
  tank_size      TEXT,
  tank_pressure  INTEGER,
  tank_mat       TEXT,
  gas            TEXT,
  weight_lbs     REAL,
  suit           TEXT,
  conditions     TEXT,                     -- JSON array
  site_tags      TEXT,                     -- JSON array
  critters       TEXT,                     -- JSON array
  buddies        TEXT,                     -- JSON array of diver ids
  photos         TEXT,                     -- JSON array of R2 keys
  notes          TEXT,
  created_at     TEXT DEFAULT (datetime('now')),
  updated_at     TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_dives_date  ON dives(date DESC);
CREATE INDEX idx_dives_diver ON dives(diver_id);
