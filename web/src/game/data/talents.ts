/**
 * Talents: one point per level after the first, spent in four small trees. There are more
 * ranks than points, so a character is a choice. Stored with the codex (per character, on
 * this device), and applied on the client only.
 */

export type Tree = "might" | "guard" | "ember" | "way";
export type Talent = { id: string; tree: Tree; name: string; max: number; text: (rank: number) => string };

export const TREES: Record<Tree, { name: string; sub: string }> = {
  might: { name: "Might", sub: "Hit harder, finish faster" },
  guard: { name: "Guard", sub: "Stand where others fall" },
  ember: { name: "Ember", sub: "The breath that burns" },
  way: { name: "Wayfarer", sub: "Lungs, legs and luck" },
};

const pct = (n: number) => Math.round(n * 100) + "%";

export const TALENTS: Talent[] = [
  { id: "edge", tree: "might", name: "Keen Edge", max: 3, text: (r) => `Weapon blows deal ${pct(0.05 * r)} more damage.` },
  { id: "eye", tree: "might", name: "Killing Eye", max: 3, text: (r) => `${pct(0.05 * r)} more chance of a critical blow.` },
  { id: "exec", tree: "might", name: "Executioner", max: 3, text: (r) => `Blows on reeling foes and backstabs deal ${pct(0.15 * r)} more.` },
  { id: "hardy", tree: "guard", name: "Hardy", max: 3, text: (r) => `${12 * r} more health.` },
  { id: "bulwark", tree: "guard", name: "Bulwark", max: 3, text: (r) => `Blocking costs ${pct(0.15 * r)} less stamina.` },
  { id: "riposte", tree: "guard", name: "Riposte", max: 3, text: (r) => `After a parry your next blow deals ${pct(0.4 * r)} more.` },
  { id: "kindle", tree: "ember", name: "Kindling", max: 3, text: (r) => `Ember burns ${pct(0.2 * r)} hotter.` },
  { id: "breath", tree: "ember", name: "Deep Breath", max: 3, text: (r) => `${8 * r} more breath for Ember.` },
  { id: "wild", tree: "ember", name: "Wildfire", max: 3, text: (r) => `Ember bursts, scorching foes within ${(1.2 * r).toFixed(1)} m for half damage.` },
  { id: "fleet", tree: "way", name: "Fleet", max: 3, text: (r) => `${10 * r} more stamina, and it returns ${pct(0.08 * r)} faster.` },
  { id: "feet", tree: "way", name: "Light Feet", max: 3, text: (r) => `Rolling costs ${pct(0.15 * r)} less stamina.` },
  { id: "wind", tree: "way", name: "Second Wind", max: 3, text: (r) => `Each kill restores ${4 * r} health.` },
];

export type TalentBook = Record<string, number>;

export const talentPoints = (level: number) => Math.max(0, level - 1);
export const talentSpent = (t: TalentBook) => TALENTS.reduce((n, d) => n + Math.min(d.max, Math.max(0, t[d.id] ?? 0)), 0);
export const talentFree = (level: number, t: TalentBook) => Math.max(0, talentPoints(level) - talentSpent(t));

/** Spend one point; returns the same book if it cannot be spent. */
export function learnTalent(t: TalentBook, id: string, level: number): TalentBook {
  const d = TALENTS.find((x) => x.id === id);
  if (!d || talentFree(level, t) <= 0 || (t[id] ?? 0) >= d.max) return t;
  return { ...t, [id]: (t[id] ?? 0) + 1 };
}

/** A book that never holds more ranks than the level allows (a tampered or stale record). */
export function cleanTalents(t: TalentBook | undefined, level: number): TalentBook {
  const out: TalentBook = {};
  let left = talentPoints(level);
  for (const d of TALENTS) {
    const r = Math.min(d.max, Math.max(0, Math.floor(t?.[d.id] ?? 0)), left);
    if (r > 0) out[d.id] = r;
    left -= r;
  }
  return out;
}

export const BASE_CRIT = 0.05;
export const CRIT_MUL = 1.75;

export function talentMods(t: TalentBook) {
  const r = (id: string) => t[id] ?? 0;
  return {
    dmg: 1 + 0.05 * r("edge"),
    crit: BASE_CRIT + 0.05 * r("eye"),
    opening: 1 + 0.15 * r("exec"),
    hp: 12 * r("hardy"),
    blockCost: 1 - 0.15 * r("bulwark"),
    riposte: 0.4 * r("riposte"),
    ember: 1 + 0.2 * r("kindle"),
    mana: 8 * r("breath"),
    wildfire: 1.2 * r("wild"),
    stam: 10 * r("fleet"),
    stamRegen: 1 + 0.08 * r("fleet"),
    rollCost: 1 - 0.15 * r("feet"),
    killHeal: 4 * r("wind"),
  };
}
