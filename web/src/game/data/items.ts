import type { Station } from "./zones.ts";

/**
 * Every item in the slice. Shared with the server (server/gen-seed.mjs writes vm_item_defs and
 * the recipes from these), so a number changed here changes on both sides.
 *
 * Tiers: 0 village, 1 flint and leather, 2 stone tools, 3 copper, 4 iron, 5 steel, 6 black iron
 * and the last uniques. A pick mines nodes up to its tier.
 */

export type Slot = "main" | "off" | "head" | "chest" | "hands" | "legs" | "feet" | "trinket" | "none";
export type Rarity = "common" | "uncommon" | "rare" | "epic" | "legendary" | "unique";
export type Family = "fists" | "dagger" | "sword" | "axe" | "mace" | "spear" | "greatsword" | "pick" | "shield" | "";
export type Kind = "mat" | "weapon" | "armour" | "key" | "consumable" | "coin" | "trinket";

export type ItemDef = {
  id: string;
  name: string;
  kind: Kind;
  stack: number;
  damage: number;
  stamLight: number;
  stamHeavy: number;
  range: number;
  defence: number;
  heal: number;
  tier: number;
  slot: Slot;
  /** model and swing set (sword, knife, pick, smacko...) */
  moveset: string;
  family: Family;
  element: "none" | "fire";
  soulbound: boolean;
  rarity: Rarity;
  /** price in crowns at a shop; selling pays 30% */
  value: number;
  /** armour set this piece belongs to */
  set?: string;
  /** a unique weapon's or set's special rule, shown in the bag */
  passive?: string;
};

export type RecipeDef = {
  id: string;
  name: string;
  out: string;
  n?: number;
  station: Station;
  inputs: { id: string; n: number }[];
};

export const RARITY_COLOR: Record<Rarity, string> = {
  common: "#e8e0d0", uncommon: "#8fd18a", rare: "#7fb2ff", epic: "#c38cff", legendary: "#ffb052", unique: "#ffd86a",
};

const base = {
  stack: 1, damage: 0, stamLight: 0, stamHeavy: 0, range: 0, defence: 0, heal: 0, tier: 0, slot: "none" as Slot, moveset: "", family: "" as Family,
  element: "none" as const, soulbound: false, rarity: "common" as Rarity, value: 1,
};

function mat(id: string, name: string, value: number, tier = 0, rarity: Rarity = "common", stack = 99): ItemDef {
  return { ...base, id, name, kind: "mat", stack, tier, value, rarity };
}

function weapon(
  id: string, name: string, family: Family, damage: number, range: number, light: number, heavy: number, tier: number, value: number,
  o: Partial<ItemDef> = {},
): ItemDef {
  const moveset = o.moveset ?? (family === "dagger" ? "knife" : family === "pick" ? "pick" : family);
  return { ...base, id, name, kind: "weapon", family, damage, range, stamLight: light, stamHeavy: heavy, tier, slot: "main", value, ...o, moveset };
}

function armour(id: string, name: string, slot: Slot, defence: number, tier: number, value: number, o: Partial<ItemDef> = {}): ItemDef {
  return { ...base, id, name, kind: "armour", slot, defence, tier, value, ...o };
}

function food(id: string, name: string, heal: number, value: number, o: Partial<ItemDef> = {}): ItemDef {
  return { ...base, id, name, kind: "consumable", stack: 20, heal, value, ...o };
}

function key(id: string, name: string, o: Partial<ItemDef> = {}): ItemDef {
  return { ...base, id, name, kind: "key", tier: 4, soulbound: true, rarity: "unique", value: 0, ...o };
}

/** A five-piece armour set: [head, chest, hands, legs, feet] defences. */
function set(prefix: string, names: [string, string, string, string, string], defs: number[], tier: number, value: number, o: Partial<ItemDef> = {}) {
  const slots: Slot[] = ["head", "chest", "hands", "legs", "feet"];
  const share = [0.18, 0.34, 0.12, 0.24, 0.12];
  return slots.map((slot, i) => armour(`arm_${prefix}_${slot}`, names[i], slot, defs[i], tier, Math.round(value * share[i]), o));
}

