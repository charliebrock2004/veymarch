import { PGlite } from "@electric-sql/pglite";
import schemaSql from "../../server/schema.sql?raw";
import seedSql from "../../server/seed.sql?raw";
import { newerCodex, primeCodex } from "../game/data/codex";
import { REALM_API } from "./api";
import { RealmError, type Backend, type Channel, type ChannelStatus, type PresenceMeta } from "./backend";

/**
 * Single player is a private world hosted inside the browser: the realm's own SQL
 * (server/schema.sql + seed.sql) running in PGlite, saved to IndexedDB. Every rule —
 * inventory, loot, quests, bosses — has one implementation shared with online play.
 * The schema re-applies itself when its text changes (it is written to be idempotent).
 */

const API = new Set(REALM_API);

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36) + s.length.toString(36);
}

export type SoloBackend = Backend & {
  /** The whole single player save (characters, worlds, codexes) as one file. */
  backup: () => Promise<Blob>;
  /** Replaces this device's single player save with a backup file. The page must be reloaded afterwards. */
  restore: (file: Blob) => Promise<void>;
  /** Direct SQL on this device's own world database (used to migrate old saves). */
  exec: (sql: string, params?: unknown[]) => Promise<unknown[]>;
};

/** Where the single player key is kept (see Realm.openSolo); a backup carries it so its characters are still yours. */
const SOLO_IDENT = "veyrmarch.player.solo";
const MAGIC = new TextEncoder().encode("VEYRSAVE\n");

/** A backup file is "VEYRSAVE", a line of JSON, then the database dump. */
export async function readBackup(file: Blob): Promise<{ ident: string; dump: Blob }> {
  const bad = new RealmError("That is not a Veyrmarch save file.");
  const top = new Uint8Array(await file.slice(0, 4096).arrayBuffer());
  for (let i = 0; i < MAGIC.length; i++) if (top[i] !== MAGIC[i]) throw bad;
  const end = top.indexOf(10, MAGIC.length);
  if (end < 0) throw bad;
  let head: { veyrmarch?: number; ident?: string };
  try {
    head = JSON.parse(new TextDecoder().decode(top.subarray(MAGIC.length, end)));
  } catch {
    throw bad;
  }
  if (head.veyrmarch !== 1) throw new RealmError("That save file is from a newer Veyrmarch. Update the game, then try again.");
  return { ident: typeof head.ident === "string" ? head.ident : "", dump: file.slice(end + 1) };
}

type Staged = { ident: string; dump: Blob };

/** A backup waiting to replace the save on the next page load, held in a small database of its own. */
function staged(op: "get"): Promise<Staged | null>;
function staged(op: "put", v: Staged): Promise<null>;
function staged(op: "clear"): Promise<null>;
function staged(op: "get" | "put" | "clear", v?: Staged): Promise<Staged | null> {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open("veyrmarch-restore", 1);
    open.onupgradeneeded = () => open.result.createObjectStore("s");
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const tx = db.transaction("s", op === "get" ? "readonly" : "readwrite");
      const st = tx.objectStore("s");
      const req = op === "get" ? st.get("next") : op === "put" ? st.put(v, "next") : st.delete("next");
      tx.oncomplete = () => {
        db.close();
        resolve(op === "get" ? ((req.result as Staged | undefined) ?? null) : null);
      };
      tx.onerror = tx.onabort = () => {
        db.close();
        reject(tx.error);
      };
    };
  });
}

let opened: Promise<SoloBackend> | null = null;

