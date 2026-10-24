# Review briefs and API check scripts

## Briefs

- `r9-*.txt`, `r10-*.txt`, `r11-*.txt`: the briefs for rounds 9 to 11, one per reader, sent as written. Each reader gets its own copy of the repository (a git worktree at the reviewed commit, `node_modules` linked, `.dev.vars` holding only `ACCESS_CODE=fence-local-test`) and its own ports. `whole-*`: the whole code, no focus. `fixaudit`: the diff since the last reviewed commit. `field`: a parent on a bad signal. `rules` (from round 11): the app against `review/design/billing-model.md`. `disposition`: our own ratings, after triage, before any decision to stop.
- `codex.txt`, `grok.txt`, `agy.txt`, `opencode.txt`, `run.sh`: the outside-CLI briefs of rounds 3 to 7, kept for the record. Those runs needed approvals switched off, which this environment now blocks; rounds 8 on use Claude subagents.

## API check scripts

Each `*.mjs` drives the API of a local copy and prints PASS or FAIL per check; every line should print PASS.

1. A database: `npx wrangler d1 migrations apply efc-expenses --local --persist-to <db>`.
2. The practice trip as trip 50 (staff50, round2 and round10 use it): `npx wrangler d1 execute efc-expenses --local --persist-to <db> --command "INSERT INTO tournaments (id, name, start_date, end_date, created_at, created_by, is_sandbox) VALUES (50, 'Practice trip', '2028-03-06', '2028-03-08', '2026-10-01', 'seed', 1)"`.
3. `.dev.vars` with `ACCESS_CODE=fence-local-test`, then `npx wrangler dev --port 8817 --ip 127.0.0.1 --persist-to <db>` in the background.
4. `node regress.mjs` (and staff50, round2, round3, round4, revisions, round8, round9, round10).
5. Stop the server by killing the `wrangler dev --port 8817` process itself; `fuser -k` on the port only stops its child, which wrangler restarts.

`round10.mjs` holds the checks for the current rules: the three splits, fencing days, the waiting list's server side, finalize's fingerprint. The older scripts were written for earlier rules and still guard what they were for (revisions, tags, retry keys, two phones at once, finalize, payments).

`stamp.mjs`: every script's request helper goes through it. It fills in what the app sends with a change (a family's or person's tag, an expense's revision, the dates a trip form was opened with), so the scripts behave like a fresh screen; a test that passes its own values plays a stale one. It also translates expenses written for the old splits (per person, per family, custom) into the current ones (who took part, with every family ticked once), so the old scripts keep testing their concurrency and retry checks. A check of the split rules themselves belongs in `round10.mjs`, which sends the current shapes directly.
