import * as THREE from "three";
import { Batch, boxUV, prep, tint } from "../engine/kit";
import type { Mats } from "../engine/materials";
import { rng } from "../engine/noise";
import type { Colliders } from "./collide";

/**
 * Building kit. The grammar is the art bible's: pale stone plinth, dark timber frame,
 * lime plaster, steep thatch or shingle, copper fixings. Every piece is merged into one
 * mesh per material through the Batch, so the whole village is a handful of draw calls.
 */

export type Glow = { x: number; y: number; z: number; size: number; color: number };

export type Ctx = {
  batch: Batch;
  M: Mats;
  col: Colliders;
  h: (x: number, z: number) => number;
  glows: Glow[];
  smoke: THREE.Vector3[];
  fires: THREE.Vector3[];
  lamps: THREE.Vector3[];
};

const T = new THREE.Matrix4();
const R = new THREE.Matrix4();
const tmpV = new THREE.Vector3();

/** A placement frame: local (x,y,z) inside a building rotated by `rot` at world (x,z,y0). */
export class Frame {
  m = new THREE.Matrix4();
  constructor(public x: number, public y: number, public z: number, public rot: number) {
    this.m.makeRotationY(rot).setPosition(x, y, z);
  }
  at(lx: number, ly: number, lz: number) {
    tmpV.set(lx, ly, lz).applyMatrix4(this.m);
    return tmpV.clone();
  }
}

export function put(ctx: Ctx, key: keyof Mats, geo: THREE.BufferGeometry, f: Frame, lx: number, ly: number, lz: number, rx = 0, ry = 0, rz = 0, color: THREE.ColorRepresentation = 0xffffff, shadow = true) {
  if (!geo.getAttribute("color")) tint(geo, color);
  R.makeRotationFromEuler(new THREE.Euler(rx, ry, rz));
  T.makeTranslation(lx, ly, lz).multiply(R);
  geo.applyMatrix4(T).applyMatrix4(f.m);
  ctx.batch.add(key, ctx.M[key], geo, shadow);
}

const C = {
  timber: 0x4a3f34,
  wood: 0x7a5e40,
  iron: 0x55595e,
  copper: 0xb87333,
  wool: 0xcdbba6,
  straw: 0xb59a55,
  green: 0x5e6b45,
};

export function groundMin(ctx: Ctx, x: number, z: number, w: number, d: number, rot: number) {
  const f = new Frame(x, 0, z, rot);
  let lo = Infinity;
  for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, 0]]) {
    const p = f.at((a * w) / 2, 0, (b * d) / 2);
    lo = Math.min(lo, ctx.h(p.x, p.z));
  }
  return lo;
}

export type CottageOpts = { roof: "thatch" | "shingle"; chimney?: boolean; doorX?: number; pitch?: number; h?: number; seed?: number; stoneGround?: boolean };

