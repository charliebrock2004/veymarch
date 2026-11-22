import * as THREE from "three";
import { CACHE_DEFS } from "../../data/world.ts";
import { ZONES } from "../../data/zones.ts";
import { Batch, boxUV } from "../../engine/kit";
import { rng } from "../../engine/noise";
import { zoneNodes } from "../nodes";
import { Frame, put, type Ctx, type Glow } from "../props";
import type { ZoneBuild, ZoneEnv } from "../zone";

/**
 * The Dead Citadel: a gate hall, a long nave of pillars and green braziers, and the Throne of
 * Femurs in a round hall where the spectral court kneels in a slow circle around the Grave King.
 * Local coordinates: x across (0 = centre line), z from the door (0) to the back passage (138).
 */
const X = ZONES.citadel.ox;
const V3 = THREE.Vector3;
const ARENA = { x: 0, z: 112, r: 19 };
const WALL_H = 12;

const inside = (lx: number, z: number) => {
  if (z < -2 || z > 138) return false;
  if (z < 30) return Math.abs(lx) < 9;
  if (z < 94) return Math.abs(lx) < 14;
  if (z <= 130) return Math.hypot(lx - ARENA.x, z - ARENA.z) < ARENA.r - 0.6 || Math.abs(lx) < 6;
  return Math.abs(lx) < 4;
};

