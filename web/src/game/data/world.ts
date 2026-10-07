import type { ZoneId } from "./zones.ts";

/**
 * Who stands where, what they drop, and what can be gathered. Shared with the server.
 * Positions are local to the zone (see data/zones.ts).
 */

/** Loot rolls: [item, count, chance]. The server rolls these; clients only display them. */
export const MOB_LOOT: Record<string, [string, number, number][]> = {
  wolf: [["mat_bone", 1, 1], ["mat_leather", 1, 0.35]],
  goblin: [["mat_leather", 1, 0.8], ["mat_fibre", 2, 0.5], ["coin_crown", 3, 0.5]],
  redcap: [["mat_copper", 3, 1], ["cons_bandage", 1, 1], ["mat_leather", 2, 1], ["coin_crown", 25, 1]],
  soldier: [["cons_bandage", 1, 0.25]],
  mouse: [],
  horse: [["cons_bandage", 2, 1], ["coin_crown", 15, 1]],
  deer: [["mat_leather", 2, 1], ["mat_bone", 1, 0.5], ["mat_meat", 1, 0.8]],
  bandit: [["coin_crown", 6, 0.9], ["mat_leather", 1, 0.4], ["cons_bread", 1, 0.2]],
  deserter: [["coin_crown", 14, 1], ["mat_iron", 1, 0.5], ["cons_draught", 1, 0.12]],
  hound: [["mat_meat", 1, 0.7], ["mat_leather", 1, 0.5], ["mat_bone", 1, 0.4]],
  boar: [["mat_meat", 2, 1], ["mat_leather", 1, 0.6]],
  blackwolf: [["mat_meat", 1, 0.6], ["mat_hound_hide", 1, 0.25], ["mat_bone", 1, 0.6]],
  kennel_hound: [["mat_hound_hide", 1, 0.6], ["mat_bone", 1, 0.5]],
  kennelmaster: [["coin_crown", 80, 1], ["mat_steel", 2, 1], ["cons_draught", 2, 1], ["mat_hound_hide", 3, 1]],
  drowned: [["coin_crown", 12, 0.8], ["herb_rotcap", 1, 0.5], ["mat_bone", 1, 0.4]],
  croc: [["mat_meat", 2, 1], ["mat_leather", 2, 0.8]],
  witch: [["coin_crown", 30, 1], ["herb_widowsveil", 1, 0.6], ["mat_ember_shard", 1, 0.2]],
  black_guard: [["coin_crown", 20, 1], ["mat_black_iron", 1, 0.35], ["cons_draught", 1, 0.15]],
  keep_knight: [["coin_crown", 40, 1], ["mat_black_iron", 2, 0.6], ["mat_steel", 1, 0.4]],
  crypt_dead: [["mat_bone", 2, 1], ["mat_black_iron", 1, 0.2], ["herb_rotcap", 1, 0.3]],
};

/** Placed enemies: [key, kind, x, z, zone]. Keys are stable forever (the server remembers deaths by key). */
export type Spawn = [key: string, kind: string, x: number, z: number, zone: ZoneId];

