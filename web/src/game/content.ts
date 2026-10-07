/**
 * Slice data. Items, recipes, foes, nodes, quests, shops, bosses and zones live in ./data and are
 * shared with the server (server/gen-seed.mjs); this file keeps the words and re-exports the rest.
 */
export { ITEMS, RECIPES, DESCRIPTIONS, RARITY_COLOR, SET_BONUS, type ItemDef, type RecipeDef, type Slot, type Rarity } from "./data/items.ts";
export { MOB_LOOT, MOB_SPAWNS, NODE_DEFS, CACHES, CACHE_DEFS, type Spawn, type NodeData } from "./data/world.ts";

export const SPEEDS = { walk: 4.2, sprint: 6.4, cap: 7 };

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

/** The sim's Cookie has 180. The browser fight is longer because a phone player has no lock-on; see KNOWN_ISSUES WEB-2. */
export const COOKIE_HP = 280;
export const BOE_HP = 120;

export const MORE_LINES: Record<string, string[]> = {
  tanicHello: [
    "You're awake. Good. The bell does not ring for nothing, and it rang for you.",
    "No name on you, no mark. The seals do not know you. That makes you useful, and in danger.",
    "Flint in the creek north of the palisade. Wood from the fallen limbs. Two flint and a stick make a knife. Make one.",
  ],
  tanicKnife: [
    "That is an edge. Ugly, honest. Good.",
    "Hold out your hand.",
  ],
  tanicAfter: [
    "That hill to the north was a nursery before it was a castle. Do not answer the box.",
    "If you want better than flint, bring copper from the creek to Mara's forge. You'll want a stone pick first.",
  ],
  tanicCookie: [
    "The bell carried all the way here. So did the quiet after it.",
    "The Green Gate is east, over the Kingsbridge. It answers a core, not a wish.",
  ],
  mara: ["Bench is past the forge. Copper goes in my fire, not on a bench.", "Don't bring me a story. Bring me copper."],
  penn: ["The hives are restless since the castle started singing again.", "Smoke and I fall out. Bees and I don't."],
  bramble: ["Palisade holds. Mostly.", "Wolves at the tree line every dusk. Keep your back to the stakes."],
  sera: ["Wolves circle before they jump. Watch the crouch.", "Goblins took the old forester's clearing, west of the path. Stilts, bones, our washing."],
  corrin: ["Trade's honest here. Mostly.", "Bone for bandages, leather for copper. The road's closed, so I deal in what walks."],
  child: ["Caller Cookie, button and bow, count the toys and don't be slow."],
  childAfter: ["The toys stopped. We made a new rhyme. It's about you. It's rude."],
  villager: ["Morning.", "The bell's been odd since spring.", "Mind the mud.", "Have you seen my goat?"],
  voss: ["Harrenvale keeps its own oath, and the oath is closed to you.", "The bells carried. Walk the wheat. The fortress is not yours. Not yet."],
  guard: ["Road's closed past the barricade.", "Castellan's orders."],
  shrine: ["Old stone, still warm. You will wake here now if you fall."],
  gateShut: ["The gate hums. A seal holds it, green and old. It does not answer you."],
  gateOpen: ["The Green Gate is open. The kingdom is not a painting anymore."],
  noEdge: ["You want an edge before that hill. Tanic said so, and he was right."],
  horseDoor: ["The door will not budge while the rocking horse still rocks."],
  weight: ["A brass weight on rails. The plate by the slab looks hungry."],
};

export type Trade = { id: string; give: { id: string; n: number }[]; get: { id: string; n: number }; label: string };
export const TRADES: Trade[] = [
  { id: "t_bandage", give: [{ id: "mat_bone", n: 2 }], get: { id: "cons_bandage", n: 1 }, label: "2 Bone → Bandage" },
  { id: "t_copper", give: [{ id: "mat_leather", n: 2 }], get: { id: "mat_copper", n: 2 }, label: "2 Leather → 2 Copper" },
  { id: "t_flint", give: [{ id: "mat_wood", n: 3 }], get: { id: "mat_flint", n: 2 }, label: "3 Wood → 2 Flint" },
  { id: "t_fibre", give: [{ id: "mat_stone", n: 2 }], get: { id: "mat_fibre", n: 3 }, label: "2 Stone → 3 Fibre" },
];

export const COOKIE_REWARDS = ["wpn_cookie_blade", "wpn_cookie_pick", "key_cookie_core"];
export const WORLD_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
