import * as THREE from "three";
import type { Decal, Shape } from "../engine/fx";
import {
  Poser, buildHuman, buildQuad, buildRockingHorse, characterMaterial, poseHorse, poseHuman, poseQuad, type HumanAction, type QuadAction, type Rig,
} from "../engine/rig";
import { MOB_LOOT } from "../content";
import { SILENT, type Env, type PlayerState } from "./env";
import type { ZoneId } from "../data/zones";
import { weaponModel } from "./weapons";
import { flatten, tint } from "../engine/kit";

/**
 * Enemies. Every attack has a tell (a pose, a ground shape and a sound), an active window,
 * and a recovery you can punish. Lethal tells are at least 0.4 s (architecture §combat).
 */

export type MobKind =
  | "wolf" | "goblin" | "redcap" | "soldier" | "mouse" | "horse" | "deer"
  | "bandit" | "deserter" | "hound" | "boar" | "blackwolf" | "kennel_hound" | "kennelmaster"
  | "drowned" | "croc" | "witch" | "black_guard" | "keep_knight" | "crypt_dead";

type Attack = {
  name: string;
  range: number;
  tell: number;
  active: number;
  recover: number;
  shape: Shape;
  size: number;
  width?: number;
  half?: number;
  dmg: number;
  lunge: number;
  knock: number;
  cooldown: number;
  tellPose: string;
  hitPose: string;
  ground?: boolean;
  /** centred on the spot the foe aimed at (locked early in the tell), not on the foe */
  target?: boolean;
  /** not used closer than this */
  min?: number;
  /** struck by touching the foe's body while it lunges (pounces, charges) */
  body?: boolean;
  /** tell colour on the ground */
  color?: number;
};

type Cfg = {
  hp: number;
  speed: number;
  run: number;
  aggro: number;
  leash: number;
  radius: number;
  height: number;
  attacks: Attack[];
  fireWeak: number;
  loot: [string, number, number][];
  flees?: boolean;
  strafe?: boolean;
  xp: string;
  /** hounds and wolves: a player who wears the Hound Bell (calm) is left be until they strike */
  family?: "hound";
  /** picks at random among the attacks in range instead of the first one listed */
  mix?: boolean;
  /** keeps about this far from its target (casters) */
  keep?: number;
  /** damage factor for blows from the front unless heavy or staggered (a shield) */
  front?: number;
  /** knockback taken, 1 = normal */
  mass?: number;
  /** stagger time factor (bigger foes reel for less) */
  reel?: number;
  /** heavy blows do not stagger it during these states */
  hyper?: "active" | "attack";
  /** fights bare-handed (pose) */
  unarmed?: boolean;
  /** holds its shield up while it walks */
  guard?: boolean;
  /** sound when it notices a player */
  cry?: "growl" | "shriek" | "wind" | "clack" | "bell" | "charge";
};

const QUADS: ReadonlySet<MobKind> = new Set<MobKind>(["wolf", "deer", "hound", "boar", "blackwolf", "kennel_hound", "croc"]);

const A = (o: Partial<Attack> & Pick<Attack, "name" | "range" | "tell" | "dmg">): Attack => ({
  active: 0.25, recover: 0.6, shape: 1, size: 2.4, half: 0.6, lunge: 0, knock: 1.2, cooldown: 1.2, tellPose: "windup", hitPose: "light1", ...o,
});

