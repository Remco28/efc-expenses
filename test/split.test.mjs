import { test } from "node:test";
import assert from "node:assert/strict";
import { familySize, shares, balances, treasurerPlan, tournamentDays, unsplit, CATEGORIES, BASES } from "../public/split.js";

const days = tournamentDays("2026-07-01", "2026-07-10");
const fam = (id, name, people) => ({ id, name, people });
const p = (name, is_fencer, fd = []) => ({ name, is_fencer, fencing_days: fd });

// The 10-day example: three 2-day fencers and one 10-day fencer. A has a parent too.
const ten = [
  fam(1, "A", [p("a", true, days.slice(0, 2)), p("pa", false)]),
  fam(2, "B", [p("b", true, days.slice(2, 4))]),
  fam(3, "C", [p("c", true, days.slice(4, 6))]),
  fam(4, "D", [p("d", true, days)]),
];

test("tournamentDays covers start to end inclusive", () => {
  assert.equal(days.length, 10);
  assert.equal(days[0], "2026-07-01");
  assert.equal(days[9], "2026-07-10");
});

test("every kind of expense has one of the three splits", () => {
  for (const c of Object.values(CATEGORIES)) assert.ok(c.basis in BASES);
  assert.deepEqual(Object.keys(BASES), ["took_part", "per_fencer", "fencer_day"]);
});

test("coach travel splits equally per fencer, the coach's hotel by fencing days", () => {
  const flight = { amount_cents: 50000, basis: "per_fencer", split: {} };
  const hotel = { amount_cents: 200000, basis: "fencer_day", split: {} };
  assert.deepEqual(shares(flight, ten).shares, { 1: 12500, 2: 12500, 3: 12500, 4: 12500 });
  assert.deepEqual(shares(hotel, ten).shares, { 1: 25000, 2: 25000, 3: 25000, 4: 125000 });
});

test("the design's example: five fence day 1, one of them day 2 too, is 6 shares", () => {
  const d2 = tournamentDays("2026-08-01", "2026-08-02");
  const five = [1, 2, 3, 4, 5].map(i => fam(i, "F" + i, [p("k" + i, true, i === 1 ? d2 : [d2[0]])]));
  const s = shares({ amount_cents: 20000, basis: "fencer_day", split: {} }, five);
  assert.equal(s.total, 6);
  assert.equal(s.shares[1], 6667);
});

test("who took part counts only the families ticked, by their head counts", () => {
  const dinner = { amount_cents: 9000, basis: "took_part", split: { 1: 2, 4: 1 } };
  assert.deepEqual(shares(dinner, ten).shares, { 1: 6000, 4: 3000 });
  assert.equal(familySize(ten[0]), 2);
});

test("a head count can be above the family's size (a visiting grandparent)", () => {
  const dinner = { amount_cents: 6000, basis: "took_part", split: { 2: 3, 4: 1 } };
  assert.deepEqual(shares(dinner, ten).shares, { 2: 4500, 4: 1500 });
});

test("nobody ticked splits to nobody, and is flagged", () => {
  const e = { id: 1, amount_cents: 1000, basis: "took_part", split: {} };
  assert.equal(shares(e, ten).total, 0);
  assert.equal(unsplit([e], ten).length, 1);
});

test("shares always add up to the amount, to the cent", () => {
  for (const amt of [1, 2, 100, 18700, 99999, 1234567]) {
    for (const [basis, split] of [["took_part", { 1: 2, 2: 1, 3: 3 }], ["per_fencer", {}], ["fencer_day", {}]]) {
      const s = Object.values(shares({ amount_cents: amt, basis, split }, ten).shares).reduce((a, b) => a + b, 0);
      assert.equal(s, amt, `${basis} ${amt}`);
    }
  }
});

const sample = [
  { id: 1, amount_cents: 26400, basis: "took_part", paid_by: 1, split: { 1: 2, 4: 1 } },
  { id: 2, amount_cents: 38600, basis: "per_fencer", paid_by: 4, split: {} },
  { id: 3, amount_cents: 41200, basis: "fencer_day", paid_by: 2, split: {} },
  { id: 4, amount_cents: 3600, basis: "took_part", paid_by: 3, split: { 2: 1, 3: 1 } },
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

test("a fencer with no fencing days pays coach travel but nothing toward the hotel", () => {
  const fams = structuredClone(ten);
  fams[1].people[0].fencing_days = [];
  assert.ok("2" in shares({ amount_cents: 1000, basis: "per_fencer", split: {} }, fams).shares);
  assert.ok(!("2" in shares({ amount_cents: 1000, basis: "fencer_day", split: {} }, fams).shares));
});

test("fixing a fencer's days later flows into the coach's costs", () => {
  const fams = structuredClone(ten);
  const hotel = { amount_cents: 10000, basis: "fencer_day", split: {} };
  const before = shares(hotel, fams).shares[2];
  fams[1].people[0].fencing_days.push(days[4]);
  assert.ok(shares(hotel, fams).shares[2] > before);
});

test("staff never share, but are paid back through the treasurer", () => {
  const withCoach = [...ten, { id: 9, name: "Mike", kind: "staff", role: "Coach", people: [] }];
  const hotel = { id: 1, amount_cents: 90000, basis: "fencer_day", paid_by: 9, split: {} };
  const dinner = { id: 2, amount_cents: 1000, basis: "took_part", paid_by: 1, split: { 1: 1, 9: 5 } };
  const { rows } = balances([hotel, dinner], withCoach);
  assert.equal(rows[9].owed, 0);
  assert.equal(rows[9].net, 90000);
  const plan = treasurerPlan(rows, 1);
  assert.ok(plan.some(x => x.family_id === 9 && x.direction === "out" && x.amount_cents === 90000));
  assert.equal(Object.values(rows).reduce((s, r) => s + r.net, 0), 0);
});

test("an expense nobody shares doesn't credit the payer, so balances still net to zero", () => {
  const e = { id: 1, amount_cents: 4000, basis: "took_part", paid_by: 2, split: { 1: 0, 4: 0 } };
  const { rows } = balances([e], ten);
  assert.equal(rows[2].paid, 0);
  assert.equal(Object.values(rows).reduce((s, r) => s + r.net, 0), 0);
});

test("absurd head counts don't produce NaN", () => {
  const e = { amount_cents: 100, basis: "took_part", split: { 1: 1e308, 2: 1e308 } };
  assert.ok(Object.values(shares(e, ten).shares).every(Number.isFinite));
});
