import type * as THREE from "three";
import { Poser, buildHuman, poseHuman, type HumanAction, type HumanLook, type Rig } from "../engine/rig";
import { weaponModel } from "./weapons";

/**
 * Hearthfen's people. Each walks a loop of stops and does something at each one
 * (hammering, sweeping, tending hives, playing), goes indoors at night, and turns to
 * face you when you speak. Not quest-arrow machines: they are there whether you talk or not.
 */

export type Stop = { x: number; z: number; wait: number; act?: HumanAction; face?: number };

export type NpcDef = {
  id: string;
  name: string;
  role: string;
  look: HumanLook;
  stops: Stop[];
  night?: { x: number; z: number } | "stay";
  hold?: string;
  speed?: number;
};

export const NPCS: NpcDef[] = [
  {
    id: "tanic", name: "Tanic", role: "Workshop lane",
    look: { skin: 0xe2c8b0, hair: 0x5a3a22, hairStyle: "tied", shirt: 0xcdbba6, coat: 0x3a3430, coatLong: true, trousers: 0x2e2a26, boots: 0x231d18, height: 1.98, frame: 0.95, pin: true, belt: 0x231d18 },
    stops: [{ x: -6.2, z: 9.5, wait: 14, act: "none", face: 1.6 }, { x: -6.6, z: 12.2, wait: 8, act: "talk", face: 1.2 }, { x: -3.2, z: 4.8, wait: 6, act: "none", face: 0.4 }],
    night: "stay",
    speed: 1.1,
  },
  {
    id: "mara", name: "Mara", role: "Smith",
    look: { skin: 0xc8a088, hair: 0x2a2118, hairStyle: "short", shirt: 0x8a7a6a, coat: 0x6a3b2a, trousers: 0x3a3026, boots: 0x2a2018, apron: 0x4a3426, frame: 1.15, height: 1.74, belt: 0x2a1a10 },
    stops: [{ x: 9.4, z: 7.4, wait: 18, act: "hammer", face: Math.PI / 2 }, { x: 8.3, z: 4.2, wait: 4, act: "none", face: 2.4 }, { x: 9.4, z: 7.4, wait: 12, act: "hammer", face: Math.PI / 2 }, { x: 5.0, z: 9.2, wait: 5, act: "none", face: 1.6 }],
    hold: "hammer",
    night: { x: 12.2, z: 16.2 },
  },
  {
    id: "penn", name: "Old Penn", role: "Beekeeper",
    look: { skin: 0xdcc0a8, hair: 0xddd4c4, hairStyle: "short", shirt: 0xcdbba6, coat: 0xa89a72, trousers: 0x5a5040, boots: 0x3a3026, height: 1.68, frame: 0.95, beard: true, hat: "straw" },
    stops: [{ x: 18.2, z: -11.8, wait: 12, act: "sweep", face: Math.PI / 2 }, { x: 21.5, z: -16.5, wait: 9, act: "sweep", face: 0 }, { x: 12.1, z: -5.0, wait: 8, act: "none", face: -Math.PI / 2 }, { x: 4.4, z: -6.8, wait: 6, act: "talk", face: 1.2 }],
    night: { x: 10.9, z: -7.0 },
    speed: 0.9,
  },
  {
    id: "bramble", name: "Captain Bramble", role: "Village guard",
    look: { skin: 0xd8b8a0, hair: 0x3a2a1c, hairStyle: "short", shirt: 0x5a5a50, coat: 0x2e3428, trousers: 0x2a2a26, boots: 0x1c1916, cape: 0x3c4a34, frame: 1.1, height: 1.84, beard: true },
    stops: [{ x: 2.4, z: 25.5, wait: 7, act: "none", face: 0 }, { x: 2.5, z: -25.5, wait: 6, act: "none", face: Math.PI }, { x: 25, z: -1.5, wait: 6, act: "none", face: Math.PI / 2 }, { x: 8.5, z: 1.2, wait: 3 }],
    night: "stay",
    hold: "spear",
  },
  {
    id: "sera", name: "Sera", role: "Hunter",
    look: { skin: 0xc8a088, hair: 0x3c4a34, hairStyle: "hood", shirt: 0x6a5a48, coat: 0x4a5a3a, trousers: 0x3a3026, boots: 0x2a2018, frame: 0.92, height: 1.72 },
    stops: [{ x: -1.8, z: 27.5, wait: 10, act: "none", face: 0 }, { x: 5.5, z: 36, wait: 7, act: "none", face: 0.3 }, { x: -3.5, z: 33, wait: 6, act: "none", face: -0.4 }],
    night: { x: -8.5, z: 20.5 },
    hold: "spear",
  },
  {
    id: "corrin", name: "Corrin", role: "Trader",
    look: { skin: 0xb88a6a, hair: 0x1c1916, hairStyle: "long", shirt: 0xb59a55, coat: 0x5a4a6a, trousers: 0x3a3026, boots: 0x2a2018, frame: 1.0, height: 1.76 },
    stops: [{ x: 4.6, z: -4.2, wait: 20, act: "none", face: Math.PI / 2 - 0.2 }, { x: 4.8, z: -6.4, wait: 6, act: "talk", face: 1.2 }],
    night: { x: 10.9, z: -5.6 },
  },
  {
    id: "child1", name: "Wren", role: "Child",
    look: { skin: 0xe2c8b0, hair: 0x8a5a2a, hairStyle: "short", shirt: 0xcdbba6, coat: 0x7a6650, trousers: 0x5a5040, boots: 0x3a3026, height: 1.2, frame: 0.85, headScale: 1.15 },
    stops: [{ x: -2.2, z: 1, wait: 0.5, act: "cheer" }, { x: -6.8, z: -0.8, wait: 0.3 }, { x: -8, z: 5, wait: 0.5, act: "cheer" }, { x: -3.2, z: 6.4, wait: 0.3 }],
    night: { x: -16, z: -1 },
    speed: 2.6,
  },
  {
    id: "child2", name: "Bryn", role: "Child",
    look: { skin: 0xc8a088, hair: 0x2a2118, hairStyle: "tied", shirt: 0xa89a72, coat: 0x5e6b45, trousers: 0x4a4036, boots: 0x3a3026, height: 1.12, frame: 0.8, headScale: 1.15 },
    stops: [{ x: -7, z: 5.6, wait: 0.4 }, { x: -2.6, z: 5.8, wait: 0.6, act: "cheer" }, { x: -2.0, z: 0.4, wait: 0.3 }, { x: -7.6, z: -0.2, wait: 0.6, act: "cheer" }],
    night: { x: -16, z: -1 },
    speed: 2.4,
  },
  {
    id: "v1", name: "Holt", role: "Villager",
    look: { skin: 0xd8b8a0, hair: 0x6a4a2a, hairStyle: "short", shirt: 0xcdbba6, coat: 0x6a5a48, trousers: 0x4a4036, boots: 0x2a2018, frame: 1.05, beard: true },
    stops: [{ x: -2.6, z: -6.2, wait: 6, act: "none", face: 1.2 }, { x: -16.5, z: 4.6, wait: 10, act: "gather", face: -1.6 }, { x: -10, z: 0.5, wait: 3 }],
    night: { x: -16, z: -1 },
  },
  {
    id: "v2", name: "Elspeth", role: "Villager",
    look: { skin: 0xe2c8b0, hair: 0x9a7a4a, hairStyle: "long", shirt: 0xcdbba6, coat: 0x7a4a3a, trousers: 0x5a4a3a, boots: 0x2a2018, frame: 0.92, height: 1.7 },
    stops: [{ x: 15.5, z: 14.6, wait: 9, act: "gather", face: 0 }, { x: 10.8, z: 17.2, wait: 5, act: "sweep", face: Math.PI }, { x: -1.4, z: -3.2, wait: 5, act: "talk", face: 2 }],
    night: { x: 11.2, z: 16.1 },
  },
  {
    id: "v3", name: "Old Maree", role: "Villager",
    look: { skin: 0xdcc0a8, hair: 0xcdc4b4, hairStyle: "hood", shirt: 0xa89a72, coat: 0x4a4a5a, trousers: 0x3a3a3a, boots: 0x2a2018, frame: 0.95, height: 1.62 },
    stops: [{ x: -5.6, z: 5.8, wait: 22, act: "none", face: 2.9 }, { x: -3.6, z: -3.6, wait: 6, act: "talk", face: 0.6 }],
    night: { x: -16, z: 17 },
    speed: 0.7,
  },
];

