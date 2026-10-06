import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { fbm, noise2, range, rng, type Rand } from "./noise";

/**
 * Geometry kit. Every generated geometry carries position, normal, uv and color so
 * any of them can be merged into one draw call per material.
 */

export const shared = { time: { value: 0 }, wind: { value: 1 } };

export function tint(geo: THREE.BufferGeometry, color: THREE.ColorRepresentation | ((x: number, y: number, z: number, nx: number, ny: number, nz: number) => THREE.Color)) {
  const pos = geo.getAttribute("position");
  const nor = geo.getAttribute("normal");
  const col = new Float32Array(pos.count * 3);
  const fixed = typeof color === "function" ? null : new THREE.Color(color);
  for (let i = 0; i < pos.count; i++) {
    const c = fixed ?? (color as (x: number, y: number, z: number, nx: number, ny: number, nz: number) => THREE.Color)(
      pos.getX(i), pos.getY(i), pos.getZ(i), nor ? nor.getX(i) : 0, nor ? nor.getY(i) : 1, nor ? nor.getZ(i) : 0,
    );
    col[i * 3] = c.r;
    col[i * 3 + 1] = c.g;
    col[i * 3 + 2] = c.b;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  return geo;
}

/** Normalise a geometry so it can merge with others: indexed, with uv and color. */
export function prep(geo: THREE.BufferGeometry, color: THREE.ColorRepresentation = 0xffffff) {
  if (!geo.index) {
    const n = geo.getAttribute("position").count;
    const idx = new Array(n);
    for (let i = 0; i < n; i++) idx[i] = i;
    geo.setIndex(idx);
  }
  if (!geo.getAttribute("normal")) geo.computeVertexNormals();
  if (!geo.getAttribute("uv")) geo.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(geo.getAttribute("position").count * 2), 2));
  if (!geo.getAttribute("color")) tint(geo, color);
  for (const k of Object.keys(geo.attributes)) if (!["position", "normal", "uv", "color"].includes(k)) geo.deleteAttribute(k);
  geo.morphAttributes = {};
  return geo;
}

export function merge(geos: THREE.BufferGeometry[]) {
  const g = mergeGeometries(geos.map((x) => prep(x)), false);
  if (!g) throw new Error("merge failed");
  return g;
}

const m4 = new THREE.Matrix4();
const q = new THREE.Quaternion();
const e = new THREE.Euler();
const v = new THREE.Vector3();
const s = new THREE.Vector3();

export function place(geo: THREE.BufferGeometry, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) {
  m4.compose(v.set(x, y, z), q.setFromEuler(e.set(rx, ry, rz)), s.set(sx, sy, sz));
  geo.applyMatrix4(m4);
  return geo;
}

/** A box whose UVs are in tiles of (tu × tv) metres, so textures keep a constant density. */
export function boxUV(w: number, h: number, d: number, tu = 2, tv = 2) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.getAttribute("uv") as THREE.BufferAttribute;
  const dims: [number, number][] = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++)
    for (let k = 0; k < 4; k++) {
      const i = f * 4 + k;
      uv.setXY(i, (uv.getX(i) * dims[f][0]) / tu, (uv.getY(i) * dims[f][1]) / tv);
    }
  return g;
}

/** Ambient-occlusion-ish vertical gradient: darker at the base. */
export function aoTint(geo: THREE.BufferGeometry, base: THREE.ColorRepresentation, y0: number, y1: number, dark = 0.55) {
  const c = new THREE.Color(base);
  const out = new THREE.Color();
  return tint(geo, (_x, y) => {
    const t = Math.min(1, Math.max(0, (y - y0) / (y1 - y0 || 1)));
    return out.copy(c).multiplyScalar(dark + (1 - dark) * t);
  });
}

