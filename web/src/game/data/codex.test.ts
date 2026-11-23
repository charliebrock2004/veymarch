import assert from "node:assert/strict";
import { test } from "node:test";
import { freshCodex, loadCodex, newerCodex, primeCodex, saveCodex } from "./codex.ts";

const mem = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => void mem.set(k, v),
};

test("the copy saved last wins, and a stamped copy beats an unstamped one", () => {
  const old = JSON.stringify({ at: 100, nd: ["a"] });
  const late = JSON.stringify({ at: 200, nd: ["a", "b"] });
  const bare = JSON.stringify({ nd: [] });
  assert.equal(newerCodex(old, late), late);
  assert.equal(newerCodex(late, old), late);
  assert.equal(newerCodex(bare, old), old);
  assert.equal(newerCodex(old, bare), old);
  assert.equal(newerCodex(null, bare), bare);
  assert.equal(newerCodex(bare, undefined), bare);
  assert.equal(newerCodex(null, null), null);
  assert.equal(newerCodex("not json", old), old);
  assert.equal(newerCodex(old, "{broken"), old);
});

test("a codex from before the save held it still loads from the device", () => {
  mem.clear();
  primeCodex([], null);
  mem.set("veyrmarch.codex.c1", JSON.stringify({ mg: ["v_over_quarry"] }));
  const c = loadCodex("c1");
  assert.deepEqual(c.mg, ["v_over_quarry"]);
  assert.deepEqual(Object.keys(freshCodex()).filter((k) => !(k in c)), []);
});

test("a codex held only in the save loads on a device that has never seen it", () => {
  mem.clear();
  primeCodex([["c2", JSON.stringify({ at: 5, nd: ["g_waste_tam"] })]], null);
  assert.deepEqual(loadCodex("c2").nd, ["g_waste_tam"]);
  assert.equal(loadCodex("other").nd, undefined);
});

test("saving stamps the record and writes it to both the device and the save", () => {
  mem.clear();
  const wrote: [string, string][] = [];
  primeCodex([], (id, json) => void wrote.push([id, json]));
  const c = loadCodex("c3");
  c.nd = ["g_waste_maren"];
  saveCodex("c3", c);
  assert.ok((c.at ?? 0) > 0);
  assert.equal(wrote.length, 1);
  assert.equal(wrote[0][0], "c3");
  assert.equal(mem.get("veyrmarch.codex.c3"), wrote[0][1]);
  mem.clear();
  assert.deepEqual(loadCodex("c3").nd, ["g_waste_maren"]);
});