export const VOSS_NPCS: NpcDef[] = [
  {
    id: "voss", name: "Castellan Voss", role: "Harrenvale road",
    look: { skin: 0xd8b8a0, hair: 0x4a4038, hairStyle: "short", shirt: 0x6e7378, coat: 0x2a2622, coatLong: true, trousers: 0x2a2622, boots: 0x1c1916, cape: 0x2f3a4a, frame: 1.15, height: 1.88, beard: true, pin: true },
    stops: [{ x: 196, z: 2, wait: 30, act: "none", face: -Math.PI / 2 }],
    night: "stay",
  },
  {
    id: "guard1", name: "Kingdom guard", role: "Harrenvale road",
    look: { skin: 0xc8a088, hair: 0x2a2118, hairStyle: "short", shirt: 0x6e7378, coat: 0x2f3a4a, trousers: 0x2a2622, boots: 0x1c1916, frame: 1.05 },
    stops: [{ x: 197.5, z: -5, wait: 9, act: "none", face: -Math.PI / 2 }, { x: 197.5, z: -12, wait: 9, act: "none", face: -Math.PI / 2 }],
    night: "stay",
    hold: "spear",
  },
  {
    id: "guard2", name: "Kingdom guard", role: "Harrenvale road",
    look: { skin: 0xd8b8a0, hair: 0x6a4a2a, hairStyle: "short", shirt: 0x6e7378, coat: 0x2f3a4a, trousers: 0x2a2622, boots: 0x1c1916, frame: 1.0 },
    stops: [{ x: 197.5, z: 7, wait: 12, act: "none", face: -Math.PI / 2 }],
    night: "stay",
    hold: "spear",
  },
];

