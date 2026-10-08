import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { Decal } from "../../engine/fx";
import { Poser, buildHuman, characterMaterial, poseHuman, type HumanAction, type HumanLook, type Rig } from "../../engine/rig";
import { BOSSES } from "../../data/bosses.ts";
import { ZONES } from "../../data/zones.ts";
import type { Boss, BossEnv } from "../bossapi";
import { SILENT, type HurtOpts, type PlayerState } from "../env";
import type { Mob } from "../mobs";
import { weaponModel } from "../weapons";

/**
 * Finlay, Captain of the March (design bible: the Black Keep).
 *  1. The captain: a master swordsman. Two- and three-hit combos with clear tells, a guard
 *     stance that ripostes anyone who swings into it from the front.
 *  2. Helm off: the face, the blonde hair. Faster; lunges across the ring, leaps overhead.
 *  3. The rite: "Smell my fingers." A circle under every player; leave it. He is weak after.
 *     Then a last stand of relentless combos. The rite returns every 45 s of phase 3.
 * Death: one knee, sword planted, head bowed.
 */

type St =
  | "dormant" | "intro" | "stalk" | "tell" | "swing" | "guard" | "riptell" | "ripost"
  | "lungetell" | "lunge" | "leaptell" | "leap" | "slam" | "recover" | "evade"
  | "helm" | "rite" | "weak" | "stagger" | "hurt" | "dying" | "dead";

/** Network order of Finlay.st. */
const STATES: St[] = [
  "dormant", "intro", "stalk", "tell", "swing", "guard", "riptell", "ripost",
  "lungetell", "lunge", "leaptell", "leap", "slam", "recover", "evade",
  "helm", "rite", "weak", "stagger", "hurt", "dying", "dead",
];
/** States that draw a ground telegraph (the leap keeps its landing circle while airborne). */
const TELLS: St[] = ["tell", "riptell", "lungetell", "leaptell", "leap"];
/** States a blow cannot interrupt. */
const COMMITTED: St[] = ["intro", "helm", "rite", "leap", "slam", "lunge", "dying", "dead", "dormant"];

const LUNGE_LEN = 10;
const LUNGE_T = 0.42;
const LEAP_TELL = 0.28;
const LEAP_AIR = 0.42;
const RITE_RAISE = 1.3;
const RITE_GAP = 0.5;
const RITE_T = 5;
const RITE_AGAIN = 45;

export type FinlaySnap = {
  s: number; t: number; d: number; x: number; z: number; y: number; yw: number; hp: number; ph: number;
  hm: number; tx: number; tz: number; mv: number; cb: number; sd: number;
};

const LOOK: HumanLook = {
  skin: 0xd9b08c,
  hair: 0xd8c078,
  hairStyle: "short",
  shirt: 0x1d1b1c,
  coat: 0x151518,
  coatLong: true,
  trousers: 0x131316,
  boots: 0x0d0d0f,
  belt: 0x2a2018,
  frame: 1.22,
  height: 1.8,
  cape: 0x1a1517,
};

// plate colours: blackened field plate, worn at the edges, one dull brass seal
const PLATE = 0x1b1c21;
const EDGE = 0x34363e;
const RIVET = 0x4a4c54;
const SEAL = 0x7a6430;

/** Parts in bone space, merged into one skinned mesh bound to the rig's own skeleton. */
class PlateBuilder {
  private geos: THREE.BufferGeometry[] = [];
  constructor(private rig: Rig) {}
  add(bone: string, g: THREE.BufferGeometry, color: number, rx = 0, ry = 0, rz = 0, x = 0, y = 0, z = 0) {
    if (rx || ry || rz) g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, ry, rz)));
    g.translate(x, y, z);
    const b = this.rig.bones[bone];
    const skel = this.rig.mesh.skeleton;
    const bi = skel.bones.indexOf(b);
    if (bi < 0) return;
    let geo = g.index ? g.toNonIndexed() : g;
    for (const k of Object.keys(geo.attributes)) if (k !== "position" && k !== "normal") geo.deleteAttribute(k);
    // bone space -> the skinned mesh's bind space
    const toMesh = new THREE.Matrix4().copy(this.rig.mesh.matrixWorld).invert().multiply(b.matrixWorld);
    geo = geo.applyMatrix4(toMesh);
    const n = geo.getAttribute("position").count;
    const si = new Uint16Array(n * 4);
    const sw = new Float32Array(n * 4);
    const col = new Float32Array(n * 3);
    const c = new THREE.Color(color);
    for (let i = 0; i < n; i++) {
      si[i * 4] = bi;
      sw[i * 4] = 1;
      col[i * 3] = c.r;
      col[i * 3 + 1] = c.g;
      col[i * 3 + 2] = c.b;
    }
    geo.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(si, 4));
    geo.setAttribute("skinWeight", new THREE.Float32BufferAttribute(sw, 4));
    geo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
    this.geos.push(geo);
  }
  build(mat: THREE.Material): THREE.SkinnedMesh {
    const geo = mergeGeometries(this.geos, false)!;
    const m = new THREE.SkinnedMesh(geo, mat);
    m.bind(this.rig.mesh.skeleton, this.rig.mesh.bindMatrix);
    m.castShadow = true;
    m.frustumCulled = false;
    return m;
  }
}

const ell = (rx: number, ry: number, rz: number, seg = 10) => {
  const g = new THREE.SphereGeometry(1, seg, Math.max(6, Math.floor(seg * 0.7)));
  g.scale(rx, ry, rz);
  return g;
};
const bx = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
const cy = (r0: number, r1: number, h: number, seg = 10, open = false) => new THREE.CylinderGeometry(r1, r0, h, seg, 1, open);

