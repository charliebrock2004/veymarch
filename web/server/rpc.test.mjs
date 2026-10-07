// Runs schema.sql + seed.sql in an in-process Postgres (PGlite) and plays the realm rules:
//   node --experimental-strip-types --test server/rpc.test.mjs
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { openDb } from "./db.mjs";
import { BOSSES, bossHp } from "../src/game/data/bosses.ts";
import { ITEMS } from "../src/game/data/items.ts";
import { LEVEL_XP, MOB_XP, levelOf, statsFor } from "../src/game/data/progression.ts";
import { QUESTS } from "../src/game/data/quests.ts";
import { MOB_SPAWNS, WORLD_FLAGS } from "../src/game/data/world.ts";
import { PORTALS, SHRINES, STATIONS, ZONES } from "../src/game/data/zones.ts";

const db = await openDb();
const call = (fn, args) => db.rpc(fn, args);

async function player() {
  const secret = "test-secret-" + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
  const id = await call("vm_register", { p_secret: secret });
  return { p_player: id, p_secret: secret };
}

// ------------------------------------------------------------------ Phase B helpers
/** A player with a character standing in a world of their own. */
async function setup(name = "T") {
  const p = await player();
  const c = await call("vm_create_character", { ...p, p_name: name, p_look: {} });
  const w = await call("vm_create_world", { ...p, p_name: name + "'s world" });
  const entered = await call("vm_enter", { ...p, p_world: w.id, p_char: c.id });
  return { p, c, w, entered, args: { ...p, p_world: w.id, p_char: c.id } };
}
/** Another player's character joining a world. */
async function joiner(w, name) {
  const p = await player();
  const c = await call("vm_create_character", { ...p, p_name: name, p_look: {} });
  const joined = await call("vm_join", { ...p, p_code: w.code, p_char: c.id });
  return { p, c, joined, args: { ...p, p_world: w.id, p_char: c.id } };
}
/** Stand at zone-local (x, z), as if a heartbeat had just saved it. */
async function place(charId, worldId, zone, x, z, { ago = 0 } = {}) {
  await db.exec(`update vm_members set zone = '${zone}', dungeon = ${zone === "castle"}, x = ${ZONES[zone].ox + x}, z = ${z},
    pos_at = now() - interval '${ago} seconds', last_seen = now() where character_id = '${charId}' and world_id = '${worldId}'`);
}
async function give(charId, def, n = 1, equip = false) {
  await db.pg.query("select vm_add_item($1::uuid, $2, $3)", [charId, def, n]);
  if (equip) await db.pg.query("select vm_equip_def($1::uuid, $2)", [charId, def]);
}
async function setXp(charId, xp) {
  await db.exec(`update vm_characters set xp = ${xp} where id = '${charId}'`);
  await db.pg.query("select vm_sync_stats($1::uuid)", [charId]);
}
const count = (items, def) => items.filter((s) => s.def === def).reduce((a, s) => a + s.count, 0);
const one = async (sql, params = []) => (await db.pg.query(sql, params)).rows[0];
const me = (s) => call("vm_character", { ...s.p, p_char: s.c.id });
/** Let the next boss swing through the throttles. */
const cool = (charId) => db.exec(`update vm_boss_hits set at = at - interval '2 seconds' where character_id = '${charId}'`);

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

  // caches open once per character per world (Phase B: and only when you stand by them)
  await assert.rejects(call("vm_member_flag", { ...args, p_flag: "chest" }), /Too far/);
  await db.exec(`update vm_members set pos_at = now() - interval '3 seconds' where character_id = '${c.id}'`);
  assert.equal((await call("vm_heartbeat", { ...args, p_x: -7, p_z: -13, p_yaw: 0, p_dungeon: false, p_hp: 90, p_play: 5 })).ok, true);
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

  // nobody can hit Cookie from outside the courtyard
  await assert.rejects(call("vm_boss_hit", { ...a, p_world: w.id, p_char: ca.id, p_heavy: true, p_fire: false, p_behind: false, p_perched: false, p_dizzy: false }), /not within reach/);
  for (const [who, id] of [[a, ca.id], [b, cb.id]]) await call("vm_heartbeat", { ...who, p_world: w.id, p_char: id, p_x: 1200, p_z: 100, p_yaw: 0, p_dungeon: true, p_hp: 100, p_play: 1 });
  // Ember fire needs Ember
  await assert.rejects(call("vm_boss_hit", { ...a, p_world: w.id, p_char: ca.id, p_heavy: false, p_fire: true, p_behind: false, p_perched: false, p_dizzy: false }), /Ember/);
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
    source: "slot0:Old Hero", name: "Old Hero", look: { body: 0, skin: 3, hair: 2, hairColor: 1, coat: 4 }, kills: 12, deaths: 3, time: 900,
    flags: { talked: true, ember: true, cookie: true },
    items: [{ def: "wpn_copper_sword", count: 1 }, { def: "mat_wood", count: 70 }, { def: "wpn_cookie_blade", count: 1 }, { def: "key_cookie_core", count: 1 },
      { def: "wpn_iron_sword", count: 1 }, { def: "mat_iron", count: 50 }, { def: "nope", count: 1 }],
  };
  const c1 = await call("vm_import_character", { ...a, p_payload: payload });
  const c2 = await call("vm_import_character", { ...a, p_payload: payload });
  assert.equal(c1.id, c2.id);
  assert.equal(c1.weapon, "Copper Sword");
  assert.equal(c1.mana_max, 0, "Ember is learned again in the world");
  for (const def of ["wpn_cookie_blade", "key_cookie_core", "wpn_iron_sword", "mat_iron"]) assert.ok(!c1.items.some((s) => s.def === def), def + " is not importable");
  assert.equal(c1.items.find((s) => s.def === "mat_wood").count, 20, "stacks are capped");
  assert.notEqual(c1.flags.cookie, true);
  const prof = await call("vm_profile", a);
  assert.equal(prof.characters.length, 1);
  // unsourced or odd payloads are refused; at most three imports per player, even after deleting
  await assert.rejects(call("vm_import_character", { ...a, p_payload: { name: "X" } }), /cannot be imported/);
  await call("vm_import_character", { ...a, p_payload: { ...payload, source: "slot1:B" } });
  await call("vm_import_character", { ...a, p_payload: { ...payload, source: "slot2:C" } });
  await call("vm_delete_character", { ...a, p_char: c1.id });
  await assert.rejects(call("vm_import_character", { ...a, p_payload: { ...payload, source: "slot0:Again" } }), /already brought/);
});

test("the SQL grants exactly the client API", async () => {
  const { REALM_API } = await import("../src/net/api.ts");
  const rows = (await db.pg.query(`select distinct p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname like 'vm\\_%' and has_function_privilege('public', p.oid, 'execute') is not null`)).rows;
  const all = rows.map((r) => r.proname);
  const src = (await import("node:fs")).readFileSync(new URL("./schema.sql", import.meta.url), "utf8");
  const granted = JSON.parse("[" + /api text\[\] := array\[([^\]]*)\]/.exec(src)[1].replace(/'/g, '"') + "]");
  assert.deepEqual([...granted].sort(), [...REALM_API].sort());
  for (const f of REALM_API) assert.ok(all.includes(f), f + " exists");
});

