/**
 * The world is a set of zones. Each zone is built in its own local coordinates and placed at
 * an origin far from the others, so one number line holds them all: a position's x says which
 * zone it is in (see zoneAt). Only the zone you stand in is drawn and simulated.
 *
 * This file is shared with the server (server/gen-seed.mjs turns portals, shrines and stations
 * into seed rows), so positions here are the truth both sides check against.
 */

export type ZoneId = "over" | "castle" | "kingdom" | "hunt" | "kennel" | "mire" | "keep";

export type ZoneDef = {
  id: ZoneId;
  name: string;
  sub: string;
  /** indoor zones have a roof of darkness, torches and no sky weather */
  indoor: boolean;
  /** world position of this zone's local (0, 0) */
  ox: number;
  /** local bounds the player is kept inside */
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  /** music cue for the music manager */
  music: string;
  /** recommended level, shown on the map */
  level: number;
};

export const ZONES: Record<ZoneId, ZoneDef> = {
  over: { id: "over", name: "Hearthfen & the Giant Forest", sub: "A clearing, not a town", indoor: false, ox: 0, bounds: { minX: -112, maxX: 236, minZ: -72, maxZ: 212 }, music: "hearthfen", level: 1 },
  castle: { id: "castle", name: "Cookie's Castle", sub: "Painted wood, then brass", indoor: true, ox: 1200, bounds: { minX: -40, maxX: 40, minZ: -4, maxZ: 135 }, music: "castle", level: 3 },
  kingdom: { id: "kingdom", name: "The Medieval Kingdom", sub: "Harrenvale and the Kingsroad", indoor: false, ox: 3000, bounds: { minX: -160, maxX: 160, minZ: -170, maxZ: 170 }, music: "kingdom", level: 5 },
  hunt: { id: "hunt", name: "The King's Hunting Grounds", sub: "Blackwood. The hounds ran here once.", indoor: false, ox: 5000, bounds: { minX: -120, maxX: 120, minZ: -150, maxZ: 150 }, music: "blackwood", level: 7 },
  kennel: { id: "kennel", name: "The Royal Kennels", sub: "Collars on hooks. Something still wags.", indoor: true, ox: 7000, bounds: { minX: -30, maxX: 30, minZ: -4, maxZ: 136 }, music: "kennel", level: 8 },
  mire: { id: "mire", name: "The Dark Mire", sub: "Green-black water, bells under it", indoor: false, ox: 9000, bounds: { minX: -140, maxX: 140, minZ: -160, maxZ: 160 }, music: "mire", level: 11 },
  keep: { id: "keep", name: "The Black Keep", sub: "The war that never stood down", indoor: true, ox: 11000, bounds: { minX: -44, maxX: 44, minZ: -4, maxZ: 146 }, music: "keep", level: 14 },
};

export const ZONE_IDS = Object.keys(ZONES) as ZoneId[];

/** Which zone a world position belongs to (zones sit 1000+ m apart on x). */
export function zoneAt(x: number): ZoneId {
  if (x < 700) return "over";
  if (x < 2000) return "castle";
  if (x < 4000) return "kingdom";
  if (x < 6000) return "hunt";
  if (x < 8000) return "kennel";
  if (x < 10000) return "mire";
  return "keep";
}

export const toWorld = (zone: ZoneId, x: number, z: number) => ({ x: ZONES[zone].ox + x, z });
export const toLocal = (zone: ZoneId, x: number, z: number) => ({ x: x - ZONES[zone].ox, z });

// ------------------------------------------------------------------ portals

export type PortalDef = {
  id: string;
  from: ZoneId;
  /** local position in `from` and how close you must be */
  x: number;
  z: number;
  r: number;
  to: ZoneId;
  /** arrival, local to `to` */
  tx: number;
  tz: number;
  tyaw: number;
  label: string;
  /** a world flag that must be set (the server checks it too) */
  flag?: string;
  /** what the door says while it is shut */
  shut?: string;
  /** walk into it rather than press a button (road edges) */
  edge?: boolean;
};

