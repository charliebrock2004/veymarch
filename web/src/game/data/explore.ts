/**
 * Things worth leaving the road for: hidden caches, rune stones that tell the land's story,
 * and a board of bounties that changes each day. Single-player worlds only; progress is kept
 * with the codex on this device.
 */
import type { ZoneId } from "./zones.ts";

export type Find = { id: string; zone: ZoneId; x: number; z: number; kind: "cache" | "stone"; loot?: [string, number][]; text: string };

export const FINDS: Find[] = [
  // Hearthfen and the Giant Forest
  { id: "c_over_mill", zone: "over", x: -58, z: 34, kind: "cache", loot: [["cons_bandage", 2], ["mat_copper", 2], ["coin_crown", 15]], text: "A trapper's box, nailed shut against the damp." },
  { id: "c_over_east", zone: "over", x: 96, z: -38, kind: "cache", loot: [["mat_leather", 2], ["mat_flint", 2], ["coin_crown", 20]], text: "Wrapped in oilcloth. Whoever buried it never came back." },
  { id: "c_over_deep", zone: "over", x: 118, z: 150, kind: "cache", loot: [["cons_draught", 1], ["mat_iron", 2], ["coin_crown", 30]], text: "Wedged between two roots, older than the road." },
  { id: "s_over_first", zone: "over", x: -34, z: 62, kind: "stone", text: "\"Here the first hearth was lit, and the fen named for it. We asked the giants' leave. They did not answer, so we stayed.\"" },
  { id: "s_over_toy", zone: "over", x: 62, z: 128, kind: "stone", text: "\"A child wished for a castle of her own. Something in the hill was listening. Be careful what the young ask of old stone.\"" },
  // The Medieval Kingdom
  { id: "c_king_west", zone: "kingdom", x: -112, z: 70, kind: "cache", loot: [["cons_draught", 1], ["mat_iron", 3], ["coin_crown", 40]], text: "A tax-collector's strongbox, lost off a cart and never reported." },
  { id: "c_king_south", zone: "kingdom", x: 96, z: -118, kind: "cache", loot: [["cons_stew", 1], ["mat_steel", 1], ["coin_crown", 45]], text: "Deserters' pay, buried in a hurry." },
  { id: "c_king_north", zone: "kingdom", x: -64, z: 132, kind: "cache", loot: [["mat_leather", 3], ["mat_coal", 3], ["coin_crown", 35]], text: "A smuggler's cache. The wax seal is the Castellan's own." },
  { id: "s_king_oath", zone: "kingdom", x: 118, z: 64, kind: "stone", text: "\"The March swore to hold the south until relieved. No relief was sent. The oath, it seems, was not told.\"" },
  { id: "s_king_road", zone: "kingdom", x: -96, z: -84, kind: "stone", text: "\"Kingsroad, laid in the ninth year. Every mile-stone has a man under it. The king thought it thrifty.\"" },
  // The King's Hunting Grounds
  { id: "c_hunt_east", zone: "hunt", x: 84, z: -52, kind: "cache", loot: [["mat_hound_hide", 2], ["cons_roast", 1], ["coin_crown", 55]], text: "A poacher's stash, hung high and cut down by weather." },
  { id: "c_hunt_west", zone: "hunt", x: -88, z: 62, kind: "cache", loot: [["cons_draught", 2], ["mat_steel", 2], ["coin_crown", 60]], text: "The huntsmaster's own flask and purse. He will not miss them." },
  { id: "s_hunt_hounds", zone: "hunt", x: 52, z: 78, kind: "stone", text: "\"Boe was the gentlest of the litter. The collar made him otherwise. Remember that, if you must put him down.\"" },
  // The Dark Mire
  { id: "c_mire_east", zone: "mire", x: 92, z: 48, kind: "cache", loot: [["cons_rot_tonic", 2], ["mat_black_iron", 2], ["coin_crown", 70]], text: "Tarred shut and floated here on its own. The marsh keeps what it likes." },
  { id: "c_mire_south", zone: "mire", x: -84, z: -78, kind: "cache", loot: [["cons_greater_draught", 1], ["mat_black_iron", 2], ["coin_crown", 80]], text: "A bell-ringer's wage chest, still dry inside." },
  { id: "s_mire_bells", zone: "mire", x: 58, z: -96, kind: "stone", text: "\"Drear rang its bells when the water rose. It rings them still. Do not go looking for who pulls the ropes.\"" },
  { id: "s_mire_keep", zone: "mire", x: -72, z: 96, kind: "stone", text: "\"The Black Keep was built to watch the south. Then the south came north, and the watch never ended.\"" },
  // The Undead Wasteland
  { id: "c_waste_west", zone: "waste", x: -96, z: -30, kind: "cache", loot: [["cons_last_rites", 1], ["mat_grave_iron", 2], ["coin_crown", 100]], text: "A reliquary, dropped by pilgrims who ran. The ash has not got in." },
  { id: "c_waste_east", zone: "waste", x: 98, z: 44, kind: "cache", loot: [["cons_greater_draught", 2], ["mat_grave_dust", 3], ["coin_crown", 110]], text: "A gravedigger's lockbox. He was paid in advance, and often." },
  { id: "c_waste_north", zone: "waste", x: -58, z: 104, kind: "cache", loot: [["mat_grave_iron", 3], ["mat_bone", 4], ["coin_crown", 120]], text: "Tribute meant for the Citadel, abandoned within sight of the gate." },
  { id: "s_waste_king", zone: "waste", x: 64, z: -88, kind: "stone", text: "\"He would not be buried, so he ordered that no one else be either. The realm obeyed. Look around you.\"" },
  { id: "s_waste_caldus", zone: "waste", x: -84, z: 52, kind: "stone", text: "\"One brother stayed to say the rites. He has said them eleven thousand times. He is not finished.\"" },
];