test("seats free up when players leave, are removed, or delete their character", async () => {
  const owner = await player();
  const co = await call("vm_create_character", { ...owner, p_name: "Owner", p_look: {} });
  const w = await call("vm_create_world", { ...owner, p_name: "Seats" });
  await call("vm_enter", { ...owner, p_world: w.id, p_char: co.id });
  const guests = [];
  for (let i = 0; i < 4; i++) {
    const p = await player();
    const c = await call("vm_create_character", { ...p, p_name: "G" + i, p_look: {} });
    guests.push({ p, c });
  }
  for (const g of guests.slice(0, 3)) await call("vm_join", { ...g.p, p_code: w.code, p_char: g.c.id });
  await assert.rejects(call("vm_join", { ...guests[3].p, p_code: w.code, p_char: guests[3].c.id }), /four players/);
  // one leaves: the fourth gets in; the leaver's world disappears from their list
  const after = await call("vm_leave_world", { ...guests[0].p, p_world: w.id });
  assert.equal(after.worlds.length, 0);
  await call("vm_join", { ...guests[3].p, p_code: w.code, p_char: guests[3].c.id });
  await assert.rejects(call("vm_enter", { ...guests[0].p, p_world: w.id, p_char: guests[0].c.id }), /code first/);
  // the owner removes one; a deleted character frees its seat too
  await assert.rejects(call("vm_kick", { ...guests[1].p, p_world: w.id, p_name: "G2" }), /maker/);
  await call("vm_kick", { ...owner, p_world: w.id, p_name: "G1" });
  await call("vm_delete_character", { ...guests[2].p, p_char: guests[2].c.id });
  const card = (await call("vm_profile", owner)).worlds[0];
  assert.equal(card.players, 2, "owner and G3");
  // the leaver can come back with the code
  await call("vm_join", { ...guests[0].p, p_code: w.code, p_char: guests[0].c.id });
});

test("changing zone needs a door", async () => {
  const a = await player();
  const c = await call("vm_create_character", { ...a, p_name: "Walker", p_look: {} });
  const w = await call("vm_create_world", { ...a, p_name: "Doors" });
  await call("vm_enter", { ...a, p_world: w.id, p_char: c.id });
  const beat = (x, z, d) => call("vm_heartbeat", { ...a, p_world: w.id, p_char: c.id, p_x: x, p_z: z, p_yaw: 0, p_dungeon: d, p_hp: 100, p_play: 1 });
  assert.equal((await beat(0, 0, false)).ok, true);
  assert.equal((await beat(1200, 100, true)).ok, false, "no stepping from Hearthfen into the courtyard");
  assert.equal((await beat(1, 6, false)).ok, true);
  await db.exec(`update vm_members set x = 0, z = 162, pos_at = now() - interval '1 second' where character_id = '${c.id}'`);
  assert.equal((await beat(1200, 2.2, true)).ok, true, "through the castle door");
});

test("the bedroll moves the clock on only when you are alone", async () => {
  const a = await player();
  const b = await player();
  const ca = await call("vm_create_character", { ...a, p_name: "Sleeper", p_look: {} });
  const cb = await call("vm_create_character", { ...b, p_name: "Awake", p_look: {} });
  const w = await call("vm_create_world", { ...a, p_name: "Night" });
  await call("vm_enter", { ...a, p_world: w.id, p_char: ca.id });
  const rest = () => call("vm_rest", { ...a, p_world: w.id, p_char: ca.id });
  await assert.rejects(rest(), /bedroll/, "nobody has a position yet");
  await call("vm_heartbeat", { ...a, p_world: w.id, p_char: ca.id, p_x: -7, p_z: -11, p_yaw: 0, p_dungeon: false, p_hp: 100, p_play: 1 });
  await db.exec(`update vm_worlds set hour = 22, day = 3 where id = '${w.id}'`);
  const r = await rest();
  assert.equal(r.slept, true);
  assert.ok(Math.abs(r.hour - 6.6) < 0.05);
  assert.equal(r.day, 4);
  await call("vm_join", { ...b, p_code: w.code, p_char: cb.id });
  await db.exec(`update vm_worlds set hour = 23 where id = '${w.id}'`);
  const r2 = await rest();
  assert.equal(r2.slept, false, "a friend is here: the clock is shared");
  assert.ok(r2.hour >= 23);
});

test("a maker can delete a world; a guest can leave one", async () => {
  const a = await player();
  const b = await player();
  const ca = await call("vm_create_character", { ...a, p_name: "Maker", p_look: {} });
  const cb = await call("vm_create_character", { ...b, p_name: "Guest", p_look: {} });
  const ws = [];
  for (let i = 0; i < 6; i++) ws.push(await call("vm_create_world", { ...a, p_name: "W" + i }));
  await assert.rejects(call("vm_create_world", { ...a, p_name: "Seventh" }), /six worlds/);
  await call("vm_join", { ...b, p_code: ws[0].code, p_char: cb.id });
  await assert.rejects(call("vm_delete_world", { ...b, p_world: ws[0].id }), /maker/);
  const pa = await call("vm_delete_world", { ...a, p_world: ws[0].id });
  assert.equal(pa.worlds.length, 5);
  assert.equal((await call("vm_profile", b)).worlds.length, 0, "gone for the guest too");
  await assert.rejects(call("vm_join", { ...b, p_code: ws[0].code, p_char: cb.id }), /No world/);
  await assert.rejects(call("vm_enter", { ...a, p_world: ws[0].id, p_char: ca.id }), /gone/);
  await call("vm_create_world", { ...a, p_name: "Room again" });
  await call("vm_join", { ...b, p_code: ws[1].code, p_char: cb.id });
  const pb = await call("vm_leave_world", { ...b, p_world: ws[1].id });
  assert.equal(pb.worlds.length, 0);
  await assert.rejects(call("vm_leave_world", { ...a, p_world: ws[1].id }), /stays in your list/);
});

// ================================================================== Phase B

test("B1 content is seeded from the shared data, in world coordinates", async () => {
  const defs = (await db.pg.query("select id, defence, rarity, value, family from vm_item_defs")).rows;
  for (const d of Object.values(ITEMS)) {
    const r = defs.find((x) => x.id === d.id);
    assert.ok(r, d.id + " is seeded");
    assert.deepEqual([r.defence, r.rarity, r.value, r.family], [d.defence, d.rarity, d.value, d.family], d.id);
  }
  assert.equal((await one("select n from vm_recipes where id = 'recipe_stone_knife'")).n, 1, "recipes make one unless told");
  for (const s of STATIONS) {
    const r = await one("select kind, zone, x, z, r from vm_stations where id = $1", [s.id]);
    assert.deepEqual([r.kind, r.zone, r.x, r.z, r.r].map((v) => (typeof v === "number" ? Math.round(v * 10) / 10 : v)), [s.kind, s.zone, ZONES[s.zone].ox + s.x, s.z, s.r], s.id);
  }
  for (const p of PORTALS) {
    const r = await one("select from_zone, to_zone, x, z, tx, tz, flag from vm_portals where id = $1", [p.id]);
    assert.deepEqual([r.from_zone, r.to_zone, r.x, r.z, r.tx, r.tz, r.flag], [p.from, p.to, ZONES[p.from].ox + p.x, p.z, ZONES[p.to].ox + p.tx, p.tz, p.flag ?? null], p.id);
  }
  for (const s of SHRINES) {
    const r = await one("select zone, x, z from vm_shrines where id = $1", [s.id]);
    assert.deepEqual([r.zone, Math.round(r.x * 10) / 10, Math.round(r.z * 10) / 10], [s.zone, ZONES[s.zone].ox + s.x, s.z], s.id);
  }
  for (const b of Object.values(BOSSES)) {
    const r = await one("select zone, x, z, reach, hp, scale, xp, crowns, rewards, flag from vm_bosses where id = $1", [b.id]);
    assert.deepEqual([r.zone, r.x, r.z, r.reach, r.hp, r.scale, r.xp, r.crowns, r.rewards, r.flag],
      [b.zone, ZONES[b.zone].ox + b.x, b.z, b.reach, b.hp, b.scale, b.xp, b.crowns, b.rewards, b.flag], b.id);
  }
  for (const [kind, xp] of Object.entries(MOB_XP)) assert.equal((await one("select xp from vm_mob_kinds where kind = $1", [kind])).xp, xp, kind);
  for (const q of QUESTS) assert.deepEqual((await one("select def from vm_quests where id = $1", [q.id])).def, JSON.parse(JSON.stringify(q)), q.id);
  const rules = (await db.pg.query("select flag, needs_mob, needs_flag from vm_world_flag_rules")).rows;
  for (const f of WORLD_FLAGS) assert.deepEqual(rules.find((r) => r.flag === f.flag), { flag: f.flag, needs_mob: f.needsMob ?? null, needs_flag: f.needsFlag ?? null });
  const stock = await one("select price from vm_shop_stock where shop = 'hv_holt' and item = 'wpn_steel_sword'");
  assert.equal(stock.price, 320, "a listed price wins");
  assert.equal((await one("select price from vm_shop_stock where shop = 'hv_holt' and item = 'wpn_iron_sword'")).price, ITEMS.wpn_iron_sword.value, "else the item's value");
  assert.deepEqual((await one("select value from vm_config where key = 'level_xp'")).value, LEVEL_XP);
  assert.equal((await one("select value from vm_config where key = 'cookie_hp'")).value, BOSSES.cookie.hp, "cookie_hp is kept");
});