export function soloBackend(): Promise<SoloBackend> {
  if (opened) return opened;
  opened = (async () => {
    await holdTabLock();
    let pg: PGlite;
    try {
      const swap = await staged("get").catch(() => null);
      if (swap) {
        await new Promise<void>((resolve, reject) => {
          const req = indexedDB.deleteDatabase("/pglite/veyrmarch-solo");
          req.onsuccess = () => resolve();
          req.onerror = () => reject(req.error);
        });
        pg = new PGlite("idb://veyrmarch-solo", { relaxedDurability: true, loadDataDir: swap.dump });
        await pg.waitReady;
        await pg.query("select 1");
        try {
          const drop: string[] = [];
          for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k?.startsWith("veyrmarch.codex.")) drop.push(k);
          }
          for (const k of drop) localStorage.removeItem(k);
          if (swap.ident) localStorage.setItem(SOLO_IDENT, swap.ident);
        } catch {
          /* local storage blocked */
        }
        await staged("clear");
      } else {
        pg = new PGlite("idb://veyrmarch-solo", { relaxedDurability: true });
        await pg.waitReady;
      }
    } catch {
      // private browsing without IndexedDB: play in memory for this visit
      pg = new PGlite();
      await pg.waitReady;
    }
    const version = hash(schemaSql + seedSql);
    await pg.exec("create table if not exists vm_solo_meta (k text primary key, v text not null)");
    const have = await pg.query<{ v: string }>("select v from vm_solo_meta where k = 'schema'");
    if (have.rows[0]?.v !== version) {
      await pg.exec(schemaSql);
      await pg.exec(seedSql);
      await pg.query("insert into vm_solo_meta (k, v) values ('schema', $1) on conflict (k) do update set v = excluded.v", [version]);
    }
    let chain = Promise.resolve();
    const run = <T>(fn: () => Promise<T>) => {
      const p = chain.then(fn);
      chain = p.then(() => {}, () => {});
      return p;
    };
    // Codexes: bring the device copies into the save if they are newer, then keep the save written.
    const CODEX = "veyrmarch.codex.";
    const upsert = "insert into vm_solo_meta (k, v) values ($1, $2) on conflict (k) do update set v = excluded.v";
    const kept = new Map<string, string>();
    for (const r of (await pg.query<{ k: string; v: string }>("select k, v from vm_solo_meta where k like 'codex.%'")).rows) kept.set(r.k.slice(6), r.v);
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k?.startsWith(CODEX)) continue;
        const id = k.slice(CODEX.length);
        const best = newerCodex(kept.get(id), localStorage.getItem(k));
        if (best && best !== kept.get(id)) {
          kept.set(id, best);
          await pg.query(upsert, ["codex." + id, best]);
        }
      }
    } catch {
      /* local storage blocked: the save's own copies stand */
    }
    const waiting = new Map<string, string>();
    let timer: ReturnType<typeof setTimeout> | null = null;
    const flush = () => {
      timer = null;
      const batch = [...waiting];
      waiting.clear();
      return run(async () => {
        for (const [id, json] of batch) await pg.query(upsert, ["codex." + id, json]).catch(() => {});
      });
    };
    primeCodex(kept, (id, json) => {
      waiting.set(id, json);
      timer ??= setTimeout(() => void flush(), 500);
    });
    const backend: SoloBackend = {
      kind: "solo",
      rpc<T>(fn: string, args: Record<string, unknown>) {
        if (!API.has(fn)) return Promise.reject(new RealmError("Unknown function " + fn));
        const names = Object.keys(args).filter((k) => /^p_[a-z_]+$/.test(k));
        const sql = `select ${fn}(${names.map((k, i) => `${k} => $${i + 1}`).join(", ")}) as r`;
        const params = names.map((k) => {
          const v = args[k];
          return v !== null && typeof v === "object" ? JSON.stringify(v) : v;
        });
        return run(async () => {
          try {
            const res = await pg.query<{ r: T }>(sql, params);
            return (res.rows[0]?.r ?? null) as T;
          } catch (e) {
            const err = e as { message?: string; code?: string };
            throw new RealmError(err.message ?? String(e), err.code ?? "");
          }
        });
      },
      exec(sql, params = []) {
        return run(async () => (await pg.query(sql, params)).rows);
      },
      channel: () => soloChannel(),
      async backup() {
        if (timer) clearTimeout(timer);
        await flush();
        const dump = await run(() => pg.dumpDataDir("gzip"));
        let ident = "";
        try {
          ident = localStorage.getItem(SOLO_IDENT) ?? "";
        } catch {
          /* no key to carry */
        }
        const head = new TextEncoder().encode(JSON.stringify({ veyrmarch: 1, ident }) + "\n");
        return new Blob([MAGIC, head, dump], { type: "application/octet-stream" });
      },
      async restore(file) {
        const { ident, dump } = await readBackup(file);
        // prove the file opens as a save before anything here is touched
        const probe = new PGlite({ loadDataDir: dump });
        try {
          await probe.waitReady;
          await probe.query("select count(*) from vm_solo_meta");
        } catch {
          throw new RealmError("That file could not be opened as a Veyrmarch save. Nothing was changed.");
        } finally {
          await probe.close().catch(() => {});
        }
        // The swap happens on the next page load, before the save is opened: it cannot be cleared while in use.
        await staged("put", { ident, dump });
      },
    };
    return backend;
  })();
  opened.catch(() => (opened = null));
  return opened;
}

/**
 * One tab at a time: each tab would load its own copy of the database and write it back over
 * the other's. The lock is held for the life of the page (browsers without Web Locks skip this).
 */
function holdTabLock(): Promise<void> {
  const locks = (navigator as Navigator & { locks?: LockManager }).locks;
  if (!locks?.request) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    locks
      .request("veyrmarch-solo", { ifAvailable: true }, (lock) => {
        if (!lock) {
          reject(new RealmError("Single Player is already open in another tab or window. Close it there, then try again."));
          return undefined;
        }
        resolve();
        return new Promise<void>(() => {});
      })
      .catch(() => resolve());
  });
}

/** Nobody else is here: always connected, no presence, nothing to send. */
function soloChannel(): Channel {
  const statusFns: ((s: ChannelStatus) => void)[] = [];
  const presFns: ((l: PresenceMeta[]) => void)[] = [];
  setTimeout(() => {
    for (const f of statusFns) f("connected");
    for (const f of presFns) f([]);
  }, 0);
  return {
    send() {},
    onMessage() {},
    onPresence: (f) => void presFns.push(f),
    onStatus: (f) => void statusFns.push(f),
    track() {},
    leave() {},
  };
}
