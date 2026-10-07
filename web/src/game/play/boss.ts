import * as THREE from "three";
import type { Decal } from "../engine/fx";
import { Poser, buildCookie, characterMaterial, poseCookie, type CookieAction, type Rig } from "../engine/rig";
import { COOKIE_HP } from "../content";
import { BOSSES } from "../data/bosses.ts";
import type { Boss } from "./bossapi";
import { DUN } from "../world/layout";
import { SILENT, type Env, type PlayerState } from "./env";
import type { ZoneId } from "../data/zones";
import { MOB_KINDS, Mob, type MobSnap } from "./mobs";

/**
 * Evil Toy Penguin Caller Cookie (design bible §22.1).
 *  1. Waddle, peck, call toys. Comic.
 *  2. Coat opens, armature extends, spin (it bows first), button-eye beams.
 *  3. Climbs the music box, toys fall as hazards, a long-tell slam.
 * Weak to fire. A heavy from behind ("back-stitch") staggers.
 */

type St =
  | "dormant" | "intro" | "idle" | "waddle" | "pecktell" | "peck" | "slidetell" | "slide" | "call" | "bow" | "spin" | "beamtell" | "beam"
  | "dizzy" | "phase" | "climb" | "perch" | "slamtell" | "slam" | "land" | "hurt" | "dying" | "dead";

type Drop = { x: number; z: number; t: number; decal: Decal; block: THREE.Mesh | null; fell: boolean; id: string };

/** Network order of Cookie.st. */
const STATES: St[] = [
  "dormant", "intro", "idle", "waddle", "pecktell", "peck", "slidetell", "slide", "call", "bow", "spin", "beamtell", "beam",
  "dizzy", "phase", "climb", "perch", "slamtell", "slam", "land", "hurt", "dying", "dead",
];
const TELLS: St[] = ["pecktell", "slidetell", "bow", "beamtell", "slamtell"];

export type BossSnap = {
  s: number; t: number; d: number; x: number; z: number; y: number; yw: number; hp: number; ph: number; co: number; ar: number;
  sv: number; ob: number; tx: number; tz: number; mv: number; bx: number; dr: [string, number, number, number, number][]; ty: MobSnap[];
};

export class Cookie implements Boss {
  readonly def = BOSSES.cookie;
  readonly phaseNames = ["", "Peck and call", "The coat opens", "The music box"];
  readonly stageLight = true;
  rig: Rig;
  poser: Poser;
  mat: THREE.MeshLambertMaterial;
  x = DUN.arena.x;
  z = DUN.arena.z - 4.6;
  y = 0;
  yaw = Math.PI;
  hp = COOKIE_HP;
  max = COOKIE_HP;
  st: St = "dormant";
  t = 0;
  dur = 1;
  phaseN = 1;
  coat = 0;
  armature = 0;
  spin = 0;
  spinV = 0;
  flash = 0;
  cd = 1.5;
  callCd = 6;
  dropCd = 3;
  mv = 0;
  gait = 0;
  kx = 0;
  kz = 0;
  tx = 0;
  tz = 0;
  sx = 0;
  sz = 0;
  hitDone = false;
  decal: Decal | null = null;
  toys: Mob[] = [];
  drops: Drop[] = [];
  onBox = false;
  deadT = 0;
  boxRate = 1;
  staggerCount = 0;
  /** true on clients that do not run the world */
  puppet = false;
  private net: { x: number; z: number; y: number; yaw: number } | null = null;
  private hitSet = new Set<PlayerState>();
  private target: PlayerState | null = null;
  private retargetT = 0;
  private dropSeq = 0;
  private hitTick = 0;
  private blockGeo = new THREE.BoxGeometry(1.4, 1.4, 1.4);
  private blockMats: THREE.Material[];

  /** The local player is in the castle, near enough to hear Cookie. */
  get heard() {
    return this.env.heard(this.x, this.z, "castle", 70);
  }

  private get sfx() {
    return this.heard ? this.env.audio : SILENT;
  }

  constructor(private env: Env, parent: THREE.Object3D, blockMats: THREE.Material[], private musicLid: THREE.Object3D) {
    this.rig = buildCookie();
    this.mat = characterMaterial.clone() as THREE.MeshLambertMaterial;
    this.rig.mesh.material = this.mat;
    this.poser = new Poser(this.rig);
    this.blockMats = blockMats;
    parent.add(this.rig.group);
    this.place();
  }

  get adds() {
    return this.toys;
  }