/** Blackened field-captain plate: breastplate, fauld, pauldrons, vambraces, gauntlets, cuisses, greaves. */
function buildPlate(rig: Rig, mat: THREE.Material) {
  const f = LOOK.frame ?? 1;
  const p = new PlateBuilder(rig);
  // breastplate with a centre ridge and a brass seal (a minor seal: the captain's)
  p.add("chest", ell(0.225 * f, 0.2, 0.15, 12), PLATE, 0, 0, 0, 0, 0.06, 0.004);
  p.add("chest", bx(0.02, 0.3, 0.02), EDGE, 0, 0, 0, 0, 0.05, 0.152);
  p.add("chest", cy(0.03, 0.03, 0.012, 10), SEAL, Math.PI / 2, 0, 0, 0.09, 0.12, 0.148);
  p.add("chest", cy(0.12, 0.1, 0.07, 12, true), EDGE, 0, 0, 0, 0, 0.215, 0);
  p.add("spine", cy(0.185 * f, 0.205 * f, 0.26, 12, true), PLATE, 0, 0, 0, 0, 0.05, 0);
  // fauld lames over the long coat
  for (let i = 0; i < 3; i++) p.add("hips", cy(0.215 * f + i * 0.018, 0.2 * f + i * 0.018, 0.075, 12, true), i % 2 ? EDGE : PLATE, 0, 0, 0, 0, 0.02 - i * 0.065, 0);
  // pauldrons: layered, plain, rounded (no crest: a field captain, not a champion)
  for (const [s, sx] of [["L", 1], ["R", -1]] as const) {
    p.add("chest", ell(0.13 * f, 0.085, 0.13), PLATE, 0, 0, sx * 0.3, sx * 0.2 * f, 0.15, 0);
    p.add("chest", ell(0.12 * f, 0.06, 0.12), EDGE, 0, 0, sx * 0.45, sx * 0.235 * f, 0.1, 0);
    p.add("arm" + s, cy(0.068 * f, 0.074 * f, 0.18, 9), PLATE, 0, 0, 0, 0, -0.1, 0);
    p.add("fore" + s, ell(0.06, 0.05, 0.065, 8), EDGE, 0, 0, 0, 0, 0.0, 0);
    p.add("fore" + s, cy(0.06 * f, 0.07 * f, 0.17, 9), PLATE, 0, 0, 0, 0, -0.16, 0);
    p.add("hand" + s, ell(0.055, 0.068, 0.045, 8), PLATE, 0, 0, 0, 0, -0.045, 0.01);
    p.add("hand" + s, bx(0.085, 0.02, 0.03), RIVET, 0, 0, 0, 0, -0.07, 0.035);
    p.add("thigh" + s, cy(0.088 * f, 0.1 * f, 0.3, 9), PLATE, 0, 0, 0, 0, -0.2, 0.004);
    p.add("shin" + s, ell(0.075 * f, 0.068, 0.08), EDGE, 0, 0, 0, 0, -0.005, 0.028);
    p.add("shin" + s, cy(0.07 * f, 0.078 * f, 0.26, 9), PLATE, 0, 0, 0, 0, -0.27, 0.004);
    p.add("foot" + s, ell(0.062, 0.05, 0.13, 8), PLATE, 0, 0, 0, 0, 0.0, 0.05);
  }
  return p.build(mat);
}

/** A blackened sallet with a visor slit: hides the face until phase two. Built along the head bone. */
function buildHelm(): THREE.Mesh {
  const parts: THREE.BufferGeometry[] = [];
  const col = (g: THREE.BufferGeometry, c: number) => {
    const ng = g.index ? g.toNonIndexed() : g;
    for (const k of Object.keys(ng.attributes)) if (k !== "position" && k !== "normal") ng.deleteAttribute(k);
    const n = ng.getAttribute("position").count;
    const a = new Float32Array(n * 3);
    const cc = new THREE.Color(c);
    for (let i = 0; i < n; i++) {
      a[i * 3] = cc.r;
      a[i * 3 + 1] = cc.g;
      a[i * 3 + 2] = cc.b;
    }
    ng.setAttribute("color", new THREE.Float32BufferAttribute(a, 3));
    parts.push(ng);
  };
  const H = 0.118;
  const dome = new THREE.SphereGeometry(H * 1.32, 14, 9, 0, Math.PI * 2, 0, Math.PI * 0.58);
  dome.scale(1, 1.08, 1.12);
  dome.translate(0, 0.1, -0.01);
  col(dome, PLATE);
  // the tail sweeping down the nape
  const tail = bx(0.24, 0.03, 0.16);
  tail.applyMatrix4(new THREE.Matrix4().makeRotationX(-0.45));
  tail.translate(0, 0.07, -0.15);
  col(tail, PLATE);
  // visor over the face, with a dark slit and a narrow ridge
  const visor = new THREE.CylinderGeometry(H * 1.3, H * 1.24, 0.15, 14, 1, true, -1.25, 2.5);
  visor.translate(0, 0.09, 0);
  col(visor, EDGE);
  const slit = bx(0.18, 0.016, 0.02);
  slit.translate(0, 0.135, H * 1.33);
  col(slit, 0x050506);
  const ridge = bx(0.016, 0.22, 0.03);
  ridge.translate(0, 0.21, 0.02);
  ridge.applyMatrix4(new THREE.Matrix4().makeRotationX(0.15));
  col(ridge, EDGE);
  const rim = new THREE.CylinderGeometry(H * 1.36, H * 1.36, 0.02, 14, 1, true);
  rim.translate(0, 0.165, -0.005);
  col(rim, RIVET);
  const geo = mergeGeometries(parts, false)!;
  const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }));
  m.castShadow = true;
  return m;
}

export class Finlay implements Boss {
  readonly def = BOSSES.finlay;
  readonly phaseNames = ["", "The captain", "Helm off", "The rite"];
  readonly adds: Mob[] = [];
  readonly cx: number;
  readonly cz: number;
  rig: Rig;
  poser: Poser;
  mat: THREE.MeshLambertMaterial;
  plateMat: THREE.MeshLambertMaterial;
  helm: THREE.Mesh;
  helmOn = true;
  holder = new THREE.Group();
  x: number;
  z: number;
  y = 0;
  yaw = Math.PI;
  hp: number;
  max: number;
  st: St = "dormant";
  t = 0;
  dur = 1;
  phaseN = 1;
  puppet = false;
  /** combo: which blow of how many */
  comboI = 0;
  comboN = 2;
  cd = 1.2;
  mv = 0;
  /** sideways step while circling (sign) */
  side = 1;
  gait = 0;
  flash = 0;
  kx = 0;
  kz = 0;
  tx = 0;
  tz = 0;
  sx = 0;
  sz = 0;
  deadT = 0;
  hitDone = false;
  decal: Decal | null = null;
  /** seconds in phase 3 since the last rite ended */
  riteClock = 0;
  private riteQ: { q: PlayerState; at: number }[] = [];
  private riteEl = 0;
  private net: { x: number; z: number; y: number; yaw: number } | null = null;
  private hitSet = new Set<PlayerState>();
  private target: PlayerState | null = null;
  private retargetT = 0;
  private lastHit = new Map<PlayerState, number>();
  private ripTarget: PlayerState | null = null;
  /** time each remote player has spent pressing into his guard */
  private press = new Map<PlayerState, number>();
  private recentHits: number[] = [];