export const MOBS: Record<MobKind, Cfg> = {
  wolf: {
    hp: 34, speed: 2.2, run: 6.2, aggro: 13, leash: 34, radius: 0.55, height: 1.1, fireWeak: 1.2, strafe: true, xp: "wolf", family: "hound",
    loot: MOB_LOOT.wolf,
    attacks: [
      A({ name: "pounce", range: 4.6, tell: 0.55, active: 0.38, recover: 0.75, shape: 2, size: 4.8, width: 0.8, dmg: 11, lunge: 11, knock: 1.6, cooldown: 2.2, tellPose: "crouch", hitPose: "pounce" }),
      A({ name: "bite", range: 1.7, tell: 0.42, active: 0.18, recover: 0.5, shape: 1, size: 2.0, half: 0.55, dmg: 8, lunge: 3, tellPose: "crouch", hitPose: "bite", cooldown: 1.0 }),
    ],
  },
  goblin: {
    hp: 30, speed: 2.4, run: 4.8, aggro: 12, leash: 30, radius: 0.45, height: 1.3, fireWeak: 1.25, xp: "goblin",
    loot: MOB_LOOT.goblin,
    attacks: [
      A({ name: "stab", range: 2.4, tell: 0.42, active: 0.2, recover: 0.6, shape: 2, size: 2.8, width: 0.7, dmg: 9, lunge: 6, tellPose: "windup", hitPose: "thrust" }),
      A({ name: "flurry", range: 1.8, tell: 0.5, active: 0.35, recover: 0.8, shape: 1, size: 2.1, half: 0.8, dmg: 7, lunge: 2, tellPose: "windup", hitPose: "light2", cooldown: 2 }),
    ],
  },
  redcap: {
    hp: 90, speed: 2.0, run: 3.8, aggro: 13, leash: 26, radius: 0.6, height: 1.7, fireWeak: 1.25, xp: "redcap",
    loot: MOB_LOOT.redcap,
    attacks: [
      A({ name: "slam", range: 3.0, tell: 0.85, active: 0.25, recover: 1.0, shape: 0, size: 2.4, dmg: 18, lunge: 2, knock: 2.4, tellPose: "charge", hitPose: "heavy", ground: true, cooldown: 2 }),
      A({ name: "sweep", range: 2.6, tell: 0.6, active: 0.25, recover: 0.8, shape: 1, size: 3.0, half: 1.1, dmg: 12, lunge: 1, tellPose: "windup", hitPose: "light1", cooldown: 1.6 }),
    ],
  },
  soldier: {
    hp: 30, speed: 1.9, run: 3.4, aggro: 14, leash: 40, radius: 0.45, height: 1.4, fireWeak: 1.5, xp: "soldier",
    loot: MOB_LOOT.soldier,
    attacks: [
      A({ name: "bayonet", range: 2.8, tell: 0.55, active: 0.22, recover: 0.9, shape: 2, size: 3.2, width: 0.6, dmg: 10, lunge: 7, tellPose: "windup", hitPose: "thrust" }),
    ],
  },
  mouse: {
    hp: 12, speed: 3, run: 6.8, aggro: 12, leash: 40, radius: 0.3, height: 0.4, fireWeak: 1.5, xp: "mouse",
    loot: MOB_LOOT.mouse,
    attacks: [A({ name: "nip", range: 1.3, tell: 0.4, active: 0.15, recover: 0.6, shape: 1, size: 1.4, half: 0.7, dmg: 5, lunge: 5, knock: 0.6, tellPose: "crouch", hitPose: "bite", cooldown: 0.9 })],
  },
  horse: {
    hp: 120, speed: 1.4, run: 2.0, aggro: 16, leash: 60, radius: 1.0, height: 2.2, fireWeak: 1.5, xp: "horse",
    loot: MOB_LOOT.horse,
    attacks: [
      A({ name: "charge", range: 14, tell: 1.0, active: 1.05, recover: 1.5, shape: 2, size: 13, width: 1.5, dmg: 18, lunge: 12.5, knock: 3, tellPose: "rock", hitPose: "charge", cooldown: 1.2 }),
      A({ name: "buck", range: 2.6, tell: 0.6, active: 0.25, recover: 0.9, shape: 0, size: 2.6, dmg: 12, lunge: 0, knock: 2.2, tellPose: "rock", hitPose: "rock", cooldown: 1.5 }),
    ],
  },
  deer: {
    hp: 20, speed: 1.4, run: 7.5, aggro: 12, leash: 60, radius: 0.5, height: 1.5, fireWeak: 1, flees: true, xp: "deer",
    loot: MOB_LOOT.deer,
    attacks: [],
  },

  // ---------------------------------------------------------------- the Kingdom (levels 4-7)
  bandit: {
    hp: 55, speed: 2.2, run: 4.6, aggro: 13, leash: 32, radius: 0.45, height: 1.8, fireWeak: 1.2, strafe: true, mix: true, cry: "shriek", xp: "bandit",
    loot: MOB_LOOT.bandit,
    attacks: [
      A({ name: "slash", range: 2.3, tell: 0.45, active: 0.22, recover: 0.6, shape: 1, size: 2.6, half: 0.75, dmg: 11, lunge: 2.5, tellPose: "windup", hitPose: "light1", cooldown: 1.3 }),
      A({ name: "lunge", range: 3.6, min: 1.6, tell: 0.55, active: 0.25, recover: 0.85, shape: 2, size: 3.6, width: 0.6, dmg: 13, lunge: 8, tellPose: "windup", hitPose: "thrust", cooldown: 1.8 }),
    ],
  },
  deserter: {
    hp: 110, speed: 1.9, run: 3.8, aggro: 14, leash: 34, radius: 0.5, height: 1.9, fireWeak: 1.1, mix: true, mass: 0.7, cry: "clack", xp: "deserter",
    loot: MOB_LOOT.deserter,
    attacks: [
      A({ name: "thrust", range: 3.4, tell: 0.6, active: 0.22, recover: 0.9, shape: 2, size: 3.6, width: 0.6, dmg: 13, lunge: 5, tellPose: "windup", hitPose: "thrust", cooldown: 1.5 }),
      A({ name: "overhand", range: 2.4, tell: 0.75, active: 0.25, recover: 1.0, shape: 1, size: 2.8, half: 0.6, dmg: 14, lunge: 2, knock: 2, tellPose: "charge", hitPose: "heavy", cooldown: 1.8 }),
    ],
  },
  hound: {
    hp: 50, speed: 2.4, run: 6.6, aggro: 14, leash: 36, radius: 0.5, height: 1.0, fireWeak: 1.2, strafe: true, family: "hound", cry: "growl", xp: "hound",
    loot: MOB_LOOT.hound,
    attacks: [
      A({ name: "pounce", range: 4.8, tell: 0.55, active: 0.38, recover: 0.75, shape: 2, size: 5.0, width: 0.8, dmg: 14, lunge: 11, knock: 1.6, cooldown: 2.2, tellPose: "crouch", hitPose: "pounce", body: true }),
      A({ name: "bite", range: 1.7, tell: 0.42, active: 0.18, recover: 0.5, shape: 1, size: 2.0, half: 0.55, dmg: 12, lunge: 3, tellPose: "crouch", hitPose: "bite", cooldown: 1.0 }),
    ],
  },
  boar: {
    hp: 70, speed: 1.8, run: 5.2, aggro: 11, leash: 30, radius: 0.6, height: 1.0, fireWeak: 1.2, mix: true, mass: 0.6, cry: "growl", xp: "boar",
    loot: MOB_LOOT.boar,
    attacks: [
      A({ name: "gore", range: 1.9, tell: 0.5, active: 0.2, recover: 0.7, shape: 1, size: 2.2, half: 0.6, dmg: 12, lunge: 3, knock: 1.8, tellPose: "crouch", hitPose: "bite", cooldown: 1.2 }),
      A({ name: "charge", range: 8, min: 3.5, tell: 0.8, active: 0.7, recover: 1.2, shape: 2, size: 8, width: 0.9, dmg: 14, lunge: 11, knock: 2.4, tellPose: "crouch", hitPose: "pounce", cooldown: 2.4, body: true }),
    ],
  },

  // ---------------------------------------------------------------- the hunting grounds and the kennels (7-10)
  blackwolf: {
    hp: 80, speed: 2.4, run: 6.8, aggro: 15, leash: 40, radius: 0.7, height: 1.4, fireWeak: 1.2, strafe: true, mix: true, family: "hound", mass: 0.8, cry: "growl", xp: "blackwolf",
    loot: MOB_LOOT.blackwolf,
    attacks: [
      A({ name: "pounce", range: 5.2, min: 2.4, tell: 0.55, active: 0.38, recover: 0.8, shape: 2, size: 5.4, width: 0.9, dmg: 17, lunge: 12, knock: 2, cooldown: 2.2, tellPose: "crouch", hitPose: "pounce", body: true }),
      A({ name: "bite", range: 1.9, tell: 0.42, active: 0.18, recover: 0.55, shape: 1, size: 2.2, half: 0.55, dmg: 15, lunge: 3, tellPose: "crouch", hitPose: "bite", cooldown: 1.0 }),
      A({ name: "rend", range: 2.2, tell: 0.6, active: 0.25, recover: 0.8, shape: 1, size: 2.6, half: 1.0, dmg: 18, lunge: 4, knock: 1.8, tellPose: "crouch", hitPose: "bite", cooldown: 1.6 }),
    ],
  },
  kennel_hound: {
    hp: 85, speed: 2.2, run: 6.4, aggro: 15, leash: 36, radius: 0.65, height: 1.3, fireWeak: 1.2, strafe: true, mix: true, family: "hound", mass: 0.8, cry: "growl", xp: "kennel_hound",
    loot: MOB_LOOT.kennel_hound,
    attacks: [
      A({ name: "pounce", range: 5.0, min: 2.2, tell: 0.55, active: 0.38, recover: 0.8, shape: 2, size: 5.2, width: 0.85, dmg: 17, lunge: 11.5, knock: 1.8, cooldown: 2.2, tellPose: "crouch", hitPose: "pounce", body: true }),
      A({ name: "bite", range: 1.9, tell: 0.45, active: 0.18, recover: 0.55, shape: 1, size: 2.2, half: 0.55, dmg: 16, lunge: 3, tellPose: "crouch", hitPose: "bite", cooldown: 1.0 }),
    ],
  },
  kennelmaster: {
    hp: 420, speed: 1.6, run: 3.0, aggro: 14, leash: 30, radius: 0.8, height: 2.3, fireWeak: 1.1, mix: true, mass: 0.3, reel: 0.5, hyper: "attack", cry: "growl", xp: "kennelmaster",
    loot: MOB_LOOT.kennelmaster,
    attacks: [
      A({ name: "whip", range: 4.2, tell: 0.75, active: 0.3, recover: 0.9, shape: 1, size: 4.8, half: 1.15, dmg: 18, lunge: 1, knock: 2, tellPose: "windup", hitPose: "light1", cooldown: 1.6 }),
      A({ name: "slam", range: 3.0, tell: 1.0, active: 0.3, recover: 1.3, shape: 0, size: 2.8, dmg: 22, lunge: 2, knock: 3, tellPose: "charge", hitPose: "heavy", ground: true, cooldown: 2.2 }),
    ],
  },

  // ---------------------------------------------------------------- the Mire (10-13)
  drowned: {
    hp: 120, speed: 0.9, run: 1.7, aggro: 11, leash: 26, radius: 0.5, height: 1.8, fireWeak: 0.8, mix: true, unarmed: true, mass: 0.8, cry: "bell", xp: "drowned",
    loot: MOB_LOOT.drowned,
    attacks: [
      A({ name: "grab", range: 2.4, tell: 0.7, active: 0.28, recover: 1.0, shape: 2, size: 2.8, width: 0.6, dmg: 20, lunge: 3.5, knock: 1.4, tellPose: "windup", hitPose: "thrust", cooldown: 1.6 }),
      A({ name: "slam", range: 2.2, tell: 0.95, active: 0.3, recover: 1.2, shape: 0, size: 2.2, dmg: 24, lunge: 1, knock: 2.4, tellPose: "charge", hitPose: "heavy", ground: true, cooldown: 2.0 }),
    ],
  },
  croc: {
    hp: 160, speed: 0.9, run: 2.4, aggro: 9, leash: 22, radius: 0.9, height: 0.7, fireWeak: 1, mix: true, mass: 0.4, cry: "growl", xp: "croc",
    loot: MOB_LOOT.croc,
    attacks: [
      A({ name: "bite", range: 2.8, tell: 0.95, active: 0.22, recover: 1.3, shape: 1, size: 3.2, half: 0.45, dmg: 24, lunge: 5, knock: 2.2, tellPose: "crouch", hitPose: "bite", cooldown: 1.8 }),
      A({ name: "tail", range: 2.6, tell: 0.7, active: 0.35, recover: 1.0, shape: 0, size: 2.6, dmg: 18, lunge: 0, knock: 2.6, tellPose: "crouch", hitPose: "tail", cooldown: 2.0 }),
    ],
  },
  witch: {
    hp: 140, speed: 1.6, run: 3.4, aggro: 15, leash: 30, radius: 0.45, height: 1.8, fireWeak: 1.3, mix: true, keep: 7, unarmed: true, cry: "shriek", xp: "witch",
    loot: MOB_LOOT.witch,
    attacks: [
      A({ name: "claw", range: 1.9, tell: 0.45, active: 0.2, recover: 0.6, shape: 1, size: 2.2, half: 0.7, dmg: 18, lunge: 2, tellPose: "windup", hitPose: "light2", cooldown: 1.2 }),
      A({ name: "hex", range: 11, min: 3, tell: 0.9, active: 0.3, recover: 0.9, shape: 0, size: 2.2, dmg: 22, lunge: 0, knock: 1.5, tellPose: "cast", hitPose: "cast", ground: true, target: true, color: 0x9a5ad8, cooldown: 2.6 }),
    ],
  },

  // ---------------------------------------------------------------- the Black Keep (13-16)
  black_guard: {
    hp: 170, speed: 1.7, run: 3.4, aggro: 14, leash: 32, radius: 0.55, height: 2.0, fireWeak: 1.1, mix: true, front: 0.5, guard: true, mass: 0.6, cry: "clack", xp: "black_guard",
    loot: MOB_LOOT.black_guard,
    attacks: [
      A({ name: "thrust", range: 3.0, tell: 0.55, active: 0.22, recover: 0.9, shape: 2, size: 3.2, width: 0.6, dmg: 24, lunge: 5, tellPose: "windup", hitPose: "thrust", cooldown: 1.5 }),
      A({ name: "bash", range: 1.9, tell: 0.5, active: 0.2, recover: 0.8, shape: 1, size: 2.1, half: 0.7, dmg: 22, lunge: 2.5, knock: 2.4, tellPose: "windup", hitPose: "light2", cooldown: 1.4 }),
      A({ name: "overhand", range: 2.5, tell: 0.8, active: 0.25, recover: 1.0, shape: 1, size: 2.9, half: 0.55, dmg: 28, lunge: 2, knock: 2.6, tellPose: "charge", hitPose: "heavy", cooldown: 2.0 }),
    ],
  },
  keep_knight: {
    hp: 260, speed: 1.5, run: 3.2, aggro: 14, leash: 32, radius: 0.65, height: 2.2, fireWeak: 1.1, mix: true, mass: 0.35, reel: 0.7, hyper: "active", cry: "clack", xp: "keep_knight",
    loot: MOB_LOOT.keep_knight,
    attacks: [
      A({ name: "cleave", range: 3.6, tell: 0.9, active: 0.3, recover: 1.2, shape: 2, size: 4.0, width: 0.8, dmg: 32, lunge: 4, knock: 3.2, tellPose: "charge", hitPose: "heavy", cooldown: 2.0 }),
      A({ name: "sweep", range: 3.2, tell: 0.75, active: 0.28, recover: 1.0, shape: 1, size: 3.6, half: 1.2, dmg: 26, lunge: 1.5, knock: 3, tellPose: "windup", hitPose: "light1", cooldown: 1.8 }),
    ],
  },
  crypt_dead: {
    hp: 130, speed: 1.5, run: 2.8, aggro: 13, leash: 30, radius: 0.45, height: 1.8, fireWeak: 1.4, mix: true, cry: "clack", xp: "crypt_dead",
    loot: MOB_LOOT.crypt_dead,
    attacks: [
      A({ name: "hack", range: 2.2, tell: 0.55, active: 0.22, recover: 0.7, shape: 1, size: 2.5, half: 0.7, dmg: 22, lunge: 2, tellPose: "windup", hitPose: "light1", cooldown: 1.3 }),
      A({ name: "lunge", range: 3.0, min: 1.4, tell: 0.65, active: 0.25, recover: 0.9, shape: 2, size: 3.2, width: 0.6, dmg: 24, lunge: 6, tellPose: "windup", hitPose: "thrust", cooldown: 1.7 }),
    ],
  },
};

