import type { Realm } from "./realm";

/**
 * Copies characters from this device's single player saves (veyrmarch.v2.slot0..2) into the
 * player's online profile, once per slot. The local saves stay as they are, so single player is
 * untouched; the server de-duplicates by source, so a repeat never makes a second copy.
 */
export async function importLocalSaves(realm: Realm): Promise<number> {
  const pid = realm.playerId;
  let made = 0;
  for (let i = 0; i < 3; i++) {
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(`veyrmarch.v2.slot${i}`);
    } catch {
      return made;
    }
    if (!raw) continue;
    const mark = `veyrmarch.imported.${pid}.${i}`;
    let save: {
      name?: string; look?: unknown; items?: { def: string; count: number }[]; flags?: Record<string, boolean>;
      kills?: number; deaths?: number; time?: number;
    };
    try {
      save = JSON.parse(raw);
    } catch {
      continue;
    }
    const source = `slot${i}:${save.name ?? ""}`;
    try {
      if (localStorage.getItem(mark) === source) continue;
    } catch {
      /* ignore */
    }
    try {
      await realm.importCharacter({
        source, name: save.name, look: save.look, items: save.items ?? [], flags: save.flags ?? {},
        kills: Math.round(save.kills ?? 0), deaths: Math.round(save.deaths ?? 0), time: Math.round(save.time ?? 0),
      });
      made++;
      localStorage.setItem(mark, source);
    } catch {
      /* six characters already, or offline: try again next time */
    }
  }
  return made;
}

/**
 * Single player saves (veyrmarch.v2.slotN) become characters and worlds in this device's
 * private world database, once per slot: the character with its inventory, and a world with
 * the slot's progress (doors, Cookie, the Green Gate, the time of day, where you stood).
 */
export async function importLegacySolo(realm: Realm): Promise<number> {
  const backend = realm.backend as unknown as { kind: string; exec?: (sql: string, params?: unknown[]) => Promise<unknown[]> };
  if (backend.kind !== "solo" || !backend.exec) return 0;
  await realm.profile();
  const pid = realm.playerId;
  let made = 0;
  for (let i = 0; i < 3; i++) {
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(`veyrmarch.v2.slot${i}`);
    } catch {
      return made;
    }
    if (!raw) continue;
    let s: {
      name?: string; look?: unknown; items?: { def: string; count: number; equipped?: boolean }[]; flags?: Record<string, boolean>;
      kills?: number; deaths?: number; time?: number; hour?: number; x?: number; z?: number; yaw?: number; dungeon?: boolean; hp?: number; deadMobs?: string[];
    };
    try {
      s = JSON.parse(raw);
    } catch {
      continue;
    }
    const source = `slot${i}:${s.name ?? ""}`;
    const mark = `veyrmarch.solo.imported.${pid}.${i}`;
    try {
      if (localStorage.getItem(mark) === source) continue;
    } catch {
      /* ignore */
    }
    try {
      const f = s.flags ?? {};
      const c = await realm.importCharacter({
        source, name: s.name, look: s.look, items: s.items ?? [], flags: f,
        kills: Math.round(s.kills ?? 0), deaths: Math.round(s.deaths ?? 0), time: Math.round(s.time ?? 0),
      });
      // this device's own database: restore the save exactly (the shared import keeps only early gear)
      await backend.exec("delete from vm_items where character_id = $1::uuid", [c.id]);
      for (const it of s.items ?? []) await backend.exec("select vm_add_item($1::uuid, $2, $3)", [c.id, it.def, Math.min(99, Math.max(1, it.count | 0))]);
      for (const it of (s.items ?? []).filter((x) => x.equipped)) await backend.exec("select vm_equip_def($1::uuid, $2)", [c.id, it.def]);
      await backend.exec(
        "update vm_characters set flags = flags || $2::jsonb, mana_max = $3, kills = $4, deaths = $5, play_seconds = $6 where id = $1::uuid",
        [c.id, JSON.stringify({ talked: !!f.talked, ember: !!f.ember, cookie: !!f.cookie, voss: !!f.voss, ended: !!f.ended }), f.ember ? 30 : 0, s.kills ?? 0, s.deaths ?? 0, Math.round(s.time ?? 0)],
      );
      const w = await realm.createWorld(`${s.name ?? "Walker"}'s Hearthfen`);
      await realm.enter(w.id, c.id);
      const worldFlags = Object.fromEntries(["slab", "nursery", "cookie", "gate"].filter((k) => f[k]).map((k) => [k, true]));
      const dead = Object.fromEntries((s.deadMobs ?? []).map((k) => [k, null]));
      await backend.exec(
        `update vm_worlds set flags = flags || $2::jsonb, dead_mobs = dead_mobs || $3::jsonb, hour = $4,
           boss = case when ($2::jsonb ? 'cookie') then boss || jsonb_build_object('cookie', coalesce(boss->'cookie', '{}'::jsonb) || '{"hp":0,"dead":true}'::jsonb) else boss end
         where id = $1::uuid`,
        [w.id, JSON.stringify(worldFlags), JSON.stringify(dead), s.hour ?? 7.3],
      );
      const memberFlags = Object.fromEntries(["chest", "hollow", "shrine", "entered"].filter((k) => f[k]).map((k) => [k, true]));
      await backend.exec(
        `update vm_members set x = $3, z = $4, yaw = $5, dungeon = $6, flags = $7::jsonb where world_id = $1::uuid and character_id = $2::uuid`,
        [w.id, c.id, s.x ?? null, s.z ?? null, s.yaw ?? 0, !!s.dungeon, JSON.stringify(memberFlags)],
      );
      if (f.cookie) await backend.exec("insert into vm_grants (world_id, boss, character_id) values ($1::uuid, 'cookie', $2::uuid) on conflict do nothing", [w.id, c.id]);
      made++;
      localStorage.setItem(mark, source);
    } catch {
      /* try again next time */
    }
  }
  return made;
}