  constructor(private env: BossEnv, private parent: THREE.Object3D) {
    this.cx = ZONES[this.def.zone].ox + this.def.x;
    this.cz = this.def.z;
    this.x = this.cx;
    this.z = this.cz + 2.5;
    this.hp = this.def.hp;
    this.max = this.def.hp;
    this.rig = buildHuman(LOOK);
    this.mat = characterMaterial.clone() as THREE.MeshLambertMaterial;
    this.rig.mesh.material = this.mat;
    this.rig.group.updateMatrixWorld(true);
    this.plateMat = new THREE.MeshLambertMaterial({ vertexColors: true });
    this.rig.group.add(buildPlate(this.rig, this.plateMat));
    this.helm = buildHelm();
    this.rig.bones.head.add(this.helm);
    this.holder.add(weaponModel("wpn_finlay_longsword"));
    this.rig.sockets.gripR.add(this.holder);
    this.poser = new Poser(this.rig);
    parent.add(this.rig.group);
    this.place();
    this.pose(1, "none", 0);
  }

  // ------------------------------------------------------------ the Boss surface

  get heard() {
    return this.env.heard(this.x, this.z, this.def.zone, 70);
  }
  private get sfx() {
    return this.heard ? this.env.audio : SILENT;
  }
  get alive() {
    return this.st !== "dead" && this.st !== "dying";
  }
  get active() {
    return this.st !== "dormant" && this.st !== "dead";
  }
  get fighting() {
    return this.active && this.st !== "dying";
  }

  setMax(max: number) {
    if (!(max > 0)) return;
    const k = this.max > 0 ? this.hp / this.max : 1;
    this.max = max;
    this.hp = this.fighting ? Math.round(max * k) : this.st === "dead" ? 0 : max;
  }

  private clearFight() {
    this.env.decals.release(this.decal);
    this.decal = null;
    this.riteQ = [];
    this.press.clear();
    this.lastHit.clear();
    this.recentHits = [];
    this.ripTarget = null;
  }

  reset() {
    this.clearFight();
    this.hp = this.max;
    this.st = "dormant";
    this.phaseN = 1;
    this.x = this.cx;
    this.z = this.cz + 2.5;
    this.y = this.ground(this.x, this.z);
    this.yaw = Math.PI;
    this.kx = this.kz = 0;
    this.mv = 0;
    this.riteClock = 0;
    this.deadT = 0;
    this.setHelm(true);
    this.place();
  }

  setDead() {
    this.clearFight();
    this.st = "dead";
    this.hp = 0;
    this.phaseN = 3;
    this.x = this.cx;
    this.z = this.cz + 1.5;
    this.y = this.ground(this.x, this.z);
    this.yaw = Math.PI;
    this.setHelm(false);
    this.deadT = 10;
    this.place();
    this.poseKneel(1, 1);
  }

  startIntro() {
    if (this.st !== "dormant") return;
    this.go("intro", 3);
    this.env.speak("You're late.");
  }

  canTakeHit() {
    if (!this.fighting) return false;
    if (this.st === "guard") {
      // a swing reached him (the game asks before every blow): the local player swung into his guard
      if (!this.puppet) this.guardTouched(this.env.player);
      return false;
    }
    return this.st !== "intro" && this.st !== "helm";
  }

  hitFlags(fromX: number, fromZ: number) {
    const ang = Math.atan2(fromX - this.x, fromZ - this.z);
    const behind = Math.abs(wrap(ang - this.yaw)) > 2.1;
    const grounded = this.st !== "leap" && this.st !== "leaptell";
    return { behind: behind && grounded, perched: false, dizzy: this.st === "weak" || this.st === "stagger" };
  }

  netHit(hp: number, fromX: number, fromZ: number, heavy: boolean, fire: boolean) {
    if (!this.alive) return;
    const f = this.hitFlags(fromX, fromZ);
    // who struck: the standing player nearest the blow's origin
    let who: PlayerState | null = null;
    let bd = 4;
    for (const q of this.foes()) {
      const d = Math.hypot(q.x - fromX, q.z - fromZ);
      if (d < bd) {
        bd = d;
        who = q;
      }
    }
    if (who) this.lastHit.set(who, this.env.time);
    if (!this.puppet) {
      this.recentHits.push(this.env.time);
      if (heavy && !fire && f.behind && !COMMITTED.includes(this.st) && this.st !== "weak" && this.st !== "stagger") {
        this.env.floater("Staggered!", this.x, this.y + 2.6, this.z, "crit");
        this.go("hurt", 0.75);
      }
    }
    this.hp = Math.max(0, Math.min(this.hp, hp));
    this.flash = 0.12;
    this.env.sparks.burst(fire ? 6 : 10, this.x + (fromX - this.x) * 0.3, this.y + 1.3, this.z + (fromZ - this.z) * 0.3, 4, 0xffe6b8, 0.35, 0.14, { up: 1, grav: 6 });
    if (this.hp <= 0 && !this.puppet) this.beginDeath();
  }

  parry(s: number) {
    if (!this.fighting) return;
    if (this.st === "leap" || this.st === "slam" || this.st === "rite" || this.st === "helm" || this.st === "intro") return;
    this.env.floater("Parried!", this.x, this.y + 2.6, this.z, "crit");
    this.go("stagger", s + 0.4);
  }

  setPuppet(on: boolean) {
    if (this.puppet === on) return;
    this.puppet = on;
    this.net = null;
    this.target = null;
    if (!on && this.fighting && !["intro", "stalk", "helm", "weak", "stagger", "hurt", "recover", "guard"].includes(this.st)) {
      // took over mid-attack: settle and decide afresh
      if (this.st === "rite") {
        // the rite's circles were already sent; let it finish as a weakness
        this.go("weak", 2.5);
      } else this.recover(0.5);
      this.y = this.ground(this.x, this.z);
    }
  }

  snap(): FinlaySnap {
    const r = (v: number) => Math.round(v * 100) / 100;
    return {
      s: STATES.indexOf(this.st), t: r(Math.max(0, this.t)), d: r(this.dur), x: r(this.x), z: r(this.z), y: r(this.y), yw: r(this.yaw),
      hp: this.hp, ph: this.phaseN, hm: this.helmOn ? 1 : 0, tx: r(this.tx), tz: r(this.tz), mv: r(this.mv), cb: this.comboI, sd: this.side,
    };
  }

