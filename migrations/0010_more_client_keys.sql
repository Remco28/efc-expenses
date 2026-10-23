-- Adding a person, a family or a trip carries a key made by the phone too, so a tap
-- retried after a lost reply finds what it already added instead of adding it twice.
ALTER TABLE people ADD COLUMN client_key TEXT;
ALTER TABLE families ADD COLUMN client_key TEXT;
ALTER TABLE tournaments ADD COLUMN client_key TEXT;
CREATE UNIQUE INDEX people_client_key ON people(client_key) WHERE client_key IS NOT NULL;
CREATE UNIQUE INDEX families_client_key ON families(client_key) WHERE client_key IS NOT NULL;
CREATE UNIQUE INDEX tournaments_client_key ON tournaments(client_key) WHERE client_key IS NOT NULL;