function makeRig(kind: MobKind): { rig: Rig; mat: THREE.MeshLambertMaterial; mouse?: THREE.Group } {
  const mat = characterMaterial.clone() as THREE.MeshLambertMaterial;
  let rig: Rig;
  if (kind === "wolf") rig = buildQuad({ kind: "wolf", fur: 0x55504a, belly: 0x9a9080, size: 1.25 });
  else if (kind === "deer") rig = buildQuad({ kind: "deer", fur: 0x8a6a48, belly: 0xd8c8b0, antlers: Math.random() < 0.5 });
  else if (kind === "horse") rig = buildRockingHorse();
  else if (kind === "goblin")
    rig = buildHuman({ skin: 0x7a8456, hair: 0x2a2018, hairStyle: "bald", shirt: 0x5a4a3a, coat: 0x7a6650, trousers: 0x3e3428, boots: 0x2a2420, ears: "goblin", headScale: 1.4, height: 1.3, frame: 0.85 });
  else if (kind === "redcap")
    rig = buildHuman({ skin: 0x6e7a4e, hair: 0x2a2018, hairStyle: "bald", shirt: 0x4a3a30, coat: 0x5a4636, trousers: 0x3a3024, boots: 0x2a2420, ears: "goblin", headScale: 1.3, height: 1.85, frame: 1.25, hat: "redcap", belt: 0x2a1a10 });
  else if (kind === "soldier")
    rig = buildHuman({ skin: 0xe4d7c3, hair: 0x1c1916, hairStyle: "bald", shirt: 0xe4d7c3, coat: 0x8e2f2f, trousers: 0x2a2c3a, boots: 0x1c1916, face: "toy", hat: "bearskin", height: 1.35, frame: 0.95, belt: 0xe4d7c3 });
  else if (kind !== "mouse") rig = buildNew(kind);
  else {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), new THREE.MeshLambertMaterial({ color: 0x8a8580 }));
    body.scale.set(0.9, 0.75, 1.4);
    body.position.y = 0.2;
    const head = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.3, 8), new THREE.MeshLambertMaterial({ color: 0x9a948e }));
    head.rotation.x = Math.PI / 2;
    head.position.set(0, 0.22, 0.38);
    const ear = new THREE.Mesh(new THREE.CircleGeometry(0.08, 10), new THREE.MeshLambertMaterial({ color: 0xc8a8a0, side: THREE.DoubleSide }));
    ear.position.set(0.1, 0.38, 0.26);
    const ear2 = ear.clone();
    ear2.position.x = -0.1;
    const key = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.025, 5, 10), new THREE.MeshPhongMaterial({ color: 0xb5893a }));
    key.position.set(0, 0.42, -0.1);
    key.name = "key";
    const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.015, 0.5, 4), new THREE.MeshLambertMaterial({ color: 0xc8a8a0 }));
    tail.rotation.x = Math.PI / 2 + 0.4;
    tail.position.set(0, 0.15, -0.5);
    g.add(body, head, ear, ear2, key, tail);
    g.traverse((o) => ((o as THREE.Mesh).castShadow = true));
    const holder = new THREE.Group();
    holder.add(g);
    return { rig: { group: holder, mesh: null as unknown as THREE.SkinnedMesh, bones: {}, rest: {}, sockets: {}, height: 0.4 }, mat, mouse: g };
  }
  rig.mesh.material = mat;
  if (kind === "goblin") rig.sockets.gripR.add(weaponModel(Math.random() < 0.5 ? "club" : "spear"));
  if (kind === "redcap") rig.sockets.gripR.add(weaponModel("bigclub"));
  if (kind === "soldier") {
    rig.sockets.gripR.add(weaponModel("musket"));
    const key = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.03, 5, 10), new THREE.MeshPhongMaterial({ color: 0xb5893a, shininess: 80 }));
    key.position.z = -0.08;
    key.name = "key";
    rig.sockets.back.add(key);
  }
  dress(kind, rig, mat);
  return { rig, mat };
}

// ------------------------------------------------------------------ new foes: bodies and gear

const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
const shade = (c: number, k: number) => new THREE.Color(c).multiplyScalar(k).getHex();

