-- Coaches and staff travel with the team, can pay for things and be paid back
-- through the treasurer, but never share costs. They live in families with
-- kind = 'staff' so paying, payments and the treasurer's checklist just work.
ALTER TABLE families ADD COLUMN kind TEXT NOT NULL DEFAULT 'family';
ALTER TABLE families ADD COLUMN role TEXT NOT NULL DEFAULT '';
