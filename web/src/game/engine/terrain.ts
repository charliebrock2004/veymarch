import * as THREE from "three";
import { clamp, distToPolyline, fbm, lerp, smoothstep } from "./noise";
import { detailTex } from "./textures";
import {
  BOUNDS, CASTLE_DOOR, CLEARINGS, CREEK, DUN_X, GATE, HILL, PATH_CAMP, PATH_EAST, PATH_MAIN, PATH_SHRINE, RIVER, VILLAGE,
} from "../world/layout";

/** Height of the castle door terrace. */
export const DOOR_H = 7;
const STEP = 2;

const C = (hex: number) => new THREE.Color(hex);
const COL = {
  moss: C(0x5a6a3c),
  honey: C(0x7f8a46),
  dark: C(0x3d4a2a),
  litter: C(0x4f4630),
  dirt: C(0x7a6246),
  dirtLight: C(0x9a8262),
  mud: C(0x4d3f30),
  rock: C(0x77716a),
  wet: C(0x3e392c),
  wheat: C(0xb1964f),
  pasture: C(0x7c8a4e),
  village: C(0x667040),
};

function pathDist(x: number, z: number) {
  return Math.min(
    distToPolyline(x, z, PATH_MAIN),
    distToPolyline(x, z, PATH_EAST),
    distToPolyline(x, z, PATH_CAMP) + 0.6,
    distToPolyline(x, z, PATH_SHRINE) + 0.6,
  );
}

type Sample = { h: number; path: number; creek: number; river: number; village: number; kingdom: number; hill: number };

function sample(x: number, z: number): Sample {
  const roll = (fbm(x * 0.011 + 11, z * 0.011 - 4, 4) - 0.5) * 13;
  let h = roll + (fbm(x * 0.05, z * 0.05, 2) - 0.5) * 1.8;
  const dv = Math.hypot(x - VILLAGE.x, z - VILLAGE.z);
  const village = 1 - smoothstep(VILLAGE.r + 2, VILLAGE.r + 24, dv);
  h = lerp(h, (fbm(x * 0.08, z * 0.08, 2) - 0.5) * 0.5, village);

  const dp = pathDist(x, z);
  const path = 1 - smoothstep(1.2, 3.4, dp);
  const pathSoft = 1 - smoothstep(1.5, 7, dp);
  h = lerp(h, roll * (1 - village) * 0.85, pathSoft * 0.55) - path * 0.1;

  for (const c of CLEARINGS) {
    const d = Math.hypot(x - c.x, z - c.z);
    const k = 1 - smoothstep(c.r * 0.6, c.r * 1.4, d);
    h = lerp(h, roll * 0.7, k * 0.6);
  }

  const dh = Math.hypot(x - HILL.x, z - HILL.z);
  const hill = 1 - smoothstep(HILL.r * 0.25, HILL.r, dh);
  h += HILL.h * hill;
  const dd = Math.hypot(x - CASTLE_DOOR.x, z - CASTLE_DOOR.z + 1);
  h = lerp(h, DOOR_H, 1 - smoothstep(5, 10, dd));

  const dc = distToPolyline(x, z, CREEK);
  const creek = 1 - smoothstep(1.4, 4.4, dc);
  h -= 1.9 * creek;

  const dr = distToPolyline(x, z, RIVER);
  const river = 1 - smoothstep(5, 12, dr);
  h -= 4.2 * river;

  const kingdom = smoothstep(GATE.x - 4, GATE.x + 14, x);
  h = lerp(h, (fbm(x * 0.008, z * 0.008, 3) - 0.5) * 7 + Math.max(0, x - 180) * 0.04, kingdom);
  const roadK = path * kingdom;
  h -= roadK * 0.05;

  const edge = Math.min(x - BOUNDS.minX, z - BOUNDS.minZ, BOUNDS.maxZ - z, (BOUNDS.maxX - x) * 3);
  h += (1 - smoothstep(0, 30, edge)) * 16 * (1 - kingdom * 0.7);

  return { h, path, creek, river, village, kingdom, hill };
}

export type Terrain = {
  mesh: THREE.Mesh;
  heightAt: (x: number, z: number) => number;
  /** 0 on open ground, 1 on the path bed: used to keep props off the lanes. */
  pathAt: (x: number, z: number) => number;
  waterAt: (x: number, z: number) => number;
};

