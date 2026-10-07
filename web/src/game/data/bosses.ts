import type { ZoneId } from "./zones.ts";

/**
 * Bosses share one shape on the server: a health pool per world, priced hits from the arena,
 * rewards granted once per character per world, a world flag on the kill. Health grows with the
 * number of fighters (not times four: each extra player adds `scale` of the base).
 */
export type BossDef = {
  id: string;
  name: string;
  /** the line under the name when the fight starts */
  title: string;
  zone: ZoneId;
  /** arena centre (local) and radius; hits are accepted from `reach` metres of the centre */
  x: number;
  z: number;
  r: number;
  reach: number;
  hp: number;
  scale: number;
  xp: number;
  crowns: number;
  rewards: [string, number][];
  /** world flag set when it falls */
  flag: string;
  music: string;
};

export const BOSSES: Record<string, BossDef> = {
  cookie: {
    id: "cookie", name: "Evil Toy Penguin Caller Cookie", title: "It bows. Then the toys stand up.", zone: "castle", x: 0, z: 104, r: 15, reach: 34,
    hp: 280, scale: 0.6, xp: 400, crowns: 80, rewards: [["wpn_cookie_blade", 1], ["wpn_cookie_pick", 1], ["key_cookie_core", 1]], flag: "cookie", music: "boss_cookie",
  },
  boe: {
    id: "boe", name: "Boe, the Collared Hound", title: "He wags. The collar glows.", zone: "kennel", x: 0, z: 116, r: 14, reach: 32,
    hp: 520, scale: 0.6, xp: 900, crowns: 200, rewards: [["wpn_smacko", 1], ["mat_boe_fang", 1], ["key_red_collar", 1]], flag: "boe", music: "boss_boe",
  },
  finlay: {
    id: "finlay", name: "Finlay, Captain of the March", title: "He is already here. He is furious you are late.", zone: "keep", x: 0, z: 124, r: 16, reach: 36,
    hp: 1100, scale: 0.65, xp: 2500, crowns: 600,
    rewards: [["wpn_finlay_longsword", 1], ["arm_bk_head", 1], ["arm_bk_chest", 1], ["arm_bk_hands", 1], ["arm_bk_legs", 1], ["arm_bk_feet", 1]],
    flag: "finlay", music: "boss_finlay",
  },
};

/** Fighters that count toward a boss's health: 1..4. */
export function bossHp(def: BossDef, fighters: number): number {
  const n = Math.max(1, Math.min(4, Math.round(fighters)));
  return Math.round(def.hp * (1 + def.scale * (n - 1)));
}
