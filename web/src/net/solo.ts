import { PGlite } from "@electric-sql/pglite";
import schemaSql from "../../server/schema.sql?raw";
import seedSql from "../../server/seed.sql?raw";
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
  /** Direct SQL on this device's own world database (used to migrate old saves). */
  exec: (sql: string, params?: unknown[]) => Promise<unknown[]>;
};

let opened: Promise<SoloBackend> | null = null;

export function soloBackend(): Promise<SoloBackend> {
  if (opened) return opened;
  opened = (async () => {
    await holdTabLock();
    let pg: PGlite;
    try {
      pg = new PGlite("idb://veyrmarch-solo", { relaxedDurability: true });
      await pg.waitReady;
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