test("B2 crafting needs a station of the recipe's kind nearby, in the same zone", async () => {
  const s = await setup("Smith");
  const craft = (recipe, station = "bench") => call("vm_craft", { ...s.args, p_recipe: recipe, p_station: station });
  await give(s.c.id, "mat_flint", 9);
  await give(s.c.id, "mat_wood", 6);
  await give(s.c.id, "mat_fibre", 3);
  const bench = STATIONS.find((x) => x.id === "hf_bench");
  await assert.rejects(craft("recipe_stone_pick"), /station/, "no saved position yet");
  // out of reach (r + 8), or the right spot in the wrong zone
  await place(s.c.id, s.w.id, "over", bench.x + bench.r + 8.6, bench.z);
  await assert.rejects(craft("recipe_stone_pick"), /station/);
  await place(s.c.id, s.w.id, "castle", bench.x, bench.z);
  await assert.rejects(craft("recipe_stone_pick"), /station/);
  let me1 = await me(s);
  assert.equal(count(me1.items, "mat_flint"), 9, "a refused craft takes nothing");
  // within the bench's reach plus the slack; p_station is only a hint
  await place(s.c.id, s.w.id, "over", bench.x + bench.r + 7.5, bench.z);
  let r = await craft("recipe_stone_pick", "forge");
  assert.equal(r.made, "wpn_stone_pick");
  assert.equal(count(r.items, "mat_flint"), 6);
  // a bench recipe at a forge (Holt's, across town from the armourer's bench) is refused: the kind matters, not the hint
  const holtForge = STATIONS.find((x) => x.id === "hv_forge");
  await place(s.c.id, s.w.id, "kingdom", holtForge.x, holtForge.z);
  await assert.rejects(craft("recipe_stone_pick", "bench"), /station/);
  // Holt's smithy for steel; any forge for forge work
  await give(s.c.id, "mat_iron", 5);
  await give(s.c.id, "mat_coal", 1);
  const maraForge = STATIONS.find((x) => x.id === "hf_forge");
  await place(s.c.id, s.w.id, "over", maraForge.x, maraForge.z);
  await assert.rejects(craft("recipe_steel", "blacksmith"), /station/, "Hearthfen has no blacksmith");
  const smith = STATIONS.find((x) => x.id === "hv_smith");
  await place(s.c.id, s.w.id, "kingdom", smith.x, smith.z);
  r = await craft("recipe_steel", "blacksmith");
  assert.equal(count(r.items, "mat_steel"), 1);
  await place(s.c.id, s.w.id, "kingdom", holtForge.x, holtForge.z);
  r = await craft("recipe_iron_pick", "forge");
  assert.equal(r.made, "wpn_iron_pick");
  // a recipe can make several
  await db.exec(`insert into vm_recipes (id, out_item, station, n) values ('test_three_bandages', 'cons_bandage', 'hand', 3) on conflict (id) do update set n = 3;
                 insert into vm_recipe_inputs (recipe, item, n) values ('test_three_bandages', 'mat_fibre', 1) on conflict do nothing`);
  r = await craft("test_three_bandages", "hand");
  assert.equal(r.n, 3);
  assert.equal(count(r.items, "cons_bandage"), 3);
});

test("B3 zones change only through an open door near where you last stood", async () => {
  const s = await setup("Traveller");
  assert.equal(s.entered.member.zone, "over");
  const beat = (zone, x, z, extra = {}) =>
    call("vm_heartbeat", { ...s.args, p_x: ZONES[zone].ox + x, p_z: z, p_yaw: 0, p_hp: 100, p_play: 1, p_zone: zone, ...extra });
  const portal = (id) => PORTALS.find((p) => p.id === id);
  const member = () => one("select zone, dungeon, x, z from vm_members where character_id = $1", [s.c.id]);
  // no saved position yet (first entry): you may wake in any zone
  let r = await beat("hunt", 0, -100);
  assert.equal(r.ok, true);
  assert.equal(r.zone, "hunt");
  // no stepping into another zone away from a door
  r = await beat("kingdom", 60, 152);
  assert.equal(r.ok, false);
  assert.equal(r.zone, "hunt");
  // through the door, from where you stood by it
  const hk = portal("hunt_kingdom");
  await place(s.c.id, s.w.id, "hunt", hk.x, hk.z + 5, { ago: 1 });
  r = await beat("kingdom", hk.tx, hk.tz);
  assert.equal(r.ok, true);
  assert.equal((await member()).zone, "kingdom");
  // the door must be near the LAST SAVED position: r + 12 + 9.5 * min(seconds since, 6)
  const ko = portal("kingdom_over");
  await place(s.c.id, s.w.id, "kingdom", ko.x + ko.r + 12 + 20, ko.z);
  assert.equal((await beat("over", ko.tx, ko.tz)).ok, false);
  await place(s.c.id, s.w.id, "kingdom", ko.x + ko.r + 12 + 20, ko.z, { ago: 10 });
  assert.equal((await beat("over", ko.tx, ko.tz)).ok, true, "an older save allows a longer walk to the door");
  // a shut door stays shut: the Kingsroad barricade opens with the Green Gate
  const ok = portal("over_kingdom");
  await place(s.c.id, s.w.id, "over", ok.x - 2, ok.z, { ago: 1 });
  assert.equal((await beat("kingdom", ok.tx, ok.tz)).ok, false);
  await db.exec(`update vm_worlds set flags = flags || '{"gate": true}' where id = '${s.w.id}'`);
  assert.equal((await beat("kingdom", ok.tx, ok.tz)).ok, true);
  // a door to somewhere else does not count (the castle door does not lead to the kingdom)
  const oc = portal("over_castle");
  await place(s.c.id, s.w.id, "over", oc.x, oc.z, { ago: 1 });
  assert.equal((await beat("kingdom", 0, 0)).ok, false);
  // within a zone, the speed check
  await place(s.c.id, s.w.id, "over", 0, 0);
  assert.equal((await beat("over", 3, 0)).ok, true);
  assert.equal((await beat("over", 150, 0)).ok, false);
  // a position must lie in the zone it claims, and the zone must exist
  assert.equal((await beat("over", 1200, 100)).ok, false, "castle coordinates are not the overworld");
  r = await call("vm_heartbeat", { ...s.args, p_x: 0, p_z: 0, p_yaw: 0, p_hp: 100, p_play: 1, p_zone: "moon" });
  assert.equal(r.ok, false);
  // dying clears the position: wake anywhere, and the old dungeon column follows the zone
  await call("vm_died", s.args);
  assert.equal((await beat("castle", 0, 4)).ok, true);
  let m = await member();
  assert.equal(m.zone, "castle");
  assert.equal(m.dungeon, true);
  // older clients send p_dungeon and no p_zone
  r = await call("vm_heartbeat", { ...s.args, p_x: 1201, p_z: 5, p_yaw: 0, p_dungeon: true, p_hp: 100, p_play: 1 });
  assert.equal(r.ok, true);
  assert.equal(r.zone, "castle");
  // entering reports the zone
  const again = await call("vm_enter", { ...s.p, p_world: s.w.id, p_char: s.c.id });
  assert.equal(again.member.zone, "castle");
  assert.equal(again.member.dungeon, true);
  // back out of the castle door; the dungeon column follows
  const co = portal("castle_over");
  await place(s.c.id, s.w.id, "castle", co.x, co.z, { ago: 1 });
  assert.equal((await beat("over", co.tx, co.tz)).ok, true);
  m = await member();
  assert.equal(m.dungeon, false);
});

