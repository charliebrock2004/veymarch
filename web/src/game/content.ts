/** Slice data. Numbers match the sim catalog except wolf/goblin bite, which is tuned so a telegraph is worth dodging. */

export type ItemDef = {
  id: string;
  name: string;
  kind: "mat" | "weapon" | "armour" | "key" | "consumable";
  stack: number;
  damage: number;
  stamLight: number;
  stamHeavy: number;
  range: number;
  defence: number;
  heal: number;
  tier: number;
  slot: "main" | "off" | "none";
  moveset: string;
  element: "none" | "fire";
  soulbound: boolean;
};

export type RecipeDef = {
  id: string;
  name: string;
  out: string;
  station: "hand" | "bench";
  inputs: { id: string; n: number }[];
};

export const SPEEDS = { walk: 4.2, sprint: 6.4, cap: 7 };

export const ITEMS: Record<string, ItemDef> = {
  wpn_fists: w("wpn_fists", "Fists", 4, 1.2, 6, 14, 0, "fists"),
  mat_wood: m("mat_wood", "Wood"),
  mat_flint: m("mat_flint", "Flint"),
  mat_fibre: m("mat_fibre", "Fibre"),
  mat_stone: m("mat_stone", "Stone"),
  mat_bone: m("mat_bone", "Bone"),
  mat_leather: m("mat_leather", "Leather"),
  mat_copper: m("mat_copper", "Copper"),
  mat_iron: m("mat_iron", "Iron"),
  wpn_stone_knife: w("wpn_stone_knife", "Stone Knife", 10, 1.5, 7, 14, 1, "knife"),
  wpn_stone_pick: w("wpn_stone_pick", "Stone Pick", 7, 1.6, 8, 16, 2, "pick"),
  wpn_copper_pick: w("wpn_copper_pick", "Copper Pick", 9, 1.6, 8, 16, 3, "pick"),
  wpn_copper_sword: w("wpn_copper_sword", "Copper Sword", 14, 1.9, 9, 18, 3, "sword"),
  wpn_cookie_blade: {
    ...w("wpn_cookie_blade", "Cookie's Blade", 22, 2, 9, 20, 4, "cookie_blade"),
    soulbound: true,
  },
  wpn_cookie_pick: {
    ...w("wpn_cookie_pick", "Cookie's Pickaxe", 16, 1.7, 8, 16, 4, "cookie_pick"),
    soulbound: true,
  },
  key_cookie_core: {
    id: "key_cookie_core",
    name: "Cookie's Core",
    kind: "key",
    stack: 1,
    damage: 0,
    stamLight: 0,
    stamHeavy: 0,
    range: 0,
    defence: 0,
    heal: 0,
    tier: 4,
    slot: "none",
    moveset: "",
    element: "none",
    soulbound: true,
  },
  wpn_smacko: { ...w("wpn_smacko", "Smacko", 18, 1.8, 6, 12, 4, "smacko"), soulbound: true },
  arm_stump_shield: {
    id: "arm_stump_shield",
    name: "Stump Shield",
    kind: "armour",
    stack: 1,
    damage: 0,
    stamLight: 0,
    stamHeavy: 0,
    range: 0,
    defence: 6,
    heal: 0,
    tier: 0,
    slot: "off",
    moveset: "shield",
    element: "none",
    soulbound: false,
  },
  arm_cloth: {
    id: "arm_cloth",
    name: "Cloth",
    kind: "armour",
    stack: 1,
    damage: 0,
    stamLight: 0,
    stamHeavy: 0,
    range: 0,
    defence: 0,
    heal: 0,
    tier: 0,
    slot: "none",
    moveset: "",
    element: "none",
    soulbound: false,
  },
  cons_bandage: {
    id: "cons_bandage",
    name: "Bandage",
    kind: "consumable",
    stack: 10,
    damage: 0,
    stamLight: 0,
    stamHeavy: 0,
    range: 0,
    defence: 0,
    heal: 28,
    tier: 0,
    slot: "none",
    moveset: "",
    element: "none",
    soulbound: false,
  },
};

export const RECIPES: RecipeDef[] = [
  { id: "recipe_stone_knife", name: "Stone Knife", out: "wpn_stone_knife", station: "hand", inputs: [{ id: "mat_flint", n: 2 }, { id: "mat_wood", n: 1 }] },
  { id: "recipe_bandage", name: "Bandage", out: "cons_bandage", station: "hand", inputs: [{ id: "mat_fibre", n: 2 }] },
  { id: "recipe_stump_shield", name: "Stump Shield", out: "arm_stump_shield", station: "bench", inputs: [{ id: "mat_wood", n: 3 }, { id: "mat_fibre", n: 1 }] },
  { id: "recipe_stone_pick", name: "Stone Pick", out: "wpn_stone_pick", station: "bench", inputs: [{ id: "mat_flint", n: 3 }, { id: "mat_wood", n: 2 }, { id: "mat_fibre", n: 1 }] },
  { id: "recipe_copper_sword", name: "Copper Sword", out: "wpn_copper_sword", station: "bench", inputs: [{ id: "mat_copper", n: 5 }, { id: "mat_wood", n: 1 }, { id: "mat_flint", n: 1 }] },
  { id: "recipe_copper_pick", name: "Copper Pick", out: "wpn_copper_pick", station: "bench", inputs: [{ id: "mat_copper", n: 4 }, { id: "mat_wood", n: 2 }, { id: "wpn_stone_pick", n: 1 }] },
];

export const LINES = {
  tanic1: "Flint in the creek. Wood from the fallen limb. The bench is past the smith, if you want an edge.",
  tanic2: "That hill was a nursery before it was a castle. Do not answer the box.",
  tanic3: "When the air sweetens, move. The gate answers a core, not a wish.",
  rhyme: "Caller Cookie, button and bow, count the toys and don't be slow.",
  mara: "Bench is hot. Don't bring me a story, bring me an edge.",
  penn: "The hives are east of the lane. Smoke and I fall out.",
  vossClosed: "Harrenvale keeps its own oath. The gate has not answered you.",
  vossOpen: "The bells carried. Walk the wheat. The fortress is not yours. Not yet.",
  bramble: "Palisade holds. The green gate does not. Don't lean on it.",
  noEdge: "You want an edge before that hill.",
  gateShut: "The gate does not answer.",
  gateOpen: "The Green Gate is open. The kingdom is not a painting anymore.",
  cookieDead: "The toys are still. The box has nothing left to call.",
  boeLick: "The hound wants a hand. The collar does not.",
  learned: "Tanic presses a warm coal into your palm. Ember. It spends a little breath.",
};

export const COOKIE_HP = 180;
export const BOE_HP = 120;

function m(id: string, name: string): ItemDef {
  return {
    id, name, kind: "mat", stack: 99, damage: 0, stamLight: 0, stamHeavy: 0,
    range: 0, defence: 0, heal: 0, tier: 0, slot: "none", moveset: "", element: "none", soulbound: false,
  };
}

function w(id: string, name: string, damage: number, range: number, light: number, heavy: number, tier: number, moveset: string): ItemDef {
  return {
    id, name, kind: "weapon", stack: 1, damage, stamLight: light, stamHeavy: heavy,
    range, defence: 0, heal: 0, tier, slot: "main", moveset, element: "none", soulbound: false,
  };
}
