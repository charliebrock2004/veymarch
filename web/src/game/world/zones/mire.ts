import * as THREE from "three";
import { Batch, ChunkBatch, Scatter, boxUV, grassGeo, logGeo, merge, mushroomGeo, place, rockGeo, stumpGeo, tint, treeGeo, type Cullable } from "../../engine/kit";
import { fbm, lerp, noise2, rng, smoothPath, smoothstep } from "../../engine/noise";
import { buildFieldTerrain } from "../../engine/terrain";
import { glowTex, waterNormalTex } from "../../engine/textures";
import { ZONES } from "../../data/zones.ts";
import { CACHE_DEFS, MOB_SPAWNS, NODE_DEFS } from "../../data/world.ts";
import { zoneNodes } from "../nodes";
import { Frame, barrel, crate, lamp, put, sack, type Ctx, type Glow } from "../props";
import type { ZoneBuild, ZoneEnv } from "../zone";
import { MIRE_NPCS } from "./mire_npcs";

/**
 * The Dark Mire: green-black water over drowned country, knee-deep almost everywhere, with
 * deep pools you cannot cross. The old raised causeway runs south from the Kingdom's chain to
 * the Black Keep's gate. Drear, the stilt hamlet, stands in the shallows west of it (Mother
 * Phem's kettle, the smokehouse, Liss's boat-shop on the jetty, the clean bell on its post).
 * East of the causeway the chapel went under with its bell tower; witches keep huts in three
 * pools; black iron breaks the surface on two rock islands. Fog, dead trees, reeds, wisps.
 * Everything is in world coordinates (x = ox + local x). The water surface is y = 0; ground
 * below it is the terrain (shallows), boardwalk decks raise groundAt to the planks.
 */

const Z = ZONES.mire;
const X = Z.ox;
const B = Z.bounds;
const WATER = 0;
const DECK = 0.62;
const CAUSE_H = 0.85;
const CAUSE_HW = 2.6;
/** below this terrain height the water is too deep to wade */
const DEEP = -1.3;

/** the raised causeway, north chain to the Keep gate (local) */
const CAUSEWAY = smoothPath([
  [0, 164], [0, 146], [-2, 132], [-8, 118], [-12, 104], [-14, 90], [-16, 76], [-15, 64], [-10, 50], [-2, 38], [4, 24], [6, 10], [4, -4],
  [-2, -18], [-6, -32], [-5, -46], [0, -60], [3, -74], [2, -90], [0, -106], [0, -122], [0, -137],
] as const);

const DREAR = { x: -40, z: 62 };
const SHRINE = { x: -36, z: 54 };
const KETTLE = { x: -46.0, z: 65.8 };
const FIREPIT = { x: -35.2, z: 58.6 };
const COUNTER = { x: -40, z: 67.5 };
const RELIQUARY = { x: -47.3, z: 71.4 };
const CHAPEL = { x: 31, z: 2 };
const TOWER = { x: 19.4, z: 8.8 };
const ARRIVE = { x: 0, z: 146 };
const GATE = { x: 0, z: -138 };
const KEEP_WALL_Z = -144;

type Deck = { ax: number; az: number; bx: number; bz: number; hw: number; ay: number; by: number; broken: number };
const D = (ax: number, az: number, bx: number, bz: number, hw: number, ay = DECK, by = ay, broken = 0): Deck => ({ ax, az, bx, bz, hw, ay, by, broken });
const DECKS: Deck[] = [
  // Drear's village deck
  D(-40, 51, -40, 73, 8),
  // the walk out to the causeway
  D(-15.4, 62, -32, 62, 1.3, 0.84, DECK),
  // hut walks
  D(-48, 64, -50.6, 64, 1.2),
  D(-48, 53, -53.0, 53, 1.1),
  D(-32, 68, -26.1, 68, 1.1),
  D(-44, 73, -44, 78.1, 1.1),
  D(-32, 53.5, -27, 53.5, 1.1),
  D(-27, 53.5, -27, 49.9, 1.1),
  // Liss's jetty
  D(-35, 72.6, -35, 89, 1.25, DECK, 0.52),
  // the old chapel walk (half its planks gone)
  D(7.6, 1.5, 21.8, 1.5, 1.1, 0.8, 0.38, 0.28),
];

type Hut = { x: number; z: number; w: number; d: number; rot: number; seed: number; witch?: boolean };
const HUTS: Hut[] = [
  { x: -53.0, z: 64, w: 5.4, d: 5.0, rot: Math.PI / 2, seed: 1 }, // Mother Phem's
  { x: -30.0, z: 57.5, w: 4.0, d: 3.6, rot: -Math.PI / 2, seed: 2 }, // the smokehouse
  { x: -55.0, z: 53, w: 4.4, d: 4.0, rot: Math.PI / 2, seed: 3 },
  { x: -24.0, z: 68, w: 4.0, d: 4.0, rot: -Math.PI / 2, seed: 4 },
  { x: -44.0, z: 80, w: 4.6, d: 4.0, rot: Math.PI, seed: 5 },
  { x: -27.0, z: 48, w: 4.0, d: 4.0, rot: 0, seed: 6 },
];
/** witch spawns and the huts beside them (the hut door faces the spawn) */
/** the porch in front of each Drear hut's door, walkable at deck height */
const PORCHES: Deck[] = HUTS.map((h) => {
  const o = h.d / 2 + 0.65;
  const cx = h.x + Math.sin(h.rot) * o;
  const cz = h.z + Math.cos(h.rot) * o;
  const dx = Math.cos(h.rot) * (h.w / 2 + 0.2);
  const dz = -Math.sin(h.rot) * (h.w / 2 + 0.2);
  return D(cx - dx, cz - dz, cx + dx, cz + dz, 0.65);
});
const ALL_DECKS = [...DECKS, ...PORCHES];
const WITCHES = [
  { sx: 80, sz: 80, hx: 87, hz: 87 },
  { sx: -90, sz: -60, hx: -97.5, hz: -67 },
  { sx: 40, sz: -100, hx: 32.5, hz: -107 },
];
type Land = { x: number; z: number; r: number; h: number };

const C = {
  timber: 0x2e2a22,
  wet: 0x4a4436,
  reed: 0x8a7a4a,
  bone: 0xc8bea4,
  iron: 0x3a3a3c,
  verdigris: 0x4f6a52,
  black: 0x24242a,
};

const V3 = THREE.Vector3;

/** Distance (local metres, capped) to polylines, rasterised once onto a 1 m grid over the zone. */
function distField(lines: readonly (readonly [number, number])[][], cap: number) {
  const x0 = B.minX - 2;
  const z0 = B.minZ - 2;
  const w = B.maxX - B.minX + 5;
  const d = B.maxZ - B.minZ + 9;
  const f = new Float32Array(w * d).fill(cap);
  for (const pts of lines)
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, az] = pts[i];
      const [bx, bz] = pts[i + 1];
      const dx = bx - ax;
      const dz = bz - az;
      const len2 = dx * dx + dz * dz || 1;
      const i0 = Math.max(0, Math.floor(Math.min(ax, bx) - cap - x0));
      const i1 = Math.min(w - 1, Math.ceil(Math.max(ax, bx) + cap - x0));
      const j0 = Math.max(0, Math.floor(Math.min(az, bz) - cap - z0));
      const j1 = Math.min(d - 1, Math.ceil(Math.max(az, bz) + cap - z0));
      for (let j = j0; j <= j1; j++)
        for (let k = i0; k <= i1; k++) {
          const px = x0 + k;
          const pz = z0 + j;
          let t = ((px - ax) * dx + (pz - az) * dz) / len2;
          t = t < 0 ? 0 : t > 1 ? 1 : t;
          const qx = ax + dx * t - px;
          const qz = az + dz * t - pz;
          const dist = Math.sqrt(qx * qx + qz * qz);
          const o = j * w + k;
          if (dist < f[o]) f[o] = dist;
        }
    }
  return (x: number, z: number) => {
    const fx = Math.min(w - 1.001, Math.max(0, x - x0));
    const fz = Math.min(d - 1.001, Math.max(0, z - z0));
    const i = Math.floor(fx);
    const j = Math.floor(fz);
    const u = fx - i;
    const v = fz - j;
    const o = j * w + i;
    return (f[o] * (1 - u) + f[o + 1] * u) * (1 - v) + (f[o + w] * (1 - u) + f[o + w + 1] * u) * v;
  };
}

/** Which deck (if any) covers a local point, and its plank height there. */
function deckAt(x: number, z: number) {
  let best = -Infinity;
  for (const d of ALL_DECKS) {
    const dx = d.bx - d.ax;
    const dz = d.bz - d.az;
    const len2 = dx * dx + dz * dz || 1;
    const t = ((x - d.ax) * dx + (z - d.az) * dz) / len2;
    if (t < -0.02 || t > 1.02) continue;
    const tc = Math.max(0, Math.min(1, t));
    const qx = d.ax + dx * tc - x;
    const qz = d.az + dz * tc - z;
    if (qx * qx + qz * qz > d.hw * d.hw) continue;
    const y = d.ay + (d.by - d.ay) * tc;
    if (y > best) best = y;
  }
  return best;
}

const texCache = new Map<string, THREE.CanvasTexture>();
function paintTex(key: string, w: number, h: number, paint: (g: CanvasRenderingContext2D, w: number, h: number) => void) {
  const hit = texCache.get(key);
  if (hit) return hit;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d");
  if (g) paint(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  texCache.set(key, t);
  return t;
}

/** The Keep's banner: black cloth, a grey tower and a broken crown, a ragged foot. */
const keepBannerTex = () =>
  paintTex("mire_keep_banner", 128, 256, (g, w, h) => {
    const r = rng(31);
    g.fillStyle = "#16161a";
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 500; i++) {
      const v = 14 + r() * 22;
      g.fillStyle = `rgba(${v},${v},${v + 4},0.5)`;
      g.fillRect(r() * w, r() * h, 1 + r() * 2, 2 + r() * 6);
    }
    g.fillStyle = "#6a6a70";
    // a tower
    g.fillRect(w / 2 - 16, h * 0.32, 32, 62);
    for (let i = 0; i < 3; i++) g.fillRect(w / 2 - 16 + i * 12, h * 0.32 - 10, 8, 10);
    g.fillStyle = "#16161a";
    g.fillRect(w / 2 - 5, h * 0.32 + 34, 10, 28);
    // a broken crown above it
    g.fillStyle = "#8a8a8e";
    g.beginPath();
    g.moveTo(w / 2 - 22, h * 0.24);
    g.lineTo(w / 2 - 22, h * 0.17);
    g.lineTo(w / 2 - 11, h * 0.21);
    g.lineTo(w / 2 - 2, h * 0.14);
    g.lineTo(w / 2 + 4, h * 0.2);
    g.lineTo(w / 2 + 10, h * 0.18);
    g.lineTo(w / 2 + 22, h * 0.24);
    g.closePath();
    g.fill();
    // ragged foot
    g.globalCompositeOperation = "destination-out";
    g.beginPath();
    g.moveTo(0, h);
    for (let x = 0; x <= w; x += 8) g.lineTo(x, h - 10 - r() * 34);
    g.lineTo(w, h);
    g.closePath();
    g.fill();
  });

/** A bell shape, mouth down, top at y = 0.68 * s, mouth at y = 0. */
function bellGeo(s: number, color: number) {
  const g = new THREE.LatheGeometry(
    [new THREE.Vector2(0.06, 0), new THREE.Vector2(0.22, 0.05), new THREE.Vector2(0.28, 0.35), new THREE.Vector2(0.42, 0.62), new THREE.Vector2(0.44, 0.68), new THREE.Vector2(0.0, 0.68)].map((p) => p.multiplyScalar(s)),
    14,
  );
  g.rotateX(Math.PI);
  g.translate(0, 0.68 * s, 0);
  return tint(g, color);
}

