import type * as THREE from "three";
import { Poser, buildHuman, poseHuman, type HumanAction, type HumanLook, type Rig } from "../engine/rig";
import type { PlayerState } from "./env";
import type { ZoneId } from "../data/zones";
import { weaponModel } from "./weapons";

/** What a client sends about its own player every tick. */
export type NetPlayer = {
  x: number;
  z: number;
  y: number;
  yw: number;
  /** action, its progress (0..1, or seconds while dead), its duration, and a counter that changes per new action */
  a: HumanAction;
  at: number;
  du: number;
  ac: number;
  /** ground speed and sprinting */
  mv: number;
  sp: number;
  b: number;
  d: number;
  /** zone */
  zn: ZoneId;
  hp: number;
  mh: number;
  w: string;
  sh: number;
};

type Sample = { t: number; x: number; z: number; y: number; yaw: number };

/**
 * Another player as this client sees them: the rig built from their saved look, moved along a
 * short buffer of their recent positions (drawn ~1.5 ticks in the past so motion stays smooth
 * through network jitter), with their current action, weapon and a nameplate.
 */
export class RemotePlayer {
  rig: Rig;
  poser: Poser;
  state: PlayerState;
  plate: HTMLDivElement;
  seen = 0;
  net: NetPlayer | null = null;
  private buf: Sample[] = [];
  private gap = 100;
  private action: HumanAction = "none";
  private at = 0;
  private dur = 1;
  private ac = -1;
  private phase = 0;
  private weapon = "";
  private shield = false;
  private held: THREE.Object3D | null = null;
  private off: THREE.Object3D | null = null;

  constructor(public cid: string, public charId: string, public name: string, look: HumanLook, private parent: (zone: ZoneId) => THREE.Object3D | null, overlay: HTMLElement) {
    this.rig = buildHuman(look);
    this.poser = new Poser(this.rig);
    this.state = { x: 0, y: 0, z: 0, yaw: 0, hp: 100, maxHp: 100, iframe: 0, blocking: false, blockT: 0, shield: false, dead: false, zone: "over", cid };
    this.rig.group.visible = false;
    parent("over")?.add(this.rig.group);
    this.plate = document.createElement("div");
    this.plate.className = "vm-plate";
    this.plate.innerHTML = `<span></span><i><b></b></i>`;
    (this.plate.firstChild as HTMLElement).textContent = name;
    this.plate.style.display = "none";
    overlay.appendChild(this.plate);
  }

  /** True while this player is sending (a locked phone stops sending). */
  live(now: number) {
    return !!this.net && now - this.seen < 6000;
  }

  apply(n: NetPlayer, now: number) {
    if (this.seen) this.gap += (Math.min(400, now - this.seen) - this.gap) * 0.2;
    this.seen = now;
    const zoneChanged = !this.net || this.net.zn !== n.zn;
    this.net = n;
    if (zoneChanged) {
      this.buf.length = 0;
      this.rig.group.parent?.remove(this.rig.group);
      this.parent(n.zn)?.add(this.rig.group);
    }
    const last = this.buf[this.buf.length - 1];
    if (last && Math.hypot(last.x - n.x, last.z - n.z) > 12) this.buf.length = 0;
    this.buf.push({ t: now, x: n.x, z: n.z, y: n.y, yaw: n.yw });
    if (this.buf.length > 24) this.buf.shift();
    if (n.ac !== this.ac || n.a !== this.action) {
      this.ac = n.ac;
      this.action = n.a;
      this.at = n.at;
      this.dur = Math.max(0.05, n.du);
    }
    if (n.w !== this.weapon) {
      this.weapon = n.w;
      if (this.held) this.held.parent?.remove(this.held);
      this.held = null;
      if (n.w && n.w !== "wpn_fists") {
        this.held = weaponModel(n.w);
        this.rig.sockets.gripR.add(this.held);
      }
    }
    if (!!n.sh !== this.shield) {
      this.shield = !!n.sh;
      if (this.off) this.off.parent?.remove(this.off);
      this.off = null;
      if (this.shield) {
        this.off = weaponModel("shield");
        this.off.rotation.set(0, Math.PI / 2, 0);
        this.off.position.set(0.06, 0.05, -0.1);
        this.rig.bones.foreL.add(this.off);
      }
    }
    const s = this.state;
    s.hp = n.hp;
    s.maxHp = n.mh;
    s.dead = !!n.d;
    s.zone = n.zn;
    s.blocking = !!n.b;
    s.shield = !!n.sh;
  }

  /** Position `delay` ms in the past, between the two samples around it. */
  private sample(now: number): Sample | null {
    const b = this.buf;
    if (!b.length) return null;
    const delay = Math.min(450, Math.max(110, this.gap * 1.6));
    const rt = now - delay;
    if (rt <= b[0].t) return b[0];
    for (let i = 0; i < b.length - 1; i++) {
      const a = b[i];
      const c = b[i + 1];
      if (rt >= a.t && rt <= c.t) {
        const k = (rt - a.t) / Math.max(1, c.t - a.t);
        const dy = Math.atan2(Math.sin(c.yaw - a.yaw), Math.cos(c.yaw - a.yaw));
        return { t: rt, x: a.x + (c.x - a.x) * k, z: a.z + (c.z - a.z) * k, y: a.y + (c.y - a.y) * k, yaw: a.yaw + dy * k };
      }
    }
    // starved: hold the newest sample (a short pause reads better than a wrong guess)
    return b[b.length - 1];
  }

  update(dt: number, now: number, time: number, localZone: ZoneId) {
    const n = this.net;
    const g = this.rig.group;
    if (!n || !this.live(now)) {
      g.visible = false;
      return;
    }
    const s = this.sample(now);
    if (!s) return;
    const ox = this.state.x;
    const oz = this.state.z;
    // the world runner needs everyone's position, whichever zone it is looking at
    this.state.x = s.x;
    this.state.z = s.z;
    this.state.y = s.y;
    this.state.yaw = s.yaw;
    g.visible = n.zn === localZone && !!g.parent;
    if (!g.visible) return;
    g.position.set(s.x, s.y, s.z);
    g.rotation.y = s.yaw;
    const speed = dt > 0 ? Math.min(9, Math.hypot(s.x - ox, s.z - oz) / dt) : 0;
    this.phase += (speed / (n.sp ? 1.6 : 1.15)) * dt * Math.PI;
    if (this.action === "dead") this.at += dt;
    else if (this.action !== "none") {
      this.at = Math.min(1, this.at + dt / this.dur);
      if (this.at >= 1 && this.action !== "charge") this.action = "none";
    }
    poseHuman(this.poser, {
      t: time, move: (speed / 4.2) * (n.sp ? 1.45 : 1), phase: this.phase, action: this.action, at: this.at,
      block: !!n.b && this.action === "none", armed: !!n.w && n.w !== "wpn_fists",
    }, dt);
  }

  remove() {
    this.rig.group.parent?.remove(this.rig.group);
    this.plate.remove();
  }
}