export function cottage(ctx: Ctx, x: number, z: number, w: number, d: number, rot: number, o: CottageOpts) {
  const base = groundMin(ctx, x, z, w, d, rot);
  const f = new Frame(x, base, z, rot);
  const r = rng(o.seed ?? Math.floor(x * 13 + z * 7));
  const H = o.h ?? 2.7;
  const pitch = o.pitch ?? 0.92;
  const plinth = 0.55;
  const top = plinth + H;
  put(ctx, "stone", boxUV(w + 0.4, 1.0, d + 0.4, 2, 1), f, 0, plinth - 0.5, 0);
  if (o.stoneGround) {
    put(ctx, "stone", boxUV(w, 1.3, d, 2, 1), f, 0, plinth + 0.65, 0);
    put(ctx, "plaster", boxUV(w - 0.02, H - 1.3, d - 0.02, 4, 3), f, 0, plinth + 1.3 + (H - 1.3) / 2, 0);
  } else put(ctx, "plaster", boxUV(w, H, d, 4, 3), f, 0, plinth + H / 2, 0);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) put(ctx, "flat", new THREE.BoxGeometry(0.24, H + 0.1, 0.24), f, (sx * w) / 2, plinth + H / 2, (sz * d) / 2, 0, 0, 0, C.timber);
  put(ctx, "flat", new THREE.BoxGeometry(w + 0.2, 0.22, 0.24), f, 0, top, d / 2, 0, 0, 0, C.timber);
  put(ctx, "flat", new THREE.BoxGeometry(w + 0.2, 0.22, 0.24), f, 0, top, -d / 2, 0, 0, 0, C.timber);
  put(ctx, "flat", new THREE.BoxGeometry(w + 0.2, 0.2, 0.22), f, 0, plinth + 0.08, d / 2 + 0.01, 0, 0, 0, C.timber);
  // roof
  const over = 0.5;
  const half = d / 2 + over;
  const rise = (d / 2) * Math.tan(pitch);
  const ridge = top + rise;
  const slabL = half / Math.cos(pitch);
  const thick = o.roof === "thatch" ? 0.42 : 0.16;
  const key = o.roof === "thatch" ? "thatch" : "shingle";
  for (const s of [1, -1]) {
    const g = boxUV(w + over * 2, thick, slabL, 2, 2);
    const n = new THREE.Vector3(0, Math.cos(pitch), s * Math.sin(pitch));
    put(ctx, key, g, f, n.x * thick * 0.5, ridge - (half * Math.tan(pitch)) / 2 + n.y * thick * 0.5, s * (half / 2) + n.z * thick * 0.5, s * pitch, 0, 0, o.roof === "thatch" ? 0xf0e4cc : 0xffffff);
  }
  put(ctx, key, new THREE.CylinderGeometry(thick * 0.8, thick * 0.8, w + over * 2, 6), f, 0, ridge + thick * 0.45, 0, 0, 0, Math.PI / 2, o.roof === "thatch" ? 0xc8b48c : 0xbbbbbb);
  // gables
  const shape = new THREE.Shape();
  shape.moveTo(-d / 2, 0);
  shape.lineTo(d / 2, 0);
  shape.lineTo(0, rise);
  shape.closePath();
  for (const s of [1, -1]) {
    const g = new THREE.ExtrudeGeometry(shape, { depth: 0.2, bevelEnabled: false });
    const uv = g.getAttribute("uv");
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 4, uv.getY(i) / 3 + 0.5);
    g.rotateY(Math.PI / 2);
    put(ctx, "plaster", g, f, s * (w / 2) - (s > 0 ? 0.2 : 0), top, 0);
    put(ctx, "flat", new THREE.BoxGeometry(0.18, 0.18, Math.hypot(d / 2, rise) + 0.1), f, s * (w / 2 + 0.02), top + rise / 2, d / 4, Math.atan2(rise, d / 2), 0, 0, C.timber);
    put(ctx, "flat", new THREE.BoxGeometry(0.18, 0.18, Math.hypot(d / 2, rise) + 0.1), f, s * (w / 2 + 0.02), top + rise / 2, -d / 4, -Math.atan2(rise, d / 2), 0, 0, C.timber);
    put(ctx, "flat", new THREE.BoxGeometry(0.16, rise, 0.16), f, s * (w / 2 + 0.03), top + rise / 2, 0, 0, 0, 0, C.timber);
  }
  // door and windows
  const dx = o.doorX ?? (r() - 0.5) * (w - 2.4);
  put(ctx, "planksDark", boxUV(1.05, 1.95, 0.12, 1, 2), f, dx, plinth + 0.98, d / 2 + 0.04);
  put(ctx, "flat", new THREE.BoxGeometry(1.35, 0.18, 0.2), f, dx, plinth + 2.0, d / 2 + 0.06, 0, 0, 0, C.timber);
  put(ctx, "metal", new THREE.SphereGeometry(0.05, 6, 4), f, dx + 0.35, plinth + 1.0, d / 2 + 0.13, 0, 0, 0, C.copper, false);
  put(ctx, "stone", boxUV(1.6, 0.18, 0.7, 1, 1), f, dx, plinth - 0.05, d / 2 + 0.45);
  const wins: [number, number, number][] = [];
  for (const wx of [-w / 2 + 1.1, w / 2 - 1.1]) if (Math.abs(wx - dx) > 1.3) wins.push([wx, d / 2 + 0.05, 0]);
  wins.push([0, -d / 2 - 0.05, Math.PI]);
  wins.push([w / 2 + 0.05, 0, Math.PI / 2]);
  for (const [wx, wz, wr] of wins) {
    const lx = wr === Math.PI / 2 ? w / 2 + 0.06 : wx;
    const lz = wr === Math.PI / 2 ? (r() - 0.5) * (d - 2) : wz;
    put(ctx, "window", new THREE.BoxGeometry(0.72, 0.62, 0.08), f, lx, plinth + 1.55, lz, 0, wr, 0, 0xffffff, false);
    put(ctx, "flat", new THREE.BoxGeometry(0.9, 0.1, 0.2), f, lx, plinth + 1.2, lz, 0, wr, 0, C.timber);
    put(ctx, "flat", new THREE.BoxGeometry(0.06, 0.62, 0.1), f, lx, plinth + 1.55, lz, 0, wr, 0, C.timber);
    for (const s of [-1, 1]) {
      const sx = wr === Math.PI / 2 ? lx + 0.04 : lx + s * 0.55;
      const sz = wr === Math.PI / 2 ? lz + s * 0.55 : lz + (wr === Math.PI ? -0.04 : 0.04);
      put(ctx, "planks", boxUV(0.36, 0.66, 0.05, 0.5, 1), f, sx, plinth + 1.55, sz, 0, wr + s * 0.25, 0, 0xc0b0a0);
    }
    const wp = f.at(lx, plinth + 1.55, lz);
    ctx.glows.push({ x: wp.x, y: wp.y, z: wp.z, size: 2.2, color: 0xffa040 });
  }
  if (o.chimney !== false) {
    const cx = w / 2 - 0.9;
    const ch = rise + 1.6;
    put(ctx, "stone", boxUV(0.75, ch, 0.75, 1, 1), f, cx, top + ch / 2 - 0.4, -d * 0.18);
    put(ctx, "stone", boxUV(0.9, 0.15, 0.9, 1, 1), f, cx, top + ch - 0.35, -d * 0.18);
    ctx.smoke.push(f.at(cx, top + ch - 0.2, -d * 0.18));
  }
  ctx.col.box(x, z, w + 0.5, d + 0.5, rot);
  return { frame: f, door: f.at(dx, 0, d / 2 + 1.2), base };
}