  /** The server sized this fight for the players in the courtyard. */
  setMax(max: number) {
    if (!(max > 0)) return;
    const k = this.max > 0 ? this.hp / this.max : 1;
    this.max = max;
    this.hp = this.fighting ? Math.round(max * k) : this.st === "dead" ? 0 : max;
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

  private place() {
    this.rig.group.position.set(this.x, this.y, this.z);
  }

  /** Clears everything a fight leaves around: toys, falling blocks, the floor mark, the beam. */
  private clearFight() {
    for (const m of this.toys) m.remove();
    this.toys = [];
    for (const d of this.drops) this.clearDrop(d);
    this.drops = [];
    this.env.decals.release(this.decal);
    this.decal = null;
    this.env.beam.hide();
  }

  reset() {
    this.clearFight();
    this.hp = this.max;
    this.st = "dormant";
    this.phaseN = 1;
    this.coat = 0;
    this.armature = 0;
    this.x = DUN.arena.x;
    this.z = DUN.arena.z - 4.6;
    this.y = 0;
    this.yaw = Math.PI;
    this.onBox = false;
    this.spin = 0;
    this.spinV = 0;
    this.rig.group.visible = true;
    this.boxRate = 1;
    this.place();
  }

  setDead() {
    this.clearFight();
    this.st = "dead";
    this.hp = 0;
    this.y = 0;
    this.x = DUN.arena.x + 3;
    this.z = DUN.arena.z + 4;
    this.place();
    poseCookie(this.poser, { t: 0, move: 0, phase: 0, action: "dead", at: 1, coat: 1, armature: 0.4, spin: 0 }, 1);
  }

  startIntro() {
    if (this.st !== "dormant") return;
    this.st = "intro";
    this.t = this.dur = 3.2;
  }

  private go(st: St, dur: number) {
    this.st = st;
    this.t = dur;
    this.dur = Math.max(0.001, dur);
    this.hitDone = false;
    this.hitSet.clear();
  }

  /** Players Cookie can hurt: in the castle and standing. */
  private foes() {
    return this.env.players().filter((q) => q.zone === "castle" && !q.dead);
  }

  /** The nearest standing player in the courtyard, kept for a while so Cookie commits. */
  private choose(dt: number): PlayerState {
    const env = this.env;
    const foes = this.foes();
    const inArena = (q: PlayerState) => Math.hypot(q.x - DUN.arena.x, q.z - DUN.arena.z) < DUN.arena.r + 2;
    if (this.target && !foes.includes(this.target)) this.target = null;
    this.retargetT -= dt;
    if (!this.target || this.retargetT <= 0) {
      this.retargetT = 2;
      let best: PlayerState | null = null;
      let bd = 1e9;
      for (const q of foes) {
        const d = Math.hypot(q.x - this.x, q.z - this.z) + (inArena(q) ? 0 : 50);
        if (d < bd) {
          bd = d;
          best = q;
        }
      }
      this.target = best;
    }
    return this.target ?? env.player;
  }

  /** Hurts every standing player for whom `test` holds, once per attack unless `again`. */
  private strike(test: (q: PlayerState) => boolean, dmg: number, sx: number, sz: number, o: Parameters<Env["hurt"]>[4], again = false) {
    let any = false;
    for (const q of this.foes()) {
      if (!again && this.hitSet.has(q)) continue;
      if (!test(q)) continue;
      this.hitSet.add(q);
      this.env.hurt(q, dmg, sx, sz, { ...o, src: "cookie" });
      any = true;
    }
    return any;
  }

  /** Whether a blow can land right now (not mid-intro, phase change or climb). */
  canTakeHit() {
    return this.fighting && this.st !== "intro" && this.st !== "phase" && this.st !== "climb";
  }

  /** What the server needs to price a blow from (fromX, fromZ). */
  hitFlags(fromX: number, fromZ: number) {
    const ang = Math.atan2(fromX - this.x, fromZ - this.z);
    const behind = Math.abs(Math.atan2(Math.sin(ang - this.yaw), Math.cos(ang - this.yaw))) > 2.1;
    const grounded = !this.onBox && !["slam", "slamtell", "climb", "perch", "phase", "intro"].includes(this.st);
    return { behind: behind && grounded, perched: this.onBox, dizzy: this.st === "dizzy" || this.st === "land" };
  }

  /** A blow priced by the server: the shared health pool moves to `hp`. */
  netHit(hp: number, fromX: number, fromZ: number, heavy: boolean, fire: boolean) {
    if (!this.alive) return;
    const f = this.hitFlags(fromX, fromZ);
    if (!this.puppet && heavy && !fire && f.behind) {
      this.env.decals.release(this.decal);
      this.decal = null;
      this.env.beam.hide();
      this.go("hurt", 1.1);
    }
    this.hp = Math.max(0, Math.min(this.hp, hp));
    this.flash = 0.12;
    this.env.dust.burst(fire ? 6 : 10, this.x + (fromX - this.x) * 0.3, this.y + 1.6, this.z + (fromZ - this.z) * 0.3, 3, 0xe8dcc6, 0.6, 0.14, { up: 1.5 });
    if (this.hp <= 0 && !this.puppet) this.beginDeath();
  }

  /** Snapshot for the network. */
  snap(): BossSnap {
    const r = (v: number) => Math.round(v * 100) / 100;
    return {
      s: STATES.indexOf(this.st), t: r(Math.max(0, this.t)), d: r(this.dur), x: r(this.x), z: r(this.z), y: r(this.y), yw: r(this.yaw), hp: this.hp, ph: this.phaseN,
      co: r(this.coat), ar: r(this.armature), sv: r(this.spinV), ob: this.onBox ? 1 : 0, tx: r(this.tx), tz: r(this.tz), mv: r(this.mv), bx: r(this.boxRate),
      dr: this.drops.map((d) => [d.id, r(d.x), r(d.z), r(d.t), d.fell ? 1 : 0]),
      ty: this.toys.map((m) => m.snap()),
    };
  }

  /** Applies a snapshot from the client that runs the world. */
  applySnap(raw: unknown) {
    const sn = raw as BossSnap;
    const st = STATES[sn.s] ?? "dormant";
    if (!this.net || Math.hypot(sn.x - this.x, sn.z - this.z) > 12) {
      this.x = sn.x;
      this.z = sn.z;
      this.y = sn.y;
      this.yaw = sn.yw;
    }
    this.net = { x: sn.x, z: sn.z, y: sn.y, yaw: sn.yw };
    if (st !== this.st) this.puppetEnter(st, this.st);
    if (st !== this.st || Math.abs(this.t - sn.t) > 0.25) {
      this.t = sn.t;
      this.dur = Math.max(0.001, sn.d);
    }
    this.st = st;
    this.hp = Math.min(this.hp, sn.hp);
    if (sn.hp > this.hp + 40) this.hp = sn.hp;
    this.phaseN = sn.ph;
    this.coat = sn.co;
    this.armature = sn.ar;
    this.spinV = sn.sv;
    this.onBox = !!sn.ob;
    this.tx = sn.tx;
    this.tz = sn.tz;
    this.mv = sn.mv;
    this.boxRate = sn.bx;
    // falling toys: show the ones we have not seen, forget the ones that are gone
    const ids = new Set(sn.dr.map((d) => d[0]));
    for (const [id, x, z, t, fell] of sn.dr) {
      if (this.drops.some((d) => d.id === id) || fell) continue;
      this.drops.push({ id, x, z, t, decal: this.env.decals.get(), block: null, fell: false });
    }
    for (let i = this.drops.length - 1; i >= 0; i--)
      if (!ids.has(this.drops[i].id) && this.drops[i].fell) {
        this.clearDrop(this.drops[i]);
        this.drops.splice(i, 1);
      }
    // summoned toys
    const keys = new Set(sn.ty.map((m) => m[0]));
    for (const m of sn.ty) {
      let toy = this.toys.find((t) => t.key === m[0]);
      if (!toy) {
        toy = new Mob(MOB_KINDS[m[8]] ?? "soldier", m[1], m[2], "castle", this.env, false);
        toy.key = m[0];
        toy.summoned = true;
        toy.puppet = true;
        this.toys.push(toy);
      }
      toy.applySnap(m);
    }
    for (let i = this.toys.length - 1; i >= 0; i--)
      if (!keys.has(this.toys[i].key)) {
        this.toys[i].remove();
        this.toys.splice(i, 1);
      }
  }

  /** Sounds and shapes when a puppet changes state. */
  private puppetEnter(st: St, prev: St) {
    const env = this.env;
    if (TELLS.includes(prev)) {
      env.decals.release(this.decal);
      this.decal = null;
    }
    if ((prev === "beam" || prev === "beamtell") && st !== "beam") env.beam.hide();
    if (TELLS.includes(st)) this.decal = env.decals.get();
    if (st === "peck" || st === "phase") this.sfx.squeak();
    else if (st === "slide") this.sfx.swing(true);
    else if (st === "spin") this.sfx.wind();
    else if (st === "beamtell" || st === "beam") this.sfx.beam();
    else if (st === "slamtell") this.sfx.charge();
    else if (st === "call") this.sfx.bell(0.2, 660);
    else if (st === "land") {
      env.flashes.ring(this.x, 0, this.z, 4.6, 0xffcf90, 0.6);
      env.dust.burst(30, this.x, 0.3, this.z, 6, 0xd8c8b0, 0.9, 0.35, { up: 1.5 });
      this.sfx.thud();
      if (this.heard) env.shake(0.6);
    } else if (st === "dying") {
      env.beam.hide();
      for (const d of this.drops) this.clearDrop(d);
      this.drops = [];
      this.deadT = 0;
    } else if (st === "dizzy") env.floater("Dizzy!", this.x, 3.6, this.z, "info");
    if (st === "perch" && prev === "climb") {
      this.sfx.thud();
      if (this.heard) env.shake(0.3);
    }
  }

  /** Becomes the real thing (this client now runs the world) or a puppet. */
  setPuppet(on: boolean) {
    if (this.puppet === on) return;
    this.puppet = on;
    this.net = null;
    this.target = null;
    for (const m of this.toys) m.setPuppet(on);
    if (!on && this.fighting && this.st !== "intro" && this.st !== "phase" && this.st !== "call" && this.st !== "waddle" && this.st !== "perch" && this.st !== "dizzy" && this.st !== "hurt") {
      // take over mid-attack: settle and start the next decision fresh
      this.env.decals.release(this.decal);
      this.decal = null;
      this.env.beam.hide();
      if (this.st === "climb" || this.st === "slam" || this.st === "land") {
        this.onBox = false;
        this.y = 0;
      }
      this.recover(0.6);
    }
    if (!on) for (const d of this.drops) d.fell = d.fell || d.t <= 0;
  }

  private puppetUpdate(dt: number) {
    const env = this.env;
    if (this.flash > 0) this.flash -= dt;
    this.mat.emissive.setHex(this.flash > 0 ? 0xff9966 : this.phaseN === 3 && this.fighting ? 0x2a0808 : 0x000000);
    this.mat.emissiveIntensity = this.flash > 0 ? 0.9 : 0.5;
    for (let i = this.toys.length - 1; i >= 0; i--) this.toys[i].update(dt);
    if (this.st === "dormant") {
      this.musicLid.rotation.x = -1.9;
      poseCookie(this.poser, { t: env.time, move: 0, phase: 0, action: "idle", at: 0, coat: 0, armature: 0, spin: 0 }, dt);
      this.place();
      return;
    }
    if (this.st === "dead") return;
    this.t -= dt;
    if (this.net) {
      const k = Math.min(1, dt * 9);
      this.x += (this.net.x - this.x) * k;
      this.z += (this.net.z - this.z) * k;
      this.y += (this.net.y - this.y) * k;
      const dy = Math.atan2(Math.sin(this.net.yaw - this.yaw), Math.cos(this.net.yaw - this.yaw));
      this.yaw += dy * Math.min(1, dt * 10);
    }
    const k = 1 - Math.max(0, this.t) / this.dur;
    let action: CookieAction = "idle";
    let at = k;
    const eye = () => new THREE.Vector3(this.x + Math.sin(this.yaw) * 0.6, this.y + 2.1, this.z + Math.cos(this.yaw) * 0.6);
    switch (this.st) {
      case "intro":
        action = "intro";
        at = Math.min(1, k * 1.4);
        break;
      case "idle":
      case "waddle":
        action = "waddle";
        break;
      case "pecktell":
        action = "pecktell";
        this.decal?.show(1, this.x, 0, this.z, this.yaw, 3.4, k, { half: 0.55 });
        break;
      case "peck":
        action = "peck";
        break;
      case "slidetell":
        action = "pecktell";
        this.decal?.show(2, this.x, 0, this.z, this.yaw, 14, k, { w: 1.4 });
        break;
      case "slide":
        action = "slide";
        env.dust.emit({ x: this.x, y: 0.2, z: this.z, vx: Math.random() - 0.5, vy: 1, vz: Math.random() - 0.5, life: 0.6, size: 0.4, color: 0xd8c8b0, a: 0.6, grav: 1 });
        break;
      case "call":
        action = "call";
        break;
      case "bow":
        action = "bow";
        this.decal?.show(0, this.x, 0, this.z, 0, 3.8, k);
        break;
      case "spin":
        action = "spin";
        if (Math.random() < dt * 20) env.sparks.emit({ x: this.x + (Math.random() - 0.5) * 3, y: 1.2, z: this.z + (Math.random() - 0.5) * 3, vy: 2, life: 0.4, size: 0.18, color: 0xffd08a, grav: 4 });
        break;
      case "beamtell": {
        action = "beam";
        const dist = Math.max(4, Math.hypot(this.tx - this.x, this.tz - this.z) + 6);
        this.decal?.show(2, this.x, 0, this.z, this.yaw, dist, k, { w: 0.9, color: 0xe8b04a });
        env.beam.show(eye(), new THREE.Vector3(this.x + Math.sin(this.yaw) * dist, 0.3, this.z + Math.cos(this.yaw) * dist), 0.03, 0.35);
        break;
      }
      case "beam":
        action = "beam";
        env.beam.show(eye(), new THREE.Vector3(this.x + Math.sin(this.yaw) * 22, 0.3, this.z + Math.cos(this.yaw) * 22), 0.14 + Math.sin(env.time * 60) * 0.03, 0.95);
        break;
      case "dizzy":
        action = "hurt";
        at = 0.5 + Math.sin(env.time * 6) * 0.3;
        if (Math.random() < dt * 6) env.sparks.emit({ x: this.x + Math.sin(env.time * 5) * 0.8, y: this.y + 3.4, z: this.z + Math.cos(env.time * 5) * 0.8, life: 0.5, size: 0.2, color: 0xffe0a0, grav: -0.5 });
        break;
      case "hurt":
        action = "hurt";
        break;
      case "phase":
        action = "bow";
        at = 0.6;
        break;
      case "climb":
      case "slam":
        action = "slam";
        break;
      case "perch":
        action = "idle";
        break;
      case "slamtell":
        action = "slamtell";
        this.decal?.show(0, this.tx, 0, this.tz, 0, 4.2, k);
        break;
      case "land":
        action = "hurt";
        at = 0.6;
        break;
      case "dying":
        this.deadT += dt;
        this.boxRate = Math.max(0.25, 1 - this.deadT * 0.3);
        action = this.deadT < 2.4 ? "spin" : "dead";
        at = this.deadT < 2.4 ? 0 : (this.deadT - 2.4) / 1.2;
        if (Math.random() < dt * 30) env.dust.emit({ x: this.x + (Math.random() - 0.5), y: this.y + 1.5 + Math.random(), z: this.z + (Math.random() - 0.5), vx: (Math.random() - 0.5) * 3, vy: 2 + Math.random() * 2, vz: (Math.random() - 0.5) * 3, life: 1.2, size: 0.15, color: Math.random() < 0.5 ? 0xe8dcc6 : 0xb5893a, grav: 5 });
        if (this.t <= 0 && this.deadT > 3.6) {
          this.st = "dead";
          this.boxRate = 0;
          env.dust.burst(60, this.x, 1.5, this.z, 6, 0xe8dcc6, 1.4, 0.25, { up: 3, grav: 4 });
        }
        break;
    }
    this.updateDrops(dt, false);
    this.gait += this.mv * dt * 2.4;
    this.spin += this.spinV * dt;
    if (this.spinV === 0) this.spin *= Math.exp(-dt * 4);
    this.place();
    this.rig.group.rotation.y = this.yaw;
    this.musicLid.rotation.x = -1.9 + (this.phaseN >= 3 && this.fighting ? Math.sin(env.time * 8) * 0.12 : 0);
    poseCookie(this.poser, { t: env.time, move: this.mv / 2.3, phase: this.gait, action, at, coat: this.coat, armature: this.armature, spin: this.spin }, dt);
  }

  private faceTo(x: number, z: number, rate: number, dt: number) {
    const ty = Math.atan2(x - this.x, z - this.z);
    const d = Math.atan2(Math.sin(ty - this.yaw), Math.cos(ty - this.yaw));
    this.yaw += Math.sign(d) * Math.min(Math.abs(d), rate * dt);
  }

  takeHit(dmg: number, fromX: number, fromZ: number, heavy: boolean, fire: boolean) {
    if (!this.fighting || this.st === "intro" || this.st === "phase" || this.st === "climb") return 0;
    let d = dmg;
    let label = "";
    if (fire) d = Math.round(d * 1.5);
    const ang = Math.atan2(fromX - this.x, fromZ - this.z);
    const behind = Math.abs(Math.atan2(Math.sin(ang - this.yaw), Math.cos(ang - this.yaw))) > 2.1;
    const grounded = !this.onBox && !["slam", "slamtell", "climb", "perch", "phase", "intro"].includes(this.st);
    if (this.onBox && !fire) {
      d = Math.max(1, Math.round(d * 0.5));
      label = label || "";
    }
    if (heavy && behind && grounded) {
      d = Math.round(d * 1.3);
      label = "Back-stitch!";
      this.env.decals.release(this.decal);
      this.decal = null;
      this.env.beam.hide();
      this.go("hurt", 1.1);
    }
    if (this.st === "dizzy" || this.st === "land") d = Math.round(d * 1.3);
    this.hp = Math.max(0, this.hp - d);
    this.flash = 0.12;
    if (label) this.env.floater(label, this.x, this.y + 3.6, this.z, "crit");
    this.env.dust.burst(fire ? 6 : 10, this.x + (fromX - this.x) * 0.3, this.y + 1.6, this.z + (fromZ - this.z) * 0.3, 3, 0xe8dcc6, 0.6, 0.14, { up: 1.5 });
    if (this.hp <= 0) this.beginDeath();
    return d;
  }

  private beginDeath() {
    this.env.decals.release(this.decal);
    this.decal = null;
    this.env.beam.hide();
    for (const d of this.drops) this.clearDrop(d);
    this.drops = [];
    this.go("dying", 4.2);
    this.spinV = 8;
    this.deadT = 0;
    for (const m of this.toys) if (m.alive) m.die();
  }

  private clearDrop(d: Drop) {
    this.env.decals.release(d.decal);
    if (d.block) d.block.parent?.remove(d.block);
  }

  private spawnToy(parent: (zone: ZoneId) => THREE.Object3D) {
    void parent;
    const a = Math.random() * Math.PI * 2;
    const x = DUN.arena.x + Math.cos(a) * 11;
    const z = DUN.arena.z + Math.sin(a) * 11;
    const kind = Math.random() < 0.7 ? "soldier" : "mouse";
    const m = new Mob(kind, x, z, "castle", this.env, false);
    m.key = "t" + Math.random().toString(36).slice(2, 7);
    m.summoned = true;
    m.state = "chase";
    m.aggro = true;
    m.cd = 1.2;
    this.toys.push(m);
    this.env.dust.burst(16, x, 0.5, z, 3, 0xd8c8a8, 0.7, 0.2, { up: 2 });
  }

  /** Per-frame; `inArena` is whether the player stands in the courtyard. */
  update(dt: number, inArena: boolean) {
    if (this.puppet) return this.puppetUpdate(dt);
    // took over a fight whose last blow landed while this client was a puppet
    if (this.fighting && this.hp <= 0) this.beginDeath();
    const env = this.env;
    const p = this.choose(dt);
    if (this.flash > 0) this.flash -= dt;
    this.mat.emissive.setHex(this.flash > 0 ? 0xff9966 : this.phaseN === 3 && this.fighting ? 0x2a0808 : 0x000000);
    this.mat.emissiveIntensity = this.flash > 0 ? 0.9 : 0.5;
    for (let i = this.toys.length - 1; i >= 0; i--) {
      this.toys[i].update(dt);
      if (!this.toys[i].alive && this.toys[i].deadT > 5) {
        this.toys[i].remove();
        this.toys.splice(i, 1);
      }
    }
    if (this.st === "dormant") {
      this.musicLid.rotation.x = -1.9;
      poseCookie(this.poser, { t: env.time, move: 0, phase: 0, action: "idle", at: 0, coat: 0, armature: 0, spin: 0 }, dt);
      this.place();
      return;
    }
    if (this.st === "dead") return;
    this.t -= dt;
    const d = Math.hypot(p.x - this.x, p.z - this.z);
    const k = 1 - Math.max(0, this.t) / this.dur;
    let action: CookieAction = "idle";
    let at = k;
    this.mv = 0;

    // phase changes
    if (this.fighting && this.st !== "phase" && this.st !== "climb") {
      if (this.phaseN === 1 && this.hp < this.max * 0.66) {
        this.phaseN = 2;
        env.decals.release(this.decal);
        this.decal = null;
        env.beam.hide();
        this.go("phase", 1.6);
        this.sfx.squeak();
        env.floater("The coat opens.", this.x, 4, this.z, "info");
      } else if (this.phaseN === 2 && this.hp < this.max * 0.33) {
        this.phaseN = 3;
        env.decals.release(this.decal);
        this.decal = null;
        env.beam.hide();
        this.go("climb", 1.3);
        this.tx = this.x;
        this.tz = this.z;
        env.floater("Cookie climbs the music box!", this.x, 4, this.z, "info");
      }
    }
    if (!inArena && this.fighting && this.st !== "intro") {
      // the player left: hold still
    }

    switch (this.st) {
      case "intro":
        action = "intro";
        at = Math.min(1, k * 1.4);
        this.faceTo(p.x, p.z, 2, dt);
        this.musicLid.rotation.x = -1.9 + Math.sin(env.time * 3) * 0.05;
        if (this.t <= 0) {
          this.go("call", 1.4);
          this.spawnToy(env.parent);
          this.spawnToy(env.parent);
        }
        break;
      case "idle":
      case "waddle": {
        action = "waddle";
        this.faceTo(p.x, p.z, 3.2, dt);
        if (!inArena) break;
        this.cd -= dt;
        this.callCd -= dt;
        const alive = this.toys.filter((m) => m.alive).length;
        if (this.phaseN === 3) {
          this.go("perch", 0.5);
          break;
        }
        if (this.cd <= 0) {
          if (this.callCd <= 0 && alive < 2) {
            this.go("call", 1.4);
            this.callCd = 14;
            this.spawnToy(env.parent);
            this.spawnToy(env.parent);
            this.sfx.bell(0.2, 660);
          } else if (this.phaseN >= 2 && d < 6 && Math.random() < 0.55) {
            this.go("bow", 0.8);
            this.decal = env.decals.get();
          } else if (this.phaseN >= 2 && d > 4 && Math.random() < 0.6) {
            this.go("beamtell", 0.95);
            this.decal = env.decals.get();
            this.sfx.beam();
          } else if (d < 3.4) {
            this.go("pecktell", 0.6);
            this.decal = env.decals.get();
          } else if (d > 5.5 && Math.random() < 0.65) {
            this.go("slidetell", 0.75);
            this.decal = env.decals.get();
            this.tx = p.x;
            this.tz = p.z;
          }
        }
        if (this.st === "waddle" || this.st === "idle") {
          this.st = "waddle";
          if (d > 2.6) {
            this.mv = this.phaseN >= 2 ? 2.9 : 2.3;
          }
        }
        break;
      }
      case "pecktell":
        action = "pecktell";
        this.faceTo(p.x, p.z, 4, dt);
        this.decal?.show(1, this.x, 0, this.z, this.yaw, 3.4, k, { half: 0.55 });
        if (this.t <= 0) {
          env.decals.release(this.decal);
          this.decal = null;
          this.go("peck", 0.3);
          this.kx += Math.sin(this.yaw) * 6;
          this.kz += Math.cos(this.yaw) * 6;
          this.sfx.squeak();
        }
        break;
      case "peck":
        action = "peck";
        this.strike(
          (q) => {
            const ang = Math.atan2(q.x - this.x, q.z - this.z);
            return Math.hypot(q.x - this.x, q.z - this.z) < 3.6 && Math.abs(Math.atan2(Math.sin(ang - this.yaw), Math.cos(ang - this.yaw))) < 0.8;
          },
          14, this.x, this.z, { knock: 1.8, parryable: true, source: { stagger: (s) => this.parried(s) } },
        );
        if (this.t <= 0) this.recover(0.7);
        break;
      case "slidetell":
        action = "pecktell";
        if (k < 0.6) {
          this.faceTo(p.x, p.z, 5, dt);
        }
        this.decal?.show(2, this.x, 0, this.z, this.yaw, 14, k, { w: 1.4 });
        if (this.t <= 0) {
          env.decals.release(this.decal);
          this.decal = null;
          this.go("slide", 1.05);
          this.sfx.swing(true);
        }
        break;
      case "slide": {
        action = "slide";
        const sp = 13;
        const nx = this.x + Math.sin(this.yaw) * sp * dt;
        const nz = this.z + Math.cos(this.yaw) * sp * dt;
        const s = env.col.resolve(nx, nz, 1.0);
        const bumped = Math.abs(s.x - nx) + Math.abs(s.z - nz) > 0.05;
        this.x = s.x;
        this.z = s.z;
        env.dust.emit({ x: this.x, y: 0.2, z: this.z, vx: (Math.random() - 0.5), vy: 1, vz: (Math.random() - 0.5), life: 0.6, size: 0.4, color: 0xd8c8b0, a: 0.6, grav: 1 });
        this.strike((q) => Math.hypot(q.x - this.x, q.z - this.z) < 1.7, 16, this.x, this.z, { knock: 3 });
        if (this.t <= 0 || bumped) {
          if (bumped) {
            this.sfx.thud();
            if (this.heard) env.shake(0.3);
            env.floater("Dizzy!", this.x, 3.6, this.z, "info");
            this.go("dizzy", 1.8);
          } else this.recover(1.0);
        }
        break;
      }
      case "call":
        action = "call";
        if (Math.floor(env.time * 6) !== Math.floor((env.time - dt) * 6)) this.sfx.bell(0.08, 880);
        if (this.t <= 0) this.recover(0.5);
        break;
      case "bow":
        action = "bow";
        this.decal?.show(0, this.x, 0, this.z, 0, 3.8, k);
        if (this.t <= 0) {
          env.decals.release(this.decal);
          this.decal = null;
          this.go("spin", 1.8);
          this.sfx.wind();
          this.hitTick = 0;
        }
        break;
      case "spin": {
        action = "spin";
        this.spinV = 16;
        this.mv = 3.2;
        this.faceTo(p.x, p.z, 1.5, dt);
        this.hitTick -= dt;
        if (this.hitTick <= 0 && this.strike((q) => Math.hypot(q.x - this.x, q.z - this.z) < 3.5, 10, this.x, this.z, { knock: 2.4 }, true)) this.hitTick = 0.45;
        if (Math.random() < dt * 20) env.sparks.emit({ x: this.x + (Math.random() - 0.5) * 3, y: 1.2, z: this.z + (Math.random() - 0.5) * 3, vy: 2, life: 0.4, size: 0.18, color: 0xffd08a, grav: 4 });
        if (this.t <= 0) {
          this.spinV = 0;
          env.floater("Dizzy!", this.x, 3.6, this.z, "info");
          this.go("dizzy", 1.4);
        }
        break;
      }
      case "beamtell":
      case "beam": {
        action = "beam";
        const eye = new THREE.Vector3(this.x + Math.sin(this.yaw) * 0.6, this.y + 2.1, this.z + Math.cos(this.yaw) * 0.6);
        if (this.st === "beamtell") {
          if (k < 0.65) {
            this.faceTo(p.x, p.z, 3, dt);
            this.tx = p.x;
            this.tz = p.z;
          }
          const dist = Math.max(4, Math.hypot(this.tx - this.x, this.tz - this.z) + 6);
          this.decal?.show(2, this.x, 0, this.z, this.yaw, dist, k, { w: 0.9, color: 0xe8b04a });
          env.beam.show(eye, new THREE.Vector3(this.x + Math.sin(this.yaw) * dist, 0.3, this.z + Math.cos(this.yaw) * dist), 0.03, 0.35);
          if (this.t <= 0) {
            env.decals.release(this.decal);
            this.decal = null;
            this.go("beam", 0.55);
            this.sfx.beam();
          }
        } else {
          const dist = 22;
          const end = new THREE.Vector3(this.x + Math.sin(this.yaw) * dist, 0.3, this.z + Math.cos(this.yaw) * dist);
          env.beam.show(eye, end, 0.14 + Math.sin(env.time * 60) * 0.03, 0.95);
          const fx = Math.sin(this.yaw);
          const fz = Math.cos(this.yaw);
          const along = (p.x - this.x) * fx + (p.z - this.z) * fz;
          this.strike(
            (q) => {
              const dx = q.x - this.x;
              const dz = q.z - this.z;
              return dx * fx + dz * fz > 0 && Math.abs(-dx * fz + dz * fx) < 0.95;
            },
            18, this.x, this.z, { knock: 1.4, unblockable: false },
          );
          if (Math.random() < 0.5) env.sparks.emit({ x: end.x * 0.0 + this.x + fx * along, y: 0.3, z: this.z + fz * along, vy: 2, life: 0.3, size: 0.2, color: 0xffc46b, grav: 3 });
          if (this.t <= 0) {
            env.beam.hide();
            this.recover(this.onBox ? 0.6 : 0.9);
          }
        }
        break;
      }
      case "dizzy":
        action = "hurt";
        at = 0.5 + Math.sin(env.time * 6) * 0.3;
        if (Math.random() < dt * 6) env.sparks.emit({ x: this.x + Math.sin(env.time * 5) * 0.8, y: this.y + 3.4, z: this.z + Math.cos(env.time * 5) * 0.8, life: 0.5, size: 0.2, color: 0xffe0a0, grav: -0.5 });
        if (this.t <= 0) this.recover(0.2);
        break;
      case "hurt":
        action = "hurt";
        if (this.t <= 0) this.recover(0.3);
        break;
      case "phase":
        action = "bow";
        at = 0.6;
        this.coat = Math.min(1, this.coat + dt);
        this.armature = Math.min(1, this.armature + dt * 0.8);
        if (this.t <= 0) {
          this.boxRate = 0.86;
          this.recover(0.3);
          this.sfx.squeak();
        }
        break;
      case "climb": {
        action = "slam";
        at = k;
        const bx = DUN.arena.x;
        const bz = DUN.arena.z;
        this.x = this.tx + (bx - this.tx) * k;
        this.z = this.tz + (bz - this.tz) * k;
        this.y = Math.sin(k * Math.PI) * 3 + k * 2.15;
        this.faceTo(p.x, p.z, 3, dt);
        this.coat = 1;
        this.armature = 1;
        if (this.t <= 0) {
          this.onBox = true;
          this.y = 2.15;
          this.x = bx;
          this.z = bz;
          this.boxRate = 0.72;
          this.sfx.thud();
          if (this.heard) env.shake(0.3);
          this.go("perch", 0.8);
          this.dropCd = 0.5;
          this.callCd = 2;
        }
        break;
      }
      case "perch": {
        action = "idle";
        this.faceTo(p.x, p.z, 3, dt);
        if (!this.onBox) {
          this.go("climb", 1.0);
          this.tx = this.x;
          this.tz = this.z;
          break;
        }
        this.cd -= dt;
        this.callCd -= dt;
        if (this.t <= 0 && this.cd <= 0 && inArena) {
          const alive = this.toys.filter((m) => m.alive).length;
          if (this.callCd <= 0 && alive < 3) {
            this.go("call", 1.2);
            this.callCd = 13;
            this.spawnToy(env.parent);
            this.spawnToy(env.parent);
          } else if (Math.random() < 0.45) {
            this.go("slamtell", 1.15);
            this.tx = p.x;
            this.tz = p.z;
            this.decal = env.decals.get();
            this.sfx.charge();
          } else {
            this.go("beamtell", 0.9);
            this.decal = env.decals.get();
            this.sfx.beam();
          }
        }
        break;
      }
      case "slamtell":
        action = "slamtell";
        this.faceTo(this.tx, this.tz, 4, dt);
        if (k < 0.5) {
          this.tx += (p.x - this.tx) * Math.min(1, dt * 3);
          this.tz += (p.z - this.tz) * Math.min(1, dt * 3);
        }
        this.decal?.show(0, this.tx, 0, this.tz, 0, 4.2, k);
        if (this.t <= 0) {
          env.decals.release(this.decal);
          this.decal = null;
          this.go("slam", 0.65);
          this.sx = this.x;
          this.sz = this.z;
          this.kx = this.kz = 0;
          this.onBox = false;
        }
        break;
      case "slam": {
        action = "slam";
        at = k;
        this.x = this.sx + (this.tx - this.sx) * k;
        this.z = this.sz + (this.tz - this.sz) * k;
        this.y = Math.sin(k * Math.PI) * 4.5 + (1 - k) * 2.15;
        if (this.t <= 0) {
          this.y = 0;
          env.flashes.ring(this.x, 0, this.z, 4.6, 0xffcf90, 0.6);
          env.dust.burst(30, this.x, 0.3, this.z, 6, 0xd8c8b0, 0.9, 0.35, { up: 1.5 });
          this.sfx.thud();
          if (this.heard) env.shake(0.6);
          this.strike((q) => Math.hypot(q.x - this.x, q.z - this.z) < 4.3, 22, this.x, this.z, { knock: 3.4 });
          env.floater("Dizzy!", this.x, 3.6, this.z, "info");
          this.go("land", 2.0);
        }
        break;
      }
      case "land":
        action = "hurt";
        at = 0.6;
        if (this.t <= 0) {
          this.tx = this.x;
          this.tz = this.z;
          this.go("climb", 1.1);
        }
        break;
      case "dying": {
        this.deadT += dt;
        this.spinV = Math.max(0, this.spinV - dt * 3);
        this.boxRate = Math.max(0.25, 1 - this.deadT * 0.3);
        action = this.deadT < 2.4 ? "spin" : "dead";
        at = this.deadT < 2.4 ? 0 : (this.deadT - 2.4) / 1.2;
        if (this.y > 0) this.y = Math.max(0, this.y - dt * 4);
        if (Math.random() < dt * 30) env.dust.emit({ x: this.x + (Math.random() - 0.5), y: this.y + 1.5 + Math.random(), z: this.z + (Math.random() - 0.5), vx: (Math.random() - 0.5) * 3, vy: 2 + Math.random() * 2, vz: (Math.random() - 0.5) * 3, life: 1.2, size: 0.15, color: Math.random() < 0.5 ? 0xe8dcc6 : 0xb5893a, grav: 5 });
        if (this.t <= 0) {
          this.st = "dead";
          this.boxRate = 0;
          env.dust.burst(60, this.x, 1.5, this.z, 6, 0xe8dcc6, 1.4, 0.25, { up: 3, grav: 4 });
        }
        break;
      }
    }

    // phase 3 hazards: toys fall where the music box's shadow lands
    if (this.phaseN === 3 && this.fighting && inArena) {
      this.dropCd -= dt;
      if (this.dropCd <= 0) {
        this.dropCd = 2.4;
        for (let i = 0; i < 3; i++) {
          const a = Math.random() * Math.PI * 2;
          const r = i === 0 ? 0 : 2 + Math.random() * 4;
          let x = p.x + Math.cos(a) * r;
          let z = p.z + Math.sin(a) * r;
          const dd = Math.hypot(x - DUN.arena.x, z - DUN.arena.z);
          if (dd > DUN.arena.r - 2) {
            x = DUN.arena.x + ((x - DUN.arena.x) / dd) * (DUN.arena.r - 2);
            z = DUN.arena.z + ((z - DUN.arena.z) / dd) * (DUN.arena.r - 2);
          }
          this.drops.push({ id: "d" + ++this.dropSeq + Math.random().toString(36).slice(2, 4), x, z, t: 1.15 + i * 0.15, decal: env.decals.get(), block: null, fell: false });
        }
      }
    }
    this.updateDrops(dt, true);

    // motion
    if (this.mv > 0 && this.st !== "slide") {
      const nx = this.x + Math.sin(this.yaw) * this.mv * dt;
      const nz = this.z + Math.cos(this.yaw) * this.mv * dt;
      const s = env.col.resolve(nx, nz, 1.0);
      this.x = s.x;
      this.z = s.z;
    }
    this.settle(dt, action, at);
  }

  /** Falling toys: tell, fall, hurt (only where the world runs), fade. */
  private updateDrops(dt: number, hurt: boolean) {
    const env = this.env;
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const dr = this.drops[i];
      dr.t -= dt;
      if (!dr.fell) {
        dr.decal.show(0, dr.x, 0, dr.z, 0, 1.7, 1 - Math.max(0, dr.t) / 1.15, { color: 0xb04a3a });
        if (dr.t < 0.3 && !dr.block) {
          dr.block = new THREE.Mesh(this.blockGeo, this.blockMats[i % this.blockMats.length]);
          dr.block.castShadow = true;
          dr.block.rotation.set(Math.random(), Math.random(), 0);
          env.parent("castle").add(dr.block);
        }
        if (dr.block) dr.block.position.set(dr.x, Math.max(0.7, 0.7 + (dr.t / 0.3) * 11), dr.z);
        if (dr.t <= 0) {
          dr.fell = true;
          env.decals.release(dr.decal);
          env.dust.burst(14, dr.x, 0.4, dr.z, 4, 0xd8c8b0, 0.6, 0.25, { up: 1.5 });
          this.sfx.clack();
          if (this.heard) env.shake(0.12);
          if (hurt) for (const q of this.foes()) if (Math.hypot(q.x - dr.x, q.z - dr.z) < 1.7) env.hurt(q, 15, dr.x, dr.z, { knock: 2, src: "cookie" });
          dr.t = 0.9;
        }
      } else if (dr.t <= 0) {
        if (dr.block) dr.block.parent?.remove(dr.block);
        this.drops.splice(i, 1);
      } else if (dr.block) dr.block.scale.setScalar(Math.max(0.01, dr.t / 0.9));
    }
  }

