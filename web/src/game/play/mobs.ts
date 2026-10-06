import * as THREE from "three";
import type { Decal, Shape } from "../engine/fx";
import {
  Poser, buildHuman, buildQuad, buildRockingHorse, characterMaterial, poseHorse, poseHuman, poseQuad, type HumanAction, type QuadAction, type Rig,
} from "../engine/rig";
import type { Env } from "./env";
import { weaponModel } from "./weapons";

/**
 * Enemies. Every attack has a tell (a pose, a ground shape and a sound), an active window,
 * and a recovery you can punish. Lethal tells are at least 0.4 s (architecture §combat).
 */

export type MobKind = "wolf" | "goblin" | "redcap" | "soldier" | "mouse" | "horse" | "deer";

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
};

const A = (o: Partial<Attack> & Pick<Attack, "name" | "range" | "tell" | "dmg">): Attack => ({
  active: 0.25, recover: 0.6, shape: 1, size: 2.4, half: 0.6, lunge: 0, knock: 1.2, cooldown: 1.2, tellPose: "windup", hitPose: "light1", ...o,
});

export const MOBS: Record<MobKind, Cfg> = {
  wolf: {
    hp: 34, speed: 2.2, run: 6.2, aggro: 13, leash: 34, radius: 0.55, height: 1.1, fireWeak: 1.2, strafe: true, xp: "wolf",
    loot: [["mat_bone", 1, 1], ["mat_leather", 1, 0.35]],
    attacks: [
      A({ name: "pounce", range: 4.6, tell: 0.55, active: 0.38, recover: 0.75, shape: 2, size: 4.8, width: 0.8, dmg: 11, lunge: 11, knock: 1.6, cooldown: 2.2, tellPose: "crouch", hitPose: "pounce" }),
      A({ name: "bite", range: 1.7, tell: 0.42, active: 0.18, recover: 0.5, shape: 1, size: 2.0, half: 0.55, dmg: 8, lunge: 3, tellPose: "crouch", hitPose: "bite", cooldown: 1.0 }),
    ],
  },
  goblin: {
    hp: 30, speed: 2.4, run: 4.8, aggro: 12, leash: 30, radius: 0.45, height: 1.3, fireWeak: 1.25, xp: "goblin",
    loot: [["mat_leather", 1, 0.8], ["mat_fibre", 2, 0.5]],
    attacks: [
      A({ name: "stab", range: 2.4, tell: 0.42, active: 0.2, recover: 0.6, shape: 2, size: 2.8, width: 0.7, dmg: 9, lunge: 6, tellPose: "windup", hitPose: "thrust" }),
      A({ name: "flurry", range: 1.8, tell: 0.5, active: 0.35, recover: 0.8, shape: 1, size: 2.1, half: 0.8, dmg: 7, lunge: 2, tellPose: "windup", hitPose: "light2", cooldown: 2 }),
    ],
  },
  redcap: {
    hp: 90, speed: 2.0, run: 3.8, aggro: 13, leash: 26, radius: 0.6, height: 1.7, fireWeak: 1.25, xp: "redcap",
    loot: [["mat_copper", 3, 1], ["cons_bandage", 1, 1], ["mat_leather", 2, 1]],
    attacks: [
      A({ name: "slam", range: 3.0, tell: 0.85, active: 0.25, recover: 1.0, shape: 0, size: 2.4, dmg: 18, lunge: 2, knock: 2.4, tellPose: "charge", hitPose: "heavy", ground: true, cooldown: 2 }),
      A({ name: "sweep", range: 2.6, tell: 0.6, active: 0.25, recover: 0.8, shape: 1, size: 3.0, half: 1.1, dmg: 12, lunge: 1, tellPose: "windup", hitPose: "light1", cooldown: 1.6 }),
    ],
  },
  soldier: {
    hp: 30, speed: 1.9, run: 3.4, aggro: 14, leash: 40, radius: 0.45, height: 1.4, fireWeak: 1.5, xp: "soldier",
    loot: [["cons_bandage", 1, 0.25]],
    attacks: [
      A({ name: "bayonet", range: 2.8, tell: 0.55, active: 0.22, recover: 0.9, shape: 2, size: 3.2, width: 0.6, dmg: 10, lunge: 7, tellPose: "windup", hitPose: "thrust" }),
    ],
  },
  mouse: {
    hp: 12, speed: 3, run: 6.8, aggro: 12, leash: 40, radius: 0.3, height: 0.4, fireWeak: 1.5, xp: "mouse",
    loot: [],
    attacks: [A({ name: "nip", range: 1.3, tell: 0.4, active: 0.15, recover: 0.6, shape: 1, size: 1.4, half: 0.7, dmg: 5, lunge: 5, knock: 0.6, tellPose: "crouch", hitPose: "bite", cooldown: 0.9 })],
  },
  horse: {
    hp: 120, speed: 1.4, run: 2.0, aggro: 16, leash: 60, radius: 1.0, height: 2.2, fireWeak: 1.5, xp: "horse",
    loot: [["cons_bandage", 2, 1]],
    attacks: [
      A({ name: "charge", range: 14, tell: 1.0, active: 1.05, recover: 1.5, shape: 2, size: 13, width: 1.5, dmg: 18, lunge: 12.5, knock: 3, tellPose: "rock", hitPose: "charge", cooldown: 1.2 }),
      A({ name: "buck", range: 2.6, tell: 0.6, active: 0.25, recover: 0.9, shape: 0, size: 2.6, dmg: 12, lunge: 0, knock: 2.2, tellPose: "rock", hitPose: "rock", cooldown: 1.5 }),
    ],
  },
  deer: {
    hp: 20, speed: 1.4, run: 7.5, aggro: 12, leash: 60, radius: 0.5, height: 1.5, fireWeak: 1, flees: true, xp: "deer",
    loot: [["mat_leather", 2, 1], ["mat_bone", 1, 0.5]],
    attacks: [],
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
  return { rig, mat };
}

let nextId = 1;

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

  constructor(public kind: MobKind, public homeX: number, public homeZ: number, public dungeon: boolean, private env: Env, public respawns = true) {
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
    env.parent(dungeon).add(this.rig.group);
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
    this.x = this.homeX;
    this.z = this.homeZ;
    this.aggro = false;
    this.rig.group.visible = true;
    this.deadT = 0;
    this.env.decals.release(this.decal);
    this.decal = null;
  }

  stagger(t: number) {
    if (!this.alive) return;
    this.state = "stagger";
    this.t = t;
    this.env.decals.release(this.decal);
    this.decal = null;
  }

  /** Returns damage dealt. */
  takeHit(dmg: number, fromX: number, fromZ: number, heavy: boolean, fire = false) {
    if (!this.alive) return 0;
    const env = this.env;
    let d = dmg;
    if (fire) d = Math.round(d * this.cfg.fireWeak);
    if (this.kind === "horse" && this.state === "recover") d = Math.round(d * 1.35);
    this.hp -= d;
    this.flash = 0.12;
    const dx = this.x - fromX;
    const dz = this.z - fromZ;
    const len = Math.hypot(dx, dz) || 1;
    const push = (heavy ? 5 : 2.5) * (this.kind === "horse" || this.kind === "redcap" ? 0.3 : 1);
    this.kx += (dx / len) * push;
    this.kz += (dz / len) * push;
    this.aggro = true;
    if (this.cfg.flees) {
      this.state = "flee";
      this.t = 4;
    } else if (heavy && this.kind !== "horse" && (this.kind !== "redcap" || this.state !== "active")) {
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
    this.respawnT = this.respawns ? 150 : Infinity;
    this.env.decals.release(this.decal);
    this.decal = null;
    if (this.kind === "wolf") this.env.audio.yelp();
    if (this.kind === "soldier" || this.kind === "mouse" || this.kind === "horse") {
      this.env.dust.burst(26, this.x, this.y + 0.8, this.z, 4, 0xd8c8a8, 1.0, 0.18, { up: 2, grav: 7 });
      this.env.audio.clack();
    } else this.env.dust.burst(14, this.x, this.y + 0.5, this.z, 2.5, 0x6a5a48, 0.8, 0.22, { up: 1.5 });
  }

  update(dt: number) {
    const env = this.env;
    const p = env.player;
    if (this.flash > 0) this.flash -= dt;
    this.mat.emissive.setHex(this.flash > 0 ? 0xff8866 : 0x000000);
    this.mat.emissiveIntensity = this.flash > 0 ? 0.9 : 0;
    if (this.state === "dead") {
      this.deadT += dt;
      if (this.deadT > 3.5) this.rig.group.position.y = this.y - (this.deadT - 3.5) * 0.6;
      if (this.deadT > 5) this.rig.group.visible = false;
      this.respawnT -= dt;
      if (this.respawnT <= 0 && (this.distTo(p.x, p.z) > 45 || p.inDungeon !== this.dungeon)) this.reset();
      this.animate(dt);
      return;
    }
    const sameZone = p.inDungeon === this.dungeon && !p.dead;
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
            if (this.kind === "wolf") env.audio.growl();
            else if (this.kind === "goblin" || this.kind === "redcap") env.audio.shriek();
            else if (this.kind === "soldier" || this.kind === "mouse") env.audio.wind();
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
        }
        break;
      }
      case "chase": {
        if (!sameZone || Math.hypot(this.x - this.homeX, this.z - this.homeZ) > cfg.leash) {
          this.state = "return";
          break;
        }
        env.combat(true);
        face(p.x, p.z, 7);
        const atk = cfg.attacks.find((a) => d <= a.range && (this.kind !== "horse" || a.name !== "charge" || d > 4)) ?? null;
        if (atk && this.cd <= 0) {
          this.atk = atk;
          this.state = "tell";
          this.t = atk.tell;
          this.hitDone = false;
          this.aimX = p.x;
          this.aimZ = p.z;
          this.decal = env.decals.get();
          if (this.kind === "wolf") env.audio.growl();
          if (this.kind === "horse" && atk.name === "charge") env.audio.charge();
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
        if (k < 0.7) {
          face(p.x, p.z, 5);
          this.aimX = p.x;
          this.aimZ = p.z;
        }
        if (this.decal) {
          const cx = atk.ground ? this.x + Math.sin(this.yaw) * 1.4 : this.x;
          const cz = atk.ground ? this.z + Math.cos(this.yaw) * 1.4 : this.z;
          this.decal.show(atk.shape, cx, env.groundAt(cx, cz), cz, this.yaw, atk.size, k, { half: atk.half, w: atk.width, color: 0xd9663a });
        }
        if (this.t <= 0) {
          this.state = "active";
          this.t = atk.active;
          env.decals.release(this.decal);
          this.decal = null;
          env.audio.swing(atk.dmg > 14);
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
        if (!this.hitDone && sameZone) {
          let hit = false;
          const ox = atk.ground ? this.x + Math.sin(this.yaw) * 1.4 : this.x;
          const oz = atk.ground ? this.z + Math.cos(this.yaw) * 1.4 : this.z;
          const dx = p.x - ox;
          const dz = p.z - oz;
          const dd = Math.hypot(dx, dz);
          if (atk.shape === 0) hit = dd < atk.size + 0.3;
          else if (atk.shape === 1) {
            const ang = Math.abs(Math.atan2(Math.sin(Math.atan2(dx, dz) - this.yaw), Math.cos(Math.atan2(dx, dz) - this.yaw)));
            hit = dd < atk.size * 0.85 + 0.3 && ang < (atk.half ?? 0.6) + 0.3;
          } else {
            const fx = Math.sin(this.yaw);
            const fz = Math.cos(this.yaw);
            const along = dx * fx + dz * fz;
            const side = Math.abs(-dx * fz + dz * fx);
            hit = this.kind === "horse" || this.kind === "wolf" ? dd < cfg.radius + 0.75 : along > -0.3 && along < atk.size * 0.9 && side < (atk.width ?? 0.7) + 0.35;
          }
          if (hit) {
            this.hitDone = true;
            env.hurtPlayer(atk.dmg, this.x, this.z, { knock: atk.knock, source: this, parryable: true });
          }
          if (atk.ground && this.t < atk.active * 0.5 && !this.hitDone) {
            this.hitDone = true;
            env.flashes.ring(ox, env.groundAt(ox, oz), oz, atk.size, 0xffcf90, 0.4);
            env.dust.burst(12, ox, env.groundAt(ox, oz) + 0.2, oz, 3, 0x7a6a58, 0.6, 0.3, { up: 1 });
            env.shake(0.25);
            env.audio.thud();
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
      env.audio.thud();
      env.shake(0.2);
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
    const stride = this.kind === "wolf" || this.kind === "deer" ? 1.6 : this.kind === "mouse" ? 0.5 : 1.1;
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
    if (this.kind === "wolf" || this.kind === "deer") {
      let action: QuadAction = "none";
      let at = 0;
      if (this.state === "tell") {
        action = "crouch";
        at = k;
      } else if (this.state === "active") {
        action = this.atk?.hitPose === "pounce" ? "pounce" : "bite";
        at = k;
      } else if (this.state === "stagger") {
        action = "hurt";
        at = 1 - this.t / 0.7;
      } else if (this.state === "dead") {
        action = "dead";
        at = this.deadT;
      } else if (this.kind === "deer" && this.speed < 0.3 && Math.sin(t * 0.3 + this.homeX) > 0.2) action = "graze";
      poseQuad(poser, { t, move: this.speed / (this.kind === "deer" ? 2.4 : 2.8), phase: this.phase, action, at }, dt);
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
      poseHuman(poser, { t, move: this.speed / 2.2, phase: this.phase, action, at, block: false, armed: true }, dt);
      const key = this.rig.sockets.back?.getObjectByName("key");
      if (key) key.rotation.z += dt * (this.state === "dead" ? 0 : this.state === "recover" ? 1 : 5);
    }
  }
}