  applySnap(raw: unknown) {
    const sn = raw as FinlaySnap;
    if (!sn || typeof sn.s !== "number") return;
    const st = STATES[sn.s] ?? "dormant";
    if (!this.net || Math.hypot(sn.x - this.x, sn.z - this.z) > 12) {
      this.x = sn.x;
      this.z = sn.z;
      this.y = sn.y;
      this.yaw = sn.yw;
    }
    this.net = { x: sn.x, z: sn.z, y: sn.y, yaw: sn.yw };
    const prev = this.st;
    this.st = st;
    if (st !== prev) this.enter(st, prev);
    if (st !== prev || Math.abs(this.t - sn.t) > 0.25) {
      this.t = sn.t;
      this.dur = Math.max(0.001, sn.d);
    }
    this.hp = Math.min(this.hp, sn.hp);
    if (sn.hp > this.hp + 40) this.hp = sn.hp;
    this.phaseN = sn.ph;
    this.tx = sn.tx;
    this.tz = sn.tz;
    this.mv = sn.mv;
    this.comboI = sn.cb;
    this.side = sn.sd || 1;
    this.setHelm(!!sn.hm);
  }

  update(dt: number, inArena: boolean) {
    void inArena;
    if (this.flash > 0) this.flash -= dt;
    const glow = this.phaseN === 3 && this.fighting ? 0x1a2408 : 0x000000;
    this.mat.emissive.setHex(this.flash > 0 ? 0xff9966 : glow);
    this.mat.emissiveIntensity = this.flash > 0 ? 0.9 : 0.6;
    this.plateMat.emissive.setHex(this.flash > 0 ? 0xff9966 : 0x000000);
    this.plateMat.emissiveIntensity = 0.7;
    if (this.puppet) return this.puppetUpdate(dt);
    // took over a fight whose last blow landed while this client was a puppet
    if (this.fighting && this.hp <= 0) this.beginDeath();
    if (this.st === "dormant") {
      this.y = this.ground(this.x, this.z);
      this.place();
      this.pose(dt, "none", 0);
      return;
    }
    if (this.st === "dead") {
      this.place();
      this.poseKneel(dt, 1);
      return;
    }
    this.think(dt);
  }

  // ------------------------------------------------------------ helpers

  private ground(x: number, z: number) {
    const g = this.env.groundAt(x, z);
    return Number.isFinite(g) ? g : 0;
  }

  private place() {
    this.rig.group.position.set(this.x, this.y, this.z);
    this.rig.group.rotation.y = this.yaw;
  }

  private setHelm(on: boolean) {
    if (on === this.helmOn) return;
    this.helmOn = on;
    if (on) {
      this.helm.parent?.remove(this.helm);
      this.rig.bones.head.add(this.helm);
      this.helm.position.set(0, 0, 0);
      this.helm.rotation.set(0, 0, 0);
      this.helm.scale.setScalar(1);
    } else {
      // it falls where he stands and stays there, on its side
      const a = this.yaw + 1.9;
      const hx = this.x + Math.sin(a) * 1.1;
      const hz = this.z + Math.cos(a) * 1.1;
      this.helm.parent?.remove(this.helm);
      this.parent.add(this.helm);
      this.helm.position.set(hx, this.ground(hx, hz) + 0.12, hz);
      this.helm.rotation.set(1.35, this.yaw + 0.7, 0.2);
      this.helm.scale.setScalar(this.rig.height / 1.8);
    }
  }

  private go(st: St, dur: number) {
    const prev = this.st;
    this.st = st;
    this.t = dur;
    this.dur = Math.max(0.001, dur);
    this.hitDone = false;
    this.hitSet.clear();
    this.enter(st, prev);
  }

  /** What every client does when the state changes: telegraphs, sounds, dust. */
  private enter(st: St, prev: St) {
    const env = this.env;
    const keepDecal = prev === "leaptell" && st === "leap";
    if (TELLS.includes(prev) && !keepDecal) {
      env.decals.release(this.decal);
      this.decal = null;
    }
    if (TELLS.includes(st) && !this.decal) this.decal = env.decals.get();
    switch (st) {
      case "tell":
      case "riptell":
        if (st === "riptell") this.sfx.clack();
        break;
      case "swing":
      case "ripost":
        this.sfx.swing(this.comboI >= 2);
        break;
      case "lungetell":
        this.sfx.charge();
        break;
      case "lunge":
        this.sfx.swing(true);
        break;
      case "leaptell":
        this.sfx.charge();
        break;
      case "slam":
        env.flashes.ring(this.x, this.y + 0.1, this.z, 3, 0xd8c8b0, 0.5);
        env.dust.burst(26, this.x, this.y + 0.3, this.z, 6, 0x5a5650, 0.9, 0.35, { up: 1.5 });
        this.sfx.thud();
        if (this.heard) env.shake(0.5);
        break;
      case "guard":
        this.sfx.block();
        break;
      case "evade":
        this.sfx.dodge();
        break;
      case "stagger":
        this.sfx.parry();
        break;
      case "helm":
        this.sfx.growl();
        break;
      case "rite":
        this.sfx.bell(0.3, 196);
        break;
      case "weak":
        env.floater("Weak!", this.x, this.y + 2.6, this.z, "info");
        break;
      case "dying":
        this.deadT = 0;
        this.sfx.death();
        break;
    }
  }

  /** Players he can hurt: in the Keep and standing. */
  private foes() {
    return this.env.players().filter((q) => q.zone === this.def.zone && !q.dead);
  }
  private inRing(q: PlayerState) {
    return Math.hypot(q.x - this.cx, q.z - this.cz) < this.def.r + 1.5;
  }

  /** The nearest player among those who struck him lately (else the nearest), re-picked every ~5 s. */
  private choose(dt: number): PlayerState | null {
    const foes = this.foes().filter((q) => this.inRing(q));
    if (this.target && !foes.includes(this.target)) this.target = null;
    this.retargetT -= dt;
    if (!this.target || this.retargetT <= 0) {
      this.retargetT = 5;
      const now = this.env.time;
      const hitters = foes.filter((q) => now - (this.lastHit.get(q) ?? -1e9) < 12);
      const pool = hitters.length ? hitters : foes;
      let best: PlayerState | null = null;
      let bd = 1e9;
      for (const q of pool) {
        const d = Math.hypot(q.x - this.x, q.z - this.z);
        if (d < bd) {
          bd = d;
          best = q;
        }
      }
      this.target = best;
    }
    return this.target;
  }

