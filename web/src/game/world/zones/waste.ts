import * as THREE from "three";
import { CACHE_DEFS } from "../../data/world.ts";
import { ZONES } from "../../data/zones.ts";
import { Batch, boxUV, rockGeo, tint, treeGeo } from "../../engine/kit";
import { fbm, noise2, rng, smoothstep } from "../../engine/noise";
import { buildFieldTerrain } from "../../engine/terrain";
import type { NpcDef, Stop } from "../../play/npcs";
import { zoneNodes } from "../nodes";
import { Frame, put, type Ctx, type Glow } from "../props";
import type { ZoneBuild, ZoneEnv } from "../zone";

/**
 * The Undead Wasteland (design bible 6.4): ash that is not snow, a dead river crossed by a causeway
 * of ribs, the village of the unburied to the west, three necromancer towers, Brother Caldus's camp,
 * and the bone gate of the Dead Citadel at the north end of the ash road.
 */
const X = ZONES.waste.ox;
const V3 = THREE.Vector3;
const CAMP = { x: -26, z: -100 };
const VILLAGE = { x: -72, z: -38 };
const GATE = { x: 0, z: 132 };
const TOWERS = [
  { x: 100, z: -76 },
  { x: -100, z: 76 },
  { x: 96, z: 102 },
];
const roadX = (z: number) => Math.sin(z * 0.03) * 5 * (1 - smoothstep(110, 135, Math.abs(z)));
const riverZ = (x: number) => 20 + Math.sin(x * 0.03) * 8;

const S = (x: number, z: number, wait: number, face?: number): Stop => ({ x: X + x, z, wait, act: "none", face });

export const WASTE_NPCS: NpcDef[] = [
  {
    id: "caldus", name: "Brother Caldus", role: "Priest of the last rites",
    look: { skin: 0xc8a888, hair: 0x9a9690, hairStyle: "hood", shirt: 0x5a5448, coat: 0x2e2a26, coatLong: true, trousers: 0x2a2620, boots: 0x1c1814, belt: 0xc8a040, frame: 1.0, height: 1.76 },
    stops: [S(-28, -104, 24, 0.4), S(-33, -101, 10, -1.2), S(-22, -97, 12, 2.6)],
    night: "stay",
    speed: 0.7,
    zone: "waste",
    lines: [
      "Speak softly. They hear names, and they come to them.",
      "I bury what will stay buried. The rest I name, and hope.",
      "The towers call the dead up faster than I can put them down. Break the towers.",
      "Tallow and grave dust. Bring me those and the censer will keep burning.",
      "The king in the Citadel was a good king once. That is the worst kind of dead.",
    ],
    after: { flag: "grave_king", lines: ["Silence. Real silence. I had forgotten its weight.", "The salt road runs south-west from here. Whatever that shard wants, it wants it there."] },
  },
];