test("B4 experience: each kill pays its worth once, and levels raise health and breath", async () => {
  const s = await setup("Learner");
  let c = await me(s);
  assert.deepEqual([c.xp, c.level, c.xp_lo, c.xp_hi, c.crowns], [0, 1, 0, LEVEL_XP[1], 0]);
  assert.deepEqual(c.kill_counts, {});
  assert.deepEqual(c.quests, {});
  let r = await call("vm_loot", { ...s.args, p_mob: "w1" });
  assert.equal(r.dup, false);
  assert.equal(r.xp_gained, MOB_XP.wolf);
  assert.equal(r.level, 1);
  r = await call("vm_loot", { ...s.args, p_mob: "w1" });
  assert.equal(r.dup, true);
  assert.equal(r.xp_gained, 0, "a dead foe pays nothing twice");
  c = await me(s);
  assert.equal(c.xp, MOB_XP.wolf);
  assert.deepEqual(c.kill_counts, { wolf: 1 });
  // Ember: breath by level
  await give(s.c.id, "wpn_iron_spear");
  c = await call("vm_char_flag", { ...s.p, p_char: s.c.id, p_flag: "ember" });
  assert.equal(c.mana_max, statsFor(1).mana);
  // the kennelmaster is worth a level, never comes back, and crowns are ordinary drops
  r = await call("vm_loot", { ...s.args, p_mob: "knm" });
  const xp = MOB_XP.wolf + MOB_XP.kennelmaster;
  assert.equal(r.level, levelOf(xp));
  assert.ok(r.drops.some((d) => d.item === "coin_crown"));
  assert.equal(r.crowns, count(r.items, "coin_crown"));
  c = await me(s);
  assert.deepEqual([c.xp, c.level, c.xp_lo, c.xp_hi], [xp, levelOf(xp), LEVEL_XP[levelOf(xp) - 1], LEVEL_XP[levelOf(xp)]]);
  assert.equal(c.max_hp, statsFor(c.level).maxHp);
  assert.equal(c.mana_max, statsFor(c.level).mana);
  assert.equal(c.crowns, count(c.items, "coin_crown"));
  assert.deepEqual(c.kill_counts, { wolf: 1, kennelmaster: 1 });
  const dead = (await one("select dead_mobs from vm_worlds where id = $1", [s.w.id])).dead_mobs;
  assert.equal(dead.knm, null, "the kennelmaster stays dead");
  assert.equal(typeof dead.w1, "string", "wolves come back");
  // who comes back is decided by the zone (indoor or not) and the kind
  const spawns = (await db.pg.query("select key, zone, respawns from vm_mob_spawns")).rows;
  for (const [key, kind, , , zone] of MOB_SPAWNS) {
    const row = spawns.find((x) => x.key === key);
    assert.equal(row.zone, zone, key);
    assert.equal(row.respawns, !ZONES[zone].indoor && kind !== "soldier" && kind !== "kennelmaster", key);
  }
  // the server's level table agrees with the client's
  for (const t of LEVEL_XP) {
    for (const v of [t - 1, t, t + 1]) if (v >= 0) assert.equal((await one("select vm_level_of($1) as l", [v])).l, levelOf(v), "xp " + v);
  }
  // the cap
  await setXp(s.c.id, LEVEL_XP[LEVEL_XP.length - 1] + 5000);
  c = await me(s);
  assert.equal(c.level, 20);
  assert.equal(c.xp_lo, c.xp_hi);
  assert.equal(c.max_hp, statsFor(20).maxHp);
  assert.equal(c.mana_max, statsFor(20).mana);
});

test("B5 bosses: the arena, damage by level, health by fighters, rewards once to fighters and witnesses", async () => {
  const boe = BOSSES.boe;
  const a = await setup("Hunter");
  for (const b of Object.values(BOSSES)) assert.deepEqual(a.entered.world.boss[b.id], { hp: b.hp, max: b.hp, dead: false, fight: 1 }, b.id);
  const b = await joiner(a.w, "Witness");
  const c = await joiner(a.w, "Wanderer");
  const d = await joiner(a.w, "Bystander");
  assert.equal(d.joined.member.zone, "over", "joining reports the zone");
  const hit = (who, o = {}) =>
    call("vm_boss_hit", { ...who.args, p_heavy: false, p_fire: false, p_behind: false, p_perched: false, p_dizzy: false, p_boss: "boe", ...o });
  const at = (who, dx, dz) => place(who.c.id, a.w.id, "kennel", boe.x + dx, boe.z + dz);
  // only from the arena: the right spot in the wrong zone, out of reach, or a stale save are refused
  await place(a.c.id, a.w.id, "castle", boe.x, boe.z);
  await assert.rejects(hit(a), /not within reach/);
  await at(a, 0, -boe.reach - 1);
  await assert.rejects(hit(a), /not within reach/);
  await at(a, 0, -boe.reach + 1);
  await db.exec(`update vm_members set last_seen = now() - interval '30 seconds' where character_id = '${a.c.id}'`);
  await assert.rejects(hit(a), /not within reach/);
  await at(a, 3, 0);
  await assert.rejects(hit(a, { p_boss: "nobody" }), /Unknown foe/);
  // Ember is priced by level, throttled, and the Black Knight's set adds 15%
  await assert.rejects(hit(a, { p_fire: true }), /Ember/);
  await db.exec(`update vm_characters set mana_max = 30 where id = '${a.c.id}'`);
  let r = await hit(a, { p_fire: true });
  assert.equal(r.boss, "boe");
  assert.equal(r.dealt, 21);
  assert.equal(r.hp, boe.hp - 21);
  r = await hit(a, { p_fire: true });
  assert.equal(r.throttled, true);
  assert.equal(r.dealt, 0);
  await cool(a.c.id);
  await setXp(a.c.id, LEVEL_XP[10]);
  r = await hit(a, { p_fire: true });
  assert.equal(r.dealt, Math.round(21 * statsFor(11).power));
  for (const slot of ["head", "chest", "hands", "legs", "feet"]) await give(a.c.id, "arm_bk_" + slot, 1, true);
  await cool(a.c.id);
  r = await hit(a, { p_fire: true });
  assert.equal(r.dealt, Math.round(21 * statsFor(11).power * 1.15));
  await cool(a.c.id);
  r = await hit(a, { p_fire: true, p_dizzy: true });
  assert.equal(r.dealt, Math.round(21 * statsFor(11).power * 1.3 * 1.15), "a dizzy foe takes 30% more");
  // a weapon swing: fists, by level and set, within the random spread
  await cool(a.c.id);
  r = await hit(a);
  const base = ITEMS.wpn_fists.damage * statsFor(11).power * 1.15;
  assert.ok(r.dealt >= Math.floor(base * 0.92) && r.dealt <= Math.ceil(base * 1.08), "fists dealt " + r.dealt);
  // a fight still being fought is not reset
  let boss = await call("vm_boss_reset", { ...a.args, p_boss: "boe" });
  assert.equal(boss.boe.fight, 1);
  // once quiet, it restarts sized to the fighters standing in the arena: four here...
  await at(b, 5, 5);
  await at(c, -2, 0);
  await at(d, 0, 8);
  await db.exec(`update vm_boss_hits set at = at - interval '20 seconds' where world_id = '${a.w.id}'`);
  boss = await call("vm_boss_reset", { ...a.args, p_boss: "boe" });
  assert.deepEqual(boss.boe, { hp: bossHp(boe, 4), max: bossHp(boe, 4), dead: false, fight: 2 });
  // ...then two (c and d walk off); and an empty arena counts as one
  await at(c, 0, -80);
  await at(d, 0, -60);
  boss = await call("vm_boss_reset", { ...a.args, p_boss: "boe" });
  assert.deepEqual(boss.boe, { hp: bossHp(boe, 2), max: bossHp(boe, 2), dead: false, fight: 3 });
  boss = await call("vm_boss_reset", { ...a.args });
  assert.deepEqual(boss.cookie, { hp: bossHp(BOSSES.cookie, 1), max: bossHp(BOSSES.cookie, 1), dead: false, fight: 2 }, "p_boss defaults to Cookie");
  // fight 3: c lands a blow and walks away; d never swings and stands far off; b watches from the arena
  await at(c, -2, 0);
  r = await hit(c);
  assert.ok(r.dealt > 0);
  await at(c, 0, -80);
  const before = { a: await me(a), b: await me(b), c: await me(c), d: await me(d) };
  await db.exec(`update vm_worlds set boss = jsonb_set(boss, '{boe,hp}', '2') where id = '${a.w.id}'`);
  await cool(a.c.id);
  r = await hit(a);
  assert.equal(r.dead, true);
  assert.equal(r.granted, true);
  assert.equal(r.character.flags.boe, true);
  const flags = (await one("select flags from vm_worlds where id = $1", [a.w.id])).flags;
  assert.equal(flags[boe.flag], true);
  for (const who of ["a", "b", "c"]) {
    const s = { a, b, c }[who];
    const now = await me(s);
    for (const [item, n] of boe.rewards) assert.equal(count(now.items, item), count(before[who].items, item) + n, who + " " + item);
    assert.equal(now.crowns, before[who].crowns + boe.crowns, who + " crowns");
    assert.equal(now.xp, before[who].xp + boe.xp, who + " xp");
    assert.equal(now.flags.boe, true, who + " flag");
    assert.equal(now.max_hp, statsFor(now.level).maxHp, who + " health follows the level");
    assert.equal(now.mana_max, who === "a" ? statsFor(now.level).mana : 0, who + " breath only with Ember");
  }
  const dn = await me(d);
  assert.deepEqual([dn.xp, dn.crowns, count(dn.items, "wpn_smacko"), dn.flags.boe], [0, 0, 0, undefined], "far off and never swung: nothing");
  // exactly once: the dead stay dead, and even a new fight pays nobody twice
  r = await hit(b);
  assert.equal(r.dead, true);
  assert.equal(r.dealt, 0);
  boss = await call("vm_boss_reset", { ...a.args, p_boss: "boe" });
  assert.equal(boss.boe.dead, true);
  const paid = { a: await me(a), b: await me(b) };
  await db.exec(`update vm_worlds set boss = jsonb_set(boss, '{boe}', '{"hp": 1, "max": 520, "dead": false, "fight": 9}') where id = '${a.w.id}'`);
  await cool(a.c.id);
  r = await hit(a);
  assert.equal(r.dead, true);
  for (const who of ["a", "b"]) {
    const now = await me({ a, b }[who]);
    assert.deepEqual([now.xp, now.crowns, now.items.length, count(now.items, "mat_boe_fang")],
      [paid[who].xp, paid[who].crowns, paid[who].items.length, count(paid[who].items, "mat_boe_fang")], who + " paid once");
  }
  assert.equal((await one("select count(*)::int as n from vm_grants where world_id = $1 and boss = 'boe'", [a.w.id])).n, 3);
});