  private strike(test: (q: PlayerState) => boolean, dmg: number, o: HurtOpts) {
    let any = false;
    for (const q of this.foes()) {
      if (this.hitSet.has(q) || !test(q)) continue;
      this.hitSet.add(q);
      this.env.hurt(q, dmg, this.x, this.z, { ...o, src: "finlay" });
      any = true;
    }
    return any;
  }

  private inCone(q: PlayerState, r: number, half: number) {
    const dx = q.x - this.x;
    const dz = q.z - this.z;
    if (Math.hypot(dx, dz) > r) return false;
    return Math.abs(wrap(Math.atan2(dx, dz) - this.yaw)) < half;
  }

  private faceTo(x: number, z: number, rate: number, dt: number) {
    const d = wrap(Math.atan2(x - this.x, z - this.z) - this.yaw);
    this.yaw += Math.sign(d) * Math.min(Math.abs(d), rate * dt);
  }

  private get pace() {
    return this.phaseN === 1 ? 1 : this.phaseN === 2 ? 1.18 : 1.25;
  }

  private recover(t: number) {
    this.cd = t + (this.phaseN === 1 ? 0.55 : this.phaseN === 2 ? 0.35 : 0.15) + Math.random() * 0.35;
    this.go("stalk", 0);
  }

  /** A blow into his guard from the front: he answers at once. */
  private guardTouched(q: PlayerState) {
    if (this.st !== "guard") return;
    const ang = Math.atan2(q.x - this.x, q.z - this.z);
    if (Math.abs(wrap(ang - this.yaw)) > 1.4) return;
    if (Math.hypot(q.x - this.x, q.z - this.z) > 4.5) return;
    this.ripTarget = q;
    this.env.sparks.burst(14, this.x + Math.sin(this.yaw) * 0.7, this.y + 1.4, this.z + Math.cos(this.yaw) * 0.7, 5, 0xfff0c0, 0.3, 0.16, { up: 1 });
    this.env.floater("Guarded!", this.x, this.y + 2.6, this.z, "info");
    this.comboI = 1;
    this.go("riptell", 0.3);
  }

  private beginDeath() {
    this.env.decals.release(this.decal);
    this.decal = null;
    this.riteQ = [];
    this.kx = this.kz = 0;
    this.mv = 0;
    this.go("dying", 3.5);
  }

  /** Starts the next combo blow's tell (≥ 0.45 s). */
  private startBlow(first: boolean) {
    const t = first ? (this.phaseN === 1 ? 0.6 : 0.5) : this.phaseN === 1 ? 0.5 : 0.45;
    this.go("tell", t);
  }

  // ------------------------------------------------------------ the fight (runs where the world runs)