const LIST: ItemDef[] = [
  // ---- coin
  { ...base, id: "coin_crown", name: "Crowns", kind: "coin", stack: 99999, value: 1 },

  // ---- materials
  mat("mat_wood", "Wood", 1),
  mat("mat_flint", "Flint", 1),
  mat("mat_fibre", "Fibre", 1),
  mat("mat_stone", "Stone", 1),
  mat("mat_bone", "Bone", 2),
  mat("mat_leather", "Leather", 4),
  mat("mat_copper", "Copper", 4, 3),
  mat("mat_iron", "Iron", 9, 4),
  mat("mat_coal", "Coal", 5, 3),
  mat("mat_steel", "Steel Ingot", 26, 5, "uncommon"),
  mat("mat_wheat", "Wheat", 1),
  mat("mat_meat", "Raw Meat", 3),
  mat("mat_hound_hide", "Hound Hide", 14, 5, "uncommon"),
  mat("mat_boe_fang", "Boe's Fang", 120, 5, "unique", 5),
  mat("mat_black_iron", "Black Iron", 40, 6, "rare"),
  mat("mat_ember_shard", "Ember Shard", 30, 5, "uncommon"),
  mat("herb_marigold", "Marigold", 2),
  mat("herb_rotcap", "Rotcap", 6, 0, "uncommon"),
  mat("herb_widowsveil", "Widowsveil", 9, 0, "uncommon"),

  // ---- weapons
  weapon("wpn_fists", "Fists", "fists", 4, 1.2, 6, 14, 0, 0, { moveset: "fists" }),
  weapon("wpn_stone_knife", "Stone Knife", "dagger", 10, 1.5, 7, 14, 1, 6),
  weapon("wpn_stone_pick", "Stone Pick", "pick", 7, 1.6, 8, 16, 2, 8),
  weapon("wpn_copper_pick", "Copper Pick", "pick", 9, 1.6, 8, 16, 3, 30),
  weapon("wpn_copper_sword", "Copper Sword", "sword", 14, 1.9, 9, 18, 3, 40),
  weapon("wpn_iron_sword", "Iron Sword", "sword", 19, 2, 10, 20, 4, 90),
  weapon("wpn_iron_pick", "Iron Pick", "pick", 12, 1.6, 8, 16, 4, 80),
  weapon("wpn_iron_axe", "Iron Axe", "axe", 23, 1.9, 12, 24, 4, 110, { passive: "Cleave: heavy swings hit everything in a wide arc." }),
  weapon("wpn_iron_mace", "Iron Mace", "mace", 21, 1.8, 11, 22, 4, 105, { passive: "Stun: heavy swings stagger longer." }),
  weapon("wpn_iron_spear", "Iron Spear", "spear", 18, 2.7, 9, 18, 4, 100, { passive: "Reach: strikes from further away." }),
  weapon("wpn_steel_sword", "Steel Sword", "sword", 26, 2.05, 10, 20, 5, 240, { rarity: "uncommon" }),
  weapon("wpn_steel_dagger", "Steel Dagger", "dagger", 19, 1.55, 6, 12, 5, 200, { rarity: "uncommon" }),
  weapon("wpn_steel_greatsword", "Steel Greatsword", "greatsword", 35, 2.45, 15, 30, 5, 320, { rarity: "uncommon", passive: "Heavy: slow, but each heavy swing breaks guards." }),
  weapon("wpn_ember_sword", "Emberforged Sword", "sword", 28, 2.05, 10, 20, 5, 480, { rarity: "rare", element: "fire", passive: "Ember edge: every hit burns, more so against cloth and wax." }),
  weapon("wpn_blackiron_sword", "Black Iron Sword", "sword", 33, 2.1, 10, 20, 6, 700, { rarity: "rare" }),
  weapon("wpn_fangbreaker", "Fangbreaker Pickaxe", "pick", 18, 1.7, 8, 16, 6, 0, { rarity: "rare", soulbound: true, passive: "Mines black iron." }),
  weapon("wpn_cookie_blade", "Cookie's Blade", "sword", 22, 2, 9, 20, 4, 0, { moveset: "cookie_blade", soulbound: true, rarity: "unique", passive: "Lullaby: hits sometimes leave foes dizzy." }),
  weapon("wpn_cookie_pick", "Cookie's Pickaxe", "pick", 16, 1.7, 8, 16, 4, 0, { moveset: "cookie_pick", soulbound: true, rarity: "unique", passive: "Breaks iron the seal kept from you." }),
  weapon("wpn_smacko", "Smacko", "sword", 28, 1.9, 6, 13, 5, 0, { moveset: "smacko", soulbound: true, rarity: "unique", passive: "Smack: every fourth hit lands twice, and charged hits knock foes flying." }),
  weapon("wpn_finlay_longsword", "Finlay's Longsword", "greatsword", 40, 2.35, 10, 21, 6, 0, { moveset: "finlay", soulbound: true, rarity: "unique", passive: "Captain's Riposte: after a parry, your next hit deals double." }),

  // ---- shields
  armour("arm_stump_shield", "Stump Shield", "off", 6, 0, 10, { moveset: "shield", family: "shield" }),
  armour("arm_iron_shield", "Iron Heater Shield", "off", 10, 4, 120, { moveset: "shield", family: "shield" }),
  armour("arm_steel_kite", "Steel Kite Shield", "off", 14, 5, 280, { moveset: "shield", family: "shield", rarity: "uncommon" }),

  // ---- body armour
  armour("arm_cloth", "Village Wool", "chest", 0, 0, 2),
  ...set("leather", ["Leather Cap", "Leather Jerkin", "Leather Gloves", "Leather Trousers", "Leather Boots"], [2, 5, 1, 3, 1], 1, 70),
  ...set("iron", ["Iron Helm", "Iron Mail", "Iron Gauntlets", "Iron Greaves", "Iron Boots"], [4, 9, 2, 6, 3], 4, 420),
  ...set("steel", ["Steel Helm", "Steel Cuirass", "Steel Gauntlets", "Steel Legplates", "Steel Sabatons"], [6, 13, 3, 9, 4], 5, 980, { rarity: "uncommon" }),
  ...set("hound", ["Houndhide Hood", "Houndhide Coat", "Houndhide Grips", "Houndhide Leggings", "Houndhide Boots"], [5, 11, 3, 7, 3], 5, 1100, { rarity: "rare", set: "hound" }),
  ...set("bk", ["Black Knight Helm", "Black Knight Cuirass", "Black Knight Gauntlets", "Black Knight Greaves", "Black Knight Sabatons"], [8, 17, 4, 12, 5], 6, 0, { rarity: "legendary", set: "bk", soulbound: true }),

  // ---- trinkets
  { ...base, id: "trk_hound_bell", name: "Elspeth's Hound Bell", kind: "trinket", slot: "trinket", tier: 5, rarity: "rare", soulbound: true, value: 0, passive: "Hounds and wolves leave you be until you strike them." },

  // ---- consumables
  food("cons_bandage", "Bandage", 28, 6, { stack: 10 }),
  food("cons_draught", "Healing Draught", 60, 28, { stack: 10, rarity: "uncommon" }),
  food("cons_greater_draught", "Greater Draught", 110, 90, { stack: 10, rarity: "rare" }),
  food("cons_rot_tonic", "Rot Tonic", 25, 40, { stack: 10, rarity: "uncommon", passive: "Clears rot and the Mire's sickness." }),
  food("cons_bread", "Harrenvale Loaf", 30, 8),
  food("cons_roast", "Roast Meat", 42, 12),
  food("cons_stew", "Hunter's Stew", 75, 30, { rarity: "uncommon" }),

  // ---- keys and quest items
  key("key_cookie_core", "Cookie's Core"),
  key("key_red_collar", "Boe's Red Collar"),
];

