import * as THREE from "three";
import { Batch, boxUV, merge, place, prep, rootGeo, tint } from "../../engine/kit";
import { fbm, noise2, rng } from "../../engine/noise";
import { bannerTex } from "../../engine/textures";
import { ZONES } from "../../data/zones.ts";
import type { PlayerState } from "../../play/env";
import { zoneNodes } from "../nodes";
import { Frame, barrel, crate, hay, put, sack, trough, type Ctx, type Glow } from "../props";
import type { ZoneBuild, ZoneEnv, ZoneInteract } from "../zone";

/**
 * The Royal Kennels: stone and timber cut into the hill above Blackwood. Rooms run north along
 * +z like Cookie's Castle: the kennel hall (collars on hooks), the hound run (marked plates, a
 * swinging log, loose boards over a hidden nook), the feeding room (two plates and the feed cart),
 * the Kennelmaster's yard and its bell gate, then the round kennel-cave where Boe waits.
 * Everything is in world coordinates (x = ox + local x); the floor is y = 0 throughout.
 */

const Z = ZONES.kennel;
const X = Z.ox;
/** room ceiling (the camera is kept a little under it) */
const H = 7.0;
/** the yard is taller */
const HY = 8.2;
const ARENA = { x: 0, z: 116, r: 14 };
/** centre radius of the arena's wall colliders (inner face ~15.9) */
const RING = 16.8;
const RAIL_A = { x: -3, z: 50 };
const RAIL_B = { x: -5, z: 58 };
const PLATES: [number, number][] = [[-5, 58], [5, 58]];
const PLATE_R = 1.25;
const CART_R = 0.95;
const LOG_Z = 38;
const LOG_Y = 6.4;
const LOG_LEN = 5.0;
const LOG_CYCLE = 3;
/** marked plates in the hound run (local x, z), leaving a weaving way through */
const TRAPS: [number, number][] = [
  [-2.3, 23.2], [0.3, 23.8],
  [1.9, 26.4], [-0.9, 27.0],
  [-2.6, 29.8], [0.0, 30.6],
  [2.3, 33.0], [-0.6, 33.4],
  [-2.4, 35.6], [1.2, 35.4],
  [2.0, 41.6], [-1.3, 42.0], [0.6, 44.4],
];

const C = {
  timber: 0x3a3028,
  iron: 0x45474b,
  leather: 0x5a3a26,
  red: 0x8e2f2f,
  bone: 0xd8ccb0,
  straw: 0xb59a55,
  brass: 0xa8843a,
};

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

/** A dark trap stone scored with three rust-red claw marks inside a worn ring. */
const markTex = () =>
  paintTex("kennel_mark", 128, 128, (g, w, h) => {
    const r = rng(77);
    g.fillStyle = "#4a4440";
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) {
      const v = 50 + r() * 50;
      g.fillStyle = `rgba(${v},${v * 0.95},${v * 0.9},0.6)`;
      g.fillRect(r() * w, r() * h, 2 + r() * 3, 2 + r() * 3);
    }
    g.strokeStyle = "#2a2420";
    g.lineWidth = 6;
    g.strokeRect(4, 4, w - 8, h - 8);
    g.strokeStyle = "rgba(120,40,28,0.9)";
    g.lineWidth = 5;
    g.beginPath();
    g.arc(w / 2, h / 2, 40, 0, Math.PI * 2);
    g.stroke();
    g.lineCap = "round";
    g.lineWidth = 8;
    for (let i = -1; i <= 1; i++) {
      g.beginPath();
      g.moveTo(w / 2 - 20 + i * 16, h / 2 - 26);
      g.quadraticCurveTo(w / 2 + i * 14, h / 2, w / 2 + 16 + i * 16, h / 2 + 26);
      g.stroke();
    }
  });

/** Places (rotation, then translation, optional scale) and tints a geometry, ready to merge. */
function at(geo: THREE.BufferGeometry, x: number, y: number, z: number, color: THREE.ColorRepresentation, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) {
  place(geo, x, y, z, rx, ry, rz, sx, sy, sz);
  return tint(geo, color);
}

/** Turn a surface inside out (for walls and domes seen from within): swap winding, renormal. */
function inward(g: THREE.BufferGeometry) {
  const geo = prep(g);
  const idx = geo.index!;
  for (let i = 0; i < idx.count; i += 3) {
    const b = idx.getX(i + 1);
    idx.setX(i + 1, idx.getX(i + 2));
    idx.setX(i + 2, b);
  }
  geo.computeVertexNormals();
  return geo;
}