test("B6 shops: buy at the counter for crowns, sell from an exact stack, nothing free and nothing twice", async () => {
  const s = await setup("Shopper");
  const corrin = { zone: "over", x: 4.6, z: -4.2 };
  const buy = (item, n, shop = "hf_corrin") => call("vm_buy", { ...s.args, p_shop: shop, p_item: item, p_n: n });
  const sell = (uid, n, shop = "hf_corrin") => call("vm_sell", { ...s.args, p_shop: shop, p_uid: uid, p_n: n });
  await assert.rejects(buy("cons_bandage", 1), /counter/, "no saved position");
  await place(s.c.id, s.w.id, "over", corrin.x + 14.5, corrin.z);
  await assert.rejects(buy("cons_bandage", 1), /counter/);
  await place(s.c.id, s.w.id, "castle", corrin.x, corrin.z);
  await assert.rejects(buy("cons_bandage", 1), /counter/, "same spot, wrong zone");
  await place(s.c.id, s.w.id, "over", corrin.x + 13.5, corrin.z);
  await assert.rejects(buy("cons_bandage", 1), /cannot afford/);
  let c = await me(s);
  assert.equal(count(c.items, "cons_bandage"), 0, "no crowns, no bandage");
  await give(s.c.id, "coin_crown", 100);
  let r = await buy("cons_bandage", 3);
  assert.equal(r.crowns, 100 - 3 * ITEMS.cons_bandage.value);
  assert.equal(count(r.items, "cons_bandage"), 3);
  await assert.rejects(buy("cons_bandage", 0), /between 1 and 20/);
  await assert.rejects(buy("cons_bandage", 21), /between 1 and 20/);
  await assert.rejects(buy("mat_iron", 1), /Not for sale/);
  await assert.rejects(buy("cons_bandage", 1, "nowhere"), /No such shop/);
  // short by a crown buys nothing
  await assert.rejects(buy("wpn_stone_pick", 20), /cannot afford/);
  c = await me(s);
  assert.equal(c.crowns, 82);
  assert.equal(count(c.items, "wpn_stone_pick"), 0);
  // a listed price beats the item's value
  await place(s.c.id, s.w.id, "kingdom", -6, 6);
  r = await buy("mat_wheat", 5, "hv_market");
  assert.equal(r.crowns, 82 - 10);
  // selling: 40% of value, at least a crown each, from the stack named
  await place(s.c.id, s.w.id, "over", corrin.x, corrin.z);
  const bandage = r.items.find((x) => x.def === "cons_bandage");
  r = await sell(bandage.uid, 1);
  assert.equal(r.crowns, 72 + Math.floor(ITEMS.cons_bandage.value * 0.4));
  assert.equal(r.items.find((x) => x.uid === bandage.uid).count, 2);
  await assert.rejects(sell(bandage.uid, 3), /that many/);
  await assert.rejects(sell(bandage.uid, 0), /that many/);
  await assert.rejects(sell("nope", 1), /do not have that/);
  const cloth = r.items.find((x) => x.def === "arm_cloth");
  r = await sell(cloth.uid, 1);
  assert.equal(r.crowns, 74 + 1, "worthless things still fetch a crown");
  // not soulbound, not keys, not coin, and not at a shop that does not buy
  await give(s.c.id, "wpn_cookie_blade");
  await give(s.c.id, "key_red_collar");
  c = await me(s);
  for (const def of ["wpn_cookie_blade", "key_red_collar", "coin_crown"]) {
    await assert.rejects(sell(c.items.find((x) => x.def === def).uid, 1), /will not buy/, def);
  }
  await place(s.c.id, s.w.id, "kingdom", 18, 16);
  await assert.rejects(sell(bandage.uid, 1, "hv_ox"), /do not buy/);
  // two stacks of wood: selling from the second leaves the first alone; the emptied stack is gone
  await place(s.c.id, s.w.id, "over", corrin.x, corrin.z);
  await give(s.c.id, "mat_wood", 120);
  c = await me(s);
  const woods = c.items.filter((x) => x.def === "mat_wood");
  assert.deepEqual(woods.map((x) => x.count), [99, 21]);
  const crowns0 = c.crowns;
  r = await sell(woods[1].uid, 21);
  assert.equal(r.crowns, crowns0 + 21);
  assert.deepEqual(r.items.filter((x) => x.def === "mat_wood").map((x) => [x.uid, x.count]), [[woods[0].uid, 99]]);
  // a double tap sells once
  const twice = await Promise.allSettled([sell(woods[0].uid, 99), sell(woods[0].uid, 99)]);
  assert.deepEqual(twice.map((t) => t.status).sort(), ["fulfilled", "rejected"]);
  c = await me(s);
  assert.equal(c.crowns, crowns0 + 21 + 99);
  assert.equal(count(c.items, "mat_wood"), 0);
  // selling the weapon in your hand leaves you with fists
  await give(s.c.id, "wpn_iron_sword", 1, true);
  c = await me(s);
  assert.equal(c.weapon, "Iron Sword");
  r = await sell(c.items.find((x) => x.def === "wpn_iron_sword").uid, 1);
  assert.equal(r.crowns, c.crowns + Math.floor(ITEMS.wpn_iron_sword.value * 0.4));
  assert.equal((await me(s)).weapon, "Fists");
});