export function buildCitadel(env: ZoneEnv): ZoneBuild {
  const { M, col } = env;
  const root = new THREE.Group();
  root.name = "citadel";
  const r = rng(15015);
  const groundAt = () => 0;
  const blocked = (x: number, z: number) => !inside(x - X, z);
  const ceiling = () => WALL_H;

  const batch = new Batch();
  const glows: Glow[] = [];
  const fires: THREE.Vector3[] = [];
  const lamps: THREE.Vector3[] = [];
  const smoke: THREE.Vector3[] = [];
  const ctx: Ctx = { batch, M, col, h: groundAt, glows, smoke, fires, lamps };
  const anchors: Record<string, THREE.Vector3> = {};
  const F = (lx: number, lz: number, rot = 0, y = 0) => new Frame(X + lx, y, lz, rot);
  const STONE = 0x4a4852;

  // floor and ceiling
  put(ctx, "flagstone", boxUV(44, 0.2, 146, 3, 3), F(0, 68), 0, -0.1, 0, 0, 0, 0, 0x6a6672, false);
  put(ctx, "stoneDark", boxUV(44, 0.4, 146, 4, 4), F(0, 68), 0, WALL_H + 0.2, 0, 0, 0, 0, 0x1a1a20, false);
  // walls: a wall from (x0,z0) to (x1,z1)
  const wall = (x0: number, z0: number, x1: number, z1: number, h = WALL_H) => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    if (len < 0.01) return;
    const rot = Math.atan2(x1 - x0, z1 - z0);
    put(ctx, "stoneDark", boxUV(1.2, h, len + 0.6, 3, 3), F((x0 + x1) / 2, (z0 + z1) / 2, rot), 0, h / 2, 0, 0, 0, 0, STONE);
  };
  for (const s of [-1, 1]) {
    wall(s * 9.6, -2, s * 9.6, 30);
    wall(s * 9.6, 30, s * 14.6, 30);
    wall(s * 14.6, 30, s * 14.6, 94);
    wall(s * 14.6, 94, s * 6.6, 94);
    wall(s * 4.6, 130, s * 4.6, 138.6);
  }
  wall(-9.6, -2.6, -2.2, -2.6);
  wall(2.2, -2.6, 9.6, -2.6);
  wall(-4.6, 138.6, 4.6, 138.6);
  // the round hall: segments of a ring, open to the nave and the back passage
  const N = 28;
  for (let i = 0; i < N; i++) {
    const a0 = (i / N) * Math.PI * 2;
    const a1 = ((i + 1) / N) * Math.PI * 2;
    const x0 = ARENA.x + Math.sin(a0) * ARENA.r;
    const z0 = ARENA.z + Math.cos(a0) * ARENA.r;
    const x1 = ARENA.x + Math.sin(a1) * ARENA.r;
    const z1 = ARENA.z + Math.cos(a1) * ARENA.r;
    const mx = (x0 + x1) / 2;
    const mz = (z0 + z1) / 2;
    if ((mz < ARENA.z && Math.abs(mx) < 7) || (mz > ARENA.z && Math.abs(mx) < 5)) continue;
    wall(x0, z0, x1, z1, WALL_H + 2);
  }
  // pillars and braziers down the nave
  for (let z = 36; z <= 90; z += 9) {
    for (const s of [-1, 1]) {
      const f = F(s * 9.5, z);
      put(ctx, "stoneDark", new THREE.CylinderGeometry(0.75, 0.9, WALL_H, 8), f, 0, WALL_H / 2, 0, 0, 0, 0, 0x55535e);
      put(ctx, "stoneDark", boxUV(2.2, 0.6, 2.2), f, 0, 0.3, 0, 0, 0, 0, 0x3a3842);
      col.circle(X + s * 9.5, z, 0.95);
      // tattered banners between the pillars
      put(ctx, "flat", new THREE.PlaneGeometry(1.8, 4.2, 1, 4), F(s * 14, z + 4.5, s > 0 ? -Math.PI / 2 : Math.PI / 2), 0, 7, 0, 0, 0, 0, 0x3a1a22, false);
    }
    const b = F(((z / 9) % 2 ? 1 : -1) * 12.2, z + 4.5);
    put(ctx, "metal", new THREE.CylinderGeometry(0.55, 0.3, 0.5, 8), b, 0, 1.3, 0, 0, 0, 0, 0x3a3a34);
    put(ctx, "metal", new THREE.CylinderGeometry(0.08, 0.12, 1.1, 5), b, 0, 0.55, 0, 0, 0, 0, 0x2a2a26);
    const p = b.at(0, 1.7, 0);
    glows.push({ x: p.x, y: p.y, z: p.z, size: 3.4, color: 0x6aff9a });
    lamps.push(p.clone());
    col.circle(p.x, p.z, 0.5);
  }
  // vaulting: capitals, pointed ribs across the nave, and a rotted runner down its middle
  for (let z = 36; z <= 90; z += 9) {
    for (const s of [-1, 1]) {
      const f = F(s * 9.5, z);
      put(ctx, "stoneDark", new THREE.CylinderGeometry(1.25, 0.78, 0.8, 8), f, 0, WALL_H - 2.6, 0, 0, 0, 0, 0x4a4852);
      put(ctx, "stoneDark", new THREE.TorusGeometry(0.86, 0.1, 5, 10), f, 0, 0.75, 0, Math.PI / 2, 0, 0, 0x4a4852);
      // one half of a pointed rib, rising from the capital to meet its twin at the ridge
      put(ctx, "stoneDark", boxUV(10.1, 0.55, 0.6, 3, 3), F(0, z), s * 4.75, WALL_H - 1.9, 0, 0, 0, s * -0.3, 0x55535e, false);
      // a skull niche in the outer wall behind each bay
      const n = F(s * 13.95, z, s > 0 ? -Math.PI / 2 : Math.PI / 2);
      put(ctx, "flat", boxUV(1.3, 1.7, 0.12), n, 0, 2.3, 0, 0, 0, 0, 0x0c0c10, false);
      put(ctx, "stoneDark", boxUV(1.7, 0.22, 0.4), n, 0, 1.36, 0.1, 0, 0, 0, 0x55535e, false);
      put(ctx, "stoneDark", new THREE.TorusGeometry(0.66, 0.1, 4, 8, Math.PI), n, 0, 3.15, 0.08, 0, 0, 0, 0x55535e, false);
      for (let k = 0; k < 3; k++) put(ctx, "flat", new THREE.SphereGeometry(0.2, 7, 5), n, (k - 1) * 0.4, 1.66, 0.14, 0, 0, 0, 0xd9d0b8, false);
      put(ctx, "flat", new THREE.SphereGeometry(0.2, 7, 5), n, 0.2, 2.0, 0.14, 0, 0, 0, 0xcfc6ae, false);
    }
  }
  put(ctx, "flat", new THREE.PlaneGeometry(3.4, 60, 1, 1), F(0, 62), 0, 0.02, 0, -Math.PI / 2, 0, 0, 0x3a1218, false);
  for (const s of [-1, 1]) put(ctx, "flat", new THREE.PlaneGeometry(0.18, 60), F(s * 1.5, 62), 0, 0.03, 0, -Math.PI / 2, 0, 0, 0x8a6a2c, false);
  // a dressed plinth course and a dark cornice along the long walls
  for (const s of [-1, 1]) {
    put(ctx, "stoneDark", boxUV(0.5, 0.9, 64, 3, 3), F(s * 13.85, 62), 0, 0.45, 0, 0, 0, 0, 0x5c5a66, false);
    put(ctx, "stoneDark", boxUV(0.7, 0.5, 64, 3, 3), F(s * 13.8, 62), 0, WALL_H - 0.6, 0, 0, 0, 0, 0x34323a, false);
    put(ctx, "stoneDark", boxUV(0.4, 0.8, 32, 3, 3), F(s * 8.9, 14), 0, 0.4, 0, 0, 0, 0, 0x5c5a66, false);
  }

  // the gate hall: torches and a pair of kneeling stone kings
  for (const s of [-1, 1]) {
    for (let z = 6; z < 30; z += 8) {
      const f = F(s * 8.8, z, s > 0 ? -Math.PI / 2 : Math.PI / 2);
      put(ctx, "metal", boxUV(0.12, 0.6, 0.12), f, 0, 2.6, 0.3, 0.4, 0, 0, 0x2a2a26);
      fires.push(f.at(0, 3.0, 0.45));
    }
    const k = F(s * 6, 22, s > 0 ? -Math.PI / 2 : Math.PI / 2);
    put(ctx, "stoneGrey", boxUV(1.6, 1.0, 1.6), k, 0, 0.5, 0, 0, 0, 0, 0x6a6672);
    put(ctx, "stoneGrey", boxUV(1.0, 1.8, 0.9), k, 0, 1.9, 0, 0.3, 0, 0, 0x6a6672);
    put(ctx, "stoneGrey", new THREE.SphereGeometry(0.4, 8, 6), k, 0, 3.0, 0.3, 0, 0, 0, 0x6a6672);
    col.circle(X + s * 6, 22, 1.1);
  }
  // the Throne of Femurs
  {
    const f = F(0, 128, Math.PI);
    put(ctx, "stoneDark", boxUV(9, 1.2, 4), f, 0, 0.6, 0, 0, 0, 0, 0x3a3842);
    put(ctx, "flat", boxUV(2.4, 1.0, 1.8), f, 0, 1.7, 0.2, 0, 0, 0, 0xd8d0bc);
    for (let k = 0; k < 15; k++) {
      const a = (k / 14 - 0.5) * 2.4;
      put(ctx, "flat", new THREE.CylinderGeometry(0.12, 0.16, 4.5 + Math.cos(a) * 2, 5), f, Math.sin(a) * 1.8, 3.4, -0.8 - Math.cos(a) * 0.3, 0, 0, -a * 0.4, 0xe0d8c4);
    }
    put(ctx, "flat", new THREE.SphereGeometry(0.5, 8, 6), f, 0, 6.6, -1.0, 0, 0, 0, 0xe8e0cc);
    col.box(X, 128, 9, 4);
    const g = f.at(0, 7.5, -1);
    glows.push({ x: g.x, y: g.y, z: g.z, size: 8, color: 0x9affd0 });
  }
  // braziers ringing the arena
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    const x = ARENA.x + Math.sin(a) * (ARENA.r - 2.2);
    const z = ARENA.z + Math.cos(a) * (ARENA.r - 2.2);
    const f = F(x, z);
    put(ctx, "metal", new THREE.CylinderGeometry(0.6, 0.35, 0.6, 8), f, 0, 1.4, 0, 0, 0, 0, 0x3a3a34);
    put(ctx, "metal", new THREE.CylinderGeometry(0.1, 0.14, 1.2, 5), f, 0, 0.6, 0, 0, 0, 0, 0x2a2a26);
    fires.push(f.at(0, 1.8, 0));
    col.circle(X + x, z, 0.6);
  }
  const caches = CACHE_DEFS.filter((c) => c.zone === "citadel");
  for (const c of caches) anchors["cache_" + c.id] = new V3(X + c.x, 0, c.z);
  anchors.arrive = new V3(X, 0, 4);
  anchors.throne = new V3(X, 0, 112);
  // bones in drifts along the walls
  for (let i = 0; i < 140; i++) {
    const z = r() * 92;
    const half = z < 30 ? 8.6 : 13.6;
    const x = (r() < 0.5 ? -1 : 1) * (half - r() * 1.4);
    put(ctx, "flat", new THREE.CylinderGeometry(0.05, 0.06, 0.6 + r() * 0.4, 4), F(x, z, r() * 6), 0, 0.06, 0, Math.PI / 2, 0, 0, 0xd8d0bc, false);
  }

  batch.build(root);
  const nodes = zoneNodes(M, root, col, "citadel", groundAt);

  // the spectral court: kneeling ghosts that circle the throne room slowly
  const court = new THREE.Group();
  court.position.set(X + ARENA.x, 0, ARENA.z);
  const ghostMat = new THREE.MeshBasicMaterial({ color: 0x9ad8c8, transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending, depthWrite: false });
  const body = new THREE.CylinderGeometry(0.28, 0.5, 1.3, 7);
  const head = new THREE.SphereGeometry(0.24, 8, 6);
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    const g = new THREE.Group();
    const b = new THREE.Mesh(body, ghostMat);
    b.position.y = 0.65;
    const h = new THREE.Mesh(head, ghostMat);
    h.position.set(0, 1.45, 0.12);
    g.add(b, h);
    g.position.set(Math.sin(a) * (ARENA.r - 4), 0, Math.cos(a) * (ARENA.r - 4));
    g.rotation.y = a + Math.PI;
    court.add(g);
  }
  root.add(court);

  const regionAt = (_x: number, z: number) => (z < 30 ? "gatehall" : z < 94 ? "nave" : "throne");
  const regions: Record<string, [string, string]> = {
    gatehall: ["The Gate Hall", "Two stone kings, kneeling"],
    nave: ["The Nave of the Dead", "Green fire, and the sound of marching"],
    throne: ["The Throne of Femurs", "The court kneels. The king does not."],
  };
  const update = (_dt: number, t: number) => {
    court.rotation.y = t * 0.05;
    ghostMat.opacity = 0.22 + Math.sin(t * 1.3) * 0.08;
    court.children.forEach((g, i) => (g.position.y = Math.sin(t * 0.8 + i) * 0.15 + 0.2));
  };

  return {
    root,
    groundAt,
    blocked,
    surfaceAt: () => "stone",
    regionAt,
    regions,
    ceiling,
    fires,
    lamps,
    glows,
    smoke,
    nodes,
    anchors,
    update,
    fog: { color: 0x141820, density: 0.03 },
  };
}
