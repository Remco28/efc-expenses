# Reviews and designs: what's where

## Where things stand (2026-10-23)

- The app splits costs by the club's rules in [`design/billing-model.md`](design/billing-model.md): team meals and outings by who took part (ticked, with head counts), the coach's travel equally per fencer, the coach's hotel, getting around and own meals by fencing days. There are no attendance days.
- New expenses saved without a signal wait on the phone and send themselves ([`design/saving-design-v4.md`](design/saving-design-v4.md), with the changes noted at its top).
- Eleven code-review rounds, each recorded in [`code/README.md`](code/README.md). Round 11 had two HIGH findings, both fixed; by the stop rule a round 12 follows. Nothing known is open above LOW except the accepted limits in the design documents.
- The live site was cleared of test trips on 2026-10-23; only the practice trip remains.

## Folders

- `loop/`: the first review loop, on the app as a parent sees it (readers in a browser, no code). `LEDGER.md` and the predictions per round.
- `code/`: the code review. `README.md` is the record, round by round: each finding with the reviewer's rating beside ours, what was done, the disposition audits and our responses, predictions against outcomes. `round*/` holds each reader's report. `PREDICTIONS-R*.md` were written and committed before each round ran. `briefs/` holds the briefs as sent and the API check scripts (see its README). `codex.md`, `grok.md`, `agy.md` are the outside reviewers' reports from round 1.
- `design/`: designs, each checked by fresh pairs of critic agents before it was built; the critics' reports sit beside each version.

## Design documents: current and history

| Document | Status |
|---|---|
| `billing-model.md` | **Current.** How costs are split, agreed with Frank. The authority for the split |
| `billing-build-plan.md` | Built, with one change: a new fencer starts with no fencing days (Frank, round 11), not every day |
| `saving-design-v4.md` | **Current**, with changes: every new expense can wait on the phone, ticked meals included (they name families by their tags); refused ones can be opened to fix |
| `saving-design-v1.md` to `v3.md`, `saving-author-draft.md`, `saving-peer-design-*.md` | History: the passes that led to v4 |
| `../code/round10/fencing-problem.md` | History: the rest-days fix, replaced the same day when attendance days were removed |
