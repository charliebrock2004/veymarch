import { ZONES } from "../../data/zones.ts";
import type { NpcDef, Stop } from "../../play/npcs";

/**
 * Harrenvale's people. Stops are written in the zone's local coordinates here and shifted to
 * world x (ZONES.kingdom.ox + x) below; every spot matches a counter, door or street that
 * world/zones/kingdom.ts builds (doors are the cottage door anchors: centre + door offset).
 * Shopkeepers keep to their counters by day and go home at night; the watch never goes home.
 */

const X = ZONES.kingdom.ox;
const S = (x: number, z: number, wait: number, act?: Stop["act"], face?: number): Stop => ({ x: X + x, z, wait, act, face });
const H = (x: number, z: number) => ({ x: X + x, z });

const PI = Math.PI;
/** yaw that faces from (x, z) toward (tx, tz) */
const look = (x: number, z: number, tx: number, tz: number) => Math.atan2(tx - x, tz - z);

/** the watch's kit: Kingdom slate-blue over grey */
const watch = (skin: number, hair: number, beard = false) => ({
  skin, hair, hairStyle: "short" as const, shirt: 0x6e7378, coat: 0x2f3a4a, trousers: 0x2a2622, boots: 0x1c1916, belt: 0x231d18, frame: 1.05, beard,
  armour: { head: "iron" as const },
});

