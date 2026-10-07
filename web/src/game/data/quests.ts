import type { ZoneId } from "./zones";

/**
 * Quests are data. Each step is one checkable condition; the server checks it again before a
 * step advances and pays the reward exactly once. Shared with the server (vm_quests is seeded
 * from this file).
 *
 * Step kinds:
 *   talk   speak to `npc` (the client reports it)
 *   cflag  a character flag the story sets (talked to Tanic, learned Ember)
 *   have   carry `n` of `item` (`a|b|c` accepts any of them)
 *   give   hand `n` of `item` to `npc` (they are taken)
 *   kill   kill `n` of `kind` after the step begins
 *   reach  stand in `zone` (within `r` of x, z when given)
 *   flag   the world has `flag` set (doors, gates, bosses)
 *   boss   you were paid for `boss` in this world
 *   level  reach level `n`
 */

export type StepKind = "talk" | "cflag" | "have" | "give" | "kill" | "reach" | "flag" | "boss" | "level";

export type QuestStep = {
  k: StepKind;
  text: string;
  sub: string;
  npc?: string;
  flag?: string;
  item?: string;
  n?: number;
  kind?: string;
  boss?: string;
  zone?: ZoneId;
  x?: number;
  z?: number;
  r?: number;
};

export type QuestDef = {
  id: string;
  name: string;
  /** main story quests start on their own when the one before is done */
  main: boolean;
  giver: string;
  /** what the giver says when offering it */
  offer: string[];
  /** what the giver says when it is done */
  thanks: string[];
  requires: string[];
  level: number;
  /** a world flag the giver sets when the quest starts (the Castellan's writ opens the causeway) */
  startFlag?: string;
  steps: QuestStep[];
  rewards: { xp: number; crowns: number; items: [string, number][] };
};

const EDGE = "wpn_stone_knife|wpn_copper_sword|wpn_iron_sword|wpn_iron_axe|wpn_iron_mace|wpn_iron_spear|wpn_steel_sword|wpn_steel_dagger|wpn_steel_greatsword|wpn_cookie_blade|wpn_smacko";