export class Npc {
  rig: Rig;
  poser: Poser;
  x: number;
  z: number;
  y = 0;
  yaw = 0;
  i = 0;
  wait = 0;
  phase = 0;
  speed = 0;
  talkT = 0;
  faceYaw: number | null = null;
  indoors = false;
  act: HumanAction = "none";
  private stuck = 0;
  private lastD = 0;

  constructor(public def: NpcDef, parent: THREE.Object3D) {
    this.rig = buildHuman(def.look);
    this.poser = new Poser(this.rig);
    if (def.hold) this.rig.sockets.gripR.add(weaponModel(def.hold));
    const s = def.stops[0];
    this.x = s.x;
    this.z = s.z;
    this.yaw = s.face ?? 0;
    this.wait = Math.random() * s.wait;
    parent.add(this.rig.group);
  }

  update(dt: number, t: number, night: boolean, groundAt: (x: number, z: number) => number, resolve: (x: number, z: number) => { x: number; z: number }, player: { x: number; z: number }, visible: boolean) {
    const def = this.def;
    let tx: number;
    let tz: number;
    let act: HumanAction = "none";
    let faceAt: number | undefined;
    const goHome = night && def.night && def.night !== "stay";
    if (goHome) {
      const home = def.night as { x: number; z: number };
      tx = home.x;
      tz = home.z;
    } else {
      const s = def.stops[this.i];
      tx = s.x;
      tz = s.z;
      act = s.act ?? "none";
      faceAt = s.face;
    }
    const d = Math.hypot(tx - this.x, tz - this.z);
    const dp = Math.hypot(player.x - this.x, player.z - this.z);
    let move = 0;
    if (this.talkT > 0) {
      this.talkT -= dt;
      this.faceYaw = Math.atan2(player.x - this.x, player.z - this.z);
      act = "talk";
    } else if (d > 0.35) {
      if (dp > 1.3) move = def.speed ?? 1.35;
      act = "none";
      this.faceYaw = Math.atan2(tx - this.x, tz - this.z);
    } else {
      if (goHome) this.indoors = true;
      this.faceYaw = faceAt ?? this.yaw;
      this.wait -= dt;
      if (this.wait <= 0 && !goHome) {
        this.i = (this.i + 1) % def.stops.length;
        this.wait = def.stops[this.i].wait * (0.7 + Math.random() * 0.6);
      }
      if (dp < 3.2 && act === "none") this.faceYaw = Math.atan2(player.x - this.x, player.z - this.z);
    }
    if (!goHome) this.indoors = false;
    this.act = act;
    if (move > 0) {
      if (d > this.lastD - 0.2 * dt) this.stuck += dt;
      else this.stuck = Math.max(0, this.stuck - dt);
      this.lastD = d;
      if (this.stuck > 2.5) {
        this.stuck = 0;
        if (dp > 14) {
          this.x = tx;
          this.z = tz;
        } else if (!goHome) this.i = (this.i + 1) % def.stops.length;
        else this.indoors = true;
      }
      const nx = this.x + ((tx - this.x) / d) * move * dt;
      const nz = this.z + ((tz - this.z) / d) * move * dt;
      const s = resolve(nx, nz);
      this.x = s.x;
      this.z = s.z;
    }
    this.speed += (move - this.speed) * Math.min(1, dt * 6);
    if (this.faceYaw != null) {
      const diff = Math.atan2(Math.sin(this.faceYaw - this.yaw), Math.cos(this.faceYaw - this.yaw));
      this.yaw += Math.sign(diff) * Math.min(Math.abs(diff), dt * 5);
    }
    this.phase += (this.speed / 1.15) * dt * Math.PI;
    const show = visible && !this.indoors;
    this.rig.group.visible = show;
    if (!show) return;
    this.y = groundAt(this.x, this.z);
    this.rig.group.position.set(this.x, this.y, this.z);
    this.rig.group.rotation.y = this.yaw;
    poseHuman(this.poser, { t: t + this.x, move: this.speed / 1.35, phase: this.phase, action: act, at: 0, block: false, armed: !!def.hold && act === "none" }, dt);
  }
}