export const MOB_SPAWNS: Spawn[] = [
  // Hearthfen and the Giant Forest
  ["w1", "wolf", 14, 58, "over"], ["w2", "wolf", -18, 62, "over"], ["w3", "wolf", 16, 82, "over"], ["w4", "wolf", 21, 86, "over"], ["w5", "wolf", 22, 79, "over"],
  ["w6", "wolf", 30, 128, "over"], ["w7", "wolf", -36, 136, "over"],
  ["g1", "goblin", -39, 93, "over"], ["g2", "goblin", -46, 99, "over"], ["g3", "goblin", -37, 100, "over"], ["g4", "redcap", -43, 96, "over"],
  ["d1", "deer", 34, 100, "over"], ["d2", "deer", 37, 104, "over"], ["d3", "deer", -34, 124, "over"], ["d4", "deer", 46, 72, "over"], ["d5", "deer", 130, 30, "over"],
  ["s1", "soldier", -5, 150, "over"], ["s2", "soldier", 6, 154, "over"],
  // Cookie's Castle
  ["dm1", "mouse", -4, 10, "castle"], ["dm2", "mouse", 4, 12, "castle"],
  ["ds1", "soldier", -4, 50, "castle"], ["ds2", "soldier", 4, 52, "castle"], ["dm3", "mouse", 0, 46, "castle"],
  ["ds3", "soldier", -3, 66, "castle"], ["ds4", "soldier", 3, 76, "castle"], ["dh", "horse", 0, 72, "castle"],
  // The Kingdom: the Kingsroad, Millcross, the farms
  ["kb1", "bandit", 86, -78, "kingdom"], ["kb2", "bandit", 94, -84, "kingdom"], ["kb3", "bandit", 98, -74, "kingdom"], ["kb4", "bandit", 88, -90, "kingdom"], ["kb5", "bandit", 102, -88, "kingdom"],
  ["kb6", "bandit", -92, 22, "kingdom"], ["kb7", "bandit", -86, 28, "kingdom"],
  ["kd1", "deserter", 100, 92, "kingdom"], ["kd2", "deserter", 108, 86, "kingdom"], ["kd3", "deserter", 94, 100, "kingdom"],
  ["kh1", "hound", -96, -66, "kingdom"], ["kh2", "hound", -88, -74, "kingdom"], ["kh3", "hound", -100, -78, "kingdom"], ["kh4", "hound", -84, -62, "kingdom"],
  ["kbo1", "boar", -60, 72, "kingdom"], ["kbo2", "boar", -70, 80, "kingdom"], ["kbo3", "boar", -52, 88, "kingdom"],
  ["kde1", "deer", -110, 110, "kingdom"], ["kde2", "deer", 120, 20, "kingdom"],
  // The King's Hunting Grounds
  ["hw1", "blackwolf", -40, -10, "hunt"], ["hw2", "blackwolf", -46, -4, "hunt"], ["hw3", "blackwolf", -36, -2, "hunt"],
  ["hw4", "blackwolf", 50, 40, "hunt"], ["hw5", "blackwolf", 56, 48, "hunt"], ["hw6", "blackwolf", 44, 50, "hunt"],
  ["hb1", "boar", 30, -60, "hunt"], ["hb2", "boar", 40, -70, "hunt"], ["hb3", "boar", -70, 60, "hunt"],
  ["hh1", "hound", -10, 92, "hunt"], ["hh2", "hound", 24, 98, "hunt"], ["hh3", "hound", 4, 108, "hunt"], ["hh4", "hound", -20, 104, "hunt"],
  ["hde1", "deer", -80, -40, "hunt"], ["hde2", "deer", 80, -20, "hunt"],
  // The Royal Kennels
  ["kn1", "kennel_hound", -3, 14, "kennel"], ["kn2", "kennel_hound", 3, 16, "kennel"],
  ["kn3", "kennel_hound", -4, 52, "kennel"], ["kn4", "kennel_hound", 4, 56, "kennel"], ["kn5", "kennel_hound", 0, 62, "kennel"],
  ["kn6", "kennel_hound", -5, 80, "kennel"], ["knm", "kennelmaster", 0, 88, "kennel"],
  // The Dark Mire
  ["md1", "drowned", -10, 100, "mire"], ["md2", "drowned", 8, 94, "mire"], ["md3", "drowned", 30, 40, "mire"], ["md4", "drowned", 40, 30, "mire"],
  ["md5", "drowned", -20, -40, "mire"], ["md6", "drowned", 10, -60, "mire"],
  ["mc1", "croc", 60, 10, "mire"], ["mc2", "croc", -70, -10, "mire"], ["mc3", "croc", 70, -60, "mire"], ["mc4", "croc", -60, -90, "mire"],
  ["mw1", "witch", 80, 80, "mire"], ["mw2", "witch", -90, -60, "mire"], ["mw3", "witch", 40, -100, "mire"],
  // The Black Keep
  ["bg1", "black_guard", -6, 16, "keep"], ["bg2", "black_guard", 6, 18, "keep"],
  ["bg3", "black_guard", -10, 38, "keep"], ["bg4", "black_guard", 10, 42, "keep"], ["bg5", "black_guard", 0, 48, "keep"],
  ["kk1", "keep_knight", -24, 40, "keep"], ["kk2", "keep_knight", 24, 40, "keep"],
  ["cd1", "crypt_dead", -4, 64, "keep"], ["cd2", "crypt_dead", 4, 68, "keep"], ["cd3", "crypt_dead", -3, 74, "keep"], ["cd4", "crypt_dead", 3, 78, "keep"],
  ["kk3", "keep_knight", -6, 92, "keep"], ["kk4", "keep_knight", 6, 96, "keep"],
];

/** Indoor zones and soldiers do not come back; out in the open, things breed. */
export const RESPAWN_SECONDS = 150;

export type NodeKind = "flint" | "wood" | "fibre" | "stone" | "copper" | "iron" | "coal" | "wheat" | "marigold" | "rotcap" | "widowsveil" | "blackiron";