  private think(dt: number) {
    const env = this.env;
    this.t -= dt;
    const k = 1 - Math.max(0, this.t) / this.dur;
    const p = this.choose(dt);
    this.mv = 0;
    let strafe = 0;

    // phase changes
    if (this.fighting && !COMMITTED.includes(this.st)) {
      if (this.phaseN === 1 && this.hp < this.max * 0.6) {
        this.phaseN = 2;
        this.go("helm", 1.7);
      } else if (this.phaseN === 2 && this.hp < this.max * 0.25) {
        this.phaseN = 3;
        this.beginRite();
      } else if (this.phaseN === 3 && this.riteClock >= RITE_AGAIN && (this.st === "stalk" || this.st === "recover")) {
        this.beginRite();
      }
    }
    if (this.phaseN === 3 && this.st !== "rite") this.riteClock += dt;
    // a dead old record should not keep a player marked forever
    this.recentHits = this.recentHits.filter((h) => env.time - h < 1.6);

    const d = p ? Math.hypot(p.x - this.x, p.z - this.z) : 99;
    switch (this.st) {
      case "intro":
        if (p) this.faceTo(p.x, p.z, 1.5, dt);
        if (this.t <= 0) this.recover(0.2);
        break;
      case "stalk": {
        if (!p) {
          // nobody in the ring: walk back to his mark and wait
          const hd = Math.hypot(this.cx - this.x, this.cz + 2.5 - this.z);
          if (hd > 0.6) {
            this.faceTo(this.cx, this.cz + 2.5, 3, dt);
            this.mv = 2.2;
          } else this.faceTo(this.cx, this.cz - 10, 2, dt);
          break;
        }
        this.faceTo(p.x, p.z, 4.5 * this.pace, dt);
        this.cd -= dt;
        if (this.phaseN >= 2 && this.recentHits.length >= 3 && Math.random() < 0.5) {
          this.recentHits = [];
          this.side = Math.random() < 0.5 ? 1 : -1;
          this.go("evade", 0.45);
          break;
        }
        if (this.cd <= 0) {
          // one roll per decision; nothing fits yet: look again shortly
          const r = Math.random();
          this.cd = 0.35;
          if (this.phaseN === 1 && d < 3.4 && r < 0.3) {
            this.press.clear();
            this.go("guard", 2);
            break;
          }
          if (this.phaseN >= 2 && d > 5 && d < 14 && r < 0.45) {
            this.tx = p.x;
            this.tz = p.z;
            this.go("lungetell", 0.6);
            break;
          }
          if (this.phaseN >= 2 && d > 3.5 && d < 13 && r >= 0.45 && r < 0.8) {
            this.tx = p.x;
            this.tz = p.z;
            this.sx = this.x;
            this.sz = this.z;
            this.go("leaptell", LEAP_TELL);
            break;
          }
          if (d < 3.4) {
            this.comboI = 0;
            this.comboN = this.phaseN === 3 ? 3 : Math.random() < (this.phaseN === 1 ? 0.45 : 0.6) ? 3 : 2;
            this.startBlow(true);
            break;
          }
        }
        if (d > 2.6) this.mv = (this.phaseN === 1 ? 2.6 : this.phaseN === 2 ? 3.6 : 4.1) * (d > 7 ? 1.15 : 1);
        else if (this.phaseN === 1) strafe = 1.3;
        if (Math.random() < dt * 0.4) this.side = -this.side;
        break;
      }
      case "tell": {
        if (p && k < 0.7) this.faceTo(p.x, p.z, 5 * this.pace, dt);
        if (p && d > 2.4 && k < 0.6) this.mv = 2.2;
        if (this.t <= 0) {
          this.go("swing", 0.28);
          this.kx += Math.sin(this.yaw) * 4;
          this.kz += Math.cos(this.yaw) * 4;
        }
        break;
      }
      case "swing": {
        const last = this.comboI >= 2;
        if (k < 0.7)
          this.strike((q) => this.inCone(q, last ? 3.4 : 3.1, last ? 0.75 : 1.05), (last ? 22 : 16) + (this.phaseN - 1) * 2, { knock: last ? 2.8 : 1.6, parryable: true, source: { stagger: (s) => this.parry(s) } });
        if (k > 0.4 && !this.hitDone) {
          this.hitDone = true;
          env.flashes.arc(this.x + Math.sin(this.yaw) * 0.6, this.y + 1.15, this.z + Math.cos(this.yaw) * 0.6, this.yaw, 2.6, last, 0xc8ccd8, this.comboI === 1);
        }
        if (this.t <= 0) {
          this.comboI++;
          if (this.comboI < this.comboN) this.startBlow(false);
          else if (this.phaseN === 3 && Math.random() < 0.35 && p && d > 4) {
            this.tx = p.x;
            this.tz = p.z;
            this.go("lungetell", 0.6);
          } else this.go("recover", this.phaseN === 3 ? 0.35 : 0.6);
        }
        break;
      }
      case "guard": {
        if (p) this.faceTo(p.x, p.z, 1.3, dt);
        // circling behind him breaks his guard
        if (p) {
          const ang = Math.atan2(p.x - this.x, p.z - this.z);
          if (Math.abs(wrap(ang - this.yaw)) > 1.9) {
            this.recover(0.2);
            break;
          }
        }
        // a remote player pressing into the guard (their swings are judged on their own client)
        for (const q of this.foes()) {
          if (q === env.player) continue;
          const v = this.inCone(q, 2.6, 1.0) ? (this.press.get(q) ?? 0) + dt : 0;
          this.press.set(q, v);
          if (v > 0.55) {
            this.guardTouched(q);
            break;
          }
        }
        if (this.st === "guard" && this.t <= 0) this.recover(0.1);
        break;
      }
      case "riptell": {
        const q = this.ripTarget;
        if (q) this.faceTo(q.x, q.z, 12, dt);
        if (this.t <= 0) {
          this.go("ripost", 0.22);
          this.kx += Math.sin(this.yaw) * 5;
          this.kz += Math.cos(this.yaw) * 5;
        }
        break;
      }
      case "ripost":
        this.strike((q) => this.inCone(q, 3.4, 1.0), 22, { knock: 2.4, parryable: true, source: { stagger: (s) => this.parry(s) } });
        if (!this.hitDone) {
          this.hitDone = true;
          env.flashes.arc(this.x + Math.sin(this.yaw) * 0.6, this.y + 1.15, this.z + Math.cos(this.yaw) * 0.6, this.yaw, 2.6, false, 0xfff0c0, true);
        }
        if (this.t <= 0) this.go("recover", 0.5);
        break;
      case "lungetell":
        if (p && k < 0.65) {
          this.faceTo(p.x, p.z, 4, dt);
          this.tx = p.x;
          this.tz = p.z;
        }
        if (this.t <= 0) {
          this.sx = this.x;
          this.sz = this.z;
          this.go("lunge", LUNGE_T);
        }
        break;
      case "lunge": {
        const sp = LUNGE_LEN / LUNGE_T;
        const nx = this.x + Math.sin(this.yaw) * sp * dt;
        const nz = this.z + Math.cos(this.yaw) * sp * dt;
        const s = env.col.resolve(nx, nz, 0.7);
        const bumped = Math.abs(s.x - nx) + Math.abs(s.z - nz) > 0.05;
        this.x = s.x;
        this.z = s.z;
        if (Math.random() < 0.6) env.dust.emit({ x: this.x, y: this.y + 0.15, z: this.z, vx: Math.random() - 0.5, vy: 0.8, vz: Math.random() - 0.5, life: 0.5, size: 0.35, color: 0x4a4744, a: 0.5, grav: 1 });
        this.strike((q) => Math.hypot(q.x - this.x, q.z - this.z) < 1.6, 24 + (this.phaseN - 2) * 3, { knock: 3 });
        if (this.t <= 0 || bumped) this.go("recover", 0.7);
        break;
      }
      case "leaptell":
        this.faceTo(this.tx, this.tz, 6, dt);
        if (p) {
          this.tx += (p.x - this.tx) * Math.min(1, dt * 4);
          this.tz += (p.z - this.tz) * Math.min(1, dt * 4);
        }
        this.clampTarget();
        if (this.t <= 0) {
          this.sx = this.x;
          this.sz = this.z;
          this.kx = this.kz = 0;
          this.go("leap", LEAP_AIR);
          this.sfx.swing(true);
        }
        break;
      case "leap": {
        this.x = this.sx + (this.tx - this.sx) * k;
        this.z = this.sz + (this.tz - this.sz) * k;
        this.faceTo(this.tx, this.tz, 8, dt);
        if (this.t <= 0) {
          this.x = this.tx;
          this.z = this.tz;
          this.go("slam", 0.3);
          this.strike((q) => Math.hypot(q.x - this.x, q.z - this.z) < 2.8, 30, { knock: 3.2 });
        }
        break;
      }
      case "slam":
        if (this.t <= 0) this.go("recover", 0.9);
        break;
      case "recover":
        if (p && k > 0.4) this.faceTo(p.x, p.z, 3, dt);
        if (this.t <= 0) this.recover(0);
        break;
      case "evade": {
        if (p) this.faceTo(p.x, p.z, 6, dt);
        const a = this.yaw + Math.PI + this.side * 0.9;
        this.kx = Math.sin(a) * 7;
        this.kz = Math.cos(a) * 7;
        if (this.t <= 0) {
          this.kx = this.kz = 0;
          this.cd = 0;
          this.go("stalk", 0);
        }
        break;
      }
      case "helm":
        if (p) this.faceTo(p.x, p.z, 1.5, dt);
        if (k > 0.45 && this.helmOn) {
          this.setHelm(false);
          this.sfx.clack();
          env.dust.burst(10, this.helm.position.x, this.helm.position.y, this.helm.position.z, 2, 0x5a5650, 0.6, 0.2, { up: 1 });
        }
        if (this.t <= 0) this.recover(0.1);
        break;
      case "rite":
        this.updateRite(dt);
        break;
      case "weak":
        if (Math.random() < dt * 6) env.sparks.emit({ x: this.x + Math.sin(env.time * 5) * 0.6, y: this.y + 2.2, z: this.z + Math.cos(env.time * 5) * 0.6, life: 0.5, size: 0.18, color: 0xb8d070, grav: -0.5 });
        if (this.t <= 0) this.recover(0.1);
        break;
      case "stagger":
      case "hurt":
        if (this.t <= 0) this.recover(0.2);
        break;
      case "dying":
        this.deadT += dt;
        if (this.t <= 0) {
          this.st = "dead";
          env.dust.burst(30, this.x, this.y + 0.3, this.z, 3, 0x4a4744, 1.2, 0.3, { up: 1 });
        }
        break;
    }

    // motion
    if (this.mv > 0 || strafe) {
      const fx = Math.sin(this.yaw);
      const fz = Math.cos(this.yaw);
      const vx = fx * this.mv + fz * strafe * this.side;
      const vz = fz * this.mv - fx * strafe * this.side;
      const s = env.col.resolve(this.x + vx * dt, this.z + vz * dt, 0.7);
      this.x = s.x;
      this.z = s.z;
      if (strafe) this.mv = Math.max(this.mv, strafe);
    }
    if ((this.kx || this.kz) && this.st !== "leap") {
      const s = env.col.resolve(this.x + this.kx * dt, this.z + this.kz * dt, 0.7);
      this.x = s.x;
      this.z = s.z;
      const decay = this.st === "evade" ? 0 : 7;
      this.kx *= Math.exp(-dt * decay);
      this.kz *= Math.exp(-dt * decay);
      if (Math.abs(this.kx) + Math.abs(this.kz) < 0.05) this.kx = this.kz = 0;
    }
    // the ring holds him
    const dx = this.x - this.cx;
    const dz = this.z - this.cz;
    const dd = Math.hypot(dx, dz);
    const lim = this.def.r - 1.2;
    if (dd > lim) {
      this.x = this.cx + (dx / dd) * lim;
      this.z = this.cz + (dz / dd) * lim;
    }
    if (!Number.isFinite(this.x) || !Number.isFinite(this.z)) {
      this.x = this.cx;
      this.z = this.cz;
    }
    const g = this.ground(this.x, this.z);
    this.y = this.st === "leap" ? g + Math.sin(k * Math.PI) * 3.2 : g;
    this.present(dt);
  }

