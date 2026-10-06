import * as THREE from "three";
import { Batch, boxUV, prep } from "../engine/kit";
import type { Mats } from "../engine/materials";
import { rng } from "../engine/noise";
import { blockTex } from "../engine/textures";
import type { Colliders } from "./collide";
import { DUN, DUN_X } from "./layout";
import { Frame, put, type Ctx, type Glow } from "./props";

/**
 * Cookie's Castle, inside. Painted wood in the first rooms, brass showing through deeper in
 * (art bible §20). Rooms run north along +z: entry hall, marked floor, weight hall, toy
 * gallery, then the nursery courtyard where Cookie waits, open to the sky.
 */

export type Dungeon = {
  root: THREE.Group;
  anchors: Record<string, THREE.Vector3>;
  weight: THREE.Mesh;
  plate: THREE.Mesh;
  slab: THREE.Mesh;
  nurseryDoor: THREE.Object3D;
  exitGate: THREE.Object3D;
  musicBox: THREE.Group;
  musicLid: THREE.Object3D;
  tiles: { x: number; z: number; mesh: THREE.Mesh }[];
  pillars: { x: number; z: number; r: number }[];
  glows: Glow[];
  fires: THREE.Vector3[];
};

export function buildDungeon(M: Mats, col: Colliders, state: { slab: () => boolean; nursery: () => boolean; exit: () => boolean }): Dungeon {
  const root = new THREE.Group();
  root.name = "dungeon";
  root.visible = false;
  const batch = new Batch();
  const glows: Glow[] = [];
  const fires: THREE.Vector3[] = [];
  const ctx: Ctx = { batch, M, col, h: () => 0, glows, smoke: [], fires, lamps: [] };
  const X = DUN_X;
  const H = 7.5;
  const r = rng(808);

  const floor = (x0: number, x1: number, z0: number, z1: number, key: "flagstone" | "planks" = "flagstone") => {
    const f = new Frame((x0 + x1) / 2, 0, (z0 + z1) / 2, 0);
    put(ctx, key, boxUV(x1 - x0, 0.4, z1 - z0, 3, 3), f, 0, -0.2, 0, 0, 0, 0, 0xffffff, false);
  };
  const ceiling = (x0: number, x1: number, z0: number, z1: number) => {
    const f = new Frame((x0 + x1) / 2, H, (z0 + z1) / 2, 0);
    put(ctx, "planksDark", boxUV(x1 - x0 + 1, 0.4, z1 - z0 + 1, 2, 2), f, 0, 0.2, 0, 0, 0, 0, 0x8a7a6a, false);
    for (let z = z0 + 1.5; z < z1; z += 3) put(ctx, "flat", new THREE.BoxGeometry(x1 - x0, 0.4, 0.35), new Frame((x0 + x1) / 2, H - 0.2, z, 0), 0, 0, 0, 0, 0, 0, 0x2e2620, false);
  };
  /** A wall from (x0,z0) to (x1,z1), with optional door gap of width `gap` in the middle. */
  const wall = (x0: number, z0: number, x1: number, z1: number, gap = 0, on?: () => boolean, paintUpper = true) => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const rot = Math.atan2(x1 - x0, z1 - z0) - Math.PI / 2;
    const segs: [number, number][] = gap > 0 ? [[0, (len - gap) / 2], [(len + gap) / 2, len]] : [[0, len]];
    for (const [a, b] of segs) {
      if (b - a < 0.05) continue;
      const t = (a + b) / 2 / len;
      const cx = x0 + (x1 - x0) * t;
      const cz = z0 + (z1 - z0) * t;
      const f = new Frame(cx, 0, cz, rot);
      const w = b - a;
      put(ctx, "stoneDark", boxUV(w, 1.2, 0.8, 2, 1), f, 0, 0.6, 0);
      put(ctx, "planks", boxUV(w, 1.4, 0.7, 1, 1.4), f, 0, 1.9, 0, 0, 0, 0, 0xb0a090);
      put(ctx, paintUpper ? "wallpaper" : "stone", boxUV(w, H - 2.6, 0.6, 2.5, 2.5), f, 0, 2.6 + (H - 2.6) / 2, 0);
      put(ctx, "flat", new THREE.BoxGeometry(w, 0.18, 0.8), f, 0, 2.62, 0, 0, 0, 0, 0x4a3426);
      col.box(cx, cz, w, 0.9, rot, on);
    }
  };
  const brazier = (x: number, z: number) => {
    const f = new Frame(x, 0, z, 0);
    put(ctx, "metal", new THREE.CylinderGeometry(0.55, 0.3, 0.5, 10), f, 0, 1.15, 0, 0, 0, 0, 0x4a3a2a);
    for (const a of [0, 2.1, 4.2]) put(ctx, "metal", new THREE.BoxGeometry(0.06, 1.0, 0.06), f, Math.cos(a) * 0.3, 0.5, Math.sin(a) * 0.3, Math.sin(a) * 0.3, 0, Math.cos(a) * 0.3, 0x3a3a3a);
    put(ctx, "ember", new THREE.ConeGeometry(0.42, 0.35, 7), f, 0, 1.45, 0, 0, 0, 0, 0xffffff, false);
    const p = new THREE.Vector3(x, 1.8, z);
    fires.push(p);
    glows.push({ x, y: 1.9, z, size: 6, color: 0xff8a3a });
    col.circle(x, z, 0.6);
  };
  const sconce = (x: number, z: number, face: number) => {
    const f = new Frame(x, 0, z, face);
    put(ctx, "metal", new THREE.BoxGeometry(0.1, 0.5, 0.3), f, 0, 3.6, 0.1, 0, 0, 0, 0x3a3a3a);
    put(ctx, "window", new THREE.BoxGeometry(0.22, 0.3, 0.22), f, 0, 3.95, 0.3);
    const p = f.at(0, 4.0, 0.3);
    glows.push({ x: p.x, y: p.y, z: p.z, size: 4, color: 0xffa050 });
    fires.push(p);
  };
  const blockMats = ["A", "B", "C", "D"].map((L, i) => new THREE.MeshLambertMaterial({ map: blockTex(L, ["#8e2f2f", "#b5893a", "#cdbba6", "#5e6b45"][i]) }));
  const block = (x: number, y: number, z: number, s: number, ry: number, rx = 0, solid = true) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), blockMats[Math.floor(r() * 4)]);
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, 0);
    m.castShadow = true;
    m.receiveShadow = true;
    root.add(m);
    if (solid) col.circle(x, z, s * 0.62);
    return m;
  };

  // ---------------------------------------------------------- entry hall z 0..16
  floor(X - 7, X + 7, -1, DUN.hallEnd);
  ceiling(X - 7, X + 7, -1, DUN.hallEnd);
  wall(X - 7, -1, X + 7, -1, 3.2);
  wall(X - 7, -1, X - 7, DUN.hallEnd);
  wall(X + 7, -1, X + 7, DUN.hallEnd);
  wall(X - 7, DUN.hallEnd, X - 4, DUN.hallEnd);
  wall(X + 4, DUN.hallEnd, X + 7, DUN.hallEnd);
  {
    const f = new Frame(X, 0, -1.3, 0);
    put(ctx, "paint", boxUV(3.2, 4.2, 0.2, 1, 1), f, 0, 2.1, 0);
  }
  brazier(X - 4.5, 6);
  brazier(X + 4.5, 6);
  for (const [x, z, s] of [[X - 5.2, 12, 1.4], [X + 5.6, 2.2, 1.1], [X + 5.4, 13.5, 0.8]]) block(x, s / 2, z, s, r() * 3);
  block(X - 5.5, 0.3, 2.6, 0.6, 0.6, 0.2, false);
  // ---------------------------------------------------------- marked floor z 16..36
  floor(X - 4, X + 4, DUN.trapZ0 - 2, DUN.trapZ1 + 2);
  ceiling(X - 4, X + 4, DUN.trapZ0 - 2, DUN.trapZ1 + 2);
  wall(X - 4, DUN.hallEnd, X - 4, DUN.weightZ0);
  wall(X + 4, DUN.hallEnd, X + 4, DUN.weightZ0);
  sconce(X - 3.6, 22, Math.PI / 2);
  sconce(X + 3.6, 30, -Math.PI / 2);
  const tiles: Dungeon["tiles"] = [];
  const tileMat = new THREE.MeshLambertMaterial({ color: 0x8e2f2f });
  const safe = new Set(["-2,0", "-2,1", "-1,1", "-1,2", "0,2", "0,3", "1,3", "1,4", "2,4", "2,5", "1,5", "1,6", "0,6", "0,7"]);
  for (let i = -2; i <= 2; i++)
    for (let j = 0; j < 8; j++) {
      if (safe.has(i + "," + j)) continue;
      if ((i + j) % 2 === 0 && r() < 0.35) continue;
      const x = X + i * 1.5;
      const z = DUN.trapZ0 + 0.8 + j * 2;
      const m = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.06, 1.3), tileMat);
      m.position.set(x, 0.02, z);
      m.receiveShadow = true;
      root.add(m);
      tiles.push({ x, z, mesh: m });
    }
  // ---------------------------------------------------------- weight hall z 36..58
  floor(X - 8, X + 8, DUN.weightZ0, DUN.weightZ1);
  ceiling(X - 8, X + 8, DUN.weightZ0, DUN.weightZ1);
  wall(X - 8, DUN.weightZ0, X - 4, DUN.weightZ0);
  wall(X + 4, DUN.weightZ0, X + 8, DUN.weightZ0);
  wall(X - 8, DUN.weightZ0, X - 8, DUN.weightZ1);
  wall(X + 8, DUN.weightZ0, X + 8, DUN.weightZ1);
  wall(X - 8, DUN.doorZ, X + 8, DUN.doorZ, 6);
  brazier(X - 6.4, 40);
  brazier(X + 6.4, 40);
  sconce(X - 7.6, 50, Math.PI / 2);
  sconce(X + 7.6, 50, -Math.PI / 2);
  // rails for the weight to run on
  for (const zz of [43.2, 44.8]) put(ctx, "metal", new THREE.BoxGeometry(12, 0.08, 0.12), new Frame(X, 0, zz, 0), 0, 0.04, 0, 0, 0, 0, 0x6a5a40, false);
  const brass = new THREE.MeshPhongMaterial({ color: 0xb5893a, shininess: 60, specular: 0x665533 });
  const weight = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.8, 1.8), brass);
  weight.position.set(X - 4.5, 0.9, 44);
  weight.castShadow = true;
  root.add(weight);
  {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.08, 6, 12), brass);
    ring.position.set(0, 1.1, 0);
    ring.rotation.x = Math.PI / 2;
    weight.add(ring);
  }
  const plate = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.3, 0.12, 16), new THREE.MeshLambertMaterial({ color: 0x9a7a3a }));
  plate.position.set(X + 4.5, 0.06, 44);
  plate.receiveShadow = true;
  root.add(plate);
  const slab = new THREE.Mesh(prep(boxUV(6.2, 6.2, 0.6, 2, 2)), M.planksDark);
  slab.position.set(X, 3.1, DUN.doorZ);
  slab.castShadow = true;
  root.add(slab);
  col.box(X, DUN.doorZ, 6.2, 0.8, 0, () => !state.slab());
  {
    // a chain from the plate to the slab, so the puzzle reads
    for (let i = 0; i < 18; i++) {
      const link = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.03, 4, 8), brass);
      link.position.set(X + 4.5 + Math.sin(i * 0.5) * 0.05, 0.1 + i * 0.36, 44.6 + i * 0.75);
      link.rotation.y = i % 2 ? Math.PI / 2 : 0;
      root.add(link);
    }
  }
  for (const [x, z, s] of [[X - 6.5, 55, 1.6], [X + 6.6, 37.6, 1.2], [X - 6.8, 47.5, 1.0]]) block(x, s / 2, z, s, r() * 3);
  // ---------------------------------------------------------- toy gallery z 58..82
  floor(X - 7, X + 7, DUN.doorZ, DUN.galleryZ1, "planks");
  ceiling(X - 7, X + 7, DUN.doorZ, DUN.galleryZ1);
  wall(X - 7, DUN.doorZ, X - 7, DUN.galleryZ1, 0, undefined, true);
  wall(X + 7, DUN.doorZ, X + 7, DUN.galleryZ1, 0, undefined, true);
  wall(X - 7, DUN.galleryZ1, X + 7, DUN.galleryZ1, 4.4);
  for (const s of [-1, 1]) {
    for (let k = 0; k < 3; k++) {
      const f = new Frame(X + s * 6.1, 0, 62 + k * 7, 0);
      put(ctx, "planks", boxUV(1.4, 0.12, 4, 1, 1), f, 0, 1.2, 0);
      put(ctx, "planks", boxUV(1.4, 0.12, 4, 1, 1), f, 0, 2.6, 0);
      put(ctx, "flat", new THREE.BoxGeometry(1.4, 3.2, 0.12), f, 0, 1.6, -2, 0, 0, 0, 0x4a3426);
      for (let t = 0; t < 4; t++) {
        const g = new THREE.SphereGeometry(0.18, 7, 5);
        put(ctx, "flat", g, f, 0, 1.45 + (t % 2) * 1.4, -1.4 + t * 0.9, 0, 0, 0, [0xcdbba6, 0x8e2f2f, 0xb5893a, 0x5e6b45][t]);
      }
      col.box(X + s * 6.1, 62 + k * 7, 1.6, 4.2, 0);
    }
    sconce(X + s * 6.6, 66, s > 0 ? -Math.PI / 2 : Math.PI / 2);
  }
  for (const [x, z, s] of [[X - 3.4, 77, 1.5], [X + 3.8, 63.5, 1.2], [X + 2.2, 79.4, 0.9]]) block(x, s / 2, z, s, r() * 3);
  const nurseryDoor = new THREE.Group();
  {
    const d = new THREE.Mesh(prep(boxUV(4.4, 5.2, 0.4, 1, 1)), M.paint);
    d.position.y = 2.6;
    d.castShadow = true;
    nurseryDoor.add(d);
    for (let k = 0; k < 3; k++) {
      const stud = new THREE.Mesh(new THREE.SphereGeometry(0.15, 6, 5), brass);
      stud.position.set(0, 1.2 + k * 1.4, 0.25);
      nurseryDoor.add(stud);
    }
    nurseryDoor.position.set(X, 0, DUN.galleryZ1);
    root.add(nurseryDoor);
    col.box(X, DUN.galleryZ1, 4.4, 0.8, 0, () => !state.nursery());
  }
  // passage
  floor(X - 2.4, X + 2.4, DUN.galleryZ1, DUN.arena.z - DUN.arena.r + 1, "flagstone");
  ceiling(X - 2.4, X + 2.4, DUN.galleryZ1, DUN.arena.z - DUN.arena.r + 1);
  wall(X - 2.4, DUN.galleryZ1, X - 2.4, DUN.arena.z - DUN.arena.r + 1);
  wall(X + 2.4, DUN.galleryZ1, X + 2.4, DUN.arena.z - DUN.arena.r + 1);
  // ---------------------------------------------------------- nursery courtyard
  const A = DUN.arena;
  {
    const g = new THREE.CircleGeometry(A.r + 1, 40);
    g.rotateX(-Math.PI / 2);
    const uv = g.getAttribute("uv");
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 8, uv.getY(i) * 8);
    put(ctx, "flagstone", g, new Frame(A.x, 0.01, A.z, 0), 0, 0, 0, 0, 0, 0, 0xd8c8b8, false);
    const gap = Math.asin(2.5 / A.r);
    const arcs: [number, number][] = [[-Math.PI / 2 + gap, Math.PI / 2 - gap], [Math.PI / 2 + gap, (3 * Math.PI) / 2 - gap]];
    const segs: [number, number][] = [];
    for (const [s0, s1] of arcs) {
      const n = Math.ceil((s1 - s0) / 0.3);
      for (let k = 0; k < n; k++) segs.push([s0 + ((s1 - s0) * k) / n, s0 + ((s1 - s0) * (k + 1)) / n]);
    }
    for (let i = 0; i < segs.length; i++) {
      const [a0, a1] = segs[i];
      const mid = (a0 + a1) / 2;
      const x0 = A.x + Math.cos(a0) * A.r;
      const z0 = A.z + Math.sin(a0) * A.r;
      const x1 = A.x + Math.cos(a1) * A.r;
      const z1 = A.z + Math.sin(a1) * A.r;
      const cx = (x0 + x1) / 2;
      const cz = (z0 + z1) / 2;
      const len = Math.hypot(x1 - x0, z1 - z0) + 0.3;
      const f = new Frame(cx, 0, cz, -mid + Math.PI / 2);
      put(ctx, "stone", boxUV(len, 9, 1.2, 2, 2), f, 0, 4.5, 0);
      put(ctx, "paint", boxUV(len * 0.9, 3, 0.1, 2, 1), f, 0, 4.2, -0.65);
      put(ctx, "stone", boxUV(1.0, 1.0, 1.3, 1, 1), f, len / 2 - 0.4, 9.4, 0);
      col.box(cx, cz, len, 1.4, -mid + Math.PI / 2);
      if (i % 4 === 0) {
        const p = f.at(0, 6.5, -0.9);
        glows.push({ x: p.x, y: p.y, z: p.z, size: 5, color: 0xffa050 });
        fires.push(p);
        put(ctx, "window", new THREE.BoxGeometry(0.3, 0.4, 0.3), f, 0, 6.5, -0.9);
      }
    }
    // bunting
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      const tri = new THREE.ConeGeometry(0.3, 0.6, 3);
      tri.rotateX(Math.PI);
      put(ctx, "flat", tri, new Frame(A.x + Math.cos(a) * (A.r - 0.8), 0, A.z + Math.sin(a) * (A.r - 0.8), -a), 0, 8.2 - Math.abs(Math.sin(i * 1.3)) * 0.3, 0, 0, 0, 0, i % 2 ? 0x8e2f2f : 0xcdbba6, false);
    }
  }
  const pillars: Dungeon["pillars"] = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.3;
    const x = A.x + Math.cos(a) * 9.5;
    const z = A.z + Math.sin(a) * 9.5;
    const s = 2.2 + (i % 2) * 0.6;
    block(x, s / 2, z, s, a, 0, true);
    if (i % 2 === 0) block(x + 0.2, s + 0.7, z - 0.1, 1.4, a + 0.5, 0, false);
    pillars.push({ x, z, r: s * 0.62 });
  }
  const musicBox = new THREE.Group();
  {
    const bodyMat = M.paint;
    const box = new THREE.Mesh(prep(boxUV(3.4, 2.0, 2.6, 1, 1)), bodyMat);
    box.position.y = 1.0;
    box.castShadow = true;
    box.receiveShadow = true;
    musicBox.add(box);
    const trim = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.2, 2.8), brass);
    trim.position.y = 2.0;
    musicBox.add(trim);
    const lidPivot = new THREE.Group();
    lidPivot.position.set(0, 2.05, -1.3);
    const lid = new THREE.Mesh(prep(boxUV(3.4, 0.2, 2.6, 1, 1)), bodyMat);
    lid.position.set(0, 0, 1.3);
    lidPivot.add(lid);
    lidPivot.rotation.x = -1.9;
    musicBox.add(lidPivot);
    const crank = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.1, 6, 12), brass);
    crank.position.set(1.95, 1.2, 0);
    crank.rotation.y = Math.PI / 2;
    musicBox.add(crank);
    const comb = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 2.6, 12), brass);
    comb.rotation.z = Math.PI / 2;
    comb.position.set(0, 2.2, 0);
    musicBox.add(comb);
    musicBox.position.set(A.x, 0, A.z);
    root.add(musicBox);
    col.box(A.x, A.z, 3.6, 2.8, 0);
    (musicBox as THREE.Group & { lid?: THREE.Object3D }).lid = lidPivot;
  }
  const exitGate = new THREE.Group();
  {
    const d = new THREE.Mesh(prep(boxUV(4.4, 6, 0.4, 1, 1)), M.planksDark);
    d.position.y = 3;
    exitGate.add(d);
    exitGate.position.set(A.x, 0, A.z + A.r + 0.2);
    root.add(exitGate);
    col.box(A.x, A.z + A.r + 0.2, 4.6, 1.0, 0, () => !state.exit());
    const f = new Frame(A.x, 0, A.z + A.r + 0.4, 0);
    for (const s of [-1, 1]) put(ctx, "stone", boxUV(1.4, 9, 1.4, 1, 2), f, s * 2.9, 4.5, 0);
    put(ctx, "stone", boxUV(7.2, 1.6, 1.4, 2, 1), f, 0, 8.2, 0);
  }

  batch.build(root);
  const anchors: Record<string, THREE.Vector3> = {
    entry: new THREE.Vector3(X, 0, 2.2),
    plate: plate.position.clone(),
    weightHome: weight.position.clone(),
    nurseryDoor: new THREE.Vector3(X, 0, DUN.galleryZ1 - 1.4),
    arena: new THREE.Vector3(A.x, 0, A.z),
    arenaEntry: new THREE.Vector3(A.x, 0, A.z - A.r + 2.5),
    exitGate: new THREE.Vector3(A.x, 0, A.z + A.r - 1.2),
  };
  return {
    root, anchors, weight, plate, slab, nurseryDoor, exitGate, musicBox,
    musicLid: (musicBox as THREE.Group & { lid?: THREE.Object3D }).lid!,
    tiles, pillars, glows, fires,
  };
}
