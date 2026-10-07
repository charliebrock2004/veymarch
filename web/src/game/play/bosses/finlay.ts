import * as THREE from "three";
import { BOSSES } from "../../data/bosses.ts";
import { ZONES } from "../../data/zones.ts";
import type { Boss, BossEnv } from "../bossapi";
import type { Mob } from "../mobs";

/** Finlay (placeholder until the full fight lands): stands in the arena and never wakes. */
class FinlayStub implements Boss {
  readonly def = BOSSES.finlay;
  readonly phaseNames = ["", "", "", ""];
  x = ZONES[this.def.zone].ox + this.def.x;
  y = 0;
  z = this.def.z;
  yaw = Math.PI;
  hp = this.def.hp;
  max = this.def.hp;
  st = "dormant";
  phaseN = 1;
  puppet = false;
  readonly adds: Mob[] = [];
  private mesh: THREE.Mesh;
  constructor(_env: BossEnv, parent: THREE.Object3D) {
    this.mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1.4, 2), new THREE.MeshLambertMaterial({ color: 0x1c1916 }));
    this.mesh.position.set(this.x, 0.7, this.z);
    parent.add(this.mesh);
  }
  get active() {
    return this.st !== "dormant" && this.st !== "dead";
  }
  get fighting() {
    return this.active && this.st !== "dying";
  }
  reset() {
    this.st = "dormant";
    this.hp = this.max;
  }
  setDead() {
    this.st = "dead";
    this.hp = 0;
  }
  startIntro() {}
  update() {}
  snap() {
    return { st: this.st, hp: this.hp };
  }
  applySnap() {}
  netHit(hp: number) {
    this.hp = Math.min(this.hp, hp);
  }
  canTakeHit() {
    return false;
  }
  hitFlags() {
    return { behind: false, perched: false, dizzy: false };
  }
  parry() {}
  setPuppet(on: boolean) {
    this.puppet = on;
  }
  setMax(max: number) {
    this.max = max;
    if (!this.fighting) this.hp = max;
  }
}

export function createFinlay(env: BossEnv, parent: THREE.Object3D): Boss {
  return new FinlayStub(env, parent);
}
