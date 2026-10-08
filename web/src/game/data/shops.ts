import type { ZoneId } from "./zones.ts";

/**
 * Shops sell for crowns at the item's value (or the listed price) and buy anything that is not
 * soulbound for 30% of its value (so no buy, craft and sell loop makes crowns: gen-seed checks). Shared with the server, which checks you stand at the counter.
 */
export type ShopDef = {
  id: string;
  name: string;
  /** the NPC who keeps it (talking to them opens the shop) */
  keeper: string;
  zone: ZoneId;
  x: number;
  z: number;
  stock: [item: string, price?: number][];
  buys: boolean;
};

export const SELL_RATE = 0.3;

export const SHOPS: ShopDef[] = [
  { id: "hf_corrin", name: "Corrin's Stall", keeper: "corrin", zone: "over", x: 4.6, z: -4.2, buys: true,
    stock: [["cons_bandage"], ["mat_leather"], ["mat_fibre"], ["wpn_stone_pick"]] },
  { id: "hv_market", name: "Harrenvale Market", keeper: "wenna", zone: "kingdom", x: -6, z: 6, buys: true,
    stock: [["cons_bandage"], ["cons_bread"], ["mat_wheat", 2], ["herb_marigold", 3], ["mat_leather"], ["mat_wood", 2], ["mat_fibre", 2], ["mat_coal", 7]] },
  { id: "hv_holt", name: "Holt's Smithy", keeper: "holt", zone: "kingdom", x: -18, z: 14, buys: true,
    stock: [["wpn_iron_pick"], ["wpn_iron_sword"], ["wpn_iron_axe"], ["wpn_iron_mace"], ["wpn_iron_spear"], ["mat_iron", 14], ["mat_steel", 40], ["wpn_steel_sword", 320]] },
  { id: "hv_brannoc", name: "Brannoc's Armoury", keeper: "brannoc", zone: "kingdom", x: -20, z: -14, buys: true,
    stock: [["arm_leather_head"], ["arm_leather_chest"], ["arm_leather_hands"], ["arm_leather_legs"], ["arm_leather_feet"],
      ["arm_iron_head"], ["arm_iron_chest"], ["arm_iron_hands"], ["arm_iron_legs"], ["arm_iron_feet"], ["arm_iron_shield"]] },
  { id: "hv_ox", name: "The Gilded Ox", keeper: "odo", zone: "kingdom", x: 18, z: 16, buys: false,
    stock: [["cons_bread"], ["cons_roast"], ["cons_stew"], ["mat_meat", 5]] },
  { id: "hv_maree", name: "The Infirmary", keeper: "maree", zone: "kingdom", x: 20, z: -18, buys: true,
    stock: [["cons_bandage"], ["cons_draught"], ["cons_rot_tonic"], ["herb_marigold", 3]] },
  { id: "dr_liss", name: "Liss's Boat-Shop", keeper: "liss", zone: "mire", x: -40, z: 66, buys: true,
    stock: [["cons_rot_tonic"], ["cons_draught"], ["cons_greater_draught"], ["herb_rotcap", 9], ["herb_widowsveil", 14], ["mat_steel", 44], ["mat_meat", 5]] },
];
