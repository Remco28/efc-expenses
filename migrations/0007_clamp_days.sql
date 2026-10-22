-- Trips shortened before dates were pruned on save can still carry days outside
-- their dates. Drop them once, everywhere (families, people, fencing days).
UPDATE families SET days = (
  SELECT COALESCE(json_group_array(j.value), '[]') FROM json_each(families.days) j, tournaments t
  WHERE t.id = families.tournament_id AND j.value BETWEEN t.start_date AND t.end_date);
UPDATE people SET days = (
  SELECT COALESCE(json_group_array(j.value), '[]') FROM json_each(people.days) j, families f, tournaments t
  WHERE f.id = people.family_id AND t.id = f.tournament_id AND j.value BETWEEN t.start_date AND t.end_date);
UPDATE people SET fencing_days = (
  SELECT COALESCE(json_group_array(j.value), '[]') FROM json_each(people.fencing_days) j, families f, tournaments t
  WHERE f.id = people.family_id AND t.id = f.tournament_id AND j.value BETWEEN t.start_date AND t.end_date);
