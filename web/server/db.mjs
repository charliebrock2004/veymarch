// An in-process Postgres (PGlite) running the same schema and functions as the hosted Supabase
// project. Used by the local realm server and the tests.
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

/** The functions a client may call; everything else is internal. */
export const API = new Set([
  "vm_register", "vm_profile", "vm_create_character", "vm_import_character", "vm_delete_character", "vm_character",
  "vm_create_world", "vm_join", "vm_enter", "vm_heartbeat", "vm_leave", "vm_gather", "vm_craft", "vm_equip", "vm_use", "vm_trade",
  "vm_loot", "vm_world_flag", "vm_char_flag", "vm_member_flag", "vm_boss_hit", "vm_boss_reset", "vm_died",
]);

export async function openDb(dataDir) {
  const pg = new PGlite(dataDir);
  await pg.exec(readFileSync(join(here, "schema.sql"), "utf8"));
  await pg.exec(readFileSync(join(here, "seed.sql"), "utf8"));
  let chain = Promise.resolve();
  return {
    pg,
    exec: (sql) => pg.exec(sql),
    /** Calls fn with named arguments, the way PostgREST does. One call at a time, like a single connection. */
    rpc(fn, args = {}) {
      if (!API.has(fn) || !/^[a-z_]+$/.test(fn)) return Promise.reject(new Error("Unknown function " + fn));
      const names = Object.keys(args).filter((k) => /^p_[a-z_]+$/.test(k));
      const sql = `select ${fn}(${names.map((k, i) => `${k} => $${i + 1}`).join(", ")}) as r`;
      const params = names.map((k) => {
        const v = args[k];
        return v !== null && typeof v === "object" ? JSON.stringify(v) : v;
      });
      const run = chain.then(async () => {
        const res = await pg.query(sql, params);
        return res.rows[0]?.r ?? null;
      });
      chain = run.catch(() => {});
      return run;
    },
  };
}
