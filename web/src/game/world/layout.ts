import { smoothPath } from "../engine/noise";

/**
 * The slice map, in metres. +x is east, +z is north.
 * Hearthfen sits in a clearing at the origin. The Giant Forest runs north to Cookie's hill.
 * The road east crosses the Broken Kingsbridge to the Green Gate; the Kingdom lies beyond.
 * The castle interior is built far off the map at DUN_X and reached through the castle door.
 */

export const BOUNDS = { minX: -112, maxX: 236, minZ: -72, maxZ: 212 };

export const VILLAGE = { x: 0, z: 0, r: 30 };
export const SPAWN = { x: 1.5, z: -22, yaw: 0 };
export const BELL = { x: 2, z: 3 };

export const HILL = { x: 0, z: 192, r: 44, h: 19 };
export const CASTLE_DOOR = { x: 0, z: 165 };

export const RIVER_X = 82;
export const BRIDGE = { x: 82, z: 0 };
export const GATE = { x: 106, z: 0 };
export const VOSS = { x: 196, z: 2 };
export const IRON = { x: 96, z: -15 };

/** Interior of Cookie's Castle, far off the overworld. */
export const DUN_X = 1200;
export const DUN = {
  entry: { x: DUN_X, z: 4 },
  hallEnd: 16,
  trapZ0: 18,
  trapZ1: 34,
  weightZ0: 36,
  weightZ1: 58,
  doorZ: 58,
  galleryZ1: 82,
  arena: { x: DUN_X, z: 104, r: 15 },
};

export const PATH_MAIN = smoothPath([
  [1.5, -40], [1.5, -24], [0.5, -8], [1, 8], [0, 26], [3, 38], [5, 50], [-3, 64], [-7, 78], [-2, 92], [5, 106],
  [3, 122], [-4, 136], [-2, 150], [0, 160], [0, 166],
]);

export const PATH_EAST = smoothPath([
  [8, 2], [22, 1], [34, -1], [50, 2], [66, 0], [78, 0], [88, 0], [100, 0], [114, 0], [140, 2], [170, 1], [200, 2], [236, 3],
]);

export const PATH_CAMP = smoothPath([
  [-5, 76], [-16, 82], [-28, 90], [-40, 96],
]);

export const PATH_SHRINE = smoothPath([
  [4, 104], [16, 108], [28, 112], [38, 114],
]);

export const CREEK = smoothPath([
  [-112, 36], [-84, 41], [-60, 38], [-38, 44], [-18, 41], [0, 45], [18, 49], [40, 46], [60, 52], [RIVER_X, 50],
]);

export const RIVER = smoothPath([
  [RIVER_X - 4, -72], [RIVER_X + 2, -40], [RIVER_X - 1, -10], [RIVER_X, 10], [RIVER_X + 3, 50], [RIVER_X - 2, 100], [RIVER_X + 4, 150], [RIVER_X, 212],
]);

export const CLEARINGS = [
  { x: 18, z: 84, r: 13, name: "wolf" },
  { x: -42, z: 96, r: 14, name: "camp" },
  { x: 40, z: 114, r: 11, name: "shrine" },
  { x: -26, z: 134, r: 10, name: "hollow" },
  { x: -14, z: 56, r: 9, name: "glade" },
] as const;

export type Region = "hearthfen" | "forest" | "castle" | "bridge" | "gate" | "kingdom" | "dungeon" | "nursery";

export function regionAt(x: number, z: number): Region {
  if (x > DUN_X - 100) return z > DUN.galleryZ1 ? "nursery" : "dungeon";
  if (x > GATE.x + 2) return "kingdom";
  if (x > RIVER_X - 10) return x > GATE.x - 14 ? "gate" : "bridge";
  if (Math.hypot(x - VILLAGE.x, z - VILLAGE.z) < VILLAGE.r + 4) return "hearthfen";
  if (z > 150) return "castle";
  if (x > 40 && z < 30) return "bridge";
  return "forest";
}

export const REGION_TITLE: Record<Region, [string, string]> = {
  hearthfen: ["Hearthfen", "A clearing, not a town"],
  forest: ["The Giant Forest", "Old green. Honey light."],
  castle: ["Cookie's Hill", "A nursery that fossilised"],
  bridge: ["Broken Kingsbridge", "The road east"],
  gate: ["The Green Gate", "A March-Seal holds it"],
  kingdom: ["The Medieval Kingdom", "Harrenvale road"],
  dungeon: ["Cookie's Castle", "Painted wood, then brass"],
  nursery: ["The Nursery Courtyard", "The music box is playing"],
};
