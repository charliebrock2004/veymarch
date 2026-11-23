import assert from "node:assert/strict";
import test from "node:test";
import { TALENTS, cleanTalents, learnTalent, talentFree, talentMods, talentPoints } from "./talents.ts";
import { BOUNTIES, FINDS, pickBounties } from "./explore.ts";
import { ITEMS } from "./items.ts";
import { ZONES } from "./zones.ts";

test("one talent point per level after the first", () => {
  assert.equal(talentPoints(1), 0);
  assert.equal(talentPoints(25), 24);
  assert.ok(TALENTS.reduce((n, t) => n + t.max, 0) > talentPoints(25), "more ranks than points");
});

test("learning spends a point and stops at the cap", () => {
  let t = learnTalent({}, "edge", 1);
  assert.deepEqual(t, {});
  t = learnTalent({}, "edge", 5);
  t = learnTalent(t, "edge", 5);
  t = learnTalent(t, "edge", 5);
  assert.equal(t.edge, 3);
  assert.equal(talentFree(5, t), 1);
  assert.equal(learnTalent(t, "edge", 5), t);
  assert.equal(learnTalent(t, "nope", 5), t);
  assert.ok(Math.abs(talentMods(t).dmg - 1.15) < 1e-9);
});

test("a stale or tampered book is cut down to the level's points", () => {
  const t = cleanTalents({ edge: 9, eye: 3, hardy: 3, bogus: 4 }, 5);
  assert.deepEqual(t, { edge: 3, eye: 1 });
});

test("finds sit inside their zones and pay in real items", () => {
  const ids = new Set<string>();
  for (const f of FINDS) {
    assert.ok(!ids.has(f.id), f.id);
    ids.add(f.id);
    const b = ZONES[f.zone].bounds;
    assert.ok(f.x > b.minX + 5 && f.x < b.maxX - 5 && f.z > b.minZ + 5 && f.z < b.maxZ - 5, f.id);
    assert.equal(f.id.startsWith("c_"), f.kind === "cache");
    for (const [id] of f.loot ?? []) assert.ok(ITEMS[id], id);
  }
});

test("three bounties a day, stable for the day, never far above the player", () => {
  const a = pickBounties("2026-1-1", 1);
  assert.equal(a.length, 3);
  assert.deepEqual(a, pickBounties("2026-1-1", 1));
  assert.equal(new Set(a).size, 3);
  for (const id of a) assert.ok(BOUNTIES.find((b) => b.id === id)!.level <= 3);
  for (const b of BOUNTIES) if (b.item) assert.ok(ITEMS[b.item[0]], b.item[0]);
});