  private settle(dt: number, action: CookieAction, at: number) {
    const env = this.env;
    if ((this.kx || this.kz) && this.st !== "slam" && this.st !== "slamtell" && this.st !== "climb") {
      const s = env.col.resolve(this.x + this.kx * dt, this.z + this.kz * dt, 1.0);
      this.x = s.x;
      this.z = s.z;
      this.kx *= Math.exp(-dt * 6);
      this.kz *= Math.exp(-dt * 6);
      if (Math.abs(this.kx) + Math.abs(this.kz) < 0.05) this.kx = this.kz = 0;
    }
    {
      const dx = this.x - DUN.arena.x;
      const dz = this.z - DUN.arena.z;
      const dd = Math.hypot(dx, dz);
      const lim = DUN.arena.r - 1.4;
      if (dd > lim) {
        this.x = DUN.arena.x + (dx / dd) * lim;
        this.z = DUN.arena.z + (dz / dd) * lim;
      }
      if (!Number.isFinite(this.x) || !Number.isFinite(this.z)) {
        this.x = DUN.arena.x;
        this.z = DUN.arena.z + 4;
      }
    }
    this.gait += this.mv * dt * 2.4;
    this.spin += this.spinV * dt;
    if (this.spinV === 0) this.spin *= Math.exp(-dt * 4);
    this.place();
    this.rig.group.rotation.y = this.yaw;
    this.musicLid.rotation.x = -1.9 + (this.phaseN >= 3 && this.fighting ? Math.sin(env.time * 8) * 0.12 : 0);
    poseCookie(this.poser, { t: env.time, move: this.mv / 2.3, phase: this.gait, action, at, coat: this.coat, armature: this.armature, spin: this.spin }, dt);
  }

  /** A parry from any player (online: relayed to the client that runs the world). */
  parry(s: number) {
    if (this.fighting && !this.onBox) this.parried(s);
  }

  private parried(s: number) {
    this.env.decals.release(this.decal);
    this.decal = null;
    this.env.floater("Parried!", this.x, 3.6, this.z, "crit");
    this.go("dizzy", s + 0.6);
  }

  private recover(t: number) {
    this.cd = t + (this.phaseN === 1 ? 0.6 : this.phaseN === 2 ? 0.4 : 0.3) + Math.random() * 0.4;
    this.go(this.onBox ? "perch" : "waddle", this.onBox ? 0.3 : 0);
  }
}
