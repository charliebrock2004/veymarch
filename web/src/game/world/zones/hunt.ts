import * as THREE from "three";
import { Batch, ChunkBatch, Scatter, boxUV, bushGeo, fernGeo, grassGeo, logGeo, mushroomGeo, place, rockGeo, stumpGeo, tint, treeGeo, type Cullable } from "../../engine/kit";
import { fbm, lerp, rng, smoothPath, smoothstep } from "../../engine/noise";
import { buildFieldTerrain } from "../../engine/terrain";
import { bannerTex } from "../../engine/textures";
import { ZONES } from "../../data/zones.ts";
import { MOB_SPAWNS, NODE_DEFS } from "../../data/world.ts";
import { zoneNodes } from "../nodes";
import { Frame, barrel, crate, lamp, put, sack, woodpile, type Ctx, type Glow } from "../props";
import type { ZoneBuild, ZoneEnv } from "../zone";

/**
 * The King's Hunting Grounds: Blackwood. Dark pine and old oak over rolling ground, mist in the
 * hollows. The Kingsroad comes in from the south between two crowned gateposts; the hunters'
 * track winds north past the ruined royal lodge (shrine, firepit, cellar), through the wolf and
 * boar clearings, to the cave mouth under the cliff where the Royal Kennels begin.
 * Everything is built in world coordinates (x = ox + local x).
 */

const Z = ZONES.hunt;
const X = Z.ox;
const B = Z.bounds;

/** the hunters' track, south road to the kennel cave (local) */
const TRACK = smoothPath([
  [0, -156], [0, -130], [-3, -116], [-9, -102], [-13, -90], [-13, -76], [-9, -62], [-2, -48], [6, -34], [8, -20], [3, -6], [-6, 8],
  [-10, 22], [-8, 38], [-2, 52], [6, 64], [10, 76], [8, 88], [8, 100], [10, 112], [10, 126],
] as const);
/** fainter game trails off the track to the clearings */
const TRAILS = [
  smoothPath([[-6, 8], [-20, 4], [-34, -2]] as const),
  smoothPath([[-2, -48], [14, -56], [30, -62]] as const),
  smoothPath([[8, -20], [24, 4], [38, 26], [48, 40]] as const),
  smoothPath([[-8, 38], [-30, 46], [-52, 54], [-66, 58]] as const),
];
/** the ruined lodge: centre and half extents (local); its floor is flat at LH */
const LODGE = { x: -30, z: -79.5, hw: 10, hd: 8.5 };
const SHRINE = { x: -28, z: -74 };
const FIREPIT = { x: -22.6, z: -79.2 };
const CELLAR = { x: -32, z: -82 };
const CAVE = { x: 10, z: 128 };
const CAVE_ARRIVE = { x: 10, z: 123 };
const ARRIVE = { x: 0, z: -136 };
type Clearing = { x: number; z: number; r: number };
const CLEARINGS: Clearing[] = [
  { x: -41, z: -5, r: 13 }, // black wolves, west
  { x: 50, z: 45, r: 13 }, // black wolves, east
  { x: 35, z: -65, r: 12 }, // boar wallow, south
  { x: -70, z: 60, r: 11 }, // boar wallow, west
  { x: 6, z: 104, r: 19 }, // the hound yard before the cave
  { x: -80, z: -40, r: 8 }, // deer
  { x: 80, z: -20, r: 8 }, // deer
  { x: 0, z: -134, r: 10 }, // where the road comes in
  { x: 93, z: 65, r: 9 }, // the ore outcrop
];
const HIGH_SEATS: [number, number, number][] = [[-56, -16, 0.6], [22, -76, -0.5], [64, 30, 2.2]];

const C = {
  timber: 0x3a3028,
  bone: 0xb8ae98,
  iron: 0x45474b,
  stone: 0x8e887c,
  moss: 0x5e6b45,
};

const V3 = THREE.Vector3;
const UP = new V3(0, 1, 0);
const qTmp = new THREE.Quaternion();

/** A cylinder from a to b (local coords), tapering r0 → r1. */
function stick(a: [number, number, number], b: [number, number, number], r0: number, r1 = r0 * 0.7, seg = 5) {
  const A = new V3(...a);
  const Bv = new V3(...b);
  const len = Math.max(0.01, A.distanceTo(Bv));
  const g = new THREE.CylinderGeometry(r1, r0, len, seg);
  g.translate(0, len / 2, 0);
  g.applyQuaternion(qTmp.setFromUnitVectors(UP, Bv.clone().sub(A).normalize()));
  g.translate(A.x, A.y, A.z);
  return g;
}

/** A pair of stag antlers rising from (0,0,0), facing +z, s metres tall-ish. */
function antlerParts(s: number) {
  const out: THREE.BufferGeometry[] = [];
  for (const e of [-1, 1]) {
    const p0: [number, number, number] = [e * 0.05 * s, 0, 0];
    const p1: [number, number, number] = [e * 0.32 * s, 0.32 * s, -0.08 * s];
    const p2: [number, number, number] = [e * 0.48 * s, 0.72 * s, -0.06 * s];
    const p3: [number, number, number] = [e * 0.42 * s, 1.02 * s, 0.04 * s];
    const r = 0.035 * s;
    out.push(stick(p0, p1, r, r * 0.9), stick(p1, p2, r * 0.9, r * 0.75), stick(p2, p3, r * 0.75, r * 0.5));
    out.push(stick(p1, [e * 0.36 * s, 0.44 * s, 0.26 * s], r * 0.7, r * 0.25));
    out.push(stick([e * 0.4 * s, 0.52 * s, -0.07 * s], [e * 0.5 * s, 0.66 * s, 0.22 * s], r * 0.6, r * 0.2));
    out.push(stick(p2, [e * 0.66 * s, 0.94 * s, 0.1 * s], r * 0.6, r * 0.2));
    out.push(stick(p3, [e * 0.56 * s, 1.2 * s, -0.04 * s], r * 0.45, r * 0.15));
    out.push(stick(p3, [e * 0.36 * s, 1.18 * s, 0.12 * s], r * 0.45, r * 0.15));
  }
  return out;
}

/** Multiply a tree's baked vertex colours: Blackwood is darker than the Giant Forest. */
function darken(geo: THREE.BufferGeometry, r: number, g: number, b: number) {
  const out = geo.clone();
  const c = out.getAttribute("color");
  for (let i = 0; i < c.count; i++) c.setXYZ(i, c.getX(i) * r, c.getY(i) * g, c.getZ(i) * b);
  return out;
}

/**
 * Distance (local metres, capped) to a set of polylines, rasterised once onto a 1 m grid over the
 * zone so terrain, scatter and region lookups stay cheap.
 */
function distField(lines: readonly (readonly [number, number])[][], cap: number) {
  const x0 = B.minX - 2;
  const z0 = B.minZ - 2;
  const w = B.maxX - B.minX + 5;
  const d = B.maxZ - B.minZ + 5;
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

/** The weathered board over the kennel cave: a crown, the words, a hound's head. */
const kennelSignTex = () =>
  paintTex("hunt_kennel_sign", 256, 96, (g, w, h) => {
    const r = rng(19);
    g.fillStyle = "#5e4630";
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 22; i++) {
      g.strokeStyle = `rgba(30,20,12,${0.25 + r() * 0.3})`;
      g.lineWidth = 1 + r() * 2;
      g.beginPath();
      const y = r() * h;
      g.moveTo(0, y);
      g.lineTo(w, y + (r() - 0.5) * 8);
      g.stroke();
    }
    g.strokeStyle = "#2a1c10";
    g.lineWidth = 5;
    g.strokeRect(4, 4, w - 8, h - 8);
    g.fillStyle = "#c9a24a";
    // a little crown
    g.beginPath();
    g.moveTo(w / 2 - 16, 30);
    g.lineTo(w / 2 - 16, 16);
    g.lineTo(w / 2 - 8, 24);
    g.lineTo(w / 2, 12);
    g.lineTo(w / 2 + 8, 24);
    g.lineTo(w / 2 + 16, 16);
    g.lineTo(w / 2 + 16, 30);
    g.closePath();
    g.fill();
    g.fillStyle = "#e8dcc0";
    g.font = "bold 24px Georgia, 'Times New Roman', serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText("THE ROYAL KENNELS", w / 2, 58);
    g.font = "italic 13px Georgia, serif";
    g.fillStyle = "#cbb894";
    g.fillText("by the King's leave", w / 2, 80);
    // weathering
    for (let i = 0; i < 260; i++) {
      g.fillStyle = `rgba(40,28,18,${r() * 0.35})`;
      g.fillRect(r() * w, r() * h, 1 + r() * 4, 1 + r() * 2);
    }
  });

/** Soft round puff for ground mist. */
const mistTex = () =>
  paintTex("hunt_mist", 128, 128, (g, w, h) => {
    const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    gr.addColorStop(0, "rgba(255,255,255,0.9)");
    gr.addColorStop(0.45, "rgba(255,255,255,0.45)");
    gr.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
  });

