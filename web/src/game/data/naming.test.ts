import assert from "node:assert/strict";
import test from "node:test";
import { GRAVES, NAMEABLE, canName, graveLabel, laid, namesLeft } from "./naming.ts";
import { FINDS } from "./explore.ts";
import { ZONES } from "./zones.ts";
import { UNDEAD_KINDS } from "./marks.ts";
import { BEASTS } from "./codex.ts";

test("every grave has its own name, sits inside the Wasteland and clear of other finds", () => {
  assert.equal(new Set(GRAVES.map((g) => g.id)).size, GRAVES.length);
  assert.equal(new Set(GRAVES.map((g) => g.name)).size, GRAVES.length);
  const b = ZONES.waste.bounds;
  for (const g of GRAVES) {
    assert.equal(g.zone, "waste");
    assert.ok(g.x > b.minX + 10 && g.x < b.maxX - 10 && g.z > b.minZ + 10 && g.z < b.maxZ - 10, g.id);
    for (const f of FINDS) if (f.zone === "waste") assert.ok(Math.hypot(f.x - g.x, f.z - g.z) > 8, g.id + " near " + f.id);
    assert.ok(!FINDS.some((f) => f.id === g.id));
  }
});

test("only the rank-and-file dead can be named", () => {
  for (const k of NAMEABLE) {
    assert.ok(UNDEAD_KINDS.includes(k), k);
    assert.ok(BEASTS[k], k);
  }
  assert.equal(canName("skeleton"), true);
  assert.equal(canName("grave_confessor"), false);
  assert.equal(canName("boss_grave_king"), false);
  assert.equal(canName("wolf"), false);
});

test("a stone offers its name until it is carried or given back; old saves have none given", () => {
  const g = GRAVES[0];
  assert.match(graveLabel(g, undefined, "")!, new RegExp(g.name));
  assert.equal(graveLabel(g, undefined, g.id), null);
  assert.notEqual(graveLabel(g, undefined, GRAVES[1].id), null);
  assert.equal(graveLabel(g, [g.id], ""), null);
  assert.equal(laid(undefined, g.id), false);
  assert.equal(namesLeft(undefined), GRAVES.length);
  assert.equal(namesLeft(GRAVES.map((x) => x.id)), 0);
});
