-- Days are set per family; a person follows their family's days unless they
-- have their own (own_days = 1). people.days stays the source of truth for
-- every split, so the math doesn't change.
ALTER TABLE families ADD COLUMN days TEXT NOT NULL DEFAULT '[]';
ALTER TABLE people ADD COLUMN own_days INTEGER NOT NULL DEFAULT 0;

-- Existing trips: a family's days are the days any member is there.
UPDATE families SET days = COALESCE((
  SELECT json_group_array(value) FROM (
    SELECT DISTINCT j.value AS value FROM people p, json_each(p.days) j WHERE p.family_id = families.id ORDER BY j.value)
), '[]');
-- Anyone who isn't there every one of those days has their own days.
UPDATE people SET own_days = 1
WHERE json_array_length(days) <> (SELECT json_array_length(f.days) FROM families f WHERE f.id = people.family_id);