test("B7 quests: start rules, steps checked by the server, rewards paid exactly once", async () => {
  const s = await setup("Quester");
  const quest = (id, op) => call("vm_quest", { ...s.args, p_quest: id, p_op: op });
  const charFlag = (f) => call("vm_char_flag", { ...s.p, p_char: s.c.id, p_flag: f });
  await assert.rejects(quest("q_nope", "start"), /Unknown quest/);
  await assert.rejects(quest("q_bell", "dance"), /Unknown quest action/);
  await assert.rejects(quest("q_bell", "step"), /do not have that quest/);
  await assert.rejects(quest("q_cookie", "start"), /another quest comes first/);
  // the Bell Rang: cflag, have (any edge), cflag
  let r = await quest("q_bell", "start");
  assert.deepEqual(r.quests.q_bell, { s: 0, b: 0, done: false });
  await assert.rejects(quest("q_bell", "start"), /already have/);
  await assert.rejects(quest("q_bell", "step"), (e) => e.message === "not yet");
  await charFlag("talked");
  r = await quest("q_bell", "step");
  assert.equal(r.step, 1);
  await assert.rejects(quest("q_bell", "step"), /not yet/);
  await give(s.c.id, "wpn_iron_axe");
  r = await quest("q_bell", "step");
  assert.equal(r.step, 2);
  assert.equal(count(r.items, "wpn_iron_axe"), 1, "'have' takes nothing");
  await assert.rejects(quest("q_bell", "step"), /not yet/);
  await charFlag("ember");
  const pre = await me(s);
  r = await quest("q_bell", "step");
  const bell = QUESTS.find((q) => q.id === "q_bell").rewards;
  assert.equal(r.done, true);
  assert.equal(r.xp, pre.xp + bell.xp);
  assert.equal(r.xp_gained, bell.xp);
  assert.equal(r.crowns, pre.crowns + bell.crowns);
  assert.equal(r.level, levelOf(r.xp));
  await assert.rejects(quest("q_bell", "step"), /done/);
  await assert.rejects(quest("q_bell", "start"), /already have/);
  assert.equal((await me(s)).xp, r.xp, "paid once");
  // Wolves at Dusk: kills count from the moment the step begins
  await call("vm_loot", { ...s.args, p_mob: "w1" });
  r = await quest("q_wolves", "start");
  assert.equal(r.quests.q_wolves.b, 1);
  await assert.rejects(quest("q_wolves", "step"), /not yet/);
  for (const k of ["w2", "w3", "w4", "w5"]) await call("vm_loot", { ...s.args, p_mob: k });
  await assert.rejects(quest("q_wolves", "step"), /not yet/, "four is not five");
  await call("vm_loot", { ...s.args, p_mob: "w6" });
  r = await quest("q_wolves", "step");
  assert.equal(r.step, 1);
  const leather = count(r.items, "mat_leather");
  r = await quest("q_wolves", "step");
  assert.equal(r.done, true);
  assert.equal(count(r.items, "mat_leather"), leather + 2);
  // Smoke and Bees: 'give' takes the items, and only when all are there
  r = await quest("q_penn", "start");
  await give(s.c.id, "mat_fibre", 3);
  await assert.rejects(quest("q_penn", "step"), /not yet/);
  assert.equal(count((await me(s)).items, "mat_fibre"), 3);
  await give(s.c.id, "mat_fibre", 1);
  r = await quest("q_penn", "step");
  assert.equal(r.done, true);
  assert.equal(count(r.items, "mat_fibre"), 0);
  // Caller Cookie: reach (a zone), flags, then the boss; a veteran's later step carries them past the rest
  r = await quest("q_cookie", "start");
  await assert.rejects(quest("q_cookie", "step"), /not yet/, "not in the castle");
  await place(s.c.id, s.w.id, "castle", 0, 10);
  r = await quest("q_cookie", "step");
  assert.equal(r.step, 1);
  await assert.rejects(quest("q_cookie", "step"), /not yet/);
  await call("vm_world_flag", { ...s.args, p_flag: "slab" });
  r = await quest("q_cookie", "step");
  assert.equal(r.step, 2);
  await assert.rejects(quest("q_cookie", "step"), /not yet/, "the rocking horse still rocks");
  await db.exec(`insert into vm_grants (world_id, boss, character_id) values ('${s.w.id}', 'cookie', '${s.c.id}')`);
  r = await quest("q_cookie", "step");
  assert.equal(r.step, 3, "already paid for Cookie here: the horse no longer matters");
  r = await quest("q_cookie", "step");
  assert.equal(r.done, true);
});

test("B8 quests: reach with a radius, level steps, skip-ahead, start flags, double taps", async () => {
  const s = await setup("Wayfarer");
  const quest = (id, op) => call("vm_quest", { ...s.args, p_quest: id, p_op: op });
  const define = (id, steps, extra = {}) =>
    db.pg.query("insert into vm_quests (id, def) values ($1, $2::jsonb) on conflict (id) do update set def = excluded.def",
      [id, JSON.stringify({ id, name: id, requires: [], level: 1, steps, rewards: { xp: 0, crowns: 0, items: [] }, ...extra })]);
  // reach within r + 8 of a point in the zone (the beacon on the Kingdom's hill)
  const beacon = QUESTS.find((q) => q.id === "q_patrol").steps[0];
  await define("t_reach", [beacon]);
  await quest("t_reach", "start");
  await place(s.c.id, s.w.id, "kingdom", beacon.x + beacon.r + 8.5, beacon.z);
  await assert.rejects(quest("t_reach", "step"), /not yet/);
  await place(s.c.id, s.w.id, "hunt", beacon.x, beacon.z);
  await assert.rejects(quest("t_reach", "step"), /not yet/, "the right spot in the wrong zone");
  await place(s.c.id, s.w.id, "kingdom", beacon.x + beacon.r + 7.5, beacon.z);
  assert.equal((await quest("t_reach", "step")).done, true);
  // level, and a later level step lets you past an earlier one
  await define("t_level", [{ k: "kill", kind: "wolf", n: 99 }, { k: "level", n: 3 }], { rewards: { xp: 5, crowns: 0, items: [] } });
  await quest("t_level", "start");
  await assert.rejects(quest("t_level", "step"), /not yet/);
  await setXp(s.c.id, LEVEL_XP[2]);
  assert.equal((await quest("t_level", "step")).step, 1, "level 3 skips the 99 wolves");
  const done = await quest("t_level", "step");
  assert.equal(done.done, true);
  assert.equal(done.xp, LEVEL_XP[2] + 5);
  // a '|' list wants n of any ONE of its items (as the client judges it); a 'give' passed by skip-ahead takes nothing
  await define("t_give", [{ k: "give", item: "mat_bone|mat_leather", n: 3 }, { k: "give", item: "mat_stone", n: 1 }, { k: "cflag", flag: "voss" }]);
  await give(s.c.id, "mat_bone", 2);
  await give(s.c.id, "mat_leather", 2);
  await give(s.c.id, "mat_stone", 2);
  await quest("t_give", "start");
  await assert.rejects(quest("t_give", "step"), /not yet/, "two bone and two leather are not three of either");
  await give(s.c.id, "mat_leather", 3);
  let r = await quest("t_give", "step");
  assert.deepEqual([count(r.items, "mat_bone"), count(r.items, "mat_leather")], [2, 2]);
  await call("vm_char_flag", { ...s.p, p_char: s.c.id, p_flag: "voss" });
  r = await quest("t_give", "step");
  assert.equal(count(r.items, "mat_stone"), 2, "skipped, not taken");
  // a start flag: the Castellan's writ opens the causeway (which nobody can open by hand)
  await assert.rejects(call("vm_world_flag", { ...s.args, p_flag: "causeway" }), /not yours/);
  await db.exec(`update vm_characters set quests = quests || '{"q_collar": {"s": 5, "b": 0, "done": true}}' where id = '${s.c.id}'`);
  await assert.rejects(quest("q_causeway", "start"), /another quest comes first/);
  await db.exec(`update vm_characters set quests = quests || '{"q_oath": {"s": 2, "b": 0, "done": true}}' where id = '${s.c.id}'`);
  await setXp(s.c.id, LEVEL_XP[6]);
  await assert.rejects(quest("q_causeway", "start"), /level 8/);
  await setXp(s.c.id, LEVEL_XP[7]);
  r = await quest("q_causeway", "start");
  assert.equal(r.quests.q_causeway.s, 0);
  assert.equal((await one("select flags from vm_worlds where id = $1", [s.w.id])).flags.causeway, true);
  // the kill baseline is taken when a kill step begins, not when the quest starts
  await place(s.c.id, s.w.id, "mire", 0, 140);
  await quest("q_causeway", "step");
  await quest("q_causeway", "step");
  await give(s.c.id, "herb_rotcap", 3);
  await call("vm_loot", { ...s.args, p_mob: "md1" });
  r = await quest("q_causeway", "step");
  assert.equal(r.quests.q_causeway.s, 3);
  assert.equal(r.quests.q_causeway.b, 1, "the drowned laid to rest before this step do not count");
  // a double tap on the last step pays once
  await define("t_tap", [{ k: "talk", npc: "x" }], { rewards: { xp: 0, crowns: 50, items: [["mat_bone", 2]] } });
  await quest("t_tap", "start");
  const c0 = await me(s);
  const taps = await Promise.allSettled([quest("t_tap", "step"), quest("t_tap", "step")]);
  assert.deepEqual(taps.map((t) => t.status).sort(), ["fulfilled", "rejected"]);
  const c1 = await me(s);
  assert.equal(c1.crowns, c0.crowns + 50);
  assert.equal(count(c1.items, "mat_bone"), count(c0.items, "mat_bone") + 2);
});