export const CACHES = FINDS.filter((f) => f.kind === "cache").length;
export const STONES = FINDS.filter((f) => f.kind === "stone").length;

export type Bounty = { id: string; name: string; kinds: string[]; n: number; level: number; crowns: number; item?: [string, number]; text: string };

export const BOUNTIES: Bounty[] = [
  { id: "b_wolf", name: "Thin the Pack", kinds: ["wolf"], n: 5, level: 1, crowns: 25, item: ["cons_bandage", 2], text: "Wolves are taking lambs. Kill 5." },
  { id: "b_goblin", name: "Goblin Ears", kinds: ["goblin"], n: 6, level: 1, crowns: 30, item: ["cons_bandage", 2], text: "The forest goblins are bold again. Kill 6." },
  { id: "b_redcap", name: "Red Caps, Red Hands", kinds: ["redcap"], n: 2, level: 2, crowns: 45, item: ["cons_draught", 1], text: "Two redcaps were seen on the hill path. Kill 2." },
  { id: "b_toys", name: "Put the Toys Away", kinds: ["soldier", "mouse"], n: 8, level: 3, crowns: 50, item: ["cons_draught", 1], text: "Tin soldiers and clockwork mice. Break 8." },
  { id: "b_bandit", name: "Road Tax", kinds: ["bandit"], n: 6, level: 5, crowns: 70, item: ["cons_draught", 1], text: "Bandits are charging tolls on the Kingsroad. Kill 6." },
  { id: "b_deserter", name: "Colours Struck", kinds: ["deserter"], n: 4, level: 6, crowns: 85, item: ["cons_stew", 1], text: "Deserters still wear the March's colours. Kill 4." },
  { id: "b_hound", name: "Loose Hounds", kinds: ["hound", "kennel_hound", "blackwolf"], n: 7, level: 8, crowns: 100, item: ["cons_draught", 2], text: "The King's hounds answer to no one now. Kill 7." },
  { id: "b_boar", name: "Tusk Bounty", kinds: ["boar"], n: 4, level: 8, crowns: 95, item: ["cons_roast", 2], text: "Blackwood boars have gored two foresters. Kill 4." },
  { id: "b_drowned", name: "Quiet the Bells", kinds: ["drowned"], n: 6, level: 11, crowns: 130, item: ["cons_rot_tonic", 2], text: "The drowned walk the causeway at dusk. Kill 6." },
  { id: "b_croc", name: "Mire Leather", kinds: ["croc"], n: 3, level: 11, crowns: 140, item: ["cons_greater_draught", 1], text: "Marsh crocodiles under the boardwalks. Kill 3." },
  { id: "b_keep", name: "Stand Down", kinds: ["black_guard", "keep_knight", "crypt_dead"], n: 6, level: 14, crowns: 170, item: ["cons_greater_draught", 1], text: "The Keep's garrison never got the order. Give it. Kill 6." },
  { id: "b_skeleton", name: "Bone Count", kinds: ["skeleton", "zombie"], n: 10, level: 17, crowns: 210, item: ["cons_last_rites", 1], text: "Brother Caldus counts the unburied. Lower the number by 10." },
  { id: "b_ghost", name: "Unfinished Business", kinds: ["ghost", "necromancer"], n: 5, level: 18, crowns: 240, item: ["cons_last_rites", 1], text: "Ghosts and the ones who call them. Kill 5." },
  { id: "b_knight", name: "Dead Men's Honour", kinds: ["undead_knight"], n: 4, level: 20, crowns: 280, item: ["cons_greater_draught", 2], text: "The Citadel's knights still hold their posts. Relieve 4." },
];

export const dayStamp = (d = new Date()) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;

/** Three bounties for the day: the same for everyone at a level band, nothing far above the player. */
export function pickBounties(day: string, level: number): string[] {
  const pool = BOUNTIES.filter((b) => b.level <= level + 2);
  // prefer the ones nearest the player's level
  pool.sort((a, b) => Math.abs(a.level - level) - Math.abs(b.level - level));
  const near = pool.slice(0, Math.min(pool.length, 6));
  let h = 2166136261;
  for (const ch of day) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  const out: string[] = [];
  while (out.length < Math.min(3, near.length)) {
    h = (Math.imul(h, 1664525) + 1013904223) >>> 0;
    const b = near[h % near.length];
    if (!out.includes(b.id)) out.push(b.id);
  }
  return out;
}
