import test from "node:test";
import assert from "node:assert/strict";
import { freshCodex, BEASTS } from "./codex.ts";
import { MARKS, markBonuses, markRank, markVs, marksView, BEAST_KINDS, UNDEAD_KINDS, MEN_KINDS, TOY_KINDS } from "./marks.ts";

test("a fresh character carries no marks", () => {
  const b = markBonuses({ c: freshCodex(), deaths: 0 });
  assert.ok(Object.values(b).every((v) => v === 0));
  assert.ok(marksView({ c: freshCodex(), deaths: 0 }).every((m) => m.rank === 0 && m.boon === ""));
});

test("a codex saved before marks existed still loads", () => {
  const old = { ...freshCodex(), ...JSON.parse('{"k":{"wolf":25},"s":[],"z":["over"],"crafts":2,"parries":9,"d":[],"t":[]}') };
  const b = markBonuses({ c: old, deaths: 4 });
  assert.equal(b.vsBeast, 0.08);
  assert.equal(b.parry, 0.03);
  assert.equal(b.guard, 0.03);
  assert.equal(b.roll, 0);
});

test("ranks rise at each threshold and thresholds ascend", () => {
  for (const m of MARKS) {
    assert.ok(m.at[0] < m.at[1] && m.at[1] < m.at[2], m.id);
    assert.ok(m.give[0] < m.give[1] && m.give[1] < m.give[2], m.id);
    assert.equal(markRank(m, m.at[0] - 1), 0);
    assert.equal(markRank(m, m.at[0]), 1);
    assert.equal(markRank(m, m.at[1]), 2);
    assert.equal(markRank(m, m.at[2] + 999), 3);
  }
});

test("kill marks only help against their own kind", () => {
  const c = freshCodex();
  c.k.skeleton = 80;
  const b = markBonuses({ c, deaths: 0 });
  assert.equal(markVs(b, "zombie"), 0.14);
  assert.equal(markVs(b, "boss_grave_king"), 0.14);
  assert.equal(markVs(b, "wolf"), 0);
});

test("every bestiary creature belongs to exactly one kill mark", () => {
  const all = [...BEAST_KINDS, ...UNDEAD_KINDS, ...MEN_KINDS, ...TOY_KINDS];
  assert.equal(new Set(all).size, all.length);
  for (const k of Object.keys(BEASTS)) assert.ok(all.includes(k), k);
});
