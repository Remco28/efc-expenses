import { test } from "node:test";
import assert from "node:assert/strict";
import { autoUnits, defaultSplit, shares, balances, treasurerPlan, tournamentDays } from "../public/split.js";

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
  const lunch = { amount_cents: 6000, basis: "person", date: days[0], split: defaultSplit("person", ten) };
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

const sample = [
  { id: 1, amount_cents: 26400, basis: "person", date: days[0], paid_by: 1, split: defaultSplit("person", ten, days[0]) },
  { id: 2, amount_cents: 38600, basis: "fencer", date: null, paid_by: 4, split: defaultSplit("fencer", ten, null) },
  { id: 3, amount_cents: 41200, basis: "fencer_day", date: null, paid_by: 2, split: defaultSplit("fencer_day", ten, null) },
  { id: 4, amount_cents: 3600, basis: "family", date: null, paid_by: 3, split: defaultSplit("family", ten, null) },
];

test("balances net to zero", () => {
  const { rows } = balances(sample, ten);
  assert.equal(Object.values(rows).reduce((s, r) => s + r.net, 0), 0);
});

test("a treasurer from outside the trip ends with an empty pot", () => {
  const { rows } = balances(sample, ten);
  const plan = treasurerPlan(rows, null);
  const pot = plan.reduce((s, x) => s + (x.direction === "in" ? x.amount_cents : -x.amount_cents), 0);
  assert.equal(pot, 0);
  assert.equal(plan.length, Object.values(rows).filter(r => r.net !== 0).length);
});

test("a treasurer on the trip ends with exactly their own balance", () => {
  const { rows } = balances(sample, ten);
  for (const f of ten) {
    const plan = treasurerPlan(rows, f.id);
    assert.ok(plan.every(x => x.family_id !== f.id));
    const pot = plan.reduce((s, x) => s + (x.direction === "in" ? x.amount_cents : -x.amount_cents), 0);
    assert.equal(pot, rows[f.id].net, `treasurer ${f.name}`);
  }
});

test("an expense with everyone unticked splits to nobody", () => {
  const e = { amount_cents: 1000, basis: "family", date: null, split: {} };
  assert.equal(shares(e, ten).total, 0);
});

test("a family added later is counted automatically, by who was there", () => {
  const e = { amount_cents: 6000, basis: "person", date: days[0], split: defaultSplit("person", ten) };
  const late = [...ten, fam(5, "E", [p("e", true, [days[0]], [days[0]])])];
  // the server adds the new family to existing splits as automatic (null)
  e.split[5] = null;
  assert.deepEqual(shares(e, late).shares, { 1: 3000, 4: 1500, 5: 1500 });
});

test("unticking a family (0) sticks even when they were there", () => {
  const e = { amount_cents: 6000, basis: "person", date: days[0], split: { ...defaultSplit("person", ten), 1: 0 } };
  assert.deepEqual(shares(e, ten).shares, { 4: 6000 });
});

test("fixing someone's days later flows into the split", () => {
  const fams = structuredClone(ten);
  const e = { amount_cents: 6000, basis: "person", date: days[2], split: defaultSplit("person", fams) };
  assert.deepEqual(Object.keys(shares(e, fams).shares).sort(), ["2", "4"]);
  fams[0].people[1].days.push(days[2]);           // A's parent was actually there day 3
  assert.deepEqual(Object.keys(shares(e, fams).shares).sort(), ["1", "2", "4"]);
});

test("staff never share, but are paid back through the treasurer", () => {
  const withCoach = [...ten, { id: 9, name: "Mike", kind: "staff", role: "Coach", people: [] }];
  const hotel = { id: 1, amount_cents: 90000, basis: "fencer_day", date: null, paid_by: 9, split: { ...defaultSplit("fencer_day", withCoach), 9: 5 } };
  const { rows } = balances([hotel], withCoach);
  assert.equal(rows[9].owed, 0);
  assert.equal(rows[9].net, 90000);
  const plan = treasurerPlan(rows, 1);
  assert.ok(plan.some(x => x.family_id === 9 && x.direction === "out" && x.amount_cents === 90000));
  assert.equal(Object.values(rows).reduce((s, r) => s + r.net, 0), 0);
});