export const ITEMS: Record<string, ItemDef> = Object.fromEntries(LIST.map((d) => [d.id, d]));

export const RECIPES: RecipeDef[] = [
  // by hand
  { id: "recipe_stone_knife", name: "Stone Knife", out: "wpn_stone_knife", station: "hand", inputs: [{ id: "mat_flint", n: 2 }, { id: "mat_wood", n: 1 }] },
  { id: "recipe_bandage", name: "Bandage", out: "cons_bandage", station: "hand", inputs: [{ id: "mat_fibre", n: 2 }] },
  // Hearthfen workbench
  { id: "recipe_stump_shield", name: "Stump Shield", out: "arm_stump_shield", station: "bench", inputs: [{ id: "mat_wood", n: 3 }, { id: "mat_fibre", n: 1 }] },
  { id: "recipe_stone_pick", name: "Stone Pick", out: "wpn_stone_pick", station: "bench", inputs: [{ id: "mat_flint", n: 3 }, { id: "mat_wood", n: 2 }, { id: "mat_fibre", n: 1 }] },
  { id: "recipe_leather_head", name: "Leather Cap", out: "arm_leather_head", station: "bench", inputs: [{ id: "mat_leather", n: 2 }, { id: "mat_fibre", n: 1 }] },
  { id: "recipe_leather_chest", name: "Leather Jerkin", out: "arm_leather_chest", station: "bench", inputs: [{ id: "mat_leather", n: 4 }, { id: "mat_fibre", n: 2 }] },
  { id: "recipe_leather_hands", name: "Leather Gloves", out: "arm_leather_hands", station: "bench", inputs: [{ id: "mat_leather", n: 1 }, { id: "mat_fibre", n: 1 }] },
  { id: "recipe_leather_legs", name: "Leather Trousers", out: "arm_leather_legs", station: "bench", inputs: [{ id: "mat_leather", n: 3 }, { id: "mat_fibre", n: 1 }] },
  { id: "recipe_leather_feet", name: "Leather Boots", out: "arm_leather_feet", station: "bench", inputs: [{ id: "mat_leather", n: 1 }, { id: "mat_bone", n: 1 }] },
  // forges (Hearthfen and Holt's)
  { id: "recipe_copper_sword", name: "Copper Sword", out: "wpn_copper_sword", station: "forge", inputs: [{ id: "mat_copper", n: 5 }, { id: "mat_wood", n: 1 }, { id: "mat_flint", n: 1 }] },
  { id: "recipe_copper_pick", name: "Copper Pick", out: "wpn_copper_pick", station: "forge", inputs: [{ id: "mat_copper", n: 4 }, { id: "mat_wood", n: 2 }, { id: "wpn_stone_pick", n: 1 }] },
  { id: "recipe_iron_sword", name: "Iron Sword", out: "wpn_iron_sword", station: "forge", inputs: [{ id: "mat_iron", n: 3 }, { id: "mat_leather", n: 1 }, { id: "mat_wood", n: 1 }] },
  { id: "recipe_iron_pick", name: "Iron Pick", out: "wpn_iron_pick", station: "forge", inputs: [{ id: "mat_iron", n: 3 }, { id: "mat_wood", n: 2 }] },
  // Holt, the blacksmith of Harrenvale
  { id: "recipe_steel", name: "Steel Ingot", out: "mat_steel", station: "blacksmith", inputs: [{ id: "mat_iron", n: 2 }, { id: "mat_coal", n: 1 }] },
  { id: "recipe_iron_axe", name: "Iron Axe", out: "wpn_iron_axe", station: "blacksmith", inputs: [{ id: "mat_iron", n: 4 }, { id: "mat_wood", n: 2 }] },
  { id: "recipe_iron_mace", name: "Iron Mace", out: "wpn_iron_mace", station: "blacksmith", inputs: [{ id: "mat_iron", n: 4 }, { id: "mat_leather", n: 1 }] },
  { id: "recipe_iron_spear", name: "Iron Spear", out: "wpn_iron_spear", station: "blacksmith", inputs: [{ id: "mat_iron", n: 2 }, { id: "mat_wood", n: 3 }] },
  { id: "recipe_steel_sword", name: "Steel Sword", out: "wpn_steel_sword", station: "blacksmith", inputs: [{ id: "mat_steel", n: 3 }, { id: "mat_leather", n: 1 }] },
  { id: "recipe_steel_dagger", name: "Steel Dagger", out: "wpn_steel_dagger", station: "blacksmith", inputs: [{ id: "mat_steel", n: 2 }, { id: "mat_bone", n: 1 }] },
  { id: "recipe_steel_greatsword", name: "Steel Greatsword", out: "wpn_steel_greatsword", station: "blacksmith", inputs: [{ id: "mat_steel", n: 5 }, { id: "mat_leather", n: 2 }] },
  { id: "recipe_fangbreaker", name: "Fangbreaker Pickaxe", out: "wpn_fangbreaker", station: "blacksmith", inputs: [{ id: "mat_boe_fang", n: 1 }, { id: "mat_steel", n: 2 }, { id: "mat_wood", n: 2 }] },
  { id: "recipe_blackiron_sword", name: "Black Iron Sword", out: "wpn_blackiron_sword", station: "blacksmith", inputs: [{ id: "mat_black_iron", n: 4 }, { id: "mat_steel", n: 2 }, { id: "mat_leather", n: 1 }] },
  // Brannoc, the armourer
  { id: "recipe_iron_shield", name: "Iron Heater Shield", out: "arm_iron_shield", station: "armourer", inputs: [{ id: "mat_iron", n: 3 }, { id: "mat_wood", n: 2 }] },
  { id: "recipe_steel_kite", name: "Steel Kite Shield", out: "arm_steel_kite", station: "armourer", inputs: [{ id: "mat_steel", n: 3 }, { id: "mat_leather", n: 1 }] },
  { id: "recipe_iron_head", name: "Iron Helm", out: "arm_iron_head", station: "armourer", inputs: [{ id: "mat_iron", n: 2 }, { id: "mat_leather", n: 1 }] },
  { id: "recipe_iron_chest", name: "Iron Mail", out: "arm_iron_chest", station: "armourer", inputs: [{ id: "mat_iron", n: 5 }, { id: "mat_leather", n: 2 }] },
  { id: "recipe_iron_hands", name: "Iron Gauntlets", out: "arm_iron_hands", station: "armourer", inputs: [{ id: "mat_iron", n: 1 }, { id: "mat_leather", n: 1 }] },
  { id: "recipe_iron_legs", name: "Iron Greaves", out: "arm_iron_legs", station: "armourer", inputs: [{ id: "mat_iron", n: 3 }, { id: "mat_leather", n: 1 }] },
  { id: "recipe_iron_feet", name: "Iron Boots", out: "arm_iron_feet", station: "armourer", inputs: [{ id: "mat_iron", n: 2 }, { id: "mat_leather", n: 1 }] },
  { id: "recipe_steel_head", name: "Steel Helm", out: "arm_steel_head", station: "armourer", inputs: [{ id: "mat_steel", n: 2 }, { id: "mat_leather", n: 1 }] },
  { id: "recipe_steel_chest", name: "Steel Cuirass", out: "arm_steel_chest", station: "armourer", inputs: [{ id: "mat_steel", n: 4 }, { id: "mat_leather", n: 2 }] },
  { id: "recipe_steel_hands", name: "Steel Gauntlets", out: "arm_steel_hands", station: "armourer", inputs: [{ id: "mat_steel", n: 1 }, { id: "mat_leather", n: 1 }] },
  { id: "recipe_steel_legs", name: "Steel Legplates", out: "arm_steel_legs", station: "armourer", inputs: [{ id: "mat_steel", n: 3 }, { id: "mat_leather", n: 1 }] },
  { id: "recipe_steel_feet", name: "Steel Sabatons", out: "arm_steel_feet", station: "armourer", inputs: [{ id: "mat_steel", n: 2 }, { id: "mat_leather", n: 1 }] },
  { id: "recipe_hound_head", name: "Houndhide Hood", out: "arm_hound_head", station: "armourer", inputs: [{ id: "mat_hound_hide", n: 2 }, { id: "mat_leather", n: 1 }] },
  { id: "recipe_hound_chest", name: "Houndhide Coat", out: "arm_hound_chest", station: "armourer", inputs: [{ id: "mat_hound_hide", n: 4 }, { id: "mat_steel", n: 1 }] },
  { id: "recipe_hound_hands", name: "Houndhide Grips", out: "arm_hound_hands", station: "armourer", inputs: [{ id: "mat_hound_hide", n: 1 }, { id: "mat_leather", n: 1 }] },
  { id: "recipe_hound_legs", name: "Houndhide Leggings", out: "arm_hound_legs", station: "armourer", inputs: [{ id: "mat_hound_hide", n: 3 }, { id: "mat_leather", n: 1 }] },
  { id: "recipe_hound_feet", name: "Houndhide Boots", out: "arm_hound_feet", station: "armourer", inputs: [{ id: "mat_hound_hide", n: 1 }, { id: "mat_bone", n: 2 }] },
  // alchemy
  { id: "recipe_draught", name: "Healing Draught", out: "cons_draught", station: "alchemist", inputs: [{ id: "herb_marigold", n: 3 }] },
  { id: "recipe_greater_draught", name: "Greater Draught", out: "cons_greater_draught", station: "alchemist", inputs: [{ id: "cons_draught", n: 1 }, { id: "herb_widowsveil", n: 2 }] },
  { id: "recipe_rot_tonic", name: "Rot Tonic", out: "cons_rot_tonic", station: "alchemist", inputs: [{ id: "herb_rotcap", n: 2 }, { id: "herb_marigold", n: 1 }] },
  // enchanting
  { id: "recipe_ember_shard", name: "Ember Shard", out: "mat_ember_shard", station: "enchanter", inputs: [{ id: "mat_coal", n: 3 }, { id: "herb_marigold", n: 2 }] },
  { id: "recipe_ember_sword", name: "Emberforged Sword", out: "wpn_ember_sword", station: "enchanter", inputs: [{ id: "wpn_steel_sword", n: 1 }, { id: "mat_ember_shard", n: 3 }] },
  // cooking
  { id: "recipe_bread", name: "Harrenvale Loaf", out: "cons_bread", station: "cook", inputs: [{ id: "mat_wheat", n: 3 }] },
  { id: "recipe_roast", name: "Roast Meat", out: "cons_roast", station: "cook", inputs: [{ id: "mat_meat", n: 1 }] },
  { id: "recipe_stew", name: "Hunter's Stew", out: "cons_stew", station: "cook", inputs: [{ id: "mat_meat", n: 2 }, { id: "mat_wheat", n: 1 }, { id: "herb_marigold", n: 1 }] },
];

