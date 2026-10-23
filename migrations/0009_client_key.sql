-- A new expense carries a key made by the phone that adds it, so a save retried
-- after a lost reply finds the expense it already made instead of adding it twice.
ALTER TABLE expenses ADD COLUMN client_key TEXT;
CREATE UNIQUE INDEX expenses_client_key ON expenses(client_key) WHERE client_key IS NOT NULL;
