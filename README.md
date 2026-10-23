# EFC Trip Expenses

A small web app our fencing club's parents use to track and split shared costs on travel tournaments: team meals and outings, and the coach's travel, hotel, getting around and own meals. Whoever pays adds the expense, optionally with a photo or PDF of the receipt, which Claude reads to fill in the form. Settling goes through one volunteer treasurer. A trip has no treasurer until someone signs up, and the app nudges the group until one does. When the trip is finalized, every family that owes pays the treasurer, and the treasurer pays every family that's owed: one payment per family. The treasurer has a checklist screen to tick off money in and money out. Anyone can download a PDF record: a summary page followed by every receipt.

Coaching fees are not tracked here, because the coach bills those directly. Personal costs, such as your own flight, room, parking or gas, are not tracked either, and neither are team supplies (the coach's responsibility) or snacks a parent buys for the team.

## How costs are split

Families and their people are on the trip as a whole; nobody records which days a family is there. The one per-day fact is **which days each fencer actually competes**, ticked on the family's screen or on the trip's Fencing days screen. Anyone can fix them until the trip is finalized.

Each kind of expense has its split:

| Kind | Split | One share per… |
|---|---|---|
| Team meal or outing | Who took part | each person counted: the person entering it ticks the families who went, each with a head count that starts at the family's size and can be changed |
| Coach's own meals (breakfast, coffee, lunch at the venue) | By fencing days | each day each fencer competes |
| Coach travel there and back (airfare, bags) | Equal per fencer | each fencer on the trip |
| Coach hotel and getting around (hotel, rental car, gas, rides, parking) | By fencing days | each day each fencer competes |
| Other | The person entering it picks one of the three | |

Team meals are opt-in: nobody is included until someone ticks who took part, because families often eat on their own or in separate groups. When the coach comes along, the coach is never ticked; the families who went cover the coach's share. Coaches and staff never pay a share of anything.

Getting the coach there costs the same whether your fencer competes one day or ten, so it is split equally per fencer. Keeping the coach there grows with every extra day, so it is split by the days each kid actually fences. A fencer with no fencing days ticked still pays their share of the coach's travel and nothing toward the rest; the app warns about it.

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
