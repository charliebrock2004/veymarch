import type * as THREE from "three";
import type { Audio } from "../engine/audio";
import type { DecalPool, Flashes, Beam } from "../engine/fx";
import type { Particles } from "../engine/particles";
import type { Colliders } from "../world/collide";
import type { ZoneId } from "../data/zones";

export type PlayerState = {
  x: number;
  y: number;
  z: number;
  yaw: number;
  hp: number;
  maxHp: number;
  iframe: number;
  blocking: boolean;
  blockT: number;
  shield: boolean;
  dead: boolean;
  /** the zone this player stands in */
  zone: ZoneId;
  /** connection id of a remote player; undefined for the local one */
  cid?: string;
  /** wears Elspeth's Hound Bell: hounds and wolves leave this player be until struck */
  calm?: boolean;
};

/** Stands in for the audio engine when a sound is too far away to hear. */
export const SILENT = new Proxy({}, { get: () => () => undefined }) as Audio;

export type HurtOpts = { knock?: number; unblockable?: boolean; parryable?: boolean; source?: { stagger: (t: number) => void }; src?: string };

/** Everything an enemy or the boss may touch. They never write player state directly. */
export interface Env {
  time: number;
  player: PlayerState;
  hurtPlayer: (dmg: number, sx: number, sz: number, o?: HurtOpts) => boolean;
  /** Every player in the world, the local one first. Single player: just the local one. */
  players: () => PlayerState[];
  /** Hurts any player: the local one directly, a remote one by message (their client applies dodge, block and parry). */
  hurt: (target: PlayerState, dmg: number, sx: number, sz: number, o?: HurtOpts) => boolean;
  dust: Particles;
  sparks: Particles;
  decals: DecalPool;
  flashes: Flashes;
  beam: Beam;
  audio: Audio;
  col: Colliders;
  groundAt: (x: number, z: number) => number;
  blocked: (x: number, z: number) => boolean;
  shake: (a: number) => void;
  /** Whether the local player is close enough to hear (and feel) something at x, z. */
  heard: (x: number, z: number, zone: ZoneId, r?: number) => boolean;
  floater: (text: string, x: number, y: number, z: number, kind?: "dmg" | "heal" | "info" | "crit" | "fire") => void;
  combat: (on: boolean) => void;
  parent: (zone: ZoneId) => THREE.Object3D;
}
