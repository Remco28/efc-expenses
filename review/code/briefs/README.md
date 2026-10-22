# Review briefs and API check scripts

- `codex.txt`, `grok.txt`, `agy.txt`, `opencode.txt`: the round-4 briefs, ready to run. Focuses rotate each round so every area gets fresh eyes. Commands are in `office tools`; wrap each one in `timeout 1500`, since Grok stalled in round 3.
- `*.mjs`: API checks against a local copy. Set up the copy with `npx wrangler d1 migrations apply efc-expenses --local --persist-to <dir>`, then seed practice trip id 50 (`INSERT INTO tournaments (id, name, start_date, end_date, created_at, is_sandbox) VALUES (50, 'Practice', '2027-03-13', '2027-03-14', '2026-10-22', 1)`). Run `npx wrangler dev --port 8817 --ip 127.0.0.1 --persist-to <dir>` with `.dev.vars` `ACCESS_CODE=fence-local-test`, then `node <script>`. Every line should print PASS.
