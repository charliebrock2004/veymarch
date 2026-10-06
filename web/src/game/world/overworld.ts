import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { Batch, ChunkBatch, Scatter, bushGeo, flatten, type Cullable, fernGeo, flowerGeo, grassGeo, logGeo, mushroomGeo, prep, rockGeo, rootGeo, stumpGeo, tint, treeGeo, wheatGeo, type TreeKind } from "../engine/kit";
import type { Mats } from "../engine/materials";
import { distToPolyline, fbm, rng, smoothstep } from "../engine/noise";
import { DOOR_H, buildTerrain, rawHeight, type Terrain } from "../engine/terrain";
import { bannerTex, blockTex, glowTex, shaftTex, signTex, waterNormalTex } from "../engine/textures";
import { Colliders } from "./collide";
import {
  BELL, BOUNDS, BRIDGE, CASTLE_DOOR, CLEARINGS, CREEK, GATE, HILL, IRON, PATH_EAST, PATH_MAIN, RIVER, RIVER_X, VILLAGE, VOSS,
} from "./layout";
import {
  Frame, barrel, bellFrame, bench, cabbages, cart, cottage, crate, fence, hay, lamp, palisade, put, sack, signpost, skep, smithy, stall, toyBlock, trough, well, woodpile, workbench, type Ctx, type Glow,
} from "./props";

export type NodeKind = "flint" | "wood" | "fibre" | "stone" | "copper" | "iron";
export type NodeDef = { id: string; kind: NodeKind; item: string; tier: number; seal: string | null; x: number; z: number; y: number; max: number; mesh: THREE.Object3D };

export type Deck = { minX: number; maxX: number; minZ: number; maxZ: number; y: number };

export type Overworld = {
  root: THREE.Group;
  terrain: Terrain;
  col: Colliders;
  scatters: Cullable[];
  grass: Scatter[];
  nodes: NodeDef[];
  anchors: Record<string, THREE.Vector3>;
  glows: Glow[];
  smoke: THREE.Vector3[];
  fires: THREE.Vector3[];
  lamps: THREE.Vector3[];
  shafts: THREE.Mesh[];
  water: THREE.Mesh[];
  waterMat: THREE.MeshPhongMaterial;
  decks: Deck[];
  bell: THREE.Object3D;
  gate: { doorL: THREE.Object3D; doorR: THREE.Object3D; seal: THREE.Mesh; sealMat: THREE.ShaderMaterial };
  key: THREE.Object3D;
  sails: THREE.Object3D;
  banners: THREE.Mesh[];
  toyBlocks: THREE.Mesh[];
  hazeMats: THREE.Material[];
  inRiver: (x: number, z: number) => boolean;
  groundAt: (x: number, z: number) => number;
};