export function buildHunt(env: ZoneEnv): ZoneBuild {
  const { M, col } = env;
  const root = new THREE.Group();
  root.name = "hunt";
  const r = rng(5151);

  // ------------------------------------------------------------ terrain
  const roll = (x: number, z: number) => (fbm(x * 0.012 + 31, z * 0.012 - 7, 4) - 0.5) * 14;
  const LH = roll(LODGE.x, LODGE.z) * 0.7 + 0.2;
  const YC = roll(CAVE_ARRIVE.x, CAVE_ARRIVE.z) * 0.6;
  const trackDist = distField([TRACK], 16);
  const trailDist = distField(TRAILS, 16);
  const lodgeDist = (x: number, z: number) => Math.hypot(Math.max(0, Math.abs(x - LODGE.x) - LODGE.hw - 0.8), Math.max(0, Math.abs(z - LODGE.z) - LODGE.hd - 0.8));
  /** where the cliff starts rising at this x (later at the cave notch) */
  const cliffZ = (x: number) => 131 + 4.5 * (1 - smoothstep(4, 9, Math.abs(x - CAVE.x)));

  const col_ = {
    litter: new THREE.Color(0x3a3524),
    moss: new THREE.Color(0x3c4a2a),
    dark: new THREE.Color(0x283020),
    needles: new THREE.Color(0x4a3a28),
    clear: new THREE.Color(0x56643a),
    dirt: new THREE.Color(0x5e4c36),
    mud: new THREE.Color(0x4a3c2c),
    rock: new THREE.Color(0x5c5850),
    lodge: new THREE.Color(0x5a5446),
  };
  const tmp = new THREE.Color();
  const tmp2 = new THREE.Color();
  const terrain = buildFieldTerrain({
    ox: X,
    bounds: B,
    step: 2.5,
    sample: (x, z) => {
      const ro = roll(x, z);
      let h = ro + (fbm(x * 0.06, z * 0.06, 2) - 0.5) * 1.6;
      const dp = trackDist(x, z);
      const dt = trailDist(x, z);
      const path = Math.max(1 - smoothstep(1.3, 3.1, dp), (1 - smoothstep(0.6, 1.8, dt)) * 0.55);
      const soft = 1 - smoothstep(1.5, 8, Math.min(dp, dt + 2));
      h = lerp(h, ro * 0.8, soft * 0.55) - path * 0.1;
      let clear = 0;
      for (const c of CLEARINGS) {
        const k = 1 - smoothstep(c.r * 0.6, c.r * 1.4, Math.hypot(x - c.x, z - c.z));
        clear = Math.max(clear, k);
        h = lerp(h, ro * 0.7, k * 0.6);
      }
      // the lodge stands on a levelled platform
      const lk = 1 - smoothstep(0, 7, lodgeDist(x, z));
      h = lerp(h, LH, lk);
      // the yard before the kennel cave
      const ck = 1 - smoothstep(7, 15, Math.hypot(x - CAVE_ARRIVE.x, z - CAVE_ARRIVE.z - 2));
      h = lerp(h, YC, ck);
      // the cliff the kennels are cut into
      const cz = cliffZ(x);
      const cliff = smoothstep(cz, cz + 8, z);
      h += cliff * (20 + fbm(x * 0.08, z * 0.05, 2) * 6);
      // rising ground along the bounds (except where the road leaves south)
      const ex = Math.min(x - B.minX, B.maxX - x);
      const es = (z - B.minZ) + (1 - smoothstep(6, 18, Math.abs(x))) * 60;
      h += (1 - smoothstep(0, 26, Math.min(ex, es))) * 13;

      const n1 = fbm(x * 0.035, z * 0.035, 3);
      const n2 = fbm(x * 0.13 + 40, z * 0.13, 2);
      const c = tmp.copy(col_.moss).lerp(col_.litter, smoothstep(0.35, 0.7, n1));
      c.lerp(col_.dark, smoothstep(0.55, 0.85, n2) * 0.6);
      c.lerp(col_.needles, smoothstep(0.5, 0.8, fbm(x * 0.05 - 9, z * 0.05 + 3, 2)) * 0.5);
      c.lerp(col_.clear, clear * 0.55);
      c.lerp(col_.mud, ck * 0.6 * smoothstep(0.4, 0.6, n2 + 0.2));
      c.lerp(col_.lodge, lk * 0.7);
      const rocky = smoothstep(cz + 0.5, cz + 3, z) * (1 - smoothstep(cz + 9, cz + 13, z) * 0.6);
      c.lerp(col_.rock, Math.min(1, rocky * 0.9 + (1 - smoothstep(4, 16, Math.min(ex, es))) * 0.35));
      c.lerp(tmp2.copy(col_.dirt).lerp(col_.mud, n1 * 0.5), Math.min(1, path * (0.8 + n2 * 0.3)));
      // buildFieldTerrain copies the colour straight away, so one scratch colour serves every sample
      return { h, color: c, path };
    },
  });
  root.add(terrain.mesh);
  const h = terrain.heightAt;
  const groundAt = terrain.heightAt;
  const H = (lx: number, lz: number) => h(X + lx, lz);

  const batch = new Batch();
  const glows: Glow[] = [];
  const fires: THREE.Vector3[] = [];
  const lamps: THREE.Vector3[] = [];
  const smoke: THREE.Vector3[] = [];
  const ctx: Ctx = { batch, M, col, h, glows, smoke, fires, lamps };
  // a few rocks, made once and reused (each one is a displaced icosphere: not free)
  const rockBare = [0, 1, 2, 3].map((i) => rockGeo(i + 61, false, 0x8a8478));
  const rockMoss = [0, 1, 2, 3].map((i) => rockGeo(i + 71, true, 0x8a8478));
  /** a pooled rock, its colour scaled by k (1 = the pale lodge stone) */
  const rockOf = (i: number, mossy: boolean, k: number) => darken((mossy ? rockMoss : rockBare)[Math.abs(Math.floor(i)) % 4], k, k, k * 0.98);
  /** a frame at local (x, z), rotated, standing on the ground (or at y) */
  const F = (x: number, z: number, rot = 0, y?: number) => new Frame(X + x, y ?? H(x, z), z, rot);
  const anchors: Record<string, THREE.Vector3> = {};

  // ------------------------------------------------------------ small kit
  const antler = (f: Frame, ox: number, oy: number, oz: number, s: number, yaw = 0, tilt = 0) => {
    for (const g of antlerParts(s)) {
      g.rotateX(tilt);
      g.rotateY(yaw);
      g.translate(ox, oy, oz);
      put(ctx, "flat", g, f, 0, 0, 0, 0, 0, 0, 0xcfc0a0, false);
    }
  };
  /** A stag skull, snout along local +z, with its antlers. */
  const stagSkull = (f: Frame, ox: number, oy: number, oz: number, s: number, tilt = 0) => {
    const g = new THREE.SphereGeometry(0.16 * s, 9, 7);
    g.scale(0.95, 0.8, 1.25);
    g.rotateX(tilt);
    g.translate(ox, oy, oz);
    put(ctx, "flat", g, f, 0, 0, 0, 0, 0, 0, 0xddd2b8, false);
    const sn = new THREE.CylinderGeometry(0.05 * s, 0.1 * s, 0.38 * s, 7);
    sn.rotateX(Math.PI / 2 + 0.25);
    sn.translate(0, -0.06 * s, 0.3 * s);
    sn.rotateX(tilt);
    sn.translate(ox, oy, oz);
    put(ctx, "flat", sn, f, 0, 0, 0, 0, 0, 0, 0xd2c6aa, false);
    for (const e of [-1, 1]) {
      const eye = new THREE.SphereGeometry(0.045 * s, 5, 4);
      eye.translate(e * 0.1 * s, 0.03 * s, 0.12 * s);
      eye.rotateX(tilt);
      eye.translate(ox, oy, oz);
      put(ctx, "flat", eye, f, 0, 0, 0, 0, 0, 0, 0x14100c, false);
    }
    antler(f, ox, oy + 0.1 * s, oz - 0.05 * s, 0.9 * s, 0, tilt - 0.15);
  };
  const bone = (x: number, z: number, ry: number, s = 1) => {
    const f = F(x, z, ry);
    put(ctx, "flat", new THREE.CylinderGeometry(0.035 * s, 0.03 * s, 0.42 * s, 5), f, 0, 0.05 * s, 0, 0, 0, Math.PI / 2, C.bone, false);
    for (const e of [-1, 1]) put(ctx, "flat", new THREE.SphereGeometry(0.06 * s, 6, 4), f, e * 0.21 * s, 0.05 * s, 0.02 * e, 0, 0, 0, 0xe0d6c0, false);
  };
  const torch = (x: number, z: number, y0?: number) => {
    const f = F(x, z, 0, y0);
    put(ctx, "flat", new THREE.CylinderGeometry(0.07, 0.09, 2.2, 6), f, 0, 1.1, 0, 0, 0, 0, C.timber);
    put(ctx, "metal", new THREE.CylinderGeometry(0.16, 0.09, 0.22, 6), f, 0, 2.25, 0, 0, 0, 0, 0x2e2e2e);
    put(ctx, "ember", new THREE.ConeGeometry(0.13, 0.36, 6), f, 0, 2.5, 0, 0, 0, 0, 0xffffff, false);
    const p = f.at(0, 2.6, 0);
    fires.push(p);
    glows.push({ x: p.x, y: p.y, z: p.z, size: 4.2, color: 0xff9a48 });
    col.circle(X + x, z, 0.2);
  };

  // ------------------------------------------------------------ the road in: crowned gateposts
  for (const s of [-1, 1]) {
    const gx = s * 7.2;
    const gz = -126;
    const f = F(gx, gz, 0, H(gx, gz) - 0.3);
    put(ctx, "stoneDark", boxUV(1.7, 0.8, 1.7, 2, 1), f, 0, 0.4, 0, 0, 0, 0, 0x7a7a68);
    put(ctx, "stoneGrey", boxUV(1.3, 4.2, 1.3, 2, 2), f, 0, 2.9, 0, 0, 0, 0, C.stone);
    put(ctx, "stoneGrey", boxUV(1.6, 0.35, 1.6, 2, 1), f, 0, 5.15, 0, 0, 0, 0, 0x9a9486);
    if (s < 0) {
      // the west crown still stands
      put(ctx, "stoneGrey", new THREE.CylinderGeometry(0.45, 0.5, 0.35, 8), f, 0, 5.5, 0, 0, 0, 0, 0xa09a8a);
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2;
        put(ctx, "stoneGrey", new THREE.ConeGeometry(0.11, 0.42, 4), f, Math.cos(a) * 0.38, 5.86, Math.sin(a) * 0.38, 0, 0, 0, 0xa09a8a);
      }
    } else {
      // the east one lies broken in the ferns
      const bf = F(gx + 2.6, gz + 1.2, 0.8);
      put(ctx, "stoneGrey", new THREE.CylinderGeometry(0.45, 0.5, 0.35, 8), bf, 0, 0.3, 0, 0.5, 0, 1.3, 0xa09a8a);
      put(ctx, "stoneGrey", boxUV(1.2, 0.8, 1.2, 2, 2), F(gx + 1.6, gz - 1.4, 0.3), 0, 0.3, 0, 0.2, 0, 0.1, C.stone);
    }
    // moss creeping up
    put(ctx, "flat", boxUV(1.34, 0.5, 1.34, 1, 1), f, 0, 1.03, 0, 0, 0, 0, 0x4a5236, false);
    col.box(X + gx, gz, 1.8, 1.8, 0);
  }
  // a torn royal banner on the west post
  {
    const bg = new THREE.PlaneGeometry(1.1, 2.4, 1, 6);
    const p = bg.getAttribute("position");
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i);
      p.setZ(i, Math.sin(y * 2.2) * 0.08);
      if (y < -0.9 && p.getX(i) > 0) p.setY(i, y + 0.5);
    }
    bg.computeVertexNormals();
    bg.translate(0, -1.2, 0);
    place(bg, X - 7.2, H(-7.2, -126) + 4.4, -126 - 0.68, 0.04, Math.PI, 0);
    const m = new THREE.Mesh(bg, new THREE.MeshLambertMaterial({ map: bannerTex(), side: THREE.DoubleSide, color: 0x9a948c }));
    m.castShadow = true;
    root.add(m);
  }
  // crowned milestones along the track
  {
    const marks = [-112, -60, -8, 44, 86];
    for (const mz of marks) {
      let best = { x: 0, z: mz, d: Infinity };
      for (const [tx, tz] of TRACK) if (Math.abs(tz - mz) < best.d) best = { x: tx, z: tz, d: Math.abs(tz - mz) };
      const mx = best.x + 3.4;
      const f = F(mx, best.z, 0.2 + r() * 0.3);
      put(ctx, "stoneGrey", boxUV(0.5, 1.1, 0.35, 1, 1), f, 0, 0.45, 0, 0.05, 0, 0.06, 0x8a8478);
      put(ctx, "stoneGrey", new THREE.CylinderGeometry(0.25, 0.25, 0.35, 8, 1, false, 0, Math.PI), f, 0, 1.0, 0, Math.PI / 2, Math.PI / 2, 0, 0x8a8478);
      put(ctx, "flat", boxUV(0.52, 0.4, 0.37, 1, 1), f, 0, 0.12, 0, 0, 0, 0, C.moss, false);
      col.circle(X + mx, best.z, 0.4);
    }
  }

  // ------------------------------------------------------------ the royal hunting lodge
  const LX = LODGE.x;
  const LZ = LODGE.z;
  /** lodge frame: local lodge coords, floor at LH */
  const LF = (x: number, z: number, rot = 0, y = 0) => new Frame(X + LX + x, LH + y, LZ + z, rot);
  {
    // flagstone floor and a low stone plinth
    put(ctx, "flagstone", boxUV(LODGE.hw * 2 + 0.6, 0.5, LODGE.hd * 2 + 0.6, 3, 3), LF(0, 0), 0, -0.23, 0, 0, 0, 0, 0x9a9282, false);
    // walls: [x0, z0, x1, z1, height]; gaps are the breaches and the doors
    const walls: [number, number, number, number, number][] = [
      [-7, -8.5, -1, -8.5, 2.2], [2.6, -8.5, 10, -8.5, 3.0],
      [10, -8.5, 10, -4.2, 3.3], [10, 5.6, 10, 8.5, 2.0],
      [-10, 8.5, -3, 8.5, 3.8], [-3, 8.5, 4, 8.5, 1.3], [4, 8.5, 10, 8.5, 2.7],
      [-10, -6, -10, 8.5, 4.2],
    ];
    for (const [x0, z0, x1, z1, wh] of walls) {
      const len = Math.hypot(x1 - x0, z1 - z0);
      const rot = Math.atan2(x1 - x0, z1 - z0) - Math.PI / 2;
      const cx = (x0 + x1) / 2;
      const cz = (z0 + z1) / 2;
      const f = LF(cx, cz, rot);
      put(ctx, "stoneDark", boxUV(len + 0.3, 0.9, 1.0, 2, 1), f, 0, 0.45, 0, 0, 0, 0, 0x7a7866);
      put(ctx, "stoneGrey", boxUV(len, wh - 0.9, 0.8, 2.4, 2.4), f, 0, 0.9 + (wh - 0.9) / 2, 0, 0, 0, 0, 0x948c7e);
      // a ragged top: loose blocks and gaps
      const n = Math.max(2, Math.round(len / 1.1));
      for (let k = 0; k < n; k++) {
        if (r() < 0.35) continue;
        const bx = -len / 2 + ((k + 0.5) * len) / n;
        const bh = 0.25 + r() * 0.55;
        put(ctx, "stoneGrey", boxUV(len / n - 0.08, bh, 0.78, 1.2, 1.2), f, bx, wh + bh / 2, (r() - 0.5) * 0.06, 0, r() * 0.1, 0, 0x8c8476);
      }
      // moss along the footing
      put(ctx, "flat", boxUV(len + 0.34, 0.25, 1.04, 1, 1), f, 0, 0.12, 0, 0, 0, 0, C.moss, false);
      // timber string course on the taller walls
      if (wh > 2.6) put(ctx, "planksDark", boxUV(len, 0.22, 0.86, 2, 1), f, 0, 2.4, 0, 0, 0, 0, 0x8a7a68);
      col.box(X + LX + cx, LZ + cz, len + 0.2, 1.0, rot);
    }
    // rubble where the walls came down
    const rubble = (x: number, z: number, n: number, spread: number) => {
      for (let i = 0; i < n; i++) {
        const g = rockOf(i + x * 3, false, 0.72);
        const sc = 0.25 + r() * 0.4;
        place(g, X + LX + x + (r() - 0.5) * spread, LH + 0.05, LZ + z + (r() - 0.5) * spread, 0, r() * 6, 0, sc, sc * 0.8, sc);
        batch.add("clutter", M.clutter, g);
      }
    };
    rubble(-8.5, -9.6, 7, 2.6);
    rubble(11.2, -3.2, 6, 1.6);
    rubble(11.0, 4.8, 5, 1.6);
    rubble(0.5, 9.6, 6, 3.0);
    col.circle(X + LX - 8.5, LZ - 9.8, 1.2);

    // the hearth and chimney on the west wall (broken off above the roofline)
    {
      const f = LF(-10.1, 1.5);
      put(ctx, "stoneGrey", boxUV(1.8, 6.2, 3.2, 2, 2), f, -0.6, 3.1, 0, 0, 0, 0, 0x8c8476);
      put(ctx, "stoneGrey", boxUV(1.2, 1.3, 1.1, 1, 1), f, -0.6, 6.85, -0.6, 0, 0.3, 0.1, 0x8c8476);
      put(ctx, "stoneDark", boxUV(1.2, 1.6, 3.0, 2, 1), f, 0.9, 0.8, 0, 0, 0, 0, 0x6a665a);
      put(ctx, "flat", boxUV(0.1, 1.1, 1.6, 1, 1), f, 1.52, 0.65, 0, 0, 0, 0, 0x14100c, false);
      put(ctx, "planksDark", boxUV(0.4, 0.24, 3.4, 2, 1), f, 1.1, 1.7, 0, 0, 0, 0, 0x7a6a58);
      col.box(X + LX - 9.2, LZ + 1.5, 1.4, 3.2, 0);
    }

    // the roof timbers: trusses over the west half still stand, the east half is ribs and air
    for (const tz of [-6.2, -2.1, 2.1, 6.2]) {
      const intact = tz === -6.2 || tz === 2.1;
      const g1 = stick([-10, 4.0, tz], [0, 6.6, tz], 0.16, 0.13, 6);
      put(ctx, "planksDark", g1, LF(0, 0), 0, 0, 0, 0, 0, 0, 0x6a5a48);
      if (intact) put(ctx, "planksDark", stick([0, 6.6, tz], [10, 3.2, tz], 0.13, 0.15, 6), LF(0, 0), 0, 0, 0, 0, 0, 0, 0x6a5a48);
      else put(ctx, "planksDark", stick([0, 6.6, tz], [3.6 + r() * 1.2, 5.3, tz + 0.2], 0.13, 0.06, 6), LF(0, 0), 0, 0, 0, 0, 0, 0, 0x5a4a3a);
      if (tz === -6.2) put(ctx, "planksDark", stick([-10, 3.7, tz], [10, 3.3, tz], 0.13, 0.13, 6), LF(0, 0), 0, 0, 0, 0, 0, 0, 0x5a4a3a);
    }
    put(ctx, "planksDark", stick([0, 6.75, -7.4], [0, 6.75, 3.4], 0.15, 0.15, 6), LF(0, 0), 0, 0, 0, 0, 0, 0, 0x5a4a3a);
    put(ctx, "planksDark", stick([-5, 5.4, -7.4], [-5, 5.4, 7.2], 0.11, 0.11, 6), LF(0, 0), 0, 0, 0, 0, 0, 0, 0x5a4a3a);
    // what is left of the shingles: two sagging patches on the west slope, one on the east
    const slope = Math.atan2(2.6, 10);
    for (const [zc, len] of [[-4.6, 5.0], [1.6, 3.4]] as const) {
      put(ctx, "shingle", boxUV(7.2, 0.14, len, 2, 2), LF(-6.2, zc), 0, 4.95 + 0.15, 0, 0, 0, slope, 0x6a6258);
    }
    put(ctx, "shingle", boxUV(5.4, 0.14, 3.2, 2, 2), LF(2.8, -5.9), 0, 5.8, 0, 0, 0, -Math.atan2(3.4, 10) - 0.06, 0x5e584e);
    // fallen timbers inside (low enough to step around, solid)
    {
      const g = stick([-9.4, 0.2, -7.3], [-4.6, 1.1, -6.6], 0.16, 0.15, 6);
      put(ctx, "planksDark", g, LF(0, 0), 0, 0, 0, 0, 0, 0, 0x5a4a3a);
      col.box(X + LX - 7, LZ - 7, 4.9, 0.5, -0.14);
      const g2 = stick([7.2, 0.15, -6.8], [9.6, 2.4, -7.6], 0.14, 0.12, 6);
      put(ctx, "planksDark", g2, LF(0, 0), 0, 0, 0, 0, 0, 0, 0x5a4a3a);
      put(ctx, "planksDark", stick([6.8, 0.12, 6.4], [3.2, 0.3, 7.6], 0.13, 0.12, 6), LF(0, 0), 0, 0, 0, 0, 0, 0, 0x5a4a3a);
      col.box(X + LX + 5, LZ + 7, 3.9, 0.4, -0.32);
      // shingles on the floor
      for (let i = 0; i < 14; i++) {
        const sx = -8 + r() * 6;
        const sz = -7 + r() * 5;
        if (Math.hypot(sx - (CELLAR.x - LX), sz - (CELLAR.z - LZ)) < 1.6) continue;
        put(ctx, "shingle", boxUV(0.5, 0.04, 0.3, 1, 1), LF(sx, sz, r() * 6), 0, 0.03, 0, (r() - 0.5) * 0.3, 0, (r() - 0.5) * 0.3, 0x5e584e, false);
      }
    }
    // the long table, cracked, and a bench thrown over
    {
      const f = LF(-5.4, 4.6, 0.05);
      put(ctx, "planks", boxUV(3.6, 0.12, 1.0, 1, 1), f, 0, 0.82, 0, 0, 0, 0.04, 0x8a7458);
      for (const s of [-1, 1]) {
        put(ctx, "flat", new THREE.BoxGeometry(0.12, 0.8, 0.8), f, s * 1.4, 0.4, 0, 0, 0, 0, C.timber);
        put(ctx, "flat", new THREE.BoxGeometry(0.1, 0.1, 0.9), f, s * 1.4, 0.15, 0, 0, 0, 0, C.timber);
      }
      put(ctx, "planks", boxUV(2.6, 0.08, 0.35, 1, 1), f, 0.2, 0.45, -1.1, 0, 0, 0, 0x7a6448);
      for (const s of [-1, 1]) put(ctx, "flat", new THREE.BoxGeometry(0.08, 0.45, 0.3), f, 0.2 + s * 1.0, 0.22, -1.1, 0, 0, 0, C.timber);
      // the bench on its side
      put(ctx, "planks", boxUV(2.4, 0.35, 0.08, 1, 1), f, -0.2, 0.18, 1.5, 0, 0.1, 0, 0x7a6448);
      // a pewter jug and two cups
      put(ctx, "metal", new THREE.CylinderGeometry(0.1, 0.13, 0.3, 8), f, 0.8, 1.03, 0.1, 0, 0, 0, 0x8a8a84);
      put(ctx, "metal", new THREE.CylinderGeometry(0.05, 0.045, 0.1, 6), f, -0.6, 0.93, -0.2, 0, 0, 0, 0x8a8a84);
      put(ctx, "metal", new THREE.CylinderGeometry(0.05, 0.045, 0.1, 6), f, 0.6, 0.9, 0.3, Math.PI / 2, 0, 0, 0x8a8a84);
      col.box(X + LX - 5.4, LZ + 4.6, 3.8, 1.2, 0.05);
    }
    // the antler chandelier, fallen and splayed
    {
      const f = LF(-6, -3.4, 0.4);
      put(ctx, "metal", new THREE.TorusGeometry(1.0, 0.06, 5, 18), f, 0, 0.12, 0, Math.PI / 2 - 0.12, 0, 0, 0x3a3836);
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2;
        antler(f, Math.cos(a) * 1.0, 0.15, Math.sin(a) * 1.0, 0.55, -a + Math.PI / 2, -0.9);
        put(ctx, "flat", new THREE.CylinderGeometry(0.04, 0.04, 0.16, 5), f, Math.cos(a) * 1.0, 0.24, Math.sin(a) * 1.0, 0, 0, 0, 0xd8d0b8, false);
      }
      for (let k = 0; k < 3; k++) put(ctx, "metal", stick([0, 0.1, 0], [Math.cos(k * 2.1) * 1.0, 0.1, Math.sin(k * 2.1) * 1.0], 0.025, 0.025, 4), f, 0, 0, 0, 0, 0, 0, 0x2e2e2e, false);
      col.circle(X + LX - 6, LZ - 3.4, 1.15);
    }
    // antlers mounted on the walls: the King's tally
    const wallMounts: [number, number, number, number][] = [
      [-8, 8.0, 2.9, Math.PI], [-5.4, 8.0, 3.1, Math.PI], [7.2, 8.0, 2.1, Math.PI],
      [-9.5, 5.4, 3.1, Math.PI / 2], [-9.5, -3.6, 3.0, Math.PI / 2],
      [5.6, -8.0, 2.4, 0], [-4.4, -8.0, 1.8, 0],
    ];
    for (const [ax, az, ay, face] of wallMounts) {
      const f = LF(ax, az, face);
      put(ctx, "planksDark", new THREE.CylinderGeometry(0.28, 0.28, 0.08, 10), f, 0, ay, 0.02, Math.PI / 2, 0, 0, 0x6a5440);
      stagSkull(f, 0, ay + 0.05, 0.18, 1.0 + r() * 0.3, -0.5);
    }
    // outside: antlers nailed over the east breach and the south door
    stagSkull(LF(10.5, 6.6, Math.PI / 2), 0, 1.7, 0, 1.2, -0.4);
    stagSkull(LF(3.3, -9.0, Math.PI), 0, 2.0, 0, 0.9, -0.3);
    // stores by the walls
    barrel(ctx, X + LX + 8.6, LZ - 6.9);
    barrel(ctx, X + LX + 7.8, LZ - 7.3, 0.85);
    crate(ctx, X + LX + 8.7, LZ + 7.2, 0.7, 0.3);
    crate(ctx, X + LX - 8.9, LZ - 4.6, 0.6, 1.1);
    sack(ctx, X + LX + 8.9, LZ + 6.3);
    woodpile(ctx, X + LX + 11.6, LZ - 6.6, Math.PI / 2);
    // a skinning rack outside by the track: two posts and a crossbar, a hide stretched on it
    {
      const f = F(LX + 13.4, LZ - 12, 0.5);
      for (const s of [-1, 1]) put(ctx, "flat", new THREE.CylinderGeometry(0.08, 0.1, 2.4, 6), f, s * 0.9, 1.2, 0, 0, 0, s * 0.06, C.timber);
      put(ctx, "flat", new THREE.CylinderGeometry(0.06, 0.06, 2.1, 6), f, 0, 2.2, 0, 0, 0, Math.PI / 2, C.timber);
      const hide = new THREE.PlaneGeometry(1.4, 1.6, 2, 2);
      put(ctx, "flat", hide, f, 0, 1.35, 0.03, 0, 0, 0, 0x6a4a30, false);
      col.circle(X + LX + 13.4 - 0.8, LZ - 12 + 0.45, 0.15);
      col.circle(X + LX + 13.4 + 0.8, LZ - 12 - 0.45, 0.15);
    }
    // a lantern on a post where the lodge path meets the track
    lamp(ctx, X - 16.2, -87.5, Math.PI / 2);
  }

  // the shrine: a stag skull on a post, candles at its foot
  {
    const px = SHRINE.x;
    const pz = SHRINE.z + 1.7;
    const f = new Frame(X + px, LH, pz, Math.PI);
    put(ctx, "planksDark", boxUV(0.26, 2.7, 0.26, 1, 2), f, 0, 1.35, 0, 0, 0, 0, 0x7a6a58);
    put(ctx, "planksDark", boxUV(1.1, 0.16, 0.18, 1, 1), f, 0, 2.1, 0.05, 0, 0, 0, 0x6a5a48);
    stagSkull(f, 0, 2.62, 0.16, 1.5, -0.2);
    // charms: little bones and a rag of royal blue
    for (const e of [-1, 1]) {
      put(ctx, "flat", new THREE.CylinderGeometry(0.008, 0.008, 0.5, 3), f, e * 0.45, 1.8, 0.12, 0, 0, 0, 0x2a2420, false);
      put(ctx, "flat", new THREE.CylinderGeometry(0.025, 0.02, 0.16, 5), f, e * 0.45, 1.5, 0.12, 0, 0, 0.4, C.bone, false);
    }
    put(ctx, "flat", new THREE.PlaneGeometry(0.22, 0.7), f, 0.15, 1.65, 0.15, 0, 0, 0.06, 0x2f3a4a, false);
    // a ring of stones, offerings and candles
    for (let k = 0; k < 9; k++) {
      const a = (k / 9) * Math.PI * 2;
      const g = rockOf(k, true, 0.8);
      place(g, X + px + Math.cos(a) * 0.75, LH + 0.05, pz + Math.sin(a) * 0.6, 0, a, 0, 0.18, 0.14, 0.18);
      batch.add("clutter", M.clutter, g);
    }
    for (const [cx, cz, ch] of [[-0.35, 0.45, 0.22], [0.3, 0.5, 0.16], [0.5, 0.25, 0.26], [-0.55, 0.15, 0.14]]) {
      put(ctx, "flat", new THREE.CylinderGeometry(0.04, 0.045, ch, 6), f, cx, ch / 2, cz, 0, 0, 0, 0xe8e0c8, false);
      put(ctx, "ember", new THREE.ConeGeometry(0.02, 0.06, 4), f, cx, ch + 0.04, cz, 0, 0, 0, 0xffffff, false);
    }
    const sp = f.at(0, 2.7, 0.3);
    glows.push({ x: sp.x, y: sp.y, z: sp.z, size: 3.4, color: 0xffe2b0 });
    const cp = f.at(0, 0.3, 0.4);
    glows.push({ x: cp.x, y: cp.y, z: cp.z, size: 2.2, color: 0xffb060 });
    col.circle(X + px, pz, 0.3);
    anchors.shrine = new V3(X + SHRINE.x, LH, SHRINE.z);
  }

  // the cook firepit: a ring of blackened stones, logs, a spit and a pot
  {
    const fx = FIREPIT.x;
    const fz = FIREPIT.z;
    const f = new Frame(X + fx, LH, fz, 0.3);
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * Math.PI * 2;
      const g = rockOf(k, false, 0.55);
      place(g, X + fx + Math.cos(a) * 0.85, LH + 0.08, fz + Math.sin(a) * 0.85, 0, a, 0, 0.26, 0.22, 0.22);
      batch.add("clutter", M.clutter, g);
    }
    put(ctx, "flat", new THREE.CircleGeometry(0.75, 12), f, 0, 0.03, 0, -Math.PI / 2, 0, 0, 0x1a1410, false);
    for (let k = 0; k < 4; k++) put(ctx, "bark", new THREE.CylinderGeometry(0.08, 0.09, 1.0, 6), f, 0, 0.2, 0, 1.25, (k / 4) * Math.PI * 2, 0, 0x6a5a48);
    put(ctx, "ember", new THREE.ConeGeometry(0.4, 0.6, 7), f, 0, 0.35, 0, 0, 0, 0, 0xffffff, false);
    for (const s of [-1, 1]) {
      put(ctx, "flat", new THREE.CylinderGeometry(0.05, 0.06, 1.5, 5), f, s * 1.1, 0.75, 0, 0, 0, s * 0.05, C.timber);
      put(ctx, "flat", new THREE.CylinderGeometry(0.04, 0.04, 0.4, 5), f, s * 1.1 - s * 0.12, 1.45, 0, 0, 0, s * 0.5, C.timber);
    }
    put(ctx, "metal", new THREE.CylinderGeometry(0.03, 0.03, 2.5, 5), f, 0, 1.42, 0, 0, 0, Math.PI / 2, 0x3a3a3a);
    put(ctx, "metal", new THREE.CylinderGeometry(0.008, 0.008, 0.45, 3), f, 0, 1.2, 0, 0, 0, 0, 0x2a2a2a, false);
    put(ctx, "metal", new THREE.SphereGeometry(0.24, 9, 6, 0, Math.PI * 2, Math.PI / 2.6, Math.PI / 1.7), f, 0, 1.15, 0, 0, 0, 0, 0x2e2c2a);
    // a log to sit on
    const lg = logGeo(1.8, 0.2);
    place(lg, X + fx - 0.2, LH + 0.2, fz + 1.9, 0, 0.2, 0);
    batch.add("clutter", M.clutter, lg);
    const p = f.at(0, 0.55, 0);
    fires.push(p);
    glows.push({ x: p.x, y: p.y + 0.2, z: p.z, size: 5.2, color: 0xff8a3a });
    smoke.push(f.at(0, 1.3, 0));
    col.circle(X + fx, fz, 0.95);
    anchors.firepit = new V3(X - 24, LH, -78);
  }

  // the cellar hatch (the cache itself; the game adds the Search prompt)
  {
    const f = new Frame(X + CELLAR.x, LH, CELLAR.z, 0.08);
    put(ctx, "stoneDark", boxUV(2.0, 0.14, 0.3, 1, 1), f, 0, 0.05, -0.85, 0, 0, 0, 0x6a665a, false);
    put(ctx, "stoneDark", boxUV(2.0, 0.14, 0.3, 1, 1), f, 0, 0.05, 0.85, 0, 0, 0, 0x6a665a, false);
    put(ctx, "stoneDark", boxUV(0.3, 0.14, 1.4, 1, 1), f, -0.85, 0.05, 0, 0, 0, 0, 0x6a665a, false);
    put(ctx, "stoneDark", boxUV(0.3, 0.14, 1.4, 1, 1), f, 0.85, 0.05, 0, 0, 0, 0, 0x6a665a, false);
    for (const s of [-1, 1]) {
      put(ctx, "planksDark", boxUV(0.68, 0.08, 1.38, 1, 1), f, s * 0.36, 0.08, 0, 0, 0, s * 0.02, 0x8a7458, false);
      for (const bz of [-0.45, 0.45]) put(ctx, "metal", new THREE.BoxGeometry(0.6, 0.03, 0.08), f, s * 0.36, 0.13, bz, 0, 0, 0, 0x3a3a3a, false);
      put(ctx, "metal", new THREE.TorusGeometry(0.09, 0.02, 4, 10), f, s * 0.12, 0.13, 0, Math.PI / 2, 0, 0, 0x4a4a4a, false);
    }
    anchors.cellar = new V3(X + CELLAR.x, LH, CELLAR.z);
  }
  anchors.lodge = new V3(X + LODGE.x, LH, LODGE.z);

  // ------------------------------------------------------------ hunting high seats at clearing edges
  for (const [sx, sz, rot] of HIGH_SEATS) {
    const y0 = H(sx, sz);
    const f = new Frame(X + sx, y0, sz, rot);
    for (const [a, b] of [[-0.9, -0.9], [0.9, -0.9], [-0.9, 0.9], [0.9, 0.9]]) {
      put(ctx, "flat", new THREE.CylinderGeometry(0.1, 0.13, 4.4, 6), f, a, 2.2, b, b * 0.03, 0, -a * 0.03, C.timber);
      const p = f.at(a, 0, b);
      col.circle(p.x, p.z, 0.18);
    }
    put(ctx, "planks", boxUV(2.2, 0.1, 2.2, 1, 1), f, 0, 3.6, 0, 0, 0, 0, 0x8a7458);
    for (const s of [-1, 1]) {
      put(ctx, "flat", new THREE.BoxGeometry(2.2, 0.08, 0.08), f, 0, 4.4, s * 1.0, 0, 0, 0, C.timber);
      put(ctx, "flat", new THREE.BoxGeometry(0.08, 0.08, 2.2), f, s * 1.0, 4.4, 0, 0, 0, 0, C.timber);
      put(ctx, "flat", stick([s * 0.9, 0.3, -0.9], [-s * 0.9, 3.3, -0.9], 0.05, 0.05, 4), f, 0, 0, 0, 0, 0, 0, C.timber);
    }
    put(ctx, "planksDark", boxUV(2.5, 0.1, 2.5, 1, 1), f, 0, 5.4, 0, 0.12, 0, 0.05, 0x6a5a48);
    // ladder
    for (const s of [-1, 1]) put(ctx, "flat", stick([s * 0.28, 0, 2.1], [s * 0.28, 3.6, 1.0], 0.04, 0.04, 4), f, 0, 0, 0, 0, 0, 0, C.timber);
    for (let k = 1; k < 9; k++) {
      const t = k / 9;
      put(ctx, "flat", new THREE.BoxGeometry(0.56, 0.04, 0.05), f, 0, t * 3.6, 2.1 - t * 1.1, 0, 0, 0, C.timber);
    }
  }

  // ------------------------------------------------------------ the kennel cave under the cliff
  const YCm = H(CAVE.x, CAVE.z);
  {
    // the cave mouth: a dark recess, a timber frame, a board with the King's word on it
    const mf = new Frame(X + CAVE.x, YCm, 0, 0);
    // the mouth itself: two arched shapes, black inside a sooty ring, so the eye reads depth
    const arch = (hw: number, sh: number, top: number) => {
      const sp = new THREE.Shape();
      sp.moveTo(-hw, -0.4);
      sp.lineTo(-hw, sh);
      sp.quadraticCurveTo(-hw * 0.9, top, 0, top);
      sp.quadraticCurveTo(hw * 0.9, top, hw, sh);
      sp.lineTo(hw, -0.4);
      sp.closePath();
      return new THREE.ShapeGeometry(sp, 8);
    };
    const ring = new THREE.Mesh(arch(4.4, 3.4, 6.6), new THREE.MeshBasicMaterial({ color: 0x17130f, side: THREE.DoubleSide }));
    ring.position.set(X + CAVE.x, YCm, 133.1);
    const hole = new THREE.Mesh(arch(3.4, 3.0, 5.6), new THREE.MeshBasicMaterial({ color: 0x040302, side: THREE.DoubleSide }));
    hole.position.set(X + CAVE.x, YCm, 132.9);
    root.add(ring, hole);
    for (const s of [-1, 1]) {
      const px = CAVE.x + s * 3.5;
      put(ctx, "planksDark", boxUV(0.5, 5.2, 0.5, 1, 2), mf, s * 3.5, 2.5, 131.4, 0, 0, s * 0.02, 0x7a6a58);
      put(ctx, "planksDark", stick([s * 3.5, 3.6, 131.4], [s * 2.6, 4.6, 131.4], 0.12, 0.12, 5), mf, 0, 0, 0, 0, 0, 0, 0x6a5a48);
      col.circle(X + px, 131.4, 0.35);
      // iron hooks with old collars on the posts
      for (let k = 0; k < 3; k++) {
        put(ctx, "metal", new THREE.TorusGeometry(0.14, 0.03, 4, 10), mf, s * 3.5 - s * 0.32, 1.6 + k * 0.5, 131.0, 0.2, Math.PI / 2, 0, k === 1 ? 0x8e2f2f : 0x5a3a26, false);
      }
    }
    put(ctx, "planksDark", boxUV(8.4, 0.55, 0.6, 2, 1), mf, 0, 5.05, 131.4, 0, 0, 0.01, 0x6a5a48);
    // the sign board on the lintel
    const signMat = new THREE.MeshLambertMaterial({ map: kennelSignTex() });
    const board = new THREE.Mesh(tint(new THREE.BoxGeometry(3.6, 1.35, 0.08), 0x8a7458), [M.planksDark, M.planksDark, M.planksDark, M.planksDark, M.planksDark, signMat]);
    board.position.set(X + CAVE.x, YCm + 5.95, 131.0);
    board.rotation.z = 0.03;
    board.castShadow = true;
    root.add(board);
    // the kennel sign by the track as well (it faces whoever walks up)
    {
      const sx = CAVE.x + 5.6;
      const sz = 121.6;
      const sf = F(sx, sz, Math.PI + 0.35);
      put(ctx, "flat", new THREE.BoxGeometry(0.16, 2.1, 0.16), sf, 0, 1.05, 0, 0, 0, 0, C.timber);
      const small = new THREE.Mesh(tint(new THREE.BoxGeometry(1.5, 0.6, 0.06), 0x9a8468), [M.planks, M.planks, M.planks, M.planks, signMat, M.planks]);
      small.position.copy(sf.at(0, 1.75, 0.09));
      small.rotation.y = Math.PI + 0.35;
      small.castShadow = true;
      root.add(small);
      col.circle(X + sx, sz, 0.18);
    }
    // torches either side of the mouth
    torch(CAVE.x - 4.6, 130.2);
    torch(CAVE.x + 4.6, 130.2);
    // chains and a ring bolted into the rock
    put(ctx, "metal", new THREE.TorusGeometry(0.22, 0.05, 5, 12), mf, -5.4, 1.4, 131.9, 0, 0, 0, 0x3a3a3a, false);
    for (let k = 0; k < 10; k++) put(ctx, "metal", new THREE.TorusGeometry(0.08, 0.022, 4, 8), mf, -5.4 + k * 0.17, 1.2 - Math.sin((k / 9) * Math.PI) * 0.4 - k * 0.12, 131.7, 0, k % 2 ? Math.PI / 2 : 0, 0, 0x3a3a3a, false);
    // the rock face: big boulders along the foot of the cliff, a heavier brow over the mouth
    const faceRock = (lx: number, lz: number, sc: number, sy: number, seed: number, solid: boolean) => {
      const g = rockOf(seed, true, 0.6);
      // sit on the lower, front ground so nothing hangs off the slope
      const y = Math.min(H(lx, lz), H(lx, lz - sc * 0.9));
      place(g, X + lx, y - sc * 0.3, lz, 0, r() * 6, 0, sc, sc * sy, sc);
      batch.add("clutter", M.clutter, g);
      if (solid && lz - sc * 0.8 < 132.5) col.circle(X + lx, lz, sc * 0.75);
    };
    for (let x = B.minX + 2; x <= B.maxX - 2; x += 5 + r() * 3) {
      if (Math.abs(x - CAVE.x) < 7.5) continue;
      const cz = cliffZ(x);
      faceRock(x, cz + 3.5 + r() * 2, 3.2 + r() * 2.6, 1.4 + r() * 0.8, 200 + Math.floor(x), true);
      if (r() < 0.6) faceRock(x + 2, cz + 9 + r() * 3, 4 + r() * 3, 1.2 + r() * 0.6, 300 + Math.floor(x), false);
    }
    // the cheeks and brow of the mouth
    faceRock(CAVE.x - 6.6, 134.2, 3.4, 2.0, 401, false);
    faceRock(CAVE.x + 6.8, 134.4, 3.6, 2.0, 402, false);
    {
      const g = rockOf(1, true, 0.55);
      place(g, X + CAVE.x, YCm + 6.9, 135.8, 0.2, 0.4, 0, 5.6, 2.0, 3.2);
      batch.add("clutter", M.clutter, g);
    }
    // the cliff stops everyone except at the mouth
    const cl = CAVE.x - 4.1;
    const cr = CAVE.x + 4.1;
    col.box((X + B.minX - 4 + X + cl) / 2, 133.4, cl - (B.minX - 4), 2.6, 0);
    col.box((X + cr + X + B.maxX + 4) / 2, 133.4, B.maxX + 4 - cr, 2.6, 0);
    col.box(X + CAVE.x, 133.8, 8.4, 1.4, 0);
    anchors.caveMouth = new V3(X + CAVE.x, YCm, CAVE.z);
    anchors.kennelArrive = new V3(X + CAVE_ARRIVE.x, H(CAVE_ARRIVE.x, CAVE_ARRIVE.z), CAVE_ARRIVE.z);

    // the hound yard: stakes with chains, bones, a broken cage wagon, a keeper's lean-to
    for (const [sx, sz] of [[-4, 99], [17, 104], [-14, 113], [22, 88]]) {
      const f = F(sx, sz, r() * 6);
      put(ctx, "flat", new THREE.CylinderGeometry(0.08, 0.1, 1.2, 6), f, 0, 0.5, 0, 0.1, 0, 0.05, C.timber);
      put(ctx, "metal", new THREE.TorusGeometry(0.1, 0.025, 4, 8), f, 0, 0.9, 0.1, 0, 0, 0, 0x3a3a3a, false);
      for (let k = 0; k < 8; k++) put(ctx, "metal", new THREE.TorusGeometry(0.07, 0.02, 4, 8), f, 0, 0.04, 0.2 + k * 0.13, Math.PI / 2, k % 2 ? Math.PI / 2 : 0, 0, 0x3a3a3a, false);
      put(ctx, "flat", new THREE.TorusGeometry(0.15, 0.035, 5, 10), f, 0, 0.04, 1.3, Math.PI / 2, 0, 0, 0x5a3a26, false);
      col.circle(X + sx, sz, 0.15);
    }
    for (let i = 0; i < 26; i++) {
      const a = r() * Math.PI * 2;
      const d = 3 + r() * 15;
      const bx = 6 + Math.cos(a) * d;
      const bz = 104 + Math.sin(a) * d * 0.8;
      if (bz > 127) continue;
      bone(bx, bz, r() * 6, 1.2 + r() * 0.8);
    }
    {
      // a cage wagon with a wheel off, bars bent
      const wx = 28;
      const wz = 114;
      const f = F(wx, wz, -0.6);
      put(ctx, "planksDark", boxUV(2.0, 0.18, 3.2, 1, 1), f, 0, 0.75, 0, 0, 0, -0.12, 0x7a6a58);
      put(ctx, "planksDark", new THREE.CylinderGeometry(0.6, 0.6, 0.12, 12), f, 1.08, 0.6, -0.9, 0, 0, Math.PI / 2, 0x6a5a48);
      put(ctx, "planksDark", new THREE.CylinderGeometry(0.6, 0.6, 0.12, 12), f, 1.08, 0.6, 0.9, 0, 0, Math.PI / 2, 0x6a5a48);
      put(ctx, "planksDark", new THREE.CylinderGeometry(0.6, 0.6, 0.12, 12), f, -1.6, 0.08, 1.4, Math.PI / 2, 0, 0, 0x6a5a48);
      for (let k = 0; k < 7; k++) {
        const bz = -1.45 + k * 0.48;
        for (const s of [-1, 1]) put(ctx, "metal", new THREE.CylinderGeometry(0.025, 0.025, 1.6, 4), f, s * 0.95, 1.6 - (s < 0 ? 0.12 : 0), bz, (k === 3 && s > 0 ? 0.4 : 0), 0, 0, 0x3a3a3a, false);
      }
      put(ctx, "planksDark", boxUV(2.0, 0.12, 3.2, 1, 1), f, 0, 2.42, 0, 0, 0, -0.12, 0x6a5a48);
      col.box(X + wx, wz, 2.3, 3.4, -0.6);
    }
    {
      // the keeper's lean-to against the cliff
      const lx = -24;
      const lz = 127;
      const f = F(lx, lz, 0.12);
      for (const s of [-1, 1]) {
        put(ctx, "flat", new THREE.CylinderGeometry(0.09, 0.11, 2.4, 6), f, s * 1.8, 1.2, -1.2, 0, 0, 0, C.timber);
        const p = f.at(s * 1.8, 0, -1.2);
        col.circle(p.x, p.z, 0.15);
      }
      put(ctx, "thatch", boxUV(4.2, 0.18, 3.2, 2, 2), f, 0, 2.6, 0.1, -0.35, 0, 0, 0x8a7a5a);
      put(ctx, "planks", boxUV(3.8, 2.6, 0.12, 2, 2), f, 0, 1.6, 1.4, 0, 0, 0, 0x7a6448);
      col.box(X + lx, lz + 1.4, 3.9, 0.4, 0.12);
      barrel(ctx, X + lx - 1.0, lz + 0.4);
      crate(ctx, X + lx + 1.1, lz + 0.5, 0.7, 0.2);
      sack(ctx, X + lx + 0.2, lz + 0.8);
    }
    anchors.houndYard = new V3(X + 6, H(6, 102), 102);
  }

  // ------------------------------------------------------------ Blackwood: pines and oaks
  const scatters: Cullable[] = [];
  const forest = new ChunkBatch(64, 140);
  const clutter = new ChunkBatch(64, 100);
  scatters.push(forest, clutter);
  const pines = [1, 2, 3].map((v) => {
    const t = treeGeo("pine", v + 40);
    return { geo: darken(t.whole, 0.52, 0.6, 0.58), r: t.radius };
  });
  const oaks = [1, 2].map((v) => {
    const t = treeGeo("oak", v + 60);
    return { geo: darken(t.whole, 0.6, 0.64, 0.52), r: t.radius };
  });
  const deadPine = (() => {
    const t = treeGeo("pine", 77);
    // keep only the trunk: a grey dead snag
    return { geo: darken(t.trunk, 0.7, 0.7, 0.72), r: t.radius };
  })();

  const spawnPts = MOB_SPAWNS.filter((s) => s[4] === "hunt").map((s) => [s[2], s[3]] as [number, number]);
  const nodePts = NODE_DEFS.filter((n) => n.zone === "hunt" && n.x !== undefined && n.z !== undefined).map((n) => [n.x as number, n.z as number] as [number, number]);
  const keepClear = (x: number, z: number, treeR: number) => {
    if (trackDist(x, z) < 4.6 + treeR) return true;
    if (trailDist(x, z) < 2.6 + treeR) return true;
    if (lodgeDist(x, z) < 4 + treeR) return true;
    for (const c of CLEARINGS) if (Math.hypot(x - c.x, z - c.z) < c.r + treeR) return true;
    for (const [nx, nz] of nodePts) if (Math.hypot(x - nx, z - nz) < 4.5) return true;
    for (const [sx, sz] of spawnPts) if (Math.hypot(x - sx, z - sz) < 5) return true;
    for (const [hx, hz] of HIGH_SEATS) if (Math.hypot(x - hx, z - hz) < 4) return true;
    if (Math.hypot(x - ARRIVE.x, z - ARRIVE.z) < 12) return true;
    if (Math.abs(x) < 11 && z < -118) return true;
    if (Math.abs(x - 10) < 16 && z > 112 && z < 140) return true;
    const cz = cliffZ(x);
    if (z > cz - 1 && z < cz + 13) return true;
    return false;
  };
  const spacing = 7.2;
  let trees = 0;
  for (let gx = B.minX + 2; gx < B.maxX; gx += spacing)
    for (let gz = B.minZ + 2; gz < B.maxZ; gz += spacing) {
      const x = gx + (r() - 0.5) * spacing * 0.9;
      const z = gz + (r() - 0.5) * spacing * 0.9;
      if (keepClear(x, z, 0.6)) continue;
      const dens = fbm(x * 0.03 + 5, z * 0.03 - 2, 3);
      const edge = Math.min(x - B.minX, B.maxX - x, z - B.minZ, B.maxZ - z);
      if (r() > 0.36 + dens * 0.5 + (edge < 22 ? 0.35 : 0)) continue;
      const y = h(X + x, z);
      const roll2 = r();
      const isOak = dens < 0.48 && roll2 < 0.45 && edge > 18;
      if (!isOak && roll2 > 0.97) {
        forest.add("leaf", M.foliage, deadPine.geo, X + x, y - 0.1, z, r() * 6, 0.9 + r() * 0.3, 0.9 + r() * 0.3, true, { from: 6, scale: 10 });
        col.circle(X + x, z, deadPine.r + 0.15);
        continue;
      }
      const tg = isOak ? oaks[Math.floor(r() * oaks.length)] : pines[Math.floor(r() * pines.length)];
      const s = isOak ? 0.95 + r() * 0.45 : 1.0 + r() * 0.5;
      forest.add("leaf", M.foliage, tg.geo, X + x, y - 0.15, z, r() * Math.PI * 2, s, s * (0.9 + r() * 0.3), true, isOak ? { from: 5, scale: 10 } : { from: 6, scale: 10 });
      col.circle(X + x, z, (isOak ? 0.7 : 0.42) * s + 0.15);
      trees++;
    }
  // pines along the cliff top: a dark crown over the kennels
  for (let x = B.minX + 4; x < B.maxX - 4; x += 7 + r() * 5) {
    const z = cliffZ(x) + 15 + r() * 6;
    if (z > B.maxZ + 2) continue;
    const tg = pines[Math.floor(r() * pines.length)];
    const s = 0.95 + r() * 0.4;
    forest.add("leaf", M.foliage, tg.geo, X + x, h(X + x, z) - 0.2, z, r() * 6, s, s, true, { from: 6, scale: 10 });
  }

  // understorey: ferns, bushes, rocks, fallen logs, stumps, mushrooms
  const fernG = fernGeo();
  {
    const c = fernG.getAttribute("color");
    for (let i = 0; i < c.count; i++) c.setXYZ(i, c.getX(i) * 0.7, c.getY(i) * 0.78, c.getZ(i) * 0.66);
  }
  const fernSet = new Scatter([{ geo: fernG, mat: M.fern }], 64, 75);
  scatters.push(fernSet);
  const bushGeos = [0, 1].map((i) => darken(bushGeo(i + 13, 1, true), 0.55, 0.62, 0.52));
  const rockGeos = [0, 1, 2].map((i) => rockOf(i, true, 0.68));
  const logBig = logGeo(7, 0.5);
  const logSmall = logGeo(4, 0.34);
  const stumpG = stumpGeo(0.55, 0.7);
  const mushG = mushroomGeo(7);
  const flat = (g: THREE.BufferGeometry, x: number, y: number, z: number, ry: number, sc: number, sy = sc) => clutter.add("flat", M.clutter, g, X + x, y, z, ry, sc, sy);
  const near = (x: number, z: number) => Math.min(trackDist(x, z), trailDist(x, z) + 1.4);
  for (let i = 0; i < 6500; i++) {
    const x = B.minX + 2 + r() * (B.maxX - B.minX - 4);
    const z = B.minZ + 2 + r() * (B.maxZ - B.minZ - 4);
    const cz = cliffZ(x);
    if (z > cz + 1.5 && z < cz + 12) continue;
    if (lodgeDist(x, z) < 1.5) continue;
    if (Math.hypot(x - CAVE.x, z - 127) < 10) continue;
    const nd = near(x, z);
    if (nd < 2.4) continue;
    let inClear = false;
    for (const c of CLEARINGS) if (Math.hypot(x - c.x, z - c.z) < c.r * 0.8) inClear = true;
    const y = h(X + x, z);
    const roll2 = r();
    if (roll2 < 0.5) {
      if (inClear && r() < 0.75) continue;
      fernSet.add(X + x, y - 0.05, z, r() * 6, 0.9 + r() * 1.0);
    } else if (roll2 < 0.58) {
      if (inClear) continue;
      forest.add("leaf", M.foliage, bushGeos[i % 2], X + x, y - 0.1, z, r() * 6, 0.7 + r() * 0.6, 0.6 + r() * 0.5, false, { from: 0.2, scale: 5 });
    } else if (roll2 < 0.6) {
      const sc = 0.4 + r() * 0.9;
      const sc2 = sc > 0.8 && (keepClear(x, z, 0.5) || inClear) ? 0.5 : sc;
      flat(rockGeos[i % 3], x, y - 0.12 * sc2, z, r() * 6, sc2, sc2 * (0.7 + r() * 0.5));
      if (sc2 > 0.8) col.circle(X + x, z, sc2 * 0.75);
    } else if (roll2 < 0.606) {
      if (keepClear(x, z, 3) || inClear) continue;
      const big = r() < 0.5;
      const ry = r() * Math.PI;
      flat(big ? logBig : logSmall, x, y + (big ? 0.38 : 0.26), z, ry, 1);
      // colliders along the log
      const half = big ? 3.2 : 1.8;
      for (const t of [-1, 0, 1]) col.circle(X + x + Math.cos(ry) * half * 0.66 * t, z - Math.sin(ry) * half * 0.66 * t, big ? 0.6 : 0.42);
      // ferns and mushrooms at its sides
      for (let k = 0; k < 3; k++) fernSet.add(X + x + (r() - 0.5) * 3, y - 0.05, z + (r() - 0.5) * 3, r() * 6, 0.8 + r() * 0.5);
      flat(mushG, x + Math.sin(ry) * 0.7, y, z + Math.cos(ry) * 0.7, r() * 6, 1.2);
    } else if (roll2 < 0.615) {
      if (inClear && r() < 0.6) continue;
      flat(stumpG, x, y - 0.05, z, r() * 6, 0.6 + r() * 0.6);
    } else if (roll2 < 0.632) {
      flat(mushG, x, y, z, r() * 6, 0.8 + r() * 0.9);
    }
  }
  // grass: only where light gets in (clearings, track verges, the lodge yard)
  const grassSets = [0, 1].map((i) => {
    const g = grassGeo(i + 71, 14, 0.4);
    const c = g.getAttribute("color");
    for (let k = 0; k < c.count; k++) c.setXYZ(k, c.getX(k) * 0.72, c.getY(k) * 0.78, c.getZ(k) * 0.62);
    return new Scatter([{ geo: g, mat: M.grass }], 48, 55);
  });
  for (let i = 0; i < 12000; i++) {
    const x = B.minX + 4 + r() * (B.maxX - B.minX - 8);
    const z = B.minZ + 4 + r() * (B.maxZ - B.minZ - 8);
    if (lodgeDist(x, z) < 0.4) continue;
    if (z > cliffZ(x) + 1) continue;
    const nd = near(x, z);
    if (nd < 1.6) continue;
    let keep = nd < 7 ? 0.95 : lodgeDist(x, z) < 8 ? 0.95 : 0.06;
    for (const c of CLEARINGS) if (Math.hypot(x - c.x, z - c.z) < c.r + 2) keep = 1;
    if (r() > keep) continue;
    if (fbm(x * 0.15, z * 0.15, 2) < 0.36) continue;
    const s = 0.8 + r() * 0.6;
    grassSets[i % 2].add(X + x, h(X + x, z) - 0.02, z, r() * 6, s, s * (0.8 + r() * 0.5));
  }

  // ------------------------------------------------------------ mist in the hollows
  {
    const parts: THREE.BufferGeometry[] = [];
    const sites: [number, number, number][] = [];
    for (const c of CLEARINGS) sites.push([c.x + (r() - 0.5) * 6, c.z + (r() - 0.5) * 6, c.r * 1.3]);
    for (let i = 0; i < 26; i++) {
      const x = B.minX + 12 + r() * (B.maxX - B.minX - 24);
      const z = B.minZ + 12 + r() * (B.maxZ - B.minZ - 30);
      if (z > cliffZ(x) - 4) continue;
      sites.push([x, z, 9 + r() * 9]);
    }
    for (let i = 0; i < 12; i++) {
      const p = TRACK[Math.floor(r() * TRACK.length)];
      sites.push([p[0] + (r() - 0.5) * 4, p[1] + (r() - 0.5) * 4, 8 + r() * 6]);
    }
    for (const [x, z, s] of sites) {
      for (let k = 0; k < 2; k++) {
        const g = new THREE.PlaneGeometry(s * 2, s * 2 * (0.6 + r() * 0.4));
        g.rotateX(-Math.PI / 2);
        g.rotateY(r() * Math.PI);
        // sit above the highest point under the sheet's centre third so it doesn't cut the ground
        let top = -Infinity;
        for (const [dx, dz] of [[0, 0], [s * 0.4, 0], [-s * 0.4, 0], [0, s * 0.4], [0, -s * 0.4]]) top = Math.max(top, h(X + x + dx, z + dz));
        g.translate(X + x + (r() - 0.5) * s * 0.4, top + 0.5 + k * 0.7 + r() * 0.4, z + (r() - 0.5) * s * 0.4);
        parts.push(g);
      }
    }
    const geo = new THREE.BufferGeometry();
    const merged = (() => {
      const pos: number[] = [];
      const uv: number[] = [];
      const idx: number[] = [];
      for (const p of parts) {
        const base = pos.length / 3;
        const pp = p.getAttribute("position");
        const pu = p.getAttribute("uv");
        for (let i = 0; i < pp.count; i++) {
          pos.push(pp.getX(i), pp.getY(i), pp.getZ(i));
          uv.push(pu.getX(i), pu.getY(i));
        }
        const ix = p.index!;
        for (let i = 0; i < ix.count; i++) idx.push(base + ix.getX(i));
      }
      geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
      geo.setIndex(idx);
      geo.computeBoundingSphere();
      return geo;
    })();
    const mat = new THREE.MeshBasicMaterial({ map: mistTex(), color: 0xb4beb4, transparent: true, opacity: 0.17, depthWrite: false, side: THREE.DoubleSide });
    const mist = new THREE.Mesh(merged, mat);
    mist.renderOrder = 2;
    mist.name = "mist";
    root.add(mist);
  }

  // ------------------------------------------------------------ nodes, then merge it all
  const nodes = zoneNodes(M, root, col, "hunt", groundAt);
  batch.build(root);
  for (const s of scatters) (s as ChunkBatch | Scatter).build(root);
  for (const s of grassSets) s.build(root);

  // ------------------------------------------------------------ anchors, regions, surfaces
  anchors.arrive = new V3(X + ARRIVE.x, H(ARRIVE.x, ARRIVE.z), ARRIVE.z);
  anchors.southRoad = new V3(X, H(0, -146), -146);
  anchors.wolvesWest = new V3(X - 41, H(-41, -5), -5);
  anchors.wolvesEast = new V3(X + 50, H(50, 45), 45);
  anchors.boarSouth = new V3(X + 35, H(35, -65), -65);
  anchors.boarWest = new V3(X - 70, H(-70, 60), 60);
  anchors.ironOutcrop = new V3(X + 92, H(92, 66), 66);

  const regionAt = (x: number, z: number) => {
    const lx = x - X;
    if (lodgeDist(lx, z) < 9) return "lodge";
    if (z > 84 && Math.abs(lx - 6) < 42) return "kennel_cave";
    if (trackDist(lx, z) < 8) return "hunters_track";
    return "blackwood";
  };
  const regions: Record<string, [string, string]> = {
    lodge: ["The Royal Hunting Lodge", "Antlers on the walls. The roof gave up."],
    blackwood: ["Blackwood", "The King's old hunting grounds"],
    kennel_cave: ["The Kennel Cave", "Something still barks under the hill"],
    hunters_track: ["The Hunters' Track", "North to the kennels"],
  };
  const surfaceAt = (x: number, z: number): "wood" | "stone" | "dirt" | "grass" => {
    const lx = x - X;
    if (Math.abs(lx - LODGE.x) < LODGE.hw && Math.abs(z - LODGE.z) < LODGE.hd) return "stone";
    if (terrain.pathAt(x, z) > 0.4) return "dirt";
    if (z > 112 && Math.abs(lx - 10) < 16) return "dirt";
    return "grass";
  };

  return {
    root,
    groundAt,
    surfaceAt,
    regionAt,
    regions,
    fires,
    lamps,
    glows,
    smoke,
    nodes,
    scatters,
    grass: grassSets,
    anchors,
    fog: { color: 0x4e5850, density: 0.0145 },
  };
}
