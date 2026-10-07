import type * as THREE from "three";
import type { BossDef } from "../data/bosses.ts";
import type { Env, PlayerState } from "./env";
import type { Mob } from "./mobs";

/**
 * The shape every boss has, so the game, the network and the server treat Cookie, Boe and
 * Finlay the same way: one runner simulates the fight and sends snapshots; everyone else shows a
 * puppet; the server prices every blow against one shared health pool.
 */

/** A hazard a boss puts under one player. That player's own client shows it and judges it. */
export type Hazard = {
  kind: "rite";
  /** where (world) and how wide */
  x: number;
  z: number;
  r: number;
  /** seconds until it bites */
  t: number;
  dmg: number;
  /** what the boss says as it starts (shown and spoken once) */
  text?: string;
};

export interface BossEnv extends Env {
  /** puts a hazard under one player (a message to their client if they are remote) */
  hazard: (target: PlayerState, h: Hazard) => void;
  /** a line the boss says aloud (subtitle and sound) */
  speak: (text: string) => void;
}

export interface Boss {
  readonly def: BossDef;
  x: number;
  y: number;
  z: number;
  yaw: number;
  hp: number;
  max: number;
  /** state name: "dormant" before the fight, "dying" and "dead" after */
  readonly st: string;
  phaseN: number;
  /** true on clients that do not run this zone */
  puppet: boolean;
  /** not dormant and not dead */
  readonly active: boolean;
  /** active and not dying */
  readonly fighting: boolean;
  /** foes it summoned (Cookie's toys, Boe's hounds); they are hit and synced with the boss */
  readonly adds: Mob[];
  /** the boss bar's line for each phase (index = phase number) */
  readonly phaseNames: string[];
  /** a light that follows it during the fight, if it wants one */
  readonly stageLight?: boolean;
  reset(): void;
  setDead(): void;
  startIntro(): void;
  update(dt: number, inArena: boolean): void;
  snap(): unknown;
  applySnap(sn: unknown): void;
  /** a blow the server priced: the shared pool is now `hp` */
  netHit(hp: number, fromX: number, fromZ: number, heavy: boolean, fire: boolean): void;
  canTakeHit(): boolean;
  hitFlags(fromX: number, fromZ: number): { behind: boolean; perched: boolean; dizzy: boolean };
  /** a player parried it: stagger for `t` seconds */
  parry(t: number): void;
  setPuppet(on: boolean): void;
  /** the co-op health the server chose for this fight */
  setMax(max: number): void;
}

/** What a boss module exports: build the boss into its zone's scene. */
export type BossFactory = (env: BossEnv, parent: THREE.Object3D) => Boss;

/** Boss code loads with its zone (Boe with the kennels, Finlay with the Keep). */
export const BOSS_FACTORIES: Record<string, () => Promise<BossFactory>> = {};

export function registerBoss(id: string, load: () => Promise<BossFactory>) {
  BOSS_FACTORIES[id] = load;
}
