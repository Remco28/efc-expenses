-- One row per travel tournament. status is 'open' or 'final'.
CREATE TABLE tournaments (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  location TEXT NOT NULL DEFAULT '',
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  finalized_at TEXT,
  finalized_by TEXT,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL DEFAULT ''
);

CREATE TABLE families (
  id INTEGER PRIMARY KEY,
  tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  name TEXT NOT NULL
);
CREATE INDEX families_tournament ON families(tournament_id);

-- days and fencing_days are JSON arrays of ISO dates.
CREATE TABLE people (
  id INTEGER PRIMARY KEY,
  family_id INTEGER NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_fencer INTEGER NOT NULL DEFAULT 0,
  days TEXT NOT NULL DEFAULT '[]',
  fencing_days TEXT NOT NULL DEFAULT '[]'
);
CREATE INDEX people_family ON people(family_id);

-- split is a JSON object {family_id: units | null}; null means "work it out
-- from who is on the trip", a number is a hand-set head count or share.
CREATE TABLE expenses (
  id INTEGER PRIMARY KEY,
  tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  vendor TEXT NOT NULL DEFAULT '',
  date TEXT,
  category TEXT NOT NULL,
  basis TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  paid_by INTEGER NOT NULL REFERENCES families(id),
  split TEXT NOT NULL DEFAULT '{}',
  receipt_key TEXT,
  receipt_type TEXT,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL DEFAULT '',
  updated_at TEXT,
  updated_by TEXT
);
CREATE INDEX expenses_tournament ON expenses(tournament_id);

-- Settle-up payments, frozen when a tournament is finalized.
CREATE TABLE transfers (
  id INTEGER PRIMARY KEY,
  tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  from_family INTEGER NOT NULL REFERENCES families(id),
  to_family INTEGER NOT NULL REFERENCES families(id),
  amount_cents INTEGER NOT NULL,
  paid_at TEXT,
  paid_marked_by TEXT
);
CREATE INDEX transfers_tournament ON transfers(tournament_id);

CREATE TABLE activity (
  id INTEGER PRIMARY KEY,
  tournament_id INTEGER REFERENCES tournaments(id) ON DELETE CASCADE,
  at TEXT NOT NULL,
  who TEXT NOT NULL,
  what TEXT NOT NULL
);
CREATE INDEX activity_tournament ON activity(tournament_id);
