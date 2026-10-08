import { ZONES } from "../../data/zones.ts";
import type { NpcDef, Stop } from "../../play/npcs";

/**
 * Drear's people. Stops are written in the Mire's local coordinates and shifted to world x
 * (ZONES.mire.ox + x) below. Every stop stands on the boardwalks that world/zones/mire.ts builds:
 * the village deck (x -48..-32, z 51..73), the jetty (x -35, z 73..88), the walk to the causeway
 * (z 62) and the hut doors. Mother Phem keeps to her kettle, Liss to her counter; the rest watch you.
 */

const X = ZONES.mire.ox;
const S = (x: number, z: number, wait: number, act?: Stop["act"], face?: number): Stop => ({ x: X + x, z, wait, act, face });
const H = (x: number, z: number) => ({ x: X + x, z });
const PI = Math.PI;
/** yaw that faces from (x, z) toward (tx, tz) */
const look = (x: number, z: number, tx: number, tz: number) => Math.atan2(tx - x, tz - z);

export const MIRE_NPCS: NpcDef[] = [
  {
    id: "phem", name: "Mother Phem", role: "Sacristan of Drear",
    look: { skin: 0xd6bea6, hair: 0xd8d2c6, hairStyle: "hood", shirt: 0x4a4a3a, coat: 0x2a2e26, coatLong: true, trousers: 0x2a2620, boots: 0x1c1814, belt: 0x3a2a1c, apron: 0x5a5444, frame: 0.88, height: 1.58, pin: true },
    stops: [
      S(-46.6, 64.0, 22, "gather", look(-46.6, 64.0, -46.0, 65.8)),
      S(-44.8, 62.2, 8, "talk", look(-44.8, 62.2, -40, 60)),
      S(-46.6, 64.0, 14, "gather", look(-46.6, 64.0, -46.0, 65.8)),
      S(-49.4, 64.0, 6, "none", PI / 2),
      S(-37.4, 53.4, 7, "none", look(-37.4, 53.4, -36, 52.3)),
    ],
    night: "stay",
    speed: 0.8,
    zone: "mire",
    lines: [
      "I rang the bells for forty years. Now I listen for them.",
      "The water takes the dead and gives back the ones it didn't like.",
      "Rotcap for the fever, widow's veil for the grief. Don't mix them up. People have.",
      "I am the last sacristan of a drowned church. I keep the candles. Somebody has to.",
      "Sit, if you like. The kettle is older than the Keep and twice as honest.",
    ],
    after: { flag: "finlay", lines: ["The banners came down. I heard it from here. Black cloth makes no sound, and still I heard it.", "Go home, child. Drear will ring a bell for you. A clean one."] },
  },
  {
    id: "liss", name: "Liss", role: "Boat trader",
    look: { skin: 0xc49a78, hair: 0x6a3a1e, hairStyle: "tied", shirt: 0x7a6a52, coat: 0x3e4a3a, trousers: 0x3a3026, boots: 0x231d18, belt: 0x2a1a10, frame: 0.95, height: 1.7 },
    stops: [
      S(-40.0, 68.6, 26, "none", PI),
      S(-36.2, 78.0, 8, "gather", look(-36.2, 78.0, -32.6, 80)),
      S(-40.0, 68.6, 18, "none", PI),
      S(-34.0, 86.6, 6, "none", 0),
    ],
    night: "stay",
    speed: 1.2,
    zone: "mire",
    lines: [
      "Tonic, draughts, rope, eels. Coin first. The water doesn't give credit and neither do I.",
      "Don't lean on the rail. There isn't one.",
      "My boat goes anywhere but south. Nobody's boat goes south.",
      "If you hear a bell from the water, don't answer it. Not even to say no.",
    ],
    after: { flag: "finlay", lines: ["I took the boat halfway to the Keep this morning. Halfway. That's further than anyone's been in years."] },
  },
  {
    id: "tam", name: "Tam Hollin", role: "Lamp-keeper",
    look: { skin: 0xcaa688, hair: 0x2a2620, hairStyle: "short", shirt: 0x6a6656, coat: 0x34382e, trousers: 0x2e2a24, boots: 0x1c1814, frame: 0.9, height: 1.8, beard: true },
    stops: [
      S(-17.5, 62.0, 9, "none", -PI / 2),
      S(-31.0, 62.0, 5, "none", look(-31, 62, -32.6, 72.4)),
      S(-33.0, 71.6, 6, "gather", look(-33, 71.6, -32.6, 72.4)),
      S(-46.6, 52.2, 6, "gather", look(-46.6, 52.2, -47.4, 51.6)),
      S(-35.0, 87.0, 8, "none", 0),
    ],
    night: "stay",
    hold: "lantern",
    speed: 1.0,
    zone: "mire",
    lines: [
      "Lamps on the walk. Always. The drowned don't like a lit plank.",
      "You came down the causeway. Did anything follow you? Look again.",
      "Black banners on the Keep road. New ones. Somebody's still sewing over there.",
      "There's a bell under the chapel that rings when the water's still. It was still last night.",
    ],
  },
  {
    id: "wenda", name: "Wenda", role: "Net-mender",
    look: { skin: 0xd8b8a0, hair: 0x4a3a2a, hairStyle: "long", shirt: 0x7a705a, coat: 0x4a4636, trousers: 0x3a3428, boots: 0x231d18, apron: 0x5a5040, frame: 0.92, height: 1.64 },
    stops: [
      S(-27.6, 68.0, 16, "gather", -PI / 2),
      S(-33.4, 66.4, 10, "gather", look(-33.4, 66.4, -40, 64)),
      S(-38.6, 60.4, 6, "none", look(-38.6, 60.4, -35.2, 58.6)),
    ],
    night: H(-27.0, 68.0),
    speed: 0.9,
    zone: "mire",
    lines: [
      "Nets come up with rings in them. Wedding rings. I throw them back.",
      "Stranger. We had a stranger once. He wore black and asked the way to the Keep.",
      "Don't say his name on the boards. Say it on the causeway, if you must. Quietly.",
      "My husband went to ring the drowned bell. Phem says he's resting. Phem says a lot.",
    ],
  },
  {
    id: "gorse", name: "Gorse", role: "Eel-fisher",
    look: { skin: 0xb88a6a, hair: 0x8a8070, hairStyle: "bald", shirt: 0x5a5444, coat: 0x2e3428, trousers: 0x2a2620, boots: 0x161210, frame: 1.08, height: 1.76, beard: true },
    stops: [
      S(-36.0, 84.0, 18, "gather", PI / 2),
      S(-34.0, 75.0, 8, "none", look(-34, 75, -37.6, 84)),
      S(-35.6, 56.8, 9, "gather", look(-35.6, 56.8, -34.2, 55.6)),
    ],
    night: H(-44.0, 77.0),
    speed: 1.0,
    zone: "mire",
    lines: [
      "Eels are fat this year. I don't ask what on.",
      "Finlay. There. I said it. Now go away before something hears.",
      "The Keep's got its own weather. Rains on that rock when it's dry here.",
      "You've a sword. Good. Keep it out of the water. Things take hold of what you dangle.",
    ],
    after: { flag: "finlay", lines: ["The rain's stopped over the Keep. First time I can remember. Doesn't feel right. Feels better."] },
  },
  {
    id: "nell", name: "Nell Abb", role: "Widow",
    look: { skin: 0xe2c8b0, hair: 0x9a9286, hairStyle: "hood", shirt: 0x3a3a34, coat: 0x1e201c, coatLong: true, trousers: 0x2a2620, boots: 0x1c1814, frame: 0.86, height: 1.6 },
    stops: [
      S(-37.6, 54.6, 14, "none", look(-37.6, 54.6, -36, 52.3)),
      S(-50.8, 53.0, 10, "none", -PI / 2),
      S(-42.6, 70.2, 8, "none", look(-42.6, 70.2, -47.3, 71.4)),
    ],
    night: H(-51.0, 53.0),
    speed: 0.75,
    zone: "mire",
    lines: [
      "That bell on the post is the only clean one left. We polish it. It's all we've got.",
      "The drowned walk the boards at every hour. Mine walks at four. I don't open the door.",
      "They hang new banners on the Keep road every spring. Nobody sees who.",
      "You smell of dry land. Enjoy it. It doesn't last down here.",
    ],
  },
];
