import type * as THREE from "three";
import type { Audio } from "../engine/audio";
import type { Cullable, Scatter } from "../engine/kit";
import type { Mats } from "../engine/materials";
import type { PlayerState } from "../play/env";
import type { NpcDef } from "../play/npcs";
import type { ZoneId } from "../data/zones.ts";
import type { Colliders } from "./collide";
import type { NodeDef } from "./nodes";
import type { Glow } from "./props";

/**
 * The contract between a zone builder (world/zones/*.ts) and the game.
 *
 * A builder makes everything in WORLD coordinates: x = ZONES[id].ox + local x, z = local z
 * (see data/zones.ts). Positions named in the shared data (portals, shrines, stations, shops,
 * spawns, nodes, caches, boss arenas) are fixed; the builder lays its ground, buildings and
 * paths around them and must keep those spots walkable.
 */
export type ZoneBuild = {
  /** everything this zone draws; the game shows it only while you stand in the zone */
  root: THREE.Group;
  /** ground height at a world position (walls and floors of buildings are colliders, not ground) */
  groundAt: (x: number, z: number) => number;
  /** deep water and chasms: places a player cannot step */
  blocked?: (x: number, z: number) => boolean;
  /** 0..1 shallow water (slows walking) */
  waterAt?: (x: number, z: number) => number;
  surfaceAt?: (x: number, z: number) => "wood" | "stone" | "dirt" | "grass";
  /** a region key for place titles as you walk (must be a key of `regions`) */
  regionAt?: (x: number, z: number) => string;
  regions?: Record<string, [string, string]>;
  /** indoor zones: how high the camera may go at a point */
  ceiling?: (x: number, z: number) => number;
  fires: THREE.Vector3[];
  lamps: THREE.Vector3[];
  glows: Glow[];
  smoke?: THREE.Vector3[];
  nodes: NodeDef[];
  scatters?: Cullable[];
  grass?: Scatter[];
  anchors: Record<string, THREE.Vector3>;
  /** the people who live here (their stops in world coordinates, `zone` set) */
  npcs?: NpcDef[];
  /** levers, plates, doors and other things to press that belong to this zone */
  interacts?: ZoneInteract[];
  /** per frame while you are in the zone: animate doors from flags, run plates and traps */
  update?: (dt: number, t: number) => void;
  /** light and air: outdoor zones keep the sky; indoor zones are lit by their fires */
  fog?: { color: number; density: number };
};

export type ZoneInteract = { x: number; z: number; r: number; label: () => string | null; act: () => void };

/** What a builder may use: materials, the shared colliders, world flags, players, sound. */
export type ZoneEnv = {
  M: Mats;
  col: Colliders;
  audio: Audio;
  /** a world flag (doors, puzzles, bosses) */
  flag: (f: string) => boolean;
  /** ask the server to set a world flag (it checks the rules in data/world.ts WORLD_FLAGS) */
  setFlag: (f: string) => void;
  say: (text: string) => void;
  /** every player in the world, the local one first (their `zone` tells where they are) */
  players: () => PlayerState[];
  /** hurt the local player (traps): damage, from where */
  hurt: (dmg: number, sx: number, sz: number) => void;
  shake: (a: number) => void;
};

export type ZoneBuilder = (env: ZoneEnv) => ZoneBuild | Promise<ZoneBuild>;

/** Builders for the zones beyond Hearthfen and Cookie's Castle, loaded the first time you go there. */
export const ZONE_BUILDERS: Partial<Record<ZoneId, () => Promise<ZoneBuilder>>> = {};

export function registerZone(id: ZoneId, load: () => Promise<ZoneBuilder>) {
  ZONE_BUILDERS[id] = load;
}
