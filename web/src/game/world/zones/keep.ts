import * as THREE from "three";
import { Batch, boxUV, merge, place, prep, rockGeo, tint, treeGeo } from "../../engine/kit";
import { fbm, noise2, rng } from "../../engine/noise";
import { ZONES } from "../../data/zones.ts";
import { BOSSES } from "../../data/bosses.ts";
import { zoneNodes } from "../nodes";
import { Frame, barrel, crate, put, sack, type Ctx, type Glow } from "../props";
import type { ZoneBuild, ZoneEnv, ZoneInteract } from "../zone";

/**
 * The Black Keep: black stone, rain, iron. Rooms run north along +z like the kennels:
 * the gatehouse (a winch for the inner portcullis), the outer bailey, the wide courtyard with
 * the barracks west and the barred armoury east (black iron, the crypt chain), the crypt below
 * the courtyard (a short stair down, tombs, the big tomb at the far end, a stair up), the throne
 * room with its empty throne, and behind the throne the broken ring high on the keep where
 * Finlay waits. Courtyards and the ring are open to a grey sky and it rains there.
 * World coordinates throughout (x = ox + local x). Floors are y = 0, except the crypt, which is
 * sunk to CRYPT_Y between walled stairs (groundAt follows the stairs; walls fence them).
 */

const Z = ZONES.keep;
const X = Z.ox;
const ARENA = { x: BOSSES.finlay.x, z: BOSSES.finlay.z, r: BOSSES.finlay.r };
/** the parapet's collider ring (inner face ~17.8, so r 16 stays clear) */
const RING = 18.4;
const CRYPT_Y = -1.2;
/** crypt stairs: down from the courtyard (z 57..60.6), up into the throne room (east channel z 76..85.4) */
const STAIR_DOWN = { z0: 57, z1: 60.6, hw: 2.6 };
const STAIR_UP = { x0: 5.2, x1: 9.0, z0: 76, z1: 85.4 };
const WINCH = { x: -4, z: 10 };
const ARM_DOOR = { x: 20, z: 40 };
const LEVER = { x: 34.6, z: 40 };
/** gaps in the parapet, as angles about the arena centre (0 = +x, π/2 = +z) */
const GAPS = [0.22, 1.42, 2.62];
const GAP_HALF = 0.11;

const C = {
  black: 0x3a3a40,
  blacker: 0x26262c,
  wet: 0x2e3034,
  iron: 0x2e2e32,
  timber: 0x2e2620,
  bone: 0xc8bea4,
  candle: 0xe8dcc0,
  red: 0x4a1a1a,
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

/** The Keep's banner: black cloth, a grey tower under a broken crown, a ragged foot. */
const keepBannerTex = () =>
  paintTex("keep_banner", 128, 256, (g, w, h) => {
    const r = rng(33);
    g.fillStyle = "#141418";
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 500; i++) {
      const v = 12 + r() * 22;
      g.fillStyle = `rgba(${v},${v},${v + 4},0.5)`;
      g.fillRect(r() * w, r() * h, 1 + r() * 2, 2 + r() * 6);
    }
    g.strokeStyle = "#5a5a60";
    g.lineWidth = 3;
    g.strokeRect(8, 8, w - 16, h * 0.8);
    g.fillStyle = "#6a6a70";
    g.fillRect(w / 2 - 16, h * 0.32, 32, 62);
    for (let i = 0; i < 3; i++) g.fillRect(w / 2 - 16 + i * 12, h * 0.32 - 10, 8, 10);
    g.fillStyle = "#141418";
    g.fillRect(w / 2 - 5, h * 0.32 + 34, 10, 28);
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
    g.globalCompositeOperation = "destination-out";
    g.beginPath();
    g.moveTo(0, h);
    for (let x = 0; x <= w; x += 8) g.lineTo(x, h - 10 - r() * 34);
    g.lineTo(w, h);
    g.closePath();
    g.fill();
  });

/** Places (rotation, then translation, optional scale) and tints a geometry, ready to merge. */
function at(geo: THREE.BufferGeometry, x: number, y: number, z: number, color: THREE.ColorRepresentation, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) {
  place(geo, x, y, z, rx, ry, rz, sx, sy, sz);
  return tint(geo, color);
}

/** Turn a surface inside out (for domes seen from within): swap winding, renormal. */
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

/** Ground height at a local point: 0 everywhere but the crypt and its two stairs. */
function floorLocal(x: number, z: number) {
  if (Math.abs(x) < STAIR_DOWN.hw + 0.4 && z > STAIR_DOWN.z0 && z <= STAIR_DOWN.z1) return (CRYPT_Y * (z - STAIR_DOWN.z0)) / (STAIR_DOWN.z1 - STAIR_DOWN.z0);
  if (z > STAIR_DOWN.z1 && z < STAIR_UP.z1 && Math.abs(x) < 9.6) {
    if (x > STAIR_UP.x0 && z > STAIR_UP.z0) return CRYPT_Y * (1 - (z - STAIR_UP.z0) / (STAIR_UP.z1 - STAIR_UP.z0));
    return CRYPT_Y;
  }
  return 0;
}