export function crate(ctx: Ctx, x: number, z: number, s = 0.7, rot = 0) {
  const f = new Frame(x, ctx.h(x, z), z, rot);
  put(ctx, "planks", boxUV(s, s, s, 0.8, 0.8), f, 0, s / 2, 0);
  for (const e of [-1, 1]) put(ctx, "flat", new THREE.BoxGeometry(s + 0.02, 0.06, 0.06), f, 0, s / 2 + e * (s / 2 - 0.05), s / 2 + 0.01, 0, 0, 0, C.timber);
  ctx.col.circle(x, z, s * 0.6);
}

export function barrel(ctx: Ctx, x: number, z: number, s = 1, water = false) {
  const f = new Frame(x, ctx.h(x, z), z, 0);
  const g = new THREE.CylinderGeometry(0.34 * s, 0.3 * s, 0.9 * s, 12, 3);
  const p = g.getAttribute("position");
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i) / (0.45 * s);
    const k = 1 + (1 - y * y) * 0.12;
    p.setX(i, p.getX(i) * k);
    p.setZ(i, p.getZ(i) * k);
  }
  g.computeVertexNormals();
  put(ctx, "planks", g, f, 0, 0.45 * s, 0, 0, 0, 0, 0xd0c0a8);
  for (const y of [0.15, 0.75]) put(ctx, "metal", new THREE.TorusGeometry(0.35 * s, 0.025, 4, 14), f, 0, y * s, 0, Math.PI / 2, 0, 0, C.iron, false);
  if (water) put(ctx, "flat", new THREE.CircleGeometry(0.31 * s, 12), f, 0, 0.85 * s, 0, -Math.PI / 2, 0, 0, 0x2c3530, false);
  ctx.col.circle(x, z, 0.38 * s);
}

export function sack(ctx: Ctx, x: number, z: number) {
  const f = new Frame(x, ctx.h(x, z), z, x * 3);
  const g = new THREE.SphereGeometry(0.3, 8, 6);
  g.scale(1, 1.2, 0.85);
  put(ctx, "flat", g, f, 0, 0.3, 0, 0, 0, 0, 0xa8977a);
}

export function hay(ctx: Ctx, x: number, z: number, rot = 0) {
  const f = new Frame(x, ctx.h(x, z), z, rot);
  put(ctx, "thatch", new THREE.CylinderGeometry(0.55, 0.55, 1.2, 12), f, 0, 0.55, 0, 0, 0, Math.PI / 2, 0xffeac0);
  ctx.col.circle(x, z, 0.7);
}