/**
 * Gatherable nodes. Hearthfen's positions live in the overworld builder (x, z omitted);
 * the newer zones' builders place theirs from x, z here.
 */
export type NodeData = { id: string; item: string; kind: NodeKind; tier: number; seal: string | null; max: number; zone: ZoneId; x?: number; z?: number };

const N = (id: string, kind: NodeKind, item: string, tier: number, zone: ZoneId, x?: number, z?: number, max = 3, seal: string | null = null): NodeData => ({ id, item, kind, tier, seal, max, zone, x, z });

export const NODE_DEFS: NodeData[] = [
  ...[0, 1, 2, 3].map((i) => N("flint_" + i, "flint", "mat_flint", 0, "over")),
  ...[0, 1, 2, 3, 4].map((i) => N("wood_" + i, "wood", "mat_wood", 0, "over")),
  ...[0, 1, 2, 3, 4, 5].map((i) => N("fibre_" + i, "fibre", "mat_fibre", 0, "over")),
  ...[0, 1, 2].map((i) => N("stone_" + i, "stone", "mat_stone", 0, "over")),
  ...[0, 1, 2, 3].map((i) => N("copper_" + i, "copper", "mat_copper", 2, "over")),
  ...[0, 1].map((i) => N("iron_" + i, "iron", "mat_iron", 4, "over", undefined, undefined, 4, "seal_cookie")),
  // the Kingdom: quarry on the east hill, fields west and south of town
  N("coal_k0", "coal", "mat_coal", 3, "kingdom", 118, 34), N("coal_k1", "coal", "mat_coal", 3, "kingdom", 126, 42), N("coal_k2", "coal", "mat_coal", 3, "kingdom", 114, 48), N("coal_k3", "coal", "mat_coal", 3, "kingdom", 130, 30),
  N("iron_k0", "iron", "mat_iron", 4, "kingdom", 132, 50, 4), N("iron_k1", "iron", "mat_iron", 4, "kingdom", 122, 58, 4), N("iron_k2", "iron", "mat_iron", 4, "kingdom", 138, 40, 4),
  N("wheat_k0", "wheat", "mat_wheat", 0, "kingdom", -60, -40), N("wheat_k1", "wheat", "mat_wheat", 0, "kingdom", -70, -48), N("wheat_k2", "wheat", "mat_wheat", 0, "kingdom", -52, -52),
  N("wheat_k3", "wheat", "mat_wheat", 0, "kingdom", -40, -70), N("wheat_k4", "wheat", "mat_wheat", 0, "kingdom", 40, -60), N("wheat_k5", "wheat", "mat_wheat", 0, "kingdom", 52, -50),
  N("marigold_k0", "marigold", "herb_marigold", 0, "kingdom", -30, 60), N("marigold_k1", "marigold", "herb_marigold", 0, "kingdom", -40, 70), N("marigold_k2", "marigold", "herb_marigold", 0, "kingdom", 30, 70),
  N("marigold_k3", "marigold", "herb_marigold", 0, "kingdom", 60, -20), N("marigold_k4", "marigold", "herb_marigold", 0, "kingdom", -100, 0), N("marigold_k5", "marigold", "herb_marigold", 0, "kingdom", 80, 120),
  N("wood_k0", "wood", "mat_wood", 0, "kingdom", -120, 60), N("wood_k1", "wood", "mat_wood", 0, "kingdom", 100, 130), N("wood_k2", "wood", "mat_wood", 0, "kingdom", -130, -100),
  // the Hunting Grounds
  N("wood_h0", "wood", "mat_wood", 0, "hunt", -20, -100), N("wood_h1", "wood", "mat_wood", 0, "hunt", 30, -20), N("wood_h2", "wood", "mat_wood", 0, "hunt", -60, 40), N("wood_h3", "wood", "mat_wood", 0, "hunt", 60, 90),
  N("marigold_h0", "marigold", "herb_marigold", 0, "hunt", -40, -90), N("marigold_h1", "marigold", "herb_marigold", 0, "hunt", 20, -110), N("marigold_h2", "marigold", "herb_marigold", 0, "hunt", -70, 20),
  N("flint_h0", "flint", "mat_flint", 0, "hunt", 70, -100), N("stone_h0", "stone", "mat_stone", 0, "hunt", -90, -120),
  N("iron_h0", "iron", "mat_iron", 4, "hunt", 90, 70, 4), N("coal_h0", "coal", "mat_coal", 3, "hunt", 96, 60),
  // the Dark Mire
  N("rotcap_m0", "rotcap", "herb_rotcap", 0, "mire", -20, 110), N("rotcap_m1", "rotcap", "herb_rotcap", 0, "mire", 20, 80), N("rotcap_m2", "rotcap", "herb_rotcap", 0, "mire", -50, 20),
  N("rotcap_m3", "rotcap", "herb_rotcap", 0, "mire", 50, -20), N("rotcap_m4", "rotcap", "herb_rotcap", 0, "mire", -30, -70), N("rotcap_m5", "rotcap", "herb_rotcap", 0, "mire", 30, -90),
  N("widow_m0", "widowsveil", "herb_widowsveil", 0, "mire", 76, 70), N("widow_m1", "widowsveil", "herb_widowsveil", 0, "mire", -84, -50), N("widow_m2", "widowsveil", "herb_widowsveil", 0, "mire", 46, -96), N("widow_m3", "widowsveil", "herb_widowsveil", 0, "mire", -100, 40),
  N("blackiron_m0", "blackiron", "mat_black_iron", 6, "mire", 100, -20, 3), N("blackiron_m1", "blackiron", "mat_black_iron", 6, "mire", 108, -30, 3), N("blackiron_m2", "blackiron", "mat_black_iron", 6, "mire", -110, -100, 3),
  // the Black Keep's armoury
  N("blackiron_k0", "blackiron", "mat_black_iron", 6, "keep", 30, 36, 3), N("blackiron_k1", "blackiron", "mat_black_iron", 6, "keep", 32, 44, 3),
];