export const DESCRIPTIONS: Record<string, string> = {
  coin_crown: "The King's silver. Harrenvale's shops take it; so does everyone else.",
  wpn_fists: "Knuckles. Better than nothing, barely.",
  mat_wood: "Seasoned limb wood.",
  mat_flint: "Creek flint. Knaps to an edge.",
  mat_fibre: "Flax and nettle, twisted.",
  mat_stone: "Field stone.",
  mat_bone: "Wolf bone. Corrin buys it.",
  mat_leather: "Rough hide.",
  mat_copper: "Creek copper, green at the edges.",
  mat_iron: "Iron the seal kept from you.",
  mat_coal: "Kingdom coal from the quarry seams. Steel wants it.",
  mat_steel: "Iron and coal, folded at Holt's anvil.",
  mat_wheat: "Kingdom wheat. Bread, if you have a fire.",
  mat_meat: "Raw. Cook it first.",
  mat_hound_hide: "Black, thick, still smells of the kennel.",
  mat_boe_fang: "Boe's baby tooth, the size of a thumb. Holt says it would make a pick that bites black iron.",
  mat_black_iron: "The Keep's iron. It drinks the light.",
  mat_ember_shard: "A coal that remembers Ember. The enchanter can set it into steel.",
  herb_marigold: "Orange and bitter. The infirmary boils it.",
  herb_rotcap: "A mushroom that only grows on things that drowned.",
  herb_widowsveil: "Pale fronds from the witch pools. Strong medicine, if you survive picking it.",
  wpn_stone_knife: "Flint on a stick. Fast and honest.",
  wpn_stone_pick: "Breaks copper loose.",
  wpn_copper_pick: "A better pick. Still not enough for iron.",
  wpn_copper_sword: "Mara's work. Longer reach, harder hits.",
  wpn_iron_sword: "Grey, heavy, and yours.",
  wpn_iron_pick: "Iron on iron. Breaks the kingdom's quarry seams.",
  wpn_iron_axe: "A woodsman's head on a soldier's haft.",
  wpn_iron_mace: "Flanged. Makes armour a problem for the wearer.",
  wpn_iron_spear: "Ash shaft, iron leaf. Keeps teeth away.",
  wpn_steel_sword: "Holt's best plain blade. It sings a clean note.",
  wpn_steel_dagger: "Quick. Very quick.",
  wpn_steel_greatsword: "Two hands, a long breath, a short argument.",
  wpn_ember_sword: "Steel with a coal set in the fuller. It never quite cools.",
  wpn_blackiron_sword: "Forged from the Keep's own iron. It hums near Finlay's men.",
  wpn_fangbreaker: "Boe's fang set in steel. It bites black iron.",
  wpn_cookie_blade: "Painted wood over brass. It hums a lullaby when it hits.",
  wpn_cookie_pick: "Brass head, nursery-red haft. It breaks iron.",
  wpn_smacko: "A fast sword with a collar-bell guard. Boe's last game, and his best.",
  wpn_finlay_longsword: "A captain's longsword, black from the hilt down. It parries before you think.",
  key_cookie_core: "A brass heart that still ticks. The Green Gate answers it.",
  key_red_collar: "Red leather, a brass tag: BOE. Elspeth will want this back.",
  arm_stump_shield: "A stump with a strap. Hold block to raise it. Block just as a blow lands to parry.",
  arm_iron_shield: "A heater shield, riveted. Holds a block longer.",
  arm_steel_kite: "Tall and tapered. A knight's shield.",
  arm_cloth: "Village wool.",
  trk_hound_bell: "A small brass bell from Boe's collar. Hounds hear it and remember being good.",
  cons_bandage: "Restores 28 health.",
  cons_draught: "Restores 60 health.",
  cons_greater_draught: "Restores 110 health.",
  cons_rot_tonic: "Restores 25 health and clears rot.",
  cons_bread: "Restores 30 health.",
  cons_roast: "Restores 42 health.",
  cons_stew: "Restores 75 health.",
};