export function woodpile(ctx: Ctx, x: number, z: number, rot = 0) {
  const f = new Frame(x, ctx.h(x, z), z, rot);
  for (let row = 0; row < 3; row++)
    for (let i = 0; i < 5 - row; i++) {
      const g = new THREE.CylinderGeometry(0.13, 0.13, 1.3, 7);
      put(ctx, "bark", g, f, -0.55 + i * 0.27 + row * 0.13, 0.13 + row * 0.24, 0, 0, 0, Math.PI / 2, 0xffffff);
    }
  ctx.col.box(x, z, 1.5, 0.6, rot);
}

export function bench(ctx: Ctx, x: number, z: number, rot = 0) {
  const f = new Frame(x, ctx.h(x, z), z, rot);
  put(ctx, "planks", boxUV(1.6, 0.08, 0.4, 1, 1), f, 0, 0.45, 0);
  for (const s of [-1, 1]) put(ctx, "flat", new THREE.BoxGeometry(0.08, 0.45, 0.35), f, s * 0.65, 0.22, 0, 0, 0, 0, C.timber);
}

export function lamp(ctx: Ctx, x: number, z: number, rot = 0) {
  const y = ctx.h(x, z);
  const f = new Frame(x, y, z, rot);
  put(ctx, "flat", new THREE.BoxGeometry(0.16, 2.8, 0.16), f, 0, 1.4, 0, 0, 0, 0, C.timber);
  put(ctx, "flat", new THREE.BoxGeometry(0.1, 0.1, 0.7), f, 0, 2.7, 0.3, 0, 0, 0, C.timber);
  put(ctx, "metal", new THREE.BoxGeometry(0.28, 0.06, 0.28), f, 0, 2.52, 0.6, 0, 0, 0, C.iron, false);
  put(ctx, "metal", new THREE.ConeGeometry(0.22, 0.18, 4), f, 0, 2.3, 0.6, 0, Math.PI / 4, 0, C.iron, false);
  put(ctx, "window", new THREE.BoxGeometry(0.2, 0.26, 0.2), f, 0, 2.1, 0.6, 0, 0, 0, 0xffffff, false);
  const p = f.at(0, 2.1, 0.6);
  ctx.glows.push({ x: p.x, y: p.y, z: p.z, size: 4, color: 0xffb060 });
  ctx.lamps.push(p);
  ctx.col.circle(x, z, 0.2);
}

export function signpost(ctx: Ctx, x: number, z: number, rot: number, mat: THREE.Material) {
  const f = new Frame(x, ctx.h(x, z), z, rot);
  put(ctx, "flat", new THREE.BoxGeometry(0.14, 1.9, 0.14), f, 0, 0.95, 0, 0, 0, 0, C.timber);
  const g = prep(new THREE.BoxGeometry(0.9, 0.45, 0.06));
  const m = new THREE.Mesh(g, mat);
  m.position.copy(f.at(0, 1.6, 0.08));
  m.rotation.y = rot;
  m.castShadow = true;
  ctx.col.circle(x, z, 0.15);
  return m;
}

export function fence(ctx: Ctx, pts: [number, number][], gapEvery = 0) {
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i];
    const [bx, bz] = pts[i + 1];
    const len = Math.hypot(bx - ax, bz - az);
    const n = Math.max(1, Math.round(len / 2));
    const rot = Math.atan2(bx - ax, bz - az);
    for (let k = 0; k <= n; k++) {
      const x = ax + ((bx - ax) * k) / n;
      const z = az + ((bz - az) * k) / n;
      const f = new Frame(x, ctx.h(x, z), z, rot);
      put(ctx, "flat", new THREE.BoxGeometry(0.12, 1.1, 0.12), f, 0, 0.5, 0, (Math.sin(x * 7) * 0.06), 0, 0, C.wood);
      if (k < n && !(gapEvery && i === gapEvery)) {
        const mx = x + (bx - ax) / n / 2;
        const mz = z + (bz - az) / n / 2;
        const g = new Frame(mx, ctx.h(mx, mz), mz, rot);
        for (const y of [0.45, 0.85]) put(ctx, "flat", new THREE.BoxGeometry(0.06, 0.08, len / n + 0.1), g, 0, y, 0, 0, 0, 0, C.wood);
        ctx.col.box(mx, mz, 0.2, len / n, rot);
      }
    }
  }
}