export function buildKennel(env: ZoneEnv): ZoneBuild {
  const { M, col } = env;
  const root = new THREE.Group();
  root.name = "kennel";
  const batch = new Batch();
  const glows: Glow[] = [];
  const fires: THREE.Vector3[] = [];
  const lamps: THREE.Vector3[] = [];
  const smoke: THREE.Vector3[] = [];
  const ctx: Ctx = { batch, M, col, h: () => 0, glows, smoke, fires, lamps };
  const r = rng(4242);
  /** a frame at local (x, z), rotated, at height y */
  const F = (x: number, z: number, rot = 0, y = 0) => new Frame(X + x, y, z, rot);

  // ------------------------------------------------------------ building kit
  const floor = (x0: number, x1: number, z0: number, z1: number, color = 0xb0a698) => {
    put(ctx, "flagstone", boxUV(x1 - x0, 0.4, z1 - z0, 3, 3), F((x0 + x1) / 2, (z0 + z1) / 2), 0, -0.2, 0, 0, 0, 0, color, false);
  };
  const ceil = (x0: number, x1: number, z0: number, z1: number, h = H) => {
    put(ctx, "planksDark", boxUV(x1 - x0 + 1, 0.4, z1 - z0 + 1, 2, 2), F((x0 + x1) / 2, (z0 + z1) / 2, 0, h), 0, 0.2, 0, 0, 0, 0, 0x6a5e52, false);
    for (let z = z0 + 1.6; z < z1 - 0.4; z += 3.2) put(ctx, "flat", new THREE.BoxGeometry(x1 - x0, 0.45, 0.42), F((x0 + x1) / 2, z, 0, h), 0, -0.22, 0, 0, 0, 0, 0x261e18, false);
  };
  /** A wall from local (x0,z0) to (x1,z1): dark footing, grey stone, a timber rail and posts. */
  const wallSeg = (x0: number, z0: number, x1: number, z1: number, h = H + 0.8, on?: () => boolean) => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    if (len < 0.05) return;
    const rot = Math.atan2(x1 - x0, z1 - z0) - Math.PI / 2;
    const cx = (x0 + x1) / 2;
    const cz = (z0 + z1) / 2;
    const f = F(cx, cz, rot);
    put(ctx, "stoneDark", boxUV(len, 1.1, 0.9, 2, 1.1), f, 0, 0.55, 0);
    put(ctx, "stoneGrey", boxUV(len, h - 1.1, 0.8, 2.6, 2.6), f, 0, 1.1 + (h - 1.1) / 2, 0, 0, 0, 0, 0x8c867c);
    if (h > 3.2) put(ctx, "flat", new THREE.BoxGeometry(len, 0.24, 0.94), f, 0, 2.9, 0, 0, 0, 0, C.timber);
    const n = Math.max(1, Math.round(len / 4));
    for (let k = 1; k < n; k++) put(ctx, "planksDark", boxUV(0.34, h - 0.3, 1.0, 1, 2), f, -len / 2 + (k * len) / n, (h - 0.3) / 2, 0, 0, 0, 0, 0x9a8a7a);
    col.box(X + cx, cz, len, 1.0, rot, on);
  };
  /** A stone block that is only seen (lintels over openings). */
  const lintel = (x: number, z: number, w: number, d: number, y0: number, y1: number) => {
    put(ctx, "stoneGrey", boxUV(w, y1 - y0, d, 2.6, 2.6), F(x, z), 0, (y0 + y1) / 2, 0, 0, 0, 0, 0x8c867c);
    put(ctx, "flat", new THREE.BoxGeometry(w + 0.1, 0.3, d + 0.06), F(x, z), 0, y0 + 0.15, 0, 0, 0, 0, C.timber);
  };
  /** An iron cage lantern on a wall bracket; `face` turns its front (local +z) into the room. */
  const sconce = (x: number, z: number, face: number, y = 3.4) => {
    const f = F(x, z, face);
    put(ctx, "metal", new THREE.BoxGeometry(0.1, 0.5, 0.4), f, 0, y, 0.15, 0, 0, 0, 0x3a3a3a);
    put(ctx, "metal", new THREE.CylinderGeometry(0.15, 0.09, 0.16, 6), f, 0, y + 0.28, 0.38, 0, 0, 0, 0x2e2e2e);
    put(ctx, "ember", new THREE.ConeGeometry(0.11, 0.26, 6), f, 0, y + 0.46, 0.38, 0, 0, 0, 0xffffff, false);
    const p = f.at(0, y + 0.55, 0.38);
    glows.push({ x: p.x, y: p.y, z: p.z, size: 3.6, color: 0xff9a48 });
    fires.push(p);
  };
  const brazier = (x: number, z: number) => {
    const f = F(x, z);
    put(ctx, "metal", new THREE.CylinderGeometry(0.55, 0.3, 0.5, 10), f, 0, 1.15, 0, 0, 0, 0, 0x4a3a2a);
    for (const a of [0, 2.1, 4.2]) put(ctx, "metal", new THREE.BoxGeometry(0.06, 1.0, 0.06), f, Math.cos(a) * 0.3, 0.5, Math.sin(a) * 0.3, Math.sin(a) * 0.3, 0, Math.cos(a) * 0.3, 0x3a3a3a);
    put(ctx, "ember", new THREE.ConeGeometry(0.42, 0.35, 7), f, 0, 1.45, 0, 0, 0, 0, 0xffffff, false);
    const p = f.at(0, 1.8, 0);
    fires.push(p);
    glows.push({ x: p.x, y: 1.9, z: p.z, size: 6, color: 0xff8a3a });
    col.circle(X + x, z, 0.6);
  };
  /** A collar hanging from a hook on a wall (face: local +z into the room). */
  const collar = (x: number, z: number, face: number, y: number, color: number) => {
    const f = F(x, z, face);
    put(ctx, "metal", new THREE.BoxGeometry(0.04, 0.16, 0.12), f, 0, y + 0.1, 0.06, 0, 0, 0, 0x2e2e30, false);
    put(ctx, "flat", new THREE.TorusGeometry(0.15, 0.035, 5, 12), f, 0, y - 0.1, 0.1, 0.25, 0, 0, color, false);
    put(ctx, "metal", new THREE.BoxGeometry(0.06, 0.06, 0.04), f, 0, y - 0.26, 0.13, 0, 0, 0, C.brass, false);
  };
  const strawPatch = (x: number, z: number, w: number, d: number, rot = 0) => {
    put(ctx, "thatch", boxUV(w, 0.06, d, 1.5, 1.5), F(x, z, rot), 0, 0.03, 0, 0, 0, 0, 0xcbb47c, false);
  };
  const bone = (x: number, z: number, ry: number, s = 1) => {
    const f = F(x, z, ry);
    put(ctx, "flat", new THREE.CylinderGeometry(0.035 * s, 0.03 * s, 0.42 * s, 5), f, 0, 0.05 * s, 0, 0, 0, Math.PI / 2, C.bone, false);
    for (const e of [-1, 1]) put(ctx, "flat", new THREE.SphereGeometry(0.06 * s, 6, 4), f, e * 0.21 * s, 0.05 * s, 0.02 * e, 0, 0, 0, 0xe0d6c0, false);
  };
  const skull = (x: number, z: number, ry: number, s = 1) => {
    const f = F(x, z, ry);
    const g = new THREE.SphereGeometry(0.14 * s, 8, 6);
    g.scale(0.9, 0.75, 1.5);
    put(ctx, "flat", g, f, 0, 0.1 * s, 0, 0, 0, 0, 0xd4c8ae, false);
    put(ctx, "flat", new THREE.ConeGeometry(0.07 * s, 0.22 * s, 6), f, 0, 0.08 * s, 0.26 * s, Math.PI / 2, 0, 0, 0xcfc2a6, false);
    for (const e of [-1, 1]) put(ctx, "flat", new THREE.SphereGeometry(0.035 * s, 5, 4), f, e * 0.07 * s, 0.14 * s, 0.12 * s, 0, 0, 0, 0x1a1410, false);
  };

  // ------------------------------------------------------------ entry hall z -1..20 (and the way in)
  floor(-7, 7, -1.4, 20);
  ceil(-7, 7, -1, 20);
  wallSeg(-7, -1, -1.6, -1);
  wallSeg(1.6, -1, 7, -1);
  lintel(0, -1, 3.4, 0.9, 3.7, H + 0.8);
  wallSeg(-7, -1, -7, 20);
  wallSeg(7, -1, 7, 20);
  wallSeg(-7, 20, -4, 20);
  wallSeg(4, 20, 7, 20);
  lintel(0, 20, 8.2, 0.9, 5.0, H + 0.8);
  {
    // the doorway's timber frame, and the short tunnel back to the cave mouth
    const f = F(0, -1.1);
    for (const s of [-1, 1]) put(ctx, "planksDark", boxUV(0.32, 3.8, 0.5, 1, 2), f, s * 1.75, 1.9, 0.3);
    put(ctx, "planksDark", boxUV(4.0, 0.36, 0.5, 2, 1), f, 0, 3.75, 0.3);
    floor(-2, 2, -4.3, -1);
    wallSeg(-2.1, -4.3, -2.1, -1, 4.4);
    wallSeg(2.1, -4.3, 2.1, -1, 4.4);
    wallSeg(-2.1, -4.3, 2.1, -4.3, 4.4);
    ceil(-2.1, 2.1, -4.3, -1, 4.2);
    const day = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 3.8), new THREE.MeshBasicMaterial({ color: 0x8a96a0 }));
    day.position.set(X, 1.9, -3.8);
    root.add(day);
    glows.push({ x: X, y: 2.2, z: -3.2, size: 7, color: 0x9fb0c0 });
  }
  // kennel pens down both sides: timber partitions, straw, troughs and bowls
  for (const s of [-1, 1]) {
    for (const z of [4, 8, 12, 16]) {
      const f = F(s * 5.72, z);
      put(ctx, "planks", boxUV(1.66, 1.25, 0.14, 1, 1), f, 0, 0.66, 0, 0, 0, 0, 0xa89880);
      put(ctx, "flat", new THREE.BoxGeometry(0.18, 1.6, 0.18), f, -s * 0.83, 0.8, 0, 0, 0, 0, C.timber);
      put(ctx, "flat", new THREE.BoxGeometry(1.7, 0.12, 0.2), f, 0, 1.32, 0, 0, 0, 0, C.timber);
      col.box(X + s * 5.72, z, 1.7, 0.3, 0);
    }
    for (const z of [2, 10, 18]) strawPatch(s * 5.6, z, 1.7, 2.8, r() * 0.2);
    for (const z of [6, 14]) trough(ctx, X + s * 6.0, z, Math.PI / 2);
    for (const z of [10, 18.4]) {
      const f = F(s * 5.5, z);
      put(ctx, "metal", new THREE.CylinderGeometry(0.26, 0.2, 0.14, 10), f, 0, 0.07, 0, 0, 0, 0, 0x5a5650);
    }
    // the collars: rows of them, empty, on an iron rail
    const face = s < 0 ? Math.PI / 2 : -Math.PI / 2;
    put(ctx, "metal", new THREE.BoxGeometry(0.06, 0.06, 20.2), F(s * 6.5, 9.6), 0, 2.02, 0, 0, 0, 0, 0x2e2e30, false);
    for (let z = 0.4; z < 19.6; z += 0.72) {
      if ([4, 8, 12, 16].some((p) => Math.abs(p - z) < 0.25)) continue;
      const tone = r();
      collar(s * 6.48, z, face, 1.95, tone < 0.08 ? C.red : tone < 0.5 ? C.leather : tone < 0.8 ? 0x3e2a1e : 0x6a4a30);
    }
    // name boards above the pens
    for (const z of [6, 10, 14, 18]) put(ctx, "planks", boxUV(0.08, 0.32, 1.3, 1, 1), F(s * 6.5, z), 0, 2.55, 0, 0, 0, 0, 0x8a7458);
    sconce(s * 6.5, 2.2, face);
    sconce(s * 6.5, 15.8, face);
  }
  brazier(-4.0, 10);
  brazier(4.0, 10);
  // royal banners by the door
  const bannerGeos: THREE.BufferGeometry[] = [];
  for (const s of [-1, 1]) {
    const g = new THREE.PlaneGeometry(1.3, 2.6, 1, 4);
    place(g, X + s * 6.5, 4.6, 1.6, 0, s < 0 ? Math.PI / 2 : -Math.PI / 2, 0);
    // offset off the wall
    g.translate(-s * 0.08, 0, 0);
    bannerGeos.push(g);
    put(ctx, "flat", new THREE.CylinderGeometry(0.04, 0.04, 1.6, 5), F(s * 6.35, 1.6), 0, 5.95, 0, Math.PI / 2, 0, 0, 0x3a3028, false);
  }

  // ------------------------------------------------------------ the hound run z 20..46
  floor(-4, 4, 20, 46);
  ceil(-4, 4, 20, 46);
  wallSeg(-4, 20, -4, 46);
  wallSeg(4, 20, 4, 28.6);
  wallSeg(4, 31.4, 4, 46);
  lintel(4, 30, 0.8, 2.8, 3.1, H + 0.8);
  sconce(-3.55, 24.5, Math.PI / 2);
  sconce(3.55, 35.2, -Math.PI / 2);
  sconce(-3.55, 43.2, Math.PI / 2);
  sconce(3.55, 43.8, -Math.PI / 2);
  // the cracks around the boarded gap (a draught you can see)
  for (const [dz, dy, len, a] of [[-1.6, 1.4, 1.2, 0.9], [-1.7, 2.6, 0.9, -0.6], [1.6, 0.9, 1.0, -1.1], [1.7, 2.3, 1.3, 0.7], [0.3, 3.3, 1.1, 0.2]]) {
    put(ctx, "flat", new THREE.BoxGeometry(0.03, len, 0.06), F(3.56, 30 + dz, -Math.PI / 2), 0, dy, 0, 0, 0, a, 0x14100c, false);
  }
  // scored walls where the log has been swinging for years
  for (const s of [-1, 1])
    for (let i = 0; i < 6; i++) put(ctx, "flat", new THREE.BoxGeometry(0.03, 0.08, 1.6 + r()), F(s * 3.56, LOG_Z - 1.5 + i * 0.6), 0, 0.9 + r() * 0.9, 0, 0.2 * (r() - 0.5), 0, 0, 0x1a1612, false);
  // the axle the log hangs from
  put(ctx, "flat", new THREE.BoxGeometry(8.6, 0.44, 0.44), F(0, LOG_Z), 0, LOG_Y, 0, 0, 0, 0, 0x2a221c);
  for (const s of [-1, 1]) put(ctx, "metal", new THREE.BoxGeometry(0.3, 0.7, 0.7), F(s * 3.5, LOG_Z), 0, LOG_Y, 0, 0, 0, 0, 0x3a3a3a);
  // the side nook behind the loose boards: a short crawl and a little room
  floor(4, 10, 28.6, 31.4, 0x9a9080);
  floor(10, 17.2, 26.6, 37.2, 0x9a9080);
  ceil(4, 10, 28.6, 31.4, 3.6);
  ceil(10, 17.2, 26.6, 37.2, 3.6);
  wallSeg(4.2, 28.6, 10, 28.6, 3.9);
  wallSeg(4.2, 31.4, 10, 31.4, 3.9);
  wallSeg(10, 26.6, 17.2, 26.6, 3.9);
  wallSeg(10, 37.2, 17.2, 37.2, 3.9);
  wallSeg(17.2, 26.6, 17.2, 37.2, 3.9);
  wallSeg(10, 26.6, 10, 28.6, 3.9);
  wallSeg(10, 31.4, 10, 37.2, 3.9);
  {
    // the chest (the cache itself is at (14, 32); the game adds the Search prompt)
    const cf = F(15.9, 32, -Math.PI / 2);
    put(ctx, "planksDark", boxUV(1.1, 0.6, 0.65, 1, 1), cf, 0, 0.3, 0);
    put(ctx, "planksDark", new THREE.CylinderGeometry(0.32, 0.32, 1.1, 10, 1, false, 0, Math.PI), cf, 0, 0.6, 0, 0, 0, Math.PI / 2);
    for (const e of [-0.4, 0.4]) put(ctx, "metal", new THREE.BoxGeometry(0.08, 0.95, 0.7), cf, e, 0.45, 0, 0, 0, 0, 0x3a3a3a);
    put(ctx, "metal", new THREE.BoxGeometry(0.16, 0.16, 0.06), cf, 0, 0.55, 0.34, 0, 0, 0, C.brass);
    col.box(X + 15.9, 32, 0.75, 1.2, 0);
    crate(ctx, X + 11.0, 36.2, 0.7, 0.3);
    crate(ctx, X + 16.3, 27.6, 0.6, 1.1);
    sack(ctx, X + 11.6, 27.5);
    // a collar on a nail with a brass tag, and an old candle
    collar(16.75, 34.6, -Math.PI / 2, 1.8, C.red);
    const cp = F(16.4, 29.4);
    put(ctx, "flat", new THREE.CylinderGeometry(0.06, 0.07, 0.3, 6), cp, 0, 0.75, 0, 0, 0, 0, 0xe0d8c0);
    put(ctx, "planks", boxUV(0.6, 0.06, 0.6, 1, 1), cp, 0, 0.58, 0);
    put(ctx, "flat", new THREE.BoxGeometry(0.06, 0.58, 0.06), cp, 0, 0.29, 0, 0, 0, 0, C.timber);
    const p = cp.at(0, 1.0, 0);
    glows.push({ x: p.x, y: p.y, z: p.z, size: 2.4, color: 0xffb060 });
    fires.push(p);
  }

  // marked plates (each sinks and glows red before it bites)
  const markMat = new THREE.MeshLambertMaterial({ map: markTex(), color: 0xc8beb4 });
  type Trap = { x: number; z: number; mesh: THREE.Mesh; mat: THREE.MeshLambertMaterial; arm: number; cd: number };
  const traps: Trap[] = TRAPS.map(([lx, lz]) => {
    const mat = markMat.clone();
    mat.emissive = new THREE.Color(0x000000);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1.36, 0.1, 1.36), mat);
    mesh.position.set(X + lx, 0.03, lz);
    mesh.rotation.y = (r() - 0.5) * 0.1;
    mesh.receiveShadow = true;
    root.add(mesh);
    return { x: X + lx, z: lz, mesh, mat, arm: -1, cd: 0 };
  });
  const spikes = new THREE.Group();
  {
    const g: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) g.push(at(new THREE.ConeGeometry(0.07, 0.62, 5), -0.48 + i * 0.32, 0.31, -0.48 + j * 0.32, 0x8a8680));
    spikes.add(new THREE.Mesh(merge(g), M.metal));
    spikes.visible = false;
    root.add(spikes);
  }
  let spikeT = 0;
  // the floor band under the log's arc: dark iron that reddens as the log winds back
  const bandMat = new THREE.MeshLambertMaterial({ color: 0x2c2420, emissive: new THREE.Color(0x000000) });
  {
    const band = new THREE.Mesh(new THREE.BoxGeometry(7.1, 0.04, 3.0), bandMat);
    band.position.set(X, 0.02, LOG_Z);
    band.receiveShadow = true;
    root.add(band);
  }
  // the swinging log
  const logPivot = new THREE.Group();
  logPivot.position.set(X, LOG_Y, LOG_Z);
  {
    const wood: THREE.BufferGeometry[] = [];
    const iron: THREE.BufferGeometry[] = [];
    wood.push(at(new THREE.CylinderGeometry(0.44, 0.48, 6.4, 12, 1), 0, -LOG_LEN, 0, 0x9a8a78, 0, 0, Math.PI / 2));
    for (const bx of [-2.6, -1.0, 1.0, 2.6]) iron.push(at(new THREE.TorusGeometry(0.48, 0.05, 5, 14), bx, -LOG_LEN, 0, 0x3a3a3a, 0, Math.PI / 2, 0));
    for (let i = 0; i < 7; i++) for (const s of [-1, 1]) iron.push(at(new THREE.ConeGeometry(0.08, 0.5, 5), -2.7 + i * 0.9, -LOG_LEN + (i % 2 ? 0.12 : -0.12), s * 0.62, 0x6a6660, (s * Math.PI) / 2, 0, 0));
    for (const cx of [-2.4, 2.4])
      for (let k = 0; k < 15; k++) iron.push(at(new THREE.TorusGeometry(0.1, 0.025, 4, 8), cx, -LOG_LEN + 0.55 + k * ((LOG_LEN - 0.55) / 15), 0, 0x4a4a4c, 0, k % 2 ? Math.PI / 2 : 0, 0, 1, 1.7, 1));
    const lw = new THREE.Mesh(merge(wood), M.bark);
    const li = new THREE.Mesh(merge(iron), M.metal);
    lw.castShadow = li.castShadow = true;
    logPivot.add(lw, li);
    logPivot.rotation.x = 1.1;
    root.add(logPivot);
  }

  // the loose boards over the nook (a collider that goes when they do)
  let boardsOpen = false;
  const boards = new THREE.Group();
  {
    const g: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 7; i++) g.push(at(boxUV(0.08, 0.34, 3.05, 1, 1), (r() - 0.5) * 0.04, 0.3 + i * 0.44, (r() - 0.5) * 0.12, 0x9a8668, (r() - 0.5) * 0.08, 0, 0));
    for (const bz of [-1.0, 0.9]) g.push(at(boxUV(0.08, 3.1, 0.22, 1, 1), -0.07, 1.6, bz, 0x7a664c));
    const wood = new THREE.Mesh(merge(g), M.planks);
    wood.castShadow = true;
    const nails: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 7; i++) for (const bz of [-1.0, 0.9]) nails.push(at(new THREE.SphereGeometry(0.03, 4, 3), -0.12, 0.3 + i * 0.44, bz, 0x2a2a2a));
    boards.add(wood, new THREE.Mesh(merge(nails), M.metal));
    boards.position.set(X + 3.7, 0, 30);
    root.add(boards);
    col.box(X + 4, 30, 0.9, 2.9, 0, () => !boardsOpen);
  }

  // ------------------------------------------------------------ the feeding room z 46..70
  floor(-9, 9, 46, 70);
  ceil(-9, 9, 46, 70);
  wallSeg(-9, 46, -4, 46);
  wallSeg(4, 46, 9, 46);
  lintel(0, 46, 8.2, 0.9, 5.2, H + 0.8);
  wallSeg(-9, 46, -9, 70);
  wallSeg(9, 46, 9, 70);
  // the thick wall between the feeding room and the yard, with the portcullis slot
  for (const s of [-1, 1]) {
    const f = F(s * 7.25, 71);
    put(ctx, "stoneDark", boxUV(9.5, 1.1, 2.2, 2, 1.1), f, 0, 0.55, 0);
    put(ctx, "stoneGrey", boxUV(9.5, HY - 0.3, 2.0, 2.6, 2.6), f, 0, 1.1 + (HY - 0.3) / 2, 0, 0, 0, 0, 0x8c867c);
    col.box(X + s * 7.25, 71, 9.5, 2.2, 0);
    put(ctx, "stoneGrey", boxUV(0.6, 5.6, 2.3, 1, 2), F(s * 2.8, 71), 0, 2.8, 0, 0, 0, 0, 0x9a948a);
  }
  lintel(0, 71, 5.6, 2.2, 5.4, HY + 0.8);
  sconce(-8.55, 51, Math.PI / 2);
  sconce(8.55, 52, -Math.PI / 2);
  sconce(-8.55, 64, Math.PI / 2);
  sconce(8.55, 65, -Math.PI / 2);
  brazier(-4.6, 67.4);
  brazier(4.6, 67.4);

  // rails for the feed cart
  const railLen = Math.hypot(RAIL_B.x - RAIL_A.x, RAIL_B.z - RAIL_A.z);
  const ux = (RAIL_B.x - RAIL_A.x) / railLen;
  const uz = (RAIL_B.z - RAIL_A.z) / railLen;
  const railRot = Math.atan2(ux, uz);
  {
    const s0 = -1.4;
    const s1 = railLen + 1.7;
    const mid = (s0 + s1) / 2;
    const mx = RAIL_A.x + ux * mid;
    const mz = RAIL_A.z + uz * mid;
    for (const side of [-1, 1]) put(ctx, "metal", new THREE.BoxGeometry(0.1, 0.08, s1 - s0), F(mx + uz * side * 0.55, mz - ux * side * 0.55, railRot), 0, 0.05, 0, 0, 0, 0, 0x6a5a48, false);
    for (let s = s0 + 0.3; s < s1; s += 0.7) put(ctx, "planksDark", boxUV(1.5, 0.07, 0.24, 1, 1), F(RAIL_A.x + ux * s, RAIL_A.z + uz * s, railRot), 0, 0.02, 0, 0, 0, 0, 0x8a7a68, false);
    // the stop block past the plate
    put(ctx, "planksDark", boxUV(1.5, 0.45, 0.35, 1, 1), F(RAIL_A.x + ux * (railLen + 1.75), RAIL_A.z + uz * (railLen + 1.75), railRot), 0, 0.22, 0);
  }
  // the feed cart: heavy, on its rails (pushed by walking into it)
  let cartS = env.flag("kennel_plates") ? 1 : 0;
  const cart = new THREE.Group();
  {
    const wood: THREE.BufferGeometry[] = [];
    const iron: THREE.BufferGeometry[] = [];
    wood.push(at(boxUV(1.3, 0.75, 1.9, 1, 1), 0, 0.78, 0, 0xb0a088));
    wood.push(at(new THREE.BoxGeometry(1.16, 0.04, 1.76), 0, 1.13, 0, 0x2e241a));
    for (const s of [-1, 1]) wood.push(at(new THREE.BoxGeometry(0.08, 0.08, 0.9), s * 0.4, 1.05, -1.25, 0x5a4632));
    wood.push(at(new THREE.BoxGeometry(0.9, 0.08, 0.08), 0, 1.05, -1.7, 0x5a4632));
    for (let i = 0; i < 3; i++) {
      const g = new THREE.SphereGeometry(0.32, 8, 6);
      wood.push(at(g, -0.3 + i * 0.3, 1.2, -0.5 + i * 0.45, 0xa8977a, 0, i, 0, 1, 0.7, 0.85));
    }
    wood.push(at(new THREE.SphereGeometry(0.24, 7, 5), 0.25, 1.22, 0.6, 0x7a3a2a, 0, 0, 0, 1, 0.8, 1.6));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) iron.push(at(new THREE.CylinderGeometry(0.3, 0.3, 0.12, 12), sx * 0.72, 0.3, sz * 0.62, 0x3a3a3c, 0, 0, Math.PI / 2));
    for (const sz of [-1, 1]) iron.push(at(new THREE.CylinderGeometry(0.04, 0.04, 1.5, 5), 0, 0.3, sz * 0.62, 0x2e2e30, 0, 0, Math.PI / 2));
    for (const y of [0.5, 1.05]) iron.push(at(new THREE.BoxGeometry(1.34, 0.06, 1.94), 0, y, 0, 0x3a3a3a));
    const cw = new THREE.Mesh(merge(wood), M.planks);
    const ci = new THREE.Mesh(merge(iron), M.metal);
    cw.castShadow = ci.castShadow = true;
    cw.receiveShadow = true;
    cart.add(cw, ci);
    cart.rotation.y = railRot;
    root.add(cart);
  }
  const cartPos = (s: number) => ({ x: X + RAIL_A.x + ux * s * railLen, z: RAIL_A.z + uz * s * railLen });
  // One circle collider that rides along the rail: registered over the whole rail's cells, then moved.
  const railMid = cartPos(0.5);
  const cartCol = col.circle(railMid.x, railMid.z, railLen / 2 + CART_R + 0.6);
  cartCol.r = CART_R;
  const placeCart = () => {
    const p = cartPos(cartS);
    cart.position.set(p.x, 0, p.z);
    cartCol.x = p.x;
    cartCol.z = p.z;
  };
  placeCart();
  // the pressure plates and their lamps
  const plateMeshes = PLATES.map(([lx, lz]) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.25, 0.14, 20), new THREE.MeshPhongMaterial({ color: 0x6a5a44, shininess: 30, specular: 0x332a20 }));
    m.position.set(X + lx, 0.07, lz);
    m.receiveShadow = true;
    root.add(m);
    put(ctx, "metal", new THREE.TorusGeometry(1.3, 0.07, 4, 24), F(lx, lz), 0, 0.03, 0, -Math.PI / 2, 0, 0, C.brass, false);
    return m;
  });
  const lampMats = PLATES.map(([lx, lz]) => {
    const sx = lx < 0 ? -7.6 : 7.6;
    const f = F(sx, lz);
    put(ctx, "metal", new THREE.CylinderGeometry(0.06, 0.09, 1.3, 6), f, 0, 0.65, 0, 0, 0, 0, 0x3a3a3a);
    put(ctx, "metal", new THREE.CylinderGeometry(0.3, 0.16, 0.22, 8), f, 0, 1.38, 0, 0, 0, 0, 0x4a3a2a);
    col.circle(X + sx, lz, 0.35);
    const mat = new THREE.MeshBasicMaterial({ color: 0x2a1a10 });
    const ember = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.3, 7), mat);
    ember.position.set(X + sx, 1.56, lz);
    root.add(ember);
    return mat;
  });
  // chains from each plate to the portcullis winch
  for (const [lx, lz] of PLATES) {
    const sx = Math.sign(lx);
    const ax = lx;
    const az = lz + PLATE_R;
    const bx = sx * 3.05;
    const bz = 69.7;
    const len = Math.hypot(bx - ax, bz - az);
    const n = Math.floor(len / 0.26);
    const rot = Math.atan2(bx - ax, bz - az);
    for (let k = 0; k < n; k++) {
      const t = k / n;
      put(ctx, "metal", new THREE.TorusGeometry(0.09, 0.022, 4, 8), F(ax + (bx - ax) * t, az + (bz - az) * t, rot), 0, 0.04, 0, k % 2 ? 0 : Math.PI / 2, Math.PI / 2, 0, 0x4a4844, false);
    }
    for (let k = 0; k < 20; k++) put(ctx, "metal", new THREE.TorusGeometry(0.09, 0.022, 4, 8), F(bx, 69.75), 0, 0.15 + k * 0.26, 0, 0, k % 2 ? Math.PI / 2 : 0, 0, 0x4a4844, false);
    put(ctx, "metal", new THREE.CylinderGeometry(0.22, 0.22, 0.5, 10), F(bx, 69.8), 0, 5.4, 0, 0, 0, Math.PI / 2, 0x3a3a3a);
  }
  // the portcullis
  const portcullis = new THREE.Group();
  {
    const g: THREE.BufferGeometry[] = [];
    for (let i = 0; i <= 12; i++) {
      const bx = -2.4 + i * 0.4;
      g.push(at(new THREE.CylinderGeometry(0.055, 0.055, 5.4, 6), bx, 2.75, 0, 0x3e3e40));
      g.push(at(new THREE.ConeGeometry(0.07, 0.25, 5), bx, -0.05, 0, 0x4a4a4c, Math.PI, 0, 0));
    }
    for (const y of [0.5, 1.7, 2.9, 4.1, 5.3]) g.push(at(new THREE.BoxGeometry(5.0, 0.12, 0.12), 0, y, 0, 0x343436));
    const m = new THREE.Mesh(merge(g), M.metal);
    m.castShadow = true;
    portcullis.add(m);
    portcullis.position.set(X, env.flag("kennel_plates") ? 5.0 : 0, 71);
    root.add(portcullis);
    col.box(X, 71, 5.2, 0.7, 0, () => !env.flag("kennel_plates"));
  }
  // feeding room clutter: hooks with hanging haunches, sacks, a feed bin, troughs and bones
  for (const [hx, hz] of [[7.4, 48.6], [7.4, 50.4], [7.4, 52.2], [7.4, 63.4], [7.4, 65.2], [-7.4, 61.6], [-7.4, 63.4]]) {
    const f = F(hx, hz);
    for (let k = 0; k < 8; k++) put(ctx, "metal", new THREE.TorusGeometry(0.06, 0.016, 4, 6), f, 0, H - 0.2 - k * 0.2, 0, 0, k % 2 ? Math.PI / 2 : 0, 0, 0x3a3a3a, false);
    put(ctx, "metal", new THREE.TorusGeometry(0.1, 0.02, 4, 8, Math.PI * 1.4), f, 0, H - 1.85, 0, 0, 0, 0, 0x3a3a3a, false);
    const g = new THREE.SphereGeometry(0.26, 8, 6);
    g.scale(1, 1.75, 0.85);
    put(ctx, "flat", g, f, 0, H - 2.5, 0, 0, r() * 3, 0.1, 0x6a3424);
    put(ctx, "flat", new THREE.CylinderGeometry(0.04, 0.05, 0.3, 5), f, 0, H - 1.95, 0, 0, 0, 0, C.bone, false);
  }
  for (const [sx, sz] of [[-8.0, 47.3], [-7.5, 47.6], [-8.1, 48.2], [8.0, 69.0], [7.4, 69.1], [8.1, 68.4], [-8.1, 56.4]]) sack(ctx, X + sx, sz);
  {
    const f = F(-7.6, 66.6);
    put(ctx, "planks", boxUV(1.4, 1.1, 2.4, 1, 1), f, 0, 0.55, 0, 0, 0, 0, 0xa09078);
    put(ctx, "planksDark", boxUV(1.5, 0.08, 2.5, 1, 1), f, 0, 1.12, 0, 0, 0, 0.05);
    col.box(X - 7.6, 66.6, 1.5, 2.5, 0);
  }
  trough(ctx, X - 8.1, 52.5, Math.PI / 2);
  trough(ctx, X + 8.1, 56.0, Math.PI / 2);
  barrel(ctx, X + 8.0, 60.6, 1, true);
  barrel(ctx, X - 8.0, 55.2);
  for (let i = 0; i < 14; i++) bone(8.0 + (r() - 0.5) * 1.2, 67.0 + (r() - 0.5) * 1.2, r() * 6, 0.9 + r() * 0.4);
  skull(7.7, 66.4, 2.2);
  for (let i = 0; i < 10; i++) bone(-2 + r() * 6, 48 + r() * 20, r() * 6, 0.8 + r() * 0.4);
  {
    // a chopping block with a cleaver
    const f = F(-7.9, 60.8);
    put(ctx, "bark", new THREE.CylinderGeometry(0.45, 0.5, 0.8, 10), f, 0, 0.4, 0);
    put(ctx, "metal", new THREE.BoxGeometry(0.04, 0.3, 0.45), f, 0.05, 0.92, 0, 0, 0.3, 0.3, 0x8a8c90);
    put(ctx, "flat", new THREE.BoxGeometry(0.06, 0.06, 0.35), f, 0.05, 0.98, 0.35, 0, 0.3, 0.3, C.timber);
    col.circle(X - 7.9, 60.8, 0.55);
  }

  // ------------------------------------------------------------ the Kennelmaster's yard z 72..98
  floor(-12, 12, 72, 98, 0x9a9080);
  ceil(-12, 12, 72, 98, HY);
  wallSeg(-12, 72, -12, 98, HY + 0.8);
  wallSeg(12, 72, 12, 98, HY + 0.8);
  wallSeg(-12, 98, -3, 98, HY + 0.8);
  wallSeg(3, 98, 12, 98, HY + 0.8);
  lintel(0, 98, 6.8, 0.9, 5.8, HY + 0.8);
  for (let i = 0; i < 16; i++) strawPatch(-10 + r() * 20, 73.5 + r() * 23, 1.4 + r() * 2, 1.2 + r() * 1.8, r() * 3);
  // cages along both walls
  for (const s of [-1, 1])
    for (const cz of [77, 84, 91]) {
      const f = F(s * 10.45, cz, s < 0 ? Math.PI / 2 : -Math.PI / 2);
      // local +z points into the yard; the cage is 2.8 wide (local x) and 2.1 deep (local z)
      for (let i = 0; i <= 11; i++) put(ctx, "metal", new THREE.CylinderGeometry(0.035, 0.035, 2.2, 5), f, -1.4 + i * 0.255, 1.1, 1.0, 0, 0, 0, 0x3a3a3c, false);
      for (const ex of [-1.4, 1.4]) for (let j = 0; j < 7; j++) put(ctx, "metal", new THREE.CylinderGeometry(0.035, 0.035, 2.2, 5), f, ex, 1.1, -1.0 + j * 0.33, 0, 0, 0, 0x3a3a3c, false);
      put(ctx, "metal", new THREE.BoxGeometry(2.9, 0.08, 2.1), f, 0, 2.2, 0, 0, 0, 0, 0x2e2e30);
      put(ctx, "metal", new THREE.BoxGeometry(2.9, 0.1, 0.1), f, 0, 0.08, 1.0, 0, 0, 0, 0x2e2e30, false);
      put(ctx, "thatch", boxUV(2.6, 0.08, 1.8, 1.5, 1.5), f, 0, 0.04, 0, 0, 0, 0, 0xb8a070, false);
      col.box(X + s * 10.45, cz, 2.2, 2.9, 0);
      if (cz === 84) for (let i = 0; i < 4; i++) bone(s * (10.4 + (r() - 0.5)), cz + (r() - 0.5) * 2, r() * 6);
    }
  // the whipping post
  {
    const f = F(-6.5, 88.5, 0.3);
    put(ctx, "planksDark", boxUV(0.36, 2.8, 0.36, 1, 2), f, 0, 1.4, 0);
    put(ctx, "stoneDark", boxUV(0.9, 0.3, 0.9, 1, 1), f, 0, 0.15, 0);
    for (const y of [1.0, 2.2]) put(ctx, "metal", new THREE.TorusGeometry(0.13, 0.025, 4, 10), f, 0, y, 0.22, 0, 0, 0, 0x3a3a3a, false);
    put(ctx, "flat", new THREE.TorusGeometry(0.22, 0.03, 4, 14), f, 0.0, 1.65, 0.23, 0, 0, 0, 0x3a2418, false);
    put(ctx, "flat", new THREE.TorusGeometry(0.17, 0.03, 4, 14), f, 0.0, 1.62, 0.25, 0, 0.2, 0, 0x3a2418, false);
    col.circle(X - 6.5, 88.5, 0.4);
  }
  // the Kennelmaster's table, ledger and lamp
  {
    const f = F(7.0, 86, -0.08);
    put(ctx, "planks", boxUV(2.3, 0.12, 1.1, 1, 1), f, 0, 0.9, 0);
    for (const [lx, lz] of [[-1, -0.45], [1, -0.45], [-1, 0.45], [1, 0.45]]) put(ctx, "flat", new THREE.BoxGeometry(0.12, 0.88, 0.12), f, lx, 0.44, lz, 0, 0, 0, C.timber);
    put(ctx, "flat", new THREE.BoxGeometry(0.5, 0.08, 0.36), f, -0.4, 1.0, 0, 0, 0.2, 0, 0x6a2a24);
    put(ctx, "flat", new THREE.BoxGeometry(0.48, 0.02, 0.34), f, -0.4, 1.05, 0, 0, 0.2, 0, 0xd8ccb0);
    put(ctx, "metal", new THREE.CylinderGeometry(0.1, 0.12, 0.08, 8), f, 0.7, 1.0, 0.1, 0, 0, 0, 0x4a3a2a);
    put(ctx, "window", new THREE.BoxGeometry(0.14, 0.2, 0.14), f, 0.7, 1.15, 0.1);
    const p = f.at(0.7, 1.2, 0.1);
    glows.push({ x: p.x, y: p.y, z: p.z, size: 2.6, color: 0xffb060 });
    col.box(X + 7.0, 86, 2.4, 1.2, -0.08);
    const sf = F(7.0, 84.8);
    put(ctx, "planks", new THREE.CylinderGeometry(0.28, 0.28, 0.08, 10), sf, 0, 0.55, 0);
    for (const a of [0, 2.1, 4.2]) put(ctx, "flat", new THREE.BoxGeometry(0.06, 0.55, 0.06), sf, Math.cos(a) * 0.18, 0.27, Math.sin(a) * 0.18, 0, 0, 0, C.timber);
  }
  // a rack of leashes and catch-poles on the east wall
  {
    const f = F(11.5, 79.5, -Math.PI / 2);
    put(ctx, "planks", boxUV(2.4, 0.16, 0.16, 1, 1), f, 0, 2.3, 0.1);
    for (let i = 0; i < 5; i++) {
      put(ctx, "bark", new THREE.CylinderGeometry(0.04, 0.04, 2.2, 5), f, -0.9 + i * 0.45, 1.2, 0.2, 0.06, 0, 0.04);
      put(ctx, "flat", new THREE.TorusGeometry(0.14, 0.025, 4, 10), f, -0.9 + i * 0.45, 2.2, 0.25, 0, 0, 0, C.leather, false);
    }
  }
  hay(ctx, X - 8.6, 81.0, 0.3);
  hay(ctx, X - 8.4, 82.4, 1.4);
  barrel(ctx, X + 8.6, 94.6, 1, true);
  crate(ctx, X - 8.8, 95.2, 0.8, 0.4);
  crate(ctx, X - 8.0, 95.6, 0.6, 1.0);
  brazier(-7.8, 74.4);
  brazier(7.8, 74.4);
  brazier(-7.8, 93.0);
  sconce(-11.55, 87.5, Math.PI / 2, 3.8);
  sconce(11.55, 88.5, -Math.PI / 2, 3.8);
  // the bell by the inner gate
  const bell = new THREE.Group();
  {
    const f = F(3.8, 97.55, Math.PI);
    put(ctx, "metal", new THREE.BoxGeometry(0.12, 0.12, 0.85), f, 0, 3.25, 0.42, 0, 0, 0, 0x2e2e30);
    put(ctx, "metal", new THREE.BoxGeometry(0.1, 0.6, 0.1), f, 0, 2.95, 0.05, 0.6, 0, 0, 0x2e2e30);
    put(ctx, "flat", new THREE.CylinderGeometry(0.02, 0.02, 1.5, 4), f, 0.1, 1.9, 0.7, 0, 0, 0.05, 0xb59a70, false);
    const bm = new THREE.Mesh(
      new THREE.LatheGeometry([new THREE.Vector2(0.05, 0), new THREE.Vector2(0.17, 0.04), new THREE.Vector2(0.22, 0.28), new THREE.Vector2(0.33, 0.5), new THREE.Vector2(0.35, 0.55), new THREE.Vector2(0.0, 0.55)], 14),
      new THREE.MeshPhongMaterial({ color: 0xa8743a, shininess: 70, specular: 0x886644 }),
    );
    bm.rotation.x = Math.PI;
    bm.position.y = -0.02;
    bm.castShadow = true;
    bell.add(bm);
    bell.position.set(X + 3.8, 3.2, 96.7);
    root.add(bell);
  }
  // the bell gate
  const bellGate = new THREE.Group();
  {
    const wood: THREE.BufferGeometry[] = [];
    const iron: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 8; i++) wood.push(at(boxUV(0.74, 5.6, 0.22, 1, 2), -2.6 + i * 0.745, 2.8, 0, i % 2 ? 0x8a7a66 : 0x9a8a74));
    for (const y of [0.7, 2.6, 4.6]) iron.push(at(new THREE.BoxGeometry(6.1, 0.2, 0.3), 0, y, 0, 0x343436));
    for (let i = 0; i < 8; i++) for (const y of [0.7, 2.6, 4.6]) iron.push(at(new THREE.SphereGeometry(0.05, 5, 4), -2.6 + i * 0.745, y, -0.18, 0x5a5a5c));
    // a brass hound's head on the boss
    iron.push(at(new THREE.SphereGeometry(0.32, 10, 8), 0, 3.4, -0.2, C.brass, 0, 0, 0, 1, 1, 0.5));
    for (const s of [-1, 1]) iron.push(at(new THREE.ConeGeometry(0.12, 0.32, 5), s * 0.24, 3.72, -0.22, C.brass, 0, 0, s * 0.5));
    const w = new THREE.Mesh(merge(wood), M.planksDark);
    const ir = new THREE.Mesh(merge(iron), M.metal);
    w.castShadow = true;
    bellGate.add(w, ir);
    bellGate.position.set(X, env.flag("kennel_gate") ? 5.5 : 0, 98);
    root.add(bellGate);
    col.box(X, 98, 6.2, 0.8, 0, () => !env.flag("kennel_gate"));
  }

  // ------------------------------------------------------------ the way into the den z 98..100.6
  floor(-3, 3, 98, 101.2, 0x948a7c);
  ceil(-3, 3, 98.4, 100.8, 6.4);
  wallSeg(-3, 98.4, -3, 100.9, 6.8);
  wallSeg(3, 98.4, 3, 100.9, 6.8);

  // ------------------------------------------------------------ Boe's den: a round kennel-cave
  const A = ARENA;
  {
    // dirt floor with straw drifts
    const g = new THREE.RingGeometry(0.01, 17.6, 56, 14);
    g.rotateX(-Math.PI / 2);
    const c = new THREE.Color();
    const dirt = new THREE.Color(0x4a3a2a);
    const dark = new THREE.Color(0x2a2016);
    const straw = new THREE.Color(0x8a7648);
    tint(g, (x, _y, z) => c.copy(dirt).lerp(dark, fbm(x * 0.3 + 3, z * 0.3, 3) * 0.7).lerp(straw, Math.max(0, fbm(x * 0.45, z * 0.45 + 9, 2) - 0.6) * 2.2));
    put(ctx, "flat", g, F(A.x, A.z, 0, 0.005), 0, 0, 0, 0, 0, 0, 0xffffff, false);
    // the rough rock wall, inside out (three's cylinder: x = r sin θ, z = r cos θ; north θ = 0, south θ = π)
    const gap = Math.asin(3.2 / 16);
    for (const t0 of [gap, Math.PI + gap]) {
      const w = new THREE.CylinderGeometry(16, 16, 11.6, 44, 6, true, t0, Math.PI - 2 * gap);
      w.translate(0, 5.8, 0);
      const p = w.getAttribute("position");
      const uv = w.getAttribute("uv");
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i);
        const y = p.getY(i);
        const z = p.getZ(i);
        const a = Math.atan2(x, z);
        const k = 1 + fbm(a * 4 + 7, y * 0.35, 3) * 0.07 + noise2(a * 24, y * 1.3) * 0.008;
        p.setXYZ(i, x * k, y, z * k);
        uv.setXY(i, (a * 16) / 3, y / 3);
      }
      inward(w);
      const rock = new THREE.Color(0x6a6058);
      const moss = new THREE.Color(0x3c3a2a);
      const cc = new THREE.Color();
      tint(w, (x, y, z) => cc.copy(rock).lerp(moss, Math.max(0, fbm(x * 0.2, z * 0.2 + y * 0.3, 3) - 0.45) * 1.6).multiplyScalar(0.55 + Math.min(1, y / 5) * 0.45));
      put(ctx, "stoneDark", w, F(A.x, A.z), 0, 0, 0);
    }
    // the dome
    const dome = new THREE.SphereGeometry(17.4, 32, 9, 0, Math.PI * 2, 0, Math.PI / 2);
    dome.scale(1, 0.42, 1);
    {
      const p = dome.getAttribute("position");
      for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) - fbm(p.getX(i) * 0.25, p.getZ(i) * 0.25, 2) * 1.2);
      const uv = dome.getAttribute("uv");
      for (let i = 0; i < uv.count; i++) uv.setXY(i, p.getX(i) / 3, p.getZ(i) / 3);
    }
    inward(dome);
    tint(dome, 0x5a5048);
    put(ctx, "stoneDark", dome, F(A.x, A.z, 0, 11.2), 0, 0, 0, 0, 0, 0, 0xffffff, false);
  }
  // the ring of colliders around the den (inner face ~15.9; the floor inside r 14 stays clear)
  {
    const gap = Math.asin(3.4 / RING);
    const arcs: [number, number][] = [[-Math.PI / 2 + gap, Math.PI / 2 - gap], [Math.PI / 2 + gap, (3 * Math.PI) / 2 - gap]];
    for (const [a0, a1] of arcs) {
      const n = Math.ceil((a1 - a0) / 0.26);
      for (let k = 0; k < n; k++) {
        const s0 = a0 + ((a1 - a0) * k) / n;
        const s1 = a0 + ((a1 - a0) * (k + 1)) / n;
        const mid = (s0 + s1) / 2;
        const x0 = A.x + Math.cos(s0) * RING;
        const z0 = A.z + Math.sin(s0) * RING;
        const x1 = A.x + Math.cos(s1) * RING;
        const z1 = A.z + Math.sin(s1) * RING;
        col.box(X + (x0 + x1) / 2, (z0 + z1) / 2, Math.hypot(x1 - x0, z1 - z0) + 0.2, 1.6, -mid + Math.PI / 2);
      }
    }
    // lintels over the two ways in and out
    lintel(0, A.z - 16.2, 7.2, 2.4, 6.5, 11.8);
    lintel(0, A.z + 16.2, 7.2, 2.4, 6.7, 11.8);
  }
  // roots through the walls: some down to the floor (outside r 14), most up under the dome
  {
    const gapAngles = [-Math.PI / 2, Math.PI / 2];
    let placed = 0;
    for (let i = 0; placed < 11 && i < 40; i++) {
      const a = r() * Math.PI * 2;
      if (gapAngles.some((g) => Math.abs(Math.atan2(Math.sin(a - g), Math.cos(a - g))) < 0.4)) continue;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      const w = (rad: number, y: number) => new THREE.Vector3(X + A.x + ca * rad, y, A.z + sa * rad);
      const pts = placed % 3 === 0
        ? [w(17.0, 9.6), w(15.6, 8.4), w(15.0, 5.2), w(15.1, 2.2), w(15.8, -0.3)]
        : [w(17.0, 6 + r() * 3), w(14.8, 9.4 + r()), w(11 - r() * 3, 12.6), w(7 - r() * 3, 15.2)];
      batch.add("bark", M.bark, rootGeo(pts, 0.28 + r() * 0.22));
      placed++;
    }
    // root tendrils hanging from the dome
    for (let i = 0; i < 14; i++) {
      const a = r() * Math.PI * 2;
      const d = 4 + r() * 9;
      const len = 1.2 + r() * 2.4;
      const top = 11.2 + 7.3 * Math.sqrt(Math.max(0, 1 - (d / 17.4) ** 2)) - 1.0;
      put(ctx, "bark", new THREE.CylinderGeometry(0.03, 0.09, len, 5), F(A.x + Math.cos(a) * d, A.z + Math.sin(a) * d), 0, top - len / 2, 0, (r() - 0.5) * 0.2, 0, (r() - 0.5) * 0.2, 0xb0a088, false);
    }
  }
  // what a big dog leaves lying about: bones, skulls, collars, a chewed ball, his straw bed
  for (let i = 0; i < 40; i++) {
    const a = r() * Math.PI * 2;
    const d = 2.5 + r() * 11;
    bone(A.x + Math.cos(a) * d, A.z + Math.sin(a) * d, r() * 6, 0.8 + r() * 0.8);
  }
  for (let i = 0; i < 5; i++) {
    const a = r() * Math.PI * 2;
    const d = 6 + r() * 7;
    skull(A.x + Math.cos(a) * d, A.z + Math.sin(a) * d, r() * 6, 1 + r() * 0.3);
  }
  for (let i = 0; i < 6; i++) {
    const a = r() * Math.PI * 2;
    const d = 4 + r() * 9;
    put(ctx, "flat", new THREE.TorusGeometry(0.17, 0.035, 5, 12), F(A.x + Math.cos(a) * d, A.z + Math.sin(a) * d), 0, 0.04, 0, Math.PI / 2, 0, 0, i === 0 ? C.red : C.leather, false);
  }
  {
    const g = new THREE.SphereGeometry(0.3, 12, 9);
    const p = g.getAttribute("position");
    for (let i = 0; i < p.count; i++) {
      const dent = 1 - Math.max(0, noise2(p.getX(i) * 9 + 3, p.getY(i) * 9 + p.getZ(i) * 5) - 0.7) * 0.6;
      p.setXYZ(i, p.getX(i) * dent, p.getY(i) * dent, p.getZ(i) * dent);
    }
    g.computeVertexNormals();
    put(ctx, "flat", g, F(A.x + 4.6, A.z - 5.6), 0, 0.28, 0, 0.4, 0.2, 0, 0x9a3a30);
    put(ctx, "thatch", new THREE.CylinderGeometry(2.7, 3.0, 0.28, 18), F(A.x - 1.2, A.z + 9.6), 0, 0.12, 0, 0, 0, 0, 0xb8a070, false);
    put(ctx, "flat", new THREE.TorusGeometry(0.5, 0.08, 6, 18), F(A.x + 1.0, A.z + 8.4), 0, 0.09, 0, Math.PI / 2, 0, 0.1, C.red, false);
  }
  for (const a of [-1.0, -0.2, 0.55, Math.PI - 0.55, Math.PI + 0.2, Math.PI + 1.0]) {
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    // mount it on the rough wall where it actually is at that height
    const rw = 16 * (1 + fbm(Math.atan2(ca, sa) * 4 + 7, 3.8 * 0.35, 3) * 0.07) - 0.05;
    sconce(A.x + ca * rw, A.z + sa * rw, Math.atan2(-ca, -sa), 3.8);
  }
  // the way out north, and its gate
  floor(-3, 3, 131, 136.4, 0x948a7c);
  ceil(-3, 3, 131.8, 136.4, 6.7);
  wallSeg(-3, 131.4, -3, 136.4, 6.8);
  wallSeg(3, 131.4, 3, 136.4, 6.8);
  wallSeg(-3, 136.4, 3, 136.4, 6.8);
  {
    const day = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 5.6), new THREE.MeshBasicMaterial({ color: 0x7c8a90 }));
    day.position.set(X, 2.8, 135.9);
    day.rotation.y = Math.PI;
    root.add(day);
    glows.push({ x: X, y: 2.6, z: 135.2, size: 8, color: 0xb0c0d0 });
  }
  const exitGate = new THREE.Group();
  {
    const wood: THREE.BufferGeometry[] = [];
    const iron: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 8; i++) wood.push(at(boxUV(0.74, 6.0, 0.24, 1, 2), -2.6 + i * 0.745, 3.0, 0, i % 2 ? 0x7a6a58 : 0x8a7a66));
    for (const y of [0.8, 3.0, 5.2]) iron.push(at(new THREE.BoxGeometry(6.1, 0.22, 0.32), 0, y, 0, 0x343436));
    for (let i = 0; i < 6; i++) iron.push(at(new THREE.ConeGeometry(0.08, 0.3, 5), -2.5 + i, -0.1, 0, 0x4a4a4c, Math.PI, 0, 0));
    const w = new THREE.Mesh(merge(wood), M.planksDark);
    w.castShadow = true;
    exitGate.add(w, new THREE.Mesh(merge(iron), M.metal));
    exitGate.position.set(X, env.flag("boe") ? 6.2 : 0, 133.8);
    root.add(exitGate);
    col.box(X, 133.8, 6.2, 0.8, 0, () => !env.flag("boe"));
  }

  // ------------------------------------------------------------ finish
  if (bannerGeos.length) {
    const g = merge(bannerGeos);
    const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ map: bannerTex(), side: THREE.DoubleSide, vertexColors: true }));
    root.add(m);
  }
  batch.build(root);
  const nodes = zoneNodes(M, root, col, "kennel", () => 0);

  // ------------------------------------------------------------ puzzles, traps and doors
  let lastT = 0;
  let bellCheckAt = -1;
  let bellSwing = 0;
  let boardsFall = 0;
  let platesAsk = -10;
  let platesWere = env.flag("kennel_plates");
  let logCycleHit = -1;
  let logCueCycle = -1;
  let logWhooshCycle = -1;
  let grind = 0;
  let cartMoveT = 0;
  const lastMe = { x: 0, z: 0 };

  /** the log's angle at time t, how far into its tell it is, and whether it is sweeping */
  const logState = (t: number) => {
    const c = Math.floor(t / LOG_CYCLE);
    const f = t - c * LOG_CYCLE;
    const side = c % 2 === 0 ? 1 : -1;
    if (f < 1.8) return { th: side * (1.1 + 0.14 * Math.max(0, 1 - f / 0.35) + Math.sin(t * 2.1) * 0.015), tell: 0, sweep: false, c, side, k: 0 };
    if (f < 2.4) {
      const k = (f - 1.8) / 0.6;
      return { th: side * (1.1 + 0.14 * Math.sin(k * Math.PI * 0.5)) + Math.sin(t * 55) * 0.025 * k, tell: k, sweep: false, c, side, k: 0 };
    }
    const k = (f - 2.4) / 0.6;
    return { th: side * 1.24 * Math.cos(Math.PI * k), tell: 1, sweep: true, c, side, k };
  };

  const interacts: ZoneInteract[] = [
    {
      x: X + 3.1, z: 30, r: 1.9,
      label: () => (boardsOpen ? null : "Loose boards"),
      act: () => {
        if (boardsOpen) return;
        boardsOpen = true;
        boardsFall = 0;
        env.audio.thud();
        env.shake(0.12);
        env.say("The boards give. A draught, and a narrow way behind them.");
      },
    },
    {
      x: X + 2, z: 96, r: 2.0,
      label: () => (env.flag("kennel_gate") ? null : "Ring the kennel bell"),
      act: () => {
        env.audio.bell(0.35, 294);
        bellSwing = 2.6;
        env.setFlag("kennel_gate");
        bellCheckAt = lastT + 1.1;
      },
    },
  ];

  const update = (dt: number, t: number) => {
    lastT = t;
    const ps = env.players();
    const me: PlayerState | undefined = ps[0];
    const here = !!me && me.zone === "kennel" && !me.dead;

    // marked plates: a sink, a red glow for 0.6 s, then spikes for whoever is still on it
    for (const tp of traps) {
      tp.cd = Math.max(0, tp.cd - dt);
      const on = here && Math.abs(me!.x - tp.x) < 0.72 && Math.abs(me!.z - tp.z) < 0.72;
      if (tp.arm < 0 && on && tp.cd <= 0) {
        tp.arm = 0;
        env.audio.clack();
      }
      if (tp.arm >= 0) {
        tp.arm += dt;
        const k = Math.min(1, tp.arm / 0.6);
        const pulse = 0.55 + 0.45 * Math.sin(tp.arm * 38);
        tp.mat.emissive.setRGB((0.25 + 0.55 * k) * pulse, 0.03, 0.02);
        tp.mesh.position.y = 0.03 - Math.min(1, tp.arm / 0.12) * 0.07;
        if (tp.arm >= 0.6) {
          if (here && Math.abs(me!.x - tp.x) < 0.8 && Math.abs(me!.z - tp.z) < 0.8) {
            env.hurt(14, tp.x, tp.z);
            env.shake(0.15);
          }
          env.audio.block();
          spikes.position.set(tp.x, -0.6, tp.z);
          spikes.visible = true;
          spikeT = 0.5;
          tp.arm = -1;
          tp.cd = 1.4;
        }
      } else {
        tp.mat.emissive.multiplyScalar(Math.max(0, 1 - dt * 4));
        tp.mesh.position.y += (0.03 - tp.mesh.position.y) * Math.min(1, dt * 6);
      }
    }
    if (spikeT > 0) {
      spikeT -= dt;
      const up = spikeT > 0.35 ? (0.5 - spikeT) / 0.15 : spikeT / 0.35;
      spikes.position.y = -0.62 + Math.max(0, Math.min(1, up)) * 0.6;
      if (spikeT <= 0) spikes.visible = false;
    }

    // the swinging log: it winds back (shudder, red floor), then sweeps through on a 3 s cycle
    {
      const s = logState(t);
      logPivot.rotation.x = s.th;
      const glow = s.sweep ? 1 - s.k * 0.6 : s.tell;
      bandMat.emissive.setRGB(0.6 * glow, 0.06 * glow, 0.03 * glow);
      const near = here && Math.abs(me!.z - LOG_Z) < 24 && Math.abs(me!.x - X) < 18;
      if (s.tell > 0 && !s.sweep && logCueCycle !== s.c) {
        logCueCycle = s.c;
        if (near) env.audio.squeak();
      }
      if (s.sweep && s.k > 0.4 && logWhooshCycle !== s.c) {
        logWhooshCycle = s.c;
        if (near) env.audio.swing(true);
      }
      if (s.sweep && Math.abs(s.th) < 0.55 && here && logCycleHit !== s.c) {
        const lz = LOG_Z - LOG_LEN * Math.sin(s.th);
        if (Math.abs(me!.x - X) < 3.9 && Math.abs(me!.z - lz) < 1.0) {
          logCycleHit = s.c;
          env.hurt(18, me!.x, me!.z - s.side * 1.5);
          env.shake(0.3);
          env.audio.thud();
        }
      }
    }

    // the loose boards topple into the run
    if (boardsOpen && boards.visible) {
      boardsFall = Math.min(1, boardsFall + dt * 2.2);
      boards.rotation.z = 1.5 * boardsFall * boardsFall;
      if (boardsFall >= 1 && boards.position.y === 0) {
        boards.position.y = 0.04;
        env.audio.clack();
      }
    }

    // the feed cart: walk into it to shove it along its rail
    if (here) {
      const dx = cartCol.x - me!.x;
      const dz = cartCol.z - me!.z;
      const d = Math.hypot(dx, dz);
      if (d < CART_R + 0.42 + 0.2 && d > 1e-3) {
        const nx = dx / d;
        const nz = dz / d;
        const mv = me as PlayerState & { vx?: unknown; vz?: unknown };
        let vx = 0;
        let vz = 0;
        if (typeof mv.vx === "number" && typeof mv.vz === "number") {
          vx = mv.vx;
          vz = mv.vz;
        } else if (dt > 0) {
          // no input velocity to read: use the way the player faces while pressed against it
          const moved = Math.hypot(me!.x - lastMe.x, me!.z - lastMe.z) / dt;
          vx = Math.sin(me!.yaw) * Math.max(moved, 1.5);
          vz = Math.cos(me!.yaw) * Math.max(moved, 1.5);
        }
        const toward = vx * nx + vz * nz;
        const along = vx * ux + vz * uz;
        if (toward > 0.4 && Math.abs(nx * ux + nz * uz) > 0.45 && Math.abs(along) > 0.2) {
          const before = cartS;
          cartS = Math.max(0, Math.min(1, cartS + (along * 0.55 * dt) / railLen));
          if (cartS !== before) {
            placeCart();
            cartMoveT = 0.15;
            grind += Math.abs(cartS - before) * railLen;
            if (grind > 0.6) {
              grind = 0;
              env.audio.clack();
            }
            if (before < 1 && cartS >= 1) {
              env.audio.thud();
              env.shake(0.12);
            }
          }
        }
      }
      lastMe.x = me!.x;
      lastMe.z = me!.z;
    }
    cartMoveT = Math.max(0, cartMoveT - dt);
    cart.position.y = cartMoveT > 0 ? Math.abs(Math.sin(t * 31)) * 0.012 : 0;

    // the plates: a player (anyone here) or the cart on each; both at once lifts the portcullis
    const cp = cartPos(cartS);
    const pressed = PLATES.map(([lx, lz]) => {
      const px = X + lx;
      if (Math.hypot(cp.x - px, cp.z - lz) < 0.75) return true;
      for (const q of ps) if (q.zone === "kennel" && !q.dead && Math.hypot(q.x - px, q.z - lz) < PLATE_R) return true;
      return false;
    });
    const open = env.flag("kennel_plates");
    pressed.forEach((p, i) => {
      const m = plateMeshes[i];
      m.position.y += ((p || open ? -0.03 : 0.07) - m.position.y) * Math.min(1, dt * 8);
      lampMats[i].color.setHex(p || open ? 0xff8a3a : 0x2a1a10);
    });
    if (pressed[0] && pressed[1] && !open && t - platesAsk > 2) {
      platesAsk = t;
      env.setFlag("kennel_plates");
    }
    if (env.flag("kennel_plates") && !platesWere) {
      env.audio.thud();
      env.shake(0.25);
      if (here) env.say("Both plates sink. The chains run tight and the portcullis grinds up.");
    }
    platesWere = env.flag("kennel_plates");

    // doors follow their flags
    const lift = (o: THREE.Object3D, up: boolean, h: number, speed: number) => {
      o.position.y += ((up ? h : 0) - o.position.y) * Math.min(1, dt * speed);
    };
    lift(portcullis, env.flag("kennel_plates"), 5.0, 1.4);
    lift(bellGate, env.flag("kennel_gate"), 5.5, 1.1);
    lift(exitGate, env.flag("boe"), 6.2, 1.0);

    // the bell, and the answer if the gate stays shut
    if (bellSwing > 0) {
      bellSwing = Math.max(0, bellSwing - dt);
      bell.rotation.x = Math.sin(bellSwing * 13) * 0.4 * (bellSwing / 2.6);
    }
    if (bellCheckAt > 0 && t >= bellCheckAt) {
      bellCheckAt = -1;
      if (!env.flag("kennel_gate")) env.say("The gate will not lift while the Kennelmaster lives.");
    }
  };

  const regionAt = (x: number, z: number) => {
    const lx = x - X;
    if (lx > 4.4 && z > 26 && z < 38) return "trap_run";
    if (z < 20) return "kennel_hall";
    if (z < 46) return "trap_run";
    if (z < 71) return "feeding_room";
    if (z < 99) return "kennel_yard";
    return "boe_den";
  };
  const regions: Record<string, [string, string]> = {
    kennel_hall: ["The Kennel Hall", "Collars on hooks. The names have worn off."],
    trap_run: ["The Hound Run", "Mind the marked stones"],
    feeding_room: ["The Feeding Room", "Two plates, one heavy cart"],
    kennel_yard: ["The Kennelmaster's Yard", "Straw, cages and a whipping post"],
    boe_den: ["Boe's Den", "He wags. The collar glows."],
  };
  const surfaceAt = (x: number, z: number): "wood" | "stone" | "dirt" | "grass" => (z > 100.5 && z < 131.5 ? "dirt" : z > 72 && z < 98 ? "dirt" : "stone");
  const ceiling = (x: number, z: number) => {
    const lx = x - X;
    if (z > 100.6 && z < 131.6) return 10.5;
    if (z >= 131.6) return 6.0;
    if (z >= 72 && z < 98) return 7.4;
    if (lx > 4.4 && z > 26 && z < 38) return 3.1;
    if (z < -0.6) return 3.8;
    return 6.4;
  };
  const anchors: Record<string, THREE.Vector3> = {
    entry: new THREE.Vector3(X, 0, 4),
    exit: new THREE.Vector3(X, 0, 2),
    hall: new THREE.Vector3(X, 0, 10),
    trapRun: new THREE.Vector3(X, 0, 22),
    log: new THREE.Vector3(X, 0, LOG_Z),
    boards: new THREE.Vector3(X + 3.1, 0, 30),
    secret: new THREE.Vector3(X + 14, 0, 32),
    cartHome: new THREE.Vector3(X + RAIL_A.x, 0, RAIL_A.z),
    plateA: new THREE.Vector3(X + PLATES[0][0], 0, PLATES[0][1]),
    plateB: new THREE.Vector3(X + PLATES[1][0], 0, PLATES[1][1]),
    portcullis: new THREE.Vector3(X, 0, 68.8),
    yard: new THREE.Vector3(X, 0, 80),
    bell: new THREE.Vector3(X + 2, 0, 96),
    bellGate: new THREE.Vector3(X, 0, 96.6),
    arena: new THREE.Vector3(X + A.x, 0, A.z),
    arenaEntry: new THREE.Vector3(X + A.x, 0, A.z - A.r + 2.5),
    exitGate: new THREE.Vector3(X, 0, 130.5),
  };
  // the cart's own position object: it moves with the cart (for a quest arrow)
  anchors.cart = cart.position;

  return {
    root,
    groundAt: () => 0,
    surfaceAt,
    regionAt,
    regions,
    ceiling,
    fires,
    lamps,
    glows,
    smoke,
    nodes,
    anchors,
    interacts,
    update,
  };
}
