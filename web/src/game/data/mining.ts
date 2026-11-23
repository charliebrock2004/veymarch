/**
 * Mining gates. Here and there a rockfall has sealed something in. A good enough pick breaks it open;
 * the better the pick it asks for, the better what lies behind. Single-player worlds only;
 * the walls broken are kept with the codex on this device.
 */
import type { Find } from "./explore.ts";

export type Vein = Find & { kind: "vein"; tier: number; loot: [string, number][]; needs: string };

export const VEINS: Vein[] = [
  { id: "v_over_quarry", zone: "over", kind: "vein", x: 70, z: 20, tier: 2, needs: "a Stone Pick", loot: [["mat_copper", 5], ["mat_coal", 3], ["coin_crown", 30]], text: "Behind the fall: an old prospector's dig, and the copper he never came back for." },
  { id: "v_king_cellar", zone: "kingdom", kind: "vein", x: 72, z: 96, tier: 3, needs: "a Copper Pick", loot: [["mat_iron", 5], ["mat_coal", 5], ["coin_crown", 70]], text: "A walled-up cellar. Someone hid the garrison's iron from the tax-collector, then died of it." },
  { id: "v_hunt_den", zone: "hunt", kind: "vein", x: -52, z: -88, tier: 4, needs: "an Iron Pick", loot: [["mat_steel", 3], ["mat_ember_shard", 2], ["coin_crown", 110]], text: "A sealed den. The steel in it was a hunter's whole fortune, and the ember shards were what he was hunting." },
  { id: "v_mire_vault", zone: "mire", kind: "vein", x: 36, z: 72, tier: 6, needs: "the Fangbreaker Pickaxe", loot: [["mat_steel", 5], ["cons_greater_draught", 2], ["coin_crown", 180]], text: "Drear's strongroom, sunk and silted shut. The water kept everything but the owners." },
  { id: "v_waste_ossuary", zone: "waste", kind: "vein", x: 60, z: 80, tier: 7, needs: "the Soulbreaker Pickaxe", loot: [["mat_grave_iron", 5], ["cons_last_rites", 2], ["coin_crown", 300]], text: "An ossuary the Grave King bricked up with ore, so no one could be laid in it. It is open now." },
];

export const broken = (mg: string[] | undefined, id: string) => !!mg?.includes(id);

/** Why this pick cannot break the wall, or null if it can. */
export function veinRefusal(v: Vein, pickTier: number): string | null {
  if (pickTier >= v.tier) return null;
  return pickTier <= 0 ? `The rock is packed tight with ore. It wants ${v.needs}, and you carry no pick at all.` : `Your pick skates off it. This wall wants ${v.needs} or better.`;
}
