-- One-off, run by hand (2026-10-23): the live trips were test data from before the
-- opt-in split (review/design/billing-model.md), so they are cleared rather than
-- converted. The practice trip stays, emptied; "Reset practice trip" re-seeds it.
-- Receipt files of the cleared trips stay in R2 (a few test photos).
DELETE FROM payments;
DELETE FROM expenses;
DELETE FROM people;
DELETE FROM families;
DELETE FROM activity WHERE tournament_id IN (SELECT id FROM tournaments WHERE is_sandbox = 0);
DELETE FROM tournaments WHERE is_sandbox = 0;