export function well(ctx: Ctx, x: number, z: number) {
  const f = new Frame(x, ctx.h(x, z), z, 0.3);
  put(ctx, "stone", new THREE.CylinderGeometry(1.0, 1.05, 0.9, 16, 1, true), f, 0, 0.45, 0);
  put(ctx, "stone", new THREE.TorusGeometry(0.98, 0.12, 6, 18), f, 0, 0.9, 0, Math.PI / 2, 0, 0);
  put(ctx, "flat", new THREE.CircleGeometry(0.95, 16), f, 0, 0.35, 0, -Math.PI / 2, 0, 0, 0x1e2622, false);
  for (const s of [-1, 1]) put(ctx, "flat", new THREE.BoxGeometry(0.14, 2.2, 0.14), f, s * 0.9, 1.1, 0, 0, 0, 0, C.timber);
  put(ctx, "flat", new THREE.CylinderGeometry(0.08, 0.08, 2.0, 6), f, 0, 1.75, 0, 0, 0, Math.PI / 2, C.wood);
  for (const s of [-1, 1]) put(ctx, "shingle", boxUV(2.3, 0.08, 1.0, 2, 2), f, 0, 2.35, s * 0.42, s * 0.6, 0, 0);
  put(ctx, "planks", new THREE.CylinderGeometry(0.16, 0.13, 0.25, 8), f, 0.3, 1.2, 0, 0, 0, 0, 0xc0a080);
  ctx.col.circle(x, z, 1.15);
}

export function trough(ctx: Ctx, x: number, z: number, rot: number) {
  const f = new Frame(x, ctx.h(x, z), z, rot);
  put(ctx, "planks", boxUV(1.8, 0.5, 0.6, 1, 1), f, 0, 0.25, 0);
  put(ctx, "flat", new THREE.PlaneGeometry(1.6, 0.45), f, 0, 0.48, 0, -Math.PI / 2, 0, 0, 0x2e3a36, false);
  ctx.col.box(x, z, 1.9, 0.7, rot);
}

export function skep(ctx: Ctx, x: number, z: number) {
  const f = new Frame(x, ctx.h(x, z), z, 0);
  put(ctx, "flat", new THREE.CylinderGeometry(0.4, 0.4, 0.6, 8), f, 0, 0.3, 0, 0, 0, 0, C.timber);
  const g = new THREE.SphereGeometry(0.45, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  g.scale(1, 1.3, 1);
  put(ctx, "thatch", g, f, 0, 0.6, 0, 0, 0, 0, 0xffe8b0);
  ctx.col.circle(x, z, 0.5);
}

export function cabbages(ctx: Ctx, x0: number, z0: number, w: number, d: number) {
  const f0 = new Frame(x0, ctx.h(x0, z0) + 0.02, z0, 0);
  put(ctx, "flat", new THREE.PlaneGeometry(w, d), f0, 0, 0.04, 0, -Math.PI / 2, 0, 0, 0x3e3226, false);
  for (let i = 0; i < w - 0.5; i += 0.7)
    for (let j = 0; j < d - 0.5; j += 0.7) {
      const g = new THREE.IcosahedronGeometry(0.22, 1);
      g.scale(1, 0.7, 1);
      put(ctx, "flat", g, f0, -w / 2 + 0.4 + i, 0.15, -d / 2 + 0.4 + j, 0, 0, 0, (i + j) % 1.4 < 0.7 ? 0x6a8048 : 0x7f9152, false);
    }
}

export function cart(ctx: Ctx, x: number, z: number, rot: number) {
  const f = new Frame(x, ctx.h(x, z), z, rot);
  put(ctx, "planks", boxUV(1.4, 0.5, 2.2, 1, 1), f, 0, 0.8, 0);
  for (const s of [-1, 1]) {
    const wheel = new THREE.CylinderGeometry(0.55, 0.55, 0.12, 12);
    put(ctx, "planksDark", wheel, f, s * 0.78, 0.55, 0.1, 0, 0, Math.PI / 2);
  }
  put(ctx, "flat", new THREE.BoxGeometry(0.08, 0.08, 2.0), f, -0.3, 0.6, 1.9, -0.25, 0, 0, C.wood);
  put(ctx, "flat", new THREE.BoxGeometry(0.08, 0.08, 2.0), f, 0.3, 0.6, 1.9, -0.25, 0, 0, C.wood);
  ctx.col.box(x, z, 1.7, 2.5, rot);
}

export function stall(ctx: Ctx, x: number, z: number, rot: number) {
  const f = new Frame(x, ctx.h(x, z), z, rot);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) put(ctx, "flat", new THREE.BoxGeometry(0.14, 2.4, 0.14), f, sx * 1.4, 1.2, sz * 0.8, 0, 0, 0, C.timber);
  put(ctx, "planks", boxUV(3.0, 0.9, 1.0, 1, 1), f, 0, 0.45, 0.55);
  for (let i = 0; i < 8; i++) {
    const g = new THREE.BoxGeometry(0.42, 0.06, 1.9);
    put(ctx, "flat", g, f, -1.5 + 0.375 + i * 0.375, 2.4 + 0.12 * Math.cos(i), 0, 0.2, 0, 0, i % 2 ? 0xcdbba6 : 0x6a7a52);
  }
  for (let i = 0; i < 6; i++) {
    const g = new THREE.SphereGeometry(0.1, 6, 5);
    put(ctx, "flat", g, f, -1.1 + i * 0.42, 0.98, 0.6 + (i % 2) * 0.15, 0, 0, 0, [0xb8813a, 0xd7a441, 0x7a8a4a, 0x9a5a3a][i % 4], false);
  }
  crate(ctx, f.at(1.8, 0, 0.6).x, f.at(1.8, 0, 0.6).z, 0.6, rot);
  ctx.col.box(x, z, 3.2, 2.0, rot);
}

