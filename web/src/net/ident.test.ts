import { test } from "node:test";
import assert from "node:assert/strict";
import { ensureIdent, readIdent, type KeyStore } from "./ident.ts";

/**
 * Regression: one phone registered as two players 0.4 s apart in production, because every
 * Realm registered on its own. Registration must happen once per device key, however many
 * callers ask for it at the same time.
 */

function store(): KeyStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
}

/** A register call that answers only when told to, counting how often it was made. */
function slowRegister() {
  const calls: { secret: string; answer: (id: string) => void; fail: (e: Error) => void }[] = [];
  const register = (secret: string) => new Promise<string>((answer, fail) => calls.push({ secret, answer, fail }));
  return { calls, register };
}

const tick = () => new Promise((r) => setTimeout(r, 0));

test("callers that ask at the same time share one registration", async () => {
  const s = store();
  const r = slowRegister();
  const a = ensureIdent(s, "t1", r.register);
  const b = ensureIdent(s, "t1", r.register);
  await tick();
  assert.equal(r.calls.length, 1);
  r.calls[0].answer("player-1");
  const [ia, ib] = await Promise.all([a, b]);
  assert.equal(ia.id, "player-1");
  assert.deepEqual(ia, ib);
  assert.deepEqual(readIdent(s, "t1"), ia);
  // and later callers read the stored key without registering again
  const c = await ensureIdent(s, "t1", r.register);
  assert.deepEqual(c, ia);
  assert.equal(r.calls.length, 1);
});

test("a key stored by someone else after construction is used, not replaced", async () => {
  const s = store();
  s.setItem("t2", JSON.stringify({ id: "kept", secret: "abc" }));
  const r = slowRegister();
  const v = await ensureIdent(s, "t2", r.register);
  assert.equal(v.id, "kept");
  assert.equal(r.calls.length, 0);
});

test("online and single player keys register separately", async () => {
  const s = store();
  const r = slowRegister();
  const a = ensureIdent(s, "t3", r.register);
  const b = ensureIdent(s, "t3.solo", r.register);
  await tick();
  assert.equal(r.calls.length, 2);
  r.calls[0].answer("online");
  r.calls[1].answer("solo");
  assert.equal((await a).id, "online");
  assert.equal((await b).id, "solo");
});

test("a failed registration can be retried", async () => {
  const s = store();
  const r = slowRegister();
  const a = ensureIdent(s, "t4", r.register);
  await tick();
  r.calls[0].fail(new Error("offline"));
  await assert.rejects(a, /offline/);
  assert.equal(readIdent(s, "t4"), null);
  const b = ensureIdent(s, "t4", r.register);
  await tick();
  assert.equal(r.calls.length, 2);
  r.calls[1].answer("second-try");
  assert.equal((await b).id, "second-try");
});

test("a key the server forgot is replaced once, even with several callers", async () => {
  const s = store();
  const old = { id: "forgotten", secret: "s1" };
  s.setItem("t5", JSON.stringify(old));
  const r = slowRegister();
  const a = ensureIdent(s, "t5", r.register, old);
  const b = ensureIdent(s, "t5", r.register, old);
  await tick();
  assert.equal(r.calls.length, 1);
  r.calls[0].answer("fresh");
  assert.equal((await a).id, "fresh");
  assert.equal((await b).id, "fresh");
  // a caller still holding the forgotten key gets the new one, without a third registration
  const c = await ensureIdent(s, "t5", r.register, old);
  assert.equal(c.id, "fresh");
  assert.equal(r.calls.length, 1);
});

test("blocked storage still keeps one key for the page", async () => {
  const blocked: KeyStore = {
    getItem() {
      throw new Error("SecurityError");
    },
    setItem() {
      throw new Error("SecurityError");
    },
  };
  const r = slowRegister();
  const a = ensureIdent(blocked, "t6", r.register);
  await tick();
  r.calls[0].answer("memory-only");
  assert.equal((await a).id, "memory-only");
  assert.equal((await ensureIdent(blocked, "t6", r.register)).id, "memory-only");
  assert.equal(r.calls.length, 1);
});