/** Bodies of the foes beyond Hearthfen. */
function buildNew(kind: MobKind): Rig {
  const v = 0.9 + Math.random() * 0.2;
  switch (kind) {
    case "bandit":
      return buildHuman({
        skin: pick([0xd9b48f, 0xc49a74, 0xa87a58]), hair: pick([0x3e3a2c, 0x4a3e30, 0x34302a]), hairStyle: "hood",
        shirt: 0x6a5a44, coat: shade(0x5e4630, v), trousers: 0x3a3428, boots: 0x2a2218, belt: 0x241a12,
        armour: { chest: "leather", hands: "leather" }, height: 1.75 + Math.random() * 0.1, frame: 0.95,
      });
    case "deserter":
      return buildHuman({
        skin: pick([0xd9b48f, 0xc8a080, 0xb88c68]), hair: 0x3a3026, hairStyle: "short", beard: Math.random() < 0.6,
        shirt: 0x5a564e, coat: 0x3a4556, trousers: 0x3a3a3a, boots: 0x2a2420, belt: 0x2a1e14,
        armour: { head: "iron", chest: "iron", legs: "iron" }, height: 1.85, frame: 1.05,
      });
    case "hound": {
      const r = buildQuad({ kind: "dog", fur: shade(0x3a2a20, v), belly: 0x6a5038, size: 1.05 });
      r.group.scale.set(0.95, 1.05, 1.12);
      return r;
    }
    case "boar": {
      const r = buildQuad({ kind: "dog", fur: shade(0x4a3a2e, v), belly: 0x5e4c3c, size: 1 });
      r.group.scale.set(1.3, 0.85, 1.05);
      return r;
    }
    case "blackwolf":
      return buildQuad({ kind: "wolf", fur: 0x26242a, belly: 0x46424c, size: 1.55 });
    case "kennel_hound": {
      const r = buildQuad({ kind: "dog", fur: 0x18161a, belly: 0x2e2a28, size: 1.3, collar: 0x5a3a24 });
      r.group.scale.set(1.35, 1.3, 1.4);
      return r;
    }
    case "kennelmaster":
      return buildHuman({
        skin: 0xc8a080, hair: 0x2a2018, hairStyle: "bald", beard: true, shirt: 0x5a4a3a, coat: 0x3a2a20, trousers: 0x2e2620, boots: 0x1e1814,
        belt: 0x1a120c, apron: 0x4a3020, armour: { chest: "hound", hands: "leather" }, height: 2.15, frame: 1.35,
      });
    case "drowned":
      return buildHuman({
        skin: shade(0x6f7f68, v), hair: 0x26301f, hairStyle: "long", shirt: 0x4a5442, coat: 0x34402f, coatLong: true,
        trousers: 0x2e3628, boots: 0x222820, belt: 0x1e2418, height: 1.8, frame: 0.95,
      });
    case "croc": {
      const r = buildQuad({ kind: "wolf", fur: 0x4a5640, belly: 0x8a8a68, size: 1 });
      r.group.scale.set(1.35, 0.5, 1.8);
      return r;
    }
    case "witch":
      return buildHuman({
        skin: 0xd8d2c8, hair: 0x241f26, hairStyle: "hood", shirt: 0x3a3040, coat: 0x221d24, coatLong: true,
        trousers: 0x221d24, boots: 0x161216, belt: 0x3a2a30, height: 1.75, frame: 0.88,
      });
    case "black_guard":
      return buildHuman({
        skin: 0xb89a80, hair: 0x18181c, hairStyle: "short", shirt: 0x202024, coat: 0x1c1c22, trousers: 0x18181c, boots: 0x101012, belt: 0x2a2018,
        armour: { head: "bk", chest: "bk", hands: "bk", legs: "bk", feet: "bk" }, height: 1.95, frame: 1.12,
      });
    case "keep_knight":
      return buildHuman({
        skin: 0xb89a80, hair: 0x18181c, hairStyle: "short", shirt: 0x202024, coat: 0x18181c, trousers: 0x141418, boots: 0x101012, belt: 0x3a2a18,
        cape: 0x2a1618, armour: { head: "bk", chest: "bk", hands: "bk", legs: "bk", feet: "bk" }, height: 2.15, frame: 1.25,
      });
    default:
      // crypt_dead
      return buildHuman({
        skin: shade(0xd8d2bc, v), hair: 0x3a3530, hairStyle: "bald", shirt: 0x5a5444, coat: 0x4a443a, trousers: 0x46403a, boots: 0xc8c0a8,
        belt: 0x2a241c, height: 1.8, frame: 0.78,
      });
  }
}

type Part = [THREE.BufferGeometry, number];
const ZM = new THREE.MeshBasicMaterial();
const xf = (g: THREE.BufferGeometry, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0) => {
  if (rx || ry || rz) g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, ry, rz)));
  return g.translate(x, y, z);
};
const B = (w: number, h: number, d: number, x: number, y: number, z: number, c: number, rx = 0, ry = 0, rz = 0): Part => [xf(new THREE.BoxGeometry(w, h, d), x, y, z, rx, ry, rz), c];
const C = (r0: number, r1: number, h: number, x: number, y: number, z: number, c: number, rx = 0, ry = 0, rz = 0, seg = 8): Part => [
  xf(new THREE.CylinderGeometry(r1, r0, h, seg), x, y, z, rx, ry, rz), c,
];
const K = (r: number, h: number, x: number, y: number, z: number, c: number, rx = 0, ry = 0, rz = 0, seg = 5): Part => [xf(new THREE.ConeGeometry(r, h, seg), x, y, z, rx, ry, rz), c];
const E = (rx: number, ry: number, rz: number, x: number, y: number, z: number, c: number): Part => {
  const g = new THREE.SphereGeometry(1, 8, 6);
  g.scale(rx, ry, rz);
  return [g.translate(x, y, z), c];
};

/** Merges small parts into one mesh (one draw call, the foe's own material so it flashes when hit) hung on a bone or socket. */
function attach(parent: THREE.Object3D | undefined, mat: THREE.Material, parts: Part[]) {
  if (!parent || !parts.length) return null;
  const g = new THREE.Group();
  for (const [geo, c] of parts) {
    tint(geo, c);
    g.add(new THREE.Mesh(geo, ZM));
  }
  const m = flatten(g, mat);
  for (const [geo] of parts) geo.dispose();
  m.castShadow = true;
  parent.add(m);
  return m;
}

/** A bullwhip in the hand: a short grip and a lash that curls forward and down. */
function whip(): Part[] {
  const out: Part[] = [C(0.028, 0.024, 0.32, 0, 0.06, 0, 0x2a1a10, 0, 0, 0, 6)];
  let x = 0;
  let y = 0.22;
  let a = 0.15;
  for (let i = 0; i < 8; i++) {
    const len = 0.26;
    const nx = x + Math.sin(a) * len;
    const ny = y + Math.cos(a) * len;
    const r = 0.018 - i * 0.0016;
    out.push(C(r, r * 0.9, len + 0.02, (x + nx) / 2, (y + ny) / 2, 0, 0x4a3020, 0, 0, -a, 5));
    x = nx;
    y = ny;
    a += 0.28;
  }
  return out;
}