/** A ring of sharpened stakes with gaps at the given angles (radians). */
export function palisade(ctx: Ctx, cx: number, cz: number, r: number, gaps: number[], gapHalf: number) {
  const rr = rng(77);
  const n = Math.round((Math.PI * 2 * r) / 0.42);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    if (gaps.some((g) => Math.abs(Math.atan2(Math.sin(a - g), Math.cos(a - g))) < gapHalf / r)) continue;
    const x = cx + Math.cos(a) * r;
    const z = cz + Math.sin(a) * r;
    const h = 3.0 + rr() * 1.1;
    const y = ctx.h(x, z);
    const f = new Frame(x, y, z, -a);
    const stake = new THREE.CylinderGeometry(0.19, 0.21, h, 6);
    put(ctx, "bark", stake, f, 0, h / 2 - 0.3, 0, (rr() - 0.5) * 0.08, 0, 0.06, 0xffffff);
    put(ctx, "bark", new THREE.ConeGeometry(0.19, 0.5, 6), f, 0, h - 0.05, 0, 0, 0, 0.06, 0xd8c8b0);
    if (i % 3 === 0) ctx.col.circle(x, z, 0.55);
  }
  for (const g of gaps) {
    for (const s of [-1, 1]) {
      const a = g + (s * (gapHalf + 0.3)) / r;
      const x = cx + Math.cos(a) * r;
      const z = cz + Math.sin(a) * r;
      const f = new Frame(x, ctx.h(x, z), z, -a);
      put(ctx, "flat", new THREE.BoxGeometry(0.4, 5, 0.4), f, 0, 2.3, 0, 0, 0, 0, C.timber);
      ctx.col.circle(x, z, 0.4);
    }
    const x = cx + Math.cos(g) * r;
    const z = cz + Math.sin(g) * r;
    const f = new Frame(x, ctx.h(x, z), z, -g + Math.PI / 2);
    put(ctx, "flat", new THREE.BoxGeometry(gapHalf * 2 + 1.4, 0.35, 0.4), f, 0, 4.6, 0, 0, 0, 0, C.timber);
    for (const s of [-1, 1]) put(ctx, "shingle", boxUV(gapHalf * 2 + 2, 0.08, 1.0, 2, 2), f, 0, 5.0, s * 0.38, s * 0.55, 0, 0);
  }
}