export const QUESTS: QuestDef[] = [
  // ------------------------------------------------------------ the main road
  {
    id: "q_bell", name: "The Bell Rang", main: true, giver: "tanic", requires: [], level: 1,
    offer: [], thanks: [],
    steps: [
      { k: "cflag", flag: "talked", npc: "tanic", text: "Speak to Tanic", sub: "Workshop lane, west of the bell" },
      { k: "have", item: EDGE, n: 1, text: "Make an edge", sub: "Two flint and a stick make a Stone Knife. Bag → Craft." },
      { k: "cflag", flag: "ember", npc: "tanic", text: "Show Tanic your knife", sub: "Workshop lane" },
    ],
    rewards: { xp: 80, crowns: 10, items: [] },
  },
  {
    id: "q_cookie", name: "Caller Cookie", main: true, giver: "tanic", requires: ["q_bell"], level: 1,
    offer: [], thanks: [],
    steps: [
      { k: "reach", zone: "castle", text: "Find Cookie's Castle", sub: "North through the Giant Forest, up the hill" },
      { k: "flag", flag: "slab", text: "Move the brass weight", sub: "Push it onto the plate, or heave it" },
      { k: "flag", flag: "nursery", text: "Silence the rocking horse", sub: "The toy gallery" },
      { k: "boss", boss: "cookie", text: "Defeat Cookie", sub: "The nursery courtyard. Dodge the bow." },
    ],
    rewards: { xp: 250, crowns: 40, items: [] },
  },
  {
    id: "q_gate", name: "The Green Gate", main: true, giver: "tanic", requires: ["q_cookie"], level: 1,
    offer: [], thanks: [],
    steps: [
      { k: "flag", flag: "gate", text: "Take the Core to the Green Gate", sub: "East of Hearthfen, over the Broken Kingsbridge" },
      { k: "reach", zone: "kingdom", x: -40, z: 0, r: 40, text: "Walk the Kingsroad to Harrenvale", sub: "East through the barricade, then the wheat" },
      { k: "talk", npc: "voss", text: "Speak to Castellan Voss", sub: "His hall at the top of Harrenvale" },
    ],
    rewards: { xp: 200, crowns: 60, items: [["cons_draught", 1]] },
  },
  {
    id: "q_collar", name: "The Red Collar", main: true, giver: "elspeth", requires: ["q_gate"], level: 5,
    offer: [
      "You came in over the Kingsroad. Did you hear barking, up in the north woods?",
      "There was a dog. A black cocker, a red collar. The royal kennels took him for the hunt and something got into the kennels.",
      "He was not mine. He was never mine. Bring the collar back, if you find it.",
    ],
    thanks: ["That's his collar. That's his tag.", "He was a good dog. He was always a good dog.", "Take this. It's his bell. Hounds remember it."],
    steps: [
      { k: "reach", zone: "hunt", text: "Go north to the King's Hunting Grounds", sub: "Through Harrenvale's north gate, up the hunters' road" },
      { k: "reach", zone: "kennel", text: "Find the Royal Kennels", sub: "A cave mouth in Blackwood, north of the lodge" },
      { k: "kill", kind: "kennelmaster", n: 1, text: "Defeat the Kennelmaster", sub: "He keeps the inner gate" },
      { k: "boss", boss: "boe", text: "Face Boe", sub: "The kennel-cave. Don't greed the lick." },
      { k: "give", item: "key_red_collar", n: 1, npc: "elspeth", text: "Return the collar to Elspeth", sub: "Her house by Harrenvale's west wall" },
    ],
    rewards: { xp: 600, crowns: 150, items: [["trk_hound_bell", 1]] },
  },
  {
    id: "q_causeway", name: "The Causeway", main: true, giver: "voss", requires: ["q_collar", "q_oath"], level: 8, startFlag: "causeway",
    offer: [
      "The kennels were the King's. The man who emptied them was a captain of the March: Finlay. The ledger has his name.",
      "He holds the Black Keep, south across the Mire. I will break my own seal on the causeway. Do not make me regret wax.",
      "Find Mother Phem in Drear. She knows the water better than the water does.",
    ],
    thanks: ["Phem sent word. You're still breathing. Good."],
    steps: [
      { k: "reach", zone: "mire", text: "Take the causeway into the Dark Mire", sub: "South through Harrenvale's lower gate" },
      { k: "talk", npc: "phem", text: "Find Mother Phem", sub: "Drear, the stilt hamlet" },
      { k: "give", item: "herb_rotcap", n: 3, npc: "phem", text: "Bring Mother Phem three rotcap", sub: "It grows on what drowned" },
      { k: "kill", kind: "drowned", n: 4, text: "Lay four of the drowned to rest", sub: "They walk the boardwalks at every hour" },
      { k: "talk", npc: "phem", text: "Return to Mother Phem", sub: "Drear" },
    ],
    rewards: { xp: 700, crowns: 200, items: [["cons_rot_tonic", 3]] },
  },
  {
    id: "q_keep", name: "The Black Keep", main: true, giver: "phem", requires: ["q_causeway"], level: 11,
    offer: [
      "Finlay. Stocky, blonde, angry. He walked into that keep in black armour and never came out.",
      "He says a thing to people before he kills them. Get out of the circle when he says it.",
    ],
    thanks: [],
    steps: [
      { k: "reach", zone: "keep", text: "Cross to the Black Keep", sub: "The island at the Mire's south end" },
      { k: "kill", kind: "black_guard", n: 3, text: "Break the Keep's guard", sub: "Outer bailey and courtyard" },
      { k: "reach", zone: "keep", x: 0, z: 100, r: 14, text: "Climb to the throne", sub: "Through the crypt, past the throne room" },
      { k: "boss", boss: "finlay", text: "Defeat Finlay", sub: "The broken ring. Leave the circle when he speaks." },
    ],
    rewards: { xp: 1200, crowns: 400, items: [] },
  },

  // ------------------------------------------------------------ side roads
  {
    id: "q_oath", name: "The Castellan's Oath", main: false, giver: "voss", requires: ["q_gate"], level: 4,
    offer: ["Harrenvale keeps its own oath. The road keeps none. Bandits camp in the old quarry road south-east.", "Five of them, and the road is ours again."],
    thanks: ["The road is quiet. The oath notices.", "Elspeth has been asking for anyone with an edge. Her house is by the west wall."],
    steps: [
      { k: "kill", kind: "bandit", n: 5, text: "Clear the Kingsroad bandits", sub: "Their camp is south-east of Harrenvale" },
      { k: "talk", npc: "voss", text: "Report to Castellan Voss", sub: "His hall at the top of town" },
    ],
    rewards: { xp: 300, crowns: 120, items: [] },
  },
  {
    id: "q_wolves", name: "Wolves at Dusk", main: false, giver: "sera", requires: ["q_bell"], level: 1,
    offer: ["Wolves circle before they jump. Five of them and the children can play past the stakes again."],
    thanks: ["Five. I counted. Here, hides for your trouble."],
    steps: [
      { k: "kill", kind: "wolf", n: 5, text: "Thin the wolves", sub: "The forest north of Hearthfen" },
      { k: "talk", npc: "sera", text: "Tell Sera", sub: "By the north stakes" },
    ],
    rewards: { xp: 120, crowns: 25, items: [["mat_leather", 2]] },
  },
  {
    id: "q_mara", name: "Copper for Mara", main: false, giver: "mara", requires: ["q_bell"], level: 2,
    offer: ["Don't bring me a story. Bring me four copper and I'll owe you."],
    thanks: ["Good green copper. Here. That's what owing looks like."],
    steps: [{ k: "give", item: "mat_copper", n: 4, npc: "mara", text: "Bring Mara four copper", sub: "Creek veins need a Stone Pick" }],
    rewards: { xp: 110, crowns: 30, items: [["cons_bandage", 2]] },
  },
  {
    id: "q_penn", name: "Smoke and Bees", main: false, giver: "penn", requires: [], level: 1,
    offer: ["The hives want new smoke-wicks. Four fibre, if you're passing."],
    thanks: ["The bees will thank you by not stinging you. Mostly."],
    steps: [{ k: "give", item: "mat_fibre", n: 4, npc: "penn", text: "Bring Old Penn four fibre", sub: "Nettle and flax by the paths" }],
    rewards: { xp: 60, crowns: 15, items: [] },
  },
  {
    id: "q_coal", name: "Coal for the Forge", main: false, giver: "holt", requires: ["q_gate"], level: 4,
    offer: ["Quarry's on the east hill. Four coal and I'll fold you a steel ingot. A copper pick will break it loose."],
    thanks: ["Black and dry. Here's your steel."],
    steps: [{ k: "give", item: "mat_coal", n: 4, npc: "holt", text: "Bring Holt four coal", sub: "The quarry on Harrenvale's east hill" }],
    rewards: { xp: 150, crowns: 50, items: [["mat_steel", 1]] },
  },
  {
    id: "q_patrol", name: "The Missing Patrol", main: false, giver: "maree", requires: ["q_gate"], level: 6,
    offer: ["Six of the watch walked north-east a week ago and three came back. They say deserters took the old beacon.", "Go and see. Bring them back if you can. If you can't, bring back that you tried."],
    thanks: ["Then it's done. I'll write their names. Take these; you look like you need them."],
    steps: [
      { k: "reach", zone: "kingdom", x: 100, z: 92, r: 24, text: "Find the old beacon", sub: "North-east of Harrenvale" },
      { k: "kill", kind: "deserter", n: 3, text: "Deal with the deserters", sub: "At the beacon" },
      { k: "talk", npc: "maree", text: "Tell Sister Maree", sub: "The infirmary by the church" },
    ],
    rewards: { xp: 350, crowns: 90, items: [["cons_draught", 2]] },
  },
  {
    id: "q_hounds", name: "Feral Hounds of Millcross", main: false, giver: "aldo", requires: ["q_gate"], level: 5,
    offer: ["Hounds from the royal kennels, gone wild. They take a sheep a night. Four of them, maybe more."],
    thanks: ["Quiet nights. Here, take bread. Take two."],
    steps: [
      { k: "kill", kind: "hound", n: 4, text: "Drive off the feral hounds", sub: "Around Millcross mill, south-west" },
      { k: "talk", npc: "aldo", text: "Tell Aldo", sub: "Millcross" },
    ],
    rewards: { xp: 200, crowns: 60, items: [["cons_bread", 3]] },
  },
  {
    id: "q_stew", name: "Stew for the Watch", main: false, giver: "odo", requires: ["q_gate"], level: 4,
    offer: ["The night watch eats like a cavalry. Three roasts and I'll pay you better than I pay them."],
    thanks: ["Still warm. You can cook. Don't tell the watch."],
    steps: [{ k: "give", item: "cons_roast", n: 3, npc: "odo", text: "Bring Odo three roasts", sub: "Raw meat on the Gilded Ox's hearth" }],
    rewards: { xp: 160, crowns: 70, items: [] },
  },
  {
    id: "q_hides", name: "Hide for Brannoc", main: false, giver: "brannoc", requires: ["q_gate"], level: 7,
    offer: ["Royal hounds had hides like boiled leather. Three of those and I'll make you gloves you won't take off."],
    thanks: ["These will do. These will more than do."],
    steps: [{ k: "give", item: "mat_hound_hide", n: 3, npc: "brannoc", text: "Bring Brannoc three hound hides", sub: "Blackwood wolves and the kennel hounds" }],
    rewards: { xp: 260, crowns: 90, items: [["arm_hound_hands", 1]] },
  },
  {
    id: "q_witches", name: "The Bell Witches", main: false, giver: "liss", requires: ["q_causeway"], level: 11,
    offer: ["Two witches have taken to ringing the drowned bells at dusk. Every time they do, someone in Drear doesn't wake.", "Make them stop. I'll make it worth the walk."],
    thanks: ["No bells last night. Drear slept. Here."],
    steps: [
      { k: "kill", kind: "witch", n: 2, text: "Silence two bell witches", sub: "Their huts stand in the witch pools" },
      { k: "talk", npc: "liss", text: "Tell Liss", sub: "Her boat at Drear" },
    ],
    rewards: { xp: 500, crowns: 160, items: [["cons_greater_draught", 1]] },
  },
];

export const QUEST_BY_ID: Record<string, QuestDef> = Object.fromEntries(QUESTS.map((q) => [q.id, q]));
