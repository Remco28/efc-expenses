-- Deleting a trip hides it for 30 days (restorable) before it's removed for good.
ALTER TABLE tournaments ADD COLUMN deleted_at TEXT;
ALTER TABLE tournaments ADD COLUMN deleted_by TEXT;
