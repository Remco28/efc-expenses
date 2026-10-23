-- Expenses get a revision number: an editor names the one it opened, so it can't
-- save over a newer correction made on another phone.
ALTER TABLE expenses ADD COLUMN rev INTEGER NOT NULL DEFAULT 0;

-- Families and people get a random tag. Their numeric ids can be reused after a
-- delete, so a screen names the record it showed by its tag as well.
ALTER TABLE families ADD COLUMN uid TEXT;
ALTER TABLE people ADD COLUMN uid TEXT;
UPDATE families SET uid = lower(hex(randomblob(8))) WHERE uid IS NULL;
UPDATE people SET uid = lower(hex(randomblob(8))) WHERE uid IS NULL;
CREATE TRIGGER families_uid AFTER INSERT ON families WHEN NEW.uid IS NULL
BEGIN UPDATE families SET uid = lower(hex(randomblob(8))) WHERE id = NEW.id; END;
CREATE TRIGGER people_uid AFTER INSERT ON people WHEN NEW.uid IS NULL
BEGIN UPDATE people SET uid = lower(hex(randomblob(8))) WHERE id = NEW.id; END;