  private clampTarget() {
    const dx = this.tx - this.cx;
    const dz = this.tz - this.cz;
    const dd = Math.hypot(dx, dz);
    const lim = this.def.r - 1.6;
    if (dd > lim) {
      this.tx = this.cx + (dx / dd) * lim;
      this.tz = this.cz + (dz / dd) * lim;
    }
  }

  /** The rite: a raised hand, one line, a circle under every living player in the ring, staggered. */
  private beginRite() {
    this.env.decals.release(this.decal);
    this.decal = null;
    this.kx = this.kz = 0;
    const qs = this.foes().filter((q) => this.inRing(q));
    this.riteQ = qs.map((q, i) => ({ q, at: RITE_RAISE + i * RITE_GAP }));
    this.riteEl = 0;
    const n = Math.max(1, qs.length);
    this.go("rite", RITE_RAISE + (n - 1) * RITE_GAP + RITE_T + 0.2);
    this.env.speak("Smell my fingers.");
  }

  private updateRite(dt: number) {
    this.riteEl += dt;
    for (let i = this.riteQ.length - 1; i >= 0; i--) {
      const r = this.riteQ[i];
      if (this.riteEl < r.at) continue;
      this.riteQ.splice(i, 1);
      const q = r.q;
      if (q.dead || q.zone !== this.def.zone) continue;
      this.env.hazard(q, { kind: "rite", x: q.x, z: q.z, r: 2.2, t: RITE_T, dmg: 42 });
    }
    if (this.t <= 0) {
      this.riteQ = [];
      this.riteClock = 0;
      this.go("weak", 2.5);
    }
  }

  // ------------------------------------------------------------ puppets

  private puppetUpdate(dt: number) {
    if (this.st === "dormant") {
      this.y = this.ground(this.x, this.z);
      this.place();
      this.pose(dt, "none", 0);
      return;
    }
    if (this.st === "dead") {
      this.place();
      this.poseKneel(dt, 1);
      return;
    }
    this.t -= dt;
    if (this.net) {
      const k = Math.min(1, dt * (this.st === "lunge" || this.st === "leap" ? 16 : 9));
      this.x += (this.net.x - this.x) * k;
      this.z += (this.net.z - this.z) * k;
      this.y += (this.net.y - this.y) * k;
      this.yaw += wrap(this.net.yaw - this.yaw) * Math.min(1, dt * 10);
    }
    if (this.st === "dying") {
      this.deadT += dt;
      if (this.t <= 0 && this.deadT > 3.4) this.st = "dead";
    }
    this.present(dt);
  }

  // ------------------------------------------------------------ what everyone sees