test("B9 shrines are found by standing at them; travel runs between found shrines", async () => {
  const s = await setup("Pilgrim");
  const shrine = (id) => SHRINES.find((x) => x.id === id);
  const travel = (id) => call("vm_travel", { ...s.args, p_shrine: id });
  const flag = (f) => call("vm_member_flag", { ...s.args, p_flag: f });
  await assert.rejects(travel("harrenvale"), /not found that shrine/);
  await assert.rejects(travel("hearthfen"), /Travel from a shrine/, "no saved position");
  await assert.rejects(travel("nowhere"), /Unknown shrine/);
  // found by standing there, in its zone
  const hv = shrine("harrenvale");
  await assert.rejects(flag("sh_harrenvale"), /Too far/);
  await place(s.c.id, s.w.id, "over", hv.x, hv.z);
  await assert.rejects(flag("sh_harrenvale"), /Too far/, "same spot, wrong zone");
  await place(s.c.id, s.w.id, "kingdom", hv.x + 13, hv.z);
  let r = await flag("sh_harrenvale");
  assert.equal(r.flags.sh_harrenvale, true);
  await assert.rejects(flag("sh_atlantis"), /Unknown flag/);
  // Hearthfen is known to everyone; travel from a found shrine, arriving 1.5 m in front of the target
  r = await travel("hearthfen");
  const hf = shrine("hearthfen");
  assert.equal(r.zone, "over");
  assert.ok(Math.abs(r.x - hf.x) < 1e-3 && Math.abs(r.z - (hf.z + 1.5)) < 1e-3);
  const m = await one("select zone, dungeon, x, z, extract(epoch from now() - pos_at) as age from vm_members where character_id = $1", [s.c.id]);
  assert.deepEqual([m.zone, m.dungeon], ["over", false]);
  assert.ok(Number(m.age) < 1);
  // the next heartbeat walks on from there
  r = await call("vm_heartbeat", { ...s.args, p_x: hf.x + 1, p_z: hf.z + 2, p_yaw: 0, p_hp: 100, p_play: 1, p_zone: "over" });
  assert.equal(r.ok, true);
  r = await travel("harrenvale");
  assert.deepEqual([r.zone, Math.round(r.x * 10) / 10, Math.round(r.z * 10) / 10], ["kingdom", ZONES.kingdom.ox + hv.x, hv.z + 1.5]);
  // not from open country, nor from a shrine you have not found
  await place(s.c.id, s.w.id, "kingdom", 60, 60);
  await assert.rejects(travel("hearthfen"), /Travel from a shrine/);
  const lodge = shrine("lodge");
  await place(s.c.id, s.w.id, "hunt", lodge.x, lodge.z);
  await assert.rejects(travel("hearthfen"), /Travel from a shrine/);
  await assert.rejects(travel("lodge"), /not found that shrine/);
});

test("B10 caches open once, where they stand; legacy member flags still work", async () => {
  const s = await setup("Looter");
  const flag = (f) => call("vm_member_flag", { ...s.args, p_flag: f });
  await assert.rejects(flag("chest"), /Too far/);
  await place(s.c.id, s.w.id, "over", -7.9 + 10, -15.6);
  let r = await flag("chest");
  assert.equal(r.drops.length, 3);
  r = await flag("chest");
  assert.equal(r.drops.length, 0, "once per character per world");
  // a kingdom cache, with crowns in it
  await place(s.c.id, s.w.id, "over", -96, -58);
  await assert.rejects(flag("mill_loft"), /Too far/, "same spot, wrong zone");
  await place(s.c.id, s.w.id, "kingdom", -96, -58);
  r = await flag("mill_loft");
  assert.equal(count(r.items, "coin_crown"), 40);
  assert.equal((await me(s)).crowns, 40);
  await flag("mill_loft");
  assert.equal((await me(s)).crowns, 40);
  // legacy marks need no position
  await db.exec(`update vm_members set x = null, z = null where character_id = '${s.c.id}'`);
  r = await flag("shrine");
  assert.equal(r.flags.shrine, true);
  r = await flag("entered");
  assert.equal(r.flags.entered, true);
  await assert.rejects(flag("nope"), /Unknown flag/);
});

test("B11 world flags follow their rules", async () => {
  const s = await setup("Opener");
  const flag = (f) => call("vm_world_flag", { ...s.args, p_flag: f });
  assert.equal((await flag("slab")).slab, true);
  await assert.rejects(flag("nursery"), /will not budge/);
  await call("vm_loot", { ...s.args, p_mob: "dh" });
  assert.equal((await flag("nursery")).nursery, true);
  await assert.rejects(flag("gate"), /does not answer/);
  await assert.rejects(flag("kennel_gate"), /will not budge/);
  await call("vm_loot", { ...s.args, p_mob: "knm" });
  assert.equal((await flag("kennel_gate")).kennel_gate, true);
  await assert.rejects(flag("crypt"), /does not answer/);
  await assert.rejects(flag("armoury"), /will not budge/);
  await call("vm_loot", { ...s.args, p_mob: "kk1" });
  assert.equal((await flag("armoury")).armoury, true);
  assert.equal((await flag("crypt")).crypt, true);
  assert.equal((await flag("kennel_plates")).kennel_plates, true);
  for (const f of ["cookie", "boe", "finlay", "causeway"]) await assert.rejects(flag(f), /not yours/, f);
  await assert.rejects(flag("anything"), /Unknown flag/);
  // a foe that has since come back still counts (any expiry)
  const t = await setup("Late");
  await db.exec(`update vm_worlds set dead_mobs = '{"dh": "2000-01-01T00:00:00Z"}' where id = '${t.w.id}'`);
  assert.equal((await call("vm_world_flag", { ...t.args, p_flag: "nursery" })).nursery, true);
});

