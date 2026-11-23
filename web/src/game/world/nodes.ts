import * as THREE from "three";
import { flatten, flowerGeo, grassGeo, logGeo, mushroomGeo, prep, rockGeo, tint } from "../engine/kit";
import type { Mats } from "../engine/materials";
import { rng } from "../engine/noise";
import { ZONES } from "../data/zones.ts";
import { NODE_DEFS, type NodeData, type NodeKind } from "../data/world.ts";
import type { Colliders } from "./collide";

/** A gatherable node in a scene: its data, where it stands, and the mesh that shrinks as it is spent. */
export type NodeDef = { id: string; kind: NodeKind; item: string; tier: number; seal: string | null; x: number; z: number; y: number; max: number; mesh: THREE.Object3D };

const nodeMat = new THREE.MeshLambertMaterial({ vertexColors: true });

/**
 * Builds one node's mesh at world (x, z). Shared by every zone builder so a coal seam looks
 * the same in the Kingdom as in Blackwood.
 */
export function makeNode(M: Mats, root: THREE.Object3D, col: Colliders, d: NodeData, x: number, z: number, y: number): NodeDef {
  const r = rng(d.id.split("").reduce((a, c) => a * 31 + c.charCodeAt(0), 7) >>> 0);
  const g = new THREE.Group();
  const add = (geo: THREE.BufferGeometry, px = 0, py = 0, pz = 0, ry = 0, s = 1) => {
    const m = new THREE.Mesh(geo, nodeMat);
    m.position.set(px, py, pz);
    m.rotation.y = ry;
    m.scale.setScalar(s);
    g.add(m);
    return m;
  };
  const veinRock = (seed: number, base: number, vein: [number, number, number], scale: number, py: number) => {
    const rg = rockGeo(seed, false, base);
    const c = rg.getAttribute("color");
    const p = rg.getAttribute("position");
    for (let k = 0; k < c.count; k++) if (Math.sin(p.getX(k) * 7 - p.getY(k) * 9 + seed) > 0.62) c.setXYZ(k, vein[0], vein[1], vein[2]);
    add(rg, 0, py, 0, r() * 6, scale);
  };
  let radius = 0.5;
  switch (d.kind) {
    case "flint":
      for (let i = 0; i < 5; i++) {
        const geo = new THREE.IcosahedronGeometry(0.28 + r() * 0.12, 0);
        geo.scale(1, 0.7, 1.2);
        tint(geo, i % 2 ? 0x2c2b2a : 0x3a3836);
        add(prep(geo), (r() - 0.5) * 0.9, 0.12, (r() - 0.5) * 0.9, r() * 6);
      }
      break;
    case "wood":
      add(logGeo(3.2, 0.26), 0, 0.26, 0, r() * 6);
      break;
    case "fibre":
    case "wheat": {
      const tall = grassGeo(d.id.length * 7, 22, d.kind === "wheat" ? 1.1 : 1.2);
      const c = tall.getAttribute("color");
      for (let i = 0; i < c.count; i++) {
        if (d.kind === "wheat") c.setXYZ(i, 0.78, 0.64, 0.3);
        else c.setXYZ(i, c.getX(i) * 1.25, c.getY(i) * 1.12, c.getZ(i) * 0.75);
      }
      const m = new THREE.Mesh(tall, M.grass);
      m.scale.setScalar(1.4);
      g.add(m);
      radius = 0.2;
      break;
    }
    case "marigold":
    case "widowsveil": {
      for (let i = 0; i < 5; i++) {
        const f = flowerGeo(d.id.length * 3 + i);
        tint(f, d.kind === "marigold" ? 0xe88a2a : 0xd8e0d4);
        add(f, (r() - 0.5) * 0.8, 0, (r() - 0.5) * 0.8, r() * 6, 1.3);
      }
      radius = 0.2;
      break;
    }
    case "rotcap":
      for (let i = 0; i < 4; i++) {
        const m = mushroomGeo(i + 3);
        tint(m, 0x7a6a5a);
        add(m, (r() - 0.5) * 0.7, 0, (r() - 0.5) * 0.7, r() * 6, 1.6);
      }
      radius = 0.25;
      break;
    case "stone":
      add(rockGeo(9, true, 0x9a948a), 0, 0.5, 0, r() * 6, 1.1);
      radius = 1.0;
      break;
    case "copper":
      for (let i = 0; i < 3; i++) veinRock(20 + i, 0x8a6a4a, [0.45, 0.3, 0.12], 0.45 + r() * 0.15, 0.25);
      break;
    case "coal":
      for (let i = 0; i < 3; i++) veinRock(30 + i, 0x5a5650, [0.08, 0.08, 0.09], 0.5 + r() * 0.15, 0.3);
      break;
    case "iron":
      veinRock(41, 0x4a4c50, [0.32, 0.36, 0.42], 1.6, 0.8);
      radius = 1.6;
      break;
    case "blackiron":
      veinRock(55, 0x2a2a2e, [0.05, 0.06, 0.1], 1.4, 0.7);
      radius = 1.4;
      break;
  }
  const baked = flatten(g, nodeMat);
  baked.castShadow = true;
  baked.receiveShadow = true;
  const holder = new THREE.Group();
  holder.add(baked);
  holder.position.set(x, y, z);
  root.add(holder);
  if (radius > 0.3) col.circle(x, z, radius);
  return { id: d.id, kind: d.kind, item: d.item, tier: d.tier, seal: d.seal, x, z, y, max: d.max, mesh: holder };
}

/** Every node of a zone that has its position in the data (Hearthfen's are placed by hand). */
export function zoneNodes(M: Mats, root: THREE.Object3D, col: Colliders, zone: keyof typeof ZONES, groundAt: (x: number, z: number) => number): NodeDef[] {
  const out: NodeDef[] = [];
  for (const d of NODE_DEFS) {
    if (d.zone !== zone || d.x === undefined || d.z === undefined) continue;
    const x = ZONES[zone].ox + d.x;
    out.push(makeNode(M, root, col, d, x, d.z, groundAt(x, d.z)));
  }
  return out;
}