  /** Telegraphs, particles and the pose for the current state (runner and puppets alike). */
  private present(dt: number) {
    const env = this.env;
    const k = 1 - Math.max(0, this.t) / this.dur;
    const blow: HumanAction = this.comboI === 0 ? "light1" : this.comboI === 1 ? "light2" : "light3";
    const split = blow === "light3" ? 0.35 : 0.3;
    let action: HumanAction = "none";
    let at = 0;
    let over: Over = null;
    const red = this.phaseN === 3 ? 0xc0402a : 0xd96a3a;
    switch (this.st) {
      case "intro":
        over = k < 0.7 ? "low" : null;
        break;
      case "stalk":
      case "recover":
        break;
      case "tell":
        action = blow;
        at = split * ease(k);
        this.decal?.show(1, this.x, this.y, this.z, this.yaw, this.comboI >= 2 ? 3.4 : 3.1, k, { half: this.comboI >= 2 ? 0.75 : 1.05, color: red });
        break;
      case "swing":
        action = blow;
        at = split + (1 - split) * k;
        break;
      case "guard":
        over = "guard";
        break;
      case "riptell":
        action = "light2";
        at = 0.3 * k;
        this.decal?.show(1, this.x, this.y, this.z, this.yaw, 3.4, k, { half: 1.0, color: 0xfff0c0 });
        break;
      case "ripost":
        action = "light2";
        at = 0.3 + 0.7 * k;
        break;
      case "lungetell":
        action = "thrust";
        at = 0.35 * ease(k);
        this.decal?.show(2, this.x, this.y, this.z, this.yaw, LUNGE_LEN + 1, k, { w: 1.1, color: red });
        break;
      case "lunge":
        action = "thrust";
        at = 0.35 + 0.65 * Math.min(1, k * 1.5);
        break;
      case "leaptell": {
        action = "charge";
        at = k * 0.5;
        const pk = (k * LEAP_TELL) / (LEAP_TELL + LEAP_AIR);
        this.decal?.show(0, this.tx, this.ground(this.tx, this.tz), this.tz, 0, 2.8, pk, { color: red });
        break;
      }
      case "leap": {
        action = "heavy";
        at = 0.2 * k;
        const pk = (LEAP_TELL + k * LEAP_AIR) / (LEAP_TELL + LEAP_AIR);
        this.decal?.show(0, this.tx, this.ground(this.tx, this.tz), this.tz, 0, 2.8, pk, { color: red });
        break;
      }
      case "slam":
        action = "heavy";
        at = 0.2 + 0.8 * Math.min(1, k * 2);
        break;
      case "evade":
        action = "dodge";
        at = k;
        break;
      case "helm":
        over = k < 0.5 ? "helm" : "throw";
        break;
      case "rite":
        over = "rite";
        if (Math.random() < dt * 14) {
          const hx = this.x + Math.sin(this.yaw) * 0.3 + Math.cos(this.yaw) * 0.2;
          const hz = this.z + Math.cos(this.yaw) * 0.3 - Math.sin(this.yaw) * 0.2;
          env.sparks.emit({ x: hx + (Math.random() - 0.5) * 0.3, y: this.y + 2.3 + Math.random() * 0.3, z: hz + (Math.random() - 0.5) * 0.3, vy: 0.6, life: 0.9, size: 0.16, color: 0x8aa040, grav: -0.4 });
        }
        break;
      case "weak":
      case "stagger":
        action = "hurt";
        at = 0.5 + Math.sin(env.time * 5) * 0.25;
        break;
      case "hurt":
        action = "hurt";
        at = k;
        break;
      case "dying":
        this.place();
        this.poseKneel(dt, Math.min(1, k * 1.6));
        return;
    }
    this.gait += this.mv * dt * 3.2;
    this.place();
    this.pose(dt, action, at, over);
  }

  private pose(dt: number, action: HumanAction, at: number, over: Over = null) {
    const env = this.env;
    const p = this.poser;
    const fighting = this.fighting && this.st !== "intro";
    poseHuman(p, { t: env.time, move: this.mv / 2.6, phase: this.gait, action, at, block: false, armed: true }, dt);
    // the blade: point down before the fight, level in it
    const hold = this.st === "dormant" || (this.st === "intro" && over === "low") ? 1.15 : 0;
    this.holder.rotation.x += (hold - this.holder.rotation.x) * Math.min(1, dt * 6);
    if (!fighting && this.st !== "intro" && this.st !== "dormant") return;
    p.begin(dt, 18);
    switch (over) {
      case "low":
        p.set("armR", -0.15, 0, -0.12).set("foreR", -0.25);
        p.set("head", 0.12, 0, 0);
        break;
      case "guard":
        // a high guard: blade raised across the body, weight back
        p.set("armR", -1.25, 0.45, -0.35).set("foreR", -1.35);
        p.set("armL", -1.1, 0, 0.5).set("foreL", -1.2);
        p.set("chest", -0.05, 0.35, 0).set("thighL", 0.35, 0, 0.02).set("shinL", 0.35);
        break;
      case "helm":
        p.set("armL", -2.5, 0, 0.35).set("foreL", -1.9);
        p.set("head", 0.25, 0, 0);
        break;
      case "throw":
        p.set("armL", -0.4, 0, 1.1).set("foreL", -0.2);
        p.set("head", -0.15, 0, 0).set("chest", -0.12, 0, 0);
        break;
      case "rite":
        // the hand raised, open, held up to them
        p.set("armL", -2.7, 0, 0.15).set("foreL", -0.35).set("handL", 0.4, 0, 0);
        p.set("armR", -0.2, 0, -0.15).set("foreR", -0.3);
        p.set("head", -0.12, 0, 0).set("chest", -0.1, 0, 0);
        break;
      default:
        if (this.st === "stalk" && this.mv < 0.3) {
          // a swordsman's ready stance
          p.set("armR", -0.75, 0.2, -0.2).set("foreR", -0.9);
        }
        if (this.phaseN >= 2 && this.st === "stalk") p.set("chest", 0.12, 0, 0);
    }
  }

  /** One knee down, sword planted, head bowed. `k` 0..1 how far down. */
  private poseKneel(dt: number, k: number) {
    const p = this.poser.begin(dt, 5);
    const e = ease(Math.min(1, k));
    p.set("root", 0, 0, 0).offset("root", 0, 0, 0);
    p.set("hips", 0.05 * e, 0, 0).offset("hips", 0, -0.47 * e, 0);
    p.set("spine", 0.18 * e, 0, 0);
    p.set("chest", 0.22 * e, 0, 0);
    p.set("neck", 0.3 * e, 0, 0);
    p.set("head", 0.45 * e, 0, 0);
    p.set("thighL", -1.5 * e, 0, 0.05).set("shinL", 1.5 * e).set("footL", 0);
    p.set("thighR", 0.15 * e, 0, -0.05).set("shinR", 1.45 * e).set("footR", 0.6 * e);
    p.set("armR", -1.0 * e, 0, -0.1).set("foreR", -0.45 * e);
    p.set("armL", -0.7 * e, 0, 0.25).set("foreL", -0.7 * e);
    this.holder.rotation.x += (Math.PI * e - this.holder.rotation.x) * Math.min(1, dt * 5);
  }
}

type Over = null | "low" | "guard" | "helm" | "throw" | "rite";

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const ease = (x: number) => x * x * (3 - 2 * x);

export function createFinlay(env: BossEnv, parent: THREE.Object3D): Boss {
  return new Finlay(env, parent);
}
