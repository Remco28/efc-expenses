import { test } from "node:test";
import assert from "node:assert/strict";
import { autoUnits, defaultSplit, shares, balances, settle, tournamentDays } from "../public/split.js";

const days = tournamentDays("2026-07-01", "2026-07-10");
const fam = (id, name, people) => ({ id, name, people });
const p = (name, is_fencer, d, fd = []) => ({ name, is_fencer, days: d, fencing_days: fd });

// The 10-day example: three 2-day fencers and one 10-day fencer.
const ten = [
  fam(1, "A", [p("a", true, days.slice(0, 2), days.slice(0, 2)), p("pa", false, days.slice(0, 2))]),
  fam(2, "B", [p("b", true, days.slice(2, 4), days.slice(2, 4))]),
  fam(3, "C", [p("c", true, days.slice(4, 6), days.slice(4, 6))]),
  fam(4, "D", [p("d", true, days, days)]),
];

test("tournamentDays covers start to end inclusive", () => {
  assert.equal(days.length, 10);
  assert.equal(days[0], "2026-07-01");
  assert.equal(days[9], "2026-07-10");
});

test("coach travel splits equally per fencer, coach stay by fencer-days", () => {
  const flight = { amount_cents: 50000, basis: "fencer", date: null, split: defaultSplit("fencer", ten, null) };
  const hotel = { amount_cents: 200000, basis: "fencer_day", date: null, split: defaultSplit("fencer_day", ten, null) };
  assert.deepEqual(shares(flight, ten).shares, { 1: 12500, 2: 12500, 3: 12500, 4: 12500 });
  assert.deepEqual(shares(hotel, ten).shares, { 1: 25000, 2: 25000, 3: 25000, 4: 125000 });
});

test("per person only counts people there that day", () => {
  assert.equal(autoUnits("person", ten[0], days[0]), 2);
  assert.equal(autoUnits("person", ten[1], days[0]), 0);
  const lunch = { amount_cents: 6000, basis: "person", date: days[0], split: defaultSplit("person", ten, days[0]) };
  assert.deepEqual(Object.keys(lunch.split).sort(), ["1", "4"]);
  assert.deepEqual(shares(lunch, ten).shares, { 1: 4000, 4: 2000 });
});

test("a hand-set head count overrides the automatic one", () => {
  const lunch = { amount_cents: 9000, basis: "person", date: days[0], split: { 1: 1, 4: null } };
  assert.deepEqual(shares(lunch, ten).shares, { 1: 4500, 4: 4500 });
});

test("shares always add up to the amount, to the cent", () => {
  for (const amt of [1, 2, 100, 18700, 99999, 1234567]) {
    for (const basis of ["person", "fencer", "fencer_day", "family"]) {
      const e = { amount_cents: amt, basis, date: null, split: defaultSplit(basis, ten, null) };
      const s = Object.values(shares(e, ten).shares).reduce((a, b) => a + b, 0);
      assert.equal(s, amt, `${basis} ${amt}`);
    }
  }
});

test("balances net to zero and settle-up clears every balance", () => {
  const expenses = [
    { id: 1, amount_cents: 26400, basis: "person", date: days[0], paid_by: 1, split: defaultSplit("person", ten, days[0]) },
    { id: 2, amount_cents: 38600, basis: "fencer", date: null, paid_by: 4, split: defaultSplit("fencer", ten, null) },
    { id: 3, amount_cents: 41200, basis: "fencer_day", date: null, paid_by: 2, split: defaultSplit("fencer_day", ten, null) },
    { id: 4, amount_cents: 3600, basis: "family", date: null, paid_by: 3, split: defaultSplit("family", ten, null) },
  ];
  const { rows } = balances(expenses, ten);
  assert.equal(Object.values(rows).reduce((s, r) => s + r.net, 0), 0);
  const xs = settle(rows);
  assert.ok(xs.length <= ten.length - 1);
  const left = Object.fromEntries(Object.entries(rows).map(([id, r]) => [id, r.net]));
  for (const x of xs) { left[x.from_family] += x.amount_cents; left[x.to_family] -= x.amount_cents; }
  assert.ok(Object.values(left).every(v => v === 0));
});

test("an expense with everyone unticked splits to nobody", () => {
  const e = { amount_cents: 1000, basis: "family", date: null, split: {} };
  assert.equal(shares(e, ten).total, 0);
});