/** Places (rotation, then translation, optional scale) and tints a geometry, ready to merge. */
function at(geo: THREE.BufferGeometry, x: number, y: number, z: number, color: THREE.ColorRepresentation, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) {
  place(geo, x, y, z, rx, ry, rz, sx, sy, sz);
  return tint(geo, color);
}

/** Multiply baked vertex colours. */
function darken(geo: THREE.BufferGeometry, r: number, g: number, b: number) {
  const out = geo.clone();
  const c = out.getAttribute("color");
  for (let i = 0; i < c.count; i++) c.setXYZ(i, c.getX(i) * r, c.getY(i) * g, c.getZ(i) * b);
  return out;
}

export function buildMire(env: ZoneEnv): ZoneBuild {
  const { M, col } = env;
  const root = new THREE.Group();
  root.name = "mire";
  const r = rng(9191);

  // ------------------------------------------------------------ the lie of the water
  const causeDist = distField([CAUSEWAY], 18);
  const spawns = MOB_SPAWNS.filter((s) => s[4] === "mire").map((s) => ({ key: s[0], kind: s[1], x: s[2], z: s[3] }));
  const nodeDefs = NODE_DEFS.filter((n) => n.zone === "mire" && n.x !== undefined && n.z !== undefined).map((n) => ({ id: n.id, kind: n.kind, x: n.x as number, z: n.z as number }));
  const cacheDefs = CACHE_DEFS.filter((c) => c.zone === "mire");

  /** raised ground: islands, hummocks under the herbs, rock for the black iron */
  const LANDS: Land[] = [
    ...WITCHES.map((w) => ({ x: (w.sx + w.hx) / 2, z: (w.sz + w.hz) / 2, r: 15, h: 0.42 })),
    { x: 104, z: -25, r: 14, h: 0.95 },
    { x: -110, z: -100, r: 11, h: 0.95 },
    { x: -100, z: 40, r: 6, h: 0.32 },
  ];
  for (const n of nodeDefs) if (n.kind === "rotcap") LANDS.push({ x: n.x, z: n.z, r: 5, h: 0.3 });
  // every spawn stands on a mud bank (the drowned climb out to wait; the crocs bask)
  for (const sp of spawns) if (!LANDS.some((l) => Math.hypot(l.x - sp.x, l.z - sp.z) < l.r * 0.4) && causeDist(sp.x, sp.z) > CAUSE_HW + 1) LANDS.push({ x: sp.x, z: sp.z, r: 6.5, h: 0.22 });
  for (const n of nodeDefs) if (n.kind === "widowsveil" && !LANDS.some((l) => Math.hypot(l.x - n.x, l.z - n.z) < l.r * 0.6)) LANDS.push({ x: n.x, z: n.z, r: 5, h: 0.3 });
  /** knee-deep under the chapel nave: the floor went under with it */
  const CHAPEL_FLOOR = -0.24;

  // the deep pools: placed clear of everything that must stay walkable, never touching each other
  type Pool = { x: number; z: number; r: number };
  const pools: Pool[] = [];
  {
    const pr = rng(6061);
    for (let i = 0; i < 400 && pools.length < 16; i++) {
      const x = B.minX + 14 + pr() * (B.maxX - B.minX - 28);
      const z = -100 + pr() * 214;
      const rad = 6 + pr() * 8;
      if (causeDist(x, z) < rad + 8) continue;
      if (Math.hypot(x - DREAR.x, z - DREAR.z) < rad + 32) continue;
      if (Math.hypot(x - CHAPEL.x, z - CHAPEL.z) < rad + 20) continue;
      if (Math.hypot(x - 13, z - 3) < rad + 8) continue;
      if (spawns.some((s) => Math.hypot(x - s.x, z - s.z) < rad + 8)) continue;
      if (nodeDefs.some((n) => Math.hypot(x - n.x, z - n.z) < rad + 8)) continue;
      if (LANDS.some((l) => Math.hypot(x - l.x, z - l.z) < rad + l.r + 3)) continue;
      if (pools.some((p) => Math.hypot(x - p.x, z - p.z) < rad + p.r + 9)) continue;
      pools.push({ x, z, r: rad });
    }
  }

  const base = (x: number, z: number) => {
    let h = -0.5 + (fbm(x * 0.024 + 3, z * 0.024 - 9, 3) - 0.5) * 1.1;
    const hum = fbm(x * 0.07 - 4, z * 0.07 + 11, 2);
    if (hum > 0.58) h += (hum - 0.58) * 3.2;
    return Math.max(h, -1.05);
  };
  const heightLocal = (x: number, z: number) => {
    let h = base(x, z);
    for (const p of pools) {
      const d = Math.hypot(x - p.x, z - p.z) * (1 + (noise2(x * 0.15 + p.x, z * 0.15) - 0.5) * 0.35);
      if (d > p.r * 1.25) continue;
      h = lerp(h, -2.4, 1 - smoothstep(p.r * 0.55, p.r * 1.2, d));
    }
    for (const l of LANDS) {
      const d = Math.hypot(x - l.x, z - l.z);
      if (d > l.r) continue;
      const tgt = l.h + (fbm(x * 0.2, z * 0.2, 2) - 0.5) * 0.25;
      const k = 1 - smoothstep(l.r * 0.45, l.r, d);
      if (tgt > h) h = lerp(h, tgt, k);
    }
    {
      const d = Math.hypot((x - CHAPEL.x) / 1.3, z - CHAPEL.z);
      if (d < 11) h = lerp(h, CHAPEL_FLOOR, 1 - smoothstep(6.5, 11, d));
    }
    // the north shore where the Kingdom's road comes down, and the Keep's island in the south
    const north = smoothstep(120, 140, z);
    if (north > 0) h = lerp(h, 0.55 + (z - 120) * 0.02 + (fbm(x * 0.1, z * 0.1, 2) - 0.5) * 0.3, north);
    const south = 1 - smoothstep(-128, -112, z);
    if (south > 0) h = lerp(h, 1.0 + (fbm(x * 0.08 + 2, z * 0.08, 3) - 0.5) * 0.6 + Math.max(0, -126 - z) * 0.02, south);
    // the causeway: a flat stone-and-earth bank, its shoulders running down into the water
    const cd = causeDist(x, z);
    if (cd < 7) h = lerp(h, Math.max(h, CAUSE_H + (noise2(x * 0.7, z * 0.7) - 0.5) * 0.06), 1 - smoothstep(CAUSE_HW, 6.5, cd));
    return h;
  };

  const tc = new THREE.Color();
  const cc = {
    mud: new THREE.Color(0x3a3524),
    moss: new THREE.Color(0x343e24),
    sunk: new THREE.Color(0x232619),
    deep: new THREE.Color(0x101410),
    stone: new THREE.Color(0x5c574c),
    shore: new THREE.Color(0x3e3a2c),
    keep: new THREE.Color(0x34332e),
  };
  const terrain = buildFieldTerrain({
    ox: X,
    bounds: B,
    step: 2.5,
    sample: (x, z) => {
      const h = heightLocal(x, z);
      const cd = causeDist(x, z);
      const path = 1 - smoothstep(CAUSE_HW - 0.6, CAUSE_HW + 0.8, cd);
      if (h < WATER) tc.copy(cc.sunk).lerp(cc.deep, smoothstep(-0.2, -1.8, h));
      else tc.copy(cc.mud).lerp(cc.moss, fbm(x * 0.09, z * 0.09, 2));
      if (h > -0.1 && h < 0.25) tc.lerp(cc.shore, 0.5);
      if (z < -112) tc.lerp(cc.keep, smoothstep(-112, -124, z));
      tc.lerp(cc.stone, path * 0.85);
      tc.multiplyScalar(0.85 + noise2(x * 0.4, z * 0.4) * 0.3);
      return { h, color: tc.clone(), path, water: h < WATER ? Math.min(1, 0.5 + (WATER - h) * 0.6) : 0 };
    },
  });
  root.add(terrain.mesh);

  const groundAt = (x: number, z: number) => Math.max(terrain.heightAt(x, z), deckAt(x - X, z));
  const onDeck = (x: number, z: number) => deckAt(x - X, z) > -Infinity;
  const H = (lx: number, lz: number) => groundAt(X + lx, lz);
  const waterAt = (x: number, z: number) => {
    if (onDeck(x, z)) return 0;
    const h = terrain.heightAt(x, z);
    if (h >= WATER) return 0;
    if (h > -0.08) return ((WATER - h) / 0.08) * 0.5;
    return Math.min(1, 0.5 + (WATER - h) * 0.6);
  };
  const blocked = (x: number, z: number) => !onDeck(x, z) && terrain.heightAt(x, z) < DEEP;

  const batch = new Batch();
  const glows: Glow[] = [];
  const fires: THREE.Vector3[] = [];
  const lamps: THREE.Vector3[] = [];
  const smoke: THREE.Vector3[] = [];
  const ctx: Ctx = { batch, M, col, h: groundAt, glows, smoke, fires, lamps };
  const anchors: Record<string, THREE.Vector3> = {};
  const F = (lx: number, lz: number, rot = 0, y = H(lx, lz)) => new Frame(X + lx, y, lz, rot);

  // ------------------------------------------------------------ the water
  const waterTex = waterNormalTex().clone();
  waterTex.wrapS = waterTex.wrapT = THREE.RepeatWrapping;
  waterTex.repeat.set(36, 40);
  waterTex.needsUpdate = true;
  {
    const w = B.maxX - B.minX + 80;
    const d = B.maxZ - B.minZ + 80;
    const g = new THREE.PlaneGeometry(w, d, 1, 1);
    g.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshPhongMaterial({
      color: 0x18221a,
      specular: 0x6a7a6a,
      shininess: 90,
      normalMap: waterTex,
      normalScale: new THREE.Vector2(0.35, 0.35),
      transparent: true,
      opacity: 0.86,
      depthWrite: false,
    });
    const water = new THREE.Mesh(g, mat);
    water.position.set(X + (B.minX + B.maxX) / 2, WATER, (B.minZ + B.maxZ) / 2);
    water.renderOrder = 1;
    water.name = "water";
    root.add(water);
  }

  // ------------------------------------------------------------ the causeway: kerbs, posts, banners
  const bannerGeos: THREE.BufferGeometry[] = [];
  {
    const pts = CAUSEWAY;
    let acc = 0;
    let nextPost = 0;
    let nextKerb = 0;
    let nextBanner = 0;
    let bannerSide = 1;
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, az] = pts[i];
      const [bx, bz] = pts[i + 1];
      const len = Math.hypot(bx - ax, bz - az);
      const dirx = (bx - ax) / (len || 1);
      const dirz = (bz - az) / (len || 1);
      const nx = -dirz;
      const nz = dirx;
      const rot = Math.atan2(dirx, dirz);
      for (let s = 0; s < len; s += 0.5) {
        const px = ax + dirx * s;
        const pz = az + dirz * s;
        const at_ = acc + s;
        if (at_ >= nextKerb) {
          nextKerb = at_ + 1.6;
          // old dressed kerb stones at each edge, some missing, some tipped
          for (const e of [-1, 1]) {
            if (r() < 0.22) continue;
            const kx = px + nx * e * (CAUSE_HW + 0.1);
            const kz = pz + nz * e * (CAUSE_HW + 0.1);
            const y = terrain.heightAt(X + kx, kz);
            put(ctx, "stoneGrey", boxUV(0.45, 0.42, 1.5, 1, 1), F(kx, kz, rot, y), 0, 0.05, 0, (r() - 0.5) * 0.12, (r() - 0.5) * 0.08, e * r() * 0.18, 0x5e5a50);
          }
        }
        if (at_ >= nextPost && pz < 138 && pz > -128) {
          nextPost = at_ + 9 + r() * 5;
          // mooring posts along the shoulders, leaning, black with wet
          const e = r() < 0.5 ? -1 : 1;
          const kx = px + nx * e * (CAUSE_HW + 1.6);
          const kz = pz + nz * e * (CAUSE_HW + 1.6);
          const y = terrain.heightAt(X + kx, kz);
          const ph = 1.6 + r() * 1.2;
          put(ctx, "bark", new THREE.CylinderGeometry(0.12, 0.16, ph + 1, 6), F(kx, kz, 0, y), 0, ph / 2 - 0.5, 0, (r() - 0.5) * 0.2, 0, (r() - 0.5) * 0.2, 0x6a6458);
          col.circle(X + kx, kz, 0.22);
        }
        if (pz < -86 && pz > -132 && at_ >= nextBanner) {
          // the Keep's black banners, hung on poles along the last of the road
          nextBanner = at_ + 11;
          bannerSide = -bannerSide;
          const kx = px + nx * bannerSide * (CAUSE_HW + 0.9);
          const kz = pz + nz * bannerSide * (CAUSE_HW + 0.9);
          const y = groundAt(X + kx, kz);
          const f = F(kx, kz, rot, y);
          put(ctx, "flat", new THREE.CylinderGeometry(0.09, 0.12, 5.2, 6), f, 0, 2.6, 0, 0, 0, 0, C.timber);
          put(ctx, "flat", new THREE.BoxGeometry(0.08, 0.08, 1.5), f, 0, 5.0, 0, 0, 0, 0, C.timber);
          put(ctx, "metal", new THREE.ConeGeometry(0.09, 0.3, 4), f, 0, 5.35, 0, 0, 0, 0, C.iron, false);
          bannerGeos.push(bannerQuad(X + kx, y + 3.95, kz, rot + Math.PI / 2, 1.3, 2.0));
          col.circle(X + kx, kz, 0.2);
        }
      }
      acc += len;
    }
  }
  function bannerQuad(x: number, y: number, z: number, ry: number, w: number, h: number) {
    const g = new THREE.PlaneGeometry(w, h, 1, 3);
    const p = g.getAttribute("position");
    for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getY(i) * 2.1 + x) * 0.06);
    g.computeVertexNormals();
    place(g, x, y, z, 0, ry, 0);
    return tint(g, 0xffffff);
  }

  // ------------------------------------------------------------ the north shore: the road comes down
  {
    for (const s of [-1, 1]) {
      const f = F(s * 4.6, 150);
      put(ctx, "stoneGrey", boxUV(1.1, 3.2, 1.1, 1, 1), f, 0, 1.4, 0, 0, 0.1 * s, s * 0.04, 0x6a665c);
      put(ctx, "stoneGrey", boxUV(1.4, 0.4, 1.4, 1, 1), f, 0, 3.1, 0, 0, 0.1 * s, 0, 0x5a564c);
      col.box(X + s * 4.6, 150, 1.2, 1.2, 0.1 * s);
      // the broken end of the Kingdom's chain lying in the mud
      for (let k = 0; k < 6; k++) put(ctx, "metal", new THREE.TorusGeometry(0.16, 0.04, 4, 8), f, -s * (0.6 + k * 0.28), 0.06, 0.4 + Math.sin(k) * 0.2, Math.PI / 2, k * 0.7, 0, C.iron, false);
    }
    // a waymark: DREAR west, the Keep south
    const f = F(5.5, 140, -0.3);
    put(ctx, "flat", new THREE.BoxGeometry(0.16, 2.2, 0.16), f, 0, 1.1, 0, 0, 0, 0.05, C.timber);
    put(ctx, "planksDark", boxUV(1.1, 0.26, 0.06, 1, 1), f, -0.45, 1.85, 0.1, 0, 0, 0.06, 0x8a7a64);
    put(ctx, "planksDark", boxUV(1.0, 0.24, 0.06, 1, 1), f, 0.1, 1.45, 0.1, 0, Math.PI / 2, -0.04, 0x7a6a54);
    col.circle(X + 5.5, 140, 0.2);
    lamp(ctx, X - 4.2, 136.0, Math.PI / 2);
    anchors.arrive = new V3(X + ARRIVE.x, H(ARRIVE.x, ARRIVE.z), ARRIVE.z);
    anchors.northRoad = new V3(X, H(0, 156), 156);
  }

  // ------------------------------------------------------------ boardwalks on posts
  for (const dk of DECKS) {
    const dx = dk.bx - dk.ax;
    const dz = dk.bz - dk.az;
    const len = Math.hypot(dx, dz);
    const rot = Math.atan2(dx, dz);
    const ux = dx / len;
    const uz = dz / len;
    const n = Math.max(1, Math.round(len / 0.32));
    const wide = dk.hw > 3;
    for (let k = 0; k < n; k++) {
      const t = (k + 0.5) / n;
      if (dk.broken > 0 && r() < dk.broken && t > 0.08 && t < 0.92) continue;
      const px = dk.ax + dx * t;
      const pz = dk.az + dz * t;
      const y = dk.ay + (dk.by - dk.ay) * t;
      const shade = 0.75 + r() * 0.3;
      const c = new THREE.Color(0x8a7a64).multiplyScalar(shade);
      put(ctx, "planks", boxUV(dk.hw * 2 + (r() - 0.5) * 0.2, 0.08, (len / n) * 0.9, 1, 1), new Frame(X + px, y, pz, rot), (r() - 0.5) * 0.08, -0.04, 0, 0, (r() - 0.5) * 0.03, (r() - 0.5) * 0.03, c, false);
    }
    // stringers under the planks, posts down into the water
    for (const e of wide ? [-1, -0.5, 0, 0.5, 1] : [-1, 1]) {
      const sx = -uz * e * (dk.hw - 0.15);
      const sz = ux * e * (dk.hw - 0.15);
      const g = new THREE.BoxGeometry(0.16, 0.2, len);
      const f = new Frame(X + dk.ax + dx / 2 + sx, (dk.ay + dk.by) / 2, dk.az + dz / 2 + sz, rot);
      put(ctx, "flat", g, f, 0, -0.18, 0, Math.atan2(dk.ay - dk.by, len), 0, 0, C.timber, false);
      const np = Math.max(1, Math.round(len / 2.4));
      for (let k = 0; k <= np; k++) {
        const t = k / np;
        const px = dk.ax + dx * t + sx;
        const pz = dk.az + dz * t + sz;
        const y = dk.ay + (dk.by - dk.ay) * t;
        const bot = Math.min(terrain.heightAt(X + px, pz), y - 0.4) - 0.3;
        const ph = y - bot + (r() < 0.3 ? 0.5 + r() * 0.5 : 0);
        put(ctx, "bark", new THREE.CylinderGeometry(0.1, 0.13, ph, 6), new Frame(X + px, bot, pz, 0), 0, ph / 2, 0, (r() - 0.5) * 0.06, 0, (r() - 0.5) * 0.06, 0x7a7262);
      }
    }
  }

  // ------------------------------------------------------------ Drear: stilt huts
  const stiltHut = (h: Hut, floorY: number) => {
    const hr = rng(h.seed * 71 + 3);
    const f = new Frame(X + h.x, floorY, h.z, h.rot);
    const { w, d } = h;
    const Hh = h.witch ? 2.2 : 2.5;
    const lean = h.witch ? 0.05 : 0;
    // floor and a little porch at the door side (+z)
    put(ctx, "planksDark", boxUV(w + 0.5, 0.16, d + 1.4, 1, 1), f, 0, -0.08, 0.6, 0, 0, 0, 0x8a7a68);
    // stilts
    const bot = Math.min(terrain.heightAt(X + h.x, h.z) - 0.4, floorY - 0.6) - floorY;
    for (const sx of [-1, 0, 1])
      for (const sz of [-1, 1]) {
        const px = (sx * w) / 2;
        const pz = (sz * d) / 2 + (sz > 0 ? 0.6 : 0);
        put(ctx, "bark", new THREE.CylinderGeometry(0.12, 0.15, -bot + 0.1, 6), f, px, bot / 2, pz, (hr() - 0.5) * 0.08, 0, (hr() - 0.5) * 0.08, 0x6a6254);
      }
    // walls: weathered boards, the door side split around the door
    const wallC = h.witch ? 0x5a5446 : 0x8a7c66;
    put(ctx, "planksDark", boxUV(w, Hh, 0.14, 1, 1), f, 0, Hh / 2, -d / 2, 0, 0, lean, wallC);
    for (const s of [-1, 1]) put(ctx, "planksDark", boxUV(0.14, Hh, d, 1, 1), f, (s * w) / 2, Hh / 2, 0, 0, 0, lean, wallC);
    const side = (w - 1.1) / 2;
    for (const s of [-1, 1]) put(ctx, "planksDark", boxUV(side, Hh, 0.14, 1, 1), f, s * (0.55 + side / 2), Hh / 2, d / 2, 0, 0, lean, wallC);
    put(ctx, "planksDark", boxUV(1.1, Hh - 1.95, 0.14, 1, 1), f, 0, 1.95 + (Hh - 1.95) / 2, d / 2, 0, 0, lean, wallC);
    put(ctx, "planksDark", boxUV(0.95, 1.9, 0.08, 1, 1), f, 0.12, 0.95, d / 2 + 0.25, 0, 0.5, 0, 0x4a4034);
    put(ctx, "flat", new THREE.PlaneGeometry(1.0, 1.9), f, 0, 0.95, d / 2 + 0.01, 0, 0, 0, 0x0c0a08, false);
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) put(ctx, "flat", new THREE.BoxGeometry(0.2, Hh + 0.1, 0.2), f, (sx * w) / 2, Hh / 2, (sz * d) / 2, 0, 0, lean, C.timber);
    // steep reed roof
    const pitch = h.witch ? 1.0 : 0.9;
    const over = 0.45;
    const half = d / 2 + over;
    const rise = (d / 2) * Math.tan(pitch);
    const top = Hh;
    const ridge = top + rise;
    const slabL = half / Math.cos(pitch);
    const thick = 0.36;
    for (const s of [1, -1]) {
      const g = boxUV(w + over * 2, thick, slabL, 2, 2);
      const nrm = new V3(0, Math.cos(pitch), s * Math.sin(pitch));
      put(ctx, "thatch", g, f, 0, ridge - (half * Math.tan(pitch)) / 2 + nrm.y * thick * 0.5, s * (half / 2) + nrm.z * thick * 0.5, s * pitch, 0, lean * 2, h.witch ? 0x6a6450 : 0x9a8e70);
    }
    {
      const shape = new THREE.Shape();
      shape.moveTo(-d / 2, 0);
      shape.lineTo(d / 2, 0);
      shape.lineTo(0, rise);
      shape.closePath();
      const g = new THREE.ExtrudeGeometry(shape, { depth: w - 0.1, bevelEnabled: false });
      g.rotateY(Math.PI / 2);
      g.translate(-(w - 0.1) / 2, 0, 0);
      put(ctx, "planksDark", g, f, 0, top, 0, 0, 0, lean, wallC);
    }
    put(ctx, "thatch", new THREE.CylinderGeometry(thick * 0.8, thick * 0.8, w + over * 2, 6), f, 0, ridge + thick * 0.4, 0, 0, 0, Math.PI / 2, 0x7a6e54);
    // a window with a low light
    const wx = (w / 2) + 0.08;
    put(ctx, "window", new THREE.BoxGeometry(0.06, 0.5, 0.6), f, wx, 1.45, -0.3, 0, 0, 0, 0xffffff, false);
    const wp = f.at(wx + 0.1, 1.45, -0.3);
    glows.push({ x: wp.x, y: wp.y, z: wp.z, size: 2.0, color: h.witch ? 0x8ae070 : 0xd89040 });
    // nets, bundles, an eel trap
    if (!h.witch) {
      put(ctx, "flat", new THREE.PlaneGeometry(1.6, 1.2), f, -w / 2 - 0.1, 1.3, 0.4, 0, -Math.PI / 2, 0, 0x5a5444, false);
      put(ctx, "flat", new THREE.CylinderGeometry(0.22, 0.32, 0.9, 7, 1, true), f, w / 2 - 0.4, 0.45, d / 2 + 0.9, Math.PI / 2, 0, 0.3, 0x7a6a48, false);
      for (let k = 0; k < 3; k++) put(ctx, "thatch", new THREE.CylinderGeometry(0.12, 0.12, 0.9, 5), f, -w / 2 + 0.5 + k * 0.28, 2.0, d / 2 + 0.5, 0, 0, 0.2, 0xb8a878, false);
    }
    // witch huts stand high on their stilts: the porch is part of the hut, not a deck
    const pz0 = h.witch ? 0.65 : 0;
    const cp0 = f.at(0, 0, pz0);
    col.box(cp0.x, cp0.z, w + 0.4, d + 0.4 + pz0 * 2, h.rot);
    return f;
  };

  for (const h of HUTS) {
    const fr = stiltHut(h, DECK);
    if (h.seed === 2) {
      // the smokehouse: a stub chimney, smoke, fish hung under the eaves
      put(ctx, "stoneGrey", boxUV(0.6, 1.6, 0.6, 1, 1), fr, 0.8, 3.6, -0.6, 0, 0, 0, 0x5a5650);
      smoke.push(fr.at(0.8, 4.6, -0.6));
      smoke.push(fr.at(0, 3.0, 0));
    }
    if (h.seed === 1) {
      // Mother Phem's: bundles of herbs and a bone wind-chime by the door
      for (let k = 0; k < 5; k++) put(ctx, "flat", new THREE.ConeGeometry(0.1, 0.4, 5), fr, -1.6 + k * 0.3, 2.1, h.d / 2 + 0.55, Math.PI, 0, 0, k % 2 ? 0x6a7a4a : 0x8a7a4a, false);
      for (let k = 0; k < 4; k++) put(ctx, "flat", new THREE.CylinderGeometry(0.02, 0.02, 0.35, 4), fr, 1.2 + k * 0.12, 2.0 - (k % 2) * 0.1, h.d / 2 + 0.6, 0, 0, 0, C.bone, false);
      smoke.push(fr.at(-1.2, 4.6, 0));
    }
  }
  anchors.drear = new V3(X + DREAR.x, DECK, DREAR.z);
  anchors.phemHut = new V3(X - 49.4, DECK, 64);

  // the bell-post: the only clean bell in Drear
  {
    const f = F(SHRINE.x, SHRINE.z - 1.7, Math.PI);
    put(ctx, "flat", new THREE.BoxGeometry(0.24, 3.4, 0.24), f, 0, 1.7, 0, 0, 0, 0, 0x3a3228);
    put(ctx, "flat", new THREE.BoxGeometry(1.3, 0.18, 0.2), f, 0.3, 3.2, 0, 0, 0, 0, 0x3a3228);
    put(ctx, "flat", new THREE.BoxGeometry(0.1, 0.9, 0.1), f, 0.6, 2.75, 0, 0, 0, -0.75, 0x3a3228);
    put(ctx, "shingle", boxUV(1.6, 0.06, 0.7, 1, 1), f, 0.3, 3.5, 0.2, 0.5, 0, 0, 0x8a8478);
    put(ctx, "shingle", boxUV(1.6, 0.06, 0.7, 1, 1), f, 0.3, 3.5, -0.2, -0.5, 0, 0, 0x8a8478);
    put(ctx, "metal", bellGeo(0.48, 0xc8a050), f, 0.6, 2.75, 0, 0, 0, 0, 0xffffff, false);
    put(ctx, "flat", new THREE.CylinderGeometry(0.01, 0.01, 1.4, 3), f, 0.6, 2.0, 0, 0, 0, 0, 0xb8a888, false);
    // a ring of little offerings at its foot: candles in shells
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      put(ctx, "flat", new THREE.CylinderGeometry(0.04, 0.05, 0.16, 5), f, Math.cos(a) * 0.55, 0.08, Math.sin(a) * 0.55, 0, 0, 0, 0xe8dcc0, false);
    }
    const p = f.at(0.6, 3.0, 0);
    glows.push({ x: p.x, y: p.y, z: p.z, size: 4.2, color: 0xf0e0a8 });
    const c = f.at(0, 0.3, 0);
    glows.push({ x: c.x, y: c.y, z: c.z, size: 2.6, color: 0xffc070 });
    col.circle(f.at(0, 0, 0).x, f.at(0, 0, 0).z, 0.25);
    anchors.shrine = new V3(X + SHRINE.x, DECK, SHRINE.z);
  }

  // Mother Phem's kettle: a black pot on a chain over a clay hearth
  {
    const f = F(KETTLE.x, KETTLE.z);
    put(ctx, "stoneGrey", new THREE.CylinderGeometry(0.75, 0.85, 0.22, 10), f, 0, 0.11, 0, 0, 0, 0, 0x6a5444);
    put(ctx, "ember", new THREE.CylinderGeometry(0.42, 0.5, 0.06, 9), f, 0, 0.24, 0, 0, 0, 0, 0xffffff, false);
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2;
      put(ctx, "flat", new THREE.CylinderGeometry(0.04, 0.05, 2.0, 5), f, Math.cos(a) * 0.55, 0.95, Math.sin(a) * 0.55, Math.sin(a) * 0.27, 0, -Math.cos(a) * 0.27, C.timber);
    }
    put(ctx, "metal", new THREE.CylinderGeometry(0.012, 0.012, 0.6, 3), f, 0, 1.55, 0, 0, 0, 0, C.iron, false);
    const pot = new THREE.SphereGeometry(0.42, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.72);
    pot.rotateX(Math.PI);
    put(ctx, "metal", pot, f, 0, 0.95, 0, 0, 0, 0, 0x1e1e20);
    put(ctx, "flat", new THREE.CircleGeometry(0.33, 12), f, 0, 0.84, 0, -Math.PI / 2, 0, 0, 0x5a8a3a, false);
    const p = f.at(0, 0.6, 0);
    fires.push(p);
    glows.push({ x: p.x, y: p.y, z: p.z, size: 4, color: 0xff8a3a });
    const q = f.at(0, 1.0, 0);
    glows.push({ x: q.x, y: q.y, z: q.z, size: 2.2, color: 0x9ae070 });
    smoke.push(f.at(0, 1.2, 0));
    col.circle(X + KETTLE.x, KETTLE.z, 0.75);
    // her table of jars beside it
    const t = F(KETTLE.x - 1.9, KETTLE.z + 0.9, 0.3);
    put(ctx, "planks", boxUV(1.4, 0.08, 0.7, 1, 1), t, 0, 0.8, 0);
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) put(ctx, "flat", new THREE.BoxGeometry(0.07, 0.8, 0.07), t, sx * 0.62, 0.4, sz * 0.28, 0, 0, 0, C.timber);
    for (let k = 0; k < 6; k++) put(ctx, "flat", new THREE.CylinderGeometry(0.06, 0.07, 0.18 + (k % 3) * 0.05, 7), t, -0.5 + k * 0.2, 0.93, (k % 2) * 0.16 - 0.08, 0, 0, 0, [0x6a8a5a, 0x8a6a4a, 0xa8a088][k % 3], false);
    col.box(t.at(0, 0, 0).x, t.at(0, 0, 0).z, 1.5, 0.8, 0.3);
    anchors.kettle = new V3(X - 44, DECK, 64);
  }

  // the smokehouse fire and fish rack
  {
    const f = F(FIREPIT.x, FIREPIT.z);
    put(ctx, "stoneGrey", new THREE.CylinderGeometry(0.85, 0.95, 0.2, 10), f, 0, 0.1, 0, 0, 0, 0, 0x6a5848);
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      put(ctx, "stoneGrey", new THREE.DodecahedronGeometry(0.2, 0), f, Math.cos(a) * 0.75, 0.25, Math.sin(a) * 0.75, k, k * 2, 0, 0x5a564c);
    }
    put(ctx, "ember", new THREE.ConeGeometry(0.35, 0.3, 6), f, 0, 0.32, 0, 0, 0, 0, 0xffffff, false);
    for (let k = 0; k < 4; k++) put(ctx, "bark", new THREE.CylinderGeometry(0.06, 0.06, 0.8, 5), f, 0, 0.3, 0, 0.3, k * 0.8, Math.PI / 2 - 0.25, 0xffffff);
    const p = f.at(0, 0.6, 0);
    fires.push(p);
    glows.push({ x: p.x, y: p.y, z: p.z, size: 5, color: 0xff8a3a });
    smoke.push(f.at(0, 0.9, 0));
    col.circle(X + FIREPIT.x, FIREPIT.z, 0.95);
    const rk = F(-34.2, 55.4, 0.1);
    for (const s of [-1, 1]) {
      put(ctx, "flat", new THREE.BoxGeometry(0.12, 2.0, 0.12), rk, s * 1.1, 1.0, 0, 0, 0, 0, C.timber);
      col.circle(rk.at(s * 1.1, 0, 0).x, rk.at(s * 1.1, 0, 0).z, 0.15);
    }
    put(ctx, "flat", new THREE.BoxGeometry(2.4, 0.08, 0.08), rk, 0, 1.95, 0, 0, 0, 0, C.timber);
    for (let k = 0; k < 9; k++) {
      const g = new THREE.SphereGeometry(0.07, 6, 4);
      g.scale(0.7, 4, 0.5);
      put(ctx, "flat", g, rk, -0.95 + k * 0.24, 1.55, 0, 0, 0, 0, k % 3 ? 0x6a5434 : 0x8a7048, false);
    }
    anchors.smokehouse = new V3(X - 38, DECK, 58);
  }

  // Liss's boat-shop: a counter under an awning, her shelves, the jetty and boats
  {
    const f = F(COUNTER.x, COUNTER.z);
    put(ctx, "planks", boxUV(3.2, 1.0, 0.8, 1, 1), f, 0, 0.5, 0, 0, 0, 0, 0x8a765a);
    put(ctx, "planksDark", boxUV(3.4, 0.08, 1.0, 1, 1), f, 0, 1.04, 0, 0, 0, 0, 0x7a6a54);
    col.box(X + COUNTER.x, COUNTER.z, 3.2, 0.8, 0);
    for (const [sx, sz] of [[-1.6, -0.3], [1.6, -0.3], [-1.6, 2.6], [1.6, 2.6]]) put(ctx, "flat", new THREE.BoxGeometry(0.14, 2.6, 0.14), f, sx, 1.3, sz, 0, 0, 0, C.timber);
    for (let k = 0; k < 7; k++) put(ctx, "flat", new THREE.BoxGeometry(0.5, 0.06, 3.4), f, -1.5 + k * 0.5, 2.62 + Math.cos(k) * 0.05, 1.15, -0.18, 0, 0, k % 2 ? 0x6a7058 : 0x8a7e62);
    // the shelves on the west half (she slips out east to the jetty)
    const sf = F(COUNTER.x - 1.0, COUNTER.z + 2.3);
    put(ctx, "planksDark", boxUV(1.6, 1.8, 0.45, 1, 1), sf, 0, 0.9, 0, 0, 0, 0, 0x6a5a48);
    for (let k = 0; k < 8; k++) put(ctx, "flat", new THREE.CylinderGeometry(0.06, 0.07, 0.2, 7), sf, -0.6 + (k % 4) * 0.4, k < 4 ? 1.9 : 1.2, 0.0, 0, 0, 0, [0x6a8a5a, 0xa8a088, 0x8a3a2a, 0x5a6a8a][k % 4], false);
    col.box(X + COUNTER.x - 1.0, COUNTER.z + 2.3, 1.6, 0.5, 0);
    // goods on the counter: eels on a string, a lantern, a coil of rope
    put(ctx, "flat", new THREE.TorusGeometry(0.2, 0.06, 5, 10), f, 1.0, 1.12, 0, Math.PI / 2, 0, 0, 0xa8946a, false);
    put(ctx, "window", new THREE.BoxGeometry(0.16, 0.22, 0.16), f, -1.2, 1.2, 0, 0, 0, 0, 0xffffff, false);
    const lp = f.at(-1.2, 1.25, 0);
    glows.push({ x: lp.x, y: lp.y, z: lp.z, size: 2.6, color: 0xffb060 });
    for (let k = 0; k < 4; k++) put(ctx, "flat", new THREE.CylinderGeometry(0.03, 0.03, 0.5, 4), f, 0.2 + k * 0.12, 1.3, 0.1, 0, 0, 0.1, 0x3a4030, false);
    // an oar for a sign
    put(ctx, "planks", boxUV(0.08, 2.4, 0.05, 1, 1), f, 1.75, 2.0, -0.35, 0, 0, 0.5, 0x9a8a6a);
    put(ctx, "planks", boxUV(0.3, 0.7, 0.05, 1, 1), f, 2.3, 2.95, -0.35, 0, 0, 0.5, 0x9a8a6a);
    anchors.liss = new V3(X + COUNTER.x, DECK, 66);
    // boats on the water beside the jetty
    const boat = (lx: number, lz: number, ry: number, len: number) => {
      const g = new THREE.CylinderGeometry(0.7, 0.7, len, 10, 1, true, Math.PI / 2, Math.PI);
      g.rotateZ(Math.PI / 2);
      g.rotateY(Math.PI / 2);
      const p = g.getAttribute("position");
      for (let i = 0; i < p.count; i++) {
        const t = p.getZ(i) / (len / 2);
        const k = 1 - t * t * 0.85;
        p.setX(i, p.getX(i) * k);
        p.setY(i, p.getY(i) * (0.6 + 0.4 * k));
      }
      g.computeVertexNormals();
      const bf = F(lx, lz, ry, WATER);
      put(ctx, "planksDark", g, bf, 0, 0.32, 0, 0, 0, 0, 0x6a5a46);
      put(ctx, "planks", boxUV(1.0, 0.06, 0.3, 1, 1), bf, 0, 0.1, 0.3, 0, 0, 0, 0x8a7a5a);
      put(ctx, "planks", boxUV(0.06, 0.05, 2.4, 1, 1), bf, 0.5, 0.3, 0, 0.1, 0.3, 0, 0x8a7a5a);
    };
    boat(-32.4, 80, 0.06, 4.2);
    boat(-37.8, 84.4, -0.1, 3.6);
    boat(-32.6, 86.8, 0.3, 3.4);
    for (const z of [76, 82, 88]) lamp(ctx, X - 33.9, z - 0.01, -Math.PI / 2);
    barrel(ctx, X - 35.8, 73.8);
    crate(ctx, X - 34.2, 74.4, 0.6, 0.4);
    sack(ctx, X - 35.9, 75.0);
  }

  // the reliquary: a gabled box of black oak on a stand, its lid chained
  {
    const f = F(RELIQUARY.x, RELIQUARY.z, 0.7);
    put(ctx, "flat", new THREE.BoxGeometry(0.7, 0.6, 0.6), f, 0, 0.3, 0, 0, 0, 0, 0x3a3028);
    put(ctx, "planksDark", boxUV(0.95, 0.6, 0.6, 1, 1), f, 0, 0.9, 0, 0, 0, 0, 0x5a4a3a);
    for (const s of [-1, 1]) put(ctx, "planksDark", boxUV(1.05, 0.06, 0.42, 1, 1), f, 0, 1.32, s * 0.15, s * 0.65, 0, 0, 0x4a3c30);
    put(ctx, "metal", new THREE.BoxGeometry(1.0, 0.06, 0.64), f, 0, 0.7, 0, 0, 0, 0, 0x8a7a48);
    put(ctx, "metal", new THREE.BoxGeometry(0.06, 0.66, 0.64), f, 0, 0.92, 0, 0, 0, 0, 0x8a7a48);
    put(ctx, "metal", new THREE.TorusGeometry(0.1, 0.025, 4, 8), f, 0, 0.82, 0.32, 0, 0, 0, C.iron, false);
    col.circle(X + RELIQUARY.x, RELIQUARY.z, 0.55);
    const p = f.at(0, 1.0, 0.4);
    glows.push({ x: p.x, y: p.y, z: p.z, size: 1.6, color: 0xe8c878 });
    const rel = cacheDefs.find((c) => c.id === "drear_reliquary");
    anchors.reliquary = new V3(X + (rel ? rel.x : -46), DECK, rel ? rel.z : 70);
  }
  // Drear's lamps, barrels and crates
  lamp(ctx, X - 47.4, 51.6, Math.PI / 4);
  lamp(ctx, X - 32.6, 72.4, -Math.PI * 0.75);
  lamp(ctx, X - 18.0, 63.3, Math.PI);
  lamp(ctx, X - 47.6, 72.2, Math.PI * 0.75);
  barrel(ctx, X - 33.0, 63.8);
  barrel(ctx, X - 32.8, 64.8, 0.9, true);
  crate(ctx, X - 47.0, 58.4, 0.7, 0.3);
  crate(ctx, X - 46.9, 59.3, 0.55, 1.0);
  sack(ctx, X - 47.2, 60.2);

  // ------------------------------------------------------------ the sunken chapel and its bell tower
  {
    const nave = { x0: 22, x1: 40, z0: -3, z1: 7 };
    const cy = CHAPEL_FLOOR;
    put(ctx, "flagstone", boxUV(nave.x1 - nave.x0, 0.3, nave.z1 - nave.z0, 3, 3), F((nave.x0 + nave.x1) / 2, (nave.z0 + nave.z1) / 2, 0, cy), 0, -0.14, 0, 0, 0, 0, 0x6a6c5c, false);
    const cr = rng(404);
    /** a broken wall from (x0,z0) to (x1,z1): pieces of varying height, some gone */
    const ruinWall = (x0: number, z0: number, x1: number, z1: number, hmax: number, gaps: [number, number][]) => {
      const len = Math.hypot(x1 - x0, z1 - z0);
      const n = Math.round(len / 1.2);
      const rot = Math.atan2(x1 - x0, z1 - z0) - Math.PI / 2;
      for (let k = 0; k < n; k++) {
        const t0 = k / n;
        const t1 = (k + 1) / n;
        const tm = (t0 + t1) / 2;
        const s = tm * len;
        if (gaps.some(([a, b]) => s > a && s < b)) continue;
        const env_ = 0.35 + 0.65 * Math.abs(Math.sin(tm * Math.PI * 1.7 + x0));
        const hh = Math.max(0.5, hmax * env_ * (0.6 + cr() * 0.5));
        const px = x0 + (x1 - x0) * tm;
        const pz = z0 + (z1 - z0) * tm;
        put(ctx, "stoneGrey", boxUV(len / n + 0.04, hh, 0.8, 2, 2), F(px, pz, rot, cy - 0.3), 0, hh / 2, 0, 0, 0, 0, 0x5e6256);
        if (hh > 3 && cr() < 0.5) put(ctx, "stoneGrey", boxUV(len / n * 0.8, 0.3, 0.9, 1, 1), F(px, pz, rot, cy - 0.3), 0, hh, 0, 0, 0, 0, 0x4e5248);
        col.box(X + px, pz, len / n, 0.8, rot);
        // moss and weed at the waterline
        put(ctx, "flat", new THREE.BoxGeometry(len / n + 0.06, 0.25, 0.86), F(px, pz, rot, WATER), 0, 0.02, 0, 0, 0, 0, 0x2e3a22, false);
      }
    };
    ruinWall(nave.x0, nave.z0, nave.x1, nave.z0, 5.5, [[4.5, 7.0], [12, 13.4]]);
    ruinWall(nave.x0, nave.z1, nave.x1, nave.z1, 6.0, [[8, 10.6]]);
    ruinWall(nave.x0, nave.z0, nave.x0, nave.z1, 4.0, [[3.2, 6.8]]);
    ruinWall(nave.x1, nave.z0, nave.x1, nave.z1, 7.0, [[4.2, 5.8]]);
    // columns, two standing, others broken; drums lying in the water
    for (let k = 0; k < 4; k++) {
      for (const zz of [-0.4, 4.4]) {
        const xx = 25.5 + k * 4;
        const tall = (k + (zz > 0 ? 1 : 0)) % 3 === 0 ? 6.5 : 1 + cr() * 2.4;
        put(ctx, "stoneGrey", new THREE.CylinderGeometry(0.42, 0.48, tall, 10), F(xx, zz, 0, cy), 0, tall / 2, 0, 0, 0, 0, 0x6a6c60);
        col.circle(X + xx, zz, 0.55);
        if (tall < 4) put(ctx, "stoneGrey", new THREE.CylinderGeometry(0.42, 0.42, 1.2, 10), F(xx + 1.2, zz + (cr() - 0.5) * 1.2, cr() * 3, cy), 0, 0.2, 0, 0, 0, Math.PI / 2, 0x5e6256);
      }
    }
    // broken pews
    for (let k = 0; k < 5; k++)
      for (const zz of [0.8, 3.2]) {
        if (cr() < 0.3) continue;
        const pf = F(27 + k * 2.2, zz, Math.PI / 2 + (cr() - 0.5) * 0.4, cy);
        put(ctx, "planksDark", boxUV(1.8, 0.08, 0.4, 1, 1), pf, 0, 0.45, 0, (cr() - 0.5) * 0.3, 0, 0, 0x4a4234);
        put(ctx, "planksDark", boxUV(1.8, 0.5, 0.06, 1, 1), pf, 0, 0.75, -0.2, 0, 0, 0, 0x4a4234);
      }
    // the altar, its candles still lit: somebody tends them
    {
      const af = F(38.4, 2, -Math.PI / 2, cy);
      put(ctx, "stone", boxUV(2.4, 1.1, 1.0, 1, 1), af, 0, 0.55, 0, 0, 0, 0, 0x9a948a);
      put(ctx, "stone", boxUV(2.6, 0.14, 1.2, 1, 1), af, 0, 1.15, 0, 0, 0, 0, 0xa8a296);
      col.box(X + 38.4, 2, 1.1, 2.5, 0);
      for (let k = 0; k < 5; k++) {
        const ch = 0.18 + (k % 3) * 0.08;
        put(ctx, "flat", new THREE.CylinderGeometry(0.035, 0.04, ch, 6), af, -0.9 + k * 0.45, 1.22 + ch / 2, 0.2 * ((k % 2) - 0.5), 0, 0, 0, 0xe8dcc0, false);
        const p = af.at(-0.9 + k * 0.45, 1.32 + ch, 0.2 * ((k % 2) - 0.5));
        glows.push({ x: p.x, y: p.y, z: p.z, size: 1.3, color: 0xffd080 });
      }
      const p = af.at(0, 1.6, 0);
      fires.push(p);
    }
    // the bell tower: leaning, foot in the water, the bell still hanging
    {
      const parts: THREE.BufferGeometry[] = [];
      const s = 4.2;
      const t = 0.7;
      const wallH = 9.5;
      for (const [ox, oz, w, d] of [[0, -s / 2 + t / 2, s, t], [0, s / 2 - t / 2, s, t], [-s / 2 + t / 2, 0, t, s - t * 2], [s / 2 - t / 2, 0, t, s - t * 2]] as [number, number, number, number][]) {
        parts.push(at(boxUV(w, wallH, d, 2, 2), ox, wallH / 2, oz, 0x5a5e52));
      }
      // belfry: four corner piers, a cap, a stubby broken spire
      for (const [ox, oz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) parts.push(at(boxUV(0.9, 3.0, 0.9, 1, 1), (ox * (s - 0.9)) / 2, wallH + 1.5, (oz * (s - 0.9)) / 2, 0x5e6256));
      parts.push(at(boxUV(s + 0.4, 0.5, s + 0.4, 2, 2), 0, wallH + 3.25, 0, 0x4e5248));
      parts.push(at(boxUV(s + 0.3, 0.35, s + 0.3, 2, 2), 0, wallH, 0, 0x4e5248));
      const spire = new THREE.ConeGeometry(s * 0.66, 3.6, 4, 1, true);
      parts.push(at(spire, 0, wallH + 5.3, 0, 0x3e423a, 0, Math.PI / 4, 0.12));
      // weed line, dark wet base
      parts.push(at(boxUV(s + 0.08, 0.6, s + 0.08, 1, 1), 0, 1.45, 0, 0x2a3220));
      const g = merge(parts);
      const lean = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(0.06, 0, 0.14));
      g.applyMatrix4(lean);
      g.translate(X + TOWER.x, -1.6, TOWER.z);
      batch.add("stoneGrey", M.stoneGrey, g);
      const bg = bellGeo(1.1, C.verdigris);
      bg.translate(0, wallH + 0.8, 0);
      bg.applyMatrix4(lean);
      bg.translate(X + TOWER.x, -1.6, TOWER.z);
      batch.add("metal", M.metal, bg, false);
      col.box(X + TOWER.x, TOWER.z, s + 0.4, s + 0.4, 0);
      const bp = new V3(0, wallH + 1.2, 0).applyMatrix4(lean).add(new V3(X + TOWER.x, -1.6, TOWER.z));
      glows.push({ x: bp.x, y: bp.y, z: bp.z, size: 3.2, color: 0x8ad0a0 });
      anchors.bellTower = new V3(X + TOWER.x, 0, TOWER.z);
    }
    // a fallen bell, half under, its lip green with weed
    put(ctx, "metal", bellGeo(1.3, C.verdigris), F(14.4, 6.2, 0.4, WATER - 0.55), 0, 0, 0, 0.9, 0.3, 0.4, 0xffffff);
    col.circle(X + 14.4, 6.2, 0.9);
    anchors.chapel = new V3(X + CHAPEL.x, H(CHAPEL.x, CHAPEL.z), CHAPEL.z);
  }

  // drowned bells: their crowns break the surface out in the pools
  const sunkBells: [number, number][] = [];
  for (let i = 0; i < 40 && sunkBells.length < 7; i++) {
    const x = B.minX + 20 + r() * (B.maxX - B.minX - 40);
    const z = -100 + r() * 200;
    const h = terrain.heightAt(X + x, z);
    if (h > -0.4 || h < -1.2) continue;
    if (causeDist(x, z) < 6 || Math.hypot(x - DREAR.x, z - DREAR.z) < 22) continue;
    if (spawns.some((s) => Math.hypot(x - s.x, z - s.z) < 4)) continue;
    sunkBells.push([x, z]);
    const s = 0.8 + r() * 0.6;
    put(ctx, "metal", bellGeo(s, r() < 0.5 ? C.verdigris : 0x6a5a3a), F(x, z, r() * 6, h), 0, 0, 0, (r() - 0.5) * 0.6, 0, (r() - 0.5) * 0.6, 0xffffff);
    col.circle(X + x, z, s * 0.45);
  }

  // ------------------------------------------------------------ the witches' huts
  WITCHES.forEach((w, i) => {
    const rot = Math.atan2(w.sx - w.hx, w.sz - w.hz);
    const floorY = Math.max(terrain.heightAt(X + w.hx, w.hz), 0) + 0.7;
    const hut: Hut = { x: w.hx, z: w.hz, w: 3.8, d: 3.4, rot, seed: 40 + i, witch: true };
    const f = stiltHut(hut, floorY);
    // a short ladder down from the porch
    for (let k = 0; k < 4; k++) put(ctx, "flat", new THREE.BoxGeometry(0.7, 0.06, 0.08), f, 0, -0.15 - k * 0.22, hut.d / 2 + 1.35 + k * 0.08, 0, 0, 0, C.timber);
    // skulls on stakes, bottles on strings, a cauldron, a bell gallows
    const wr = rng(500 + i);
    const ax = (w.hx + w.sx) / 2;
    const az = (w.hz + w.sz) / 2;
    const px = -(w.sz - w.hz);
    const pz = w.sx - w.hx;
    const pl = Math.hypot(px, pz) || 1;
    const cx = ax + (px / pl) * 3.2;
    const cz = az + (pz / pl) * 3.2;
    const cf = F(cx, cz);
    const caul = new THREE.SphereGeometry(0.6, 12, 8, 0, Math.PI * 2, Math.PI * 0.25, Math.PI * 0.75);
    put(ctx, "metal", caul, cf, 0, 0.55, 0, 0, 0, 0, 0x1e1e20);
    put(ctx, "flat", new THREE.CircleGeometry(0.42, 12), cf, 0, 0.98, 0, -Math.PI / 2, 0, 0, 0x6ab040, false);
    put(ctx, "ember", new THREE.ConeGeometry(0.4, 0.25, 6), cf, 0, 0.1, 0, 0, 0, 0, 0xffffff, false);
    const cp = cf.at(0, 1.2, 0);
    glows.push({ x: cp.x, y: cp.y, z: cp.z, size: 4.5, color: 0x7ae050 });
    fires.push(cf.at(0, 0.4, 0));
    smoke.push(cf.at(0, 1.3, 0));
    col.circle(X + cx, cz, 0.7);
    for (let k = 0; k < 4; k++) {
      const a = wr() * Math.PI * 2;
      const d = 5 + wr() * 3;
      const sx = ax + Math.cos(a) * d;
      const sz = az + Math.sin(a) * d;
      if (Math.hypot(sx - w.sx, sz - w.sz) < 2.5) continue;
      const sf = F(sx, sz, wr() * 6);
      put(ctx, "flat", new THREE.CylinderGeometry(0.04, 0.06, 1.8, 5), sf, 0, 0.9, 0, (wr() - 0.5) * 0.2, 0, (wr() - 0.5) * 0.2, C.timber);
      const sk = new THREE.SphereGeometry(0.16, 8, 6);
      sk.scale(0.9, 0.85, 1.2);
      put(ctx, "flat", sk, sf, 0, 1.9, 0, 0, 0, 0, C.bone, false);
      col.circle(X + sx, sz, 0.12);
    }
    // the gallows: a crooked pole and a drowned bell on a rope (the witches ring them at dusk)
    const gx = w.hx + (w.hx - w.sx) * 0.15 + (px / pl) * -3.5;
    const gz = w.hz + (w.hz - w.sz) * 0.15 + (pz / pl) * -3.5;
    const gf = F(gx, gz, rot + Math.PI / 2);
    put(ctx, "bark", new THREE.CylinderGeometry(0.1, 0.14, 4.2, 6), gf, 0, 2.0, 0, 0, 0, 0.06, 0x5a5448);
    put(ctx, "bark", new THREE.CylinderGeometry(0.07, 0.09, 2.0, 5), gf, 0.85, 3.9, 0, 0, 0, Math.PI / 2 - 0.15, 0x5a5448);
    put(ctx, "flat", new THREE.CylinderGeometry(0.015, 0.015, 1.0, 3), gf, 1.6, 3.5, 0, 0, 0, 0, 0x6a6048, false);
    put(ctx, "metal", bellGeo(0.6, C.verdigris), gf, 1.6, 2.6, 0, 0, 0, 0.1, 0xffffff, false);
    col.circle(X + gx, gz, 0.2);
    for (let k = 0; k < 5; k++) {
      const b = new THREE.CylinderGeometry(0.05, 0.06, 0.2, 6);
      put(ctx, "flat", b, f, -1.4 + k * 0.6, 1.9 - (k % 2) * 0.25, hut.d / 2 + 0.95, 0, 0, 0, [0x5a8a5a, 0x8a5a7a, 0x6a6a3a][k % 3], false);
    }
    anchors["witch" + (i + 1)] = new V3(X + w.sx, H(w.sx, w.sz), w.sz);
  });

  // ------------------------------------------------------------ black iron outcrops
  {
    const outs: { x: number; z: number; r: number }[] = [{ x: 104, z: -25, r: 10 }, { x: -110, z: -100, r: 8 }];
    const nodesHere = nodeDefs.filter((n) => n.kind === "blackiron");
    let seed = 0;
    for (const o of outs) {
      for (let k = 0; k < 9; k++) {
        const a = (k / 9) * Math.PI * 2 + r() * 0.4;
        const d = o.r * (0.55 + r() * 0.45);
        const x = o.x + Math.cos(a) * d;
        const z = o.z + Math.sin(a) * d;
        if (nodesHere.some((n) => Math.hypot(n.x - x, n.z - z) < 4)) continue;
        const s = 1.0 + r() * 1.3;
        const g = rockGeo(70 + seed++, false, 0x2e2e34);
        put(ctx, "flat", g, F(x, z, r() * 6, terrain.heightAt(X + x, z) - 0.3), 0, s * 0.8, 0, (r() - 0.5) * 0.3, 0, (r() - 0.5) * 0.3, 0xffffff);
        // spires: the same rock, stretched up
        if (r() < 0.6) {
          const sp = rockGeo(90 + seed++, false, 0x26262c);
          sp.scale(0.6, 2.6, 0.6);
          put(ctx, "flat", sp, F(x + 0.5, z - 0.4, r() * 6, terrain.heightAt(X + x, z) - 0.2), 0, s * 1.2, 0, 0, 0, (r() - 0.5) * 0.2, 0xffffff);
        }
        col.circle(X + x, z, s * 0.85);
      }
    }
    anchors.blackIronEast = new V3(X + 104, H(104, -25), -25);
    anchors.blackIronWest = new V3(X - 110, H(-110, -100), -100);
  }

  // ------------------------------------------------------------ the Black Keep from the shore
  {
    const kc = 0x34343a;
    const wallH = 14;
    // the curtain wall, split at the gate
    for (const [x0, x1] of [[-150, -3.4], [3.4, 150]] as [number, number][]) {
      const w = x1 - x0;
      const f = F((x0 + x1) / 2, KEEP_WALL_Z, 0, 0);
      put(ctx, "stoneDark", boxUV(w, wallH + 1, 4, 3, 3), f, 0, wallH / 2 - 0.5, 0, 0, 0, 0, kc);
      put(ctx, "stoneDark", boxUV(w, 1.2, 4.6, 3, 3), f, 0, 0.2, 0.2, 0, 0, 0, 0x2a2a2e);
      const nm = Math.floor(w / 2.2);
      for (let k = 0; k < nm; k++) put(ctx, "stoneDark", boxUV(1.2, 1.4, 1.0, 1, 1), f, -w / 2 + 1.1 + k * 2.2, wallH + 0.6, 1.5, 0, 0, 0, kc);
      col.box(X + (x0 + x1) / 2, KEEP_WALL_Z, w, 4, 0);
    }
    // over the gate
    put(ctx, "stoneDark", boxUV(7.2, wallH - 7, 4, 2, 2), F(0, KEEP_WALL_Z, 0, 0), 0, 7 + (wallH - 7) / 2, 0, 0, 0, 0, kc);
    {
      // the arch, the dark beyond it, the portcullis raised into the wall
      const shape = new THREE.Shape();
      shape.moveTo(-3.4, 0);
      shape.lineTo(-3.4, 5.4);
      shape.quadraticCurveTo(0, 8.4, 3.4, 5.4);
      shape.lineTo(3.4, 0);
      shape.lineTo(3.9, 0);
      shape.lineTo(3.9, 7.4);
      shape.lineTo(-3.9, 7.4);
      shape.lineTo(-3.9, 0);
      shape.closePath();
      const g = new THREE.ExtrudeGeometry(shape, { depth: 0.5, bevelEnabled: false });
      put(ctx, "stoneGrey", g, F(0, KEEP_WALL_Z + 2.0, 0, 0), 0, 0, 0, 0, 0, 0, 0x4a4a50);
      put(ctx, "flat", new THREE.PlaneGeometry(6.8, 7.4), F(0, KEEP_WALL_Z - 0.6, 0, 0), 0, 3.7, 0, 0, 0, 0, 0x050506, false);
      for (let k = 0; k < 7; k++) put(ctx, "metal", new THREE.BoxGeometry(0.12, 2.4, 0.12), F(0, KEEP_WALL_Z + 1.4, 0, 0), -3 + k, 6.6, 0, 0, 0, 0, 0x2a2a2c, false);
      for (let k = 0; k < 7; k++) put(ctx, "metal", new THREE.ConeGeometry(0.08, 0.3, 4), F(0, KEEP_WALL_Z + 1.4, 0, 0), -3 + k, 5.25, 0, Math.PI, 0, 0, 0x2a2a2c, false);
      put(ctx, "metal", new THREE.BoxGeometry(6.4, 0.12, 0.12), F(0, KEEP_WALL_Z + 1.4, 0, 0), 0, 6.2, 0, 0, 0, 0, 0x2a2a2c, false);
      // the gate's threshold stones
      put(ctx, "stoneGrey", boxUV(8, 0.3, 5, 2, 2), F(0, KEEP_WALL_Z + 4.6, 0, H(0, -139.5)), 0, -0.12, 0, 0, 0, 0, 0x4a4a4e, false);
      col.box(X, KEEP_WALL_Z - 1.4, 7, 1.2, 0);
    }
    // gate towers and the towers along the wall
    for (const tx of [-9, 9, -40, 40, -80, 80, -120, 120]) {
      const big = Math.abs(tx) < 10;
      const rad = big ? 4.2 : 5;
      const th = big ? 24 : 19 + (Math.abs(tx) % 7);
      const f = F(tx, KEEP_WALL_Z + 1.2, 0, 0);
      put(ctx, "stoneDark", new THREE.CylinderGeometry(rad, rad + 0.5, th, 14), f, 0, th / 2 - 0.5, 0, 0, 0, 0, kc);
      for (let k = 0; k < 10; k++) {
        const a = (k / 10) * Math.PI * 2;
        put(ctx, "stoneDark", boxUV(1.1, 1.3, 0.9, 1, 1), f, Math.cos(a) * (rad - 0.2), th, Math.sin(a) * (rad - 0.2), 0, -a, 0, kc);
      }
      put(ctx, "flat", new THREE.BoxGeometry(0.3, 1.3, 0.2), f, 0, th * 0.62, rad + 0.02, 0, 0, 0, 0x08080a, false);
      col.circle(X + tx, KEEP_WALL_Z + 1.2, rad + 0.4);
      if (big) {
        bannerGeos.push(bannerQuad(X + tx, th - 7, KEEP_WALL_Z + 1.2 + rad + 0.15, 0, 2.4, 6.0));
        // braziers at the gate
        const bx = tx > 0 ? 5.4 : -5.4;
        const bf = F(bx, KEEP_WALL_Z + 6.2);
        put(ctx, "metal", new THREE.CylinderGeometry(0.55, 0.3, 0.5, 10), bf, 0, 1.15, 0, 0, 0, 0, 0x3a2e24);
        for (const a of [0, 2.1, 4.2]) put(ctx, "metal", new THREE.BoxGeometry(0.06, 1.0, 0.06), bf, Math.cos(a) * 0.3, 0.5, Math.sin(a) * 0.3, Math.sin(a) * 0.3, 0, Math.cos(a) * 0.3, 0x2a2a2a);
        put(ctx, "ember", new THREE.ConeGeometry(0.42, 0.35, 7), bf, 0, 1.45, 0, 0, 0, 0, 0xffffff, false);
        const p = bf.at(0, 1.8, 0);
        fires.push(p);
        glows.push({ x: p.x, y: p.y, z: p.z, size: 6, color: 0xff7a30 });
        col.circle(X + bx, KEEP_WALL_Z + 6.2, 0.6);
      }
    }
    // the keep itself, a black mass over the wall, lost in the fog above
    for (const [x, z, w, d, hh] of [[0, -160, 34, 18, 44], [-22, -156, 12, 12, 34], [22, -156, 12, 12, 38], [-60, -158, 30, 14, 26], [60, -158, 30, 14, 28]] as [number, number, number, number, number][]) {
      put(ctx, "stoneDark", boxUV(w, hh, d, 4, 4), F(x, z, 0, 0), 0, hh / 2, 0, 0, 0, 0, 0x2c2c32);
      const nm = Math.floor(w / 2.4);
      for (let k = 0; k < nm; k++) put(ctx, "stoneDark", boxUV(1.2, 1.4, 1.2, 1, 1), F(x, z, 0, 0), -w / 2 + 1.2 + k * 2.4, hh + 0.7, d / 2 - 0.6, 0, 0, 0, 0x2c2c32);
      for (let k = 0; k < 4; k++) {
        const wy = hh * (0.3 + k * 0.15);
        put(ctx, "window", new THREE.BoxGeometry(0.5, 1.2, 0.1), F(x, z, 0, 0), -w / 4 + (k % 2) * w / 2, wy, d / 2 + 0.05, 0, 0, 0, 0xffffff, false);
      }
    }
    for (const [bx, bz] of [[-6, -150.2], [6, -150.2]]) bannerGeos.push(bannerQuad(X + bx, 28, bz, 0, 3.0, 8.0));
    // a gibbet on the shore, empty
    {
      const f = F(-14, -124, 0.4);
      put(ctx, "flat", new THREE.BoxGeometry(0.22, 4.6, 0.22), f, 0, 2.3, 0, 0, 0, 0, C.timber);
      put(ctx, "flat", new THREE.BoxGeometry(1.6, 0.18, 0.18), f, 0.7, 4.4, 0, 0, 0, 0, C.timber);
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        put(ctx, "metal", new THREE.BoxGeometry(0.04, 1.5, 0.04), f, 1.3 + Math.cos(a) * 0.4, 3.0, Math.sin(a) * 0.4, 0, 0, 0, 0x2a2a2c, false);
      }
      for (const y of [2.25, 3.75]) put(ctx, "metal", new THREE.TorusGeometry(0.4, 0.03, 4, 10), f, 1.3, y, 0, Math.PI / 2, 0, 0.1, 0x2a2a2c, false);
      put(ctx, "flat", new THREE.CylinderGeometry(0.01, 0.01, 0.7, 3), f, 1.3, 4.0, 0, 0, 0, 0, 0x3a3a3a, false);
      col.circle(X - 14, -124, 0.25);
    }
    anchors.keepGate = new V3(X + GATE.x, H(GATE.x, GATE.z), GATE.z);
    anchors.keepArrive = new V3(X, H(0, -132), -132);
  }

  // ------------------------------------------------------------ dead trees, reeds, logs, lilies
  const scatters: Cullable[] = [];
  const forest = new ChunkBatch(64, 110);
  const clutter = new ChunkBatch(64, 80);
  scatters.push(forest, clutter);
  const deadTrees = [1, 2, 3].map((v) => {
    const t = treeGeo("oak", v + 300);
    return { geo: darken(t.trunk, 0.52, 0.55, 0.5), r: t.radius };
  });
  const deadSnag = (() => {
    const t = treeGeo("pine", 311);
    return { geo: darken(t.trunk, 0.45, 0.48, 0.44), r: t.radius };
  })();
  const huts = HUTS.map((h) => ({ x: h.x, z: h.z }));
  const clearOf = (x: number, z: number, pad: number) => {
    if (causeDist(x, z) < CAUSE_HW + 2.5 + pad) return true;
    if (deckAt(x, z) > -Infinity) return true;
    for (const d of DECKS) {
      const dx = d.bx - d.ax;
      const dz = d.bz - d.az;
      const len2 = dx * dx + dz * dz || 1;
      const t = Math.max(0, Math.min(1, ((x - d.ax) * dx + (z - d.az) * dz) / len2));
      if (Math.hypot(d.ax + dx * t - x, d.az + dz * t - z) < d.hw + 1.5 + pad) return true;
    }
    if (Math.hypot(x - DREAR.x, z - DREAR.z) < 20 + pad) return true;
    if (Math.abs(x - CHAPEL.x) < 14 + pad && Math.abs(z - CHAPEL.z) < 10 + pad) return true;
    if (Math.hypot(x - TOWER.x, z - TOWER.z) < 5 + pad) return true;
    for (const s of spawns) if (Math.hypot(x - s.x, z - s.z) < 5 + pad) return true;
    for (const n of nodeDefs) if (Math.hypot(x - n.x, z - n.z) < 4 + pad) return true;
    for (const c of cacheDefs) if (Math.hypot(x - c.x, z - c.z) < 3 + pad) return true;
    for (const h of huts) if (Math.hypot(x - h.x, z - h.z) < 5 + pad) return true;
    for (const w of WITCHES) if (Math.hypot(x - w.hx, z - w.hz) < 7 + pad || Math.hypot(x - w.sx, z - w.sz) < 6 + pad) return true;
    if (Math.hypot(x - ARRIVE.x, z - ARRIVE.z) < 12 + pad) return true;
    if (z < -118 && Math.abs(x) < 16 + pad) return true;
    if (z < KEEP_WALL_Z + 6) return true;
    return false;
  };
  for (let gx = B.minX + 3; gx < B.maxX; gx += 9)
    for (let gz = B.minZ + 3; gz < B.maxZ; gz += 9) {
      const x = gx + (r() - 0.5) * 8;
      const z = gz + (r() - 0.5) * 8;
      if (clearOf(x, z, 0)) continue;
      const dens = fbm(x * 0.03 + 9, z * 0.03 - 5, 3);
      const edge = Math.min(x - B.minX, B.maxX - x, z - B.minZ, B.maxZ - z);
      if (r() > 0.2 + dens * 0.45 + (edge < 20 ? 0.3 : 0)) continue;
      const y = terrain.heightAt(X + x, z);
      const snag = r() < 0.35;
      const tg = snag ? deadSnag : deadTrees[Math.floor(r() * deadTrees.length)];
      const s = snag ? 0.55 + r() * 0.35 : 0.7 + r() * 0.5;
      forest.add("dead", M.foliage, tg.geo, X + x, y - 0.3, z, r() * Math.PI * 2, s, s * (0.85 + r() * 0.3), true, { from: 6, scale: 14 });
      if (y > DEEP) col.circle(X + x, z, Math.max(0.3, tg.r * s + 0.1));
    }
  // a few dead trees on the Keep's island and the witch islands, closer in
  for (const w of WITCHES)
    for (let k = 0; k < 3; k++) {
      const a = r() * Math.PI * 2;
      const x = w.hx + Math.cos(a) * (9 + r() * 4);
      const z = w.hz + Math.sin(a) * (9 + r() * 4);
      if (clearOf(x, z, -2)) continue;
      const tg = deadTrees[k % 3];
      const s = 0.8 + r() * 0.3;
      forest.add("dead", M.foliage, tg.geo, X + x, terrain.heightAt(X + x, z) - 0.2, z, r() * 6, s, s, true, { from: 6, scale: 14 });
      col.circle(X + x, z, tg.r * s + 0.1);
    }

  // reeds at every waterline
  const reedGeo = (() => {
    const g = grassGeo(91, 18, 1.6);
    const c = g.getAttribute("color");
    for (let k = 0; k < c.count; k++) c.setXYZ(k, c.getX(k) * 0.82 + 0.06, c.getY(k) * 0.72, c.getZ(k) * 0.45);
    return g;
  })();
  const reeds = new Scatter([{ geo: reedGeo, mat: M.grass }], 48, 65);
  const grassG = (() => {
    const g = grassGeo(92, 12, 0.5);
    const c = g.getAttribute("color");
    for (let k = 0; k < c.count; k++) c.setXYZ(k, c.getX(k) * 0.6, c.getY(k) * 0.66, c.getZ(k) * 0.45);
    return g;
  })();
  const sedge = new Scatter([{ geo: grassG, mat: M.grass }], 48, 50);
  const lilyGeo = (() => {
    const parts: THREE.BufferGeometry[] = [];
    for (let k = 0; k < 4; k++) {
      const g = new THREE.CircleGeometry(0.28 + k * 0.05, 9, 0.3, Math.PI * 2 - 0.5);
      g.rotateX(-Math.PI / 2);
      g.translate(Math.cos(k * 1.9) * 0.6, 0.02 + k * 0.002, Math.sin(k * 1.9) * 0.6);
      parts.push(tint(g, k % 2 ? 0x3a4a26 : 0x2e3e20));
    }
    return merge(parts);
  })();
  const lilies = new Scatter([{ geo: lilyGeo, mat: M.clutter, receive: true }], 48, 55);
  const rockGeos = [0, 1, 2].map((i) => darken(rockGeo(i + 121, true, 0x5a564c), 0.7, 0.72, 0.62));
  const logG = logGeo(5, 0.36);
  const stumpG = stumpGeo(0.5, 0.6);
  const mushG = mushroomGeo(17);
  for (let i = 0; i < 16000; i++) {
    const x = B.minX + 2 + r() * (B.maxX - B.minX - 4);
    const z = B.minZ + 2 + r() * (B.maxZ - B.minZ - 4);
    if (z < KEEP_WALL_Z + 3) continue;
    if (deckAt(x, z) > -Infinity) continue;
    const cd = causeDist(x, z);
    if (cd < CAUSE_HW + 0.3) continue;
    const h = terrain.heightAt(X + x, z);
    const roll = r();
    if (h > -0.65 && h < 0.3) {
      if (roll < 0.36) {
        if (fbm(x * 0.12, z * 0.12, 2) < 0.42) continue;
        if (Math.hypot(x - ARRIVE.x, z - ARRIVE.z) < 5) continue;
        reeds.add(X + x, h - 0.05, z, r() * 6, 0.8 + r() * 0.6, 0.7 + r() * 0.7);
        continue;
      }
    }
    if (h < -0.15 && h > DEEP - 0.6 && roll < 0.42) {
      if (r() < 0.75 || cd < 5) continue;
      lilies.add(X + x, WATER + 0.01, z, r() * 6, 0.7 + r() * 0.6);
      continue;
    }
    if (h >= 0 && roll < 0.6) {
      if (fbm(x * 0.2, z * 0.2, 2) < 0.4) continue;
      sedge.add(X + x, h - 0.02, z, r() * 6, 0.8 + r() * 0.5);
      continue;
    }
    if (roll > 0.995 && !clearOf(x, z, 1)) {
      const ry = r() * Math.PI;
      clutter.add("flat", M.clutter, logG, X + x, Math.max(h, WATER - 0.2) + 0.1, z, ry, 1);
      if (h > DEEP) for (const t of [-1, 0, 1]) col.circle(X + x + Math.cos(ry) * 1.6 * t, z - Math.sin(ry) * 1.6 * t, 0.42);
    } else if (roll > 0.99 && !clearOf(x, z, 0)) {
      clutter.add("flat", M.clutter, stumpG, X + x, h - 0.1, z, r() * 6, 0.7 + r() * 0.6);
    } else if (roll > 0.985 && h > -0.3) {
      const sc = 0.4 + r() * 0.8;
      clutter.add("flat", M.clutter, rockGeos[i % 3], X + x, h - 0.15 * sc, z, r() * 6, sc, sc * (0.6 + r() * 0.4));
      if (sc > 0.85 && !clearOf(x, z, 0)) col.circle(X + x, z, sc * 0.7);
    } else if (roll > 0.98 && h > 0) {
      clutter.add("flat", M.clutter, mushG, X + x, h, z, r() * 6, 1 + r() * 0.8);
    }
  }
  scatters.push(reeds, lilies);

  // ------------------------------------------------------------ mist on the water
  {
    const pos: number[] = [];
    const uv: number[] = [];
    const idx: number[] = [];
    const quad = (x: number, y: number, z: number, s: number, ry: number) => {
      const b = pos.length / 3;
      const c = Math.cos(ry);
      const sn = Math.sin(ry);
      for (const [u, v] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        const lx = u * s;
        const lz = v * s * 0.7;
        pos.push(x + lx * c - lz * sn, y, z + lx * sn + lz * c);
        uv.push((u + 1) / 2, (v + 1) / 2);
      }
      idx.push(b, b + 2, b + 1, b, b + 3, b + 2);
    };
    for (let i = 0; i < 70; i++) {
      const x = B.minX + 10 + r() * (B.maxX - B.minX - 20);
      const z = B.minZ + 16 + r() * (B.maxZ - B.minZ - 24);
      const s = 8 + r() * 10;
      for (let k = 0; k < 2; k++) quad(X + x + (r() - 0.5) * 4, Math.max(WATER, terrain.heightAt(X + x, z)) + 0.5 + k * 0.8 + r() * 0.3, z + (r() - 0.5) * 4, s, r() * Math.PI);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeBoundingSphere();
    const mat = new THREE.MeshBasicMaterial({ map: glowTex(), color: 0x8a9a84, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide });
    const mist = new THREE.Mesh(g, mat);
    mist.renderOrder = 2;
    mist.name = "mist";
    root.add(mist);
  }

  // ------------------------------------------------------------ will-o'-wisps
  const WISPS = 22;
  const wispBase: { x: number; y: number; z: number; ph: number; rad: number; sp: number }[] = [];
  for (let i = 0; i < 200 && wispBase.length < WISPS; i++) {
    const x = B.minX + 15 + r() * (B.maxX - B.minX - 30);
    const z = -110 + r() * 225;
    if (causeDist(x, z) < 8 || Math.hypot(x - DREAR.x, z - DREAR.z) < 26) continue;
    wispBase.push({ x: X + x, y: 0.9 + r() * 1.4, z, ph: r() * 6.28, rad: 1.5 + r() * 3, sp: 0.15 + r() * 0.25 });
  }
  for (const p of pools) if (wispBase.length < WISPS + 6) wispBase.push({ x: X + p.x, y: 1.0 + r(), z: p.z, ph: r() * 6.28, rad: p.r * 0.5, sp: 0.1 + r() * 0.15 });
  const wispPos = new Float32Array(wispBase.length * 3);
  const wispGeo = new THREE.BufferGeometry();
  wispGeo.setAttribute("position", new THREE.BufferAttribute(wispPos, 3));
  const wispMat = new THREE.PointsMaterial({ map: glowTex(), color: 0x9af0a8, size: 1.5, sizeAttenuation: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
  const wisps = new THREE.Points(wispGeo, wispMat);
  wisps.frustumCulled = false;
  wisps.name = "wisps";
  root.add(wisps);
  const moveWisps = (t: number) => {
    wispBase.forEach((w, i) => {
      const a = t * w.sp + w.ph;
      wispPos[i * 3] = w.x + Math.cos(a) * w.rad + Math.sin(a * 2.3) * 0.6;
      wispPos[i * 3 + 1] = w.y + Math.sin(a * 1.7 + w.ph) * 0.45;
      wispPos[i * 3 + 2] = w.z + Math.sin(a * 0.9) * w.rad;
    });
    wispGeo.getAttribute("position").needsUpdate = true;
  };
  moveWisps(0);

  // ------------------------------------------------------------ nodes, then merge it all
  const nodes = zoneNodes(M, root, col, "mire", groundAt);
  if (bannerGeos.length) {
    const m = new THREE.Mesh(merge(bannerGeos), new THREE.MeshLambertMaterial({ map: keepBannerTex(), side: THREE.DoubleSide, vertexColors: true, alphaTest: 0.4 }));
    m.castShadow = true;
    root.add(m);
  }
  batch.build(root);
  for (const s of scatters) (s as ChunkBatch | Scatter).build(root);
  sedge.build(root);

  // ------------------------------------------------------------ anchors, regions, surfaces
  anchors.causeway = new V3(X - 2, CAUSE_H, 38);
  anchors.causewaySouth = new V3(X + 2, CAUSE_H, -90);
  for (const c of cacheDefs) anchors["cache_" + c.id] = new V3(X + c.x, H(c.x, c.z), c.z);

  const regionAt = (x: number, z: number) => {
    const lx = x - X;
    if (z < -112) return "keep_shore";
    if (Math.hypot(lx - DREAR.x, z - DREAR.z) < 26) return "drear";
    if (Math.hypot((lx - CHAPEL.x) * 0.8, z - CHAPEL.z) < 20) return "sunken_chapel";
    for (const w of WITCHES) if (Math.hypot(lx - w.hx, z - w.hz) < 24) return "witch_pools";
    if (causeDist(lx, z) < 9) return "causeway";
    return "mire";
  };
  const regions: Record<string, [string, string]> = {
    drear: ["Drear", "Huts on stilts. Doors that stay shut."],
    causeway: ["The Old Causeway", "South, to the Keep"],
    witch_pools: ["The Witch Pools", "Somebody rings the bells at dusk"],
    sunken_chapel: ["The Sunken Chapel", "The bell still hangs. The water rings it."],
    keep_shore: ["The Keep Shore", "Black stone, black banners, rain"],
    mire: ["The Dark Mire", "Green-black water, bells under it"],
  };
  const surfaceAt = (x: number, z: number): "wood" | "stone" | "dirt" | "grass" => {
    const lx = x - X;
    if (deckAt(lx, z) > -Infinity) return "wood";
    if (causeDist(lx, z) < CAUSE_HW + 0.4 || z < -120) return "stone";
    if (Math.abs(lx - CHAPEL.x) < 9 && Math.abs(z - CHAPEL.z) < 5) return "stone";
    return terrain.heightAt(x, z) > 0.1 ? "grass" : "dirt";
  };

  // ------------------------------------------------------------ per frame: the water moves, the wisps drift, bells answer
  let nextBell = 8 + r() * 10;
  const update = (dt: number, t: number) => {
    waterTex.offset.set((t * 0.004) % 1, (t * 0.0025) % 1);
    moveWisps(t);
    wispMat.opacity = 0.75 + Math.sin(t * 1.3) * 0.2;
    if (t > nextBell) {
      nextBell = t + 14 + Math.random() * 22;
      const me = env.players()[0];
      if (me && me.zone === "mire" && !me.dead) {
        // a bell under the water: low, soft, from somewhere you can't see
        env.audio.bell(0.05 + Math.random() * 0.04, 150 + Math.floor(Math.random() * 4) * 22);
      }
    }
  };

  return {
    root,
    groundAt,
    blocked,
    waterAt,
    surfaceAt,
    regionAt,
    regions,
    fires,
    lamps,
    glows,
    smoke,
    nodes,
    scatters,
    grass: [sedge],
    anchors,
    npcs: MIRE_NPCS,
    update,
    fog: { color: 0x26301f, density: 0.028 },
  };
}
