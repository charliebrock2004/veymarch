import assert from "node:assert/strict";
import { test } from "node:test";
import { QUESTS } from "../data/quests.ts";
import { ITEMS } from "../data/items.ts";
import { NODE_DEFS, MOB_LOOT, MOB_SPAWNS } from "../data/world.ts";
import { PORTALS, ZONES, SHRINES, STATIONS } from "../data/zones.ts";
import { SHOPS } from "../data/shops.ts";
import { BOSSES, bossHp } from "../data/bosses.ts";
import { LEVEL_XP, levelOf, MOB_XP } from "../data/progression.ts";
import { RECIPES } from "../data/items.ts";
import { autoStarts, aheadDone, journal, looksDone, nextWork, npcBusiness, readyToStep, tracked, type QuestBook, type QuestCtx } from "./quests.ts";

const ctx = (o: Partial<QuestCtx> = {}): QuestCtx => ({
  level: 1, zone: "over", x: 0, z: 0, count: () => 0, charFlag: () => false, worldFlag: () => false, kills: () => 0, boss: () => false, ...o,
});

test("a new character starts on the bell, and only the bell", () => {
  assert.deepEqual(autoStarts({}, 1), ["q_bell"]);
  const book: QuestBook = { q_bell: { s: 0, b: 0, done: false } };
  assert.equal(tracked(book)?.id, "q_bell");
  assert.deepEqual(autoStarts(book, 1), []);
  assert.deepEqual(autoStarts({ q_bell: { s: 3, b: 0, done: true } }, 1), ["q_cookie"]);
});

test("steps are judged from what the client can see", () => {
  const bell = QUESTS.find((q) => q.id === "q_bell")!;
  const edge = bell.steps[1];
  assert.equal(looksDone(edge, { s: 1, b: 0, done: false }, ctx()), false);
  // any edge counts, not only the knife
  assert.equal(looksDone(edge, { s: 1, b: 0, done: false }, ctx({ count: (id) => (id === "wpn_copper_sword" ? 1 : 0) })), true);
  const oath = QUESTS.find((q) => q.id === "q_oath")!;
  // kills count from when the step began
  assert.equal(looksDone(oath.steps[0], { s: 0, b: 3, done: false }, ctx({ kills: () => 7 })), false);
  assert.equal(looksDone(oath.steps[0], { s: 0, b: 3, done: false }, ctx({ kills: () => 8 })), true);
});

test("a veteran who already beat Cookie is not sent back to the castle door", () => {
  const book: QuestBook = { q_bell: { s: 3, b: 0, done: true }, q_cookie: { s: 0, b: 0, done: false } };
  const vet = ctx({ boss: (id) => id === "cookie", worldFlag: (f) => f === "cookie" || f === "slab" || f === "nursery" });
  assert.equal(aheadDone(QUESTS.find((q) => q.id === "q_cookie")!, book.q_cookie, vet), true);
  assert.deepEqual(readyToStep(book, vet), ["q_cookie"]);
});

test("NPCs offer quests, then take what they asked for", () => {
  const book: QuestBook = { q_gate: { s: 3, b: 0, done: true }, q_bell: { s: 3, b: 0, done: true }, q_cookie: { s: 4, b: 0, done: true } };
  const off = npcBusiness(book, "holt", 4, ctx());
  assert.equal(off?.kind, "offer");
  assert.equal(off?.kind === "offer" && off.quest.id, "q_coal");
  const active: QuestBook = { ...book, q_coal: { s: 0, b: 0, done: false } };
  const step = npcBusiness(active, "holt", 4, ctx({ count: (id) => (id === "mat_coal" ? 2 : 0) }));
  assert.equal(step?.kind === "step" && step.ready, false);
  const ready = npcBusiness(active, "holt", 4, ctx({ count: (id) => (id === "mat_coal" ? 4 : 0) }));
  assert.equal(ready?.kind === "step" && ready.ready, true);
  assert.ok(journal(active, ctx()).some((j) => j.id === "q_coal" && j.progress === "0/4"));
});