export function bellFrame(ctx: Ctx, x: number, z: number, rot: number) {
  const f = new Frame(x, ctx.h(x, z), z, rot);
  for (const s of [-1, 1]) {
    put(ctx, "flat", new THREE.BoxGeometry(0.28, 4.4, 0.28), f, s * 1.1, 2.2, 0, 0, 0, s * 0.05, C.timber);
    put(ctx, "flat", new THREE.BoxGeometry(0.16, 1.8, 0.16), f, s * 0.75, 0.7, 0, 0, 0, s * -0.5, C.timber);
    put(ctx, "stone", boxUV(0.7, 0.4, 0.7, 1, 1), f, s * 1.1, 0.15, 0);
  }
  put(ctx, "flat", new THREE.BoxGeometry(2.8, 0.26, 0.3), f, 0, 4.3, 0, 0, 0, 0, C.timber);
  for (const s of [-1, 1]) put(ctx, "shingle", boxUV(3.2, 0.08, 1.0, 2, 2), f, 0, 4.75, s * 0.36, s * 0.75, 0, 0);
  const bell = new THREE.Group();
  const bm = new THREE.Mesh(
    new THREE.LatheGeometry([new THREE.Vector2(0.06, 0), new THREE.Vector2(0.22, 0.05), new THREE.Vector2(0.28, 0.35), new THREE.Vector2(0.42, 0.62), new THREE.Vector2(0.44, 0.68), new THREE.Vector2(0.0, 0.68)], 16),
    new THREE.MeshPhongMaterial({ color: 0xa8743a, shininess: 70, specular: 0x886644 }),
  );
  bm.rotation.x = Math.PI;
  bm.position.y = -0.05;
  bm.castShadow = true;
  bell.add(bm);
  bell.position.copy(f.at(0, 4.15, 0));
  bell.rotation.y = rot;
  ctx.col.circle(f.at(1.1, 0, 0).x, f.at(1.1, 0, 0).z, 0.35);
  ctx.col.circle(f.at(-1.1, 0, 0).x, f.at(-1.1, 0, 0).z, 0.35);
  return bell;
}

export function smithy(ctx: Ctx, x: number, z: number, rot: number) {
  const base = groundMin(ctx, x, z, 7, 5, rot);
  const f = new Frame(x, base, z, rot);
  put(ctx, "stone", boxUV(7.4, 0.6, 5.4, 2, 1), f, 0, 0.0, 0);
  put(ctx, "flagstone", boxUV(7.0, 0.1, 5.0, 3, 3), f, 0, 0.32, 0);
  for (const [sx, sz] of [[-1, 1], [1, 1], [0, 1], [-1, -1], [1, -1]]) put(ctx, "flat", new THREE.BoxGeometry(0.26, 3.6, 0.26), f, sx * 3.3, 2.1, sz * 2.3, 0, 0, 0, C.timber);
  put(ctx, "stone", boxUV(7.0, 1.9, 0.5, 2, 1), f, 0, 1.25, -2.3);
  put(ctx, "plaster", boxUV(7.0, 1.6, 0.4, 4, 3), f, 0, 3.0, -2.3);
  put(ctx, "flat", new THREE.BoxGeometry(7.2, 0.24, 0.26), f, 0, 3.9, 2.3, 0, 0, 0, C.timber);
  const pitch = 0.35;
  put(ctx, "shingle", boxUV(8.0, 0.16, 6.0, 2, 2), f, 0, 4.35, 0, -pitch, 0, 0);
  // forge hearth
  put(ctx, "stone", boxUV(2.0, 1.0, 1.4, 1, 1), f, -1.9, 0.85, -1.4);
  put(ctx, "ember", new THREE.BoxGeometry(1.2, 0.1, 0.7), f, -1.9, 1.38, -1.35, 0, 0, 0, 0xffffff, false);
  put(ctx, "stone", new THREE.CylinderGeometry(0.35, 1.0, 1.2, 4, 1, true), f, -1.9, 2.4, -1.5, 0, Math.PI / 4, 0);
  put(ctx, "stone", boxUV(0.7, 3.2, 0.7, 1, 1), f, -1.9, 4.2, -1.6);
  ctx.smoke.push(f.at(-1.9, 5.9, -1.6));
  const fp = f.at(-1.9, 1.6, -1.3);
  ctx.fires.push(fp);
  ctx.glows.push({ x: fp.x, y: fp.y, z: fp.z, size: 6, color: 0xff7a30 });
  // bellows, anvil, quench, rack
  put(ctx, "planksDark", boxUV(0.9, 0.3, 0.7, 1, 1), f, -3.0, 1.1, -1.2, 0, 0, 0.2);
  put(ctx, "bark", new THREE.CylinderGeometry(0.4, 0.45, 0.7, 9), f, 0.6, 0.7, -0.2);
  put(ctx, "metal", boxUV(0.85, 0.25, 0.35, 1, 1), f, 0.6, 1.18, -0.2, 0, 0, 0, C.iron);
  put(ctx, "metal", new THREE.ConeGeometry(0.17, 0.45, 6), f, 1.2, 1.2, -0.2, 0, 0, Math.PI / 2, C.iron);
  put(ctx, "metal", boxUV(0.4, 0.25, 0.25, 1, 1), f, 0.6, 0.95, -0.2, 0, 0, 0, C.iron);
  barrel(ctx, f.at(2.4, 0, -1.4).x, f.at(2.4, 0, -1.4).z, 1, true);
  put(ctx, "planks", boxUV(2.2, 1.4, 0.08, 1, 1), f, 1.6, 2.2, -2.0);
  for (let i = 0; i < 5; i++) put(ctx, "metal", new THREE.BoxGeometry(0.05, 0.6, 0.05), f, 0.8 + i * 0.4, 2.2, -1.93, 0, 0, 0.2, C.iron, false);
  put(ctx, "flat", new THREE.CylinderGeometry(0.5, 0.5, 0.15, 14), f, 2.6, 1.0, 1.4, 0, 0, Math.PI / 2, 0x9a948a);
  ctx.col.box(f.at(-1.9, 0, -1.4).x, f.at(-1.9, 0, -1.4).z, 2.2, 1.6, rot);
  ctx.col.circle(f.at(0.6, 0, -0.2).x, f.at(0.6, 0, -0.2).z, 0.55);
  ctx.col.box(f.at(0, 0, -2.3).x, f.at(0, 0, -2.3).z, 7.2, 0.6, rot);
  for (const [sx, sz] of [[-1, 1], [1, 1], [0, 1], [-1, -1], [1, -1]]) {
    const p = f.at(sx * 3.3, 0, sz * 2.3);
    ctx.col.circle(p.x, p.z, 0.25);
  }
  return { anvil: f.at(0.6, 0, 0.75), forge: f.at(-1.9, 0, 0.0) };
}

