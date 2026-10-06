// Runs schema.sql + seed.sql in an in-process Postgres (PGlite) and plays the realm rules:
//   node --experimental-strip-types --test server/rpc.test.mjs
import assert from "node:assert/strict";
import { test } from "node:test";
import { openDb } from "./db.mjs";

const db = await openDb();
const call = (fn, args) => db.rpc(fn, args);

async function player() {
  const secret = "test-secret-" + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
  const id = await call("vm_register", { p_secret: secret });
  return { p_player: id, p_secret: secret };
}

test("a code joins a second player into the same persistent world", async () => {
  const a = await player();
  const b = await player();
  const ca = await call("vm_create_character", { ...a, p_name: "Charlie", p_look: { body: 1, skin: 2, hair: 1, hairColor: 3, coat: 2 } });
  const cb = await call("vm_create_character", { ...b, p_name: "Brother<script>", p_look: { body: 9 } });
  assert.equal(cb.name, "Brotherscript");
  assert.equal(cb.look.body, 2);
  assert.equal(ca.weapon, "Fists");
  assert.equal(ca.level, 1);

  const w = await call("vm_create_world", { ...a, p_name: "Charlie's Realm" });
  assert.match(w.code, /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
  const ea = await call("vm_enter", { ...a, p_world: w.id, p_char: ca.id });
  assert.equal(ea.world.code, w.code);
  await assert.rejects(call("vm_enter", { ...b, p_world: w.id, p_char: cb.id }), /code first/);
  await assert.rejects(call("vm_join", { ...b, p_code: "ZZZZZZ", p_char: cb.id }), /No world/);
  const eb = await call("vm_join", { ...b, p_code: w.code.toLowerCase().slice(0, 3) + "-" + w.code.slice(3), p_char: cb.id });
  assert.equal(eb.world.id, w.id);
  assert.equal(eb.world.members.length, 2);

  const pb = await call("vm_profile", b);
  assert.equal(pb.worlds.length, 1);
  assert.equal(pb.worlds[0].players, 2);
  assert.equal(pb.characters[0].place, "Charlie's Realm");

  // a stranger cannot act as someone else
  await assert.rejects(call("vm_profile", { p_player: a.p_player, p_secret: b.p_secret }), /Not signed in/);
  await assert.rejects(call("vm_character", { ...b, p_char: ca.id }), /not yours/);
});

test("worlds hold at most four players", async () => {
  const owner = await player();
  const c0 = await call("vm_create_character", { ...owner, p_name: "Owner", p_look: {} });
  const w = await call("vm_create_world", { ...owner, p_name: "Full" });
  await call("vm_enter", { ...owner, p_world: w.id, p_char: c0.id });
  for (let i = 0; i < 3; i++) {
    const p = await player();
    const c = await call("vm_create_character", { ...p, p_name: "P" + i, p_look: {} });
    await call("vm_join", { ...p, p_code: w.code, p_char: c.id });
  }
  const late = await player();
  const cl = await call("vm_create_character", { ...late, p_name: "Late", p_look: {} });
  await assert.rejects(call("vm_join", { ...late, p_code: w.code, p_char: cl.id }), /four players/);
});

test("gathering, crafting, loot and positions are checked by the server", async () => {
  const a = await player();
  const c = await call("vm_create_character", { ...a, p_name: "Gatherer", p_look: {} });
  const w = await call("vm_create_world", { ...a, p_name: "Rules" });
  await call("vm_enter", { ...a, p_world: w.id, p_char: c.id });
  const args = { ...a, p_world: w.id, p_char: c.id };

  let r = await call("vm_gather", { ...args, p_node: "flint_0" });
  assert.equal(r.item, "mat_flint");
  await assert.rejects(call("vm_gather", { ...args, p_node: "flint_0" }), /too fast/);
  await db.exec(`update vm_characters set flags = flags - 'gather_at' where id = '${c.id}'`);
  r = await call("vm_gather", { ...args, p_node: "flint_0" });
  await db.exec(`update vm_characters set flags = flags - 'gather_at' where id = '${c.id}'`);
  r = await call("vm_gather", { ...args, p_node: "flint_0" });
  assert.equal(r.node.left, 0);
  await db.exec(`update vm_characters set flags = flags - 'gather_at' where id = '${c.id}'`);
  await assert.rejects(call("vm_gather", { ...args, p_node: "flint_0" }), /spent/);
  await db.exec(`update vm_characters set flags = flags - 'gather_at' where id = '${c.id}'`);
  await assert.rejects(call("vm_gather", { ...args, p_node: "copper_0" }), /tier/);
  await assert.rejects(call("vm_gather", { ...args, p_node: "iron_0" }), /sealed/);

  await assert.rejects(call("vm_craft", { ...args, p_recipe: "recipe_stone_pick", p_station: "bench" }), /station|materials/);
  await db.exec(`update vm_characters set flags = flags - 'gather_at' where id = '${c.id}'`);
  r = await call("vm_gather", { ...args, p_node: "wood_0" });
  r = await call("vm_craft", { ...args, p_recipe: "recipe_stone_knife", p_station: "hand" });
  assert.equal(r.made, "wpn_stone_knife");
  assert.ok(r.items.some((s) => s.def === "wpn_stone_knife" && s.equipped));
  assert.equal(r.items.find((s) => s.def === "mat_flint").count, 1);
  assert.ok(!r.items.some((s) => s.def === "mat_wood"));
  await assert.rejects(call("vm_craft", { ...args, p_recipe: "recipe_stone_knife", p_station: "hand" }), /materials/);

  // a foe dies once: the second claim gets nothing
  const first = await call("vm_loot", { ...args, p_mob: "w1" });
  assert.equal(first.dup, false);
  assert.ok(first.drops.some((d) => d.item === "mat_bone"));
  const second = await call("vm_loot", { ...args, p_mob: "w1" });
  assert.equal(second.dup, true);
  assert.equal(second.drops.length, 0);

  // teleporting is refused, walking is kept
  r = await call("vm_heartbeat", { ...args, p_x: 1, p_z: 2, p_yaw: 0, p_dungeon: false, p_hp: 90, p_play: 5 });
  assert.equal(r.ok, true);
  r = await call("vm_heartbeat", { ...args, p_x: 500, p_z: 500, p_yaw: 0, p_dungeon: false, p_hp: 90, p_play: 5 });
  assert.equal(r.ok, false);

  // caches open once per character per world
  r = await call("vm_member_flag", { ...args, p_flag: "chest" });
  assert.equal(r.drops.length, 3);
  r = await call("vm_member_flag", { ...args, p_flag: "chest" });
  assert.equal(r.drops.length, 0);
  await assert.rejects(call("vm_world_flag", { ...args, p_flag: "gate" }), /does not answer/);
});

test("Cookie has one health pool and pays each fighter exactly once", async () => {
  const a = await player();
  const b = await player();
  const ca = await call("vm_create_character", { ...a, p_name: "A", p_look: {} });
  const cb = await call("vm_create_character", { ...b, p_name: "B", p_look: {} });
  const w = await call("vm_create_world", { ...a, p_name: "Boss" });
  await call("vm_enter", { ...a, p_world: w.id, p_char: ca.id });
  await call("vm_join", { ...b, p_code: w.code, p_char: cb.id });
  assert.equal(w.cookie, false);

  let hp = 280;
  let turn = 0;
  let last;
  while (hp > 0 && turn < 400) {
    const who = turn % 2 ? { ...b, p_char: cb.id } : { ...a, p_char: ca.id };
    await db.exec(`delete from vm_boss_hits where character_id = '${who.p_char}'`).catch(() => {});
    last = await call("vm_boss_hit", { ...who, p_world: w.id, p_heavy: true, p_fire: false, p_behind: false, p_perched: false, p_dizzy: false });
    assert.ok(last.hp <= hp);
    hp = last.hp;
    turn++;
  }
  assert.equal(last.dead, true);
  assert.equal(last.granted, true);
  const again = await call("vm_boss_hit", { ...a, p_world: w.id, p_char: ca.id, p_heavy: true, p_fire: false, p_behind: false, p_perched: false, p_dizzy: false });
  assert.equal(again.dead, true);
  assert.equal(again.dealt, 0);

  for (const [who, id] of [[a, ca.id], [b, cb.id]]) {
    const c = await call("vm_character", { ...who, p_char: id });
    for (const def of ["wpn_cookie_blade", "wpn_cookie_pick", "key_cookie_core"]) {
      assert.equal(c.items.filter((s) => s.def === def).length, 1, def + " exactly once");
    }
    assert.equal(c.flags.cookie, true);
  }
  // the world remembers: the gate can now open, iron can be mined
  const flags = await call("vm_world_flag", { ...a, p_world: w.id, p_char: ca.id, p_flag: "gate" });
  assert.equal(flags.gate, true);
  const r = await call("vm_gather", { ...a, p_world: w.id, p_char: ca.id, p_node: "iron_0" });
  assert.equal(r.item, "mat_iron");
});

test("an old local save imports once", async () => {
  const a = await player();
  const payload = {
    source: "slot0-123", name: "Old Hero", look: { body: 0, skin: 3, hair: 2, hairColor: 1, coat: 4 }, kills: 12, deaths: 3, time: 900,
    flags: { talked: true, ember: true, cookie: false },
    items: [{ def: "wpn_copper_sword", count: 1 }, { def: "mat_wood", count: 7 }, { def: "wpn_cookie_blade", count: 1 }, { def: "nope", count: 1 }],
  };
  const c1 = await call("vm_import_character", { ...a, p_payload: payload });
  const c2 = await call("vm_import_character", { ...a, p_payload: payload });
  assert.equal(c1.id, c2.id);
  assert.equal(c1.weapon, "Copper Sword");
  assert.equal(c1.mana_max, 30);
  assert.ok(!c1.items.some((s) => s.def === "wpn_cookie_blade"), "uniques need the boss flag");
  assert.equal(c1.items.find((s) => s.def === "mat_wood").count, 7);
  const prof = await call("vm_profile", a);
  assert.equal(prof.characters.length, 1);
});