/** Inject a wind sway into a Lambert material. Vertices above `from` metres sway more with height. */
export function windy<T extends THREE.Material>(mat: T, strength: number, from: number, scale = 10): T {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = shared.time;
    shader.uniforms.uWind = shared.wind;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nuniform float uTime; uniform float uWind;")
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        {
          vec3 wp = position;
          #ifdef USE_INSTANCING
            wp = (instanceMatrix * vec4(position, 1.0)).xyz;
          #endif
          float k = max(0.0, position.y - ${from.toFixed(2)}) / ${scale.toFixed(2)};
          float ph = uTime * 1.4 + wp.x * 0.21 + wp.z * 0.17;
          float sw = (sin(ph) * 0.7 + sin(ph * 2.3 + 1.7) * 0.3) * ${strength.toFixed(3)} * k * uWind;
          transformed.x += sw;
          transformed.z += sw * 0.6;
        }`,
      );
  };
  mat.customProgramCacheKey = () => `windy${strength}_${from}_${scale}`;
  return mat;
}

// ---------------------------------------------------------------- trees

export type TreeKind = "oak" | "beech" | "pine" | "giant" | "young";
export type TreeGeo = { trunk: THREE.BufferGeometry; leaves: THREE.BufferGeometry; height: number; radius: number };

function limb(r0: number, r1: number, len: number, segs = 6) {
  const g = new THREE.CylinderGeometry(r1, r0, len, segs, 2, true);
  g.translate(0, len / 2, 0);
  return g;
}

/** Leaf cards around a set of cluster centres. Normals point out of the crown so it shades like a volume. */
function crown(r: Rand, clusters: { x: number; y: number; z: number; rad: number }[], cards: number, size: number, centre: THREE.Vector3, hue: THREE.Color) {
  const pos: number[] = [];
  const nor: number[] = [];
  const uv: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  const c = new THREE.Color();
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const n = new THREE.Vector3();
  const corner = new THREE.Vector3();
  let minY = Infinity;
  let maxY = -Infinity;
  for (const cl of clusters) {
    minY = Math.min(minY, cl.y - cl.rad);
    maxY = Math.max(maxY, cl.y + cl.rad);
  }
  for (const cl of clusters) {
    for (let k = 0; k < cards; k++) {
      const u = r() * 2 - 1;
      const th = r() * Math.PI * 2;
      const rr = Math.cbrt(r()) * cl.rad * 0.8;
      const px = cl.x + Math.sqrt(1 - u * u) * Math.cos(th) * rr;
      const py = cl.y + u * rr * 0.8;
      const pz = cl.z + Math.sqrt(1 - u * u) * Math.sin(th) * rr;
      a.set(r() * 2 - 1, (r() * 2 - 1) * 0.6, r() * 2 - 1).normalize();
      b.set(r() * 2 - 1, r() * 2 - 1, r() * 2 - 1).cross(a).normalize();
      const sz = size * (0.75 + r() * 0.5);
      const base = pos.length / 3;
      const shade = 0.74 + 0.3 * ((py - minY) / (maxY - minY || 1));
      c.copy(hue).multiplyScalar(shade * (0.88 + r() * 0.24));
      for (let m = 0; m < 4; m++) {
        const sx = m === 0 || m === 3 ? -1 : 1;
        const sy = m < 2 ? -1 : 1;
        corner.set(px, py, pz).addScaledVector(a, sx * sz * 0.5).addScaledVector(b, sy * sz * 0.5);
        pos.push(corner.x, corner.y, corner.z);
        n.copy(corner).sub(centre).normalize();
        n.y += 0.35;
        n.normalize();
        nor.push(n.x, n.y, n.z);
        uv.push(sx < 0 ? 0 : 1, sy < 0 ? 0 : 1);
        col.push(c.r, c.g, c.b);
      }
      idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  return g;
}

export function treeGeo(kind: TreeKind, seed: number): TreeGeo {
  const r = rng(seed * 977 + kind.length * 13);
  const bark = kind === "beech" ? new THREE.Color(0xd8d0c0) : new THREE.Color(0x8a7a66);
  const parts: THREE.BufferGeometry[] = [];
  const clusters: { x: number; y: number; z: number; rad: number }[] = [];
  let H = 12;
  let R = 0.5;
  if (kind === "pine") {
    H = range(14, 20);
    R = range(0.3, 0.45);
  } else if (kind === "giant") {
    H = range(30, 36);
    R = range(2.6, 3.4);
  } else if (kind === "beech") {
    H = range(10, 14);
    R = range(0.22, 0.32);
  } else if (kind === "young") {
    H = range(6, 8);
    R = range(0.14, 0.2);
  } else {
    H = range(13, 19);
    R = range(0.55, 0.9);
  }
  function range(lo: number, hi: number) {
    return lo + (hi - lo) * r();
  }
  const trunkTop = kind === "pine" ? H * 0.95 : H * (kind === "giant" ? 0.55 : 0.6);
  const lean = (r() - 0.5) * 0.08;
  const trunk = limb(R, R * (kind === "pine" ? 0.15 : 0.55), trunkTop, kind === "giant" ? 12 : 7);
  place(trunk, 0, 0, 0, lean, 0, lean);
  parts.push(aoTint(trunk, bark, 0, trunkTop, 0.5));
  if (kind !== "young" && kind !== "pine") {
    const roots = kind === "giant" ? 7 : 4;
    for (let i = 0; i < roots; i++) {
      const ang = (i / roots) * Math.PI * 2 + r();
      const len = R * (kind === "giant" ? 3.4 : 2.4);
      const g = new THREE.ConeGeometry(R * 0.55, len, 5, 1, true);
      g.rotateZ(Math.PI / 2);
      g.translate(-len / 2 + R * 0.3, R * 0.25, 0);
      g.rotateZ(-0.35);
      g.rotateY(ang);
      parts.push(aoTint(g, bark, 0, R * 2, 0.45));
    }
  }
  const top = new THREE.Vector3(0, trunkTop, 0);
  if (kind === "pine") {
    const tiers = 7;
    for (let t = 0; t < tiers; t++) {
      const f = t / (tiers - 1);
      const y = H * 0.3 + f * H * 0.68;
      const rad = (1 - f) * 3.2 + 0.6;
      const around = 5;
      for (let k = 0; k < around; k++) {
        const ang = (k / around) * Math.PI * 2 + t * 0.6;
        clusters.push({ x: Math.cos(ang) * rad * 0.55, y: y - rad * 0.25, z: Math.sin(ang) * rad * 0.55, rad: rad * 0.55 });
      }
    }
  } else {
    const n = kind === "giant" ? 12 : kind === "young" ? 3 : kind === "beech" ? 5 : 7;
    const spread = kind === "giant" ? 10 : kind === "young" ? 1.6 : kind === "beech" ? 2.8 : 4.2;
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * Math.PI * 2 + r() * 0.7;
      const d = spread * (0.45 + r() * 0.6);
      const cx = Math.cos(ang) * d;
      const cz = Math.sin(ang) * d;
      const cy = trunkTop + (H - trunkTop) * (0.25 + r() * 0.55);
      const rad = spread * (0.5 + r() * 0.3) + (kind === "giant" ? 2 : 0.6);
      clusters.push({ x: cx, y: cy, z: cz, rad });
      if (kind !== "young") {
        const len = Math.hypot(cx, cy - trunkTop * 0.8, cz);
        const br = limb(R * 0.42, R * 0.12, len, 5);
        const dir = new THREE.Vector3(cx, cy - trunkTop * 0.8, cz).normalize();
        br.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir));
        br.translate(0, trunkTop * 0.8, 0);
        parts.push(aoTint(br, bark, trunkTop * 0.6, H, 0.7));
      }
    }
    clusters.push({ x: 0, y: H * 0.86, z: 0, rad: spread * 0.8 + 0.5 });
  }
  const hue =
    kind === "pine" ? new THREE.Color(0xa8b8a0) : kind === "beech" ? new THREE.Color(0xf0f0d0) : kind === "giant" ? new THREE.Color(0xe0e8c8) : new THREE.Color(0xffffff);
  const cardSize = kind === "giant" ? 6.5 : kind === "pine" ? 3.0 : kind === "young" ? 2.0 : 3.6;
  const cards = kind === "giant" ? 18 : kind === "pine" ? 4 : kind === "young" ? 7 : 11;
  const leaves = crown(r, clusters, cards, cardSize, top.setY((trunkTop + H) / 2), hue);
  const trunkGeo = merge(parts);
  return { trunk: trunkGeo, leaves, height: H, radius: R };
}

export function bushGeo(seed: number, size = 1) {
  const r = rng(seed * 31 + 5);
  const clusters = [];
  const n = 2 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) clusters.push({ x: (r() - 0.5) * 1.6 * size, y: (0.6 + r() * 0.5) * size, z: (r() - 0.5) * 1.6 * size, rad: (0.8 + r() * 0.4) * size });
  return crown(r, clusters, 9, 1.4 * size, new THREE.Vector3(0, 0, 0), new THREE.Color(0xffffff));
}

/** Six crossed fern fronds leaning out from the centre. */
export function fernGeo() {
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 6; i++) {
    const g = new THREE.PlaneGeometry(0.55, 1.2, 1, 3);
    const p = g.getAttribute("position");
    for (let k = 0; k < p.count; k++) {
      const y = p.getY(k) + 0.6;
      p.setY(k, y * 0.55);
      p.setZ(k, y * y * 0.32);
    }
    g.rotateX(-0.75);
    g.rotateY((i / 6) * Math.PI * 2);
    g.computeVertexNormals();
    const n = g.getAttribute("normal");
    for (let k = 0; k < n.count; k++) n.setXYZ(k, 0, 1, 0);
    parts.push(aoTint(g, 0xffffff, 0, 0.8, 0.6));
  }
  return merge(parts);
}

/** A clump of grass blades: plain triangles, coloured base-to-tip, normals up so they light like the ground. */
export function grassGeo(seed: number, blades = 7, height = 0.55) {
  const r = rng(seed);
  const pos: number[] = [];
  const col: number[] = [];
  const base = new THREE.Color(0x56683a);
  const tip = new THREE.Color(0xb8be6c);
  const tipB = new THREE.Color(0x98a856);
  const tc = new THREE.Color();
  for (let i = 0; i < blades; i++) {
    const a = r() * Math.PI * 2;
    const d = r() * 0.32;
    const x = Math.cos(a) * d;
    const z = Math.sin(a) * d;
    const w = 0.022 + r() * 0.022;
    const h = height * (0.55 + r() * 0.7);
    const lean = (r() - 0.5) * 0.35;
    const ox = Math.cos(a + 1.57) * w;
    const oz = Math.sin(a + 1.57) * w;
    pos.push(x - ox, 0, z - oz, x + ox, 0, z + oz, x + Math.cos(a) * lean, h, z + Math.sin(a) * lean);
    tc.copy(tip).lerp(tipB, r());
    col.push(base.r, base.g, base.b, base.r, base.g, base.b, tc.r, tc.g, tc.b);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  const nor = new Float32Array(pos.length);
  for (let i = 0; i < nor.length; i += 3) nor[i + 1] = 1;
  g.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
  return prep(g);
}

export function wheatGeo() {
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 3; i++) {
    const g = new THREE.PlaneGeometry(1.4, 1.25);
    g.translate(0, 0.62, 0);
    g.rotateY((i / 3) * Math.PI);
    const n = g.getAttribute("normal");
    for (let k = 0; k < n.count; k++) n.setXYZ(k, 0, 1, 0);
    parts.push(aoTint(g, 0xffffff, 0, 1.2, 0.55));
  }
  return merge(parts);
}

/** A lumpy rock: displaced icosphere, mossy on top. */
export function rockGeo(seed: number, mossy = true, tone = 0x8a847a) {
  const g = new THREE.IcosahedronGeometry(1, 2);
  const p = g.getAttribute("position");
  const ox = seed * 3.7;
  for (let i = 0; i < p.count; i++) {
    v.set(p.getX(i), p.getY(i), p.getZ(i));
    const n = fbm(v.x * 1.3 + ox, v.z * 1.3 + v.y * 0.9, 3);
    const k = 0.72 + n * 0.55 + noise2(v.x * 4 + ox, v.y * 4) * 0.08;
    v.multiplyScalar(k);
    if (v.y < -0.2) v.y = -0.2 - (v.y + 0.2) * 0.25;
    p.setXYZ(i, v.x, v.y * 0.72, v.z);
  }
  g.computeVertexNormals();
  const stone = new THREE.Color(tone);
  const moss = new THREE.Color(0x5e6b45);
  const out = new THREE.Color();
  tint(g, (x, y, z, _nx, ny) => {
    out.copy(stone).multiplyScalar(0.75 + noise2(x * 3 + ox, z * 3) * 0.35);
    if (mossy) out.lerp(moss, Math.max(0, ny - 0.45) * 1.5 * (0.6 + noise2(x * 2, z * 2 + ox) * 0.6));
    out.multiplyScalar(0.7 + 0.3 * Math.min(1, (y + 0.3) * 1.6));
    return out;
  });
  return prep(g);
}

export function logGeo(len: number, rad: number) {
  const g = new THREE.CylinderGeometry(rad, rad * 1.1, len, 9, 1, false);
  g.rotateZ(Math.PI / 2);
  const bark = new THREE.Color(0x5b4a38);
  const moss = new THREE.Color(0x58663e);
  const out = new THREE.Color();
  tint(g, (x, _y, z, _nx, ny) => out.copy(bark).lerp(moss, Math.max(0, ny) * (0.5 + noise2(x, z) * 0.6)));
  return prep(g);
}

export function stumpGeo(rad: number, h: number) {
  const g = new THREE.CylinderGeometry(rad * 0.85, rad * 1.2, h, 9, 2);
  const pp = g.getAttribute("position");
  for (let i = 0; i < pp.count; i++) if (pp.getY(i) > h * 0.49) pp.setY(i, pp.getY(i) + Math.sin(pp.getX(i) * 9 + pp.getZ(i) * 7) * 0.06);
  g.computeVertexNormals();
  g.translate(0, h / 2, 0);
  const bark = new THREE.Color(0x5b4a38);
  const ring = new THREE.Color(0xa88c66);
  const out = new THREE.Color();
  tint(g, (_x, y, _z, _nx, ny) => (ny > 0.9 && y > h * 0.9 ? out.copy(ring) : out.copy(bark).multiplyScalar(0.7 + (y / h) * 0.3)));
  return prep(g);
}

/** An arching root from a tree base, as a tube along a curve. */
export function rootGeo(points: THREE.Vector3[], rad: number) {
  const curve = new THREE.CatmullRomCurve3(points);
  const g = new THREE.TubeGeometry(curve, 18, rad, 7, false);
  const p = g.getAttribute("position");
  for (let i = 0; i < p.count; i++) {
    const t = Math.floor(i / 8) / 18;
    const k = 1 - t * 0.55;
    const c = curve.getPoint(Math.min(1, t));
    p.setXYZ(i, c.x + (p.getX(i) - c.x) * k, c.y + (p.getY(i) - c.y) * k, c.z + (p.getZ(i) - c.z) * k);
  }
  g.computeVertexNormals();
  const bark = new THREE.Color(0x9a8468);
  const moss = new THREE.Color(0x7a8c52);
  const out = new THREE.Color();
  tint(g, (x, _y, z, _nx, ny) => out.copy(bark).lerp(moss, Math.max(0, ny - 0.3) * (0.4 + noise2(x * 0.5, z * 0.5) * 0.6)));
  return prep(g);
}

export function mushroomGeo(seed: number) {
  const r = rng(seed);
  const parts: THREE.BufferGeometry[] = [];
  const n = 2 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) {
    const x = (r() - 0.5) * 0.5;
    const z = (r() - 0.5) * 0.5;
    const h = 0.1 + r() * 0.18;
    const stalk = new THREE.CylinderGeometry(0.025, 0.035, h, 5);
    stalk.translate(x, h / 2, z);
    parts.push(tint(stalk, 0xd8ccb4));
    const cap = new THREE.SphereGeometry(0.07 + r() * 0.06, 7, 4, 0, Math.PI * 2, 0, Math.PI / 2);
    cap.scale(1, 0.6, 1);
    cap.translate(x, h, z);
    parts.push(tint(cap, r() < 0.5 ? 0xa57a44 : 0xc8a678));
  }
  return merge(parts);
}

export function flowerGeo(seed: number) {
  const r = rng(seed);
  const parts: THREE.BufferGeometry[] = [];
  const cols = [0xe7dcc8, 0xd7a441, 0x9a9ac8, 0xcdbba6];
  const color = cols[Math.floor(r() * cols.length)];
  for (let i = 0; i < 5; i++) {
    const x = (r() - 0.5) * 0.6;
    const z = (r() - 0.5) * 0.6;
    const h = 0.18 + r() * 0.2;
    const stem = new THREE.CylinderGeometry(0.008, 0.008, h, 3);
    stem.translate(x, h / 2, z);
    parts.push(tint(stem, 0x4e5e34));
    const head = new THREE.IcosahedronGeometry(0.045, 0);
    head.translate(x, h, z);
    parts.push(tint(head, color));
  }
  return merge(parts);
}

// ---------------------------------------------------------------- instancing

export type Part = { geo: THREE.BufferGeometry; mat: THREE.Material; shadow?: boolean; receive?: boolean };

/**
 * Instances grouped into square chunks, one InstancedMesh per part per chunk, so the
 * renderer can cull chunks outside the view and we can drop distant chunks entirely.
 */
export class Scatter {
  private items = new Map<string, THREE.Matrix4[]>();
  private meshes: { mesh: THREE.InstancedMesh; cx: number; cz: number }[] = [];
  constructor(private parts: Part[], private chunk = 48, public maxDist = 160) {}

  add(x: number, y: number, z: number, ry = 0, sc = 1, sy = sc, tiltX = 0, tiltZ = 0) {
    const key = Math.floor(x / this.chunk) + "," + Math.floor(z / this.chunk);
    let list = this.items.get(key);
    if (!list) {
      list = [];
      this.items.set(key, list);
    }
    const m = new THREE.Matrix4();
    m.compose(v.set(x, y, z), q.setFromEuler(e.set(tiltX, ry, tiltZ)), s.set(sc, sy, sc));
    list.push(m);
  }

  get count() {
    let n = 0;
    for (const l of this.items.values()) n += l.length;
    return n;
  }

  build(parent: THREE.Object3D) {
    for (const [key, list] of this.items) {
      const [cx, cz] = key.split(",").map(Number);
      for (const part of this.parts) {
        const mesh = new THREE.InstancedMesh(part.geo, part.mat, list.length);
        list.forEach((m, i) => mesh.setMatrixAt(i, m));
        mesh.instanceMatrix.needsUpdate = true;
        mesh.castShadow = !!part.shadow;
        mesh.receiveShadow = part.receive !== false;
        mesh.computeBoundingSphere();
        mesh.computeBoundingBox();
        parent.add(mesh);
        this.meshes.push({ mesh, cx: (cx + 0.5) * this.chunk, cz: (cz + 0.5) * this.chunk });
      }
    }
    this.items.clear();
  }

  /** Hide chunks beyond the draw distance. */
  cull(px: number, pz: number, dist = this.maxDist) {
    const lim = dist + this.chunk * 0.75;
    for (const m of this.meshes) m.mesh.visible = Math.hypot(m.cx - px, m.cz - pz) < lim;
  }
}

/** Merge many placed geometries into one mesh per material key. */
export class Batch {
  private groups = new Map<string, { mat: THREE.Material; geos: THREE.BufferGeometry[]; shadow: boolean }>();
  add(key: string, mat: THREE.Material, geo: THREE.BufferGeometry, shadow = true) {
    let g = this.groups.get(key);
    if (!g) {
      g = { mat, geos: [], shadow };
      this.groups.set(key, g);
    }
    g.geos.push(prep(geo));
  }
  build(parent: THREE.Object3D) {
    const out: THREE.Mesh[] = [];
    for (const [key, g] of this.groups) {
      if (!g.geos.length) continue;
      const mesh = new THREE.Mesh(merge(g.geos), g.mat);
      mesh.castShadow = g.shadow;
      mesh.receiveShadow = true;
      mesh.name = key;
      parent.add(mesh);
      out.push(mesh);
    }
    this.groups.clear();
    return out;
  }
}

export const rand = { range, rng };
