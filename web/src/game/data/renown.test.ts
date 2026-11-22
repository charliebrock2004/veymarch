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
