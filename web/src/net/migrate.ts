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
