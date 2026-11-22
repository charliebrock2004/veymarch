import test from "node:test";
import assert from "node:assert/strict";
import { freshCodex } from "./codex.ts";
import { MARKS, marksView } from "./marks.ts";
import { REMARK_IDS, remark, studyNext, studyNotes, studyRank } from "./renown.ts";

test("study rank rises with kills and a beaten boss is fully known", () => {
  assert.equal(studyRank(0, false, false), 0);
  assert.equal(studyRank(0, true, false), 1);
  assert.equal(studyRank(1, false, false), 2);
  assert.equal(studyRank(10, true, false), 3);
  assert.equal(studyRank(50, true, false), 4);
  assert.equal(studyRank(1, true, true), 4);
});

test("notes stay hidden until a creature is studied", () => {
  const f = { hp: 34, fireWeak: 1.2, loot: ["Bone"], attacks: [{ name: "pounce", tell: 0.55 }] };
  assert.deepEqual(studyNotes(2, f), []);
  assert.deepEqual(studyNotes(3, f), ["Health 34. Fire hurts it 20% more.", "Carries: Bone."]);
  assert.equal(studyNotes(4, f)[2], "Blows: pounce (0.55s warning).");
  assert.deepEqual(studyNotes(4, undefined), []);
  assert.match(studyNext(2, 4), /4\/10/);
  assert.equal(studyNext(4, 60), "");
});

test("villagers say nothing to the unmarked and remark on the strongest mark", () => {
  assert.equal(remark(marksView({ c: freshCodex(), deaths: 0 })), null);
  const c = freshCodex();
  c.k.wolf = 20;
  c.parries = 35;
  const r = remark(marksView({ c, deaths: 0 }));
  assert.equal(r?.key, "hand2");
  c.k.wolf = 80;
  assert.equal(remark(marksView({ c, deaths: 0 }))?.key, "beast2");
});

test("every mark has something said about it", () => {
  assert.deepEqual([...REMARK_IDS].sort(), MARKS.map((m) => m.id).sort());
});

test("every cache has a rumour and rumours are told once, this land first", async () => {
  const { RUMOURS, nextRumour, placesView } = await import("./renown.ts");
  const { CACHE_DEFS } = await import("./world.ts");
  assert.deepEqual(Object.keys(RUMOURS).sort(), CACHE_DEFS.filter((c) => c.id !== "chest").map((c) => c.id).sort());
  for (const c of CACHE_DEFS) if (c.id !== "chest") assert.equal(RUMOURS[c.id].zone, c.zone, c.id);
  const none = () => false;
  assert.equal(nextRumour("hunt", [], none), "lodge_cellar");
  assert.equal(nextRumour("hunt", ["lodge_cellar"], none), "hollow");
  assert.equal(nextRumour("over", [], (id) => id === "hollow"), "mill_loft");
  assert.equal(nextRumour("over", Object.keys(RUMOURS), none), null);
  const v = placesView(["hollow"], (id) => id === "mill_loft");
  assert.equal(v.find((p) => p.id === "hollow")?.heard, true);
  assert.equal(v.find((p) => p.id === "mill_loft")?.found, true);
});

test("the March names you after your strongest mark", async () => {
  const { TITLE_IDS, UNMARKED, cardView, epithet } = await import("./renown.ts");
  assert.deepEqual([...TITLE_IDS].sort(), MARKS.map((m) => m.id).sort());
  const c = freshCodex();
  assert.equal(epithet(marksView({ c, deaths: 0 })), UNMARKED);
  c.k.wolf = 80;
  c.parries = 8;
  const v = marksView({ c, deaths: 0 });
  assert.equal(epithet(v), "Beast-Blooded");
  const card = cardView(v, { level: 4, kills: 80, deaths: 0, bosses: 0, lands: 1, places: 2, placesOf: 11, dodges: 0, parries: 8 });
  assert.equal(card.title, "Beast-Blooded");
  assert.deepEqual(card.lines[1], ["Mark ranks", "3/30"]);
  assert.deepEqual(card.lines[8], ["Hidden places", "2/11"]);
});

test("each earned mark hangs a charm on the belt, bigger by rank", async () => {
  const { CHARM_IDS, charmKey, charms } = await import("./renown.ts");
  assert.deepEqual([...CHARM_IDS].sort(), MARKS.map((m) => m.id).sort());
  const c = freshCodex();
  assert.deepEqual(charms(marksView({ c, deaths: 0 })), []);
  c.k.wolf = 200;
  c.parries = 8;
  const out = charms(marksView({ c, deaths: 0 }));
  assert.equal(charmKey(out), "beast3,hand1");
  assert.equal(out[0].glow, true);
  assert.equal(out[1].glow, false);
  assert.ok(out[0].size > out[1].size);
});

test("the trophy rack has a peg for every boss and fills as they fall", async () => {
  const { TROPHY_IDS, trophies, trophyLines } = await import("./renown.ts");
  const { BOSSES } = await import("./bosses.ts");
  assert.deepEqual([...TROPHY_IDS].sort(), Object.keys(BOSSES).sort());
  assert.equal(trophyLines(trophies({})).length, 1);
  const t = trophies({ boss_cookie: 1, wolf: 9 });
  assert.deepEqual(t.map((x) => x.won), [true, false, false, false]);
  assert.match(trophyLines(t)[0], /^Cookie: /);
  assert.equal(trophyLines(t)[1], "3 pegs still empty.");
  assert.match(trophyLines(trophies({ boss_cookie: 1, boss_boe: 1, boss_finlay: 2, boss_grave_king: 1 })).at(-1)!, /Every peg is full/);
});