/** Weapons, shields, helmets' plumes, tusks, jaws, weed: everything worn beyond the body. */
function dress(kind: MobKind, rig: Rig, mat: THREE.Material) {
  const S = rig.sockets;
  const Bn = rig.bones;
  switch (kind) {
    case "bandit": {
      S.gripR?.add(weaponModel(pick(["wpn_iron_sword", "wpn_iron_axe", "wpn_stone_knife", "club"])));
      // a scarf over the face and leather patches
      attach(Bn.head, mat, [B(0.17, 0.07, 0.05, 0, 0.045, 0.1, 0x5a2a22)]);
      attach(Bn.chest, mat, [B(0.08, 0.07, 0.02, 0.08, -0.02, 0.15, 0x7a5a3a, 0, 0, 0.3), B(0.06, 0.09, 0.02, -0.1, 0.1, 0.148, 0x4a3422, 0, 0, -0.2)]);
      break;
    }
    case "deserter": {
      S.gripR?.add(weaponModel(pick(["wpn_iron_spear", "wpn_iron_mace", "wpn_iron_sword"])));
      // a faded Kingdom tabard: slate cloth, a gold band, torn short
      attach(Bn.chest, mat, [B(0.27, 0.36, 0.02, 0, -0.02, 0.165, 0x3a4556), B(0.05, 0.36, 0.022, 0, -0.02, 0.168, 0xb08a3e), B(0.27, 0.32, 0.02, 0, -0.04, -0.16, 0x3a4556)]);
      attach(Bn.hips, mat, [B(0.25, 0.34, 0.02, 0, -0.2, 0.25, 0x344050, -0.08), B(0.05, 0.3, 0.022, 0, -0.18, 0.255, 0xa0803a, -0.08)]);
      break;
    }
    case "hound":
      break;
    case "boar":
      // snout disc and tusks on the head, a bristle ridge on the back
      attach(Bn.head, mat, [
        C(0.065, 0.065, 0.04, 0, -0.02, 0.29, 0x6a4a40, Math.PI / 2, 0, 0, 10),
        K(0.022, 0.16, 0.06, -0.02, 0.22, 0xe8e0c8, 0.6, 0, -0.5),
        K(0.022, 0.16, -0.06, -0.02, 0.22, 0xe8e0c8, 0.6, 0, 0.5),
      ]);
      attach(Bn.body, mat, [B(0.05, 0.1, 0.62, 0, 0.19, 0.04, 0x221a14), B(0.05, 0.12, 0.2, 0, 0.21, 0.32, 0x221a14)]);
      break;
    case "blackwolf":
      attach(Bn.chest, mat, [E(0.2, 0.16, 0.14, 0, 0.12, 0.02, 0x1a181e)]); // a heavy ruff
      break;
    case "kennel_hound": {
      const spikes: Part[] = [];
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        spikes.push(K(0.018, 0.07, Math.sin(a) * 0.15, 0, 0.02 + Math.cos(a) * 0.15, 0x8a8a8e, 0, a - Math.PI / 2, -Math.PI / 2, 4));
      }
      attach(Bn.neck, mat, spikes);
      break;
    }
    case "kennelmaster":
      attach(S.gripR, mat, whip());
      S.gripL?.add(weaponModel("wpn_iron_mace"));
      // a hound-hide mantle and an iron muzzle-mask
      attach(Bn.chest, mat, [E(0.3, 0.1, 0.2, 0, 0.2, -0.02, 0x221e1b), B(0.16, 0.06, 0.04, 0, 0.21, 0.13, 0x8a2420)]);
      attach(Bn.head, mat, [B(0.15, 0.06, 0.04, 0, 0.05, 0.115, 0x45484d), B(0.02, 0.1, 0.045, 0, 0.08, 0.118, 0x45484d)]);
      break;
    case "drowned": {
      // weed hanging from the head and shoulders
      const weed: Part[] = [];
      for (let i = 0; i < 5; i++) weed.push(B(0.025, 0.22 + Math.random() * 0.12, 0.012, -0.1 + i * 0.05, 0.02, 0.1 + Math.random() * 0.04, 0x3e5a2a, 0.1, 0, (Math.random() - 0.5) * 0.4));
      attach(Bn.head, mat, weed);
      attach(Bn.chest, mat, [
        B(0.03, 0.34, 0.012, 0.16, 0.0, 0.12, 0x2e4a22, 0, 0, 0.15), B(0.03, 0.28, 0.012, -0.14, 0.04, 0.13, 0x3e5a2a, 0, 0, -0.1),
        B(0.03, 0.3, 0.012, 0.05, -0.05, -0.14, 0x2e4a22), E(0.05, 0.04, 0.05, -0.05, -0.12, 0.13, 0x6a7a4a),
      ]);
      break;
    }
    case "croc": {
      const teeth = (z0: number, y: number, up: number): Part[] => {
        const t: Part[] = [];
        for (let i = 0; i < 5; i++) for (const sx of [1, -1]) t.push(K(0.012, 0.04, sx * 0.07, y, z0 + i * 0.055, 0xe0dcc8, up > 0 ? 0 : Math.PI, 0, 0, 4));
        return t;
      };
      attach(Bn.head, mat, [
        B(0.17, 0.07, 0.36, 0, -0.01, 0.26, 0x3e4a36), E(0.035, 0.03, 0.035, 0.07, 0.07, 0.02, 0x8a8a40), E(0.035, 0.03, 0.035, -0.07, 0.07, 0.02, 0x8a8a40),
        ...teeth(0.14, -0.06, -1),
      ]);
      attach(Bn.jaw, mat, [B(0.15, 0.045, 0.34, 0, -0.035, 0.2, 0x8a8a68), ...teeth(0.1, 0.0, 1)]);
      const tail: Part[] = [K(0.1, 0.95, 0, -0.05, -0.5, 0x3e4a36, -Math.PI / 2, 0, 0, 6)];
      for (let i = 0; i < 4; i++) tail.push(B(0.03, 0.05, 0.08, 0, 0.02 - i * 0.012, -0.15 - i * 0.18, 0x2e3828));
      attach(Bn.tail2, mat, tail);
      const back: Part[] = [];
      for (let i = 0; i < 6; i++) for (const sx of [1, -1]) back.push(B(0.04, 0.06, 0.08, sx * 0.07, 0.19, -0.3 + i * 0.12, 0x2e3828));
      attach(Bn.body, mat, back);
      break;
    }
    case "witch": {
      attach(Bn.head, mat, [K(0.09, 0.26, 0, 0.22, -0.13, 0x241f26, -0.9, 0, 0, 7)]);
      for (const s of ["L", "R"]) {
        const claws: Part[] = [];
        for (let i = 0; i < 3; i++) claws.push(K(0.01, 0.09, (i - 1) * 0.022, -0.12, 0.02, 0x2a2420, Math.PI, 0, 0, 4));
        attach(Bn["hand" + s], mat, claws);
      }
      break;
    }
    case "black_guard": {
      S.gripR?.add(weaponModel("wpn_blackiron_sword"));
      const holder = new THREE.Group();
      holder.rotation.set(0, Math.PI / 2, 0);
      holder.position.set(0.06, 0.05, -0.1);
      Bn.foreL?.add(holder);
      const shield = attach(holder, mat, [
        C(0.38, 0.3, 0.06, 0, -0.02, 0, 0x1e1e24, Math.PI / 2, 0, 0, 6),
        C(0.07, 0.07, 0.06, 0, 0, 0.04, 0xa07e36, Math.PI / 2, 0, 0, 8),
        B(0.04, 0.6, 0.02, 0, -0.04, 0.035, 0x2e2e36),
      ]);
      if (shield) shield.scale.set(1, 1.25, 1);
      break;
    }
    case "keep_knight":
      S.gripR?.add(weaponModel("wpn_steel_greatsword"));
      attach(Bn.head, mat, [K(0.03, 0.16, 0, 0.36, -0.02, 0x6a1a1c, -0.3, 0, 0, 5)]);
      break;
    case "crypt_dead": {
      S.gripR?.add(weaponModel(pick(["club", "wpn_iron_axe", "wpn_iron_sword"])));
      const rags: Part[] = [];
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        rags.push(B(0.09, 0.22 + Math.random() * 0.16, 0.015, Math.sin(a) * 0.2, -0.32, Math.cos(a) * 0.2, 0x3a352c, 0, a, 0));
      }
      attach(Bn.hips, mat, rags);
      attach(Bn.chest, mat, [0, 1, 2].map((i) => B(0.2 - i * 0.03, 0.018, 0.02, 0, 0.1 - i * 0.06, 0.135, 0xd8d2bc)));
      attach(Bn.head, mat, [E(0.022, 0.026, 0.01, 0.042, 0.125, 0.118, 0x0c0a0a), E(0.022, 0.026, 0.01, -0.042, 0.125, 0.118, 0x0c0a0a)]);
      break;
    }
  }
}

let nextId = 1;

/** Network order of Mob.state; snapshots send the index. */
export const MOB_STATES = ["idle", "chase", "tell", "active", "recover", "stagger", "flee", "dead", "return"] as const;
/** Network order of kinds: append only, never reorder (snapshots send the index). */
export const MOB_KINDS: MobKind[] = [
  "wolf", "goblin", "redcap", "soldier", "mouse", "horse", "deer",
  "bandit", "deserter", "hound", "boar", "blackwolf", "kennel_hound", "kennelmaster", "drowned", "croc", "witch", "black_guard", "keep_knight", "crypt_dead",
];
/** ax, az: where an aimed attack (a witch's hex) lands; sent only while one is told or struck. */
export type MobSnap = [key: string, x: number, z: number, yaw: number, st: number, hp: number, atk: number, t: number, kind: number, ax?: number, az?: number];

export class Mob {
  id = nextId++;
  cfg: Cfg;
  rig: Rig;
  poser: Poser | null;
  mat: THREE.MeshLambertMaterial;
  mouse?: THREE.Group;
  x: number;
  z: number;
  y = 0;
  yaw: number;
  hp: number;
  alive = true;
  state: "idle" | "chase" | "tell" | "active" | "recover" | "stagger" | "flee" | "dead" | "return" = "idle";
  t = 0;
  cd = 0;
  atk: Attack | null = null;
  decal: Decal | null = null;
  hitDone = false;
  phase = Math.random() * 6;
  speed = 0;
  kx = 0;
  kz = 0;
  flash = 0;
  deadT = 0;
  respawnT = 0;
  aggro = false;
  strafeDir = Math.random() < 0.5 ? 1 : -1;
  aimX = 0;
  aimZ = 0;
  wander = 0;
  wx: number;
  wz: number;
  summoned = false;
  idleT = Math.random() * 5;
  /** stable network key: a spawn key ("w1") or a toy key ("t3") */
  key = "";
  /** the player this foe is after (multiplayer: the nearest one, re-picked now and then) */
  target: PlayerState | null = null;
  private retargetT = 0;
  private hitSet = new Set<PlayerState>();
  /** players who struck this foe (hounds forget a Hound Bell wearer's peace once struck) */
  private struck = new Set<PlayerState>();
  /** true on clients that do not run the world: positions and states come from snapshots */
  puppet = false;
  private net: { x: number; z: number; yaw: number } | null = null;

  /** The local player is near enough to hear this foe and feel its blows land. */
  get heard() {
    return this.env.heard(this.x, this.z, this.zone);
  }

  private get sfx() {
    return this.heard ? this.env.audio : SILENT;
  }

  constructor(public kind: MobKind, public homeX: number, public homeZ: number, public zone: ZoneId, private env: Env, public respawns = true) {
    this.cfg = MOBS[kind];
    const made = makeRig(kind);
    this.rig = made.rig;
    this.mat = made.mat;
    this.mouse = made.mouse;
    this.poser = made.mouse ? null : new Poser(this.rig);
    this.x = this.wx = homeX;
    this.z = this.wz = homeZ;
    this.yaw = Math.random() * Math.PI * 2;
    this.hp = this.cfg.hp;
    env.parent(zone).add(this.rig.group);
    this.y = env.groundAt(this.x, this.z);
    this.rig.group.position.set(this.x, this.y, this.z);
  }

  get max() {
    return this.cfg.hp;
  }

  distTo(x: number, z: number) {
    return Math.hypot(this.x - x, this.z - z);
  }

