import assert from "node:assert/strict";
import test from "node:test";
import { ITEMS } from "./content.ts";
import { addItem, canMine, consume, gateOpen, grantUniques, strikeDamage, tryCraft } from "./rules.ts";

let n = 0;
const uid = () => "u" + ++n;

test("stone knife consumes flint and wood once", () => {
  n = 0;
  let items = addItem([], "mat_flint", 2, uid);
  items = addItem(items, "mat_wood", 1, uid);
  const made = tryCraft(items, "recipe_stone_knife", "hand", uid);
  assert.equal(made.ok, true);
  assert.equal(made.items.filter((s) => s.def === "wpn_stone_knife").length, 1);
  assert.equal(made.items.some((s) => s.def === "mat_flint"), false);
  const again = tryCraft(made.items, "recipe_stone_knife", "bench", uid);
  assert.equal(again.ok, false);
  assert.equal(again.reason, "materials");
});

test("bench recipe rejects an empty hand", () => {
  n = 0;
  let items = addItem([], "mat_flint", 3, uid);
  items = addItem(items, "mat_wood", 2, uid);
  items = addItem(items, "mat_fibre", 1, uid);
  const hand = tryCraft(items, "recipe_stone_pick", "hand", uid);
  assert.equal(hand.reason, "station");
  const bench = tryCraft(items, "recipe_stone_pick", "bench", uid);
  assert.equal(bench.ok, true);
});

test("knife out-damages fists and a shield cuts the hit", () => {
  const fists = strikeDamage({ weapon: ITEMS.wpn_fists, heavy: false, skillRank: 0, weakness: false, blocking: false, shield: false, defence: 0 });
  const knife = strikeDamage({ weapon: ITEMS.wpn_stone_knife, heavy: false, skillRank: 0, weakness: false, blocking: false, shield: false, defence: 0 });
  const blocked = strikeDamage({ weapon: ITEMS.wpn_stone_knife, heavy: false, skillRank: 0, weakness: false, blocking: true, shield: true, defence: 0 });
  assert.ok(knife > fists);
  assert.ok(blocked < knife);
});

test("cookie grant is once and the seal opens the gate", () => {
  n = 0;
  const first = grantUniques([], ["wpn_cookie_blade", "wpn_cookie_pick", "key_cookie_core"], uid);
  assert.deepEqual(first.minted, ["wpn_cookie_blade", "wpn_cookie_pick", "key_cookie_core"]);
  const second = grantUniques(first.items, ["wpn_cookie_blade", "wpn_cookie_pick", "key_cookie_core"], uid);
  assert.equal(second.minted.length, 0);
  assert.equal(gateOpen(["seal_cookie"]), true);
  assert.equal(gateOpen([]), false);
});

test("iron rejects a copper pick until the cookie seal and pick", () => {
  assert.equal(canMine(4, "seal_cookie", 3, ["seal_cookie"]), "tier");
  assert.equal(canMine(4, "seal_cookie", 4, []), "sealed");
  assert.equal(canMine(4, "seal_cookie", 4, ["seal_cookie"]), "");
});

test("consume will not drive a stack negative", () => {
  n = 0;
  const items = addItem([], "mat_wood", 1, uid);
  assert.equal(consume(items, "mat_wood", 2), null);
});

test("copper sword wants the forge, not the bench", () => {
  n = 0;
  let items = addItem([], "mat_copper", 5, uid);
  items = addItem(items, "mat_wood", 1, uid);
  items = addItem(items, "mat_flint", 1, uid);
  assert.equal(tryCraft(items, "recipe_copper_sword", "bench", uid).reason, "station");
  assert.equal(tryCraft(items, "recipe_copper_sword", "hand", uid).reason, "station");
  const made = tryCraft(items, "recipe_copper_sword", "forge", uid);
  assert.equal(made.ok, true);
  assert.equal(made.made, "wpn_copper_sword");
});

test("hand recipes work at any station", () => {
  n = 0;
  const items = addItem([], "mat_fibre", 2, uid);
  assert.equal(tryCraft(items, "recipe_bandage", "forge", uid).ok, true);
});

test("bandages stack, weapons do not", () => {
  n = 0;
  let items = addItem([], "cons_bandage", 2, uid);
  items = addItem(items, "cons_bandage", 1, uid);
  assert.equal(items.filter((s) => s.def === "cons_bandage").length, 1);
  assert.equal(items[0].count, 3);
  items = addItem(items, "wpn_stone_knife", 1, uid);
  items = addItem(items, "wpn_stone_knife", 1, uid);
  assert.equal(items.filter((s) => s.def === "wpn_stone_knife").length, 2);
});
