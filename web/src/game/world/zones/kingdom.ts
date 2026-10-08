import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { ChunkBatch, Batch, Scatter, boxUV, bushGeo, flowerGeo, grassGeo, logGeo, prep, rockGeo, stumpGeo, tint, treeGeo, wheatGeo, type Cullable, type TreeKind } from "../../engine/kit";
import { clamp, distToPolyline, fbm, lerp, noise2, rng, smoothPath, smoothstep } from "../../engine/noise";
import { buildFieldTerrain } from "../../engine/terrain";
import { bannerTex, signTex, waterNormalTex } from "../../engine/textures";
import { ZONES } from "../../data/zones.ts";
import { CACHE_DEFS, MOB_SPAWNS, NODE_DEFS } from "../../data/world.ts";
import { zoneNodes } from "../nodes";
import {
  Frame, barrel, bench, cabbages, cart, cottage, crate, fence, hay, lamp, put, sack, signpost, smithy, stall, trough, well, woodpile, workbench, type Ctx,
} from "../props";
import type { ZoneBuild, ZoneEnv } from "../zone";
import { KINGDOM_NPCS } from "./kingdom_npcs";

/**
 * The Medieval Kingdom: the Kingsroad out of the west, the King's fields, Harrenvale on its hill
 * inside a stone ring, the Royal Fortress glowering from the ridge behind it, Millcross and its
 * mill, the east quarry, a bandit camp on the old quarry road, the ruined beacon where deserters
 * sleep, and the causeway south into the Mire behind the Castellan's chain.
 *
 * Built in world coordinates: x = ZONES.kingdom.ox + local x, z = local z. All layout below is
 * written in local coordinates and shifted once, at the point of placement.
 */

const Z = ZONES.kingdom;
const X = Z.ox;
const B = Z.bounds;
/** how far past the play bounds the ground keeps going (so the edges are hills, not cliffs) */
const SKIRT = 40;

/** Harrenvale's curtain wall: centre-line radius, thickness, and the town floor height */
const WALL_R = 44.6;
const WALL_T = 2.4;
const TOWN_H = 6;
/** gate angles (x = r cos a, z = r sin a): west, north, south */
const GATES = [Math.PI, Math.PI / 2, -Math.PI / 2];

/** The Royal Fortress on its ridge north of town: a rounded rectangle (centre, half extents). */
const FORT = { x: -14, z: 122, hx: 20, hz: 11 };
/** the quarry pit and the hill it is cut into */
const PIT = { x: 126, z: 44, r: 20 };
const QHILL = { x: 148, z: 46 };
const BEACON = { x: 101, z: 95 };
const MILL = { x: -96, z: -60 };
const CAMP = { x: 96, z: -82 };
/** the causeway: deck half width and where the chain hangs */
const CW_HALF = 3.4;
const CHAIN_Z = -159;

// ------------------------------------------------------------------ roads (local)

const KINGSROAD = smoothPath([[-205, 0], [-160, 0.5], [-138, 2], [-112, -1.5], [-84, 1], [-62, -0.5], [-44, 0]]);
const NORTH_ROAD = smoothPath([[0, 42], [2.5, 54], [11, 70], [24, 89], [36, 111], [49, 137], [59, 158], [63, 176], [66, 210]]);
const SOUTH_ROAD = smoothPath([[0, -42], [0.6, -62], [-1.8, -86], [1.2, -108], [0, -124]]);
const QUARRY_TRACK = smoothPath([[4, 58], [28, 61], [56, 55], [82, 47], [104, 42], [116, 41]]);
const OLD_QUARRY_ROAD = smoothPath([[0.6, -66], [24, -74], [52, -79], [76, -80], [88, -80]]);
const MILL_LANE = smoothPath([[-62, -0.5], [-68, -14], [-78, -30], [-87, -43], [-93, -53]]);
const ROADS = [KINGSROAD, NORTH_ROAD, SOUTH_ROAD, QUARRY_TRACK, OLD_QUARRY_ROAD, MILL_LANE];
/** Harrenvale's streets: gate to gate through the square */
const STREETS: [number, number][][] = [[[-48, 0], [0, 0]], [[0, 0], [0, 48]], [[0, -48], [0, 0]]];

// ------------------------------------------------------------------ the King's fields

const PW = 22;
const PD = 17;
const plotIJ = (x: number, z: number): [number, number] => [Math.floor((x + 3) / PW), Math.floor((z + 5) / PD)];
const hash2 = (i: number, j: number) => {
  const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453;
  return s - Math.floor(s);
};
const WHEAT_PLOTS = new Set(NODE_DEFS.filter((d) => d.zone === "kingdom" && d.kind === "wheat" && d.x !== undefined && d.z !== undefined).map((d) => plotIJ(d.x!, d.z!).join(",")));
/** 0 wheat, 1 pasture, 2 ploughed */
function plotType(i: number, j: number) {
  if (WHEAT_PLOTS.has(i + "," + j)) return 0;
  const h = hash2(i, j);
  return h < 0.5 ? 0 : h < 0.78 ? 1 : 2;
}
function farm(x: number, z: number) {
  if (Math.hypot(x, z) < 58) return false;
  if (z > 30 || z < -112 || x < -152 || x > 80) return false;
  if (!(x < -50 || z < -44)) return false;
  if (x > 36 && z > -36) return false;
  if (Math.hypot(x - MILL.x, z - MILL.z) < 15) return false;
  if (Math.hypot(x - CAMP.x, z - CAMP.z) < 30) return false;
  return true;
}
const plotEdge = (x: number, z: number) => {
  const fx = (((x + 3) % PW) + PW) % PW;
  const fz = (((z + 5) % PD) + PD) % PD;
  return fx < 1.1 || fz < 1.1;
};

// ------------------------------------------------------------------ heights

const roll = (x: number, z: number) => (fbm(x * 0.009 + 3, z * 0.009 - 7, 4) - 0.5) * 12;
/** the marsh water level south of town */
const WL = roll(0, -118) - 0.7;
const DECK_H = WL + 1.0;

const fortDist = (x: number, z: number) => Math.hypot(Math.max(0, Math.abs(x - FORT.x) - FORT.hx), Math.max(0, Math.abs(z - FORT.z) - FORT.hz));
const pitDist = (x: number, z: number) => Math.hypot(x - PIT.x, (z - PIT.z) / 1.05);
/** road distances past this are never asked about, so far roads are skipped by their boxes */
const ROAD_CAP = 14;
const ROAD_BOXES = ROADS.map((pts) => {
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const [x, z] of pts) {
    x0 = Math.min(x0, x);
    x1 = Math.max(x1, x);
    z0 = Math.min(z0, z);
    z1 = Math.max(z1, z);
  }
  return { pts, x0: x0 - ROAD_CAP, x1: x1 + ROAD_CAP, z0: z0 - ROAD_CAP, z1: z1 + ROAD_CAP };
});
const roadDist = (x: number, z: number) => {
  let d = ROAD_CAP;
  for (const r of ROAD_BOXES) if (x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1) d = Math.min(d, distToPolyline(x, z, r.pts));
  return d;
};
const streetDist = (x: number, z: number) => {
  let d = Infinity;
  for (const s of STREETS) d = Math.min(d, distToPolyline(x, z, s));
  return d;
};

const C = (hex: number) => new THREE.Color(hex);
const COL = {
  grassA: C(0x6f7d45),
  grassB: C(0x80894c),
  meadow: C(0x51623a),
  meadowB: C(0x5e6c3c),
  earth: C(0x7a6650),
  townGrass: C(0x6a7444),
  cobble: C(0x8c857a),
  cobbleB: C(0x7a7368),
  road: C(0xa38d6a),
  roadB: C(0x93805e),
  wheat: C(0xb59a52),
  wheatB: C(0xa48a48),
  pasture: C(0x7a8a4a),
  plough: C(0x5e4a34),
  ploughB: C(0x705a40),
  hedge: C(0x56633a),
  rock: C(0x77716a),
  rockB: C(0x5f5a54),
  gravel: C(0x8a8276),
  mud: C(0x3d3d2c),
  marsh: C(0x2e3726),
  deck: C(0x8a847a),
};

const TMP = new THREE.Color();

type Samp = { h: number; color: THREE.Color; path: number; water: number };

/** Everything about the ground at a local point. Also records road distance for the scatter passes. */
function groundSample(x: number, z: number): Samp & { rd: number } {
  const rl = roll(x, z);
  const detail = (fbm(x * 0.045, z * 0.045, 2) - 0.5) * 1.6;
  const rd = roadDist(x, z);
  const soft = 1 - smoothstep(2.5, 10, rd);
  const path = 1 - smoothstep(2.3, 3.6, rd);
  let h = rl + detail * (1 - soft * 0.85) - path * 0.08;

  // Harrenvale's hill: the town floor is nearly level inside the wall
  const r = Math.hypot(x, z);
  const townK = 1 - smoothstep(43, 92, r);
  if (townK > 0) h = lerp(h, TOWN_H + 0.9 * (1 - Math.min(1, (r / 44) ** 2)) + (fbm(x * 0.06 + 9, z * 0.06, 2) - 0.5) * 0.5, townK);

  // the fortress ridge (the north road climbs its eastern flank)
  const df = fortDist(x, z);
  const fort = 1 - smoothstep(4, 46, df);
  h += 27 * fort;

  // the quarry hill and its pit
  const dq2 = Math.hypot(x - QHILL.x, (z - QHILL.z) * 0.8);
  const hump = 15 * (1 - smoothstep(10, 46, dq2));
  h += hump;
  const dq = pitDist(x, z);
  const pit = 1 - smoothstep(PIT.r - 0.5, PIT.r + 2.5, dq);
  if (pit > 0) h = lerp(h, 3.2 + (noise2(x * 0.1, z * 0.1) - 0.5) * 0.6, pit);

  // a low rise for the beacon
  const db = Math.hypot(x - BEACON.x, z - BEACON.z);
  h += 4.5 * (1 - smoothstep(6, 30, db));

  // the marsh south of the fields, and the causeway over it
  const marsh = 1 - smoothstep(-134, -108, z);
  if (marsh > 0) h = lerp(h, WL - 0.45 + (fbm(x * 0.045 + 2, z * 0.045, 3) - 0.5) * 3.2, marsh);
  if (z > -126) h = Math.max(h, WL + 0.6 * smoothstep(-126, -104, z));
  const cw = (1 - smoothstep(-124, -112, z)) * (1 - smoothstep(CW_HALF - 0.4, CW_HALF + 1.0, Math.abs(x)));
  h = lerp(h, DECK_H, cw);

  // past the play bounds the land rises into a rim (except along the exits and the marsh)
  const out = Math.max(0, B.minX - x, x - B.maxX, z - B.maxZ);
  h += out * 0.42 * (1 - soft) * (1 - marsh);

  // ------------------------------------------------ colour
  const n1 = fbm(x * 0.08 + 1, z * 0.08 - 3, 2);
  const c = new THREE.Color().copy(COL.grassA).lerp(COL.grassB, n1);
  const north = smoothstep(28, 72, z);
  c.lerp(n1 > 0.5 ? COL.meadowB : COL.meadow, north * 0.85);
  if (farm(x, z)) {
    const [i, j] = plotIJ(x, z);
    const t = plotType(i, j);
    if (plotEdge(x, z)) c.copy(COL.hedge);
    else if (t === 0) c.copy(COL.wheat).lerp(COL.wheatB, noise2(x * 0.3, z * 0.3));
    else if (t === 1) c.copy(COL.pasture).lerp(COL.grassA, n1);
    else {
      const fx = (((x + 3) % PW) + PW) % PW;
      c.copy(COL.plough).lerp(COL.ploughB, 0.5 + 0.5 * Math.sin(fx * 3.4));
    }
  }
  // fortress flank: rock shows on the steep ground
  const steep = smoothstep(0.15, 0.4, fort) * (1 - smoothstep(0.85, 0.98, fort));
  c.lerp(COL.rockB, steep * (0.35 + n1 * 0.5));
  // quarry: bare rock on the faces, gravel on the floor and the spoil around it
  const face = pit > 0.02 && pit < 0.98 ? 1 : 0;
  const nearPit = 1 - smoothstep(PIT.r + 2, PIT.r + 12, dq);
  c.lerp(COL.gravel, Math.max(pit * 0.95, nearPit * 0.5));
  c.lerp(COL.rock, face * 0.9);
  c.lerp(COL.rock, smoothstep(6, 13, hump) * 0.55);
  // the beacon top is trodden bare
  c.lerp(COL.earth, (1 - smoothstep(4, 12, db)) * 0.55);
  // the marsh
  c.lerp(COL.mud, marsh * 0.9);
  const wet = clamp((WL + 0.15 - h) / 0.6, 0, 1);
  c.lerp(COL.marsh, wet * marsh);
  // the town floor: packed earth and tired grass, cobbles on the streets and the square
  let street = 0;
  if (r < 44) {
    const k = smoothstep(44, 42.5, r);
    TMP.copy(COL.earth).lerp(COL.townGrass, smoothstep(0.35, 0.65, n1));
    c.lerp(TMP, k * 0.85);
    street = r < 43 ? 1 - smoothstep(2.6, 3.4, streetDist(x, z)) : 0;
    const cob = Math.max(street, 1 - smoothstep(12.5, 13.5, r));
    c.lerp(noise2(x * 1.3, z * 1.3) > 0.5 ? COL.cobble : COL.cobbleB, cob * k);
  }
  // roads: lighter dirt, worn in the middle
  c.lerp(noise2(x * 0.5, z * 0.5) > 0.45 ? COL.road : COL.roadB, path * (r < 43 ? 0 : 1));
  // causeway deck stone
  c.lerp(COL.deck, cw > 0.6 ? 1 : 0);
  const water = marsh > 0.02 ? clamp((WL - h + 0.1) / 0.8, 0, 1) : 0;
  const pathOut = Math.max(path, street, cw > 0.6 ? 1 : 0);
  return { h, color: c, path: pathOut, water, rd };
}

/** A cylinder whose UVs are in 2 m tiles, so stone drums keep the same block size as the walls. */
function cylUV(rt: number, rb: number, h: number, seg: number) {
  const g = new THREE.CylinderGeometry(rt, rb, h, seg);
  const uv = g.getAttribute("uv");
  const around = (Math.PI * (rt + rb)) / 2;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * around, uv.getY(i) * (h / 2));
  return g;
}

// ------------------------------------------------------------------ the builder