export function buildTerrain(): Terrain {
  const nx = Math.ceil((BOUNDS.maxX - BOUNDS.minX) / STEP) + 1;
  const nz = Math.ceil((BOUNDS.maxZ - BOUNDS.minZ) / STEP) + 1;
  const heights = new Float32Array(nx * nz);
  const paths = new Float32Array(nx * nz);
  const waters = new Float32Array(nx * nz);
  const pos = new Float32Array(nx * nz * 3);
  const col = new Float32Array(nx * nz * 3);
  const uv = new Float32Array(nx * nz * 2);
  const samples: Sample[] = [];
  for (let j = 0; j < nz; j++)
    for (let i = 0; i < nx; i++) {
      const x = BOUNDS.minX + i * STEP;
      const z = BOUNDS.minZ + j * STEP;
      const s = sample(x, z);
      samples.push(s);
      const k = j * nx + i;
      heights[k] = s.h;
      paths[k] = s.path;
      waters[k] = Math.max(s.creek, s.river);
      pos[k * 3] = x;
      pos[k * 3 + 1] = s.h;
      pos[k * 3 + 2] = z;
      uv[k * 2] = x / 6;
      uv[k * 2 + 1] = z / 6;
    }

  const c = new THREE.Color();
  const tmp = new THREE.Color();
  for (let j = 0; j < nz; j++)
    for (let i = 0; i < nx; i++) {
      const k = j * nx + i;
      const s = samples[k];
      const x = BOUNDS.minX + i * STEP;
      const z = BOUNDS.minZ + j * STEP;
      const hl = heights[j * nx + Math.max(0, i - 1)];
      const hr = heights[j * nx + Math.min(nx - 1, i + 1)];
      const hd = heights[Math.max(0, j - 1) * nx + i];
      const hu = heights[Math.min(nz - 1, j + 1) * nx + i];
      const slope = Math.hypot(hr - hl, hu - hd) / (STEP * 2);

      const n1 = fbm(x * 0.035, z * 0.035, 3);
      const n2 = fbm(x * 0.12 + 40, z * 0.12, 2);
      c.copy(COL.moss).lerp(COL.honey, smoothstep(0.35, 0.75, n1));
      c.lerp(COL.dark, smoothstep(0.55, 0.85, n2) * 0.5);
      const forest = (1 - s.village) * (1 - s.kingdom) * (1 - s.hill * 0.6);
      c.lerp(COL.litter, forest * smoothstep(0.3, 0.7, fbm(x * 0.07 - 9, z * 0.07 + 3, 3)) * 0.75);
      c.lerp(COL.village, s.village * 0.5);

      if (s.kingdom > 0) {
        const plot = Math.floor((x - 110) / 24) * 7 + Math.floor((z + 200) / 19) * 13;
        const isWheat = (Math.sin(plot * 12.9898) * 43758.5453) % 1;
        tmp.copy(Math.abs(isWheat) > 0.45 ? COL.wheat : COL.pasture);
        tmp.lerp(COL.honey, n2 * 0.25);
        c.lerp(tmp, s.kingdom);
      }
      c.lerp(COL.rock, smoothstep(0.55, 0.95, slope) * 0.85);
      const wet = Math.max(s.creek, s.river);
      c.lerp(COL.wet, smoothstep(0.05, 0.6, wet));
      const dirt = s.path * (0.75 + n2 * 0.35);
      tmp.copy(COL.dirt).lerp(COL.dirtLight, s.kingdom * 0.7 + n1 * 0.2);
      c.lerp(tmp, clamp(dirt, 0, 1));
      if (s.village > 0.5) {
        const yard = fbm(x * 0.09 + 7, z * 0.09 - 3, 3);
        c.lerp(COL.mud, smoothstep(0.58, 0.72, yard) * 0.6 * s.village);
      }
      col[k * 3] = c.r;
      col[k * 3 + 1] = c.g;
      col[k * 3 + 2] = c.b;
    }

  const idx: number[] = [];
  for (let j = 0; j < nz - 1; j++)
    for (let i = 0; i < nx - 1; i++) {
      const a = j * nx + i;
      const b = a + 1;
      const d = a + nx;
      const e = d + 1;
      idx.push(a, d, b, b, d, e);
    }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const tex = detailTex();
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, map: tex });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.name = "terrain";

  const grid = (arr: Float32Array, x: number, z: number) => {
    const fx = clamp((x - BOUNDS.minX) / STEP, 0, nx - 1.0001);
    const fz = clamp((z - BOUNDS.minZ) / STEP, 0, nz - 1.0001);
    const i = Math.floor(fx);
    const j = Math.floor(fz);
    const u = fx - i;
    const v = fz - j;
    const a = arr[j * nx + i];
    const b = arr[j * nx + i + 1];
    const d = arr[(j + 1) * nx + i];
    const e = arr[(j + 1) * nx + i + 1];
    // Match the triangle split used by the index buffer (a,d,b / b,d,e).
    if (u + v <= 1) return a + (b - a) * u + (d - a) * v;
    return e + (d - e) * (1 - u) + (b - e) * (1 - v);
  };

  return {
    mesh,
    heightAt: (x, z) => (x > DUN_X - 200 ? 0 : grid(heights, x, z)),
    pathAt: (x, z) => (x > DUN_X - 200 ? 0 : grid(paths, x, z)),
    waterAt: (x, z) => (x > DUN_X - 200 ? 0 : grid(waters, x, z)),
  };
}

/** Raw (unsampled) height, for building water ribbons along the creek and river centrelines. */
export function rawHeight(x: number, z: number) {
  return sample(x, z).h;
}
