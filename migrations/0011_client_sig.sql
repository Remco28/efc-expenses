-- What a new person, family or trip looked like when the phone that added it sent it.
-- A retry of that add with corrected details (a typo fixed after a lost reply) is
-- applied to it only while it still looks exactly like that: nobody has touched it since.
ALTER TABLE people ADD COLUMN client_sig TEXT;
ALTER TABLE families ADD COLUMN client_sig TEXT;
ALTER TABLE tournaments ADD COLUMN client_sig TEXT;
