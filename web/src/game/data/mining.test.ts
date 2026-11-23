import assert from "node:assert/strict";
import test from "node:test";
import { VEINS, broken, veinRefusal } from "./mining.ts";
import { GRAVES } from "./naming.ts";
import { FINDS } from "./explore.ts";
import { ZONES } from "./zones.ts";
import { ITEMS } from "./items.ts";

test("every ore wall sits in an outdoor land, clear of other finds, and pays in real items", () => {
  assert.equal(new Set(VEINS.map((v) => v.id)).size, VEINS.length);
  for (const v of VEINS) {
    const b = ZONES[v.zone].bounds;
    assert.equal(ZONES[v.zone].indoor, false, v.id);
    assert.ok(v.x > b.minX + 10 && v.x < b.maxX - 10 && v.z > b.minZ + 10 && v.z < b.maxZ - 10, v.id);
    for (const f of [...FINDS, ...GRAVES]) if (f.zone === v.zone) assert.ok(Math.hypot(f.x - v.x, f.z - v.z) > 8, v.id + " near " + f.id);
    assert.ok(v.loot.length > 0);
    for (const [id, n] of v.loot) assert.ok(ITEMS[id] && n > 0, v.id + " " + id);
  }
});

test("some pick in the game can break every wall, and each wall names one that does", () => {
  const picks = Object.values(ITEMS).filter((d) => d.moveset.includes("pick"));
  for (const v of VEINS) {
    const able = picks.filter((p) => p.tier >= v.tier);
    assert.ok(able.length > 0, v.id);
    assert.ok(able.some((p) => v.needs.includes(p.name)), v.id + " needs " + v.needs);
  }
});

test("a wall refuses a weaker pick and no pick, and old saves have none broken", () => {
  const v = VEINS[1];
  assert.match(veinRefusal(v, 0)!, /no pick at all/);
  assert.match(veinRefusal(v, v.tier - 1)!, /or better/);
  assert.equal(veinRefusal(v, v.tier), null);
  assert.equal(veinRefusal(v, 9), null);
  assert.equal(broken(undefined, v.id), false);
  assert.equal(broken([v.id], v.id), true);
});