export function workbench(ctx: Ctx, x: number, z: number, rot: number) {
  const f = new Frame(x, ctx.h(x, z), z, rot);
  put(ctx, "planks", boxUV(2.6, 0.14, 1.0, 1, 1), f, 0, 0.92, 0);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) put(ctx, "flat", new THREE.BoxGeometry(0.14, 0.9, 0.14), f, sx * 1.15, 0.45, sz * 0.38, 0, 0, 0, C.timber);
  put(ctx, "flat", new THREE.BoxGeometry(2.3, 0.08, 0.08), f, 0, 0.3, 0.38, 0, 0, 0, C.timber);
  put(ctx, "metal", boxUV(0.25, 0.22, 0.2, 1, 1), f, 1.0, 1.1, 0.35, 0, 0, 0, C.iron);
  put(ctx, "metal", boxUV(0.6, 0.02, 0.15, 1, 1), f, -0.5, 1.0, 0.1, 0, 0.5, 0, 0xb0b4b8);
  put(ctx, "flat", new THREE.BoxGeometry(0.06, 0.06, 0.3), f, -0.2, 1.03, -0.2, 0, -0.4, 0, C.wood);
  put(ctx, "metal", boxUV(0.14, 0.1, 0.08, 1, 1), f, -0.2, 1.06, -0.05, 0, -0.4, 0, C.iron);
  put(ctx, "planks", boxUV(2.4, 1.6, 0.08, 1, 1), f, 0, 1.9, -0.55);
  for (let i = 0; i < 4; i++) put(ctx, "metal", new THREE.BoxGeometry(0.05, 0.5, 0.05), f, -0.9 + i * 0.6, 2.0, -0.49, 0, 0, i * 0.3, C.iron, false);
  for (let i = 0; i < 4; i++) put(ctx, "planks", boxUV(2.2, 0.06, 0.22, 1, 1), f, 2.3, 0.1 + i * 0.07, 0.2 + (i % 2) * 0.05, 0, 0.1 * i, 0);
  ctx.col.box(x, z, 2.8, 1.3, rot);
}

/** A carved nursery block with a letter: the toy-red note that does not belong. */
export function toyBlock(scene: THREE.Object3D, x: number, y: number, z: number, s: number, rot: [number, number, number], mat: THREE.Material) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), mat);
  m.position.set(x, y, z);
  m.rotation.set(rot[0], rot[1], rot[2]);
  m.castShadow = true;
  m.receiveShadow = true;
  scene.add(m);
  return m;
}
