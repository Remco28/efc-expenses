-- Superseded the same day by the opt-in split (review/design/billing-model.md):
-- fencing_days is read and written again, and rest_days is no longer used.
-- A person stores the days they're there but not fencing, instead of the days they
-- fence, so a day taken off and put back comes back as it was. Fencing days are
-- worked out as days minus rest days. fencing_days is no longer read or written.
ALTER TABLE people ADD COLUMN rest_days TEXT NOT NULL DEFAULT '[]';
UPDATE people SET rest_days = (SELECT json_group_array(value) FROM (SELECT d.value FROM json_each(people.days) d
  WHERE d.value NOT IN (SELECT value FROM json_each(people.fencing_days)) ORDER BY d.value))
  WHERE is_fencer = 1 OR fencing_days != '[]';