  remove() {
    this.rig.group.parent?.remove(this.rig.group);
    this.env.decals.release(this.decal);
    this.decal = null;
  }

  reset() {
    this.hp = this.cfg.hp;
    this.alive = true;
    this.state = "idle";
    this.target = null;
    this.x = this.homeX;
    this.z = this.homeZ;
    this.aggro = false;
    this.struck.clear();
    this.rig.group.visible = true;
    this.deadT = 0;
    this.env.decals.release(this.decal);
    this.decal = null;
  }

  stagger(t: number) {
    if (!this.alive) return;
    this.state = "stagger";
    this.t = t * (this.cfg.reel ?? 1);
    this.env.decals.release(this.decal);
    this.decal = null;
  }

  /** Returns damage dealt. */
  takeHit(dmg: number, fromX: number, fromZ: number, heavy: boolean, fire = false, by?: PlayerState) {
    if (!this.alive) return 0;
    const env = this.env;
    const cfg = this.cfg;
    let d = dmg;
    if (fire) d = Math.round(d * cfg.fireWeak);
    if (this.kind === "horse" && this.state === "recover") d = Math.round(d * 1.35);
    // remember who struck (the hitter stands at fromX, fromZ when the caller does not say)
    const who = by ?? this.nearestTo(fromX, fromZ);
    if (who) {
      this.struck.add(who);
      if (cfg.family === "hound" && (!this.target || this.ignores(this.target))) this.target = who;
    }
    // a shield: half from the front unless the blow is heavy or the foe reels
    if (cfg.front != null && !heavy && this.state !== "stagger") {
      const fx = fromX - this.x;
      const fz = fromZ - this.z;
      const l = Math.hypot(fx, fz) || 1;
      if ((fx * Math.sin(this.yaw) + fz * Math.cos(this.yaw)) / l > 0.3) {
        d = Math.max(1, Math.round(d * cfg.front));
        env.sparks.burst(8, this.x + (fx / l) * 0.6, this.y + 1.2, this.z + (fz / l) * 0.6, 3, 0xffd8a0, 0.3, 0.06, { up: 1, grav: 6 });
        this.sfx.block();
      }
    }
    this.hp -= d;
    this.flash = 0.12;
    const dx = this.x - fromX;
    const dz = this.z - fromZ;
    const len = Math.hypot(dx, dz) || 1;
    const push = (heavy ? 5 : 2.5) * (this.kind === "horse" || this.kind === "redcap" ? 0.3 : cfg.mass ?? 1);
    this.kx += (dx / len) * push;
    this.kz += (dz / len) * push;
    this.aggro = true;
    if (this.cfg.flees) {
      this.state = "flee";
      this.t = 4;
    } else if (
      heavy && this.kind !== "horse" && (this.kind !== "redcap" || this.state !== "active") &&
      !(cfg.hyper === "active" && this.state === "active") && !(cfg.hyper === "attack" && (this.state === "active" || this.state === "tell"))
    ) {
      this.stagger(this.kind === "redcap" ? 0.5 : 0.7);
    } else if (this.state === "idle" || this.state === "chase") {
      this.state = "chase";
    }
    if (this.hp <= 0) this.die();
    return d;
  }

  die() {
    this.alive = false;
    this.hp = 0;
    this.state = "dead";
    this.deadT = 0;
    this.respawnT = this.respawns && !this.puppet ? 150 : Infinity;
    this.env.decals.release(this.decal);
    this.decal = null;
    if (this.cfg.family === "hound") this.sfx.yelp();
    if (this.kind === "soldier" || this.kind === "mouse" || this.kind === "horse" || this.kind === "crypt_dead") {
      this.env.dust.burst(26, this.x, this.y + 0.8, this.z, 4, 0xd8c8a8, 1.0, 0.18, { up: 2, grav: 7 });
      this.sfx.clack();
    } else this.env.dust.burst(14, this.x, this.y + 0.5, this.z, 2.5, 0x6a5a48, 0.8, 0.22, { up: 1.5 });
  }

  /** The nearest player in this foe's zone; sticky, so it does not flip between two people. */
  private choose(dt: number): PlayerState {
    const env = this.env;
    const all = env.players();
    const ok = (q: PlayerState) => !q.dead && q.zone === this.zone && !this.ignores(q);
    if (this.target && (!ok(this.target) || !all.includes(this.target))) this.target = null;
    this.retargetT -= dt;
    if (!this.target || this.retargetT <= 0) {
      this.retargetT = 0.8;
      let best = this.target;
      let bd = best ? this.distTo(best.x, best.z) - 3 : 1e9;
      for (const q of all)
        if (ok(q)) {
          const d = this.distTo(q.x, q.z);
          if (d < bd) {
            bd = d;
            best = q;
          }
        }
      this.target = best;
    }
    return this.target ?? env.player;
  }

  /** Hounds and wolves leave a Hound Bell wearer be until that player strikes them. */
  private ignores(q: PlayerState) {
    return this.cfg.family === "hound" && !!q.calm && !this.struck.has(q);
  }

  /** The player standing nearest a point in this foe's zone (who struck it, when the caller only gives where from). */
  private nearestTo(x: number, z: number): PlayerState | null {
    let best: PlayerState | null = null;
    let bd = 4;
    for (const q of this.env.players()) {
      if (q.zone !== this.zone) continue;
      const d = Math.hypot(q.x - x, q.z - z);
      if (d < bd) {
        bd = d;
        best = q;
      }
    }
    return best;
  }

  /** Where an attack is centred: an aimed spot, a step ahead (ground blows) or the foe itself. */
  private origin(atk: Attack): [number, number] {
    if (atk.target) return [this.aimX, this.aimZ];
    if (atk.ground) return [this.x + Math.sin(this.yaw) * 1.4, this.z + Math.cos(this.yaw) * 1.4];
    return [this.x, this.z];
  }

  /** Whether a point stands inside this foe's current attack. */
  private inAttack(atk: Attack, ox: number, oz: number, px: number, pz: number) {
    const dx = px - ox;
    const dz = pz - oz;
    const dd = Math.hypot(dx, dz);
    if (atk.shape === 0) return dd < atk.size + 0.3;
    if (atk.shape === 1) {
      const ang = Math.abs(Math.atan2(Math.sin(Math.atan2(dx, dz) - this.yaw), Math.cos(Math.atan2(dx, dz) - this.yaw)));
      return dd < atk.size * 0.85 + 0.3 && ang < (atk.half ?? 0.6) + 0.3;
    }
    const fx = Math.sin(this.yaw);
    const fz = Math.cos(this.yaw);
    const along = dx * fx + dz * fz;
    const side = Math.abs(-dx * fz + dz * fx);
    return this.kind === "horse" || this.kind === "wolf" || atk.body ? dd < this.cfg.radius + 0.75 : along > -0.3 && along < atk.size * 0.9 && side < (atk.width ?? 0.7) + 0.35;
  }

  /** Snapshot for the network. */
  snap(): MobSnap {
    const r = (v: number) => Math.round(v * 100) / 100;
    const sn: MobSnap = [this.key, r(this.x), r(this.z), r(this.yaw), MOB_STATES.indexOf(this.state), Math.round(this.hp), this.atk ? this.cfg.attacks.indexOf(this.atk) : -1, r(Math.max(0, this.t)), MOB_KINDS.indexOf(this.kind)];
    if (this.atk?.target && (this.state === "tell" || this.state === "active")) sn.push(r(this.aimX), r(this.aimZ));
    return sn;
  }

  /** Applies a snapshot from the client that runs the world. */
  applySnap(sn: MobSnap) {
    const [, x, z, yaw, st, hp, atk, t, , ax, az] = sn;
    if (typeof ax === "number" && typeof az === "number") {
      this.aimX = ax;
      this.aimZ = az;
    }
    const state = MOB_STATES[st] ?? "idle";
    if (!this.net || Math.hypot(x - this.x, z - this.z) > 10) {
      this.x = x;
      this.z = z;
      this.yaw = yaw;
    }
    this.net = { x, z, yaw };
    this.hp = hp;
    if (state === "dead" && this.alive) {
      this.die();
      this.respawnT = Infinity;
    } else if (state !== "dead" && !this.alive) {
      this.reset();
      this.x = x;
      this.z = z;
    }
    if (state !== this.state) {
      if (this.state === "tell") {
        this.env.decals.release(this.decal);
        this.decal = null;
      }
      this.state = state;
      this.t = t;
      if (state === "tell") this.decal = this.env.decals.get();
      if (state === "active") this.sfx.swing((this.atk?.dmg ?? 0) > 14);
    } else if (Math.abs(this.t - t) > 0.2) this.t = t;
    this.atk = atk >= 0 ? this.cfg.attacks[atk] ?? null : null;
  }