export function buildWaste(env: ZoneEnv): ZoneBuild {
  const { M, col } = env;
  const root = new THREE.Group();
  root.name = "waste";
  const r = rng(13013);
  const B = ZONES.waste.bounds;

  const heightLocal = (x: number, z: number) => {
    let h = (fbm(x * 0.018, z * 0.018, 3) - 0.5) * 4 + noise2(x * 0.11, z * 0.11) * 0.35;
    const chan = 1 - smoothstep(6, 13, Math.abs(z - riverZ(x)));
    const causeway = 1 - smoothstep(4, 7, Math.abs(x - roadX(z)));
    h -= chan * 3.4 * (1 - causeway);
    const road = 1 - smoothstep(3, 7, Math.abs(x - roadX(z)));
    h = h * (1 - road * 0.85) + road * 0.15;
    h += smoothstep(B.maxX - 20, B.maxX + 10, Math.abs(x)) * 14;
    h += smoothstep(B.minZ + 18, B.minZ - 10, z) * 8 * (1 - road);
    h += smoothstep(GATE.z + 6, GATE.z + 30, z) * 18 * (1 - smoothstep(3, 8, Math.abs(x)) * 0.0);
    return h;
  };
  const cc = { ash: new THREE.Color(0xb6b2aa), dark: new THREE.Color(0x67635c), road: new THREE.Color(0x4a4640), bed: new THREE.Color(0x35322e) };
  const tc = new THREE.Color();
  const terrain = buildFieldTerrain({
    ox: X,
    bounds: { minX: B.minX - 30, maxX: B.maxX + 30, minZ: B.minZ - 30, maxZ: B.maxZ + 40 },
    step: 3,
    sample: (x, z) => {
      const h = heightLocal(x, z);
      const path = 1 - smoothstep(2.5, 4.5, Math.abs(x - roadX(z)));
      tc.copy(cc.ash).lerp(cc.dark, fbm(x * 0.05, z * 0.05, 2) * 0.8);
      if (h < -1) tc.lerp(cc.bed, smoothstep(-1, -3, h));
      tc.lerp(cc.road, path * 0.85);
      tc.multiplyScalar(0.88 + noise2(x * 0.5, z * 0.5) * 0.24);
      return { h, color: tc.clone(), path };
    },
  });
  root.add(terrain.mesh);
  const groundAt = (x: number, z: number) => terrain.heightAt(x, z);
  const H = (lx: number, lz: number) => groundAt(X + lx, lz);

  const batch = new Batch();
  const glows: Glow[] = [];
  const fires: THREE.Vector3[] = [];
  const lamps: THREE.Vector3[] = [];
  const smoke: THREE.Vector3[] = [];
  const ctx: Ctx = { batch, M, col, h: groundAt, glows, smoke, fires, lamps };
  const anchors: Record<string, THREE.Vector3> = {};
  const F = (lx: number, lz: number, rot = 0, y = H(lx, lz)) => new Frame(X + lx, y, lz, rot);
  const cacheDefs = CACHE_DEFS.filter((c) => c.zone === "waste");
  const busy = (x: number, z: number, pad = 0) =>
    Math.abs(x - roadX(z)) < 7 + pad ||
    Math.hypot(x - CAMP.x, z - CAMP.z) < 16 + pad ||
    Math.hypot(x - VILLAGE.x, z - VILLAGE.z) < 24 + pad ||
    Math.hypot(x - GATE.x, z - GATE.z) < 16 + pad ||
    TOWERS.some((t) => Math.hypot(x - t.x, z - t.z) < 12 + pad) ||
    cacheDefs.some((c) => Math.hypot(x - c.x, z - c.z) < 3 + pad);

  // ------------------------------------------------------------ dead trees and grey rock
  const trunks = [0, 1, 2, 3, 4, 5].map((i) => tint(treeGeo(i % 2 ? "oak" : "beech", 300 + i).trunk, 0x6a645c));
  for (let i = 0; i < 90; i++) {
    const x = (r() - 0.5) * (B.maxX - B.minX - 20);
    const z = B.minZ + 10 + r() * (B.maxZ - B.minZ - 30);
    if (busy(x, z) || Math.abs(z - riverZ(x)) < 9) continue;
    const s = 0.6 + r() * 0.5;
    put(ctx, "bark", trunks[i % trunks.length].clone(), F(x, z, r() * 6, H(x, z) - 0.2), 0, 0, 0, (r() - 0.5) * 0.2, 0, (r() - 0.5) * 0.2, 0xffffff);
    col.circle(X + x, z, 0.5 * s + 0.2);
  }
  for (let i = 0; i < 120; i++) {
    const x = (r() - 0.5) * (B.maxX - B.minX);
    const z = B.minZ + r() * (B.maxZ - B.minZ);
    if (busy(x, z, -2)) continue;
    const s = 0.5 + r() * 1.8;
    put(ctx, "flat", rockGeo(i * 13 + 5, false, 0x77736b).scale(s, s * 0.7, s), F(x, z, r() * 6, H(x, z) - 0.25 * s), 0, 0, 0, 0, 0, 0, 0xffffff);
    if (s > 1) col.circle(X + x, z, s * 0.7);
  }

  // ------------------------------------------------------------ the rib causeway over the dead river
  {
    const zr = riverZ(roadX(20));
    for (let k = -4; k <= 4; k++) {
      const z = zr + k * 2.6;
      const rx = roadX(z);
      const rib = new THREE.TorusGeometry(4.6 - Math.abs(k) * 0.2, 0.2, 5, 14, Math.PI);
      put(ctx, "flat", rib, F(rx, z, 0, H(rx, z) - 0.3), 0, 0, 0, 0, 0, 0, 0xe0d8c4);
      col.circle(X + rx - 4.4, z, 0.35);
      col.circle(X + rx + 4.4, z, 0.35);
    }
    const spine = new THREE.CylinderGeometry(0.35, 0.35, 26, 6);
    put(ctx, "flat", spine, F(roadX(zr), zr, 0, H(roadX(zr), zr) + 4.4), 0, 0, 0, Math.PI / 2, 0, 0, 0xd8d0bc);
  }

  // ------------------------------------------------------------ the village of the unburied: roofless walls
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + 0.3;
    const cx = VILLAGE.x + Math.cos(a) * 15;
    const cz = VILLAGE.z + Math.sin(a) * 13;
    const w = 5 + r() * 2;
    const d = 4 + r() * 2;
    const rot = -a + Math.PI / 2;
    const f = F(cx, cz, rot, H(cx, cz) - 0.3);
    const hh = 1.4 + r() * 2;
    put(ctx, "stoneGrey", boxUV(w, hh, 0.4), f, 0, hh / 2, -d / 2, 0, 0, 0, 0x8a867e);
    put(ctx, "stoneGrey", boxUV(0.4, hh * 0.7, d), f, -w / 2, hh * 0.35, 0, 0, 0, 0, 0x8a867e);
    put(ctx, "stoneGrey", boxUV(w * 0.4, hh * 0.5, 0.4), f, w * 0.3, hh * 0.25, d / 2, 0, 0, 0, 0x8a867e);
    put(ctx, "planksDark", boxUV(w * 0.8, 0.12, 0.3), f, 0.3, hh * 0.9, 0, 0.4, 0.2, 0.1, 0x5a5048);
    const p = f.at(0, 0, -d / 2);
    col.box(p.x, p.z, w, 0.5, rot);
    const q = f.at(-w / 2, 0, 0);
    col.box(q.x, q.z, 0.5, d, rot);
    // the unmarked graves
    for (let g = 0; g < 3; g++) {
      const gf = F(cx + (r() - 0.5) * 6, cz + d + 1 + r() * 2, r() * 0.4);
      put(ctx, "flat", new THREE.BoxGeometry(0.9, 0.25, 1.9), gf, 0, 0.1, 0, 0, 0, 0, 0x5a554c);
      put(ctx, "planksDark", boxUV(0.12, 1.0, 0.1), gf, 0, 0.5, -0.9, 0, 0, (r() - 0.5) * 0.4, 0x6a6058);
    }
  }

  // ------------------------------------------------------------ necromancer towers: green fire on top
  for (const t of TOWERS) {
    const f = F(t.x, t.z, 0, H(t.x, t.z) - 0.5);
    put(ctx, "stoneDark", new THREE.CylinderGeometry(3.2, 4.2, 16, 9), f, 0, 8, 0, 0, 0, 0, 0x5a5862);
    put(ctx, "stoneDark", new THREE.CylinderGeometry(4.4, 3.4, 1.4, 9), f, 0, 16.4, 0, 0, 0, 0, 0x4a4852);
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      put(ctx, "stoneDark", boxUV(0.8, 1.6, 0.8), f, Math.cos(a) * 4, 17.8, Math.sin(a) * 4, 0, a, 0, 0x4a4852);
    }
    put(ctx, "flat", boxUV(1.2, 2.2, 0.2), f, 0, 1.1, 4.0, 0, 0, 0, 0x0a0a0a, false);
    const top = f.at(0, 17.6, 0);
    glows.push({ x: top.x, y: top.y, z: top.z, size: 9, color: 0x6aff9a });
    glows.push({ x: top.x, y: top.y - 9, z: top.z, size: 4, color: 0x3ac87a });
    col.circle(X + t.x, t.z, 4.3);
  }

  // ------------------------------------------------------------ Brother Caldus's camp: tents, censer, the only warm light
  {
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + 0.6;
      const tx = CAMP.x + Math.cos(a) * 7;
      const tz = CAMP.z + Math.sin(a) * 6;
      const f = F(tx, tz, -a, H(tx, tz));
      put(ctx, "flat", new THREE.ConeGeometry(2.0, 2.6, 6, 1, true), f, 0, 1.3, 0, 0, 0, 0, 0xc8bca0);
      col.circle(X + tx, tz, 1.9);
    }
    const fireP = F(CAMP.x + 4, CAMP.z - 2);
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * Math.PI * 2;
      put(ctx, "flat", rockGeo(k + 40, false, 0x5a564e), fireP, Math.cos(a) * 0.8, 0, Math.sin(a) * 0.8, 0, 0, 0, 0xffffff);
    }
    fires.push(fireP.at(0, 0.3, 0));
    smoke.push(fireP.at(0, 0.8, 0));
    // the censer post: the shrine
    const sx = -26;
    const sz = -96;
    const f = F(sx, sz, 0);
    put(ctx, "planksDark", boxUV(0.22, 3.2, 0.22), f, 0, 1.6, 0, 0, 0, 0, 0x4a4038);
    put(ctx, "planksDark", boxUV(1.2, 0.16, 0.16), f, 0.4, 3.0, 0, 0, 0, 0, 0x4a4038);
    put(ctx, "metal", new THREE.SphereGeometry(0.28, 8, 6), f, 0.85, 2.4, 0, 0, 0, 0, 0xc8a040, false);
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      put(ctx, "flat", new THREE.CylinderGeometry(0.04, 0.05, 0.18, 5), f, Math.cos(a) * 0.6, 0.09, Math.sin(a) * 0.6, 0, 0, 0, 0xe8dcc0, false);
    }
    const c = f.at(0.85, 2.4, 0);
    glows.push({ x: c.x, y: c.y, z: c.z, size: 3.6, color: 0xffd080 });
    lamps.push(c.clone());
    col.circle(X + sx, sz, 0.3);
    anchors.shrine = new V3(X + sx, H(sx, sz), sz + 1.5);
    anchors.caldus = new V3(X + CAMP.x, H(CAMP.x, CAMP.z), CAMP.z);
  }

  // ------------------------------------------------------------ banners of a dead kingdom along the road
  for (let z = -130; z < 120; z += 22) {
    for (const side of [-1, 1]) {
      const x = roadX(z) + side * 6.5;
      const f = F(x, z, 0);
      put(ctx, "planksDark", boxUV(0.14, 4.2, 0.14), f, 0, 2.1, 0, 0, 0, (r() - 0.5) * 0.15, 0x3a3028);
      put(ctx, "flat", new THREE.PlaneGeometry(1.0, 1.8, 1, 3), f, side * 0.55, 3.0, 0, 0, Math.PI / 2, 0, 0x5a1e22, false);
      col.circle(X + x, z, 0.2);
    }
  }

  // ------------------------------------------------------------ the bone gate and the Citadel's mesa
  {
    const f = F(GATE.x, GATE.z, 0, H(GATE.x, GATE.z));
    for (const side of [-1, 1]) {
      put(ctx, "stoneDark", boxUV(3, 12, 3), f, side * 6, 6, 0, 0, 0, 0, 0x3e3c44);
      put(ctx, "flat", new THREE.SphereGeometry(1.4, 8, 6), f, side * 6, 13, 0, 0, 0, 0, 0xe0d8c4);
      put(ctx, "stoneDark", boxUV(30, 10, 3), f, side * 22.5, 5, 1, 0, 0, 0, 0x34323a);
      col.box(X + GATE.x + side * 6, GATE.z, 3.2, 3.2);
      col.box(X + GATE.x + side * 22.5, GATE.z + 1, 30, 3);
    }
    put(ctx, "stoneDark", boxUV(15, 2.4, 3), f, 0, 11.2, 0, 0, 0, 0, 0x3e3c44);
    for (let k = -5; k <= 5; k++) put(ctx, "flat", new THREE.CylinderGeometry(0.12, 0.12, 2.2, 5), f, k * 0.9, 9.0, 0.8, 0, 0, Math.PI, 0xe0d8c4);
    put(ctx, "flat", new THREE.PlaneGeometry(9, 10), f, 0, 5, -0.6, 0, 0, 0, 0x060608, false);
    for (const side of [-1, 1]) {
      const g = f.at(side * 6, 13, 1.6);
      glows.push({ x: g.x, y: g.y, z: g.z, size: 5, color: 0x9affd0 });
    }
    // the Citadel on its mesa, black against the ash sky
    const m = F(0, 168, 0, H(0, 160));
    put(ctx, "stoneDark", boxUV(70, 30, 30), m, 0, 15, 0, 0, 0, 0, 0x26242a);
    put(ctx, "stoneDark", boxUV(14, 50, 14), m, 0, 25, -4, 0, 0, 0, 0x2a2830);
    for (const side of [-1, 1]) put(ctx, "stoneDark", boxUV(9, 40, 9), m, side * 26, 20, -2, 0, 0, 0, 0x2a2830);
    const w = m.at(0, 44, 3.2);
    glows.push({ x: w.x, y: w.y, z: w.z, size: 10, color: 0x7affb0 });
    anchors.gate = new V3(X + GATE.x, H(GATE.x, GATE.z), GATE.z - 4);
  }
  // the stair down from the Keep at the south edge
  {
    const f = F(0, -156, 0);
    for (const side of [-1, 1]) put(ctx, "stoneDark", boxUV(2.4, 7, 2.4), f, side * 5, 3.5, 0, 0, 0, 0, 0x2e2c32);
    put(ctx, "stoneDark", boxUV(12.4, 1.6, 2.4), f, 0, 7.6, 0, 0, 0, 0, 0x2e2c32);
  }
  for (const c of cacheDefs) anchors["cache_" + c.id] = new V3(X + c.x, H(c.x, c.z), c.z);
  anchors.arrive = new V3(X, H(0, -146), -146);

  batch.build(root);
  const nodes = zoneNodes(M, root, col, "waste", groundAt);

  // ------------------------------------------------------------ ash fall around the player, and soul wisps
  const ASH = 900;
  const ashPos = new Float32Array(ASH * 3);
  for (let i = 0; i < ASH; i++) {
    ashPos[i * 3] = (Math.random() - 0.5) * 70;
    ashPos[i * 3 + 1] = Math.random() * 24;
    ashPos[i * 3 + 2] = (Math.random() - 0.5) * 70;
  }
  const ashGeo = new THREE.BufferGeometry();
  ashGeo.setAttribute("position", new THREE.BufferAttribute(ashPos, 3));
  const ash = new THREE.Points(ashGeo, new THREE.PointsMaterial({ color: 0xe0dcd4, size: 0.14, transparent: true, opacity: 0.75, depthWrite: false }));
  ash.frustumCulled = false;
  root.add(ash);

  const wispMat = new THREE.MeshBasicMaterial({ color: 0x9affd0, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false });
  const wispGeo = new THREE.SphereGeometry(0.16, 6, 4);
  const wisps = Array.from({ length: 18 }, (_, i) => {
    const home = i < 6 ? TOWERS[i % 3] : i < 12 ? GATE : { x: VILLAGE.x, z: VILLAGE.z };
    const m = new THREE.Mesh(wispGeo, wispMat);
    root.add(m);
    return { m, hx: home.x + (Math.random() - 0.5) * 16, hz: home.z + (Math.random() - 0.5) * 16, ph: Math.random() * 10 };
  });

  const regionAt = (x: number, z: number) => {
    const lx = x - X;
    if (Math.hypot(lx - CAMP.x, z - CAMP.z) < 20) return "caldus_camp";
    if (Math.hypot(lx - VILLAGE.x, z - VILLAGE.z) < 28) return "dead_village";
    if (z > GATE.z - 18) return "bone_gate";
    if (TOWERS.some((t) => Math.hypot(lx - t.x, z - t.z) < 26)) return "necro_tower";
    if (Math.abs(z - riverZ(lx)) < 12) return "dead_river";
    if (Math.abs(lx - roadX(z)) < 9) return "ash_road";
    return "waste";
  };
  const regions: Record<string, [string, string]> = {
    caldus_camp: ["The Last Rites Camp", "Candles, tallow and one living priest"],
    dead_village: ["The Village of the Unburied", "Nobody here was ever named"],
    bone_gate: ["The Bone Gate", "The Dead Citadel, on its mesa"],
    necro_tower: ["A Necromancer's Tower", "Green fire. The dead walk out of it."],
    dead_river: ["The Dead River", "Crossed on a causeway of ribs"],
    ash_road: ["The Ash Road", "North to the Citadel"],
    waste: ["The Undead Wasteland", "Ash that is not snow. No birds."],
  };
  const surfaceAt = (x: number, z: number): "wood" | "stone" | "dirt" | "grass" => {
    const lx = x - X;
    if (Math.abs(lx - roadX(z)) < 3.5 || z > GATE.z - 4) return "stone";
    return "dirt";
  };

  let nextChoir = 10;
  const update = (dt: number, t: number) => {
    const me = env.players()[0];
    if (me) ash.position.set(me.x, groundAt(me.x, me.z), me.z);
    for (let i = 0; i < ASH; i++) {
      let y = ashPos[i * 3 + 1] - dt * (0.6 + (i % 7) * 0.08);
      if (y < 0) y += 24;
      ashPos[i * 3 + 1] = y;
      ashPos[i * 3] += Math.sin(t * 0.3 + i) * dt * 0.2;
    }
    ashGeo.attributes.position.needsUpdate = true;
    for (const w of wisps) {
      const x = w.hx + Math.sin(t * 0.3 + w.ph) * 5;
      const z = w.hz + Math.cos(t * 0.23 + w.ph * 1.3) * 5;
      w.m.position.set(X + x, H(x, z) + 1.4 + Math.sin(t * 1.1 + w.ph) * 0.5, z);
    }
    wispMat.opacity = 0.6 + Math.sin(t * 1.7) * 0.25;
    if (t > nextChoir) {
      nextChoir = t + 18 + Math.random() * 20;
      if (me && me.zone === "waste" && !me.dead) env.audio.bell(0.035, 110 + Math.floor(Math.random() * 3) * 15);
    }
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
    anchors,
    npcs: WASTE_NPCS,
    update,
    fog: { color: 0x9a968e, density: 0.017 },
  };
}