export const PORTALS: PortalDef[] = [
  { id: "over_castle", from: "over", x: 0, z: 163.5, r: 3.2, to: "castle", tx: 0, tz: 4, tyaw: 0, label: "Enter Cookie's Castle" },
  { id: "castle_over", from: "castle", x: 0, z: 2.2, r: 2.4, to: "over", tx: 0, tz: 161, tyaw: Math.PI, label: "Leave the castle" },
  { id: "castle_over_gate", from: "castle", x: 0, z: 117.8, r: 3, to: "over", tx: 0, tz: 161, tyaw: Math.PI, label: "Out to the hill", flag: "cookie" },
  { id: "over_kingdom", from: "over", x: 228, z: 3, r: 7, to: "kingdom", tx: -146, tz: 0, tyaw: Math.PI / 2, label: "The Kingsroad east", flag: "gate", shut: "Castellan Voss's barricade. The road is closed until the Green Gate opens.", edge: true },
  { id: "kingdom_over", from: "kingdom", x: -156, z: 0, r: 7, to: "over", tx: 220, tz: 3, tyaw: -Math.PI / 2, label: "West to the Green Gate", edge: true },
  { id: "kingdom_hunt", from: "kingdom", x: 62, z: 162, r: 7, to: "hunt", tx: 0, tz: -136, tyaw: 0, label: "North to the King's Hunting Grounds", edge: true },
  { id: "hunt_kingdom", from: "hunt", x: 0, z: -146, r: 7, to: "kingdom", tx: 60, tz: 152, tyaw: Math.PI, label: "South to Harrenvale", edge: true },
  { id: "hunt_kennel", from: "hunt", x: 10, z: 128, r: 3.5, to: "kennel", tx: 0, tz: 4, tyaw: 0, label: "Enter the Royal Kennels" },
  { id: "kennel_hunt", from: "kennel", x: 0, z: 2, r: 2.4, to: "hunt", tx: 10, tz: 123, tyaw: Math.PI, label: "Back out to Blackwood" },
  { id: "kennel_hunt_back", from: "kennel", x: 0, z: 132, r: 3, to: "hunt", tx: 10, tz: 123, tyaw: Math.PI, label: "Out through the kennel run", flag: "boe" },
  { id: "kingdom_mire", from: "kingdom", x: 0, z: -164, r: 7, to: "mire", tx: 0, tz: 146, tyaw: Math.PI, label: "South along the causeway", flag: "causeway", shut: "A chain across the causeway, sealed with the Castellan's wax.", edge: true },
  { id: "mire_kingdom", from: "mire", x: 0, z: 156, r: 7, to: "kingdom", tx: 0, tz: -156, tyaw: 0, label: "North to Harrenvale", edge: true },
  { id: "mire_keep", from: "mire", x: 0, z: -138, r: 4, to: "keep", tx: 0, tz: 4, tyaw: 0, label: "Enter the Black Keep" },
  { id: "keep_mire", from: "keep", x: 0, z: 2, r: 2.4, to: "mire", tx: 0, tz: -132, tyaw: Math.PI, label: "Back out to the Mire" },
];

// ------------------------------------------------------------------ shrines (respawn and fast travel)

export type ShrineDef = { id: string; zone: ZoneId; x: number; z: number; name: string };

/** The forest shrine's position is set by the overworld builder; the others are fixed here. */
export const SHRINES: ShrineDef[] = [
  { id: "hearthfen", zone: "over", x: -7.4, z: -11.3, name: "Hearthfen bedroll" },
  { id: "forest", zone: "over", x: 40, z: 115.6, name: "Ruined shrine" },
  { id: "harrenvale", zone: "kingdom", x: 6, z: -6, name: "Harrenvale market cross" },
  { id: "lodge", zone: "hunt", x: -28, z: -74, name: "Royal hunting lodge" },
  { id: "drear", zone: "mire", x: -36, z: 54, name: "Drear bell-post" },
];

// ------------------------------------------------------------------ crafting stations

export type Station = "hand" | "bench" | "forge" | "blacksmith" | "armourer" | "alchemist" | "enchanter" | "cook";

export const STATION_NAMES: Record<Station, string> = {
  hand: "By hand", bench: "Workbench", forge: "Forge", blacksmith: "Blacksmith", armourer: "Armourer",
  alchemist: "Alchemist's table", enchanter: "Enchanter's lectern", cook: "Cooking fire",
};

export type StationDef = { id: string; kind: Station; zone: ZoneId; x: number; z: number; r: number; name: string };

export const STATIONS: StationDef[] = [
  { id: "hf_bench", kind: "bench", zone: "over", x: 6.6, z: 14.3, r: 3.4, name: "Workbench" },
  { id: "hf_forge", kind: "forge", zone: "over", x: 10, z: 5.9, r: 3.6, name: "Mara's Forge" },
  { id: "hv_smith", kind: "blacksmith", zone: "kingdom", x: -16, z: 16, r: 3.6, name: "Holt's Smithy" },
  { id: "hv_forge", kind: "forge", zone: "kingdom", x: -19, z: 18.5, r: 3.4, name: "Holt's Forge" },
  { id: "hv_armour", kind: "armourer", zone: "kingdom", x: -18, z: -12, r: 3.6, name: "Brannoc's Armoury" },
  { id: "hv_bench", kind: "bench", zone: "kingdom", x: -21, z: -15.5, r: 3.0, name: "Armourer's bench" },
  { id: "hv_cook", kind: "cook", zone: "kingdom", x: 20, z: 18, r: 3.4, name: "The Gilded Ox hearth" },
  { id: "hv_alch", kind: "alchemist", zone: "kingdom", x: 22, z: -20, r: 3.4, name: "Infirmary still" },
  { id: "hv_ench", kind: "enchanter", zone: "kingdom", x: 0, z: 27, r: 3.4, name: "The Old Tower lectern" },
  { id: "lodge_cook", kind: "cook", zone: "hunt", x: -24, z: -78, r: 3.4, name: "Lodge firepit" },
  { id: "drear_alch", kind: "alchemist", zone: "mire", x: -44, z: 64, r: 3.4, name: "Mother Phem's kettle" },
  { id: "drear_cook", kind: "cook", zone: "mire", x: -38, z: 58, r: 3.0, name: "Drear smokehouse" },
];

/** Server-side reach for station and shop checks, from the last saved position (it is a few seconds old). */
export const STATION_SLACK = 8;