export function buildKeep(env: ZoneEnv): ZoneBuild {
  const { M, col } = env;
  const root = new THREE.Group();
  root.name = "keep";
  const batch = new Batch();
  const glows: Glow[] = [];
  const fires: THREE.Vector3[] = [];
  const lamps: THREE.Vector3[] = [];
  const smoke: THREE.Vector3[] = [];
  const groundAt = (x: number, z: number) => floorLocal(x - X, z);
  const ctx: Ctx = { batch, M, col, h: groundAt, glows, smoke, fires, lamps };
  const r = rng(1414);
  const F = (x: number, z: number, rot = 0, y = 0) => new Frame(X + x, y, z, rot);
  const bannerGeos: THREE.BufferGeometry[] = [];

  // ------------------------------------------------------------ building kit
  const floor = (x0: number, x1: number, z0: number, z1: number, color = 0x5a5a60, y = 0) => {
    put(ctx, "flagstone", boxUV(x1 - x0, 0.4, z1 - z0, 3, 3), F((x0 + x1) / 2, (z0 + z1) / 2, 0, y), 0, -0.2, 0, 0, 0, 0, color, false);
  };
  const ceil = (x0: number, x1: number, z0: number, z1: number, h: number) => {
    put(ctx, "stoneDark", boxUV(x1 - x0 + 1, 0.6, z1 - z0 + 1, 3, 3), F((x0 + x1) / 2, (z0 + z1) / 2, 0, h), 0, 0.3, 0, 0, 0, 0, 0x2a2a30, false);
    for (let z = z0 + 2; z < z1 - 0.5; z += 4) put(ctx, "stoneDark", boxUV(x1 - x0, 0.5, 0.6, 2, 1), F((x0 + x1) / 2, z, 0, h), 0, -0.25, 0, 0, 0, 0, 0x34343a, false);
  };
  /** A wall from local (x0,z0) to (x1,z1): a black plinth, black stone, crenels when it meets the sky. */
  const wall = (x0: number, z0: number, x1: number, z1: number, h: number, o: { y0?: number; crenel?: boolean; on?: () => boolean; t?: number } = {}) => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    if (len < 0.05) return;
    const y0 = o.y0 ?? 0;
    const t = o.t ?? 1.0;
    const rot = Math.atan2(x1 - x0, z1 - z0) - Math.PI / 2;
    const cx = (x0 + x1) / 2;
    const cz = (z0 + z1) / 2;
    const f = F(cx, cz, rot, y0);
    put(ctx, "stoneDark", boxUV(len + 0.02, 1.0, t + 0.12, 2, 1), f, 0, 0.5, 0, 0, 0, 0, C.blacker);
    put(ctx, "stoneDark", boxUV(len, h - 1.0, t, 2.6, 2.6), f, 0, 1.0 + (h - 1.0) / 2, 0, 0, 0, 0, C.black);
    // a wet streak band at mid height and a string course
    put(ctx, "stoneDark", boxUV(len + 0.02, 0.22, t + 0.14, 2, 1), f, 0, Math.min(h - 0.4, 4.2), 0, 0, 0, 0, 0x202024);
    if (o.crenel) {
      const n = Math.max(1, Math.floor(len / 2.2));
      for (let k = 0; k < n; k++) put(ctx, "stoneDark", boxUV(1.1, 1.2, t, 1, 1), f, -len / 2 + (len / n) * (k + 0.5), h + 0.6, 0, 0, 0, 0, C.black);
    }
    col.box(X + cx, cz, len, t, rot, o.on);
  };
  const lintel = (x: number, z: number, w: number, d: number, y0: number, y1: number) => {
    put(ctx, "stoneDark", boxUV(w, y1 - y0, d, 2.6, 2.6), F(x, z), 0, (y0 + y1) / 2, 0, 0, 0, 0, C.black);
    put(ctx, "stoneGrey", boxUV(w + 0.1, 0.4, d + 0.08, 2, 1), F(x, z), 0, y0 + 0.2, 0, 0, 0, 0, 0x4a4a50);
  };
  const brazier = (x: number, z: number, y = 0, colliders = true) => {
    const f = F(x, z, 0, y);
    put(ctx, "metal", new THREE.CylinderGeometry(0.6, 0.32, 0.5, 10), f, 0, 1.15, 0, 0, 0, 0, 0x3a2e24);
    for (const a of [0, 2.1, 4.2]) put(ctx, "metal", new THREE.BoxGeometry(0.07, 1.0, 0.07), f, Math.cos(a) * 0.3, 0.5, Math.sin(a) * 0.3, Math.sin(a) * 0.3, 0, Math.cos(a) * 0.3, 0x2a2a2a);
    put(ctx, "ember", new THREE.ConeGeometry(0.45, 0.4, 7), f, 0, 1.45, 0, 0, 0, 0, 0xffffff, false);
    const p = f.at(0, 1.8, 0);
    fires.push(p);
    glows.push({ x: p.x, y: p.y + 0.1, z: p.z, size: 6.5, color: 0xff7a30 });
    smoke.push(f.at(0, 2.2, 0));
    if (colliders) col.circle(X + x, z, 0.62);
  };
  /** An iron cage lantern on a wall bracket; `face` turns its front (local +z) into the room. */
  const sconce = (x: number, z: number, face: number, y = 3.4) => {
    const f = F(x, z, face);
    put(ctx, "metal", new THREE.BoxGeometry(0.1, 0.5, 0.4), f, 0, y, 0.15, 0, 0, 0, 0x2a2a2a);
    put(ctx, "metal", new THREE.CylinderGeometry(0.15, 0.09, 0.16, 6), f, 0, y + 0.28, 0.38, 0, 0, 0, 0x262626);
    put(ctx, "ember", new THREE.ConeGeometry(0.11, 0.28, 6), f, 0, y + 0.47, 0.38, 0, 0, 0, 0xffffff, false);
    const p = f.at(0, y + 0.55, 0.38);
    glows.push({ x: p.x, y: p.y, z: p.z, size: 3.8, color: 0xff9a48 });
    fires.push(p);
  };
  const candles = (x: number, z: number, y: number, n = 5, spread = 0.5) => {
    const f = F(x, z, r() * 6, y);
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + r();
      const d = r() * spread;
      const ch = 0.12 + r() * 0.22;
      put(ctx, "flat", new THREE.CylinderGeometry(0.035, 0.045, ch, 6), f, Math.cos(a) * d, ch / 2, Math.sin(a) * d, 0, 0, 0, C.candle, false);
      put(ctx, "flat", new THREE.CylinderGeometry(0.06, 0.07, 0.03, 6), f, Math.cos(a) * d, 0.015, Math.sin(a) * d, 0, 0, 0, 0xd8ccb0, false);
    }
    const p = f.at(0, 0.4, 0);
    glows.push({ x: p.x, y: p.y, z: p.z, size: 2.0 + n * 0.15, color: 0xffc070 });
    fires.push(p);
  };
  /** A black banner on a wall: `face` turns it into the room. */
  const banner = (x: number, z: number, face: number, y: number, w = 1.6, h = 4.2) => {
    const g = new THREE.PlaneGeometry(w, h, 1, 4);
    const p = g.getAttribute("position");
    for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getY(i) * 1.4 + x + z) * 0.05);
    g.computeVertexNormals();
    place(g, 0, 0, 0.1, 0, 0, 0);
    place(g, X + x, y, z, 0, face, 0);
    bannerGeos.push(tint(g, 0xffffff));
    put(ctx, "flat", new THREE.CylinderGeometry(0.04, 0.04, w + 0.4, 5), F(x, z, face), 0, y + h / 2 + 0.05, 0.12, 0, 0, Math.PI / 2, C.timber, false);
    for (const s of [-1, 1]) put(ctx, "metal", new THREE.SphereGeometry(0.07, 6, 4), F(x, z, face), s * (w / 2 + 0.2), y + h / 2 + 0.05, 0.12, 0, 0, 0, 0x6a6a70, false);
  };
  const rack = (x: number, z: number, rot: number) => {
    const f = F(x, z, rot);
    put(ctx, "planksDark", boxUV(2.2, 0.12, 0.5, 1, 1), f, 0, 0.3, 0, 0, 0, 0, 0x5a4a3a);
    put(ctx, "planksDark", boxUV(2.2, 0.1, 0.18, 1, 1), f, 0, 1.6, -0.12, 0, 0, 0, 0x5a4a3a);
    for (const s of [-1, 1]) put(ctx, "flat", new THREE.BoxGeometry(0.12, 1.8, 0.12), f, s * 1.05, 0.9, -0.15, 0, 0, 0, C.timber);
    for (let k = 0; k < 6; k++) {
      const kind = (k + Math.floor(x)) % 3;
      if (kind === 0) {
        put(ctx, "flat", new THREE.CylinderGeometry(0.025, 0.025, 2.0, 5), f, -0.85 + k * 0.34, 1.05, -0.05, -0.12, 0, 0, 0x4a3a2a, false);
        put(ctx, "metal", new THREE.ConeGeometry(0.05, 0.28, 4), f, -0.85 + k * 0.34, 2.15, -0.18, -0.12, 0, 0, 0x3a3a3e, false);
      } else {
        put(ctx, "metal", new THREE.BoxGeometry(0.06, 1.1, 0.02), f, -0.85 + k * 0.34, 0.95, -0.06, -0.1, 0, 0, 0x4a4a50, false);
        put(ctx, "flat", new THREE.BoxGeometry(0.26, 0.05, 0.05), f, -0.85 + k * 0.34, 0.42, -0.0, -0.1, 0, 0, 0x2a2a2a, false);
      }
    }
    col.box(X + x, z, 2.3, 0.7, rot);
  };
  /** An armour stand: black plate on a cross of timber. */
  const armourStand = (x: number, z: number, rot: number) => {
    const f = F(x, z, rot);
    put(ctx, "flat", new THREE.BoxGeometry(0.1, 1.6, 0.1), f, 0, 0.8, 0, 0, 0, 0, C.timber);
    put(ctx, "flat", new THREE.BoxGeometry(0.6, 0.08, 0.3), f, 0, 0.04, 0, 0, 0, 0, C.timber);
    const chest = new THREE.SphereGeometry(0.28, 10, 8);
    chest.scale(1.1, 1.3, 0.7);
    put(ctx, "metal", chest, f, 0, 1.35, 0, 0, 0, 0, 0x2a2a30);
    for (const s of [-1, 1]) put(ctx, "metal", new THREE.SphereGeometry(0.15, 8, 6), f, s * 0.32, 1.6, 0, 0, 0, 0, 0x2a2a30);
    put(ctx, "metal", new THREE.CylinderGeometry(0.15, 0.17, 0.32, 10), f, 0, 1.92, 0, 0, 0, 0, 0x26262c);
    put(ctx, "flat", new THREE.BoxGeometry(0.22, 0.04, 0.02), f, 0, 1.94, 0.17, 0, 0, 0, 0x08080a, false);
    col.circle(X + x, z, 0.4);
  };
  const bone = (x: number, z: number, ry: number, y: number, s = 1) => {
    const f = F(x, z, ry, y);
    put(ctx, "flat", new THREE.CylinderGeometry(0.035 * s, 0.03 * s, 0.42 * s, 5), f, 0, 0.05 * s, 0, 0, 0, Math.PI / 2, C.bone, false);
    for (const e of [-1, 1]) put(ctx, "flat", new THREE.SphereGeometry(0.06 * s, 6, 4), f, e * 0.21 * s, 0.05 * s, 0.02 * e, 0, 0, 0, 0xd8ccb0, false);
  };
  const skull = (x: number, z: number, ry: number, y: number) => {
    const f = F(x, z, ry, y);
    const g = new THREE.SphereGeometry(0.13, 8, 6);
    g.scale(0.85, 0.95, 1.05);
    put(ctx, "flat", g, f, 0, 0.12, 0, 0, 0, 0, 0xd4c8ae, false);
    for (const e of [-1, 1]) put(ctx, "flat", new THREE.SphereGeometry(0.035, 5, 4), f, e * 0.05, 0.14, 0.11, 0, 0, 0, 0x1a1410, false);
  };
  /** A stone coffin; `effigy` lays a knight on the lid. */
  const sarcophagus = (x: number, z: number, rot: number, y: number, s = 1, effigy = false, lidOff = false) => {
    const f = F(x, z, rot, y);
    put(ctx, "stoneGrey", boxUV(1.2 * s, 0.9, 2.2 * s, 1, 1), f, 0, 0.45, 0, 0, 0, 0, 0x5a5a5e);
    put(ctx, "stoneGrey", boxUV(1.3 * s, 0.14, 2.3 * s, 1, 1), f, 0, 0.1, 0, 0, 0, 0, 0x48484c);
    const lf = lidOff ? [0.35 * s, 0.98, 0.25, 0.12] : [0, 0.97, 0, 0];
    put(ctx, "stoneGrey", boxUV(1.32 * s, 0.16, 2.34 * s, 1, 1), f, lf[0], lf[1], lf[2], 0, lf[3], 0.04, 0x626266);
    if (effigy) {
      const ef = (g: THREE.BufferGeometry, ly: number, lz: number, c = 0x6a6a6e) => put(ctx, "stoneGrey", g, f, lf[0], 1.05 + ly, lz + lf[2], 0, lf[3], 0, c);
      const body = new THREE.CylinderGeometry(0.24 * s, 0.2 * s, 1.3 * s, 8);
      body.rotateX(Math.PI / 2);
      ef(body, 0.12, 0.05 * s);
      ef(new THREE.SphereGeometry(0.16 * s, 8, 6), 0.14, -0.78 * s);
      ef(new THREE.BoxGeometry(0.08 * s, 0.06, 1.0 * s), 0.38, 0.1 * s, 0x58585c);
    }
    col.box(X + x, z, 1.3 * s, 2.3 * s, rot);
  };

  // ------------------------------------------------------------ the way in and the gatehouse z -4..14
  floor(-2.4, 2.4, -4.2, 0);
  floor(-7, 7, 0, 14, 0x55555a);
  ceil(-2.6, 2.6, -4.2, 0, 3.8);
  ceil(-7, 7, 0, 14, 6.4);
  wall(-2.9, -4.2, -2.9, 0, 4.2);
  wall(2.9, -4.2, 2.9, 0, 4.2);
  wall(-2.9, -4.4, 2.9, -4.4, 4.2);
  wall(-7.5, 0, -2.4, 0, 12, { crenel: true });
  wall(2.4, 0, 7.5, 0, 12, { crenel: true });
  lintel(0, 0, 4.8, 1.0, 3.8, 12);
  wall(-7.5, 0, -7.5, 14, 12);
  wall(7.5, 0, 7.5, 14, 12);
  {
    // grey daylight and rain at the mouth
    const day = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 4.0), new THREE.MeshBasicMaterial({ color: 0x7a8088 }));
    day.position.set(X, 2.0, -3.85);
    root.add(day);
    glows.push({ x: X, y: 2.2, z: -3.0, size: 7, color: 0x9aa4b0 });
    // the old timber door, broken off its hinges and leant aside
    put(ctx, "planksDark", boxUV(2.2, 3.6, 0.2, 1, 2), F(-1.8, 0.8, 0.3), 0, 1.75, 0, 0.12, 0, 0, 0x4a3e32);
    col.box(X - 1.8, 0.8, 0.6, 2.0, 0.3);
  }
  // the gatehouse: murder holes in the vault, arrow slits, the winch
  for (let z = 3; z < 13; z += 3.2) for (const x of [-2.5, 2.5]) put(ctx, "flat", new THREE.CylinderGeometry(0.3, 0.3, 0.1, 8), F(x, z, 0, 6.38), 0, 0, 0, 0, 0, 0, 0x060606, false);
  for (const s of [-1, 1]) for (const z of [4, 9]) put(ctx, "flat", new THREE.BoxGeometry(0.08, 1.4, 0.25), F(s * 6.98, z), 0, 2.6, 0, 0, 0, 0, 0x0a0a0c, false);
  brazier(4.6, 4.2);
  sconce(-6.95, 4.0, Math.PI / 2);
  sconce(6.95, 11.0, -Math.PI / 2);
  banner(-6.95, 7.0, Math.PI / 2, 3.2, 1.4, 3.0);
  rack(5.6, 9.2, -Math.PI / 2);
  {
    // the winch: a timber drum on a frame against the west wall, iron spokes, the chain up into the vault
    const f = F(-5.9, WINCH.z, 0);
    for (const s of [-1, 1]) {
      put(ctx, "flat", new THREE.BoxGeometry(0.3, 2.0, 0.3), f, 0, 1.0, s * 1.3, 0, 0, 0, C.timber);
      put(ctx, "flat", new THREE.BoxGeometry(0.8, 0.2, 0.3), f, 0, 0.1, s * 1.3, 0, 0, 0, C.timber);
    }
    put(ctx, "bark", new THREE.CylinderGeometry(0.55, 0.55, 2.2, 12), f, 0, 1.5, 0, Math.PI / 2, 0, 0, 0x8a7a68);
    for (let k = 0; k < 6; k++) put(ctx, "metal", new THREE.TorusGeometry(0.56, 0.035, 4, 14), f, 0, 1.5, -0.9 + k * 0.36, 0, 0, 0, C.iron, false);
    put(ctx, "metal", new THREE.CylinderGeometry(0.06, 0.06, 4.6, 5), f, 0.2, 3.9, -0.2, 0, 0, -0.15, C.iron, false);
    col.box(X - 5.9, WINCH.z, 1.2, 3.0, 0);
  }
  const winchSpokes = new THREE.Group();
  {
    const parts: THREE.BufferGeometry[] = [];
    for (let k = 0; k < 4; k++) parts.push(at(new THREE.CylinderGeometry(0.05, 0.05, 2.2, 5), 0, 0, 0, C.iron, 0, 0, (k * Math.PI) / 4));
    for (let k = 0; k < 8; k++) parts.push(at(new THREE.SphereGeometry(0.08, 5, 4), Math.cos((k * Math.PI) / 4) * 1.1, Math.sin((k * Math.PI) / 4) * 1.1, 0, 0x4a3a2a));
    const m = new THREE.Mesh(merge(parts), M.metal);
    winchSpokes.add(m);
    winchSpokes.position.set(X - 5.9, 1.5, WINCH.z + 1.55);
    root.add(winchSpokes);
  }
  // the inner portcullis, and the wall it drops through
  wall(-7.5, 14, -3.0, 14, 12, { crenel: true });
  wall(3.0, 14, 7.5, 14, 12, { crenel: true });
  lintel(0, 14, 6.0, 1.0, 5.4, 12);
  const portcullis = new THREE.Group();
  {
    const g: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 9; i++) g.push(at(new THREE.BoxGeometry(0.14, 5.6, 0.14), -2.8 + i * 0.7, 2.8, 0, 0x2e2e32));
    for (const y of [0.9, 2.3, 3.7, 5.1]) g.push(at(new THREE.BoxGeometry(6.0, 0.14, 0.18), 0, y, 0, 0x2a2a2e));
    for (let i = 0; i < 9; i++) g.push(at(new THREE.ConeGeometry(0.08, 0.3, 4), -2.8 + i * 0.7, -0.12, 0, 0x3a3a3e, Math.PI, 0, 0));
    const m = new THREE.Mesh(merge(g), M.metal);
    m.castShadow = true;
    portcullis.add(m);
    portcullis.position.set(X, env.flag("keep_winch") ? 5.0 : 0, 14);
    root.add(portcullis);
    col.box(X, 14, 6.0, 0.6, 0, () => !env.flag("keep_winch"));
  }

  // ------------------------------------------------------------ the outer bailey z 14..30 (open sky)
  floor(-14, 14, 14, 30, 0x4a4c52);
  wall(-14.5, 14, -7.5, 14, 12, { crenel: true });
  wall(7.5, 14, 14.5, 14, 12, { crenel: true });
  wall(-14.5, 14, -14.5, 30, 12, { crenel: true });
  wall(14.5, 14, 14.5, 30, 12, { crenel: true });
  wall(-20.5, 30, -4, 30, 12, { crenel: true });
  wall(4, 30, 20.5, 30, 12, { crenel: true });
  lintel(0, 30, 8.0, 1.0, 6.4, 12);
  {
    // the inner gate's leaves, broken open
    for (const s of [-1, 1]) {
      const f = F(s * 4.2, 31.6, s * 1.25);
      put(ctx, "planksDark", boxUV(3.6, 5.8, 0.24, 1, 2), f, -s * 1.8, 2.9, 0, 0, 0, 0, 0x3e3428);
      for (const y of [0.8, 2.9, 5.0]) put(ctx, "metal", new THREE.BoxGeometry(3.6, 0.16, 0.3), f, -s * 1.8, y, 0, 0, 0, 0, C.iron);
      col.box(f.at(-s * 1.8, 0, 0).x, f.at(-s * 1.8, 0, 0).z, 3.6, 0.4, s * 1.25);
    }
    // what the guard left: carts, barrels, a dummy, arrows in a block
    const ct = F(-10.6, 24.5, 0.2);
    put(ctx, "planks", boxUV(1.4, 0.5, 2.2, 1, 1), ct, 0, 0.8, 0, 0, 0, 0, 0x5a5048);
    for (const s of [-1, 1]) put(ctx, "planksDark", new THREE.CylinderGeometry(0.55, 0.55, 0.12, 12), ct, s * 0.78, 0.55, 0.1, 0, 0, Math.PI / 2, 0x4a4038);
    col.box(X - 10.6, 24.5, 1.8, 2.5, 0.2);
    barrel(ctx, X + 12.2, 16.4);
    barrel(ctx, X + 11.4, 17.2, 0.9, true);
    barrel(ctx, X + 12.4, 17.6, 0.95);
    crate(ctx, X - 12.6, 16.2, 0.8, 0.2);
    crate(ctx, X - 12.4, 17.2, 0.6, 0.9);
    sack(ctx, X - 11.6, 15.9);
    const dm = F(10.6, 26.4, -0.6);
    put(ctx, "flat", new THREE.BoxGeometry(0.14, 1.9, 0.14), dm, 0, 0.95, 0, 0, 0, 0, C.timber);
    put(ctx, "flat", new THREE.BoxGeometry(1.1, 0.12, 0.12), dm, 0, 1.45, 0, 0, 0, 0, C.timber);
    const sackG = new THREE.SphereGeometry(0.3, 8, 6);
    sackG.scale(1, 1.3, 0.8);
    put(ctx, "flat", sackG, dm, 0, 1.4, 0, 0, 0, 0, 0x8a7a5a);
    put(ctx, "flat", new THREE.SphereGeometry(0.18, 8, 6), dm, 0, 1.95, 0, 0, 0, 0, 0x8a7a5a);
    col.circle(X + 10.6, 26.4, 0.3);
    brazier(-11.5, 28.4);
    brazier(11.5, 21.0);
    banner(-13.9, 22, Math.PI / 2, 6.5, 2.0, 5.0);
    banner(13.9, 22, -Math.PI / 2, 6.5, 2.0, 5.0);
  }

  // ------------------------------------------------------------ the courtyard z 30..56 (open sky)
  floor(-20, 20, 30, 56.5, 0x44464c);
  wall(-20.5, 30, -20.5, 38, 12, { crenel: true });
  wall(-20.5, 42, -20.5, 56.5, 12, { crenel: true });
  lintel(-20.5, 40, 1.0, 4.0, 4.2, 12);
  wall(20.5, 30, 20.5, 38.5, 12, { crenel: true });
  wall(20.5, 41.5, 20.5, 56.5, 12, { crenel: true });
  lintel(20.5, 40, 1.0, 3.0, 4.0, 12);
  wall(-20.5, 56.5, -2.6, 56.5, 12, { crenel: true });
  wall(2.6, 56.5, 20.5, 56.5, 12, { crenel: true });
  lintel(0, 56.5, 5.2, 1.0, 3.6, 12);
  {
    // the dead tree, its roots heaving the flags
    const t = treeGeo("oak", 412);
    const g = t.trunk.clone();
    const c = g.getAttribute("color");
    for (let i = 0; i < c.count; i++) c.setXYZ(i, c.getX(i) * 0.42, c.getY(i) * 0.42, c.getZ(i) * 0.44);
    g.scale(0.85, 0.75, 0.85);
    g.rotateY(0.7);
    g.translate(X + 12, -0.1, 51);
    batch.add("flat", M.flat, g);
    col.circle(X + 12, 51, t.radius * 0.85 + 0.25);
    put(ctx, "stoneDark", new THREE.CylinderGeometry(2.0, 2.2, 0.4, 14), F(12, 51), 0, 0.2, 0, 0, 0, 0, 0x36363a);
    // a broken statue of a king on a plinth, its head gone
    const sf = F(-13, 52, 0.3);
    put(ctx, "stoneGrey", boxUV(2.0, 1.4, 2.0, 1, 1), sf, 0, 0.7, 0, 0, 0, 0, 0x5a5a5e);
    put(ctx, "stoneGrey", new THREE.CylinderGeometry(0.42, 0.6, 2.2, 10), sf, 0, 2.5, 0, 0, 0, 0, 0x6a6a6e);
    put(ctx, "stoneGrey", new THREE.SphereGeometry(0.5, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), sf, 0, 3.55, 0, 0, 0, 0, 0x6a6a6e);
    put(ctx, "stoneGrey", new THREE.BoxGeometry(0.16, 2.0, 0.12), sf, 0.5, 2.6, 0.2, 0, 0, 0.12, 0x5e5e62);
    put(ctx, "stoneGrey", new THREE.SphereGeometry(0.3, 8, 6), sf, 1.6, 0.3, 1.4, 0.5, 0, 0.4, 0x6a6a6e);
    col.box(X - 13, 52, 2.1, 2.1, 0.3);
    // braziers, banners on the walls, a weapon rack by the barracks
    brazier(-6.5, 33.2);
    brazier(6.5, 33.2);
    brazier(-16.5, 46.0);
    brazier(16.5, 46.0);
    for (const z of [34.5, 50]) {
      banner(-19.9, z, Math.PI / 2, 6.8, 2.2, 5.6);
      banner(19.9, z, -Math.PI / 2, 6.8, 2.2, 5.6);
    }
    banner(-8, 55.9, Math.PI, 6.8, 2.2, 5.6);
    banner(8, 55.9, Math.PI, 6.8, 2.2, 5.6);
    rack(-18.6, 33.6, Math.PI / 2);
    // the crypt stair's door: an arch with a carved skull over it
    const sk = F(0, 55.9, Math.PI);
    put(ctx, "stoneGrey", new THREE.SphereGeometry(0.4, 10, 8), sk, 0, 4.2, 0.1, 0, 0, 0, 0x8a8478);
    for (const e of [-1, 1]) put(ctx, "flat", new THREE.SphereGeometry(0.1, 6, 4), sk, e * 0.15, 4.25, 0.4, 0, 0, 0, 0x0a0a0a, false);
  }
  // puddles: black and shining
  {
    const parts: THREE.BufferGeometry[] = [];
    const pr = rng(88);
    for (let i = 0; i < 26; i++) {
      const x = -18 + pr() * 36;
      const z = 15 + pr() * 41;
      if (Math.abs(x) > 13 && z < 30) continue;
      const g = new THREE.CircleGeometry(0.8 + pr() * 1.6, 12);
      const p = g.getAttribute("position");
      for (let k = 1; k < p.count; k++) {
        const s = 0.75 + noise2(p.getX(k) * 2 + i, p.getY(k) * 2) * 0.5;
        p.setXY(k, p.getX(k) * s, p.getY(k) * s * (0.6 + pr() * 0.02));
      }
      g.rotateX(-Math.PI / 2);
      g.rotateY(pr() * 6);
      g.translate(X + x, 0.012, z);
      parts.push(g);
    }
    const m = new THREE.Mesh(merge(parts), new THREE.MeshPhongMaterial({ color: 0x14161a, specular: 0x8a929c, shininess: 120, vertexColors: true }));
    m.receiveShadow = true;
    root.add(m);
  }

  // ------------------------------------------------------------ the barracks, west (x -34..-20, z 32..48)
  floor(-34, -20.5, 32, 48, 0x4e4a46);
  ceil(-34, -20.5, 32, 48, 6.4);
  wall(-34.5, 31.5, -34.5, 48.5, 12, { crenel: true });
  wall(-34.5, 31.5, -20.5, 31.5, 12, { crenel: true });
  wall(-34.5, 48.5, -20.5, 48.5, 12, { crenel: true });
  {
    // bunks, two high, down the west wall and along the north
    const bunk = (x: number, z: number, rot: number) => {
      const f = F(x, z, rot);
      for (const y of [0.45, 1.5]) {
        put(ctx, "planksDark", boxUV(2.0, 0.12, 0.9, 1, 1), f, 0, y, 0, 0, 0, 0, 0x5a4c3e);
        put(ctx, "flat", new THREE.BoxGeometry(1.8, 0.12, 0.75), f, 0.05, y + 0.12, 0, 0, 0, 0, 0x5a5448);
      }
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) put(ctx, "flat", new THREE.BoxGeometry(0.1, 1.9, 0.1), f, sx * 0.95, 0.95, sz * 0.4, 0, 0, 0, C.timber);
      col.box(X + x, z, 2.1, 1.0, rot);
    };
    for (const z of [33.6, 36.4, 43.6, 46.4]) bunk(-32.8, z, 0);
    for (const x of [-29.2, -26.4]) bunk(x, 47.2, 0);
    // the long table and its benches
    const tf = F(-28.6, 40, Math.PI / 2);
    put(ctx, "planksDark", boxUV(4.0, 0.12, 1.1, 1, 1), tf, 0, 0.82, 0, 0, 0, 0, 0x5a4a3a);
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) put(ctx, "flat", new THREE.BoxGeometry(0.12, 0.8, 0.12), tf, sx * 1.8, 0.4, sz * 0.42, 0, 0, 0, C.timber);
    for (const s of [-1, 1]) put(ctx, "planksDark", boxUV(3.8, 0.08, 0.35, 1, 1), tf, 0, 0.46, s * 0.95, 0, 0, 0, 0x4a3e32);
    col.box(X - 28.6, 40, 1.2, 4.1, 0);
    for (let k = 0; k < 4; k++) put(ctx, "metal", new THREE.CylinderGeometry(0.06, 0.05, 0.14, 7), tf, -1.3 + k * 0.8, 0.95, (k % 2) * 0.3 - 0.15, 0, 0, 0, 0x5a5a5e, false);
    candles(-28.6, 40.6, 0.88, 3, 0.15);
    // the hearth on the south wall
    const hf = F(-27, 32.4, 0);
    put(ctx, "stoneDark", boxUV(2.8, 1.6, 1.0, 1, 1), hf, 0, 0.8, 0, 0, 0, 0, 0x3a3634);
    put(ctx, "stoneDark", boxUV(2.2, 1.0, 0.6, 1, 1), hf, 0, 0.6, 0.25, 0, 0, 0, 0x101010);
    put(ctx, "stoneDark", boxUV(3.2, 0.3, 1.2, 1, 1), hf, 0, 1.75, 0.1, 0, 0, 0, 0x4a4644);
    put(ctx, "ember", new THREE.BoxGeometry(1.4, 0.12, 0.4), hf, 0, 0.18, 0.45, 0, 0, 0, 0xffffff, false);
    const hp = hf.at(0, 0.6, 0.7);
    fires.push(hp);
    glows.push({ x: hp.x, y: hp.y, z: hp.z, size: 5.5, color: 0xff7a30 });
    col.box(X - 27, 32.4, 2.8, 1.2, 0);
    // the captain's hooks: an empty one where the armoury key hung
    const kf = F(-21.0, 45.6, -Math.PI / 2);
    put(ctx, "planks", boxUV(1.4, 0.4, 0.06, 1, 1), kf, 0, 2.0, 0, 0, 0, 0, 0x6a5a48);
    for (let k = 0; k < 4; k++) put(ctx, "metal", new THREE.TorusGeometry(0.05, 0.015, 4, 8), kf, -0.5 + k * 0.33, 1.9, 0.06, 0, 0, 0, 0x6a6a70, false);
    rack(-33.6, 40, Math.PI / 2);
    armourStand(-22.0, 34.0, Math.PI);
    armourStand(-22.0, 46.4, Math.PI);
    sconce(-34.0, 38.0, Math.PI / 2);
    sconce(-21.0, 36.0, -Math.PI / 2);
    banner(-34.0, 42.0, Math.PI / 2, 3.4, 1.4, 2.6);
  }

  // ------------------------------------------------------------ the armoury, east (x 20..36, z 32..48)
  floor(20.5, 36, 32, 48, 0x4a4a4e);
  ceil(20.5, 36, 32, 48, 6.4);
  wall(36.5, 31.5, 36.5, 48.5, 12, { crenel: true });
  wall(20.5, 31.5, 36.5, 31.5, 12, { crenel: true });
  wall(20.5, 48.5, 36.5, 48.5, 12, { crenel: true });
  {
    rack(25.0, 47.4, Math.PI);
    rack(29.0, 47.4, Math.PI);
    rack(25.0, 32.6, 0);
    rack(33.6, 32.6, 0);
    armourStand(35.2, 34.4, -Math.PI / 2);
    armourStand(35.2, 45.6, -Math.PI / 2);
    armourStand(34.0, 47.2, Math.PI);
    // the rack-chest the cache is searched from
    const cf = F(28, 41.55, 0);
    put(ctx, "planksDark", boxUV(1.3, 0.62, 0.7, 1, 1), cf, 0, 0.31, 0, 0, 0, 0, 0x3a3028);
    put(ctx, "planksDark", new THREE.CylinderGeometry(0.35, 0.35, 1.3, 10, 1, false, 0, Math.PI), cf, 0, 0.62, 0, 0, 0, Math.PI / 2, 0x3a3028);
    for (const e of [-0.45, 0.45]) put(ctx, "metal", new THREE.BoxGeometry(0.08, 1.0, 0.74), cf, e, 0.48, 0, 0, 0, 0, C.iron);
    put(ctx, "metal", new THREE.BoxGeometry(0.18, 0.18, 0.06), cf, 0, 0.55, -0.37, 0, 0, 0, 0x8a7a48);
    for (let k = 0; k < 3; k++) put(ctx, "metal", new THREE.BoxGeometry(0.05, 1.2, 0.02), cf, -0.3 + k * 0.3, 1.2, 0.25, 0.35, 0, 0, 0x4a4a50, false);
    col.box(X + 28, 41.55, 1.3, 0.7, 0);
    // a grindstone and an anvil
    const gf = F(23.0, 44.6, 0.4);
    put(ctx, "stoneGrey", new THREE.CylinderGeometry(0.5, 0.5, 0.18, 14), gf, 0, 0.75, 0, 0, 0, Math.PI / 2, 0x8a8478);
    put(ctx, "flat", new THREE.BoxGeometry(0.9, 0.55, 0.4), gf, 0, 0.27, 0, 0, 0, 0, C.timber);
    col.circle(X + 23, 44.6, 0.55);
    const af = F(32.4, 39.0, 0.3);
    put(ctx, "bark", new THREE.CylinderGeometry(0.38, 0.42, 0.65, 9), af, 0, 0.33, 0, 0, 0, 0, 0x8a7a68);
    put(ctx, "metal", boxUV(0.8, 0.24, 0.32, 1, 1), af, 0, 0.78, 0, 0, 0, 0, C.iron);
    put(ctx, "metal", new THREE.ConeGeometry(0.16, 0.42, 6), af, 0.56, 0.8, 0, 0, 0, Math.PI / 2, C.iron);
    col.circle(X + 32.4, 39.0, 0.5);
    // black iron ingots stacked by the ore
    for (let k = 0; k < 6; k++) put(ctx, "metal", new THREE.BoxGeometry(0.5, 0.12, 0.2), F(27.0, 35.2, 0.2), (k % 3) * 0.22 - 0.22, 0.06 + Math.floor(k / 3) * 0.12, Math.floor(k / 3) * 0.1, 0, Math.floor(k / 3) * 1.5, 0, 0x1e1e24, false);
    sconce(35.95, 37.0, -Math.PI / 2);
    sconce(21.0, 45.0, Math.PI / 2);
    brazier(23.4, 35.0);
    // the crypt chain: a lever on the east wall, the chain along the vault and away down
    const lf = F(35.95, LEVER.z, -Math.PI / 2);
    put(ctx, "metal", new THREE.BoxGeometry(0.7, 1.1, 0.2), lf, 0, 1.3, 0.1, 0, 0, 0, 0x2a2a2e);
    put(ctx, "metal", new THREE.CylinderGeometry(0.08, 0.08, 0.5, 8), lf, 0, 1.3, 0.35, Math.PI / 2, 0, 0, 0x3a3a3e);
    for (let k = 0; k < 16; k++) put(ctx, "metal", new THREE.TorusGeometry(0.1, 0.025, 4, 8), F(35.6 - k * 0.3, LEVER.z + 0.35, 0, 0), 0, 2.6 + k * 0.22, 0, 0, k % 2 ? Math.PI / 2 : 0, 0, C.iron, false);
    for (let k = 0; k < 40; k++) put(ctx, "metal", new THREE.TorusGeometry(0.1, 0.025, 4, 8), F(30.8 - k * 0.3, LEVER.z + 0.35, 0, 0), 0, 6.1, 0, 0, Math.PI / 2, k % 2 ? Math.PI / 2 : 0, C.iron, false);
  }
  const leverArm = new THREE.Group();
  {
    const parts = [at(new THREE.CylinderGeometry(0.05, 0.05, 1.0, 6), 0, 0.5, 0, C.iron), at(new THREE.SphereGeometry(0.09, 6, 5), 0, 1.0, 0, 0x5a3a2a)];
    leverArm.add(new THREE.Mesh(merge(parts), M.metal));
    leverArm.position.set(X + 35.6, 1.3, LEVER.z);
    leverArm.rotation.z = env.flag("crypt") ? -0.9 : 0.9;
    root.add(leverArm);
  }
  // the armoury door: oak and iron, barred from inside until its captain falls
  const armDoor = new THREE.Group();
  {
    const wood: THREE.BufferGeometry[] = [];
    const iron: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 5; i++) wood.push(at(boxUV(0.2, 3.8, 0.6, 1, 2), 0.05, 1.9, 0.3 + i * 0.6, i % 2 ? 0x4a3e32 : 0x54463a));
    for (const y of [0.6, 1.9, 3.2]) iron.push(at(new THREE.BoxGeometry(0.26, 0.16, 3.0), 0.05, y, 1.5, 0x2a2a2e));
    for (let i = 0; i < 12; i++) iron.push(at(new THREE.SphereGeometry(0.04, 4, 3), -0.1, 0.6 + (i % 3) * 1.3, 0.3 + Math.floor(i / 3) * 0.8, 0x3a3a3e));
    const w = new THREE.Mesh(merge(wood), M.planksDark);
    w.castShadow = true;
    armDoor.add(w, new THREE.Mesh(merge(iron), M.metal));
    armDoor.position.set(X + 20.5, 0, 38.5);
    armDoor.rotation.y = env.flag("armoury") ? 1.45 : 0;
    root.add(armDoor);
    col.box(X + 20.5, 40, 0.5, 3.0, 0, () => !env.flag("armoury"));
  }

  // ------------------------------------------------------------ the crypt stair, down (z 56.5..60.6)
  floor(-2.6, 2.6, 56.5, STAIR_DOWN.z0, 0x3e3e44);
  {
    const n = 6;
    const len = (STAIR_DOWN.z1 - STAIR_DOWN.z0) / n;
    for (let k = 0; k < n; k++) {
      const top = (CRYPT_Y * (k + 0.5)) / n;
      put(ctx, "stoneGrey", boxUV(5.2, 1.0, len + 0.02, 2, 1), F(0, STAIR_DOWN.z0 + len * (k + 0.5)), 0, top - 0.5, 0, 0, 0, 0, 0x4a4a50, false);
      put(ctx, "flat", new THREE.BoxGeometry(5.2, 0.04, 0.05), F(0, STAIR_DOWN.z0 + len * k), 0, top + CRYPT_Y / n / 2 + 0.01, 0, 0, 0, 0, 0x18181c, false);
    }
  }
  wall(-3.1, 56.5, -3.1, STAIR_DOWN.z1, 5.6, { y0: CRYPT_Y });
  wall(3.1, 56.5, 3.1, STAIR_DOWN.z1, 5.6, { y0: CRYPT_Y });
  ceil(-2.6, 2.6, 57, STAIR_DOWN.z1, 3.6);
  sconce(-2.65, 59.6, Math.PI / 2, 2.2);
  // the seal: an iron grate across the stair, chained up when the crypt chain is pulled
  const grate = new THREE.Group();
  {
    const g: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 9; i++) g.push(at(new THREE.BoxGeometry(0.12, 3.7, 0.12), -2.4 + i * 0.6, 1.85, 0, 0x2a2a2e));
    for (let j = 0; j < 6; j++) g.push(at(new THREE.BoxGeometry(5.2, 0.12, 0.12), 0, 0.3 + j * 0.65, 0, 0x2a2a2e));
    g.push(at(new THREE.TorusGeometry(0.4, 0.06, 6, 16), 0, 1.8, 0.1, 0x4a4a50));
    const m = new THREE.Mesh(merge(g), M.metal);
    m.castShadow = true;
    grate.add(m);
    grate.position.set(X, env.flag("crypt") ? 3.6 : 0, 57.4);
    root.add(grate);
    col.box(X, 57.4, 5.4, 0.5, 0, () => !env.flag("crypt"));
  }

  // ------------------------------------------------------------ the crypt z 60.6..85.4 (floor CRYPT_Y)
  floor(-9, 9, STAIR_DOWN.z1, STAIR_UP.z1, 0x3a3a3e, CRYPT_Y);
  ceil(-9.5, 9.5, STAIR_DOWN.z1, STAIR_UP.z1, 4.2);
  wall(-10, STAIR_DOWN.z1, -2.6, STAIR_DOWN.z1, 5.6, { y0: CRYPT_Y });
  wall(2.6, STAIR_DOWN.z1, 10, STAIR_DOWN.z1, 5.6, { y0: CRYPT_Y });
  wall(-9.5, STAIR_DOWN.z1, -9.5, 86.0, 5.6, { y0: CRYPT_Y });
  wall(9.5, STAIR_DOWN.z1, 9.5, 86.0, 5.6, { y0: CRYPT_Y });
  {
    // tombs down the walls, bones, candles on everything
    for (const z of [64, 69, 74, 79]) sarcophagus(-7.2, z, 0, CRYPT_Y, 1, z === 69);
    for (const z of [64, 69]) sarcophagus(7.2, z, 0, CRYPT_Y, 1, z === 64, z === 69);
    // wall niches full of skulls
    for (const s of [-1, 1])
      for (let k = 0; k < 6; k++) {
        const z = 62.5 + k * 3.6;
        if (s > 0 && z > 75) continue;
        put(ctx, "flat", new THREE.BoxGeometry(0.1, 0.8, 1.6), F(s * 8.95, z), 0, CRYPT_Y + 2.3, 0, 0, 0, 0, 0x0a0a0c, false);
        for (let j = 0; j < 3; j++) skull(s * 8.8, z - 0.5 + j * 0.5, s > 0 ? -Math.PI / 2 : Math.PI / 2, CRYPT_Y + 1.95);
      }
    // columns (none in the stair channel)
    for (const z of [62.6, 71.6]) for (const s of [-1, 1]) {
      put(ctx, "stoneDark", new THREE.CylinderGeometry(0.45, 0.5, 5.4, 10), F(s * 5.0, z, 0, CRYPT_Y), 0, 2.7, 0, 0, 0, 0, 0x4a4a50);
      col.circle(X + s * 5.0, z, 0.55);
    }
    for (let i = 0; i < 26; i++) bone(-8 + r() * 13, 61.5 + r() * 21, r() * 6, CRYPT_Y, 0.8 + r() * 0.6);
    for (let i = 0; i < 5; i++) skull(-7 + r() * 11, 62 + r() * 19, r() * 6, CRYPT_Y);
    candles(-5.6, 66.4, CRYPT_Y, 6);
    candles(5.4, 74.6, CRYPT_Y, 5);
    candles(-5.8, 81.2, CRYPT_Y, 7);
    candles(-1.9, 83.6, CRYPT_Y, 6, 0.35);
    candles(1.9, 83.6, CRYPT_Y, 6, 0.35);
    for (const [x, z] of [[-7.2, 64], [-7.2, 79], [7.2, 64]] as [number, number][]) candles(x, z, CRYPT_Y + 1.05, 3, 0.25);
    sconce(-8.95, 67.0, Math.PI / 2, CRYPT_Y + 3.0);
    sconce(-8.95, 76.0, Math.PI / 2, CRYPT_Y + 3.0);
    sconce(8.95, 71.0, -Math.PI / 2, CRYPT_Y + 3.0);
    // the great tomb in its niche: a knight on the lid, the lid pushed aside
    sarcophagus(0, 84.2, 0, CRYPT_Y, 1.25, true, true);
    put(ctx, "stoneDark", boxUV(3.4, 0.5, 0.6, 1, 1), F(0, 85.2, 0, CRYPT_Y), 0, 3.6, 0, 0, 0, 0, 0x4a4a50);
    banner(0, 85.4, Math.PI, CRYPT_Y + 2.3, 1.4, 2.4);
  }
  // the stair up, east channel (z 76..85.4), fenced from the crypt floor
  {
    const n = 8;
    const len = (STAIR_UP.z1 - STAIR_UP.z0) / n;
    for (let k = 0; k < n; k++) {
      const top = CRYPT_Y * (1 - (k + 0.5) / n);
      put(ctx, "stoneGrey", boxUV(STAIR_UP.x1 - STAIR_UP.x0, 1.2, len + 0.02, 2, 1), F((STAIR_UP.x0 + STAIR_UP.x1) / 2, STAIR_UP.z0 + len * (k + 0.5)), 0, top - 0.6, 0, 0, 0, 0, 0x4a4a50, false);
    }
    wall(STAIR_UP.x0, STAIR_UP.z0, STAIR_UP.x0, STAIR_UP.z1, 2.0, { y0: CRYPT_Y, t: 0.5 });
    put(ctx, "stoneGrey", boxUV(0.6, 0.2, 0.6, 1, 1), F(STAIR_UP.x0, STAIR_UP.z0), 0, CRYPT_Y + 2.1, 0, 0, 0, 0, 0x5a5a60);
    sconce(8.95, 81.0, -Math.PI / 2, 1.4);
  }

  // ------------------------------------------------------------ the throne room z 86..106
  floor(-12.5, 12.5, 85.4, 106, 0x3a3a40);
  ceil(-12.5, 12.5, 86.4, 106, 9.0);
  wall(-12.5, 85.9, STAIR_UP.x0, 85.9, 10.4, { y0: CRYPT_Y });
  wall(STAIR_UP.x1 + 0.25, 85.9, 12.5, 85.9, 10.4, { y0: CRYPT_Y });
  lintel((STAIR_UP.x0 + STAIR_UP.x1) / 2 + 0.1, 85.9, STAIR_UP.x1 - STAIR_UP.x0 + 0.4, 1.0, 3.4, 9.2);
  wall(-13, 85.4, -13, 106.5, 12, { crenel: true });
  wall(13, 85.4, 13, 106.5, 12, { crenel: true });
  wall(-13, 106, -2.2, 106, 12, { crenel: true });
  wall(2.2, 106, 13, 106, 12, { crenel: true });
  lintel(0, 106, 4.4, 1.0, 4.4, 12);
  {
    // a runner of old red, black at the edges
    put(ctx, "flat", new THREE.BoxGeometry(2.6, 0.02, 12.2), F(0, 93.0), 0, 0.012, 0, 0, 0, 0, C.red, false);
    put(ctx, "flat", new THREE.BoxGeometry(2.9, 0.015, 12.4), F(0, 93.0), 0, 0.006, 0, 0, 0, 0, 0x1a1414, false);
    // columns
    for (const z of [90, 94, 98, 102]) for (const s of [-1, 1]) {
      put(ctx, "stoneDark", new THREE.CylinderGeometry(0.55, 0.62, 9.0, 12), F(s * 7.4, z), 0, 4.5, 0, 0, 0, 0, 0x404046);
      put(ctx, "stoneDark", boxUV(1.5, 0.4, 1.5, 1, 1), F(s * 7.4, z), 0, 0.2, 0, 0, 0, 0, 0x34343a);
      col.circle(X + s * 7.4, z, 0.7);
    }
    for (const z of [88.6, 92.0, 96.0, 100.0, 104.0]) {
      banner(-12.45, z, Math.PI / 2, 4.6, 1.6, 5.0);
      banner(12.45, z, -Math.PI / 2, 4.6, 1.6, 5.0);
    }
    // the dais and the empty throne; the way on is behind it
    const df = F(0, 101.0);
    put(ctx, "stoneDark", boxUV(6.4, 0.25, 4.0, 2, 2), df, 0, 0.125, 0, 0, 0, 0, 0x34343a);
    put(ctx, "stoneDark", boxUV(5.2, 0.25, 3.0, 2, 2), df, 0, 0.375, 0.3, 0, 0, 0, 0x3a3a40);
    col.box(X, 101.0, 6.4, 4.0, 0);
    const tf = F(0, 102.0, Math.PI, 0.5);
    put(ctx, "stoneDark", boxUV(1.6, 0.6, 1.2, 1, 1), tf, 0, 0.3, 0, 0, 0, 0, 0x26262c);
    put(ctx, "stoneDark", boxUV(1.6, 3.2, 0.3, 1, 1), tf, 0, 1.6, -0.55, 0, 0, 0, 0x26262c);
    for (const s of [-1, 1]) {
      put(ctx, "stoneDark", boxUV(0.25, 0.5, 1.1, 1, 1), tf, s * 0.75, 0.85, 0, 0, 0, 0, 0x2a2a30);
      put(ctx, "metal", new THREE.ConeGeometry(0.1, 0.7, 4), tf, s * 0.6, 3.5, -0.55, 0, 0, 0, C.iron);
    }
    put(ctx, "metal", new THREE.ConeGeometry(0.12, 0.9, 4), tf, 0, 3.65, -0.55, 0, 0, 0, C.iron);
    put(ctx, "flat", new THREE.BoxGeometry(1.2, 0.08, 0.8), tf, 0, 0.64, 0.05, 0, 0, 0, C.red, false);
    // a helm left on the seat
    put(ctx, "metal", new THREE.CylinderGeometry(0.17, 0.19, 0.34, 10), tf, 0.2, 0.85, 0.1, 0, 0.4, 0.2, 0x26262c);
    brazier(-4.4, 97.6);
    brazier(4.4, 97.6);
    brazier(-4.6, 88.6);
    brazier(4.6, 88.6);
    sconce(-12.0, 104.6, Math.PI / 2);
    sconce(12.0, 104.6, -Math.PI / 2);
  }

  // ------------------------------------------------------------ the broken ring z 106..143: Finlay's arena
  const A = ARENA;
  {
    // the floor: a round courtyard of flags, broken at the rim
    const disc = new THREE.CircleGeometry(19.2, 48, 0, Math.PI * 2);
    const p = disc.getAttribute("position");
    for (let i = 1; i < p.count; i++) {
      const a = Math.atan2(p.getY(i), p.getX(i));
      const inGap = GAPS.some((g) => Math.abs(Math.atan2(Math.sin(-a - g), Math.cos(-a - g))) < GAP_HALF * 1.6);
      const k = inGap ? 0.93 + noise2(a * 9, 3) * 0.04 : 1 + (noise2(a * 7, 1) - 0.5) * 0.04;
      p.setXY(i, p.getX(i) * k, p.getY(i) * k);
    }
    disc.rotateX(-Math.PI / 2);
    const uv = disc.getAttribute("uv");
    const pp = disc.getAttribute("position");
    for (let i = 0; i < uv.count; i++) uv.setXY(i, pp.getX(i) / 3, pp.getZ(i) / 3);
    // a hair below y = 0 so the throne room's floor wins where the disc runs under it (no z-fight)
    put(ctx, "flagstone", disc, F(A.x, A.z), 0, -0.015, 0, 0, 0, 0, 0x4a4c52, false);
    // the drum of the tower falling away below, and the edge of the floor
    const drum = new THREE.CylinderGeometry(19.0, 21.0, 44, 40, 4, true);
    put(ctx, "stoneDark", drum, F(A.x, A.z), 0, -22.2, 0, 0, 0, 0, 0x2e2e34);
    // a sunken ring of darker flags and a cracked compass rose in the middle (the arena reads at a glance)
    put(ctx, "flat", new THREE.RingGeometry(15.6, 16.0, 48).rotateX(-Math.PI / 2), F(A.x, A.z), 0, 0.01, 0, 0, 0, 0, 0x1e1e22, false);
    put(ctx, "flat", new THREE.RingGeometry(3.0, 3.3, 24).rotateX(-Math.PI / 2), F(A.x, A.z), 0, 0.01, 0, 0, 0, 0, 0x26262a, false);
    for (let k = 0; k < 8; k++) put(ctx, "flat", new THREE.BoxGeometry(0.12, 0.012, 6 + (k % 2) * 3), F(A.x, A.z, (k * Math.PI) / 4), 0, 0.012, 0, 0, 0, 0, 0x26262a, false);
    // cracks
    const cr = rng(7);
    for (let k = 0; k < 18; k++) {
      const a = cr() * Math.PI * 2;
      const d = 4 + cr() * 11;
      put(ctx, "flat", new THREE.BoxGeometry(0.06, 0.012, 1.5 + cr() * 2.5), F(A.x + Math.cos(a) * d, A.z + Math.sin(a) * d, a + (cr() - 0.5)), 0, 0.014, 0, 0, 0, 0, 0x121214, false);
    }
  }
  // the parapet: low broken wall around the rim, gaps where it fell, the throne-room wall to the south
  {
    const southGap = (a: number) => {
      const x = Math.cos(a) * RING;
      const z = A.z + Math.sin(a) * RING;
      return z < 111.5 && Math.abs(x) < 13.6;
    };
    const inGap = (a: number) => GAPS.some((g) => Math.abs(Math.atan2(Math.sin(a - g), Math.cos(a - g))) < GAP_HALF);
    const n = 64;
    const pr = rng(19);
    for (let k = 0; k < n; k++) {
      const a0 = (k / n) * Math.PI * 2;
      const a1 = ((k + 1) / n) * Math.PI * 2;
      const mid = (a0 + a1) / 2;
      if (southGap(mid)) continue;
      const x0 = Math.cos(a0) * RING;
      const z0 = A.z + Math.sin(a0) * RING;
      const x1 = Math.cos(a1) * RING;
      const z1 = A.z + Math.sin(a1) * RING;
      const len = Math.hypot(x1 - x0, z1 - z0) + 0.06;
      const rot = -mid + Math.PI / 2;
      const cx = (x0 + x1) / 2;
      const cz = (z0 + z1) / 2;
      if (inGap(mid)) {
        // the gap: a broken stub at floor level, rubble lying out over the drop
        put(ctx, "stoneDark", boxUV(len, 0.3, 1.2, 1, 1), F(cx, cz, rot), 0, -0.05, 0, (pr() - 0.5) * 0.2, 0, (pr() - 0.5) * 0.2, C.black);
        continue;
      }
      const hh = 1.1 + (k % 5 === 0 ? 1.6 : 0) + pr() * 0.5;
      put(ctx, "stoneDark", boxUV(len, hh, 1.2, 1.4, 1.4), F(cx, cz, rot), 0, hh / 2, 0, 0, 0, 0, C.black);
      if (k % 2 === 0) put(ctx, "stoneDark", boxUV(len * 0.55, 0.7, 1.2, 1, 1), F(cx, cz, rot), 0, hh + 0.35, 0, 0, 0, 0, C.black);
      col.box(X + cx, cz, len, 1.2, rot);
      // broken arch piers every few segments: the stumps of a roof that is gone
      if (k % 8 === 3) {
        const ph = 4.5 + pr() * 4;
        const px = Math.cos(mid) * (RING + 0.9);
        const pz = A.z + Math.sin(mid) * (RING + 0.9);
        put(ctx, "stoneDark", boxUV(1.4, ph, 1.4, 1.4, 1.4), F(px, pz, rot), 0, ph / 2, 0, 0, 0, 0, 0x34343a);
        put(ctx, "stoneDark", boxUV(1.4, 0.6, 2.6, 1, 1), F(px, pz, rot), 0, ph, -0.6, 0.3, 0, 0, 0x34343a);
        col.box(X + px, pz, 1.5, 1.5, rot);
      }
    }
    // the throne-room wall's shoulders out to the parapet
    for (const s of [-1, 1]) {
      const zc = A.z - Math.sqrt(RING * RING - 13 * 13);
      wall(s * 13, 106, s * 13, zc + 0.6, 6, { crenel: true });
    }
    // rubble in the gaps (all outside the arena circle), and out on the drop's ledge below
    for (const g of GAPS) {
      for (let k = 0; k < 5; k++) {
        const a = g + (pr() - 0.5) * GAP_HALF * 2.4;
        const d = 17.0 + pr() * 1.8;
        const s = 0.25 + pr() * 0.35;
        const rg = rockGeo(200 + k, false, 0x3a3a40);
        rg.scale(s, s, s);
        put(ctx, "stoneDark", rg, F(Math.cos(a) * d, A.z + Math.sin(a) * d, pr() * 6), 0, s * 0.4, 0, 0, 0, 0, 0xffffff);
      }
    }
    // braziers at the rim, between the arena edge and the parapet
    for (const a of [-0.6, 0.85, 2.05, 3.6]) {
      const x = Math.cos(a) * 17.0;
      const z = A.z + Math.sin(a) * 17.0;
      brazier(x, z, 0, false);
      col.circle(X + x, z, 0.5);
    }
    // torn banners on poles at the rim
    for (const a of [0.55, 1.05, 1.95, 2.35]) {
      const x = Math.cos(a) * (RING + 0.2);
      const z = A.z + Math.sin(a) * (RING + 0.2);
      const f = F(x, z, -a + Math.PI / 2);
      put(ctx, "flat", new THREE.CylinderGeometry(0.08, 0.1, 6.5, 6), f, 0, 3.25, 0, 0, 0, 0, C.timber);
      const g = new THREE.PlaneGeometry(1.2, 3.0, 1, 4);
      const p = g.getAttribute("position");
      for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getY(i) * 1.6 + a * 5) * 0.12);
      g.computeVertexNormals();
      place(g, 0.62, 0, 0, 0, 0, 0);
      place(g, X + x, 4.8, z, 0, -a, 0);
      bannerGeos.push(tint(g, 0xffffff));
    }
  }
  // far below: the keep's lower roofs and walls, and the mire
  {
    const lr = rng(55);
    for (let k = 0; k < 14; k++) {
      const a = lr() * Math.PI * 2;
      const d = 26 + lr() * 30;
      const x = Math.cos(a) * d;
      const z = A.z + Math.sin(a) * d * 0.8;
      if (z < 60) continue;
      const w = 6 + lr() * 10;
      const hh = 6 + lr() * 10;
      const y = -22 - lr() * 14;
      put(ctx, "stoneDark", boxUV(w, hh, w * 0.8, 3, 3), F(x, z, lr() * 3, y), 0, hh / 2, 0, 0, 0, 0, 0x2a2a30, false);
      put(ctx, "shingle", new THREE.ConeGeometry(w * 0.72, 4, 4), F(x, z, lr() * 3, y + hh), 0, 2, 0, 0, Math.PI / 4, 0, 0x2a2c30, false);
    }
    const g = new THREE.PlaneGeometry(320, 320);
    g.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color: 0x1a2018 }));
    m.position.set(X, -46, 110);
    root.add(m);
  }

  // ------------------------------------------------------------ the grey sky over the open courts
  {
    const g = new THREE.SphereGeometry(170, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2 + 0.25);
    const p = g.getAttribute("position");
    const col_ = new Float32Array(p.count * 3);
    const top = new THREE.Color(0x24262a);
    const hor = new THREE.Color(0x4a4e56);
    const c = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i) / 170;
      c.copy(hor).lerp(top, Math.min(1, Math.max(0, y * 1.6)));
      c.multiplyScalar(0.92 + fbm(p.getX(i) * 0.03, p.getZ(i) * 0.03 + y * 3, 3) * 0.2);
      col_.set([c.r, c.g, c.b], i * 3);
    }
    g.setAttribute("color", new THREE.BufferAttribute(col_, 3));
    const geo = inward(g);
    const sky = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, depthWrite: false }));
    sky.position.set(X, -10, 70);
    sky.renderOrder = -1;
    sky.frustumCulled = false;
    sky.name = "sky";
    root.add(sky);
  }

  // ------------------------------------------------------------ rain: streaks that follow you under the open sky
  const RAIN_H = 24;
  const rain = new THREE.LineSegments(
    (() => {
      const n = 900;
      const pos = new Float32Array(n * 2 * 2 * 3);
      const rr = rng(3);
      for (let i = 0; i < n; i++) {
        const x = (rr() - 0.5) * 50;
        const z = (rr() - 0.5) * 50;
        const y = rr() * RAIN_H;
        const len = 0.6 + rr() * 0.5;
        for (const off of [0, RAIN_H]) {
          const o = (i * 2 + (off ? 1 : 0)) * 6;
          pos.set([x, y + off, z, x + 0.08, y + off - len, z + 0.05], o);
        }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      return g;
    })(),
    new THREE.LineBasicMaterial({ color: 0x8e98a4, transparent: true, opacity: 0.32, depthWrite: false }),
  );
  rain.frustumCulled = false;
  rain.name = "rain";
  root.add(rain);
  // a little splash shimmer on the arena floor (glows that never move)
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2 + 0.4;
    glows.push({ x: X + Math.cos(a) * 9, y: 0.15, z: A.z + Math.sin(a) * 9, size: 1.2, color: 0x6a7a8a });
  }

  // ------------------------------------------------------------ finish
  if (bannerGeos.length) {
    const m = new THREE.Mesh(merge(bannerGeos), new THREE.MeshLambertMaterial({ map: keepBannerTex(), side: THREE.DoubleSide, vertexColors: true, alphaTest: 0.4 }));
    m.castShadow = true;
    root.add(m);
  }
  batch.build(root);
  const nodes = zoneNodes(M, root, col, "keep", groundAt);

  // ------------------------------------------------------------ levers, doors, flags
  let lastT = 0;
  let armouryCheckAt = -1;
  let cryptCheckAt = -1;
  let winchSpin = 0;
  const was = { winch: env.flag("keep_winch"), armoury: env.flag("armoury"), crypt: env.flag("crypt") };
  const meHere = () => {
    const me = env.players()[0];
    return !!me && me.zone === "keep" && !me.dead ? me : null;
  };

  const interacts: ZoneInteract[] = [
    {
      x: X + WINCH.x, z: WINCH.z, r: 2.2,
      label: () => (env.flag("keep_winch") ? null : "Turn the winch"),
      act: () => {
        if (env.flag("keep_winch")) return;
        env.audio.clack();
        env.audio.charge();
        winchSpin = 2.2;
        env.setFlag("keep_winch");
      },
    },
    {
      x: X + ARM_DOOR.x - 1.4, z: ARM_DOOR.z, r: 2.2,
      label: () => (env.flag("armoury") ? null : "Force the armoury door"),
      act: () => {
        if (env.flag("armoury")) return;
        env.audio.thud();
        env.shake(0.1);
        env.setFlag("armoury");
        armouryCheckAt = lastT + 1.0;
      },
    },
    {
      x: X + LEVER.x - 0.6, z: LEVER.z, r: 1.9,
      label: () => (env.flag("crypt") ? null : "The crypt chain"),
      act: () => {
        if (env.flag("crypt")) return;
        env.audio.clack();
        env.setFlag("crypt");
        cryptCheckAt = lastT + 1.0;
      },
    },
  ];

  const ceiling = (x: number, z: number) => {
    const lx = x - X;
    if (z < -0.5) return 3.4;
    if (z < 14) return 6.0;
    if (z < 30) return 14;
    if (z < 56.5) return lx < -20.5 || lx > 20.5 ? 6.0 : 14;
    if (z < STAIR_DOWN.z1) return 3.2;
    if (z < 86.4) return 3.8;
    if (z < 106) return 7.5;
    return 16;
  };

  const update = (dt: number, t: number) => {
    lastT = t;
    const me = meHere();
    const lift = (o: THREE.Object3D, up: boolean, h: number, speed: number) => {
      o.position.y += ((up ? h : 0) - o.position.y) * Math.min(1, dt * speed);
    };
    lift(portcullis, env.flag("keep_winch"), 5.0, 1.2);
    lift(grate, env.flag("crypt"), 3.6, 0.9);
    armDoor.rotation.y += ((env.flag("armoury") ? 1.45 : 0) - armDoor.rotation.y) * Math.min(1, dt * 2.5);
    leverArm.rotation.z += ((env.flag("crypt") ? -0.9 : 0.9) - leverArm.rotation.z) * Math.min(1, dt * 6);
    if (winchSpin > 0 || (env.flag("keep_winch") && !was.winch)) {
      winchSpin = Math.max(0, winchSpin - dt);
      winchSpokes.rotation.z += dt * 3.2;
    }
    // what the keep says when its doors move (only to whoever is here)
    if (env.flag("keep_winch") && !was.winch) {
      winchSpin = Math.max(winchSpin, 2.0);
      env.audio.gate();
      if (me) env.say("The chain bites. The inner portcullis grinds up into the wall.");
    }
    if (env.flag("armoury") && !was.armoury) {
      env.audio.thud();
      env.shake(0.2);
      if (me) env.say("The bar on the far side gives. The armoury door swings in.");
    }
    if (env.flag("crypt") && !was.crypt) {
      env.audio.gate();
      env.shake(0.3);
      if (me) env.say("Somewhere under the courtyard, a grate drags up its chain. The crypt is open.");
    }
    was.winch = env.flag("keep_winch");
    was.armoury = env.flag("armoury");
    was.crypt = env.flag("crypt");
    if (armouryCheckAt > 0 && t >= armouryCheckAt) {
      armouryCheckAt = -1;
      if (!env.flag("armoury")) env.say("The door is barred from the barracks side. Its captain holds the key.");
    }
    if (cryptCheckAt > 0 && t >= cryptCheckAt) {
      cryptCheckAt = -1;
      if (!env.flag("crypt")) env.say("The chain will not move. Something holds it from below.");
    }
    // rain falls where the sky is open
    const p = me ?? env.players()[0];
    if (p) {
      const open = ceiling(p.x, p.z) > 10;
      rain.visible = open;
      if (open) rain.position.set(p.x, -((t * 15) % RAIN_H) - 1, p.z);
    }
  };

  const regionAt = (x: number, z: number) => {
    const lx = x - X;
    if (z < 14) return "gatehouse";
    if (z < 30) return "bailey";
    if (z < 56.5) {
      if (lx < -20.5) return "barracks";
      if (lx > 20.5) return "armoury";
      return "courtyard";
    }
    if (z < 86.4) return "crypt";
    if (z < 106) return "throne";
    return "broken_ring";
  };
  const regions: Record<string, [string, string]> = {
    gatehouse: ["The Gatehouse", "A winch, a chain, a portcullis"],
    bailey: ["The Outer Bailey", "Rain on black stone"],
    courtyard: ["The Black Courtyard", "The banners never come down"],
    barracks: ["The Barracks", "The bunks are still made"],
    armoury: ["The Armoury", "Black iron, and the crypt chain"],
    crypt: ["The Crypt", "The kings of the March, and their guard"],
    throne: ["The Throne Room", "Nobody has sat there in years"],
    broken_ring: ["The Broken Ring", "He is already here."],
  };
  const surfaceAt = (x: number, z: number): "wood" | "stone" | "dirt" | "grass" => {
    const lx = x - X;
    if (z > 30 && z < 56.5 && Math.abs(lx - 12) < 2.2 && Math.abs(z - 51) < 2.2) return "dirt";
    return "stone";
  };
  const blocked = (x: number, z: number) => {
    const lx = x - X;
    if (z < 106) return false;
    return Math.hypot(lx - A.x, z - A.z) > RING + 0.2;
  };

  const anchors: Record<string, THREE.Vector3> = {
    entry: new THREE.Vector3(X, 0, 4),
    exit: new THREE.Vector3(X, 0, 2),
    winch: new THREE.Vector3(X + WINCH.x, 0, WINCH.z),
    portcullis: new THREE.Vector3(X, 0, 14),
    bailey: new THREE.Vector3(X, 0, 22),
    courtyard: new THREE.Vector3(X, 0, 42),
    barracks: new THREE.Vector3(X - 24, 0, 40),
    armouryDoor: new THREE.Vector3(X + ARM_DOOR.x - 1.4, 0, ARM_DOOR.z),
    armoury: new THREE.Vector3(X + 28, 0, 40),
    lever: new THREE.Vector3(X + LEVER.x - 0.6, 0, LEVER.z),
    cryptDoor: new THREE.Vector3(X, 0, 56),
    crypt: new THREE.Vector3(X, CRYPT_Y, 70),
    tomb: new THREE.Vector3(X, CRYPT_Y, 82),
    cryptStairUp: new THREE.Vector3(X + 7, CRYPT_Y, 77),
    throne: new THREE.Vector3(X, 0, 100),
    ringDoor: new THREE.Vector3(X, 0, 107),
    arena: new THREE.Vector3(X + A.x, 0, A.z),
    arenaEntry: new THREE.Vector3(X + A.x, 0, A.z - A.r + 2.5),
  };

  return {
    root,
    groundAt,
    blocked,
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
    fog: { color: 0x26282e, density: 0.02 },
  };
}
