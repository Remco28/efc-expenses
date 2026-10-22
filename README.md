# EFC Trip Expenses

A small web app our fencing club's parents use to track and split shared costs on travel tournaments: team meals, the coach's travel and stay, and ground transport. Whoever pays adds the expense, optionally with a photo or PDF of the receipt, which Claude reads to fill in the form. Settling goes through one volunteer treasurer. A trip has no treasurer until someone signs up, and the app nudges the group until one does. When the trip is finalized, every family that owes pays the treasurer, and the treasurer pays every family that's owed: one payment per family. The treasurer has a checklist screen to tick off money in and money out. Anyone can download a PDF record: a summary page followed by every receipt.

Coaching fees are not tracked here, because the coach bills those directly. Personal costs, such as your own flight or room, are not tracked either.

## How costs are split

Each shared cost is split according to **what it was for**, and only among **the people it was for**. Every expense has a split basis. The category suggests one, and whoever enters the expense can change it.

| Split | One share per… | Default for |
|---|---|---|
| Per person | each person there that day: fencer, parent or sibling | Team meals |
| Per fencer | each fencer at the tournament | The coach getting there and back (airfare, bags); team supplies |
| Per fencer-day | each day each fencer competes | The coach's stay (hotel, meals, rental car) |
| Per family | each family that used it | Ground transport (van, gas, parking); other |
| Custom | shares typed in by hand | — |

Coach costs come in two kinds. Getting the coach there costs the same whether your fencer competes one day or ten, so it is split equally per fencer. Keeping the coach there grows with every extra day, so it is split by the days each kid actually fences.

For a per-person or per-family split, the families that were there on that day are included automatically. Anyone can untick a family or change a head count.

Shares are computed to the cent, and they always add up to the expense total. The math lives in [`public/split.js`](public/split.js) and is covered by `npm test`.

## How it's built

- **Cloudflare Workers** on the free plan: one Worker serves the static app in `public/` and a small JSON API in `src/index.ts`.
- **D1** (SQLite) holds trips, families, people, expenses, payments and an activity log. The schema is in `migrations/`.
- **R2** stores the receipt files.
- **Claude** (`claude-haiku-5-5`) reads uploaded receipts. It only pre-fills the form, and a person checks it before saving.
- **Access** is one shared code for the whole group. Each person also types their name, which is remembered on their device and recorded on every change.

The free plan allows 10 ms of CPU time per request. To stay under it, the browser does the heavy work: it shrinks photos before uploading, and it builds the PDF using [pdf-lib](https://pdf-lib.js.org/).

## Running locally

```bash
npm install
cp .dev.vars.example .dev.vars        # set ACCESS_CODE; ANTHROPIC_API_KEY is optional locally
npm run db:migrate:local
npm run dev                           # http://localhost:8787
npm test
```

## Deploying (first time)

```bash
npx wrangler login
npx wrangler d1 create efc-expenses          # paste the database_id into wrangler.jsonc
npx wrangler r2 bucket create efc-expenses-receipts
npx wrangler secret put ACCESS_CODE
npx wrangler secret put ANTHROPIC_API_KEY
npm run db:migrate
npm run deploy
```

`wrangler.jsonc` routes the Worker to `efcexpenses.teamremco.org`. That domain's DNS zone is on Cloudflare, so the deploy step creates the custom domain itself.

## Changing the Claude model

The model that reads receipts is set in one place, `wrangler.jsonc`:

```jsonc
"vars": { "RECEIPT_MODEL": "claude-haiku-5-5" }
```

A model name like `claude-haiku-5-5` always means that exact model. It doesn't silently upgrade, so the app keeps behaving the same until you change it. To switch, edit that line, run `npm run deploy`, and test by uploading a receipt. Make the change in `wrangler.jsonc`, not the Cloudflare dashboard, because the next deploy overwrites dashboard values.

Anthropic retires old models with advance notice, sent by email to the API account and posted at https://platform.claude.com/docs/en/about-claude/model-deprecations. If a model is retired before you switch, receipt reading stops and the app asks people to enter expenses by hand. Nothing else breaks.

To change the access code, run `wrangler secret put ACCESS_CODE` again. Everyone who signed in with the old code is signed out.