  /** Becomes the real thing (this client now runs the world) or a puppet. */
  setPuppet(on: boolean) {
    if (this.puppet === on) return;
    this.puppet = on;
    this.net = null;
    this.target = null;
    if (!on && this.alive && (this.state === "tell" || this.state === "active")) {
      this.env.decals.release(this.decal);
      this.decal = null;
      this.state = "chase";
      this.cd = 0.6;
    }
    if (!on && !this.alive) this.respawnT = this.respawns ? 150 : Infinity;
  }

  private puppetUpdate(dt: number) {
    const env = this.env;
    if (this.flash > 0) this.flash -= dt;
    this.mat.emissive.setHex(this.flash > 0 ? 0xff8866 : 0x000000);
    this.mat.emissiveIntensity = this.flash > 0 ? 0.9 : 0;
    if (this.state === "dead") {
      this.deadT += dt;
      if (this.deadT > 3.5) this.rig.group.position.y = this.y - (this.deadT - 3.5) * 0.6;
      if (this.deadT > 5) this.rig.group.visible = false;
      this.animate(dt);
      return;
    }
    this.t -= dt;
    const ox = this.x;
    const oz = this.z;
    if (this.net) {
      const k = Math.min(1, dt * 9);
      this.x += (this.net.x - this.x) * k;
      this.z += (this.net.z - this.z) * k;
      const dy = Math.atan2(Math.sin(this.net.yaw - this.yaw), Math.cos(this.net.yaw - this.yaw));
      this.yaw += dy * Math.min(1, dt * 10);
    }
    const sp = Math.hypot(this.x - ox, this.z - oz) / Math.max(dt, 1e-3);
    this.speed += (Math.min(sp, 12) - this.speed) * Math.min(1, dt * 6);
    if (this.state === "tell" && this.atk && this.decal) {
      const atk = this.atk;
      const k = 1 - Math.max(0, this.t) / atk.tell;
      const [cx, cz] = this.origin(atk);
      this.decal.show(atk.shape, cx, env.groundAt(cx, cz), cz, this.yaw, atk.size, k, { half: atk.half, w: atk.width, color: atk.color ?? 0xd9663a });
    }
    this.y = env.groundAt(this.x, this.z);
    this.animate(dt);
  }

  update(dt: number) {
    if (this.puppet) return this.puppetUpdate(dt);
    const env = this.env;
    const p = this.choose(dt);
    if (this.flash > 0) this.flash -= dt;
    this.mat.emissive.setHex(this.flash > 0 ? 0xff8866 : 0x000000);
    this.mat.emissiveIntensity = this.flash > 0 ? 0.9 : 0;
    if (this.state === "dead") {
      this.deadT += dt;
      if (this.deadT > 3.5) this.rig.group.position.y = this.y - (this.deadT - 3.5) * 0.6;
      if (this.deadT > 5) this.rig.group.visible = false;
      this.respawnT -= dt;
      if (this.respawnT <= 0 && env.players().every((q) => this.distTo(q.x, q.z) > 45 || q.zone !== this.zone)) this.reset();
      this.animate(dt);
      return;
    }
    const sameZone = p.zone === this.zone && !p.dead && !this.ignores(p);
    const d = this.distTo(p.x, p.z);
    const cfg = this.cfg;
    this.cd -= dt;
    this.t -= dt;
    let want = 0;
    let wantX = 0;
    let wantZ = 0;
    const face = (tx: number, tz: number, rate: number) => {
      const ty = Math.atan2(tx - this.x, tz - this.z);
      const diff = Math.atan2(Math.sin(ty - this.yaw), Math.cos(ty - this.yaw));
      this.yaw += Math.sign(diff) * Math.min(Math.abs(diff), rate * dt);
    };
    switch (this.state) {
      case "idle": {
        this.idleT -= dt;
        if (this.idleT <= 0) {
          this.idleT = 3 + Math.random() * 5;
          const a = Math.random() * Math.PI * 2;
          const r = Math.random() * (this.kind === "deer" ? 8 : 4);
          this.wx = this.homeX + Math.cos(a) * r;
          this.wz = this.homeZ + Math.sin(a) * r;
        }
        if (Math.hypot(this.wx - this.x, this.wz - this.z) > 0.6 && this.idleT < 2.5) {
          want = cfg.speed * 0.6;
          wantX = this.wx - this.x;
          wantZ = this.wz - this.z;
          face(this.wx, this.wz, 3);
        }
        if (sameZone && d < cfg.aggro) {
          if (cfg.flees) {
            this.state = "flee";
            this.t = 5;
          } else {
            this.state = "chase";
            this.aggro = true;
            this.cd = 0.4 + Math.random() * 0.6;
            if (this.kind === "wolf") this.sfx.growl();
            else if (this.kind === "goblin" || this.kind === "redcap") this.sfx.shriek();
            else if (this.kind === "soldier" || this.kind === "mouse") this.sfx.wind();
            else if (cfg.cry === "bell") this.sfx.bell(0.14, 196);
            else if (cfg.cry) this.sfx[cfg.cry]();
            env.floater("!", this.x, this.y + cfg.height + 0.6, this.z, "info");
          }
        }
        break;
      }
      case "flee": {
        want = cfg.run;
        wantX = this.x - p.x;
        wantZ = this.z - p.z;
        face(this.x + wantX, this.z + wantZ, 6);
        if (this.t <= 0 && d > cfg.aggro) this.state = "idle";
        break;
      }
      case "return": {
        want = cfg.run;
        wantX = this.homeX - this.x;
        wantZ = this.homeZ - this.z;
        face(this.homeX, this.homeZ, 6);
        this.hp = Math.min(this.max, this.hp + this.max * 0.3 * dt);
        if (Math.hypot(wantX, wantZ) < 1.5) {
          this.state = "idle";
          this.aggro = false;
          this.struck.clear();
        }
        break;
      }
      case "chase": {
        if (!sameZone || Math.hypot(this.x - this.homeX, this.z - this.homeZ) > cfg.leash) {
          this.state = "return";
          break;
        }
        if (p === env.player) env.combat(true);
        face(p.x, p.z, 7);
        let atk: Attack | null = null;
        if (cfg.mix) {
          const ok = cfg.attacks.filter((a) => d <= a.range && d >= (a.min ?? 0));
          atk = ok.length ? ok[Math.floor(Math.random() * ok.length)] : null;
        } else atk = cfg.attacks.find((a) => d <= a.range && (this.kind !== "horse" || a.name !== "charge" || d > 4)) ?? null;
        if (atk && this.cd <= 0) {
          this.atk = atk;
          this.state = "tell";
          this.t = atk.tell;
          this.hitDone = false;
          this.hitSet.clear();
          this.aimX = p.x;
          this.aimZ = p.z;
          this.decal = env.decals.get();
          if (cfg.family === "hound" || (this.kind === "croc" && atk.name === "bite")) this.sfx.growl();
          if (this.kind === "horse" && atk.name === "charge") this.sfx.charge();
          if ((this.kind === "boar" && atk.name === "charge") || (this.kind === "kennelmaster" && atk.name === "slam")) this.sfx.charge();
          break;
        }
        if (cfg.keep) {
          // casters keep their distance: back off when pressed, close in when far, circle between
          if (d < cfg.keep * 0.6) {
            want = cfg.run * 0.8;
            wantX = this.x - p.x;
            wantZ = this.z - p.z;
          } else if (d > cfg.keep) {
            want = d > 12 ? cfg.run : cfg.speed * 1.2;
            wantX = p.x - this.x;
            wantZ = p.z - this.z;
          } else {
            want = cfg.speed * 0.7;
            wantX = -(p.z - this.z) * this.strafeDir;
            wantZ = (p.x - this.x) * this.strafeDir;
            if (Math.random() < dt * 0.3) this.strafeDir *= -1;
          }
          break;
        }
        const close = cfg.attacks.length ? Math.min(...cfg.attacks.map((a) => a.range)) * 0.85 : 1;
        if (cfg.strafe && d < 5.5 && this.cd > 0) {
          want = cfg.speed * 1.3;
          const tx = -(p.z - this.z) * this.strafeDir;
          const tz = (p.x - this.x) * this.strafeDir;
          wantX = tx + (d < 3.2 ? this.x - p.x : p.x - this.x) * 0.6;
          wantZ = tz + (d < 3.2 ? this.z - p.z : p.z - this.z) * 0.6;
          if (Math.random() < dt * 0.3) this.strafeDir *= -1;
        } else if (d > close) {
          want = d > 6 ? cfg.run : cfg.run * 0.7;
          wantX = p.x - this.x;
          wantZ = p.z - this.z;
        }
        break;
      }
      case "tell": {
        const atk = this.atk!;
        const k = 1 - Math.max(0, this.t) / atk.tell;
        if (k < (atk.target ? 0.3 : 0.7)) {
          face(p.x, p.z, 5);
          this.aimX = p.x;
          this.aimZ = p.z;
          if (atk.target) {
            // an aimed spot never lands beyond the attack's reach
            const ax = this.aimX - this.x;
            const az = this.aimZ - this.z;
            const al = Math.hypot(ax, az);
            if (al > atk.range) {
              this.aimX = this.x + (ax / al) * atk.range;
              this.aimZ = this.z + (az / al) * atk.range;
            }
          }
        }
        if (this.decal) {
          const [cx, cz] = this.origin(atk);
          this.decal.show(atk.shape, cx, env.groundAt(cx, cz), cz, this.yaw, atk.size, k, { half: atk.half, w: atk.width, color: atk.color ?? 0xd9663a });
        }
        if (this.t <= 0) {
          this.state = "active";
          this.t = atk.active;
          env.decals.release(this.decal);
          this.decal = null;
          this.sfx.swing(atk.dmg > 14);
        }
        break;
      }
      case "active": {
        const atk = this.atk!;
        want = 0;
        this.kx += Math.sin(this.yaw) * atk.lunge * dt * 8;
        this.kz += Math.cos(this.yaw) * atk.lunge * dt * 8;
        const lim = atk.lunge;
        const kl = Math.hypot(this.kx, this.kz);
        if (kl > lim && lim > 0) {
          this.kx *= lim / kl;
          this.kz *= lim / kl;
        }
        if (!this.hitDone) {
          const [ox, oz] = this.origin(atk);
          // each player is struck at most once per attack
          for (const q of env.players()) {
            if (q.dead || q.zone !== this.zone || this.hitSet.has(q) || this.ignores(q)) continue;
            if (!this.inAttack(atk, ox, oz, q.x, q.z)) continue;
            this.hitSet.add(q);
            env.hurt(q, atk.dmg, this.x, this.z, { knock: atk.knock, source: this, parryable: true, src: this.key });
            if (!atk.ground && q === p) this.hitDone = true;
          }
          if (atk.ground && this.t < atk.active * 0.5 && !this.hitDone) {
            this.hitDone = true;
            env.flashes.ring(ox, env.groundAt(ox, oz), oz, atk.size, atk.target ? 0xc8a0ff : 0xffcf90, 0.4);
            env.dust.burst(12, ox, env.groundAt(ox, oz) + 0.2, oz, 3, atk.target ? 0x4a3a5a : 0x7a6a58, 0.6, 0.3, { up: 1 });
            if (this.heard) env.shake(0.25);
            this.sfx.thud();
          }
        }
        if (this.t <= 0) {
          this.state = "recover";
          this.t = atk.recover;
          this.cd = atk.cooldown + Math.random() * 0.6;
        }
        break;
      }
      case "recover":
        if (this.t <= 0) this.state = "chase";
        break;
      case "stagger":
        if (this.t <= 0) this.state = "chase";
        break;
    }
    // movement
    let vx = 0;
    let vz = 0;
    if (want > 0) {
      const l = Math.hypot(wantX, wantZ) || 1;
      vx = (wantX / l) * want;
      vz = (wantZ / l) * want;
    }
    this.speed += (Math.hypot(vx, vz) - this.speed) * Math.min(1, dt * 8);
    const decay = Math.exp(-dt * (this.state === "active" ? 2 : 7));
    let nx = this.x + (vx + this.kx) * dt;
    let nz = this.z + (vz + this.kz) * dt;
    this.kx *= decay;
    this.kz *= decay;
    if (env.blocked(nx, nz)) {
      nx = this.x;
      nz = this.z;
    }
    const solved = env.col.resolve(nx, nz, cfg.radius);
    if (this.kind === "horse" && this.state === "active" && (Math.abs(solved.x - nx) + Math.abs(solved.z - nz) > 0.05)) {
      this.state = "recover";
      this.t = (this.atk?.recover ?? 1) + 0.5;
      this.kx = this.kz = 0;
      this.sfx.thud();
      if (this.heard) env.shake(0.2);
    }
    this.x = solved.x;
    this.z = solved.z;
    this.y = env.groundAt(this.x, this.z);
    this.animate(dt);
  }

