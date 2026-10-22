-- A practice trip parents can break and reset. Only a trip flagged here can
-- be reset, and it can't be deleted.
ALTER TABLE tournaments ADD COLUMN is_sandbox INTEGER NOT NULL DEFAULT 0;