const BASE: NpcDef[] = [
  // ------------------------------------------------------------ the eight the quests and shops need
  {
    id: "voss", name: "Castellan Voss", role: "Castellan of Harrenvale",
    look: { skin: 0xd8b8a0, hair: 0x2a2622, hairStyle: "short", shirt: 0x6e7378, coat: 0x1c1a1a, coatLong: true, trousers: 0x221e1c, boots: 0x161210, belt: 0x0e0c0a, cape: 0x2f3a4a, frame: 1.1, height: 1.92, beard: true, pin: true },
    stops: [
      S(3.2, 32.6, 28, "none", -PI / 2),
      S(1.6, 40.2, 9, "none", 0),
      S(3.0, 31.2, 14, "none", -PI / 2),
      S(1.8, 21.5, 6, "talk", -PI / 2),
    ],
    // the Castellan keeps his own porch at night (and the main road's business needs him findable)
    night: "stay",
    speed: 1.15,
    zone: "kingdom",
    lines: [
      "Harrenvale keeps its gates and its accounts. Both balance.",
      "The March-Seal is wax and a promise. People forget which part holds.",
      "Wipe your boots. The hall floor was my predecessor's one indulgence.",
      "The fortress sends orders down the hill. I send back what is possible.",
    ],
    after: { flag: "finlay", lines: ["The ledger has one name fewer. I struck it out myself.", "The causeway stays open. I am told that is called trust."] },
  },
  {
    id: "elspeth", name: "Elspeth", role: "By the west wall",
    look: { skin: 0xe2c8b0, hair: 0xbab2a6, hairStyle: "tied", shirt: 0xcdbba6, coat: 0x5a4a5a, trousers: 0x4a4036, boots: 0x2a2018, apron: 0x8a7a62, frame: 0.92, height: 1.64 },
    stops: [
      S(-32, 24, 14, "gather", look(-32, 24, -33.4, 21.6)),
      S(-30.4, 21.6, 8, "sweep", PI / 4),
      S(-25.4, 25.4, 6, "talk", PI / 4),
      S(-31.8, 26.4, 10, "none", look(-31.8, 26.4, 0, 0)),
    ],
    night: H(-25.6, 25.6),
    speed: 0.85,
    zone: "kingdom",
    lines: [
      "Mind the cabbages. They're the only thing in this town that does as it's told.",
      "The kennel men used to bring the hounds through the north gate. You heard them before you saw them.",
      "I don't sleep much. The north woods are loud at night.",
    ],
    after: { flag: "boe", lines: ["I hung his bell by the door. The wind rings it. That's enough.", "He'd have liked you. He liked everybody. That was the trouble."] },
  },
  {
    id: "holt", name: "Holt", role: "Blacksmith",
    look: { skin: 0xc89a7a, hair: 0x3a2a1c, hairStyle: "bald", shirt: 0x8a7a6a, coat: 0x5a3b2a, trousers: 0x3a3026, boots: 0x2a2018, apron: 0x3e2c20, belt: 0x2a1a10, frame: 1.22, height: 1.82, beard: true },
    // the smithy's frame is turned 1.0123 rad: the anvil and the hearth lie toward yaw -2.129
    stops: [
      S(-16.38, 15.99, 20, "hammer", -2.129),
      S(-18.42, 17.66, 6, "none", -2.129),
      S(-16.38, 15.99, 14, "hammer", -2.129),
      S(-18.62, 15.06, 8, "talk", look(-18.62, 15.06, -18, 14)),
    ],
    hold: "hammer",
    night: H(-20.97, 9.47),
    zone: "kingdom",
    lines: [
      "Coal. Always coal. The quarry gives it up like a miser.",
      "Iron from the east hill rings true. Bog iron from the south rings like a liar.",
      "The fortress orders blades by the cartload and pays by the season.",
    ],
    after: { flag: "finlay", lines: ["Black iron from the Keep. I'll work it. I won't like it.", "Somebody asked me to melt down a black helm. I did it at night, with the door shut."] },
  },
  {
    id: "brannoc", name: "Brannoc", role: "Armourer",
    look: { skin: 0xb88a6a, hair: 0x5a4a3a, hairStyle: "short", shirt: 0x6a5a48, coat: 0x4a3a2a, trousers: 0x2e2a26, boots: 0x231d18, apron: 0x5a3a26, belt: 0x231d18, frame: 1.12, height: 1.78, beard: true },
    stops: [
      S(-22.6, -13.6, 18, "none", PI / 2),
      S(-21.2, -15.9, 10, "gather", PI),
      S(-22.6, -13.6, 14, "none", PI / 2),
      S(-17.6, -10.2, 6, "talk", look(-17.6, -10.2, -16.4, -12.6)),
    ],
    night: H(-22.8, -19.5),
    zone: "kingdom",
    lines: [
      "Leather for the road, iron for the March. Nobody buys iron for the road until they've been on it.",
      "Straps rot before plates do. Check your straps.",
      "I fitted the Keep's garrison once. I don't talk about the fit.",
    ],
    after: { flag: "finlay", lines: ["Someone brought me a black gauntlet to resize. I sent it back toward the Mire."] },
  },
  {
    id: "wenna", name: "Wenna", role: "Market trader",
    look: { skin: 0xd8b8a0, hair: 0x8a5a2a, hairStyle: "long", shirt: 0xcdbba6, coat: 0x7a4a3a, trousers: 0x5a4a3a, boots: 0x2a2018, apron: 0xb59a55, frame: 1.0, height: 1.7 },
    stops: [
      S(-8.6, 8.6, 22, "none", look(-8.6, 8.6, -6, 6)),
      S(-5.4, 9.6, 6, "talk", look(-5.4, 9.6, 0, 0)),
      S(-8.6, 8.6, 16, "gather", look(-8.6, 8.6, -6, 6)),
    ],
    night: H(-5.3, 18.5),
    zone: "kingdom",
    lines: [
      "Bread's yesterday's, honest price. Marigold's today's, honest price.",
      "The bandits on the Kingsroad tax my carts better than the Castellan does.",
      "Everything that comes up the causeway smells of the Mire. Even the coins.",
    ],
    after: { flag: "causeway", lines: ["Carts are running south again. Not many. The drivers tie cloths over their faces."] },
  },
  {
    id: "odo", name: "Odo", role: "The Gilded Ox",
    look: { skin: 0xd8a888, hair: 0x9a7a4a, hairStyle: "short", shirt: 0xcdbba6, coat: 0x8a5a3a, trousers: 0x4a4036, boots: 0x2a2018, apron: 0xd8ccb4, frame: 1.25, height: 1.74, beard: true },
    stops: [
      S(20.2, 20.4, 14, "gather", look(20.2, 20.4, 21.6, 19.6)),
      S(17.2, 18.7, 16, "none", PI),
      S(20.2, 20.4, 10, "gather", look(20.2, 20.4, 21.6, 19.6)),
      S(25.6, 18.4, 5, "talk", look(25.6, 18.4, 27.5, 16.8)),
    ],
    night: H(27, 20.1),
    zone: "kingdom",
    lines: [
      "The Ox serves stew to the watch and roast to anyone who pays.",
      "Don't sit in the corner seat. That was Finlay's. Nobody's told the seat.",
      "The fortress cooks buy my bread and call it theirs.",
    ],
    after: { flag: "finlay", lines: ["Somebody finally sat in the corner seat. Nothing happened. I'm almost disappointed."] },
  },
  {
    id: "maree", name: "Sister Maree", role: "The infirmary",
    look: { skin: 0xdcc0a8, hair: 0x6a6258, hairStyle: "hood", shirt: 0xd8d0c0, coat: 0x4a4a5a, coatLong: true, trousers: 0x3a3a40, boots: 0x2a2018, belt: 0xcdbba6, frame: 0.95, height: 1.68 },
    stops: [
      S(21.0, -20.9, 14, "gather", look(21, -20.9, 22.8, -21.6)),
      S(20.8, -19.0, 10, "none", look(20.8, -19, 20, -18)),
      S(12, -18.6, 8, "talk", 0),
      S(21.0, -20.9, 12, "gather", look(21, -20.9, 22.8, -21.6)),
    ],
    night: H(26, -22.1),
    speed: 1.0,
    zone: "kingdom",
    lines: [
      "Wash it, bind it, pray if you like. The washing does the work.",
      "Marigold for wounds, rotcap for the Mire fever. Neither for stupidity.",
      "The patrol that went to the old beacon owes me four bandages and an explanation.",
    ],
    after: { flag: "finlay", lines: ["Fewer of the drowned come up the causeway now. I count it a mercy and a slow week."] },
  },
  {
    id: "aldo", name: "Aldo", role: "Farmer, Millcross",
    look: { skin: 0xc8a088, hair: 0x5a4a3a, hairStyle: "short", shirt: 0xb59a55, coat: 0x6a5a48, trousers: 0x4a4036, boots: 0x3a3026, frame: 1.05, height: 1.76, hat: "straw", beard: true },
    stops: [
      S(-92.4, -58.6, 12, "talk", look(-92.4, -58.6, -96, -66)),
      S(-84.5, -41.5, 14, "gather", PI / 2),
      S(-97.6, -53.2, 8, "none", look(-97.6, -53.2, -101, -49.5)),
      S(-92.4, -58.6, 10, "none", PI),
    ],
    night: H(-89.7, -52),
    zone: "kingdom",
    lines: [
      "The hounds took two ewes and the gate. The gate, mind you.",
      "Mill's turning. That's the good news. The bad news is it turns for the fortress.",
      "When the wind's from the south you can smell the Mire in the flour.",
    ],
    after: { flag: "boe", lines: ["The dogs have gone quiet up north. Mine too. They sleep like they've been forgiven."] },
  },

  // ------------------------------------------------------------ the watch (never home)
  {
    id: "watch1", name: "Watchman Dunn", role: "West gate",
    look: watch(0xc8a088, 0x2a2118, true),
    stops: [S(-38.4, 4.4, 14, "none", -PI / 2), S(-38.4, -4.4, 10, "none", -PI / 2), S(-30, 3.6, 6, "none", PI / 2)],
    night: "stay", hold: "spear", zone: "kingdom",
    lines: [
      "Papers? No. We stopped asking for papers when nobody had any.",
      "Bandits on the Kingsroad again. They wave at us. Cheek.",
      "West gate shuts at dark. Unless the Castellan says otherwise. He doesn't.",
    ],
  },
  {
    id: "watch2", name: "Watchman Kell", role: "North gate",
    look: watch(0xd8b8a0, 0x6a4a2a),
    stops: [S(2.0, 38.8, 14, "none", 0), S(-2.0, 38.8, 10, "none", 0), S(-3.0, 30.5, 5, "none", PI)],
    night: "stay", hold: "spear", zone: "kingdom",
    lines: [
      "The road north climbs under the fortress. Don't wave at the archers.",
      "Hunters' road. Blackwood's past the ridge. The kennel hounds used to come down this way.",
      "Fortress lamps are lit. That means the King's in residence, or wants you to think so.",
    ],
    after: { flag: "boe", lines: ["Quiet up north these nights. I liked the barking better. You knew where it was."] },
  },
  {
    id: "watch3", name: "Watchman Osk", role: "South gate",
    look: watch(0xb88a6a, 0x1c1916, true),
    stops: [S(4.4, -38.4, 14, "none", PI), S(3.6, -62, 10, "none", PI), S(-4.4, -38.4, 8, "none", PI)],
    night: "stay", hold: "spear", zone: "kingdom",
    lines: [
      "The causeway's sealed. Castellan's wax. Touch it and you answer to him.",
      "Smell that? That's the Mire. That's a good day.",
      "A man went down the causeway to fetch his brother. We've got the brother's hat.",
    ],
    after: { flag: "causeway", lines: ["Chain's down. I keep looking at the gap like it might bite.", "Things come up the causeway at night now. Slowly. We count them."] },
  },
  {
    id: "watch4", name: "Watchwoman Garra", role: "Market watch",
    look: { ...watch(0xe2c8b0, 0x5a3a22), hairStyle: "tied", frame: 0.98, height: 1.76 },
    stops: [S(-14, -3.8, 5), S(3.8, -14.5, 5), S(14.5, 3.6, 5), S(3.8, 14.5, 5), S(-1.5, 2.5, 8, "none", PI / 4)],
    night: "stay", hold: "spear", speed: 1.2, zone: "kingdom",
    lines: [
      "Keep to the street. The wall-walk is for people paid to be cold.",
      "Three seals on the March, they say. I've seen one. It was enough.",
      "A captain of the March came through here once. We don't say his name in the Ox.",
    ],
  },

  // ------------------------------------------------------------ townsfolk
  {
    id: "hob", name: "Hob", role: "Carter",
    look: { skin: 0xc8a088, hair: 0x4a3a2a, hairStyle: "short", shirt: 0xa89a72, coat: 0x5a4a3a, trousers: 0x3a3026, boots: 0x2a2018, frame: 1.15, height: 1.8, beard: true },
    stops: [S(13.2, -11.6, 10, "gather", PI / 2), S(4.4, 52, 6), S(28, 60.5, 10, "none", PI / 2), S(4.4, 52, 4), S(2.6, 8, 6, "talk", PI)],
    night: H(21.3, 5),
    zone: "kingdom",
    lines: [
      "Two runs to the quarry and back before noon. The ox does one.",
      "Stone for the fortress, coal for Holt, complaints for free.",
      "There's a camp on the old quarry road. They take a stone a cart as toll. Stones!",
    ],
  },
  {
    id: "nell", name: "Nell", role: "Laundress",
    look: { skin: 0xe2c8b0, hair: 0x9a5a2a, hairStyle: "tied", shirt: 0xd8ccb4, coat: 0x6a7a8a, trousers: 0x5a5040, boots: 0x3a3026, apron: 0xcdbba6, frame: 0.95, height: 1.66 },
    stops: [S(-8.0, -6.4, 12, "gather", look(-8, -6.4, -9.6, -8.6)), S(-21.6, -21.6, 14, "sweep", 0.6), S(-8.0, -6.4, 8, "talk", 0.4)],
    night: H(-20, -22.3),
    zone: "kingdom",
    lines: [
      "The fortress sends its linen down the hill. Bloodstains, mostly old.",
      "Don't hang washing on the south side. The Mire gets into it.",
      "Sister Maree pays in soap. I'm not complaining. I'm noting it.",
    ],
  },
  {
    id: "ivo", name: "Brother Ivo", role: "Church of the March",
    look: { skin: 0xdcc0a8, hair: 0x8a7a6a, hairStyle: "bald", shirt: 0x6a6258, coat: 0x4a4038, coatLong: true, trousers: 0x3a342c, boots: 0x2a2018, belt: 0xcdbba6, frame: 1.0, height: 1.72 },
    stops: [S(12, -18.4, 16, "none", 0), S(6.4, -13.4, 8, "talk", look(6.4, -13.4, 7, -7)), S(16.4, -19.4, 8, "sweep", 0)],
    night: H(12, -18.8),
    speed: 0.9,
    zone: "kingdom",
    lines: [
      "The bell rings for the March's dead on the first of every month. It rings a long time.",
      "Sit, if you like. The Church of the March asks nothing, and accepts coin.",
      "We kept a candle for the Black Keep garrison. Then we stopped.",
    ],
    after: { flag: "finlay", lines: ["We lit the Keep's candle again. Somebody should."] },
  },
  {
    id: "ros", name: "Gammer Ros", role: "Harrenvale",
    look: { skin: 0xdcc0a8, hair: 0xd8d0c4, hairStyle: "hood", shirt: 0xa89a72, coat: 0x5a4a3a, trousers: 0x3a3a3a, boots: 0x2a2018, frame: 0.9, height: 1.58 },
    stops: [S(-2.9, -10.6, 30, "none", 0.3), S(-11.6, 3.8, 10, "talk", 0.6)],
    night: H(-12.31, 33.83),
    speed: 0.6,
    zone: "kingdom",
    lines: [
      "I remember when the seals were new. Everyone said, just for a season.",
      "My knees say rain. My knees have been wrong since the old King.",
      "That fortress was built to watch the March. Now it watches us.",
    ],
  },
  {
    id: "kit", name: "Kit", role: "Child",
    look: { skin: 0xe2c8b0, hair: 0x8a5a2a, hairStyle: "short", shirt: 0xcdbba6, coat: 0x6a5a48, trousers: 0x5a5040, boots: 0x3a3026, height: 1.18, frame: 0.85, headScale: 1.15 },
    stops: [S(1.5, 5.5, 0.5, "cheer"), S(-4.5, 1.5, 0.3), S(-1.0, -4.5, 0.6, "cheer"), S(3.5, 1.0, 0.3), S(-14, 13.4, 3, "none", look(-14, 13.4, -16.5, 16.4))],
    night: H(-31, 4.15),
    speed: 2.5,
    zone: "kingdom",
    lines: [
      "I'm not allowed past the south gate. I went once. It smelled like eggs.",
      "Holt lets me pump the bellows if I'm quiet. I'm never quiet.",
      "Watchman Dunn says there's a ghost dog up north. Is there?",
    ],
  },
];

export const KINGDOM_NPCS: NpcDef[] = BASE;
