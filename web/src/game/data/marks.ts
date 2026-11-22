// Marks: the March has no classes. What a character does, often enough, leaves a mark on them,
// and each mark makes them a little better at the thing that earned it.
// Read from the codex (kept per character on this device), so an old save simply starts earning.
import type { Codex } from "./codex.ts";

export type MarkEffect = "vsBeast" | "vsUndead" | "vsMen" | "vsToys" | "parry" | "roll" | "guard" | "heavy" | "draught" | "sprint";
export type MarkCtx = { c: Codex; deaths: number };
export type MarkDef = {
  id: string;
  name: string;
  /** what earns it */
  how: string;
  /** counts needed for ranks I, II and III */
  at: [number, number, number];
  /** bonus at each rank (fractions, or seconds for parry) */
  give: [number, number, number];
  effect: MarkEffect;
  /** the bonus in words; {n} is the amount */
  boon: string;
  count: (x: MarkCtx) => number;
};

export const BEAST_KINDS = ["wolf", "hound", "boar", "blackwolf", "kennel_hound", "croc", "deer", "boss_boe"];
export const UNDEAD_KINDS = ["skeleton", "zombie", "ghost", "necromancer", "undead_knight", "standard_bearer", "grave_confessor", "crypt_dead", "drowned", "boss_grave_king"];
export const MEN_KINDS = ["goblin", "redcap", "bandit", "deserter", "kennelmaster", "witch", "black_guard", "keep_knight", "boss_finlay"];
export const TOY_KINDS = ["soldier", "mouse", "horse", "boss_cookie"];

const sum = (c: Codex, kinds: string[]) => kinds.reduce((n, k) => n + (c.k[k] ?? 0), 0);
const bosses = (c: Codex) => Object.keys(c.k).filter((k) => k.startsWith("boss_")).length;

export const MARKS: MarkDef[] = [
  { id: "beast", name: "Beast-Blooded", how: "Kill beasts of wood, hunt and mire.", at: [20, 80, 200], give: [0.08, 0.14, 0.2], effect: "vsBeast", boon: "Strikes land {n}% harder on beasts.", count: (x) => sum(x.c, BEAST_KINDS) },
  { id: "grave", name: "Gravewise", how: "Put the dead back down.", at: [20, 80, 200], give: [0.08, 0.14, 0.2], effect: "vsUndead", boon: "Strikes land {n}% harder on the dead.", count: (x) => sum(x.c, UNDEAD_KINDS) },
  { id: "men", name: "Manhunter", how: "Kill goblins, outlaws and the Keep's soldiers.", at: [20, 80, 200], give: [0.08, 0.14, 0.2], effect: "vsMen", boon: "Strikes land {n}% harder on men and goblins.", count: (x) => sum(x.c, MEN_KINDS) },
  { id: "toys", name: "Nursery-Wise", how: "Break Cookie's toys.", at: [15, 50, 120], give: [0.08, 0.14, 0.2], effect: "vsToys", boon: "Strikes land {n}% harder on toys.", count: (x) => sum(x.c, TOY_KINDS) },
  { id: "hand", name: "Still Hand", how: "Parry blows at the last moment.", at: [8, 35, 100], give: [0.03, 0.06, 0.09], effect: "parry", boon: "The parry window is {n} wider.", count: (x) => x.c.parries },
  { id: "step", name: "Ghoststep", how: "Roll through attacks that would have hit.", at: [12, 50, 150], give: [0.15, 0.25, 0.35], effect: "roll", boon: "Rolling costs {n}% less stamina.", count: (x) => x.c.dodges },
  { id: "buried", name: "Much-Buried", how: "Fall, and get back up.", at: [3, 10, 25], give: [0.03, 0.06, 0.09], effect: "guard", boon: "Blows that land hurt {n}% less.", count: (x) => Math.max(x.deaths, x.c.falls) },
  { id: "warden", name: "Warden's Bane", how: "Bring down the great foes of the March.", at: [1, 2, 4], give: [0.06, 0.12, 0.18], effect: "heavy", boon: "Heavy blows land {n}% harder.", count: (x) => bosses(x.c) },
  { id: "maker", name: "Maker's Hands", how: "Craft things at hand, bench and forge.", at: [8, 30, 80], give: [0.1, 0.2, 0.3], effect: "draught", boon: "Food and draughts heal {n}% more.", count: (x) => x.c.crafts },
  { id: "way", name: "Wayfarer", how: "Walk new lands.", at: [3, 6, 9], give: [0.15, 0.3, 0.45], effect: "sprint", boon: "Running in a fight costs {n}% less stamina.", count: (x) => x.c.z.length },
];

export const RANK_NAMES = ["", "I", "II", "III"];

export function markRank(m: MarkDef, n: number): number {
  return n >= m.at[2] ? 3 : n >= m.at[1] ? 2 : n >= m.at[0] ? 1 : 0;
}

export function markBoon(m: MarkDef, rank: number): string {
  if (rank <= 0) return "";
  const g = m.give[rank - 1];
  return m.boon.replace("{n}", m.effect === "parry" ? `${Math.round(g * 1000)} ms` : String(Math.round(g * 100)));
}

/** Every mark's bonus for this character: 0 where the mark is not yet earned. */
export function markBonuses(x: MarkCtx): Record<MarkEffect, number> {
  const out: Record<MarkEffect, number> = { vsBeast: 0, vsUndead: 0, vsMen: 0, vsToys: 0, parry: 0, roll: 0, guard: 0, heavy: 0, draught: 0, sprint: 0 };
  for (const m of MARKS) {
    const r = markRank(m, m.count(x));
    if (r > 0) out[m.effect] = m.give[r - 1];
  }
  return out;
}

/** The bonus a strike gets against one kind of foe (bosses as boss_<id>). */
export function markVs(b: Record<MarkEffect, number>, kind: string): number {
  if (BEAST_KINDS.includes(kind)) return b.vsBeast;
  if (UNDEAD_KINDS.includes(kind)) return b.vsUndead;
  if (MEN_KINDS.includes(kind)) return b.vsMen;
  if (TOY_KINDS.includes(kind)) return b.vsToys;
  return 0;
}

export type MarkView = { id: string; name: string; how: string; rank: number; boon: string; next: string; have: number; need: number };

export function marksView(x: MarkCtx): MarkView[] {
  return MARKS.map((m) => {
    const have = m.count(x);
    const rank = markRank(m, have);
    return { id: m.id, name: m.name, how: m.how, rank, boon: markBoon(m, rank), next: rank < 3 ? markBoon(m, rank + 1) : "", have, need: rank < 3 ? m.at[rank] : m.at[2] };
  });
}