  animate(dt: number) {
    const g = this.rig.group;
    g.position.set(this.x, this.state === "dead" && this.deadT > 3.5 ? g.position.y : this.y, this.z);
    g.rotation.y = this.yaw;
    const t = this.env.time;
    const stride =
      this.kind === "wolf" || this.kind === "deer" || this.kind === "hound" || this.kind === "blackwolf" || this.kind === "kennel_hound" ? 1.6
      : this.kind === "mouse" ? 0.5 : this.kind === "croc" || this.kind === "boar" ? 0.9 : 1.1;
    this.phase += (this.speed / stride) * dt * Math.PI;
    if (this.mouse) {
      this.mouse.position.y = Math.abs(Math.sin(this.phase * 2)) * 0.05;
      this.mouse.rotation.x = this.state === "tell" ? -0.3 : 0;
      this.mouse.rotation.z = this.state === "dead" ? Math.PI / 2 : 0;
      const key = this.mouse.getObjectByName("key");
      if (key) key.rotation.z += dt * (this.state === "dead" ? 0 : 6);
      return;
    }
    const poser = this.poser!;
    const k = this.atk && this.state === "tell" ? 1 - Math.max(0, this.t) / this.atk.tell : this.atk && this.state === "active" ? 1 - Math.max(0, this.t) / this.atk.active : 0;
    if (QUADS.has(this.kind)) {
      let action: QuadAction = "none";
      let at = 0;
      const tailSwipe = this.kind === "croc" && this.atk?.hitPose === "tail";
      if (this.state === "tell") {
        action = "crouch";
        at = k;
        // a croc coils before its tail swipe: the body bends away from the target
        if (tailSwipe) g.rotation.y = this.yaw - 0.5 * Math.sin(k * Math.PI * 0.5);
      } else if (this.state === "active") {
        if (tailSwipe) {
          // the tail swipe: one full turn on the spot, the tail sweeping the circle
          action = "none";
          g.rotation.y = this.yaw - 0.5 + (Math.PI * 2 + 0.5) * Math.min(1, k);
        } else action = this.atk?.hitPose === "pounce" ? "pounce" : "bite";
        at = k;
      } else if (this.state === "stagger") {
        action = "hurt";
        at = Math.min(1, 1 - this.t / 0.7);
      } else if (this.state === "dead") {
        action = "dead";
        at = this.deadT;
      } else if (this.kind === "deer" && this.speed < 0.3 && Math.sin(t * 0.3 + this.homeX) > 0.2) action = "graze";
      else if (this.kind === "boar" && this.speed < 0.3 && Math.sin(t * 0.4 + this.homeZ) > 0.3) action = "graze";
      else if (this.cfg.family === "hound" && this.state === "idle" && this.speed < 0.3 && Math.sin(t * 0.21 + this.homeX * 1.7) > 0.93) action = "howl";
      const gait = this.kind === "deer" ? 2.4 : this.kind === "croc" ? 1.6 : this.kind === "boar" ? 2.2 : 2.8;
      poseQuad(poser, { t, move: this.speed / gait, phase: this.phase, action, at }, dt);
    } else if (this.kind === "horse") {
      const rock = this.state === "tell" ? 1 : this.state === "recover" ? 0.15 : this.speed > 0.2 ? 0.4 : 0.2;
      poseHorse(poser, { t: t * (this.state === "tell" ? 2 : 1), rock, charge: this.state === "active", dead: this.state === "dead" ? Math.min(1, this.deadT) : 0 }, dt);
    } else {
      let action: HumanAction = "none";
      let at = 0;
      if (this.state === "tell") {
        action = (this.atk?.tellPose as HumanAction) ?? "windup";
        at = k;
      } else if (this.state === "active") {
        action = (this.atk?.hitPose as HumanAction) ?? "light1";
        at = k;
      } else if (this.state === "stagger") {
        action = "hurt";
        at = Math.min(1, 1 - this.t / 0.7);
      } else if (this.state === "dead") {
        action = "dead";
        at = this.deadT;
      } else if (this.kind === "soldier") action = "march";
      const cfg = this.cfg;
      // shield bearers keep the guard up while they close in or wait out a cooldown
      const block = !!cfg.guard && (this.state === "chase" || this.state === "idle" && this.aggro);
      poseHuman(poser, { t, move: this.speed / (this.kind === "drowned" ? 1.6 : 2.2), phase: this.phase, action, at, block, armed: !cfg.unarmed }, dt);
      // the drowned shamble: a slow side-to-side lurch of the whole body (set absolutely each frame)
      if (this.kind === "drowned") g.rotation.z = this.state === "dead" ? 0 : Math.sin(this.phase * 0.5 + t * 0.9 + this.homeX) * 0.09;
      const key = this.rig.sockets.back?.getObjectByName("key");
      if (key) key.rotation.z += dt * (this.state === "dead" ? 0 : this.state === "recover" ? 1 : 5);
    }
  }
}