/** One-time caches a character can loot once per world: contents, where, and how close you must stand. */
export type CacheDef = { id: string; zone: ZoneId; x: number; z: number; items: [string, number][] };

export const CACHE_DEFS: CacheDef[] = [
  { id: "chest", zone: "over", x: -7.9, z: -15.6, items: [["cons_bandage", 2], ["mat_fibre", 2], ["mat_wood", 1]] },
  { id: "hollow", zone: "over", x: -21.4, z: 130.8, items: [["mat_copper", 3], ["mat_leather", 1], ["cons_bandage", 1]] },
  { id: "mill_loft", zone: "kingdom", x: -96, z: -58, items: [["coin_crown", 40], ["cons_bread", 3], ["mat_wheat", 4]] },
  { id: "bandit_strongbox", zone: "kingdom", x: 96, z: -82, items: [["coin_crown", 90], ["mat_iron", 3], ["cons_draught", 1]] },
  { id: "lodge_cellar", zone: "hunt", x: -32, z: -82, items: [["cons_roast", 2], ["mat_leather", 3], ["coin_crown", 30]] },
  { id: "kennel_secret", zone: "kennel", x: 14, z: 32, items: [["mat_steel", 3], ["cons_draught", 2], ["mat_hound_hide", 2], ["coin_crown", 60]] },
  { id: "drear_reliquary", zone: "mire", x: -46, z: 70, items: [["cons_rot_tonic", 2], ["herb_widowsveil", 2], ["coin_crown", 50]] },
  { id: "armoury_rack", zone: "keep", x: 28, z: 40, items: [["mat_black_iron", 3], ["mat_steel", 2], ["cons_greater_draught", 1]] },
  { id: "crypt_tomb", zone: "keep", x: 0, z: 82, items: [["coin_crown", 150], ["cons_greater_draught", 2]] },
];

/** Back-compat view used by older code: cache id → contents. */
export const CACHES: Record<string, [string, number][]> = Object.fromEntries(CACHE_DEFS.map((c) => [c.id, c.items]));

/**
 * World flags a player may set (doors, levers, puzzles), and what must be true first.
 * Boss flags are set only by the boss falling; the causeway only by the Castellan's quest.
 */
export type WorldFlagRule = { flag: string; needsMob?: string; needsFlag?: string };

export const WORLD_FLAGS: WorldFlagRule[] = [
  { flag: "slab" },
  { flag: "nursery", needsMob: "dh" },
  { flag: "gate", needsFlag: "cookie" },
  // the kennels: two pressure plates (a friend, or the feed cart), then the bell gate
  { flag: "kennel_plates" },
  { flag: "kennel_gate", needsMob: "knm" },
  // the Black Keep: the gatehouse winch, the armoury (its captain must fall), the crypt seal
  { flag: "keep_winch" },
  { flag: "armoury", needsMob: "kk1" },
  { flag: "crypt", needsFlag: "armoury" },
];