test("shared data is consistent: every id points at something real", () => {
  const item = (id: string) => assert.ok(ITEMS[id], "unknown item " + id);
  for (const q of QUESTS) {
    for (const r of q.requires) assert.ok(QUESTS.some((x) => x.id === r), q.id + " requires unknown " + r);
    for (const s of q.steps) {
      if (s.item) for (const id of s.item.split("|")) item(id);
      if (s.boss) assert.ok(BOSSES[s.boss], "unknown boss " + s.boss);
      if (s.zone) assert.ok(ZONES[s.zone], "unknown zone " + s.zone);
      if (s.kind) assert.ok(MOB_XP[s.kind] !== undefined, "no xp for " + s.kind);
    }
    for (const [id] of q.rewards.items) item(id);
  }
  for (const r of RECIPES) {
    item(r.out);
    for (const i of r.inputs) item(i.id);
  }
  for (const s of SHOPS) for (const [id] of s.stock) item(id);
  for (const b of Object.values(BOSSES)) for (const [id] of b.rewards) item(id);
  for (const [kind, list] of Object.entries(MOB_LOOT)) {
    assert.ok(MOB_XP[kind] !== undefined, "no xp for " + kind);
    for (const [id] of list) item(id);
  }
  for (const [, kind, , , zone] of MOB_SPAWNS) {
    assert.ok(MOB_LOOT[kind], "no loot table for " + kind);
    assert.ok(ZONES[zone]);
  }
  for (const n of NODE_DEFS) item(n.item);
  for (const p of PORTALS) assert.ok(ZONES[p.from] && ZONES[p.to]);
  for (const s of [...SHRINES, ...STATIONS]) assert.ok(ZONES[s.zone]);
  const keys = MOB_SPAWNS.map((s) => s[0]);
  assert.equal(new Set(keys).size, keys.length, "spawn keys are unique");
});

test("levels and boss health scale sensibly", () => {
  assert.equal(levelOf(0), 1);
  assert.equal(levelOf(LEVEL_XP[1]), 2);
  assert.equal(levelOf(1e9), 20);
  assert.equal(bossHp(BOSSES.cookie, 1), 280);
  assert.equal(bossHp(BOSSES.cookie, 4), Math.round(280 * 2.8));
  assert.ok(bossHp(BOSSES.cookie, 4) < 280 * 4, "not four times");
});

// Between quests the HUD used to fall back to the old slice's "Walk the wheat · Harrenvale road,
// to Castellan Voss", pointing outside Harrenvale and waiting on a flag nothing sets.
const done = (...ids: string[]): QuestBook => Object.fromEntries(ids.map((id) => [id, { s: 9, b: 0, done: true }]));
const homes: Record<string, string> = { tanic: "over", sera: "over", mara: "over", penn: "over", voss: "kingdom", elspeth: "kingdom", holt: "kingdom", odo: "kingdom", aldo: "kingdom", maree: "kingdom", brannoc: "kingdom", phem: "mire", liss: "mire" };
const home = (id: string) => (homes[id] ?? null) as QuestCtx["zone"] | null;

test("between quests: the Green Gate starting by itself shows its first open step", () => {
  const w = nextWork(done("q_bell", "q_cookie"), ctx({ worldFlag: (f) => f === "gate" }), home);
  assert.equal(w?.kind, "auto");
  assert.equal(w?.quest.id, "q_gate");
  assert.equal(w?.kind === "auto" && w.step.text, "Walk the Kingsroad to Harrenvale");
});

test("between quests: after the Green Gate, the Castellan's work in Harrenvale comes first", () => {
  const w = nextWork(done("q_bell", "q_cookie", "q_gate"), ctx({ level: 4, zone: "kingdom" }), home);
  assert.equal(w?.kind, "talk");
  assert.equal(w?.quest.giver, "voss");
});

test("between quests: too low for anything left, it names the nearest level and who gives the work", () => {
  const book = done("q_bell", "q_cookie", "q_gate", "q_wolves", "q_mara", "q_penn");
  const w = nextWork(book, ctx({ level: 3, zone: "kingdom" }), home);
  assert.equal(w?.kind, "level");
  assert.equal(w?.quest.level, 4);
  assert.equal(w?.quest.id, "q_oath");
});

test("between quests: Hearthfen's side work is offered when nothing else can be taken", () => {
  const w = nextWork(done("q_bell", "q_cookie", "q_gate"), ctx({ level: 3, zone: "kingdom" }), home);
  assert.equal(w?.kind, "talk");
  assert.equal(home(w!.quest.giver), "over");
});

test("between quests: nothing left, nothing shown", () => {
  assert.equal(nextWork(done(...QUESTS.map((q) => q.id)), ctx({ level: 20 }), home), null);
});