for (const d of LIST) {
  if (DESCRIPTIONS[d.id]) continue;
  if (d.kind === "armour") DESCRIPTIONS[d.id] = `${d.slot[0].toUpperCase()}${d.slot.slice(1)} armour, +${d.defence} defence.`;
}

/** Armour set bonuses: worn pieces needed and what they grant. */
export const SET_BONUS: Record<string, { name: string; pieces: number; text: string }> = {
  hound: { name: "Pack Runner", pieces: 5, text: "Stamina returns 25% faster." },
  bk: { name: "Black Knight's Oath", pieces: 5, text: "Hits deal 15% more, and blocking costs half the stamina." },
};

/**
 * Modifiers: one per piece of gear. Smiths and armourers sometimes turn out a better piece than
 * the recipe promised (a quarter of the time); the enchanter sets the one you choose, for a price,
 * replacing any it had. Uniques (soulbound) keep their own rule and take none. Shared with the server.
 */
export type ModDef = { id: string; name: string; suffix?: boolean; on: "weapon" | "armour"; dmg?: number; stam?: number; def?: number; regen?: number; text: string; cost: [string, number][] };
export const MODIFIERS: Record<string, ModDef> = {
  keen: { id: "keen", name: "Keen", on: "weapon", dmg: 0.1, text: "+10% damage", cost: [["mat_ember_shard", 1], ["mat_steel", 1]] },
  heavy: { id: "heavy", name: "Heavy", on: "weapon", dmg: 0.18, stam: 0.12, text: "+18% damage; swings cost 12% more stamina", cost: [["mat_iron", 3], ["mat_coal", 2]] },
  balanced: { id: "balanced", name: "Balanced", on: "weapon", stam: -0.15, text: "Swings cost 15% less stamina", cost: [["mat_leather", 2], ["mat_steel", 1]] },
  sturdy: { id: "sturdy", name: "Sturdy", on: "armour", def: 2, text: "+2 defence", cost: [["mat_iron", 2], ["mat_leather", 1]] },
  fleet: { id: "fleet", name: "of the Fleet", suffix: true, on: "armour", regen: 0.1, text: "Stamina returns 10% faster", cost: [["herb_widowsveil", 2], ["mat_fibre", 3]] },
};
/** A piece's name with its modifier ("Keen Iron Sword", "Leather Boots of the Fleet"). */
export function moddedName(name: string, mod?: string | null): string {
  const m = mod ? MODIFIERS[mod] : undefined;
  return !m ? name : m.suffix ? `${name} ${m.name}` : `${m.name} ${name}`;
}