test("B12 the local dev server still serves the realm and /dev/give", async () => {
  const port = 21000 + Math.floor(Math.random() * 20000);
  const child = spawn(process.execPath, ["--experimental-strip-types", new URL("./dev-server.mjs", import.meta.url).pathname, "--port", String(port)],
    { stdio: ["ignore", "pipe", "pipe"] });
  try {
    await new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error("the dev server did not start")), 60000);
      child.stdout.on("data", (d) => {
        if (String(d).includes("local realm on")) {
          clearTimeout(t);
          resolve();
        }
      });
      child.on("exit", (code) => reject(new Error("the dev server exited with " + code)));
    });
    const post = async (path, body) => {
      const res = await fetch(`http://127.0.0.1:${port}${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      return { status: res.status, text: await res.text() };
    };
    const rpc = async (fn, args) => JSON.parse((await post("/rpc/" + fn, args)).text);
    const secret = "dev-server-secret-0123456789abcdef";
    const id = (await rpc("vm_register", { p_secret: secret })).data;
    const ch = (await rpc("vm_create_character", { p_player: id, p_secret: secret, p_name: "Dev", p_look: {} })).data;
    assert.equal((await post("/dev/give", { char: ch.id, def: "coin_crown", n: 75 })).status, 200);
    assert.equal((await post("/dev/give", { char: ch.id, def: "wpn_iron_sword", equip: true })).status, 200);
    const after = (await rpc("vm_character", { p_player: id, p_secret: secret, p_char: ch.id })).data;
    assert.equal(after.crowns, 75);
    assert.equal(after.weapon, "Iron Sword");
    const err = await rpc("vm_travel", { p_player: id, p_secret: secret, p_world: ch.id, p_char: ch.id, p_shrine: "hearthfen" });
    assert.match(err.error, /Not in this world/, "the new API is served");
    // /dev/place puts a saved position (world coordinates, with its zone) where a test wants it
    const me2 = { p_player: id, p_secret: secret };
    const w = (await rpc("vm_create_world", { ...me2, p_name: "Dev" })).data;
    await rpc("vm_enter", { ...me2, p_world: w.id, p_char: ch.id });
    assert.equal((await post("/dev/place", { char: ch.id, x: ZONES.kingdom.ox - 18, z: 14, zone: "kingdom" })).status, 200);
    const bought = (await rpc("vm_buy", { ...me2, p_world: w.id, p_char: ch.id, p_shop: "hv_holt", p_item: "mat_iron", p_n: 2 })).data;
    assert.equal(bought.crowns, 75 - 2 * 14);
  } finally {
    child.kill();
  }
});

test("B13 an old local save cannot bring crowns or repeat a stack past the cap", async () => {
  const a = await player();
  const items = [{ def: "coin_crown", count: 20 }, ...Array.from({ length: 30 }, () => ({ def: "mat_copper", count: 20 }))];
  const c = await call("vm_import_character", { ...a, p_payload: { source: "slot0:Smuggler", name: "Smuggler", items } });
  assert.equal(c.crowns, 0);
  assert.equal(count(c.items, "mat_copper"), 20, "twenty in all, however often the save lists it");
  assert.equal(c.xp, 0, "experience is earned in a world");
});

test("B14 an older realm database is migrated in place, and the schema re-applies cleanly", async () => {
  const read = (f) => readFileSync(new URL(f, import.meta.url), "utf8");
  const pg = new PGlite();
  const rpc = async (fn, args = {}) => {
    const names = Object.keys(args);
    const sql = `select ${fn}(${names.map((k, i) => `${k} => $${i + 1}`).join(", ")}) as r`;
    const res = await pg.query(sql, names.map((k) => (args[k] !== null && typeof args[k] === "object" ? JSON.stringify(args[k]) : args[k])));
    return res.rows[0]?.r ?? null;
  };
  const row = async (sql, params) => (await pg.query(sql, params)).rows[0];
  // ---- the previous release, with players in it
  await pg.exec(read("./fixtures/v1-schema.sql"));
  await pg.exec(read("./fixtures/v1-seed.sql"));
  const A = { p_secret: "migrate-secret-aaaaaaaaaaaaaaaaaaaa" };
  A.p_player = await rpc("vm_register", A);
  const B = { p_secret: "migrate-secret-bbbbbbbbbbbbbbbbbbbb" };
  B.p_player = await rpc("vm_register", B);
  const ca = await rpc("vm_create_character", { ...A, p_name: "Veteran", p_look: {} });
  const cb = await rpc("vm_create_character", { ...B, p_name: "Friend", p_look: {} });
  const w = await rpc("vm_create_world", { ...A, p_name: "Old Realm" });
  await rpc("vm_enter", { ...A, p_world: w.id, p_char: ca.id });
  await rpc("vm_join", { ...B, p_code: w.code, p_char: cb.id });
  await rpc("vm_heartbeat", { ...A, p_world: w.id, p_char: ca.id, p_x: 1200, p_z: 100, p_yaw: 0, p_dungeon: true, p_hp: 100, p_play: 1 });
  await rpc("vm_heartbeat", { ...B, p_world: w.id, p_char: cb.id, p_x: 0, p_z: 0, p_yaw: 0, p_dungeon: false, p_hp: 100, p_play: 1 });
  await rpc("vm_loot", { ...A, p_world: w.id, p_char: ca.id, p_mob: "w1" });
  for (const k of ["w2", "w3", "w4"]) await rpc("vm_loot", { ...B, p_world: w.id, p_char: cb.id, p_mob: k });
  await pg.query("insert into vm_grants (world_id, boss, character_id) values ($1, 'cookie', $2), ($1, 'cookie', $3)", [w.id, ca.id, cb.id]);
  await pg.query("update vm_characters set mana_max = 30 where id = $1", [ca.id]);
  const itemsA = (await rpc("vm_character", { ...A, p_char: ca.id })).items;
  // ---- upgrade: schema, then seed (the order every path applies them in)
  await pg.exec(read("./schema.sql"));
  await pg.exec(read("./seed.sql"));
  assert.equal((await row("select zone from vm_members where character_id = $1", [ca.id])).zone, "castle");
  assert.equal((await row("select zone from vm_members where character_id = $1", [cb.id])).zone, "over");
  const xpA = 1 * 12 + 400;
  const xpB = 3 * 12 + 400;
  let ra = await row("select xp, kill_counts, quests from vm_characters where id = $1", [ca.id]);
  assert.deepEqual([ra.xp, ra.kill_counts, ra.quests], [xpA, {}, {}]);
  assert.equal((await row("select xp from vm_characters where id = $1", [cb.id])).xp, xpB);
  // old calls keep working: a heartbeat without p_zone, a boss hit without p_boss
  const hb = await rpc("vm_heartbeat", { ...A, p_world: w.id, p_char: ca.id, p_x: 1201, p_z: 101, p_yaw: 0, p_dungeon: true, p_hp: 100, p_play: 1 });
  assert.deepEqual([hb.ok, hb.zone], [true, "castle"]);
  // entering syncs health and breath with the level, and gives the old world its new bosses
  const e = await rpc("vm_enter", { ...A, p_world: w.id, p_char: ca.id });
  assert.equal(e.member.zone, "castle");
  assert.deepEqual([e.character.level, e.character.max_hp, e.character.mana_max], [levelOf(xpA), statsFor(levelOf(xpA)).maxHp, statsFor(levelOf(xpA)).mana]);
  assert.deepEqual(e.character.items, itemsA, "the bag is untouched");
  for (const b of Object.values(BOSSES)) assert.ok(e.world.boss[b.id], b.id);
  const bh = await rpc("vm_boss_hit", { ...A, p_world: w.id, p_char: ca.id, p_heavy: true, p_fire: false, p_behind: false, p_perched: false, p_dizzy: false });
  assert.equal(bh.boss, "cookie");
  assert.ok(bh.dealt > 0);
  assert.equal((await row("select max_hp from vm_characters where id = $1", [cb.id])).max_hp, 100, "not synced until the level table was seeded");
  // ---- apply again: experience is not paid twice, stats catch up, nothing is left with two signatures
  await pg.query("update vm_characters set kills = 50 where id = $1", [ca.id]);
  await pg.exec(read("./schema.sql"));
  await pg.exec(read("./seed.sql"));
  ra = await row("select xp from vm_characters where id = $1", [ca.id]);
  assert.equal(ra.xp, xpA);
  assert.equal((await row("select max_hp from vm_characters where id = $1", [cb.id])).max_hp, statsFor(levelOf(xpB)).maxHp);
  const dup = (await pg.query(`select proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname like 'vm\\_%' group by proname having count(*) > 1`)).rows;
  assert.deepEqual(dup, []);
  await pg.close();
});