export function buildKingdom(env: ZoneEnv): ZoneBuild {
  const M = env.M;
  const col = env.col;
  const root = new THREE.Group();
  root.name = "kingdom";
  const r = rng(4242);

  // ground (road distance is cached on the same grid for the scatter passes)
  const step = 2.5;
  const gb = { minX: B.minX - SKIRT, maxX: B.maxX + SKIRT, minZ: B.minZ - SKIRT, maxZ: B.maxZ + SKIRT };
  const gnx = Math.ceil((gb.maxX - gb.minX) / step) + 1;
  const gnz = Math.ceil((gb.maxZ - gb.minZ) / step) + 1;
  const rdGrid = new Float32Array(gnx * gnz);
  const terrain = buildFieldTerrain({
    ox: X,
    bounds: gb,
    step,
    sample: (x, z) => {
      const s = groundSample(x, z);
      const i = Math.round((x - gb.minX) / step);
      const j = Math.round((z - gb.minZ) / step);
      rdGrid[j * gnx + i] = s.rd;
      return s;
    },
  });
  root.add(terrain.mesh);
  /** road distance at a local point (nearest grid vertex: good to a metre) */
  const rdAt = (x: number, z: number) => {
    const i = clamp(Math.round((x - gb.minX) / step), 0, gnx - 1);
    const j = clamp(Math.round((z - gb.minZ) / step), 0, gnz - 1);
    return rdGrid[j * gnx + i];
  };
  const groundAt = terrain.heightAt;
  /** ground height at a local point */
  const hL = (x: number, z: number) => terrain.heightAt(X + x, z);
  const W = (x: number) => X + x;

  const batch = new Batch();
  const ctx: Ctx = { batch, M, col, h: groundAt, glows: [], smoke: [], fires: [], lamps: [] };
  const anchors: Record<string, THREE.Vector3> = {};
  /** a frame at a local point on the ground */
  const F = (x: number, z: number, rot = 0, dy = 0) => new Frame(W(x), hL(x, z) + dy, z, rot);
  const box = (key: Parameters<typeof put>[1], w: number, h: number, d: number, f: Frame, lx: number, ly: number, lz: number, rx = 0, ry = 0, rz = 0, color: THREE.ColorRepresentation = 0xffffff, shadow = true) =>
    put(ctx, key, boxUV(w, h, d, 2, 2), f, lx, ly, lz, rx, ry, rz, color, shadow);
  const cyl = (key: Parameters<typeof put>[1], rt: number, rb: number, h: number, seg: number, f: Frame, lx: number, ly: number, lz: number, color: THREE.ColorRepresentation = 0xffffff, rx = 0, ry = 0, rz = 0) =>
    put(ctx, key, cylUV(rt, rb, h, seg), f, lx, ly, lz, rx, ry, rz, color);
  const glow = (p: THREE.Vector3, size: number, color: number) => ctx.glows.push({ x: p.x, y: p.y, z: p.z, size, color });
  const T = { timber: 0x4a3f34, wood: 0x7a5e40, iron: 0x45474b, dark: 0x2a2622, slate: 0x6a7280, gold: 0xc8a040, red: 0x8e2f2f, cloth: 0xcdbba6, blue: 0x2f3a4a };

  /** spawn points, nodes and caches: scatter and set dressing keep off them */
  const keepClear: [number, number, number][] = [];
  for (const n of NODE_DEFS) if (n.zone === "kingdom" && n.x !== undefined && n.z !== undefined) keepClear.push([n.x, n.z, 3]);
  for (const s of MOB_SPAWNS) if (s[4] === "kingdom") keepClear.push([s[2], s[3], 3.5]);
  for (const c of CACHE_DEFS) if (c.zone === "kingdom") keepClear.push([c.x, c.z, 4]);
  const clearOf = (x: number, z: number, pad = 0) => keepClear.every(([cx, cz, rr]) => Math.hypot(x - cx, z - cz) > rr + pad);

  // ------------------------------------------------------------ banners (one mesh, waved on the CPU)
  type BannerSpec = { x: number; y: number; z: number; yaw: number; w: number; h: number };
  const bannerSpecs: BannerSpec[] = [];
  /** a banner hanging from (local x, top y, z), its face toward yaw */
  const banner = (p: THREE.Vector3, yaw: number, w = 1.3, h = 2.8) => bannerSpecs.push({ x: p.x, y: p.y, z: p.z, yaw, w, h });

  // ------------------------------------------------------------ Harrenvale: the curtain wall
  const wallRot = (a: number) => Math.atan2(-Math.cos(a), -Math.sin(a));
  const towerAt = (a: number, rad: number, tall: number, roof: boolean) => {
    const cx = Math.cos(a) * (WALL_R + 0.4);
    const cz = Math.sin(a) * (WALL_R + 0.4);
    const base = Math.min(hL(cx, cz), hL(cx * 1.06, cz * 1.06)) - 1.5;
    const f = new Frame(W(cx), base, cz, wallRot(a));
    cyl("stone", rad, rad + 0.35, tall, 14, f, 0, tall / 2, 0);
    cyl("stone", rad + 0.25, rad + 0.25, 0.5, 14, f, 0, tall - 0.4, 0, 0xd8d0c0);
    for (let k = 0; k < 10; k++) {
      const q = (k / 10) * Math.PI * 2;
      box("stone", 0.8, 0.9, 0.5, f, Math.cos(q) * (rad + 0.05), tall + 0.3, Math.sin(q) * (rad + 0.05), 0, -q + Math.PI / 2, 0);
    }
    if (roof) put(ctx, "shingle", new THREE.ConeGeometry(rad + 0.7, rad * 1.6, 12), f, 0, tall + 0.2 + rad * 0.8, 0, 0, 0, 0, T.slate);
    // arrow slits
    for (const q of [-0.6, 0, 0.6]) box("flat", 0.18, 1.1, 0.12, f, Math.sin(q) * rad, tall * 0.55, -Math.cos(q) * rad, 0, q, 0, 0x1a1612, false);
    col.circle(W(cx), cz, rad + 0.3);
    return f;
  };
  {
    const half = 5.5 / WALL_R;
    const arcs: [number, number][] = [[-Math.PI / 2 + half, Math.PI / 2 - half], [Math.PI / 2 + half, Math.PI - half], [-Math.PI + half, -Math.PI / 2 - half]];
    for (const [a0, a1] of arcs) {
      const n = Math.ceil(((a1 - a0) * WALL_R) / 6.5);
      for (let i = 0; i < n; i++) {
        const ai = a0 + ((a1 - a0) * i) / n;
        const bi = a0 + ((a1 - a0) * (i + 1)) / n;
        const am = (ai + bi) / 2;
        const chord = 2 * WALL_R * Math.sin((bi - ai) / 2);
        const mr = WALL_R * Math.cos((bi - ai) / 2);
        const cx = Math.cos(am) * mr;
        const cz = Math.sin(am) * mr;
        const ys = [hL(Math.cos(ai) * WALL_R, Math.sin(ai) * WALL_R), hL(Math.cos(bi) * WALL_R, Math.sin(bi) * WALL_R), hL(cx, cz), hL(cx * 1.03, cz * 1.03)];
        const base = Math.min(...ys) - 1.4;
        const top = TOWN_H + 8.6;
        const H = top - base;
        const f = new Frame(W(cx), base, cz, wallRot(am));
        const len = chord + 0.5;
        box("stone", len, H, WALL_T, f, 0, H / 2, 0);
        box("stone", len, 1.6, WALL_T + 0.9, f, 0, 0.8, -0.3, 0, 0, 0, 0xc8c0b0);
        box("stone", len, 0.35, WALL_T + 0.3, f, 0, H - 0.6, 0, 0, 0, 0, 0xd8d0c0);
        box("stone", len, 0.6, 0.35, f, 0, H + 0.2, WALL_T / 2 - 0.1);
        const m = Math.max(2, Math.round(len / 1.8));
        for (let k = 0; k < m; k++) box("stone", 0.85, 0.95, 0.5, f, -len / 2 + (len / m) * (k + 0.5), H + 0.45, -WALL_T / 2 + 0.25);
        col.box(W(cx), cz, len + 0.2, WALL_T + 0.5, wallRot(am));
      }
    }
    // mural towers where no house leans on the wall
    for (const deg of [145, 60, 12, -40, -75, -140]) towerAt((deg * Math.PI) / 180, 3.0, TOWN_H + 13 - hL(Math.cos((deg * Math.PI) / 180) * WALL_R, Math.sin((deg * Math.PI) / 180) * WALL_R) + 1.5, deg % 2 === 0);
    // gatehouses: two drum towers, an arch, the portcullis up, the leaves swung back, banners out
    for (const g of GATES) {
      const gx = Math.cos(g) * WALL_R;
      const gz = Math.sin(g) * WALL_R;
      const base = Math.min(hL(gx, gz), hL(gx * 1.1, gz * 1.1)) - 1.2;
      const f = new Frame(W(gx), base, gz, wallRot(g));
      const tall = TOWN_H + 11.5 - base;
      for (const s of [-1, 1]) {
        cyl("stone", 2.5, 2.8, tall, 14, f, s * 5.5, tall / 2, 0);
        cyl("stone", 2.75, 2.75, 0.5, 14, f, s * 5.5, tall - 0.3, 0, 0xd8d0c0);
        put(ctx, "shingle", new THREE.ConeGeometry(3.2, 5.2, 12), f, s * 5.5, tall + 2.5, 0, 0, 0, 0, T.slate);
        for (const q of [-0.5, 0.5]) box("flat", 0.18, 1.2, 0.12, f, s * 5.5 + Math.sin(q) * 2.5, tall * 0.6, -Math.cos(q) * 2.5, 0, q, 0, 0x1a1612, false);
        const p = f.at(s * 5.5, 0, 0);
        col.circle(p.x, p.z, 2.8);
        // the gate leaves, swung back against the passage
        box("planksDark", 0.18, 4.6, 2.8, f, s * 2.85, (TOWN_H - base) + 2.3, 1.7, 0, 0, 0, 0xc0b0a0);
        // inner banner on each drum
        banner(f.at(s * 5.5, tall - 1.6, 2.95), Math.atan2(-Math.cos(g), -Math.sin(g)), 1.2, 3.0);
        banner(f.at(s * 5.5, tall - 1.6, -2.95), Math.atan2(Math.cos(g), Math.sin(g)), 1.2, 3.0);
      }
      const archY = TOWN_H - base + 5.6;
      box("stone", 8.6, tall - archY - 0.6, 3.4, f, 0, archY + (tall - archY - 0.6) / 2, 0);
      for (let k = 0; k < 5; k++) box("stone", 0.85, 0.95, 0.5, f, -3.4 + k * 1.7, tall - 0.6 + 0.45, -1.45);
      // arch voussoirs under the block
      put(ctx, "stone", new THREE.TorusGeometry(3.0, 0.35, 5, 14, Math.PI), f, 0, archY - 2.6, -1.5, 0, 0, 0, 0xd0c8b8);
      put(ctx, "stone", new THREE.TorusGeometry(3.0, 0.35, 5, 14, Math.PI), f, 0, archY - 2.6, 1.5, 0, 0, 0, 0xd0c8b8);
      // the portcullis teeth showing under the arch
      for (let k = 0; k < 13; k++) box("metal", 0.08, 1.0, 0.08, f, -2.9 + k * 0.48, archY - 0.4, -0.5, 0, 0, 0, T.iron, false);
      box("metal", 6.0, 0.1, 0.1, f, 0, archY - 0.3, -0.5, 0, 0, 0, T.iron, false);
      // a lamp each side of the passage, inside and out
      for (const s of [-1, 1]) for (const side of [-1, 1]) {
        const p = f.at(s * 3.3, 0, side * 3.6);
        lamp(ctx, p.x, p.z, Math.atan2(Math.cos(g) * -side, Math.sin(g) * -side));
      }
    }
  }

  // ------------------------------------------------------------ Harrenvale: houses
  const doors: Record<string, THREE.Vector3> = {};
  /** a house with its back to the wall, door to the square */
  const ringHouse = (deg: number, w: number, d: number, seed: number, opt: Partial<Parameters<typeof cottage>[6]> = {}) => {
    const a = (deg * Math.PI) / 180;
    const rr = 42.2 - d / 2;
    const cx = Math.cos(a) * rr;
    const cz = Math.sin(a) * rr;
    const rot = Math.atan2(-Math.cos(a), -Math.sin(a));
    return cottage(ctx, W(cx), cz, w, d, rot, { roof: "shingle", stoneGround: seed % 2 === 0, seed, doorX: 0, h: seed % 3 === 0 ? 3.9 : 2.9, chimney: seed % 2 === 1, ...opt });
  };
  const house = (x: number, z: number, w: number, d: number, rot: number, seed: number, opt: Partial<Parameters<typeof cottage>[6]> = {}) =>
    cottage(ctx, W(x), z, w, d, rot, { roof: "shingle", stoneGround: seed % 2 === 0, seed, doorX: 0, h: seed % 3 === 0 ? 3.9 : 2.9, chimney: seed % 2 === 1, ...opt });

  for (const [deg, w, d, seed] of [
    [165, 5.4, 5, 11], [155, 5.4, 5, 12], [122, 5.6, 5, 14], [110, 5.4, 5, 15],
    [25, 5.6, 5, 16], [0, 6.0, 5, 17], [-12, 5.4, 5, 18], [-24, 5.4, 5, 19],
    [-105, 5.6, 5, 20], [-118, 5.4, 5, 21], [-131, 5.4, 5, 22], [-160, 5.6, 5, 23],
  ] as const) {
    const hres = ringHouse(deg, w, d, seed);
    doors["ring" + deg] = hres.door;
  }
  // Elspeth's: small, old, thatched, a garden beside it
  doors.elspeth = ringHouse(135, 4.8, 4.6, 31, { roof: "thatch", stoneGround: false, h: 2.6, chimney: true }).door;
  cabbages(ctx, W(-33.2), 21.4, 3.2, 2.6);
  fence(ctx, [[W(-35.2), 19.6], [W(-31.2), 19.6], [W(-31.2), 23.0]]);
  bench(ctx, W(-34.2), 25.0, Math.atan2(34.2, -25.0));
  barrel(ctx, W(-24.0), 29.4, 0.9, true);

  // inner streets
  doors.kit = house(-31, 7.6, 5.5, 4.5, Math.PI, 41).door;
  doors.wenna = house(-9.5, 18.5, 5, 6, Math.PI / 2, 42, { h: 3.9, chimney: true }).door;
  house(9.5, 18.5, 5, 6, -Math.PI / 2, 43, { h: 3.9 });
  doors.hob = house(25, 5, 6, 5, -Math.PI / 2, 44).door;
  house(25, -6, 6, 5, -Math.PI / 2, 45, { h: 3.9, chimney: true });
  house(-30, -8.4, 6, 5, 0, 46);
  house(-9.5, -20, 5, 6, Math.PI / 2, 47, { chimney: true });
  house(-9.5, -30, 5, 6, Math.PI / 2, 48, { h: 3.9 });
  doors.nell = house(-20, -26, 5, 5, 0, 49, { chimney: true }).door;
  house(-12.5, -13.5, 4.5, 4.5, Math.atan2(12.5, 13.5), 50);
  house(14.5, 11.5, 5, 5, Math.atan2(-14.5, -11.5), 51, { chimney: true });

  // ------------------------------------------------------------ the market square
  {
    // the market cross (the harrenvale shrine): stepped octagon, shaft, head, candles
    const cx = 7.0;
    const cz = -7.0;
    const f = F(cx, cz, Math.PI / 8, -0.15);
    cyl("stone", 2.2, 2.3, 0.3, 8, f, 0, 0.15, 0, 0xd8d0c0);
    cyl("stone", 1.6, 1.7, 0.3, 8, f, 0, 0.45, 0, 0xd0c8b8);
    cyl("stone", 1.0, 1.1, 0.35, 8, f, 0, 0.78, 0, 0xc8c0b0);
    cyl("stone", 0.26, 0.34, 4.2, 8, f, 0, 3.0, 0, 0xe0d8c8);
    box("stone", 0.32, 1.1, 0.32, f, 0, 5.5, 0, 0, 0, 0, 0xe0d8c8);
    box("stone", 1.3, 0.3, 0.3, f, 0, 5.4, 0, 0, 0, 0, 0xe0d8c8);
    box("stone", 0.3, 0.3, 1.3, f, 0, 5.4, 0, 0, 0, 0, 0xe0d8c8);
    put(ctx, "stone", new THREE.ConeGeometry(0.28, 0.4, 8), f, 0, 6.2, 0, 0, 0, 0, 0xe0d8c8);
    // copper sun on the head (the March-Seal's mark)
    put(ctx, "metal", new THREE.TorusGeometry(0.42, 0.05, 5, 16), f, 0, 5.4, 0, 0, 0, 0, 0xb87333, false);
    put(ctx, "metal", new THREE.TorusGeometry(0.42, 0.05, 5, 16), f, 0, 5.4, 0, 0, Math.PI / 2, 0, 0xb87333, false);
    for (let k = 0; k < 6; k++) {
      const q = (k / 6) * Math.PI * 2 + 0.3;
      const p = f.at(Math.cos(q) * 1.25, 0.6, Math.sin(q) * 1.25);
      put(ctx, "flat", new THREE.CylinderGeometry(0.05, 0.05, 0.22, 6), f, Math.cos(q) * 1.25, 0.72, Math.sin(q) * 1.25, 0, 0, 0, 0xe8e0c8, false);
      glow(new THREE.Vector3(p.x, p.y + 0.3, p.z), 0.9, 0xffc070);
    }
    glow(f.at(0, 5.5, 0), 5.5, 0xffd890);
    glow(f.at(0, 3.0, 0), 3.5, 0xffc070);
    col.circle(W(cx), cz, 0.55);
    anchors.shrine = new THREE.Vector3(W(6), hL(6, -6), -6);
    anchors.marketCross = new THREE.Vector3(W(cx), hL(cx, cz), cz);
  }
  // Wenna's stall: counter faces the market counter spot (-6, 6); she stands behind it
  {
    const sx = -8.2;
    const sz = 8.2;
    const rot = Math.atan2(-6 - sx, 6 - sz);
    const f = F(sx, sz, rot);
    for (const [px, pz] of [[-1.5, -0.95], [1.5, -0.95], [-1.5, 0.95], [1.5, 0.95]]) box("flat", 0.14, 2.5, 0.14, f, px, 1.25, pz, 0, 0, 0, T.timber);
    box("planks", 3.1, 0.95, 0.8, f, 0, 0.48, 0.6);
    box("planks", 3.3, 0.08, 1.0, f, 0, 0.98, 0.6, 0, 0, 0, 0xd8c8b0);
    for (let i = 0; i < 8; i++) box("flat", 0.43, 0.06, 2.3, f, -1.6 + 0.2 + i * 0.4, 2.55 + 0.08 * Math.cos(i * 1.7), 0.15, 0.22, 0, 0, i % 2 ? 0xcdbba6 : 0x8e2f2f);
    // wares: bread, marigold bunches, coal sack, wheat sheaf
    for (let i = 0; i < 7; i++) put(ctx, "flat", new THREE.SphereGeometry(0.12, 6, 5), f, -1.3 + i * 0.42, 1.08, 0.5 + (i % 2) * 0.2, 0, 0, 0, [0xb8813a, 0xd7a441, 0xe88a2a, 0x9a5a3a][i % 4], false);
    put(ctx, "thatch", new THREE.CylinderGeometry(0.2, 0.28, 0.8, 8), f, 1.95, 0.4, 0.7, 0, 0, 0.12, 0xffe8b0);
    sack(ctx, f.at(-1.9, 0, 0.9).x, f.at(-1.9, 0, 0.9).z);
    crate(ctx, f.at(-1.4, 0, -1.6).x, f.at(-1.4, 0, -1.6).z, 0.6, rot);
    const cc = f.at(0, 0, 0.6);
    col.box(cc.x, cc.z, 3.2, 0.9, rot);
    for (const [px, pz] of [[-1.5, -0.95], [1.5, -0.95]]) {
      const p = f.at(px, 0, pz);
      col.circle(p.x, p.z, 0.15);
    }
    anchors.market = new THREE.Vector3(W(-6), hL(-6, 6), 6);
  }
  stall(ctx, W(9.6), 8.8, Math.atan2(-9.6, -8.8));
  stall(ctx, W(12.2), -2.2, Math.atan2(-12.2, 2.2));
  well(ctx, W(-9.6), -8.6);
  bench(ctx, W(-2.9), -11.4, 0);
  bench(ctx, W(-11.8), 4.4, Math.PI / 2 + 0.2);
  cart(ctx, W(14.8), -9.4, 0.4);
  for (const [x, z, s] of [[11.0, -12.0, 0.65], [11.7, -12.6, 0.55], [-12.2, -4.6, 0.6]] as const) crate(ctx, W(x), z, s, x);
  for (const [x, z] of [[12.8, 6.4], [13.4, 5.6], [-11.4, -6.2]] as const) barrel(ctx, W(x), z);
  sack(ctx, W(10.4), -11.4);
  hay(ctx, W(16.6), -12.4, 0.4);
  root.add(signpost(ctx, W(-12.6), 2.6, Math.PI / 2, new THREE.MeshLambertMaterial({ map: signTex("trade"), vertexColors: true })));

  // ------------------------------------------------------------ Holt's smithy (anvil at the blacksmith spot, hearth by the forge)
  {
    // placed so the anvil, the hearth and Holt's counter fall on the shared station spots
    const rot = 1.0123;
    const sx = -17.5;
    const sz = 16.0;
    const s = smithy(ctx, W(sx), sz, rot);
    anchors.anvil = s.anvil;
    anchors.forge = new THREE.Vector3(W(-19), hL(-19, 18.5), 18.5);
    anchors.blacksmith = new THREE.Vector3(W(-16), hL(-16, 16), 16);
    // Holt's house behind the shop
    const f = new Frame(W(sx), 0, sz, rot);
    const hp = f.at(0, 0, -6.4);
    doors.holt = cottage(ctx, hp.x, hp.z, 6, 5, rot + Math.PI / 2, { roof: "shingle", stoneGround: true, seed: 61, doorX: 0, chimney: true }).door;
    // the counter inside the shop (Holt's shop spot is just in front of it)
    const cf = new Frame(W(sx), hL(sx, sz) + 0.3, sz, rot);
    put(ctx, "planks", boxUV(1.4, 0.08, 0.5, 1, 1), cf, 1.3, 0.92, -1.85, 0, 0, 0);
    for (const lx of [0.75, 1.85]) put(ctx, "flat", new THREE.BoxGeometry(0.08, 0.9, 0.4), cf, lx, 0.46, -1.85, 0, 0, 0, T.timber);
    for (let i = 0; i < 4; i++) put(ctx, "metal", new THREE.BoxGeometry(0.9, 0.04, 0.06), cf, 1.3, 0.99, -2.0 + i * 0.1, 0, 0.1 * i, 0, 0xb0b4b8, false);
    woodpile(ctx, f.at(-4.6, 0, -1.4).x, f.at(-4.6, 0, -1.4).z, rot);
    const cp = f.at(4.4, 0, 0.6);
    for (let i = 0; i < 3; i++) crate(ctx, cp.x + i * 0.3, cp.z - i * 0.5, 0.6, rot + i);
    const sp = f.at(4.0, 0, 3.4);
    root.add(signpost(ctx, sp.x, sp.z, rot, new THREE.MeshLambertMaterial({ map: signTex("anvil"), vertexColors: true })));
    // a coal heap (Holt's quest is about coal)
    const coal = rockGeo(71, false, 0x2a2828);
    const cpos = f.at(-4.2, 0, 1.6);
    put(ctx, "flat", coal, new Frame(cpos.x, hL(cpos.x - X, cpos.z) - 0.25, cpos.z, 0), 0, 0, 0, 0, 0, 0, 0xffffff, false);
    col.circle(cpos.x, cpos.z, 0.7);
  }

  // ------------------------------------------------------------ Brannoc's armoury
  {
    doors.brannoc = cottage(ctx, W(-27), -17, 8, 6, Math.PI / 2, { roof: "shingle", stoneGround: true, seed: 62, doorX: 2.5, h: 3.6, chimney: true }).door;
    workbench(ctx, W(-21.3), -17.3, 0);
    anchors.bench = new THREE.Vector3(W(-21), hL(-21, -15.5), -15.5);
    // counter: a trestle of helms and gauntlets
    {
      const f = F(-21.6, -13.6, Math.PI / 2);
      box("planks", 2.2, 0.08, 0.7, f, 0, 0.92, 0);
      for (const sx of [-0.95, 0.95]) box("flat", 0.1, 0.88, 0.6, f, sx, 0.44, 0, 0, 0, 0, T.timber);
      for (let i = 0; i < 3; i++) put(ctx, "metal", new THREE.SphereGeometry(0.17, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), f, -0.7 + i * 0.7, 0.96, 0, 0, 0, 0, i === 1 ? 0x6e4c2e : 0x6a6d72);
      col.box(W(-21.6), -13.6, 2.2, 0.7, Math.PI / 2);
    }
    // armour stands
    for (const [x, z, c] of [[-16.4, -12.6, 0x6a6d72], [-15.8, -10.6, 0x6e4c2e]] as const) {
      const f = F(x, z, -0.6);
      cyl("flat", 0.05, 0.05, 1.5, 6, f, 0, 0.75, 0, T.timber);
      cyl("flat", 0.3, 0.3, 0.06, 10, f, 0, 0.03, 0, T.timber);
      box("metal", 0.5, 0.62, 0.3, f, 0, 1.25, 0, 0, 0, 0, c);
      box("metal", 0.62, 0.14, 0.32, f, 0, 1.52, 0, 0, 0, 0, c);
      put(ctx, "metal", new THREE.SphereGeometry(0.16, 8, 6), f, 0, 1.78, 0, 0, 0, 0, c);
      col.circle(W(x), z, 0.4);
    }
    // grindstone
    {
      const f = F(-19.8, -9.8, 0.3);
      put(ctx, "stone", new THREE.CylinderGeometry(0.45, 0.45, 0.16, 14), f, 0, 0.75, 0, 0, 0, Math.PI / 2, 0x9a948a);
      for (const s of [-1, 1]) box("flat", 0.08, 0.75, 0.1, f, s * 0.15, 0.38, 0, 0, 0, 0, T.timber);
      col.circle(W(-19.8), -9.8, 0.5);
    }
    anchors.armourer = new THREE.Vector3(W(-18), hL(-18, -12), -12);
    barrel(ctx, W(-23.2), -12.0);
  }

  // ------------------------------------------------------------ The Gilded Ox
  {
    const ox = cottage(ctx, W(24), 25, 11, 7.5, Math.PI, { roof: "shingle", stoneGround: true, seed: 63, doorX: -3, h: 4.6, chimney: true, pitch: 0.82 });
    doors.odo = ox.door;
    // the sign: a gilded ox on a bracket
    const f = F(20.6, 20.6, Math.PI);
    box("flat", 0.12, 0.12, 1.4, f, 0, 3.6, -0.4, 0, 0, 0, T.timber);
    box("planks", 1.1, 0.7, 0.06, f, 0, 3.05, 0.1, 0, 0, 0, 0x6e5436);
    box("metal", 0.5, 0.26, 0.08, f, 0, 3.08, 0.16, 0, 0, 0, T.gold);
    for (const s of [-1, 1]) box("metal", 0.06, 0.18, 0.06, f, s * 0.18, 2.88, 0.16, 0, 0, 0, T.gold, false);
    put(ctx, "metal", new THREE.ConeGeometry(0.05, 0.16, 5), f, 0.32, 3.26, 0.16, 0, 0, -0.8, T.gold, false);
    put(ctx, "metal", new THREE.ConeGeometry(0.05, 0.16, 5), f, -0.32, 3.26, 0.16, 0, 0, 0.8, T.gold, false);
    // the outdoor hearth with a spit and a pot (the cooking station is just in front of it)
    const hx = 21.6;
    const hz = 19.6;
    const hf = F(hx, hz, 0.2);
    for (let k = 0; k < 9; k++) {
      const q = (k / 9) * Math.PI * 2;
      put(ctx, "stone", rockGeo(80 + k, false, 0x8a847a).scale(0.26, 0.24, 0.26), hf, Math.cos(q) * 0.75, 0.06, Math.sin(q) * 0.75, 0, q, 0, 0xffffff);
    }
    put(ctx, "ember", new THREE.ConeGeometry(0.42, 0.5, 7), hf, 0, 0.25, 0, 0, 0, 0, 0xffffff, false);
    for (const s of [-1, 1]) box("flat", 0.08, 1.3, 0.08, hf, s * 0.95, 0.65, 0, 0, 0, s * 0.1, T.timber);
    put(ctx, "metal", new THREE.CylinderGeometry(0.03, 0.03, 2.1, 5), hf, 0, 1.22, 0, 0, 0, Math.PI / 2, T.iron, false);
    put(ctx, "flat", new THREE.SphereGeometry(0.2, 8, 6), hf, 0.2, 1.1, 0, 0, 0, 0, 0x8a5a3a, false);
    put(ctx, "metal", new THREE.SphereGeometry(0.3, 10, 8, 0, Math.PI * 2, Math.PI / 3, Math.PI), hf, -0.9, 0.5, 0.75, 0, 0, 0, 0x2a2826);
    const fp = hf.at(0, 0.45, 0);
    ctx.fires.push(fp);
    ctx.smoke.push(hf.at(0, 1.4, 0));
    glow(fp, 5, 0xff8a38);
    col.circle(W(hx), hz, 0.95);
    anchors.cook = new THREE.Vector3(W(20), hL(20, 18), 18);
    // the serving trestle (Odo's counter spot is in front of it)
    const tf = F(17, 17.5, 0);
    box("planks", 2.2, 0.1, 0.7, tf, 0, 0.95, 0);
    for (const s of [-1, 1]) box("flat", 0.1, 0.92, 0.6, tf, s * 0.95, 0.46, 0, 0, 0, 0, T.timber);
    for (let i = 0; i < 4; i++) put(ctx, "planks", new THREE.CylinderGeometry(0.07, 0.06, 0.16, 8), tf, -0.7 + i * 0.45, 1.08, (i % 2) * 0.15 - 0.05, 0, 0, 0, 0xc8a878, false);
    col.box(W(17), 17.5, 2.2, 0.7, 0);
    barrel(ctx, W(15.4), 18.4);
    barrel(ctx, W(19.2), 21.0);
    // yard tables
    for (const [x, z, a] of [[27.4, 16.4, 0.1], [30.6, 19.6, -0.4]] as const) {
      const f2 = F(x, z, a);
      box("planks", 2.0, 0.08, 0.8, f2, 0, 0.78, 0);
      for (const s of [-1, 1]) box("flat", 0.1, 0.75, 0.7, f2, s * 0.85, 0.38, 0, 0, 0, 0, T.timber);
      bench(ctx, f2.at(0, 0, 0.8).x, f2.at(0, 0, 0.8).z, a);
      bench(ctx, f2.at(0, 0, -0.8).x, f2.at(0, 0, -0.8).z, a);
      col.box(W(x), z, 2.0, 0.8, a);
    }
    lamp(ctx, W(23.2), 17.0, Math.PI);
    root.add(signpost(ctx, W(29.6), 20.4, Math.PI, new THREE.MeshLambertMaterial({ map: signTex("bed"), vertexColors: true })));
  }

  // ------------------------------------------------------------ Castellan Voss's hall
  {
    const hall = cottage(ctx, W(10.5), 32.5, 11, 11, -Math.PI / 2, { roof: "shingle", stoneGround: true, seed: 64, doorX: -0.5, h: 5.4, chimney: true, pitch: 0.82 });
    doors.voss = hall.door;
    anchors.vossHall = new THREE.Vector3(W(3.8), hL(3.8, 32), 32);
    const f = F(5.0, 32, -Math.PI / 2);
    // porch: two columns, a lintel and a little gable roof, steps
    for (const s of [-1, 1]) {
      cyl("stone", 0.28, 0.32, 3.4, 10, f, s * 1.6, 1.7 + 0.2, 1.0, 0xe0d8c8);
      const p = f.at(s * 1.6, 0, 1.0);
      col.circle(p.x, p.z, 0.35);
    }
    box("stone", 4.0, 0.45, 1.6, f, 0, 3.75, 0.7, 0, 0, 0, 0xd8d0c0);
    for (const s of [-1, 1]) box("shingle", 4.4, 0.12, 1.25, f, 0, 4.25, 0.7 + s * 0.45, s * 0.75, 0, 0, T.slate);
    box("stone", 3.6, 0.2, 1.8, f, 0, 0.15, 0.9, 0, 0, 0, 0xc8c0b0);
    // door surround: a taller arch than a cottage's
    box("stone", 1.9, 0.35, 0.3, f, 0, 3.0, 0.08);
    for (const s of [-1, 1]) box("stone", 0.32, 2.7, 0.3, f, s * 0.8, 1.6, 0.08);
    // banners either side, a shield over the door
    banner(f.at(-2.9, 5.2, 0.12), -Math.PI / 2, 1.3, 3.2);
    banner(f.at(2.9, 5.2, 0.12), -Math.PI / 2, 1.3, 3.2);
    put(ctx, "metal", new THREE.CylinderGeometry(0.5, 0.5, 0.1, 3), f, 0, 4.9, 0.15, Math.PI / 2, 0, Math.PI, T.blue);
    for (const s of [-1, 1]) {
      const lp = f.at(s * 2.4, 2.4, 0.4);
      glow(lp, 2.6, 0xffb060);
      ctx.lamps.push(lp);
      put(ctx, "metal", new THREE.BoxGeometry(0.22, 0.32, 0.22), f, s * 2.4, 2.4, 0.4, 0, 0, 0, T.iron, false);
    }
  }

  // ------------------------------------------------------------ The Old Tower and its lectern
  {
    const tx = -8;
    const tz = 31;
    const base = hL(tx, tz) - 1;
    const f = new Frame(W(tx), base, tz, 0);
    const tall = 17;
    cyl("stoneGrey", 3.3, 3.7, tall, 16, f, 0, tall / 2, 0);
    for (const y of [5.5, 11]) cyl("stoneGrey", 3.55, 3.55, 0.35, 16, f, 0, y, 0, 0xc8c8c8);
    for (let k = 0; k < 12; k++) {
      const q = (k / 12) * Math.PI * 2;
      box("stoneGrey", 0.8, 1.0, 0.5, f, Math.cos(q) * 3.35, tall + 0.4, Math.sin(q) * 3.35, 0, -q + Math.PI / 2, 0);
    }
    put(ctx, "shingle", new THREE.ConeGeometry(4.1, 6.5, 16), f, 0.2, tall + 3.3, 0, 0.05, 0, 0.04, 0x6a6878);
    // door facing the street (east)
    box("planksDark", 0.2, 2.4, 1.4, f, 3.62, 2.2, 0, 0, 0, 0, 0xd0c0b0);
    box("stoneGrey", 0.4, 0.3, 1.9, f, 3.65, 3.5, 0);
    for (const s of [-1, 1]) box("stoneGrey", 0.4, 2.6, 0.3, f, 3.65, 2.3, s * 0.85);
    box("stoneGrey", 1.4, 0.3, 2.0, f, 4.0, 1.05, 0);
    // high windows with a cold light (the enchanter works late)
    for (const q of [0.4, 2.2, 3.6, 5.2]) {
      box("window", 0.12, 1.2, 0.5, f, Math.cos(q) * 3.35, 12.8, Math.sin(q) * 3.35, 0, -q, 0, 0xffffff, false);
      glow(f.at(Math.cos(q) * 3.5, 12.8, Math.sin(q) * 3.5), 2.2, 0xa8a0ff);
    }
    col.circle(W(tx), tz, 3.9);
    // the lectern on its dais (the enchanter station sits beside it)
    const lx = -1.8;
    const lz = 28.2;
    const lf = F(lx, lz, Math.atan2(0 - lx, 27 - lz));
    put(ctx, "flagstone", new THREE.CylinderGeometry(2.1, 2.2, 0.12, 12), F(-1.2, 27.6), 0, 0.02, 0, 0, 0, 0, 0xffffff, false);
    cyl("stoneGrey", 0.16, 0.24, 1.05, 8, lf, 0, 0.52, 0);
    box("planksDark", 0.62, 0.06, 0.48, lf, 0, 1.12, 0, -0.35, 0, 0);
    box("flat", 0.56, 0.04, 0.4, lf, 0, 1.17, 0.02, -0.35, 0, 0, 0xe8dcc0, false);
    put(ctx, "flat", new THREE.CylinderGeometry(0.03, 0.03, 0.18, 6), lf, 0.36, 1.2, -0.12, 0, 0, 0, 0xe8e0c8, false);
    glow(lf.at(0, 1.35, 0), 2.4, 0xb0a0ff);
    glow(lf.at(0.36, 1.35, -0.12), 0.8, 0xffc070);
    col.circle(W(lx), lz, 0.35);
    anchors.lectern = new THREE.Vector3(W(0), hL(0, 27), 27);
  }

  // ------------------------------------------------------------ The Church of the March and the infirmary
  {
    const cx = 12;
    const cz = -31.5;
    const base = Math.min(hL(8, -38), hL(16, -38), hL(8, -25), hL(16, -25)) - 0.4;
    const f = new Frame(W(cx), base, cz, 0);
    const wallH = 7.2;
    const hw = 4.0;
    const hd = 6.5;
    // walls
    for (const s of [-1, 1]) {
      box("stone", 0.6, wallH, hd * 2, f, s * (hw - 0.3), wallH / 2, 0);
      box("stone", hw * 2, wallH, 0.6, f, 0, wallH / 2, s * (hd - 0.3));
      // buttresses
      for (let k = -2; k <= 2; k++) box("stone", 0.7, wallH * 0.8, 0.9, f, s * (hw + 0.25), wallH * 0.4, k * 2.9, 0, 0, 0, 0xd0c8b8);
      // lancets between them
      for (let k = -2; k < 2; k++) {
        const wz = (k + 0.5) * 2.9;
        box("window", 0.1, 2.6, 0.8, f, s * (hw + 0.02), 4.0, wz, 0, 0, 0, 0xffffff, false);
        put(ctx, "window", new THREE.ConeGeometry(0.4, 0.6, 4), f, s * (hw + 0.02), 5.6, wz, 0, Math.PI / 4, 0, 0xffffff, false);
        glow(f.at(s * (hw + 0.15), 4.2, wz), 2.4, 0xffb860);
      }
    }
    box("stone", hw * 2 + 0.6, 0.6, hd * 2 + 0.6, f, 0, 0.3, 0, 0, 0, 0, 0xc0b8a8);
    // the roof: two steep slabs along the nave, gables at each end
    const pitch = 0.95;
    const over = 0.5;
    const half = hw + over;
    const rise = hw * Math.tan(pitch);
    const slab = half / Math.cos(pitch);
    for (const s of [-1, 1]) {
      const nx = s * Math.sin(pitch);
      const ny = Math.cos(pitch);
      put(ctx, "shingle", boxUV(slab, 0.2, hd * 2 + 1.0, 2, 2), f, s * (half / 2) + nx * 0.1, wallH + rise - (half * Math.tan(pitch)) / 2 + ny * 0.1, 0, 0, 0, -s * pitch, T.slate);
    }
    put(ctx, "shingle", new THREE.CylinderGeometry(0.14, 0.14, hd * 2 + 1.0, 6), f, 0, wallH + rise + 0.14, 0, Math.PI / 2, 0, 0, 0x8890a0);
    const shape = new THREE.Shape();
    shape.moveTo(-hw, 0);
    shape.lineTo(hw, 0);
    shape.lineTo(0, rise);
    shape.closePath();
    for (const s of [-1, 1]) {
      const g = new THREE.ExtrudeGeometry(shape, { depth: 0.6, bevelEnabled: false });
      const uv = g.getAttribute("uv");
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 2, uv.getY(i) / 2);
      put(ctx, "stone", g, f, 0, wallH, s > 0 ? hd - 0.6 : -hd);
    }
    // rose window over the altar end
    put(ctx, "window", new THREE.CircleGeometry(1.1, 16), f, 0, wallH + 1.2, -hd - 0.02, 0, Math.PI, 0, 0xffffff, false);
    put(ctx, "stone", new THREE.TorusGeometry(1.15, 0.12, 5, 16), f, 0, wallH + 1.2, -hd - 0.05, 0, 0, 0, 0xe0d8c8);
    glow(f.at(0, wallH + 1.2, -hd - 0.3), 3.2, 0xffb860);
    col.box(W(cx), cz, hw * 2 + 1.4, hd * 2 + 0.6, 0);
    // the bell tower at the north end, door to the square
    const tz = -22.5;
    const tb = Math.min(hL(cx - 2.5, tz + 2.5), hL(cx + 2.5, tz + 2.5)) - 0.4;
    const tf = new Frame(W(cx), tb, tz, 0);
    const th = 18;
    box("stone", 5, th, 5, tf, 0, th / 2, 0);
    box("stone", 5.6, 0.4, 5.6, tf, 0, 7.5, 0, 0, 0, 0, 0xd8d0c0);
    box("stone", 5.6, 0.5, 5.6, tf, 0, th, 0, 0, 0, 0, 0xd8d0c0);
    for (const [ax, az, ry] of [[0, 2.52, 0], [0, -2.52, 0], [2.52, 0, Math.PI / 2], [-2.52, 0, Math.PI / 2]] as const) {
      box("flat", 1.4, 2.6, 0.1, tf, ax, th - 3.0, az, 0, ry, 0, 0x14100c, false);
      for (let k = -1; k <= 1; k += 2) {
        const ox = ry ? 0 : k * 1.8;
        const oz = ry ? k * 1.8 : 0;
        box("stone", 0.7, 0.9, 0.5, tf, ax + ox, th + 0.7, az + oz, 0, ry, 0);
      }
    }
    put(ctx, "shingle", new THREE.ConeGeometry(3.4, 11, 4), tf, 0, th + 5.8, 0, 0, Math.PI / 4, 0, T.slate);
    put(ctx, "metal", new THREE.CylinderGeometry(0.04, 0.04, 1.6, 5), tf, 0, th + 12, 0, 0, 0, 0, T.gold, false);
    put(ctx, "metal", new THREE.BoxGeometry(0.7, 0.06, 0.06), tf, 0, th + 12.4, 0, 0, 0, 0, T.gold, false);
    // the bell inside the belfry
    put(ctx, "metal", new THREE.LatheGeometry([new THREE.Vector2(0.06, 0), new THREE.Vector2(0.3, 0.06), new THREE.Vector2(0.38, 0.45), new THREE.Vector2(0.55, 0.85), new THREE.Vector2(0.0, 0.85)], 12), tf, 0, th - 2.0, 0, Math.PI, 0, 0, 0xa8743a);
    // the door
    box("planksDark", 1.6, 2.8, 0.2, tf, 0, (hL(cx, -20) - tb) + 1.4, 2.55, 0, 0, 0, 0xd0c0b0);
    put(ctx, "stone", new THREE.TorusGeometry(0.95, 0.18, 5, 12, Math.PI), tf, 0, (hL(cx, -20) - tb) + 2.75, 2.6, 0, 0, 0, 0xe0d8c8);
    col.box(W(cx), tz, 5.4, 5.4, 0);
    anchors.church = new THREE.Vector3(W(12), hL(12, -18.8), -18.8);
    // a little graveyard along the street side
    for (let k = 0; k < 7; k++) {
      const gx = 5.2 + (k % 2) * 1.0;
      const gz = -27 - k * 1.7;
      const gf = F(gx, gz, (r() - 0.5) * 0.2);
      box("stoneGrey", 0.5, 0.75 + r() * 0.3, 0.14, gf, 0, 0.3, 0, (r() - 0.5) * 0.15, Math.PI / 2, 0, 0xb8b8b0);
    }
    // the infirmary: long and low, its still and counter out front under an awning
    doors.maree = cottage(ctx, W(24), -26.5, 10, 6.5, 0, { roof: "shingle", stoneGround: true, seed: 65, doorX: 2, h: 3.2, chimney: true }).door;
    const af = F(21.2, -21.6, 0);
    for (const s of [-1, 1]) box("flat", 0.12, 2.5, 0.12, af, s * 2.4, 1.25, 1.3, 0, 0, 0, T.timber);
    box("flat", 5.2, 0.06, 2.0, af, 0, 2.55, 0.4, 0.25, 0, 0, 0xcdbba6);
    for (const s of [-1, 1]) {
      const p = af.at(s * 2.4, 0, 1.3);
      col.circle(p.x, p.z, 0.15);
    }
    // the still: copper pot over a small fire, a coil, a table of jars
    const sf = F(22.8, -21.6, 0.3);
    put(ctx, "stone", new THREE.CylinderGeometry(0.5, 0.55, 0.5, 8), sf, 0, 0.25, 0, 0, 0, 0, 0xa8a090);
    put(ctx, "metal", new THREE.SphereGeometry(0.42, 12, 8), sf, 0, 0.85, 0, 0, 0, 0, 0xb87333);
    put(ctx, "metal", new THREE.CylinderGeometry(0.06, 0.12, 0.5, 8), sf, 0, 1.4, 0, 0, 0, 0, 0xb87333);
    put(ctx, "metal", new THREE.TorusGeometry(0.22, 0.03, 5, 12), sf, 0.55, 0.9, 0, Math.PI / 2, 0, 0, 0xb87333, false);
    put(ctx, "metal", new THREE.CylinderGeometry(0.025, 0.025, 0.7, 5), sf, 0.3, 1.45, 0, 0, 0, 1.0, 0xb87333, false);
    put(ctx, "ember", new THREE.BoxGeometry(0.3, 0.08, 0.3), sf, 0, 0.42, 0.42, 0, 0, 0, 0xffffff, false);
    glow(sf.at(0, 0.5, 0.45), 1.4, 0xff8a38);
    col.circle(W(22.8), -21.6, 0.65);
    anchors.still = new THREE.Vector3(W(22), hL(22, -20), -20);
    const tf2 = F(19.2, -19.5, 0);
    box("planks", 2.2, 0.08, 0.7, tf2, 0, 0.92, 0);
    for (const s of [-1, 1]) box("flat", 0.1, 0.88, 0.6, tf2, s * 0.95, 0.44, 0, 0, 0, 0, T.timber);
    for (let i = 0; i < 6; i++) put(ctx, "flat", new THREE.CylinderGeometry(0.06, 0.07, 0.2 + (i % 3) * 0.06, 7), tf2, -0.8 + i * 0.32, 1.06, (i % 2) * 0.16 - 0.08, 0, 0, 0, [0x6a8a6a, 0x8a6a4a, 0xcdbba6][i % 3], false);
    col.box(W(19.2), -19.5, 2.2, 0.7, 0);
    // drying rack of marigold
    const rf = F(27.6, -22.0, 0);
    for (const s of [-1, 1]) box("flat", 0.08, 1.6, 0.08, rf, s * 1.0, 0.8, 0, 0, 0, 0, T.timber);
    box("flat", 2.1, 0.06, 0.06, rf, 0, 1.55, 0, 0, 0, 0, T.timber);
    for (let i = 0; i < 6; i++) put(ctx, "flat", new THREE.ConeGeometry(0.1, 0.4, 5), rf, -0.8 + i * 0.32, 1.3, 0, Math.PI, 0, 0, 0xe88a2a, false);
    col.box(W(27.6), -22.0, 2.2, 0.3, 0);
  }

  // ------------------------------------------------------------ yards, clutter and lamps in town
  for (const [x, z, a] of [[-36, -3.6, 0], [-26, 3.6, Math.PI], [-16, -3.6, 0], [-3.6, 22, Math.PI / 2], [3.6, 26.5, -Math.PI / 2], [-3.6, 37, Math.PI / 2], [3.6, 16, -Math.PI / 2],
    [3.6, -17, -Math.PI / 2], [-3.6, -26, Math.PI / 2], [3.6, -35, -Math.PI / 2], [10.4, -10.6, -Math.PI * 0.75], [-11.0, 11.0, Math.PI * 0.25], [-13.6, -6.6, Math.PI * 0.4], [14.0, 2.8, -Math.PI / 2]] as const) lamp(ctx, W(x), z, a);
  woodpile(ctx, W(-36.2), 12.6, 0.4);
  woodpile(ctx, W(31.0), -11.6, -0.4);
  for (const [x, z] of [[-24.0, -27.0], [-14.2, -24.2], [30.8, 9.2], [-13.4, 23.8], [17.8, -10.8]] as const) barrel(ctx, W(x), z, 0.95);
  for (const [x, z] of [[-27.0, -6.8], [32.6, -1.6], [-6.8, -33.6]] as const) crate(ctx, W(x), z, 0.65, x * 0.3);
  cabbages(ctx, W(-17.0), -31.0, 3.4, 2.4);
  cabbages(ctx, W(31.4), 12.8, 3.0, 2.2);
  trough(ctx, W(-38.4), -12.4, 0.4);
  fence(ctx, [[W(-19.8), -29.4], [W(-14.6), -29.4], [W(-14.6), -32.8]]);
  // washing lines (Nell's)
  for (const [x0, z0, x1, z1] of [[-23.6, -21.0, -19.0, -21.8]] as const) {
    for (const [px, pz] of [[x0, z0], [x1, z1]]) {
      const f = F(px, pz);
      box("flat", 0.1, 2.0, 0.1, f, 0, 1.0, 0, 0, 0, 0, T.timber);
      col.circle(W(px), pz, 0.12);
    }
    const len = Math.hypot(x1 - x0, z1 - z0);
    const f = F((x0 + x1) / 2, (z0 + z1) / 2, Math.atan2(x1 - x0, z1 - z0));
    box("flat", 0.02, 0.02, len, f, 0, 1.85, 0, 0, 0, 0, 0x8a7a62, false);
    for (let i = 0; i < 4; i++) box("flat", 0.04, 0.6, 0.5, f, 0, 1.55, -len / 2 + 0.8 + i * (len - 1.6) / 3, 0, 0, 0, [0xd8ccb4, 0x8a9aaa, 0xcdbba6, 0xa86a50][i], false);
  }

  // ------------------------------------------------------------ the Royal Fortress on the ridge
  {
    const fx = FORT.x;
    const fz = FORT.z;
    const fy = hL(fx, fz);
    const f = new Frame(W(fx), fy, fz, 0);
    const hx = 26;
    const hz = 18;
    const wallH = 15;
    const down = 6;
    // curtain walls (sunk into the slope so the hill never shows under them)
    const sides: [number, number, number, number][] = [[0, -hz, hx * 2, 0], [0, hz, hx * 2, 0], [-hx, 0, hz * 2, Math.PI / 2], [hx, 0, hz * 2, Math.PI / 2]];
    for (const [sx, sz, len, rot] of sides) {
      const wf = new Frame(W(fx + sx), fy - down, fz + sz, rot);
      box("stoneGrey", len, wallH + down, 3, wf, 0, (wallH + down) / 2, 0);
      const m = Math.round(len / 2);
      for (let k = 0; k < m; k++) box("stoneGrey", 1.0, 1.2, 0.6, wf, -len / 2 + (len / m) * (k + 0.5), wallH + down + 0.6, -1.2);
      for (let k = 0; k < m; k++) box("stoneGrey", 1.0, 1.2, 0.6, wf, -len / 2 + (len / m) * (k + 0.5), wallH + down + 0.6, 1.2);
      col.box(W(fx + sx), fz + sz, rot ? 3.4 : len + 1, rot ? len + 1 : 3.4, 0);
    }
    // round towers at the corners and the middle of the long sides
    const tower = (tx: number, tz: number, rad: number, tall: number) => {
      const tf = new Frame(W(fx + tx), fy - down, fz + tz, 0);
      cyl("stoneGrey", rad, rad + 0.6, tall + down, 16, tf, 0, (tall + down) / 2, 0);
      cyl("stoneGrey", rad + 0.4, rad + 0.4, 0.8, 16, tf, 0, tall + down - 0.2, 0, 0xc8c8c8);
      put(ctx, "shingle", new THREE.ConeGeometry(rad + 1.0, rad * 2.4, 16), tf, 0, tall + down + rad * 1.2, 0, 0, 0, 0, 0x4a5262);
      for (const q of [0.6, 2.4, 4.0]) {
        box("window", 0.15, 1.4, 0.7, tf, Math.cos(q) * rad, tall + down - 4, Math.sin(q) * rad, 0, -q, 0, 0xffffff, false);
        glow(tf.at(Math.cos(q) * (rad + 0.2), tall + down - 4, Math.sin(q) * (rad + 0.2)), 3.0, 0xffb060);
      }
      col.circle(W(fx + tx), fz + tz, rad + 0.4);
      return tf;
    };
    for (const [tx, tz] of [[-hx, -hz], [hx, -hz], [-hx, hz], [hx, hz]]) tower(tx, tz, 4.5, 23);
    tower(0, hz, 3.6, 20);
    tower(-hx, 0, 3.6, 19);
    tower(hx, 0, 3.6, 19);
    // the gatehouse facing the town, gate shut
    for (const s of [-1, 1]) tower(s * 5.2, -hz - 1.2, 3.4, 20);
    const gf = new Frame(W(fx), fy, fz - hz - 1.6, 0);
    box("stoneGrey", 7.4, 8, 3.2, gf, 0, 13, 0);
    box("planksDark", 4.2, 7.2, 0.3, gf, 0, 3.6, -1.4, 0, 0, 0, 0x9a8a78);
    for (let k = 0; k < 4; k++) box("metal", 4.3, 0.12, 0.1, gf, 0, 1.2 + k * 1.8, -1.6, 0, 0, 0, T.iron, false);
    put(ctx, "stoneGrey", new THREE.TorusGeometry(2.4, 0.4, 5, 14, Math.PI), gf, 0, 7.2, -1.55, 0, 0, 0, 0xd0d0d0);
    banner(gf.at(-2.6, 16.2, -1.7), Math.PI, 1.6, 4.4);
    banner(gf.at(2.6, 16.2, -1.7), Math.PI, 1.6, 4.4);
    const gl = gf.at(0, 9.6, -1.8);
    glow(gl, 3, 0xffb060);
    ctx.lamps.push(gl);
    // the keep: a tall block, four turrets, a great tower with the royal standard
    const kf = new Frame(W(fx), fy, fz + 2, 0);
    const kh = 30;
    box("stoneGrey", 22, kh, 17, kf, 0, kh / 2, 0);
    box("stoneGrey", 23, 0.8, 18, kf, 0, kh - 0.2, 0, 0, 0, 0, 0xc8c8c8);
    for (let k = 0; k < 11; k++) for (const s of [-1, 1]) box("stoneGrey", 1.0, 1.2, 0.6, kf, -10 + k * 2, kh + 0.6, s * 8.6);
    for (let k = 0; k < 8; k++) for (const s of [-1, 1]) box("stoneGrey", 0.6, 1.2, 1.0, kf, s * 11.1, kh + 0.6, -7 + k * 2);
    for (const [tx, tz] of [[-11, -8.5], [11, -8.5], [-11, 8.5], [11, 8.5]]) {
      cyl("stoneGrey", 2.6, 2.8, kh + 7, 14, kf, tx, (kh + 7) / 2, tz);
      put(ctx, "shingle", new THREE.ConeGeometry(3.4, 7, 14), kf, tx, kh + 10.4, tz, 0, 0, 0, 0x4a5262);
    }
    box("stoneGrey", 8, 14, 8, kf, -3, kh + 7, 1);
    put(ctx, "shingle", new THREE.ConeGeometry(6.4, 9, 4), kf, -3, kh + 18.5, 1, 0, Math.PI / 4, 0, 0x4a5262);
    cyl("flat", 0.12, 0.12, 9, 5, kf, -3, kh + 26, 1, 0x3a3028);
    // great windows on the town face, lit
    for (let k = 0; k < 5; k++) {
      for (const y of [12, 20]) {
        box("window", 1.0, 2.6, 0.1, kf, -8 + k * 4, y, -8.55, 0, 0, 0, 0xffffff, false);
        glow(kf.at(-8 + k * 4, y, -8.9), 3.6, 0xffb060);
      }
    }
    // three long banners down the keep's face, and the standard on the great tower
    for (const k of [-6, 0, 6]) banner(kf.at(k, kh - 1.5, -8.7), Math.PI, 2.2, 8);
    banner(kf.at(-3 + 0.1, kh + 30, 1.0), Math.PI / 2, 4.0, 2.4);
    anchors.fortress = new THREE.Vector3(W(fx), fy, fz);
  }

  // ------------------------------------------------------------ Millcross: cottages, a windmill, the loft and its chest
  const sails = new THREE.Group();
  {
    doors.aldo = cottage(ctx, W(-86), -52, 5.4, 5, -Math.PI / 2, { roof: "thatch", seed: 71, doorX: 0, chimney: true }).door;
    cottage(ctx, W(-110), -61, 5.6, 5, Math.PI / 2, { roof: "thatch", seed: 72, chimney: true });
    cottage(ctx, W(-106.5), -71.5, 5.0, 4.6, Math.PI / 4, { roof: "thatch", seed: 73 });
    cottage(ctx, W(-114), -49, 6.0, 5, Math.PI / 2 + 0.4, { roof: "thatch", seed: 74, chimney: true });
    // the windmill
    const mx = -101.5;
    const mz = -49.5;
    const face = Math.atan2(-96 - mx, -58 - mz);
    const mf = new Frame(W(mx), hL(mx, mz) - 0.6, mz, face);
    put(ctx, "stone", cylUV(2.5, 3.5, 11, 14), mf, 0, 5.5, 0);
    put(ctx, "thatch", new THREE.ConeGeometry(3.1, 3.6, 14), mf, 0, 12.7, 0, 0, 0, 0, 0xd8c8a0);
    box("planksDark", 1.2, 2.0, 0.2, mf, 0, 1.6, 3.35, -0.08, 0, 0, 0xd0c0b0);
    box("window", 0.6, 0.6, 0.1, mf, 0, 6.6, 3.0, -0.08, 0, 0, 0xffffff, false);
    glow(mf.at(0, 6.6, 3.2), 1.6, 0xffa040);
    put(ctx, "flat", new THREE.CylinderGeometry(0.18, 0.18, 1.6, 8), mf, 0, 10.5, 2.9, Math.PI / 2, 0, 0, T.timber);
    col.circle(W(mx), mz, 3.6);
    // sails: one merged mesh, turned in update()
    const parts: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      const spar = new THREE.BoxGeometry(0.22, 7.6, 0.16);
      spar.translate(0, 3.9, 0);
      spar.rotateZ(a);
      parts.push(prep(spar, T.timber));
      const cloth = new THREE.BoxGeometry(1.5, 5.6, 0.04);
      cloth.translate(0.86, 4.6, -0.04);
      cloth.rotateZ(a);
      parts.push(prep(cloth, T.cloth));
      for (let k = 0; k < 5; k++) {
        const bar = new THREE.BoxGeometry(1.6, 0.06, 0.08);
        bar.translate(0.86, 2.2 + k * 1.2, 0.02);
        bar.rotateZ(a);
        parts.push(prep(bar, T.timber));
      }
    }
    const hub = new THREE.SphereGeometry(0.35, 8, 6);
    parts.push(prep(hub, T.timber));
    const sailGeo = mergeGeometries(parts, false)!;
    const sailMesh = new THREE.Mesh(sailGeo, M.flat);
    sailMesh.castShadow = true;
    sails.add(sailMesh);
    sails.position.copy(mf.at(0, 10.5, 3.75));
    sails.rotation.set(0, face, 0);
    root.add(sails);
    anchors.mill = new THREE.Vector3(W(mx), hL(mx, mz), mz);
    // the loft: a raised hay floor on posts, a ladder, the chest under its edge
    const lf = F(-97, -55.4, face);
    for (const [px, pz] of [[-1.9, -1.4], [1.9, -1.4], [-1.9, 1.4], [1.9, 1.4]]) {
      box("flat", 0.2, 3.6, 0.2, lf, px, 1.8, pz, 0, 0, 0, T.timber);
      const p = lf.at(px, 0, pz);
      col.circle(p.x, p.z, 0.18);
    }
    box("planks", 4.2, 0.16, 3.2, lf, 0, 2.4, 0);
    for (let k = 0; k < 3; k++) put(ctx, "thatch", new THREE.CylinderGeometry(0.5, 0.5, 1.1, 10), lf, -1.2 + k * 1.2, 3.0, -0.4, 0, 0, Math.PI / 2, 0xffeac0);
    for (const s of [-1, 1]) box("shingle", 4.8, 0.12, 2.1, lf, 0, 4.3, s * 0.85, s * 0.5, 0, 0);
    for (const s of [-1, 1]) box("flat", 0.08, 2.8, 0.08, lf, 0.9 + s * 0.22, 1.3, 1.9, -0.32, 0, 0, T.wood);
    for (let k = 0; k < 6; k++) box("flat", 0.5, 0.06, 0.06, lf, 0.9, 0.3 + k * 0.42, 1.55 + k * 0.12, -0.32, 0, 0, T.wood);
    const chest = CACHE_DEFS.find((c) => c.id === "mill_loft");
    if (chest) {
      const cx = chest.x - 0.4;
      const cz = chest.z + 1.0;
      const cf = F(cx, cz, face + Math.PI / 2);
      put(ctx, "planksDark", new THREE.BoxGeometry(1.0, 0.6, 0.6), cf, 0, 0.3, 0);
      put(ctx, "planksDark", new THREE.CylinderGeometry(0.3, 0.3, 1.0, 10, 1, false, 0, Math.PI), cf, 0, 0.6, 0, 0, 0, Math.PI / 2);
      for (const s of [-0.38, 0.38]) put(ctx, "metal", new THREE.BoxGeometry(0.06, 0.92, 0.64), cf, s, 0.45, 0, 0, 0, 0, T.iron, false);
      put(ctx, "metal", new THREE.BoxGeometry(0.16, 0.16, 0.06), cf, 0, 0.55, 0.31, 0, 0, 0, 0xb87333, false);
      col.box(W(cx), cz, 1.1, 0.7, face + Math.PI / 2);
      anchors.millLoft = new THREE.Vector3(W(chest.x), hL(chest.x, chest.z), chest.z);
    }
    well(ctx, W(-91.4), -64.4);
    hay(ctx, W(-104.4), -57.0, 0.3);
    hay(ctx, W(-103.2), -55.8, 1.3);
    cart(ctx, W(-90.5), -47.2, 0.9);
    trough(ctx, W(-80.2), -58.4, Math.PI / 2);
    for (const [x, z] of [[-112.4, -65.0], [-88.6, -49.0]] as const) barrel(ctx, W(x), z);
    sack(ctx, W(-95.2), -56.4);
    sack(ctx, W(-95.8), -56.0);
    // a sheep pen, gate broken (the hounds)
    fence(ctx, [[W(-78), -64], [W(-72), -64], [W(-72), -72], [W(-78), -72], [W(-78), -68.6]]);
    cabbages(ctx, W(-113), -55.6, 3.0, 2.4);
    lamp(ctx, W(-91.4), -55.2, Math.PI);
    root.add(signpost(ctx, W(-66), -9, Math.PI * 0.8, new THREE.MeshLambertMaterial({ map: signTex("trade"), vertexColors: true })));
  }

  // ------------------------------------------------------------ the bandit camp on the old quarry road
  const tent = (x: number, z: number, rot: number, w: number, color: number) => {
    const f = F(x, z, rot);
    // two canvas slopes meeting at the ridge pole (2.1 up, 1.25 out each side)
    for (const s of [-1, 1]) box("flat", w, 0.06, 2.46, f, 0, 1.05, s * 0.625, s * 1.033, 0, 0, color);
    box("flat", 0.1, 2.1, 0.1, f, -w / 2 + 0.1, 1.05, 0, 0, 0, 0, T.timber);
    box("flat", 0.1, 2.1, 0.1, f, w / 2 - 0.1, 1.05, 0, 0, 0, 0, T.timber);
    box("flat", w + 0.3, 0.08, 0.08, f, 0, 2.1, 0, 0, 0, 0, T.timber);
    col.box(W(x), z, w, 2.6, rot);
  };
  const campfire = (x: number, z: number) => {
    const f = F(x, z, r() * 6);
    for (let k = 0; k < 8; k++) {
      const q = (k / 8) * Math.PI * 2;
      put(ctx, "stone", rockGeo(90 + k, false, 0x7a746a).scale(0.24, 0.2, 0.24), f, Math.cos(q) * 0.65, 0.05, Math.sin(q) * 0.65, 0, q, 0, 0xffffff);
    }
    for (let k = 0; k < 4; k++) put(ctx, "bark", new THREE.CylinderGeometry(0.06, 0.07, 0.9, 5), f, 0, 0.18, 0, 1.2, (k / 4) * Math.PI * 2, 0, 0xffffff);
    put(ctx, "ember", new THREE.ConeGeometry(0.32, 0.45, 6), f, 0, 0.25, 0, 0, 0, 0, 0xffffff, false);
    const p = f.at(0, 0.45, 0);
    ctx.fires.push(p);
    ctx.smoke.push(f.at(0, 1.2, 0));
    glow(p, 4.5, 0xff8a38);
    col.circle(W(x), z, 0.8);
  };
  /** a broken run of sharpened stakes along an arc (degrees) */
  const stakes = (cx: number, cz: number, rad: number, a0: number, a1: number, seed: number) => {
    const sr = rng(seed);
    const n = Math.round((((a1 - a0) * Math.PI) / 180) * rad / 0.5);
    for (let i = 0; i <= n; i++) {
      if (sr() < 0.12) continue;
      const a = ((a0 + ((a1 - a0) * i) / n) * Math.PI) / 180;
      const x = cx + Math.cos(a) * rad;
      const z = cz + Math.sin(a) * rad;
      const h = 2.4 + sr() * 1.0;
      const f = F(x, z, -a);
      put(ctx, "bark", new THREE.CylinderGeometry(0.17, 0.2, h, 6), f, 0, h / 2 - 0.3, 0, (sr() - 0.5) * 0.12, 0, 0.12, 0xffffff);
      put(ctx, "bark", new THREE.ConeGeometry(0.17, 0.45, 6), f, 0, h - 0.1, 0, 0, 0, 0.12, 0xd8c8b0);
      if (i % 2 === 0) col.circle(W(x), z, 0.4);
    }
  };
  {
    tent(105.5, -77, -Math.PI / 2 + 0.3, 2.6, 0x7a6a52);
    tent(88.4, -70.6, 0.4, 2.4, 0x6a5a48);
    tent(106.8, -91.6, -0.8, 2.6, 0x8a7a5a);
    tent(82.4, -86.2, Math.PI / 2 - 0.2, 2.2, 0x6e5e4a);
    campfire(91.6, -79.4);
    stakes(CAMP.x - 1, CAMP.z + 1, 17, 200, 250, 5);
    stakes(CAMP.x - 1, CAMP.z + 1, 17, 285, 335, 6);
    stakes(CAMP.x - 1, CAMP.z + 1, 17, 20, 70, 7);
    stakes(CAMP.x - 1, CAMP.z + 1, 17, 100, 150, 8);
    // the strongbox: iron-bound oak, padlocked
    const sb = CACHE_DEFS.find((c) => c.id === "bandit_strongbox");
    if (sb) {
      const bx = sb.x + 0.3;
      const bz = sb.z + 0.9;
      const f = F(bx, bz, 0.25);
      put(ctx, "planksDark", boxUV(1.1, 0.7, 0.7, 1, 1), f, 0, 0.35, 0, 0, 0, 0, 0x8a7060);
      put(ctx, "planksDark", boxUV(1.14, 0.14, 0.74, 1, 1), f, 0, 0.76, 0, 0, 0, 0, 0x8a7060);
      for (const s of [-0.42, 0, 0.42]) put(ctx, "metal", new THREE.BoxGeometry(0.1, 0.86, 0.78), f, s, 0.42, 0, 0, 0, 0, T.iron, false);
      put(ctx, "metal", new THREE.BoxGeometry(1.18, 0.08, 0.78), f, 0, 0.08, 0, 0, 0, 0, T.iron, false);
      put(ctx, "metal", new THREE.TorusGeometry(0.1, 0.025, 5, 10), f, 0, 0.5, 0.42, 0, 0, 0, 0x6a6a6a, false);
      put(ctx, "metal", new THREE.BoxGeometry(0.18, 0.16, 0.08), f, 0, 0.36, 0.42, 0, 0, 0, 0x6a6a6a, false);
      col.box(W(bx), bz, 1.2, 0.8, 0.25);
      anchors.strongbox = new THREE.Vector3(W(sb.x), hL(sb.x, sb.z), sb.z);
    }
    for (const [x, z] of [[100.4, -80.2], [101.2, -79.6], [89.4, -86.6]] as const) crate(ctx, W(x), z, 0.7, x);
    for (const [x, z] of [[99.2, -86.4], [84.6, -74.2]] as const) barrel(ctx, W(x), z);
    for (const [x, z] of [[93.8, -74.2], [90.2, -76.4]] as const) sack(ctx, W(x), z);
    // a stolen cart of quarry stone, and the stone they took as toll
    cart(ctx, W(80.2), -79.0, Math.PI / 2 - 0.2);
    for (let k = 0; k < 5; k++) put(ctx, "stoneGrey", boxUV(0.9, 0.5, 0.6, 1, 1), F(103.6 + (k % 3) * 0.95, -84.6 + Math.floor(k / 3) * 0.7), 0, 0.25 + Math.floor(k / 3) * 0.5, 0, 0, k * 0.2, 0, 0xc0c0c0);
    col.box(W(104.6), -84.3, 3.0, 1.4, 0);
    // bedrolls
    for (const [x, z, a] of [[95.2, -74.2, 0.3], [99.8, -76.4, 1.1]] as const) box("flat", 0.8, 0.12, 1.9, F(x, z, a), 0, 0.06, 0, 0, 0, 0, 0x6a5a48, false);
    anchors.banditCamp = new THREE.Vector3(W(CAMP.x), hL(CAMP.x, CAMP.z), CAMP.z);
  }
  // the roadside ambush on the Kingsroad: a broken cart, a lean-to
  {
    cart(ctx, W(-90.4), 11.2, 1.9);
    const f = F(-98.6, 31.6, 0.6);
    for (const s of [-1, 1]) box("flat", 0.1, 1.9, 0.1, f, s * 1.3, 0.95, 1.0, 0, 0, 0, T.timber);
    box("planks", 2.9, 0.08, 2.4, f, 0, 1.25, 0, 0.6, 0, 0, 0x9a8a72);
    col.box(W(-98.6), 31.6, 2.9, 2.2, 0.6);
    campfire(-95.2, 29.2);
  }

  // ------------------------------------------------------------ the old beacon and the deserters' camp
  {
    const bx = 101.5;
    const bz = 98;
    const base = hL(bx, bz) - 0.8;
    const f = new Frame(W(bx), base, bz, 0.4);
    const rr = rng(311);
    // broken drum: rings of blocks, missing more the higher they go
    for (let ring = 0; ring < 14; ring++) {
      const y = ring * 0.85 + 0.42;
      const n = 14;
      const cut = ring > 7 ? 0.25 + (ring - 7) * 0.09 : 0;
      for (let k = 0; k < n; k++) {
        const q = ((k + (ring % 2) * 0.5) / n) * Math.PI * 2;
        if (ring > 4 && Math.sin(q * 1.0 + 1.2) > 1 - cut * 2.4) continue;
        if (rr() < cut * 0.6) continue;
        box("stoneGrey", 1.55, 0.82, 0.9, f, Math.cos(q) * 3.4, y, Math.sin(q) * 3.4, 0, -q + Math.PI / 2, 0, 0xb8b4ac);
      }
    }
    // the iron beacon cage, cold
    for (let k = 0; k < 6; k++) {
      const q = (k / 6) * Math.PI * 2;
      put(ctx, "metal", new THREE.BoxGeometry(0.08, 1.4, 0.08), f, Math.cos(q) * 0.7, 6.4, Math.sin(q) * 0.7, Math.sin(q) * 0.3, 0, -Math.cos(q) * 0.3, 0x3a3a3a, false);
    }
    put(ctx, "metal", new THREE.TorusGeometry(0.95, 0.05, 5, 14), f, 0, 7.1, 0, Math.PI / 2, 0, 0, 0x3a3a3a, false);
    box("planks", 2.6, 0.12, 2.6, f, 0, 5.7, 0, 0, 0.3, 0, 0x8a7a62);
    // fallen blocks around it
    for (let k = 0; k < 9; k++) {
      const q = rr() * Math.PI * 2;
      const d = 4.6 + rr() * 3;
      const px = bx + Math.cos(q) * d;
      const pz = bz + Math.sin(q) * d;
      if (Math.hypot(px - 100, pz - 92) < 2.5 || Math.hypot(px - 94, pz - 100) < 2.5) continue;
      put(ctx, "stoneGrey", boxUV(1.4, 0.8, 0.9, 1, 1), F(px, pz, rr() * 3), 0, 0.3, 0, rr() * 0.4, 0, rr() * 0.4, 0xb0aca4);
    }
    col.circle(W(bx), bz, 4.0);
    anchors.beacon = new THREE.Vector3(W(BEACON.x), hL(BEACON.x, BEACON.z), BEACON.z);
    tent(110.8, 95.6, Math.PI / 2 + 0.2, 2.6, 0x5a5a4a);
    tent(91.4, 90.2, -0.5, 2.4, 0x4a4a42);
    campfire(103.6, 89.2);
    for (const [x, z] of [[107.6, 101.4], [95.4, 94.6]] as const) crate(ctx, W(x), z, 0.7, x);
    barrel(ctx, W(96.6), 95.6);
    // a weapon rack and a torn Kingdom banner left on a pole
    const wf = F(106.4, 90.4, -0.6);
    for (const s of [-1, 1]) box("flat", 0.1, 1.4, 0.1, wf, s * 0.8, 0.7, 0, 0, 0, 0, T.timber);
    box("flat", 1.8, 0.08, 0.08, wf, 0, 1.3, 0, 0, 0, 0, T.timber);
    for (let i = 0; i < 4; i++) put(ctx, "metal", new THREE.BoxGeometry(0.05, 1.4, 0.05), wf, -0.6 + i * 0.4, 0.75, 0.1, 0.15, 0, 0.1, 0xa0a4a8, false);
    col.box(W(106.4), 90.4, 1.9, 0.4, -0.6);
    const pf = F(98.4, 87.8, 0);
    box("flat", 0.12, 4.6, 0.12, pf, 0, 2.3, 0, 0, 0, 0.05, T.timber);
    col.circle(W(98.4), 87.8, 0.15);
    banner(pf.at(0.7, 4.5, 0), 0.4, 1.1, 1.9);
    for (const [x, z, a] of [[97.2, 91.0, 0.4], [108.6, 92.6, 1.2], [100.8, 102.8, 2.2]] as const) box("flat", 0.8, 0.12, 1.9, F(x, z, a), 0, 0.06, 0, 0, 0, 0, 0x5a5048, false);
  }

  // ------------------------------------------------------------ the quarry: cut faces, spoil, a derrick
  {
    const qr = rng(919);
    for (let k = 0; k < 22; k++) {
      const a = (-110 + k * 11) * (Math.PI / 180);
      const rr = PIT.r + 0.6 + qr() * 0.6;
      const x = PIT.x + Math.cos(a) * rr;
      const z = PIT.z + Math.sin(a) * rr * 1.05;
      if (x < PIT.x - 6 || !clearOf(x, z, 2.5)) continue;
      const top = hL(x + Math.cos(a) * 3.5, z + Math.sin(a) * 3.5);
      const floor = hL(PIT.x + Math.cos(a) * (PIT.r - 2), PIT.z + Math.sin(a) * (PIT.r - 2));
      const hgt = Math.max(2.5, top - floor + 1.2);
      const f = new Frame(W(x), floor - 0.5, z, Math.atan2(-Math.cos(a), -Math.sin(a)));
      const w = 5.2 + qr() * 1.6;
      // stepped benches of cut stone
      box("stoneGrey", w, hgt, 3.6, f, 0, hgt / 2, -1.2, 0, 0, 0, 0xa8a49c);
      if (hgt > 4) box("stoneGrey", w * 0.9, hgt * 0.45, 1.4, f, 0, hgt * 0.22, 1.1, 0, 0, 0, 0x9a968e);
      const cp = f.at(0, 0, -0.6);
      col.box(cp.x, cp.z, w, 3.6, Math.atan2(-Math.cos(a), -Math.sin(a)));
    }
    // spoil heaps: a slumped mound of broken stone
    const heap = (x: number, z: number, s: number, seed: number) => {
      const g = rockGeo(seed, false, 0x8a847a);
      g.scale(s * 2.2, s * 0.9, s * 2.0);
      put(ctx, "stoneGrey", g, F(x, z, seed * 0.7), 0, -0.3, 0, 0, 0, 0, 0xffffff);
      col.circle(W(x), z, s * 1.6);
    };
    heap(104, 29, 2.2, 11);
    heap(108.5, 59, 1.8, 12);
    heap(141, 22, 2.0, 13);
    // cut blocks waiting for carts
    for (let k = 0; k < 6; k++) put(ctx, "stoneGrey", boxUV(1.2, 0.7, 0.8, 1, 1), F(111 + (k % 3) * 1.3, 36.5 + Math.floor(k / 3) * 0.9), 0, 0.35 + Math.floor(k / 3) * 0.05, 0, 0, (k % 2) * 0.1, 0, 0xc8c4bc);
    col.box(W(112.3), 37, 4.0, 2.0, 0);
    // the derrick: an A-frame of timber, a jib and a hanging block
    const df = F(127.2, 36.6, 0.5);
    for (const s of [-1, 1]) box("flat", 0.24, 7.2, 0.24, df, s * 1.3, 3.4, 0, 0, 0, s * 0.18, T.timber);
    box("flat", 0.2, 0.2, 5.8, df, 0, 6.6, 2.2, -0.35, 0, 0, T.timber);
    box("metal", 0.02, 3.4, 0.02, df, 0, 4.6, 4.6, 0, 0, 0, 0x3a3028, false);
    box("stoneGrey", 0.9, 0.6, 0.6, df, 0, 2.6, 4.6, 0, 0.3, 0, 0xc8c4bc);
    put(ctx, "flat", new THREE.CylinderGeometry(0.35, 0.35, 0.8, 10), df, 0, 1.0, -0.4, 0, 0, Math.PI / 2, T.wood);
    for (const s of [-1, 1]) {
      const p = df.at(s * 1.3, 0, 0);
      col.circle(p.x, p.z, 0.3);
    }
    // a lean-to for the quarrymen, a cart, tools
    cottage(ctx, W(106.6), 51.2, 4.2, 3.6, Math.PI / 2 + 0.3, { roof: "shingle", seed: 81, chimney: false, h: 2.4 });
    cart(ctx, W(117.2), 40.0, Math.PI / 2);
    barrel(ctx, W(109.2), 47.4);
    crate(ctx, W(109.8), 46.4, 0.6, 0.4);
    woodpile(ctx, W(103.6), 48.4, Math.PI / 2);
    anchors.quarry = new THREE.Vector3(W(PIT.x), hL(PIT.x, PIT.z), PIT.z);
  }

  // ------------------------------------------------------------ the causeway, the chain and its seal
  const chain = { open: env.flag("causeway"), p: env.flag("causeway") ? 1 : 0, sounded: env.flag("causeway") };
  const chainLinks = 26;
  const linkMat = new THREE.MeshPhongMaterial({ color: 0x3a3b3e, shininess: 50, specular: 0x666666 });
  const linkGeo = new THREE.TorusGeometry(0.13, 0.042, 5, 10);
  linkGeo.scale(1.55, 1, 1);
  const links = new THREE.InstancedMesh(linkGeo, linkMat, chainLinks);
  links.castShadow = true;
  links.frustumCulled = false;
  root.add(links);
  const seal = new THREE.Group();
  {
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.06, 14), new THREE.MeshLambertMaterial({ color: 0x8e2f2f }));
    disc.rotation.x = Math.PI / 2;
    disc.position.y = -0.34;
    const ribbon = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.34, 0.02), new THREE.MeshLambertMaterial({ color: 0x2f3a4a }));
    ribbon.position.y = -0.14;
    seal.add(disc, ribbon);
    root.add(seal);
  }
  const postX = 3.0;
  const postTop = DECK_H + 1.15;
  {
    const z0 = -116;
    const z1 = -262;
    // the deck past the play bounds (inside them the ground is the deck)
    const fz = new Frame(W(0), DECK_H, (B.minZ + z1) / 2, 0);
    box("stone", CW_HALF * 2, 1.6, B.minZ - z1 + 6, fz, 0, -0.8, 0, 0, 0, 0, 0xc8c0b0);
    // retaining walls and kerbs along both sides
    for (const s of [-1, 1]) {
      const n = Math.ceil((z0 - z1) / 4);
      for (let k = 0; k < n; k++) {
        const z = z0 - k * 4 - 2;
        const f = new Frame(W(s * (CW_HALF + 0.05)), DECK_H, z, 0);
        box("stone", 0.6, 2.6, 4.05, f, 0, -1.15, 0, 0, 0, 0, 0xb8b0a0);
        if (k % 2 === 0) box("stone", 0.5, 0.35, 1.6, f, 0, 0.3, 0, 0, 0, 0, 0xd0c8b8);
      }
    }
    // the chain posts: squat stone bollards with iron rings
    for (const s of [-1, 1]) {
      const f = new Frame(W(s * postX), DECK_H, CHAIN_Z, 0);
      cyl("stone", 0.32, 0.4, 1.3, 10, f, 0, 0.65, 0, 0xd0c8b8);
      put(ctx, "stone", new THREE.SphereGeometry(0.34, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), f, 0, 1.28, 0, 0, 0, 0, 0xd0c8b8);
      put(ctx, "metal", new THREE.TorusGeometry(0.16, 0.04, 5, 10), f, -s * 0.36, 1.15, 0, 0, Math.PI / 2, 0, T.iron, false);
      col.circle(W(s * postX), CHAIN_Z, 0.45);
    }
    // a notice board by the chain: the Castellan's order, sealed
    const nf = new Frame(W(-4.6), DECK_H, CHAIN_Z + 2.4, Math.PI / 2);
    box("flat", 0.12, 2.0, 0.12, nf, 0, 1.0, 0, 0, 0, 0, T.timber);
    box("planks", 0.8, 0.6, 0.06, nf, 0, 1.7, 0.08, 0, 0, 0, 0xc8b8a0);
    box("flat", 0.6, 0.4, 0.02, nf, 0, 1.72, 0.12, 0, 0, 0, 0xe0d4b8, false);
    put(ctx, "flat", new THREE.CylinderGeometry(0.07, 0.07, 0.03, 10), nf, 0.18, 1.6, 0.14, Math.PI / 2, 0, 0, 0x8e2f2f, false);
    // dead reeds and a drowned bell-post far out on the water, for the smell of it
    const bf = new Frame(W(-22), WL - 0.4, -150, 0.3);
    box("flat", 0.2, 4.2, 0.2, bf, 0, 2.1, 0, 0.12, 0, 0.05, 0x2a2622);
    box("flat", 1.2, 0.14, 0.14, bf, 0, 3.9, 0, 0.12, 0, 0.05, 0x2a2622);
    put(ctx, "metal", new THREE.LatheGeometry([new THREE.Vector2(0.04, 0), new THREE.Vector2(0.18, 0.05), new THREE.Vector2(0.22, 0.3), new THREE.Vector2(0.3, 0.5), new THREE.Vector2(0, 0.5)], 10), bf, 0.4, 3.75, 0, Math.PI, 0, 0, 0x5a6a4a);
    col.circle(W(-22), -150, 0.3);
    col.box(W(0), CHAIN_Z, postX * 2, 0.6, 0, () => !chain.open);
    anchors.causeway = new THREE.Vector3(W(0), DECK_H, CHAIN_Z);
    root.add(signpost(ctx, W(-4.2), -118, Math.PI, new THREE.MeshLambertMaterial({ map: signTex("north"), vertexColors: true })));
  }
  const linkM = new THREE.Matrix4();
  const linkQ = new THREE.Quaternion();
  const linkE = new THREE.Euler();
  const linkP = new THREE.Vector3();
  const linkS = new THREE.Vector3(1, 1, 1);
  const layChain = () => {
    const p = chain.p;
    const fall = (k: number) => k * k;
    const groundY = DECK_H + 0.05;
    const rx = lerp(postX - 0.36, postX - 1.0, fall(clamp(p * 1.4, 0, 1)));
    const ry = lerp(postTop, groundY, fall(clamp(p * 1.4, 0, 1)));
    const lx0 = lerp(-postX + 0.36, -postX + 0.7, fall(clamp((p - 0.35) * 1.6, 0, 1)));
    const ly = lerp(postTop, groundY, fall(clamp((p - 0.35) * 1.6, 0, 1)));
    const sag = lerp(0.55, 0.0, clamp(p * 1.2, 0, 1));
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i < chainLinks; i++) {
      const s = i / (chainLinks - 1);
      const x = lerp(lx0, rx, s);
      let y = lerp(ly, ry, s) - sag * (1 - (2 * s - 1) ** 2);
      // lying on the deck it wanders a little
      const wob = p > 0.5 ? Math.sin(s * 9 + 1.3) * 0.25 * clamp((p - 0.5) * 2, 0, 1) : 0;
      y = Math.max(groundY, y);
      pts.push(new THREE.Vector3(W(x), y, CHAIN_Z + wob));
    }
    for (let i = 0; i < chainLinks; i++) {
      const a = pts[Math.max(0, i - 1)];
      const b = pts[Math.min(chainLinks - 1, i + 1)];
      const yaw = Math.atan2(-(b.z - a.z), b.x - a.x);
      const pitch = Math.atan2(b.y - a.y, Math.hypot(b.x - a.x, b.z - a.z));
      linkE.set(i % 2 ? Math.PI / 2 : 0, yaw, pitch, "YZX");
      linkQ.setFromEuler(linkE);
      linkP.copy(pts[i]);
      linkM.compose(linkP, linkQ, linkS);
      links.setMatrixAt(i, linkM);
    }
    links.instanceMatrix.needsUpdate = true;
    const mid = pts[Math.floor(chainLinks / 2)];
    seal.position.set(mid.x, mid.y - 0.04, mid.z);
    seal.visible = p < 0.03;
  };
  layChain();

  // ------------------------------------------------------------ water: the marsh to the south
  const waterMat = new THREE.MeshPhongMaterial({
    color: 0x1f2a1e, specular: 0x8a9a7a, shininess: 70, transparent: true, opacity: 0.9, normalMap: waterNormalTex(), normalScale: new THREE.Vector2(0.5, 0.5),
  });
  {
    const g = new THREE.PlaneGeometry(700, 340, 1, 1);
    g.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(g, waterMat);
    m.position.set(W(0), WL, -104 - 170);
    m.renderOrder = 2;
    m.receiveShadow = true;
    root.add(m);
    if (waterMat.normalMap) {
      waterMat.normalMap.repeat.set(30, 15);
      waterMat.normalMap.wrapS = waterMat.normalMap.wrapT = THREE.RepeatWrapping;
    }
  }

  // ------------------------------------------------------------ signs and milestones along the roads
  root.add(signpost(ctx, W(-150), 4.2, -Math.PI / 2, new THREE.MeshLambertMaterial({ map: signTex("east"), vertexColors: true })));
  root.add(signpost(ctx, W(6.2), 60.4, Math.PI * 0.85, new THREE.MeshLambertMaterial({ map: signTex("north"), vertexColors: true })));
  root.add(signpost(ctx, W(58.6), 152, Math.PI, new THREE.MeshLambertMaterial({ map: signTex("north"), vertexColors: true })));
  for (const [x, z] of [[-120, 3.8], [-82, -3.8], [30, 62.8], [3.6, -88]] as const) {
    const f = F(x, z, r() * 3);
    box("stone", 0.5, 1.0, 0.36, f, 0, 0.4, 0, 0, 0, 0.03, 0xd8d0c0);
    col.circle(W(x), z, 0.35);
  }
  for (const [x, z, a] of [[-49.5, -4.6, Math.PI / 2], [-49.5, 4.6, Math.PI / 2], [4.6, 49.5, Math.PI], [-4.6, -49.5, 0]] as const) lamp(ctx, W(x), z, a);
  // scarecrows in the wheat
  for (const [x, z] of [[-74, -36], [44, -70], [-122, -20]] as const) {
    const f = F(x, z, r() * 3);
    box("flat", 0.12, 2.4, 0.12, f, 0, 1.2, 0, 0, 0, 0, 0x5b4632);
    box("flat", 1.5, 0.1, 0.1, f, 0, 1.85, 0, 0, 0, 0, 0x5b4632);
    box("flat", 0.7, 0.8, 0.3, f, 0, 1.55, 0, 0, 0, 0.05, 0x8a7a5a);
    put(ctx, "flat", new THREE.SphereGeometry(0.22, 8, 6), f, 0, 2.2, 0, 0, 0, 0, 0xcdbba6);
    put(ctx, "thatch", new THREE.ConeGeometry(0.4, 0.3, 8), f, 0, 2.45, 0, 0, 0, 0, 0xffe0b0);
    col.circle(W(x), z, 0.3);
  }
  // haystacks and a field barn or two
  for (const [x, z, a] of [[-64, -58, 0.3], [-66, -59.4, 1.4], [30, -88, 0.8], [-128, 8, 0.2]] as const) hay(ctx, W(x), z, a);
  cottage(ctx, W(-132), -38, 8, 6, 0.1, { roof: "thatch", seed: 91, chimney: false, h: 3.4 });
  cottage(ctx, W(58), -96, 7, 5.5, -0.5, { roof: "thatch", seed: 92, chimney: true });

  // ------------------------------------------------------------ far horizon: fogged hills all round, a white tooth north
  {
    const parts: THREE.BufferGeometry[] = [];
    const fr = rng(57);
    for (let i = 0; i < 40; i++) {
      const a = (i / 40) * Math.PI * 2;
      const d = 280 + fr() * 70;
      const x = Math.cos(a) * d;
      const z = Math.sin(a) * d;
      if (z < -120 && Math.abs(x) < 220) continue; // the Mire stays flat
      const g = new THREE.SphereGeometry(1, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2);
      g.scale(60 + fr() * 50, 22 + fr() * 26 + (z > 100 ? 18 : 0), 60 + fr() * 50);
      g.translate(W(x), -6, z);
      parts.push(tint(g, z > 80 ? 0x24301e : 0x3a4a2c));
    }
    const mtn = new THREE.ConeGeometry(240, 300, 24, 4);
    mtn.translate(W(-60), 150 - 100, 1100);
    parts.push(tint(mtn, 0xc8ccd4));
    const far = mergeGeometries(parts.map((g) => prep(g)), false);
    if (far) {
      const m = new THREE.Mesh(far, M.flat);
      m.frustumCulled = false;
      root.add(m);
    }
  }

  // ------------------------------------------------------------ nodes, then scatter that keeps clear of them
  const nodes = zoneNodes(M, root, col, "kingdom", groundAt);

  const scatters: Cullable[] = [];
  const forest = new ChunkBatch(96, 170);
  const clutter = new ChunkBatch(64, 110);
  const wheatSet = new Scatter([{ geo: wheatGeo(), mat: M.wheat }], 64, 130);
  const grassSets = [0, 1].map((i) => new Scatter([{ geo: grassGeo(i + 41, 14, 0.36), mat: M.grass }], 48, 55));
  scatters.push(forest, clutter, wheatSet);
  const trees: Record<string, ReturnType<typeof treeGeo>[]> = {};
  for (const k of ["oak", "beech", "pine", "young"] as TreeKind[]) trees[k] = [0, 1].map((v) => treeGeo(k, v + 21));
  const sway = (k: TreeKind) => ({ from: k === "pine" ? 6 : k === "young" ? 2 : 5, scale: 10 });
  const radiusOf = (k: TreeKind) => (k === "oak" ? 0.7 : k === "pine" ? 0.4 : k === "beech" ? 0.3 : 0.2);
  const hedgeG = bushGeo(91, 1.2, true);
  const bushGs = [bushGeo(5, 1, true), bushGeo(6, 1, true)];
  const rocks = [rockGeo(3), rockGeo(4)];
  const logG = logGeo(4, 0.36);
  const stumpG = stumpGeo(0.45, 0.5);
  const marigold = flowerGeo(77);
  tint(marigold, (_x, y) => (y > 0.15 ? new THREE.Color(0xe88a2a) : new THREE.Color(0x4e5e34)));
  const wild = flowerGeo(13);

  const woodNodes = NODE_DEFS.filter((d) => d.zone === "kingdom" && d.kind === "wood");
  const inPlay = (x: number, z: number) => x > B.minX && x < B.maxX && z > B.minZ && z < B.maxZ;
  /** no trees here: town, fortress, camps, quarry, roads, the marsh's open water */
  const noTree = (x: number, z: number) => {
    if (Math.hypot(x, z) < 56) return true;
    if (fortDist(x, z) < 21) return true;
    if (Math.hypot(x - MILL.x, z - MILL.z) < 22) return true;
    if (Math.hypot(x - CAMP.x, z - CAMP.z) < 22) return true;
    if (Math.hypot(x - BEACON.x, z - BEACON.z) < 18) return true;
    if (pitDist(x, z) < PIT.r + 9) return true;
    if (Math.abs(x) < 9 && z < -100) return true;
    if (rdAt(x, z) < 6.5) return true;
    if (inPlay(x, z) && !clearOf(x, z, 1)) return true;
    if (Math.hypot(x + 132, z + 38) < 9 || Math.hypot(x - 58, z + 96) < 8 || Math.hypot(x - 106.6, z - 51.2) < 6) return true;
    return false;
  };
  const tree = (k: TreeKind, x: number, z: number, scale: number, solid: boolean) => {
    const tg = trees[k][Math.floor(r() * 2)];
    forest.add("leaf", M.foliage, tg.whole, W(x), hL(x, z) - 0.15, z, r() * Math.PI * 2, scale, scale * (0.9 + r() * 0.25), true, sway(k));
    if (solid) col.circle(W(x), z, radiusOf(k) * scale + 0.15);
  };
  const spacing = 7;
  for (let gx = gb.minX + 3; gx < gb.maxX - 2; gx += spacing)
    for (let gz = gb.minZ + 3; gz < gb.maxZ - 2; gz += spacing) {
      const x = gx + (r() - 0.5) * spacing * 0.9;
      const z = gz + (r() - 0.5) * spacing * 0.9;
      if (noTree(x, z)) continue;
      const play = inPlay(x, z);
      const edge = Math.min(x - B.minX, B.maxX - x, B.maxZ - z, z - B.minZ);
      const marsh = z < -112;
      let p = 0.05;
      let k: TreeKind = r() < 0.5 ? "oak" : "beech";
      if (!play) p = marsh ? 0.05 : 0.34;
      else if (edge < 26) p = 0.44;
      if (x < -60 && z > 40) p = Math.max(p, 0.42);
      if (z > 128) p = Math.max(p, 0.45);
      for (const w of woodNodes) if (Math.hypot(x - w.x!, z - w.z!) < 16) p = Math.max(p, 0.8);
      if (farm(x, z)) p = plotEdge(x, z) ? 0.25 : 0;
      if (fortDist(x, z) < 26) p = Math.min(p, 0.15);
      if (r() > p) continue;
      if (z > 60 || (x < -60 && z > 40)) k = r() < 0.7 ? "pine" : "oak";
      if (marsh) {
        if (r() > 0.25) continue;
        k = "young";
      }
      const s = k === "young" ? 0.8 + r() * 0.5 : 0.8 + r() * 0.45;
      tree(k, x, z, s, play);
    }
  // hedges, field rocks, flowers, the marigold meadows
  for (let i = 0; i < 13000; i++) {
    const x = B.minX + r() * (B.maxX - B.minX);
    const z = B.minZ + r() * (B.maxZ - B.minZ);
    if (Math.hypot(x, z) < 47) continue;
    if (fortDist(x, z) < 2) continue;
    const rd = rdAt(x, z);
    if (rd < 3.6) continue;
    const y = hL(x, z);
    if (z < -112 && (y < WL + 0.1 || Math.abs(x) < CW_HALF + 1)) continue;
    if (pitDist(x, z) < PIT.r + 3) continue;
    if (farm(x, z)) {
      if (plotEdge(x, z)) {
        if (r() < 0.16) forest.add("leaf", M.foliage, hedgeG, W(x), y - 0.2, z, r() * 6, 0.8 + r() * 0.5, 0.8 + r() * 0.5, false, { from: 0.2, scale: 5 });
        continue;
      }
      const [pi, pj] = plotIJ(x, z);
      const t = plotType(pi, pj);
      if (t === 1 && r() < 0.5) grassSets[i % 2].add(W(x), y - 0.02, z, r() * 6, 0.9, 0.9);
      continue;
    }
    const roll2 = r();
    if (roll2 < 0.012 && clearOf(x, z)) {
      const sc = 0.4 + r() * 0.8;
      clutter.add("flat", M.clutter, rocks[i % 2], W(x), y - 0.1 * sc, z, r() * 6, sc, sc * (0.7 + r() * 0.5));
      if (sc > 0.85) col.circle(W(x), z, sc * 0.7);
    } else if (roll2 < 0.02) {
      clutter.add("flat", M.clutter, wild, W(x), y, z, r() * 6, 0.9 + r() * 0.5);
    } else if (roll2 < 0.026 && clearOf(x, z)) {
      forest.add("leaf", M.foliage, bushGs[i % 2], W(x), y - 0.15, z, r() * 6, 0.6 + r() * 0.6, 0.6 + r() * 0.5, false, { from: 0.2, scale: 5 });
    } else if (roll2 < 0.0275 && clearOf(x, z) && rd > 8) {
      clutter.add("flat", M.clutter, roll2 < 0.027 ? logG : stumpG, W(x), y + 0.15, z, r() * 6, 0.7 + r() * 0.5);
    }
  }
  // the wheat: a jittered grid over every wheat plot
  {
    const [i0, j0] = plotIJ(B.minX, B.minZ);
    const [i1, j1] = plotIJ(B.maxX, B.maxZ);
    const gs = 1.2;
    for (let i = i0; i <= i1; i++)
      for (let j = j0; j <= j1; j++) {
        if (plotType(i, j) !== 0) continue;
        const px0 = i * PW - 3 + 1.2;
        const pz0 = j * PD - 5 + 1.2;
        if (!farm(px0 + PW / 2, pz0 + PD / 2) && !farm(px0, pz0) && !farm(px0 + PW - 2.4, pz0 + PD - 2.4)) continue;
        for (let gx = 0; gx < PW - 1.6; gx += gs)
          for (let gz = 0; gz < PD - 1.6; gz += gs) {
            const x = px0 + gx + (r() - 0.5) * gs * 0.8;
            const z = pz0 + gz + (r() - 0.5) * gs * 0.8;
            if (!farm(x, z) || plotEdge(x, z) || rdAt(x, z) < 3.6 || !clearOf(x, z, -2.2)) continue;
            wheatSet.add(W(x), hL(x, z) - 0.05, z, r() * 6, 0.9 + r() * 0.35, 0.85 + r() * 0.4);
          }
      }
  }
  // marigold meadows round their nodes
  for (const n of NODE_DEFS) {
    if (n.zone !== "kingdom" || n.kind !== "marigold" || n.x === undefined || n.z === undefined) continue;
    for (let k = 0; k < 46; k++) {
      const a = r() * Math.PI * 2;
      const d = 1.6 + Math.sqrt(r()) * 8;
      const x = n.x + Math.cos(a) * d;
      const z = n.z + Math.sin(a) * d;
      if (rdAt(x, z) < 3) continue;
      clutter.add("flat", M.clutter, marigold, W(x), hL(x, z), z, r() * 6, 0.9 + r() * 0.5);
    }
  }
  // grass: verges, meadows, the town's yards
  for (let i = 0; i < 30000; i++) {
    const x = B.minX + 4 + r() * (B.maxX - B.minX - 8);
    const z = B.minZ + 4 + r() * (B.maxZ - B.minZ - 8);
    const rr = Math.hypot(x, z);
    const rd = rdAt(x, z);
    if (rd < 2.8) continue;
    if (farm(x, z)) continue;
    if (pitDist(x, z) < PIT.r + 2) continue;
    if (z < -112 && (hL(x, z) < WL + 0.15 || Math.abs(x) < CW_HALF + 0.6)) continue;
    let keep = 0.22;
    if (rd < 9) keep = 0.7;
    if (z > 40) keep = Math.max(keep, 0.45);
    if (rr < 43) {
      if (rr < 14 || streetDist(x, z) < 4.2) continue;
      keep = 0.32;
    }
    if (rr >= 43 && rr < 47) continue;
    if (r() > keep) continue;
    if (fbm(x * 0.15, z * 0.15, 2) < 0.36) continue;
    const s = 0.75 + r() * 0.55;
    grassSets[i % 2].add(W(x), hL(x, z) - 0.02, z, r() * 6, s, s * (0.8 + r() * 0.5));
  }

  // ------------------------------------------------------------ finish the static meshes
  for (const s of [forest, clutter, wheatSet]) s.build(root);
  for (const s of grassSets) s.build(root);
  batch.build(root);

  // banners: one mesh, one material, waved per vertex
  const bannerMat = new THREE.MeshLambertMaterial({ map: bannerTex(), side: THREE.DoubleSide });
  const bannerGeos: THREE.BufferGeometry[] = [];
  const bannerInfo: { start: number; count: number; nx: number; nz: number; h: number; w: number; ph: number }[] = [];
  let vcount = 0;
  for (const b of bannerSpecs) {
    const g = new THREE.PlaneGeometry(b.w, b.h, 1, 6);
    g.translate(0, -b.h / 2, 0);
    g.rotateY(b.yaw);
    g.translate(b.x, b.y, b.z);
    const n = g.getAttribute("position").count;
    bannerInfo.push({ start: vcount, count: n, nx: Math.sin(b.yaw), nz: Math.cos(b.yaw), h: b.h, w: b.w, ph: b.x * 0.37 + b.z * 0.21 });
    vcount += n;
    bannerGeos.push(g);
  }
  const bannerGeo = bannerGeos.length ? mergeGeometries(bannerGeos, false) : null;
  let bannerBase: Float32Array | null = null;
  let bannerTop: Float32Array | null = null;
  if (bannerGeo) {
    const bm = new THREE.Mesh(bannerGeo, bannerMat);
    bm.castShadow = true;
    bm.frustumCulled = false;
    root.add(bm);
    const pos = bannerGeo.getAttribute("position") as THREE.BufferAttribute;
    bannerBase = new Float32Array(pos.array as ArrayLike<number>);
    bannerTop = new Float32Array(pos.count);
    for (const bi of bannerInfo) {
      let top = -Infinity;
      for (let v = bi.start; v < bi.start + bi.count; v++) top = Math.max(top, bannerBase[v * 3 + 1]);
      for (let v = bi.start; v < bi.start + bi.count; v++) bannerTop[v] = top;
    }
  }

  // only some chimneys smoke (it is a town, not a kiln)
  const smoke = ctx.smoke.filter((_, i) => i % 2 === 0);

  // ------------------------------------------------------------ places
  const regions: Record<string, [string, string]> = {
    kingsroad: ["The Kingsroad", "Paid for in tolls. Patrolled in theory."],
    harrenvale: ["Harrenvale", "Under the March-Seal. Mind the wax."],
    market: ["Harrenvale Market", "Bread, iron and other people's business"],
    millcross: ["Millcross", "One mill, four roofs, too many dogs"],
    quarry: ["The East Quarry", "The stone that built the walls"],
    fields: ["The King's Fields", "Wheat for a town that eats like a garrison"],
    meadows: ["The North Meadows", "Marigold, and boar sign"],
    beacon: ["The Old Beacon", "Lit once. Never answered."],
    fortress_road: ["The Fortress Road", "North, under the King's walls"],
    causeway: ["The Causeway", "South, the Mire. The wind brings it."],
    bandits: ["The Old Quarry Road", "Somebody's camp. Somebody's strongbox."],
  };
  const regionAt = (wx: number, z: number) => {
    const x = wx - X;
    const rr = Math.hypot(x, z);
    if (rr < 15) return "market";
    if (rr < WALL_R + 1.5) return "harrenvale";
    if (z < -118) return "causeway";
    if (Math.hypot(x - MILL.x, z - MILL.z) < 30) return "millcross";
    if (Math.hypot(x - CAMP.x, z - CAMP.z) < 26) return "bandits";
    if (pitDist(x, z) < PIT.r + 16) return "quarry";
    if (Math.hypot(x - BEACON.x, z - BEACON.z) < 30) return "beacon";
    if ((z > 44 && distToPolyline(x, z, NORTH_ROAD) < 16) || fortDist(x, z) < 30) return "fortress_road";
    if (x < -44 && Math.abs(z) < 14) return "kingsroad";
    if (z > 40) return "meadows";
    return "fields";
  };
  const surfaceAt = (wx: number, z: number): "wood" | "stone" | "dirt" | "grass" => {
    const x = wx - X;
    const rr = Math.hypot(x, z);
    if (z < -118 && Math.abs(x) < CW_HALF) return "stone";
    if (rr < 43.5) return rr < 13.5 || streetDist(x, z) < 3.2 ? "stone" : "dirt";
    if (pitDist(x, z) < PIT.r) return "stone";
    if (terrain.pathAt(wx, z) > 0.3) return "dirt";
    return "grass";
  };
  const blocked = (wx: number, z: number) => {
    if (z > -112) return false;
    if (Math.abs(wx - X) < CW_HALF + 0.3) return false;
    return WL - terrain.heightAt(wx, z) > 1.4;
  };

  // anchors for quests and the integrator
  anchors.kingsroad = new THREE.Vector3(W(-146), hL(-146, 0), 0);
  anchors.westGate = new THREE.Vector3(W(-WALL_R), hL(-WALL_R, 0), 0);
  anchors.northGate = new THREE.Vector3(W(0), hL(0, WALL_R), WALL_R);
  anchors.southGate = new THREE.Vector3(W(0), hL(0, -WALL_R), -WALL_R);
  anchors.huntRoad = new THREE.Vector3(W(60), hL(60, 152), 152);
  anchors.elspeth = new THREE.Vector3(W(-32), hL(-32, 24), 24);
  anchors.millcross = new THREE.Vector3(W(MILL.x), hL(MILL.x, MILL.z), MILL.z);
  for (const [k, v] of Object.entries(doors)) anchors["door_" + k] = v;

  // ------------------------------------------------------------ per frame
  const update = (dt: number, t: number) => {
    sails.rotation.z -= dt * 0.55;
    if (bannerGeo && bannerBase && bannerTop) {
      const pos = bannerGeo.getAttribute("position") as THREE.BufferAttribute;
      const arr = pos.array as Float32Array;
      for (const bi of bannerInfo) {
        for (let v = bi.start; v < bi.start + bi.count; v++) {
          const by = bannerBase[v * 3 + 1];
          const k = (bannerTop[v] - by) / bi.h;
          const wv = Math.sin(t * 2.3 + bi.ph + k * 3.2) * 0.22 * k * k * (bi.w * 0.7) + Math.sin(t * 1.3 + bi.ph) * 0.05 * k;
          arr[v * 3] = bannerBase[v * 3] + bi.nx * wv;
          arr[v * 3 + 2] = bannerBase[v * 3 + 2] + bi.nz * wv;
        }
      }
      pos.needsUpdate = true;
    }
    // the causeway chain drops when the Castellan breaks his seal
    if (!chain.open && env.flag("causeway")) {
      chain.open = true;
      const me = env.players()[0];
      if (me && me.zone === "kingdom" && Math.hypot(me.x - X, me.z - CHAIN_Z) < 60) {
        env.audio.clack();
        env.audio.bell(0.12, 196);
      } else chain.sounded = true;
    }
    if (chain.open && chain.p < 1) {
      chain.p = Math.min(1, chain.p + dt / 1.6);
      layChain();
      if (chain.p >= 1 && !chain.sounded) {
        chain.sounded = true;
        env.audio.thud();
      }
    }
  };

  return {
    root,
    groundAt,
    blocked,
    waterAt: terrain.waterAt,
    surfaceAt,
    regionAt,
    regions,
    fires: ctx.fires,
    lamps: ctx.lamps,
    glows: ctx.glows,
    smoke,
    nodes,
    scatters,
    grass: grassSets,
    anchors,
    npcs: KINGDOM_NPCS,
    update,
  };
}