export function buildOverworld(M: Mats, state: { gate: () => boolean }): Overworld {
  const root = new THREE.Group();
  root.name = "overworld";
  const terrain = buildTerrain();
  root.add(terrain.mesh);
  const col = new Colliders();
  const batch = new Batch();
  const ctx: Ctx = { batch, M, col, h: terrain.heightAt, glows: [], smoke: [], fires: [], lamps: [] };
  const anchors: Record<string, THREE.Vector3> = {};
  const r = rng(1234);
  const h = terrain.heightAt;

  // ------------------------------------------------------------ Hearthfen
  const home = cottage(ctx, -12, -13, 6.2, 4.6, Math.PI / 2 + 0.25, { roof: "thatch", doorX: 1.2, seed: 1 });
  anchors.home = home.door;
  const tanic = cottage(ctx, -11.5, 10, 7, 5, Math.PI / 2 - 0.08, { roof: "shingle", stoneGround: true, seed: 2, doorX: 0 });
  anchors.tanicDoor = tanic.door;
  cottage(ctx, -18.5, -1, 5.4, 4.4, Math.PI / 2 + 0.15, { roof: "thatch", seed: 3 });
  cottage(ctx, -19, 16.5, 6, 4.6, Math.PI / 2 + 0.55, { roof: "thatch", seed: 4 });
  const penn = cottage(ctx, 14.5, -7, 6, 4.8, -Math.PI / 2 - 0.12, { roof: "shingle", seed: 5 });
  anchors.pennDoor = penn.door;
  cottage(ctx, 20.5, 7.5, 5.2, 4.4, -Math.PI / 2 + 0.3, { roof: "thatch", seed: 6 });
  cottage(ctx, 12, 19.5, 5.6, 4.4, Math.PI + 0.2, { roof: "thatch", seed: 8 });
  cottage(ctx, -8.5, 23, 4.2, 3.8, Math.PI - 0.4, { roof: "shingle", seed: 9, chimney: false });
  const forge = smithy(ctx, 10.5, 7.5, -Math.PI / 2);
  anchors.anvil = forge.anvil;
  anchors.forge = new THREE.Vector3(10.0, 0, 5.9);
  workbench(ctx, 6.6, 15.5, Math.PI - 0.15);
  anchors.bench = new THREE.Vector3(6.6, 0, 14.3);
  const bell = bellFrame(ctx, BELL.x - 6.5, BELL.z, 0.2);
  root.add(bell);
  anchors.bell = new THREE.Vector3(BELL.x - 6.5, 0, BELL.z);
  well(ctx, -3.6, -6);
  anchors.well = new THREE.Vector3(-3.6, 0, -6);
  stall(ctx, 6.4, -4.5, -Math.PI / 2 + 0.2);
  anchors.stall = new THREE.Vector3(4.6, 0, -4.2);
  palisade(ctx, VILLAGE.x, VILLAGE.z, VILLAGE.r, [Math.PI / 2, -Math.PI / 2, 0], 2.8);
  // yards and clutter
  woodpile(ctx, -15.6, -10.2, 0.25);
  barrel(ctx, -8.9, -9.6);
  barrel(ctx, -8.1, -10.2, 0.9, true);
  crate(ctx, -9.0, -17.2, 0.7, 0.3);
  crate(ctx, -8.3, -17.9, 0.55, 0.9);
  sack(ctx, -8.0, -16.9);
  hay(ctx, -20, -8, 0.3);
  hay(ctx, -21, -6.8, 1.2);
  cart(ctx, 24, -3.5, 1.4);
  trough(ctx, 4.2, 9.5, Math.PI / 2);
  bench(ctx, -6.2, 5.8, 0.2);
  bench(ctx, 3.8, -9.5, -0.4);
  for (const [x, z] of [[19, -12.5], [21, -14], [22.6, -11.6], [20.2, -15.8]]) skep(ctx, x, z);
  cabbages(ctx, -21, 6, 4, 5);
  cabbages(ctx, 17, 15.5, 4.5, 3.5);
  cabbages(ctx, -14.5, -21.5, 5, 3);
  fence(ctx, [[-23.5, 3], [-23.5, 9], [-18.5, 9], [-18.5, 3]]);
  fence(ctx, [[14.5, 13.4], [19.6, 13.4], [19.6, 17.8]]);
  fence(ctx, [[-17.5, -19.5], [-11.5, -19.5], [-11.5, -23.5], [-17.5, -23.5], [-17.5, -19.5]]);
  fence(ctx, [[17.5, -9.5], [24, -9.5], [24, -17.5], [17.5, -17.5]]);
  for (const [x, z] of [[3.5, -18], [-1.8, -8], [3.4, 1.5], [-1.6, 13], [3.6, 22], [8, 3.5], [22, 3.2], [-6, -2]]) lamp(ctx, x, z, Math.atan2(-x, -z));
  for (let i = 0; i < 4; i++) crate(ctx, 13.8 + (i % 2) * 0.8, 3.2 + Math.floor(i / 2) * 0.8, 0.65, i);
  barrel(ctx, 8.6, 3.1);
  sack(ctx, 9.4, 2.7);
  anchors.chest = new THREE.Vector3(-7.9, 0, -15.6);
  anchors.bed = new THREE.Vector3(-7.4, 0, -11.9);
  // bedroll and chest outside the home door
  const lf = new Frame(-7.6, h(-7.6, -12.0), -12.0, 0.25);
  put(ctx, "flat", new THREE.BoxGeometry(0.9, 0.12, 2.0), lf, 0, 0.08, 0, 0, Math.PI / 2, 0, 0x7a6a52);
  put(ctx, "flat", new THREE.BoxGeometry(0.88, 0.1, 0.6), lf, -0.7, 0.16, 0, 0, Math.PI / 2, 0, 0xcdbba6);
  const cf = new Frame(-8.3, h(-8.3, -16.0), -16.0, 0.25 + Math.PI / 2);
  put(ctx, "planksDark", new THREE.BoxGeometry(1.0, 0.6, 0.6), cf, 0, 0.3, 0);
  put(ctx, "planksDark", new THREE.CylinderGeometry(0.3, 0.3, 1.0, 10, 1, false, 0, Math.PI), cf, 0, 0.6, 0, 0, 0, Math.PI / 2);
  put(ctx, "metal", new THREE.BoxGeometry(0.16, 0.16, 0.06), cf, 0, 0.55, 0.31, 0, 0, 0, 0xb87333);
  col.box(-8.3, -16.0, 1.1, 0.7, 0.25 + Math.PI / 2);

  // signs
  const signs: [number, number, number, Parameters<typeof signTex>[0]][] = [
    [8.2, 12.6, -0.3, "anvil"], [4.2, 15.8, 0.3, "bench"], [16.6, -8.8, -1.2, "hive"], [-7.0, -9.6, 1.4, "bed"],
    [4.2, 27.6, Math.PI, "north"], [27.5, 3.4, -Math.PI / 2, "east"], [8.6, -3.2, -1.2, "trade"],
  ];
  for (const [x, z, rr, mark] of signs)
    root.add(signpost(ctx, x, z, rr, new THREE.MeshLambertMaterial({ map: signTex(mark), vertexColors: true })));

  // ------------------------------------------------------------ the forest
  const scatters: Cullable[] = [];
  const kinds: TreeKind[] = ["oak", "beech", "pine", "young"];
  const forest = new ChunkBatch(64, 180);
  const clutter = new ChunkBatch(64, 120);
  scatters.push(forest, clutter);
  const treeGeos: Record<string, ReturnType<typeof treeGeo>[]> = {};
  for (const k of kinds) treeGeos[k] = [0, 1].map((v) => treeGeo(k, v + 1));
  const sway = (k: TreeKind) => ({ from: k === "pine" ? 6 : k === "young" ? 2 : 5, scale: 10 });
  const giant = treeGeo("giant", 7);
  const radiusOf = (k: TreeKind) => (k === "oak" ? 0.7 : k === "pine" ? 0.4 : k === "beech" ? 0.3 : 0.2);

  const fernSet = new Scatter([{ geo: fernGeo(), mat: M.fern }], 64, 70);
  const bushGeos = [0, 1].map((i) => bushGeo(i + 3, 1, true));
  const rockGeos = [0, 1].map((i) => rockGeo(i + 1));
  const logG = logGeo(5, 0.42);
  const stumpG = stumpGeo(0.5, 0.6);
  const mushG = mushroomGeo(3);
  const flowerG = flowerGeo(11);
  const bushAdd = (i: number, x: number, y: number, z: number, ry: number, sc: number) => forest.add("leaf", M.foliage, bushGeos[i % 2], x, y, z, ry, sc, sc, false, { from: 0.2, scale: 5 });
  const flat = (g: THREE.BufferGeometry, x: number, y: number, z: number, ry: number, sc: number, sy = sc) => clutter.add("flat", M.clutter, g, x, y, z, ry, sc, sy);
  scatters.push(fernSet);
  const grassSets = [0, 1].map((i) => new Scatter([{ geo: grassGeo(i + 21, 14, 0.34), mat: M.grass }], 48, 55));

  const blockedForTree = (x: number, z: number) => {
    const dv = Math.hypot(x - VILLAGE.x, z - VILLAGE.z);
    if (dv < VILLAGE.r + 4) return true;
    if (x > GATE.x - 6) return true;
    if (terrain.pathAt(x, z) > 0.02) return true;
    if (Math.min(distToPolyline(x, z, PATH_MAIN), distToPolyline(x, z, PATH_EAST)) < 4.2) return true;
    if (terrain.waterAt(x, z) > 0.12) return true;
    for (const c of CLEARINGS) if (Math.hypot(x - c.x, z - c.z) < c.r) return true;
    if (Math.hypot(x - CASTLE_DOOR.x, z - CASTLE_DOOR.z) < 14) return true;
    if (Math.hypot(x - HILL.x, z - HILL.z) < 22) return true;
    if (Math.abs(x - BRIDGE.x) < 16 && Math.abs(z - BRIDGE.z) < 8) return true;
    return false;
  };

  const giants: [number, number][] = [[-26, 134], [36, 62], [-48, 66], [28, 142], [-60, 120], [56, 100]];
  for (const [x, z] of giants) {
    forest.add("leaf", M.foliage, giant.whole, x, h(x, z) - 0.6, z, r() * 6, 1, 1, true, { from: 14, scale: 12 });
    col.circle(x, z, giant.radius + 0.8);
  }

  const spacing = 6.2;
  for (let gx = BOUNDS.minX + 3; gx < GATE.x - 4; gx += spacing)
    for (let gz = BOUNDS.minZ + 3; gz < BOUNDS.maxZ - 2; gz += spacing) {
      const x = gx + (r() - 0.5) * spacing * 0.9;
      const z = gz + (r() - 0.5) * spacing * 0.9;
      if (blockedForTree(x, z)) continue;
      if (giants.some(([a, b]) => Math.hypot(a - x, b - z) < 9)) continue;
      const dv = Math.hypot(x, z);
      const dens = fbm(x * 0.03 + 5, z * 0.03 - 2, 3);
      const nearVillage = dv < 52;
      const edge = Math.min(x - BOUNDS.minX, BOUNDS.maxZ - z, z - BOUNDS.minZ);
      if (r() > 0.42 + dens * 0.55 + (edge < 25 ? 0.3 : 0)) continue;
      let k: TreeKind;
      const dh = Math.hypot(x - HILL.x, z - HILL.z);
      if (nearVillage && r() < 0.55) k = r() < 0.6 ? "young" : "beech";
      else if (edge < 22 || dh < HILL.r || r() < 0.12) k = "pine";
      else k = dens > 0.55 ? (r() < 0.3 ? "beech" : "oak") : r() < 0.55 ? "beech" : "oak";
      const tg = treeGeos[k][Math.floor(r() * 2)];
      const s = k === "young" ? 0.8 + r() * 0.5 : 0.8 + r() * 0.45;
      forest.add("leaf", M.foliage, tg.whole, x, h(x, z) - 0.15, z, r() * Math.PI * 2, s, s * (0.9 + r() * 0.25), true, sway(k));
      col.circle(x, z, radiusOf(k) * s + 0.15);
    }

  // understorey: never on the lanes, never inside the palisade
  for (let i = 0; i < 9000; i++) {
    const x = BOUNDS.minX + r() * (GATE.x - 6 - BOUNDS.minX);
    const z = BOUNDS.minZ + r() * (BOUNDS.maxZ - BOUNDS.minZ);
    const dv = Math.hypot(x, z);
    if (dv < VILLAGE.r + 3) continue;
    const path = terrain.pathAt(x, z);
    const wet = terrain.waterAt(x, z);
    if (wet > 0.35) continue;
    if (Math.abs(x - BRIDGE.x) < 18 && Math.abs(z) < 9) continue;
    const near = Math.min(distToPolyline(x, z, PATH_MAIN), distToPolyline(x, z, PATH_EAST));
    const y = h(x, z);
    const roll = r();
    if (roll < 0.56 && near > 2.6 && roll >= 0.53) {
      flat(flowerG, x, y, z, r() * 6, 0.8 + r() * 0.5);
      continue;
    }
    if (path > 0.02 || near < 3.2) continue;
    if (roll < 0.36) {
      const sc = 0.8 + r() * 0.9;
      fernSet.add(x, y - 0.05, z, r() * 6, sc);
    } else if (roll < 0.44) {
      bushAdd(i, x, y - 0.1, z, r() * 6, 0.7 + r() * 0.7);
    } else if (roll < 0.468) {
      const sc = 0.35 + r() * 0.85;
      flat(rockGeos[i % 2], x, y - 0.1 * sc, z, r() * 6, sc, sc * (0.75 + r() * 0.5));
      if (sc > 0.8) col.circle(x, z, sc * 0.75);
    } else if (roll < 0.473) {
      flat(logG, x, y + 0.3, z, r() * 6, 0.6 + r() * 0.6);
      col.circle(x, z, 0.8);
    } else if (roll < 0.479) {
      flat(stumpG, x, y - 0.05, z, r() * 6, 0.5 + r() * 0.5);
    } else if (roll < 0.53) {
      flat(mushG, x, y, z, r() * 6, 0.8 + r() * 0.8);
    }
  }
  // grass: village verges, clearings, path edges, the road
  for (let i = 0; i < 34000; i++) {
    const x = BOUNDS.minX + 10 + r() * (GATE.x - BOUNDS.minX - 14);
    const z = BOUNDS.minZ + 8 + r() * (BOUNDS.maxZ - BOUNDS.minZ - 16);
    const dv = Math.hypot(x, z);
    const path = terrain.pathAt(x, z);
    if (path > 0.25 || terrain.waterAt(x, z) > 0.3) continue;
    const near = Math.min(distToPolyline(x, z, PATH_MAIN), distToPolyline(x, z, PATH_EAST));
    let keep = dv < VILLAGE.r + 10 ? 0.75 : near < 9 ? 0.85 : 0.08;
    for (const c of CLEARINGS) if (Math.hypot(x - c.x, z - c.z) < c.r + 3) keep = 0.95;
    if (r() > keep) continue;
    if (fbm(x * 0.15, z * 0.15, 2) < 0.38) continue;
    const s = 0.75 + r() * 0.55;
    grassSets[i % 2].add(x, h(x, z) - 0.02, z, r() * 6, s, s * (0.8 + r() * 0.5));
  }

  // giant roots arching over the main path
  const roots: THREE.BufferGeometry[] = [];
  for (const [x, z, a] of [[-2.5, 92, 0.15], [3, 120, -0.2]] as const) {
    const dx = Math.cos(a) * 9;
    const dz = Math.sin(a) * 9;
    const y0 = h(x - dx, z - dz);
    const y1 = h(x + dx, z + dz);
    const g = rootGeo([
      new THREE.Vector3(x - dx, y0 - 0.5, z - dz),
      new THREE.Vector3(x - dx * 0.55, y0 + 4.2, z - dz * 0.55),
      new THREE.Vector3(x, Math.max(y0, y1) + 6.2, z),
      new THREE.Vector3(x + dx * 0.55, y1 + 4.0, z + dz * 0.55),
      new THREE.Vector3(x + dx, y1 - 0.5, z + dz),
    ], 0.75);
    roots.push(g);
    col.circle(x - dx, z - dz, 1.2);
    col.circle(x + dx, z + dz, 1.2);
  }
  for (const g of roots) batch.add("bark", M.bark, g);

  // honey light shafts
  const shafts: THREE.Mesh[] = [];
  const shaftMat = new THREE.MeshBasicMaterial({ map: shaftTex(), color: 0xffd28a, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
  const shaftGeo = new THREE.CylinderGeometry(1.8, 3.2, 22, 12, 1, true);
  shaftGeo.translate(0, 11, 0);
  {
    const parts: THREE.BufferGeometry[] = [];
    for (const [x, z] of [[18, 84], [-42, 96], [40, 114], [-26, 128], [-14, 56], [3, 66], [-4, 102], [6, 132], [12, 40], [-30, 80], [28, 98], [-8, 148]]) {
      const g = shaftGeo.clone();
      g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x, h(x, z) - 1, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.35, 0.6, 0.25)), new THREE.Vector3(1, 1, 1)));
      parts.push(g);
    }
    const merged = mergeGeometries(parts, false)!;
    const m = new THREE.Mesh(merged, shaftMat);
    m.renderOrder = 3;
    m.frustumCulled = false;
    root.add(m);
    shafts.push(m);
  }

  // footbridge over the creek on the main path
  let fbx = 0;
  let fbz = 0;
  {
    let best = 1e9;
    for (const [px, pz] of PATH_MAIN) {
      const d = distToPolyline(px, pz, CREEK);
      if (d < best) {
        best = d;
        fbx = px;
        fbz = pz;
      }
    }
  }
  const fbY = Math.max(h(fbx, fbz - 4.5), h(fbx, fbz + 4.5)) + 0.25;
  {
    const f = new Frame(fbx, fbY, fbz, 0.1);
    for (let i = 0; i < 11; i++) put(ctx, "planks", new THREE.BoxGeometry(2.4, 0.12, 0.42), f, 0, 0, -4.4 + i * 0.88, 0, 0, (i % 3) * 0.02, 0xd0c0a8);
    for (const s of [-1, 1]) {
      put(ctx, "flat", new THREE.BoxGeometry(0.18, 0.18, 9.4), f, s * 1.15, -0.15, 0, 0, 0, 0, 0x4a3f34);
      put(ctx, "flat", new THREE.BoxGeometry(0.1, 0.1, 9.0), f, s * 1.15, 0.9, 0, 0, 0, 0, 0x6e5436);
      for (let k = -2; k <= 2; k++) put(ctx, "flat", new THREE.BoxGeometry(0.12, 1.0, 0.12), f, s * 1.15, 0.4, k * 2.1, 0, 0, 0, 0x4a3f34);
    }
  }
  const decks: Deck[] = [{ minX: fbx - 1.2, maxX: fbx + 1.2, minZ: fbz - 4.6, maxZ: fbz + 4.6, y: fbY + 0.06 }];
  anchors.footbridge = new THREE.Vector3(fbx, fbY, fbz);

  // ------------------------------------------------------------ water
  const waterMat = new THREE.MeshPhongMaterial({
    color: 0x3b3a28, specular: 0xfff0d0, shininess: 90, transparent: true, opacity: 0.86, normalMap: waterNormalTex(), normalScale: new THREE.Vector2(0.6, 0.6),
  });
  waterMat.normalMap!.repeat.set(1, 6);
  const water: THREE.Mesh[] = [];
  const ribbon = (pts: [number, number][], width: (i: number) => number, depth: number) => {
    const pos: number[] = [];
    const uv: number[] = [];
    const idx: number[] = [];
    let along = 0;
    for (let i = 0; i < pts.length; i++) {
      const [x, z] = pts[i];
      const [nx, nz] = pts[Math.min(pts.length - 1, i + 1)];
      const [px, pz] = pts[Math.max(0, i - 1)];
      let tx = nx - px;
      let tz = nz - pz;
      const tl = Math.hypot(tx, tz) || 1;
      tx /= tl;
      tz /= tl;
      const w = width(i);
      const y = rawHeight(x, z) + depth;
      if (i > 0) along += Math.hypot(x - pts[i - 1][0], z - pts[i - 1][1]);
      pos.push(x - tz * w, y, z + tx * w, x + tz * w, y, z - tx * w);
      uv.push(0, along / 10, 1, along / 10);
      if (i < pts.length - 1) {
        const a = i * 2;
        idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, waterMat);
    m.receiveShadow = true;
    m.renderOrder = 2;
    root.add(m);
    water.push(m);
  };
  const creekPts = CREEK.map(([x, z]) => [x, z] as [number, number]);
  ribbon(creekPts, () => 3.2, 1.25);
  const riverPts = RIVER.map(([x, z]) => [x, z] as [number, number]);
  ribbon(riverPts, () => 9.5, 2.6);

  // Broken Kingsbridge
  const deckY = Math.max(h(RIVER_X - 11, 0), h(RIVER_X + 11, 0)) + 0.35;
  {
    const f = new Frame(RIVER_X, deckY, 0, 0);
    for (const px of [-9, -3, 3, 9]) {
      put(ctx, "stoneGrey", new THREE.BoxGeometry(2.2, 9, 3.4), f, px, -4.8, 0);
      put(ctx, "stoneGrey", new THREE.CylinderGeometry(1.2, 1.5, 9, 6), f, px, -4.8, 1.9, 0, 0, 0, 0xdddddd);
    }
    for (const [x0, x1] of [[-12, -4.2], [4.2, 12]]) {
      const w = x1 - x0;
      put(ctx, "stoneGrey", new THREE.BoxGeometry(w, 0.8, 5.2), f, (x0 + x1) / 2, -0.45, 0);
      for (const s of [-1, 1]) {
        put(ctx, "stoneGrey", new THREE.BoxGeometry(w, 0.9, 0.45), f, (x0 + x1) / 2, 0.4, s * 2.45);
        col.box(RIVER_X + (x0 + x1) / 2, s * 2.55, w, 0.5, 0);
      }
    }
    // the break, patched with timber
    for (let i = 0; i < 12; i++) put(ctx, "planks", new THREE.BoxGeometry(0.62, 0.14, 4.4), f, -3.9 + i * 0.71, -0.06 - Math.sin((i / 11) * Math.PI) * 0.18, 0, 0, (i % 2) * 0.04, 0, 0xc8b8a0);
    for (const s of [-1, 1]) {
      put(ctx, "flat", new THREE.BoxGeometry(8.4, 0.08, 0.08), f, 0, 0.75, s * 2.1, 0, 0, 0, 0x8a7a5a);
      for (let k = -1; k <= 1; k++) put(ctx, "flat", new THREE.BoxGeometry(0.14, 1.1, 0.14), f, k * 3.6, 0.25, s * 2.1, 0, 0, 0, 0x4a3f34);
      col.box(RIVER_X, s * 2.25, 8.4, 0.3, 0);
    }
    put(ctx, "stoneGrey", new THREE.BoxGeometry(1.6, 1.2, 2.2), f, -1.0, -6.5, 4.5, 0.4, 0.3, 0.2);
    put(ctx, "stoneGrey", new THREE.BoxGeometry(1.4, 1.0, 1.8), f, 1.6, -6.6, -4.2, -0.3, 0.6, 0.1);
  }
  decks.push({ minX: RIVER_X - 12.5, maxX: RIVER_X + 12.5, minZ: -2.4, maxZ: 2.4, y: deckY });
  anchors.bridge = new THREE.Vector3(RIVER_X, deckY, 0);

  // ------------------------------------------------------------ the Green Gate
  const gy = h(GATE.x, 0);
  {
    const f = new Frame(GATE.x, gy, 0, 0);
    for (const s of [-1, 1]) {
      put(ctx, "stone", new THREE.BoxGeometry(6, 17, 6), f, 0, 8.0, s * 6.2);
      put(ctx, "stone", new THREE.BoxGeometry(6.8, 1.0, 6.8), f, 0, 16.6, s * 6.2);
      for (let k = 0; k < 4; k++) for (const [ax, az] of [[-3, -3], [3, -3], [-3, 3], [3, 3]]) if (k === 0) put(ctx, "stone", new THREE.BoxGeometry(1.1, 1.4, 1.1), f, ax, 17.7, s * 6.2 + az);
      put(ctx, "shingle", new THREE.ConeGeometry(4.4, 6, 4), f, 0, 21.0, s * 6.2, 0, Math.PI / 4, 0);
      col.box(GATE.x, s * 6.2, 6.4, 6.4, 0);
    }
    put(ctx, "stone", new THREE.BoxGeometry(6, 3.2, 6.4), f, 0, 11.4, 0);
    const arch = new THREE.TorusGeometry(3.2, 0.5, 6, 16, Math.PI);
    put(ctx, "stone", arch, f, 3.0, 9.6 - 3.2, 0, 0, Math.PI / 2, 0, 0xc8d0b0);
    put(ctx, "stone", arch.clone(), f, -3.0, 9.6 - 3.2, 0, 0, Math.PI / 2, 0, 0xc8d0b0);
    // the wall north and south
    for (const [z0, z1] of [[9.2, BOUNDS.maxZ + 4], [BOUNDS.minZ - 4, -9.2]]) {
      const n = Math.ceil((z1 - z0) / 12);
      for (let i = 0; i < n; i++) {
        const za = z0 + ((z1 - z0) * i) / n;
        const zb = z0 + ((z1 - z0) * (i + 1)) / n;
        const zm = (za + zb) / 2;
        const yb = h(GATE.x, zm);
        const wf = new Frame(GATE.x, yb, zm, 0);
        put(ctx, "stone", new THREE.BoxGeometry(3.2, 11, zb - za + 0.2), wf, 0, 3.5, 0);
        for (let k = 0; k < (zb - za) / 2.2; k++) put(ctx, "stone", new THREE.BoxGeometry(3.4, 1.1, 1.1), wf, 0, 9.5, -(zb - za) / 2 + 0.8 + k * 2.2);
        col.box(GATE.x, zm, 3.4, zb - za + 0.4, 0);
      }
    }
  }
  const doorMat = M.planksDark;
  const mkDoor = (s: number) => {
    const pivot = new THREE.Group();
    pivot.position.set(GATE.x + 1.2, gy, s * 3.2);
    const g = prep(new THREE.BoxGeometry(0.3, 8.6, 3.2));
    const uv = g.getAttribute("uv");
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 2, uv.getY(i) * 4);
    const leaf = new THREE.Mesh(g, doorMat);
    leaf.position.set(0, 4.3, -s * 1.6);
    leaf.castShadow = true;
    pivot.add(leaf);
    for (const y of [1.4, 4.3, 7.2]) {
      const band = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.22, 3.1), new THREE.MeshLambertMaterial({ color: 0x55595e }));
      band.position.set(0, y, -s * 1.6);
      pivot.add(band);
    }
    root.add(pivot);
    return pivot;
  };
  const doorL = mkDoor(1);
  const doorR = mkDoor(-1);
  doorL.rotation.y = -1.35;
  doorR.rotation.y = 1.35;
  const sealMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uOpen: { value: 0 } },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `
      uniform float uTime; uniform float uOpen; varying vec2 vUv;
      float h(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5); }
      float n(vec2 p){ vec2 i=floor(p); vec2 f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y); }
      void main(){
        vec2 p = vUv * vec2(4.0, 6.0);
        float w = n(p + vec2(0.0, uTime * 0.6)) * 0.6 + n(p * 2.3 - vec2(uTime * 0.4, 0.0)) * 0.4;
        float lines = smoothstep(0.46, 0.5, fract(w * 6.0)) * smoothstep(0.54, 0.5, fract(w * 6.0));
        float edge = smoothstep(0.0, 0.15, vUv.x) * smoothstep(1.0, 0.85, vUv.x) * smoothstep(1.0, 0.8, vUv.y);
        float dissolve = smoothstep(uOpen - 0.1, uOpen + 0.1, n(p * 1.7) * 0.8 + vUv.y * 0.2);
        vec3 col = mix(vec3(0.29, 0.38, 0.22), vec3(0.75, 0.86, 0.5), lines + w * 0.3);
        float a = (0.22 + lines * 0.6 + w * 0.15) * edge * dissolve;
        gl_FragColor = vec4(col * a, a);
      }`,
  });
  col.box(GATE.x, 0, 1.4, 6.8, 0, () => !state.gate(), "seal");
  const seal = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 9.4), sealMat);
  seal.position.set(GATE.x - 0.4, gy + 4.6, 0);
  seal.rotation.y = Math.PI / 2;
  seal.renderOrder = 6;
  root.add(seal);
  anchors.gate = new THREE.Vector3(GATE.x - 3, gy, 0);

  // iron vein outside the gate
  // ------------------------------------------------------------ resource nodes
  const nodes: NodeDef[] = [];
  const nodeMats = {
    flint: new THREE.MeshLambertMaterial({ vertexColors: true }),
  };
  const mkNode = (id: string, kind: NodeKind, x: number, z: number, max: number) => {
    const y = h(x, z);
    const g = new THREE.Group();
    const add = (geo: THREE.BufferGeometry, px = 0, py = 0, pz = 0, ry = 0, s = 1) => {
      const m = new THREE.Mesh(geo, nodeMats.flint);
      m.position.set(px, py, pz);
      m.rotation.y = ry;
      m.scale.setScalar(s);
      m.castShadow = true;
      m.receiveShadow = true;
      g.add(m);
      return m;
    };
    const item = { flint: "mat_flint", wood: "mat_wood", fibre: "mat_fibre", stone: "mat_stone", copper: "mat_copper", iron: "mat_iron" }[kind];
    let tier = 0;
    let seal: string | null = null;
    if (kind === "flint") {
      for (let i = 0; i < 5; i++) {
        const geo = new THREE.IcosahedronGeometry(0.28 + r() * 0.12, 0);
        geo.scale(1, 0.7, 1.2);
        tint(geo, i % 2 ? 0x2c2b2a : 0x3a3836);
        add(prep(geo), (r() - 0.5) * 0.9, 0.12, (r() - 0.5) * 0.9, r() * 6);
      }
      const chip = new THREE.IcosahedronGeometry(0.14, 0);
      tint(chip, 0xd8d0c0);
      add(prep(chip), 0.3, 0.25, 0.1);
    } else if (kind === "wood") {
      add(logGeo(3.2, 0.26), 0, 0.26, 0, r() * 6);
      for (let i = 0; i < 4; i++) {
        const st = new THREE.CylinderGeometry(0.05, 0.06, 1.2, 5);
        st.rotateZ(Math.PI / 2 - 0.2);
        tint(st, 0x6a5440);
        add(prep(st), (r() - 0.5) * 1.2, 0.08, 0.6 + (r() - 0.5) * 0.5, r() * 6);
      }
    } else if (kind === "fibre") {
      const tall = grassGeo(id.length * 7, 22, 1.2);
      const c = tall.getAttribute("color");
      for (let i = 0; i < c.count; i++) c.setXYZ(i, c.getX(i) * 1.25, c.getY(i) * 1.12, c.getZ(i) * 0.75);
      const m = new THREE.Mesh(tall, M.grass);
      m.scale.setScalar(1.4);
      g.add(m);
      const f2 = flowerGeo(id.length * 3);
      add(f2, 0.1, 0.4, 0.1);
    } else if (kind === "stone") {
      add(rockGeo(9, true, 0x9a948a), 0, 0.5, 0, r() * 6, 1.1);
    } else if (kind === "copper") {
      tier = 2;
      for (let i = 0; i < 3; i++) {
        const rg = rockGeo(20 + i, false, 0x8a6a4a);
        const c = rg.getAttribute("color");
        const p = rg.getAttribute("position");
        for (let k = 0; k < c.count; k++) {
          const vein = Math.sin(p.getX(k) * 9 + p.getY(k) * 7) > 0.6;
          if (vein) c.setXYZ(k, 0.45, 0.3, 0.12);
          else if (Math.sin(p.getZ(k) * 11) > 0.85) c.setXYZ(k, 0.25, 0.45, 0.35);
        }
        add(rg, (i - 1) * 0.55, 0.25, (r() - 0.5) * 0.5, r() * 6, 0.45 + r() * 0.15);
      }
    } else {
      tier = 4;
      seal = "seal_cookie";
      const rg = rockGeo(41, false, 0x4a4c50);
      const c = rg.getAttribute("color");
      const p = rg.getAttribute("position");
      for (let k = 0; k < c.count; k++) if (Math.sin(p.getX(k) * 6 - p.getY(k) * 8) > 0.7) c.setXYZ(k, 0.32, 0.36, 0.42);
      add(rg, 0, 0.8, 0, 0, 1.6);
    }
    const baked = flatten(g, nodeMats.flint);
    baked.castShadow = true;
    baked.receiveShadow = true;
    const holder = new THREE.Group();
    holder.add(baked);
    holder.position.set(x, y, z);
    root.add(holder);
    const gNode = holder;
    col.circle(x, z, kind === "stone" ? 1.0 : kind === "iron" ? 1.6 : kind === "fibre" ? 0.2 : 0.5);
    nodes.push({ id, kind, item, tier, seal, x, z, y, max, mesh: gNode });
  };
  const creekAt = (x: number, off: number): [number, number] => {
    let best: [number, number] = [x, 45];
    let bd = 1e9;
    for (const [cx, cz] of CREEK) {
      const d = Math.abs(cx - x);
      if (d < bd) {
        bd = d;
        best = [cx, cz + off];
      }
    }
    return best;
  };
  const flintSpots = [creekAt(-6, -3.2), creekAt(13, 3.4), creekAt(-24, -3.4), creekAt(30, -3.2)];
  flintSpots.forEach(([x, z], i) => mkNode("flint_" + i, "flint", x, z, 3));
  for (const [i, [x, z]] of ([[-9, 35], [10.5, 37], [-13, 61], [21, 67], [-6.5, 88]] as [number, number][]).entries()) mkNode("wood_" + i, "wood", x, z, 3);
  for (const [i, [x, z]] of ([[-6.5, 31.5], [-16, 52], [11, 76], [25, 92], [-30, 102], [8, 24]] as [number, number][]).entries()) mkNode("fibre_" + i, "fibre", x, z, 3);
  for (const [i, [x, z]] of ([[15, 55], [-25, 75], [35, 121]] as [number, number][]).entries()) mkNode("stone_" + i, "stone", x, z, 3);
  const copperSpots = [creekAt(0, 2.3), creekAt(-31, 2.8), creekAt(22, -2.9), creekAt(46, 3)];
  copperSpots.forEach(([x, z], i) => mkNode("copper_" + i, "copper", x, z, 3));
  mkNode("iron_0", "iron", IRON.x, IRON.z, 4);
  mkNode("iron_1", "iron", IRON.x - 3, IRON.z + 30, 4);

  // ------------------------------------------------------------ forest landmarks
  // shrine ruin
  {
    const c = CLEARINGS[2];
    const f = new Frame(c.x, h(c.x, c.z), c.z, 0.5);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const hh = [4.2, 2.1, 3.6, 1.2, 4.4, 2.6][i];
      put(ctx, "stone", new THREE.CylinderGeometry(0.42, 0.5, hh, 8), f, Math.cos(a) * 4.5, hh / 2 - 0.2, Math.sin(a) * 4.5, 0, 0, (i % 2) * 0.06);
      col.circle(f.at(Math.cos(a) * 4.5, 0, Math.sin(a) * 4.5).x, f.at(Math.cos(a) * 4.5, 0, Math.sin(a) * 4.5).z, 0.55);
    }
    put(ctx, "stone", new THREE.BoxGeometry(7.4, 0.5, 0.9), f, 0, 4.5, -2.25, 0, 0, 0.08);
    put(ctx, "stone", new THREE.BoxGeometry(1.6, 1.0, 1.0), f, 0, 0.4, 0);
    put(ctx, "stone", new THREE.BoxGeometry(2.2, 0.2, 1.4), f, 0, 0.95, 0);
    put(ctx, "flat", new THREE.CylinderGeometry(0.12, 0.12, 0.25, 8), f, 0.5, 1.15, 0, 0, 0, 0, 0xe4d7c3);
    col.box(c.x, c.z, 2.2, 1.4, 0.5);
    anchors.shrine = f.at(0, 0, 1.6);
    const fp = f.at(0.5, 1.4, 0);
    ctx.glows.push({ x: fp.x, y: fp.y, z: fp.z, size: 3, color: 0xffc070 });
    ctx.fires.push(fp);
  }
  // giant tree hollow with a cache
  {
    const [x, z] = giants[0];
    anchors.hollow = new THREE.Vector3(x + 4.6, 0, z - 3.2);
    const f = new Frame(x + 4.6, h(x + 4.6, z - 3.2), z - 3.2, 0.9);
    put(ctx, "planksDark", new THREE.BoxGeometry(0.9, 0.55, 0.55), f, 0, 0.28, 0);
    put(ctx, "metal", new THREE.BoxGeometry(0.15, 0.15, 0.06), f, 0, 0.45, 0.29, 0, 0, 0, 0xb87333);
    col.box(x + 4.6, z - 3.2, 1.0, 0.7, 0.9);
  }
  // goblin stilt camp
  {
    const c = CLEARINGS[1];
    for (const [ox, oz, rr] of [[-5, 4, 0.4], [5, 5, -0.6], [0, -6, 1.6]]) {
      const x = c.x + ox;
      const z = c.z + oz;
      const f = new Frame(x, h(x, z), z, rr);
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) put(ctx, "bark", new THREE.CylinderGeometry(0.12, 0.15, 3.0, 5), f, sx * 1.3, 1.4, sz * 1.1, sx * 0.05, 0, sz * 0.05);
      put(ctx, "planks", new THREE.BoxGeometry(3.0, 0.15, 2.6), f, 0, 2.6, 0);
      put(ctx, "thatch", new THREE.ConeGeometry(2.4, 2.4, 6), f, 0, 4.0, 0, 0, 0.3, 0, 0x9a8a6a);
      put(ctx, "flat", new THREE.BoxGeometry(1.8, 1.0, 0.04), f, 0, 3.1, 1.32, 0, 0, 0.05, 0x8e6a5a);
      put(ctx, "planks", new THREE.BoxGeometry(0.5, 0.06, 2.6), f, 0, 1.3, 2.3, 0.9, 0, 0);
      col.box(x, z, 3.0, 2.6, rr);
    }
    const f = new Frame(c.x, h(c.x, c.z), c.z, 0);
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      put(ctx, "stoneDark", new THREE.IcosahedronGeometry(0.28, 0), f, Math.cos(a) * 0.9, 0.12, Math.sin(a) * 0.9);
    }
    put(ctx, "ember", new THREE.ConeGeometry(0.45, 0.3, 6), f, 0, 0.1, 0, 0, 0, 0, 0xffffff, false);
    const fp = f.at(0, 0.6, 0);
    ctx.fires.push(fp);
    ctx.glows.push({ x: fp.x, y: fp.y, z: fp.z, size: 5, color: 0xff8a30 });
    for (const [ox, oz] of [[7, -2], [-7, -1], [2, 8]]) {
      const tf = new Frame(c.x + ox, h(c.x + ox, c.z + oz), c.z + oz, 0);
      put(ctx, "bark", new THREE.CylinderGeometry(0.08, 0.1, 2.4, 5), tf, 0, 1.2, 0);
      put(ctx, "flat", new THREE.SphereGeometry(0.22, 7, 5), tf, 0, 2.5, 0, 0, 0, 0, 0xd8ccb4);
      put(ctx, "flat", new THREE.BoxGeometry(0.8, 0.08, 0.08), tf, 0, 2.0, 0, 0, 0, 0.3, 0xd8ccb4);
      col.circle(c.x + ox, c.z + oz, 0.2);
    }
    anchors.camp = new THREE.Vector3(c.x, 0, c.z);
  }
  // a toy block that does not belong, and more of them on Cookie's hill
  const toyBlocks: THREE.Mesh[] = [];
  const blockMats = [
    new THREE.MeshLambertMaterial({ map: blockTex("A", "#8e2f2f") }),
    new THREE.MeshLambertMaterial({ map: blockTex("B", "#b5893a") }),
    new THREE.MeshLambertMaterial({ map: blockTex("C", "#cdbba6") }),
  ];
  toyBlocks.push(toyBlock(root, -3.6, h(-3.6, 121) + 0.35, 121, 1.1, [0.3, 0.6, 0.2], blockMats[0]));
  col.circle(-3.6, 121, 0.8);

  // ------------------------------------------------------------ Cookie's hill and castle
  const top = h(HILL.x, HILL.z);
  {
    const f = new Frame(HILL.x, top - 0.5, HILL.z, 0);
    const R0 = 15;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const wx = Math.cos(a) * R0;
      const wz = Math.sin(a) * R0;
      const seg = (Math.PI * 2 * R0) / 12 + 0.4;
      put(ctx, "stone", new THREE.BoxGeometry(seg, 8, 2.2), f, wx, 4, wz, 0, -a + Math.PI / 2, 0);
      put(ctx, "paint", new THREE.BoxGeometry(seg * 0.8, 2.6, 0.1), f, wx * 1.08, 5.5, wz * 1.08, 0, -a + Math.PI / 2, 0, 0xffffff, false);
      for (let k = -1; k <= 1; k++) put(ctx, "stone", new THREE.BoxGeometry(1.2, 1.1, 2.4), f, wx + Math.cos(a + Math.PI / 2) * k * 2.6, 8.5, wz + Math.sin(a + Math.PI / 2) * k * 2.6, 0, -a + Math.PI / 2, 0);
    }
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const tx = Math.cos(a) * R0;
      const tz = Math.sin(a) * R0;
      put(ctx, "stone", new THREE.CylinderGeometry(3.0, 3.4, 16, 12), f, tx, 8, tz);
      put(ctx, "paint", new THREE.CylinderGeometry(3.05, 3.05, 2.4, 12, 1, true), f, tx, 12.5, tz);
      put(ctx, "flat", new THREE.ConeGeometry(3.8, 8, 12), f, tx, 20, tz, 0, 0, 0, 0x8e2f2f);
      put(ctx, "metal", new THREE.SphereGeometry(0.45, 8, 6), f, tx, 24.3, tz, 0, 0, 0, 0xb5893a);
    }
    put(ctx, "stone", new THREE.CylinderGeometry(4.6, 5.4, 30, 14), f, 0, 15, 0);
    put(ctx, "paint", new THREE.CylinderGeometry(4.65, 4.65, 4, 14, 1, true), f, 0, 22, 0);
    put(ctx, "flat", new THREE.ConeGeometry(6, 12, 14), f, 0, 36, 0, 0, 0, 0, 0x8e2f2f);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      put(ctx, "window", new THREE.BoxGeometry(0.8, 1.6, 0.3), f, Math.cos(a) * 4.7, 18 + (i % 2) * 5, Math.sin(a) * 4.7, 0, -a + Math.PI / 2, 0);
    }
  }
  const key = new THREE.Group();
  {
    const brass = new THREE.MeshPhongMaterial({ color: 0xb5893a, shininess: 80, specular: 0x886633 });
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 6, 10), brass);
    shaft.position.y = 3;
    key.add(shaft);
    for (const s of [-1, 1]) {
      const loop = new THREE.Mesh(new THREE.TorusGeometry(2.4, 0.55, 8, 20), brass);
      loop.position.set(s * 2.6, 7.2, 0);
      key.add(loop);
    }
    key.position.set(HILL.x, top - 0.5 + 41, HILL.z);
    key.traverse((o) => ((o as THREE.Mesh).castShadow = true));
    root.add(key);
  }
  for (const [x, z, s, m] of [[-14, 172, 2.4, 0], [12, 176, 3.0, 1], [-20, 186, 3.6, 2], [18, 196, 2.8, 0], [7, 170, 1.6, 2], [-9, 168, 1.4, 1]] as [number, number, number, number][]) {
    toyBlocks.push(toyBlock(root, x, h(x, z) + s * 0.25, z, s, [0.2 * s, x, 0.15], blockMats[m]));
    col.circle(x, z, s * 0.7);
  }
  // gatehouse at the castle door
  {
    const f = new Frame(CASTLE_DOOR.x, DOOR_H - 0.3, CASTLE_DOOR.z, 0);
    put(ctx, "stone", new THREE.BoxGeometry(16, 9, 4), f, 0, 4.5, 3.2);
    for (const s of [-1, 1]) {
      put(ctx, "stone", new THREE.BoxGeometry(3.6, 12, 4.4), f, s * 4.4, 6, 2.2);
      put(ctx, "flat", new THREE.ConeGeometry(2.9, 4.5, 4), f, s * 4.4, 14.2, 2.2, 0, Math.PI / 4, 0, 0x8e2f2f);
      col.box(CASTLE_DOOR.x + s * 4.4, CASTLE_DOOR.z + 2.2, 3.8, 4.6, 0);
    }
    put(ctx, "paint", new THREE.BoxGeometry(4.6, 6.2, 0.4), f, 0, 3.1, 0.1);
    put(ctx, "stone", new THREE.TorusGeometry(2.6, 0.45, 6, 14, Math.PI), f, 0, 5.4, -0.05, 0, 0, 0);
    for (let k = 0; k < 4; k++) for (const s of [-1, 1]) put(ctx, "metal", new THREE.SphereGeometry(0.13, 6, 5), f, s * 1.1, 1 + k * 1.3, -0.15, 0, 0, 0, 0xb5893a, false);
    for (const s of [-1, 1]) {
      const lp = f.at(s * 3.0, 4.2, -0.5);
      ctx.glows.push({ x: lp.x, y: lp.y, z: lp.z, size: 4, color: 0xffb060 });
      ctx.lamps.push(lp);
      put(ctx, "window", new THREE.BoxGeometry(0.4, 0.5, 0.4), f, s * 3.0, 4.2, -0.5);
    }
    for (let i = 0; i < 4; i++) put(ctx, "stone", new THREE.BoxGeometry(5, 0.3, 1.2), f, 0, -0.35 - i * 0.3, -0.8 - i * 1.0);
    col.box(CASTLE_DOOR.x, CASTLE_DOOR.z + 3.6, 16, 4.4, 0);
    anchors.castleDoor = new THREE.Vector3(CASTLE_DOOR.x, DOOR_H, CASTLE_DOOR.z - 1.5);
  }

  // ------------------------------------------------------------ the Kingdom beyond
  const wheatSet = new Scatter([{ geo: wheatGeo(), mat: M.wheat }], 64, 140);
  const hedgeG = bushGeo(91, 1.2, true);
  const kTree = treeGeo("oak", 12);
  scatters.push(wheatSet);
  const plotWheat = (x: number, z: number) => {
    const plot = Math.floor((x - 110) / 24) * 7 + Math.floor((z + 200) / 19) * 13;
    return Math.abs((Math.sin(plot * 12.9898) * 43758.5453) % 1) > 0.45;
  };
  for (let i = 0; i < 9000; i++) {
    const x = GATE.x + 6 + r() * (236 - GATE.x - 8);
    const z = -70 + r() * 140;
    if (terrain.pathAt(x, z) > 0.05 || Math.abs(z) < 4) continue;
    const fx = ((x - 110) % 24 + 24) % 24;
    const fz = ((z + 200) % 19 + 19) % 19;
    if (fx < 1.2 || fz < 1.2) {
      if (r() < 0.1) forest.add("leaf", M.foliage, hedgeG, x, h(x, z) - 0.2, z, r() * 6, 0.9 + r() * 0.5, 0.9 + r() * 0.5, false, { from: 0.2, scale: 5 });
      continue;
    }
    if (plotWheat(x, z)) wheatSet.add(x, h(x, z) - 0.05, z, r() * 6, 0.9 + r() * 0.35, 0.85 + r() * 0.4);
    else if (r() < 0.25) grassSets[i % 2].add(x, h(x, z) - 0.02, z, r() * 6, 1, 1);
  }
  // farm fields along the road to the Kingsbridge
  for (let i = 0; i < 2600; i++) {
    const x = 38 + r() * 30;
    const side = r() < 0.5 ? -1 : 1;
    const z = side * (6.5 + r() * 16);
    if (terrain.pathAt(x, z) > 0.02 || terrain.waterAt(x, z) > 0.1) continue;
    if ((x > 50 && x < 51.5) || Math.abs(Math.abs(z) - 14.5) < 0.8) continue;
    wheatSet.add(x, h(x, z) - 0.05, z, r() * 6, 0.85 + r() * 0.3, 0.8 + r() * 0.35);
  }
  fence(ctx, [[37, 5.2], [69, 5.2]]);
  fence(ctx, [[37, -5.6], [69, -5.6]]);
  cottage(ctx, 46, 29, 7.5, 5.5, Math.PI + 0.1, { roof: "thatch", seed: 41 });
  hay(ctx, 55, 25, 0.4);
  hay(ctx, 56.5, 26.2, 1.1);
  cart(ctx, 60, 27, 0.8);
  {
    const f = new Frame(58, h(58, -16), -16, 0.3);
    put(ctx, "flat", new THREE.BoxGeometry(0.12, 2.4, 0.12), f, 0, 1.2, 0, 0, 0, 0, 0x5b4632);
    put(ctx, "flat", new THREE.BoxGeometry(1.5, 0.1, 0.1), f, 0, 1.85, 0, 0, 0, 0, 0x5b4632);
    put(ctx, "flat", new THREE.BoxGeometry(0.7, 0.8, 0.3), f, 0, 1.55, 0, 0, 0, 0.05, 0x8a7a5a);
    put(ctx, "flat", new THREE.SphereGeometry(0.22, 8, 6), f, 0, 2.2, 0, 0, 0, 0, 0xcdbba6);
    put(ctx, "thatch", new THREE.ConeGeometry(0.4, 0.3, 8), f, 0, 2.45, 0, 0, 0, 0, 0xffe0b0);
    col.circle(58, -16, 0.3);
  }
  root.add(signpost(ctx, 70, 3.4, -Math.PI / 2, new THREE.MeshLambertMaterial({ map: signTex("east"), vertexColors: true })));
  for (let i = 0; i < 40; i++) {
    const x = GATE.x + 10 + r() * 125;
    const z = (r() < 0.5 ? -1 : 1) * (14 + r() * 56);
    forest.add("leaf", M.foliage, kTree.whole, x, h(x, z) - 0.2, z, r() * 6, 0.9 + r() * 0.4, 0.9 + r() * 0.4, true, { from: 5, scale: 10 });
    col.circle(x, z, 0.8);
  }
  cottage(ctx, 132, -22, 7, 5, 0.3, { roof: "thatch", seed: 31 });
  cottage(ctx, 150, 24, 6, 5, -0.4, { roof: "thatch", seed: 32 });
  cottage(ctx, 156, 30, 9, 6, -0.4, { roof: "shingle", seed: 33, chimney: false, h: 3.4 });
  const sails = new THREE.Group();
  {
    const wx = 168;
    const wz = -34;
    const f = new Frame(wx, h(wx, wz), wz, 0.6);
    put(ctx, "stone", new THREE.CylinderGeometry(2.4, 3.4, 11, 12), f, 0, 5.5, 0);
    put(ctx, "thatch", new THREE.ConeGeometry(3.0, 3.4, 12), f, 0, 12.6, 0, 0, 0, 0, 0xd8c8a0);
    col.circle(wx, wz, 3.4);
    for (let i = 0; i < 4; i++) {
      const arm = new THREE.Group();
      const spar = new THREE.Mesh(new THREE.BoxGeometry(0.25, 7.5, 0.18), new THREE.MeshLambertMaterial({ color: 0x5b4632 }));
      spar.position.y = 3.75;
      const cloth = new THREE.Mesh(new THREE.BoxGeometry(1.6, 5.6, 0.05), new THREE.MeshLambertMaterial({ color: 0xcdbba6 }));
      cloth.position.set(0.9, 4.4, 0);
      arm.add(spar, cloth);
      arm.rotation.z = (i / 4) * Math.PI * 2;
      sails.add(arm);
    }
    sails.position.copy(f.at(0, 10.5, 3.3));
    sails.rotation.y = 0.6;
    root.add(sails);
  }
  // Voss's checkpoint
  const banners: THREE.Mesh[] = [];
  {
    const bx = VOSS.x + 4;
    const bMat = new THREE.MeshLambertMaterial({ map: bannerTex(), side: THREE.DoubleSide });
    for (let z = -60; z <= 60; z += 3.2) {
      if (Math.abs(z) < 1) continue;
      const f = new Frame(bx, h(bx, z), z, 0);
      put(ctx, "bark", new THREE.CylinderGeometry(0.12, 0.12, 3.4, 5), f, 0, 0.9, 0, 0.7, 0, 0);
      put(ctx, "bark", new THREE.CylinderGeometry(0.12, 0.12, 3.4, 5), f, 0, 0.9, 0, -0.7, 0, 0);
    }
    col.box(bx, 0, 1.6, 140, 0);
    for (const z of [-5, 5]) {
      const f = new Frame(bx - 1.5, h(bx - 1.5, z), z, 0);
      put(ctx, "flat", new THREE.BoxGeometry(0.16, 6, 0.16), f, 0, 3, 0, 0, 0, 0, 0x3c342c);
      const b = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 2.8, 1, 6), bMat);
      b.position.copy(f.at(0, 4.4, 0.75));
      b.rotation.y = -Math.PI / 2;
      b.castShadow = true;
      root.add(b);
      banners.push(b);
    }
    const tf = new Frame(bx - 6, h(bx - 6, 9), 9, 0.3);
    put(ctx, "flat", new THREE.ConeGeometry(2.6, 3.2, 8), tf, 0, 1.6, 0, 0, 0, 0, 0xcdbba6);
    col.circle(bx - 6, 9, 2.4);
    const br = new Frame(bx - 3, h(bx - 3, -3.5), -3.5, 0);
    put(ctx, "metal", new THREE.CylinderGeometry(0.5, 0.25, 0.6, 8), br, 0, 0.9, 0, 0, 0, 0, 0x3a3a3a);
    put(ctx, "flat", new THREE.CylinderGeometry(0.06, 0.06, 0.9, 5), br, 0, 0.3, 0, 0, 0, 0, 0x3a3a3a);
    put(ctx, "ember", new THREE.ConeGeometry(0.4, 0.4, 6), br, 0, 1.3, 0, 0, 0, 0, 0xffffff, false);
    const fp = br.at(0, 1.5, 0);
    ctx.fires.push(fp);
    ctx.glows.push({ x: fp.x, y: fp.y, z: fp.z, size: 5, color: 0xff9040 });
    col.circle(bx - 3, -3.5, 0.6);
    anchors.voss = new THREE.Vector3(VOSS.x, 0, VOSS.z);
  }

  // distant Harrenvale and the Royal Fortress: impostors, pre-hazed, not fogged
  const hazeMats: THREE.Material[] = [];
  {
    const far = new THREE.Group();
    const haze = (hex: number, k = 0.45) => {
      const c = new THREE.Color(hex).lerp(new THREE.Color(0xb8c0c8), k);
      const m = new THREE.MeshLambertMaterial({ color: c, fog: false });
      hazeMats.push(m);
      return m;
    };
    const hill = new THREE.Mesh(new THREE.SphereGeometry(80, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2), haze(0x6e7a4a, 0.5));
    hill.scale.set(1.3, 0.35, 1);
    hill.position.set(380, -4, 30);
    far.add(hill);
    const wallR = 46;
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      const w = new THREE.Mesh(new THREE.BoxGeometry(13, 9, 2.5), haze(0xd8ccb8, 0.4));
      w.position.set(380 + Math.cos(a) * wallR * 1.3, 24 + Math.sin(a * 2) * 1.5, 30 + Math.sin(a) * wallR);
      w.rotation.y = -a + Math.PI / 2;
      far.add(w);
      if (i % 3 === 0) {
        const t = new THREE.Mesh(new THREE.CylinderGeometry(3, 3.4, 16, 8), haze(0xd8ccb8, 0.4));
        t.position.set(w.position.x, 28, w.position.z);
        far.add(t);
        const c = new THREE.Mesh(new THREE.ConeGeometry(3.8, 6, 8), haze(0x3c4458, 0.35));
        c.position.set(w.position.x, 39, w.position.z);
        far.add(c);
      }
    }
    const rr = rng(55);
    for (let i = 0; i < 70; i++) {
      const a = rr() * Math.PI * 2;
      const d = rr() * 40;
      const x = 380 + Math.cos(a) * d * 1.2;
      const z = 30 + Math.sin(a) * d;
      const hgt = 4 + rr() * 5;
      const b = new THREE.Mesh(new THREE.BoxGeometry(5 + rr() * 4, hgt, 5 + rr() * 4), haze(0xd0c4b0, 0.42));
      b.position.set(x, 24 + hgt / 2 + (40 - d) * 0.15, z);
      b.rotation.y = rr() * 3;
      far.add(b);
      const roof = new THREE.Mesh(new THREE.ConeGeometry(4.2, 3.5, 4), haze(rr() < 0.5 ? 0x4a3a30 : 0x3c4458, 0.4));
      roof.position.set(x, b.position.y + hgt / 2 + 1.6, z);
      roof.rotation.y = b.rotation.y + Math.PI / 4;
      far.add(roof);
    }
    const cath = new THREE.Mesh(new THREE.BoxGeometry(10, 26, 24), haze(0xe0d4c0, 0.38));
    cath.position.set(372, 40, 22);
    far.add(cath);
    const spire = new THREE.Mesh(new THREE.ConeGeometry(4, 30, 6), haze(0x3c4458, 0.35));
    spire.position.set(372, 68, 12);
    far.add(spire);
    const fortHill = new THREE.Mesh(new THREE.SphereGeometry(50, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2), haze(0x5e6a44, 0.5));
    fortHill.scale.set(1, 0.9, 1);
    fortHill.position.set(430, 0, 95);
    far.add(fortHill);
    const keep = new THREE.Mesh(new THREE.BoxGeometry(30, 46, 26), haze(0x9a9488, 0.42));
    keep.position.set(430, 66, 95);
    far.add(keep);
    for (const [ox, oz] of [[-17, -15], [17, -15], [-17, 15], [17, 15]]) {
      const t = new THREE.Mesh(new THREE.CylinderGeometry(5, 5.6, 62, 10), haze(0x9a9488, 0.42));
      t.position.set(430 + ox, 72, 95 + oz);
      far.add(t);
      const c = new THREE.Mesh(new THREE.ConeGeometry(6.4, 12, 10), haze(0x2a3040, 0.35));
      c.position.set(430 + ox, 109, 95 + oz);
      far.add(c);
    }
    // mountains: the Frostlands tooth to the north, low ranges east
    const mountain = (x: number, z: number, rad: number, hh: number, snow: boolean, seed: number) => {
      const g = new THREE.ConeGeometry(rad, hh, 28, 6);
      const pos = g.getAttribute("position");
      const rr = rng(seed);
      const bumps = [rr() * 6, rr() * 6, rr() * 6];
      for (let k = 0; k < pos.count; k++) {
        const px = pos.getX(k);
        const py = pos.getY(k);
        const pz = pos.getZ(k);
        const a = Math.atan2(pz, px);
        const t = (py + hh / 2) / hh;
        const n = 1 + 0.18 * Math.sin(a * 3 + bumps[0]) + 0.1 * Math.sin(a * 7 + bumps[1]) + 0.06 * Math.sin(a * 13 + bumps[2]);
        pos.setXYZ(k, px * n, py + Math.sin(a * 5 + bumps[1]) * hh * 0.04 * (1 - t), pz * n);
      }
      g.computeVertexNormals();
      const c = new THREE.Color();
      const rock = new THREE.Color(snow ? 0x7d8698 : 0x5e6a52).lerp(new THREE.Color(0xc0c8d0), 0.68);
      const ice = new THREE.Color(0xf0f0f2).lerp(new THREE.Color(0xc8d0d8), 0.35);
      const cols = new Float32Array(pos.count * 3);
      for (let k = 0; k < pos.count; k++) {
        const t = (pos.getY(k) + hh / 2) / hh;
        c.copy(rock);
        if (snow) c.lerp(ice, smoothstep(0.55, 0.7, t + Math.sin(pos.getX(k) * 0.05) * 0.06));
        cols.set([c.r, c.g, c.b], k * 3);
      }
      g.setAttribute("color", new THREE.BufferAttribute(cols, 3));
      const m = new THREE.MeshLambertMaterial({ vertexColors: true, fog: false });
      hazeMats.push(m);
      const mesh = new THREE.Mesh(g, m);
      mesh.position.set(x, hh / 2 - 70, z);
      far.add(mesh);
    };
    mountain(60, 760, 220, 300, true, 1);
    mountain(-260, 700, 180, 210, true, 2);
    mountain(320, 680, 200, 230, true, 3);
    mountain(-80, 820, 160, 190, true, 4);
    mountain(640, -180, 240, 110, false, 5);
    mountain(620, 320, 220, 130, false, 6);
    // a dark ring of distant forest hills so the horizon is never a cut edge
    const ring = new THREE.Group();
    const rrr = rng(99);
    for (let i = 0; i < 46; i++) {
      const a = (i / 46) * Math.PI * 2;
      const d = 360 + rrr() * 160;
      const x = 60 + Math.cos(a) * d;
      const z = 70 + Math.sin(a) * d;
      if (x > 300 && Math.abs(z - 60) < 160) continue;
      const m = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), haze(0x2e3a26, 0.5));
      m.scale.set(70 + rrr() * 60, 26 + rrr() * 30, 70 + rrr() * 60);
      m.position.set(x, -6, z);
      ring.add(m);
    }
    far.add(ring);
    const farMat = new THREE.MeshLambertMaterial({ vertexColors: true, fog: false });
    hazeMats.push(farMat);
    const baked = flatten(far, farMat);
    baked.name = "far";
    baked.frustumCulled = false;
    root.add(baked);
  }

  // ------------------------------------------------------------ finish
  for (const s of scatters) (s as Scatter | ChunkBatch).build(root);
  for (const s of grassSets) s.build(root);
  batch.build(root);

  const inRiver = (x: number, z: number) => {
    if (Math.abs(x - RIVER_X) > 14) return false;
    for (const d of decks) if (x >= d.minX && x <= d.maxX && z >= d.minZ && z <= d.maxZ) return false;
    return distToPolyline(x, z, RIVER) < 6.2;
  };
  const groundAt = (x: number, z: number) => {
    let y = terrain.heightAt(x, z);
    for (const d of decks) if (x >= d.minX && x <= d.maxX && z >= d.minZ && z <= d.maxZ) y = Math.max(y, d.y);
    return y;
  };
  void glowTex;
  void smoothstep;
  return {
    root, terrain, col, scatters, grass: grassSets, nodes, anchors,
    glows: ctx.glows, smoke: ctx.smoke, fires: ctx.fires, lamps: ctx.lamps,
    shafts, water, waterMat, decks, bell, gate: { doorL, doorR, seal, sealMat }, key, sails, banners, toyBlocks, hazeMats,
    inRiver, groundAt,
  };
}

