-- Settling goes through one treasurer: families who owe pay the treasurer,
-- the treasurer pays families who are owed. The treasurer may not be on the
-- trip at all, so their family link is optional.
ALTER TABLE tournaments ADD COLUMN treasurer_name TEXT;
ALTER TABLE tournaments ADD COLUMN treasurer_family_id INTEGER REFERENCES families(id) ON DELETE SET NULL;
ALTER TABLE tournaments ADD COLUMN treasurer_notes TEXT NOT NULL DEFAULT '';
ALTER TABLE families ADD COLUMN pay_notes TEXT NOT NULL DEFAULT '';

-- direction 'in': family pays the treasurer; 'out': treasurer pays family.
CREATE TABLE payments (
  id INTEGER PRIMARY KEY,
  tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  family_id INTEGER NOT NULL REFERENCES families(id),
  direction TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  paid_at TEXT,
  paid_marked_by TEXT
);
CREATE INDEX payments_tournament ON payments(tournament_id);

-- Payments between families no longer exist; anything finalized under the
-- old scheme is reopened so it can be finalized again with a treasurer.
DROP TABLE transfers;
UPDATE tournaments SET status = 'open', finalized_at = NULL, finalized_by = NULL WHERE status = 'final';
