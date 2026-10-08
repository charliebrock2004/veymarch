import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { BOSSES } from "../../data/bosses.ts";
import { ZONES } from "../../data/zones.ts";
import { LINES } from "../../content";
import { Poser, type Rig } from "../../engine/rig";
import type { Decal } from "../../engine/fx";
import type { Boss, BossEnv } from "../bossapi";
import { SILENT, type HurtOpts, type PlayerState } from "../env";
import type { Mob } from "../mobs";

/**
 * Boe, the Collared Hound (design bible): Elspeth's black English Cocker Spaniel. A real dog,
 * red leather collar, brass tag. He wants a pat; the collar wants a fight.
 *  0. Play: wags, barks, comes for a pat. Leave him ~6 s and he licks you (a little heal: false
 *     safety). Strike first and the collar glows at once.
 *  1. Play (100-66%): charge along a line, nip, fetch (a dropped stick snaps after 2.5 s).
 *  2. The collar (66-33%): knockback pounce, collar pulse (an expanding ring: dodge-roll through
 *     it), more and chained charges.
 *  3. Ear-wings (<33%): the ears harden into leather wings; short flights (untouchable), a dive at
 *     a marked spot, then dizzy on the ground. He only attacks on landing.
 * A heavy from behind while he recovers staggers him. Death: a whimper, the collar cracks and
 * falls, he lies down.
 */

const DEF = BOSSES.boe;
const AX = ZONES[DEF.zone].ox + DEF.x;
const AZ = DEF.z;
const AR = DEF.r;
/** where he waits, facing the den's way in (south, -z) */
const HOME = { x: AX, z: AZ + 5, yaw: Math.PI };
/** the model is built at a real spaniel's size, then scaled up to boss size */
const S = 2.4;
const STICK_T = 2.5;
const STICK_R = 2.2;
const PULSE_V = 8;
const FLY_Y = 3.6;

type St =
  | "dormant" | "intro" | "play" | "lick" | "glow" | "idle" | "recover" | "chargetell" | "charge" | "niptell" | "nip" | "fetch" | "drop"
  | "pouncetell" | "pounce" | "pulsetell" | "pulse" | "phase" | "lift" | "fly" | "divetell" | "dive" | "land" | "dizzy" | "hurt" | "roll"
  | "dying" | "dead";

/** Network order of Boe.st. */
const STATES: St[] = [
  "dormant", "intro", "play", "lick", "glow", "idle", "recover", "chargetell", "charge", "niptell", "nip", "fetch", "drop",
  "pouncetell", "pounce", "pulsetell", "pulse", "phase", "lift", "fly", "divetell", "dive", "land", "dizzy", "hurt", "roll",
  "dying", "dead",
];
const TELLS: St[] = ["chargetell", "niptell", "pouncetell", "pulsetell", "divetell"];
/** before the collar wakes: a dog that wants a pat */
const PRE: St[] = ["intro", "play", "lick"];
/** in the air: untouchable */
const AIR: St[] = ["lift", "fly", "divetell", "dive"];
/** the windows where a heavy from behind staggers him */
const RECOVERING: St[] = ["recover", "land", "dizzy", "drop", "roll"];

type Stick = { id: string; x: number; z: number; t: number; snapped: boolean; mesh: THREE.Mesh; decal: Decal | null };

export type BoeSnap = {
  s: number; t: number; d: number; x: number; z: number; y: number; yw: number; hp: number; ph: number;
  tx: number; tz: number; ln: number; mv: number; pr: number; sk: [string, number, number, number, number][];
};

// ------------------------------------------------------------ the model

type PartDef = { bone: string; geo: THREE.BufferGeometry; color: THREE.Color };

/** One SkinnedMesh: parts modelled in bone space, rigidly weighted, merged (as engine/rig.ts does). */
class DogBuilder {
  bones: Record<string, THREE.Bone> = {};
  list: THREE.Bone[] = [];
  parts: PartDef[] = [];
  bone(name: string, parent: string | null, x: number, y: number, z: number) {
    const b = new THREE.Bone();
    b.name = name;
    b.position.set(x, y, z);
    if (parent) this.bones[parent].add(b);
    this.bones[name] = b;
    this.list.push(b);
  }
  part(bone: string, geo: THREE.BufferGeometry, color: THREE.ColorRepresentation) {
    this.parts.push({ bone, geo, color: new THREE.Color(color) });
  }
  build(mat: THREE.Material): Rig {
    const root = this.list[0];
    root.updateMatrixWorld(true);
    const geos: THREE.BufferGeometry[] = [];
    for (const p of this.parts) {
      let g = p.geo.index ? p.geo.toNonIndexed() : p.geo;
      for (const k of Object.keys(g.attributes)) if (k !== "position" && k !== "normal") g.deleteAttribute(k);
      g = g.applyMatrix4(this.bones[p.bone].matrixWorld);
      const n = g.getAttribute("position").count;
      const bi = this.list.indexOf(this.bones[p.bone]);
      const si = new Uint16Array(n * 4);
      const sw = new Float32Array(n * 4);
      const col = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        si[i * 4] = bi;
        sw[i * 4] = 1;
        col[i * 3] = p.color.r;
        col[i * 3 + 1] = p.color.g;
        col[i * 3 + 2] = p.color.b;
      }
      g.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(si, 4));
      g.setAttribute("skinWeight", new THREE.Float32BufferAttribute(sw, 4));
      g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
      geos.push(g);
    }
    const geo = mergeGeometries(geos, false);
    if (!geo) throw new Error("boe: merge failed");
    const mesh = new THREE.SkinnedMesh(geo, mat);
    mesh.add(root);
    mesh.updateMatrixWorld(true);
    mesh.bind(new THREE.Skeleton(this.list));
    mesh.castShadow = true;
    mesh.frustumCulled = false;
    const group = new THREE.Group();
    group.add(mesh);
    const rest: Record<string, THREE.Vector3> = {};
    for (const b of this.list) rest[b.name] = b.position.clone();
    return { group, mesh, bones: this.bones, rest, sockets: {}, height: 0.6 };
  }
}

const ell = (rx: number, ry: number, rz: number, x = 0, y = 0, z = 0, seg = 10) => {
  const g = new THREE.SphereGeometry(1, seg, Math.max(5, Math.floor(seg * 0.7)));
  g.scale(rx, ry, rz);
  g.translate(x, y, z);
  return g;
};
const cap = (r: number, len: number, x = 0, y = 0, z = 0, seg = 7) => {
  const g = new THREE.CapsuleGeometry(r, len, 2, seg);
  g.translate(x, y, z);
  return g;
};
const rot = (g: THREE.BufferGeometry, rx: number, ry: number, rz: number) => {
  g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, ry, rz)));
  return g;
};
/** Wavy, feathered fur: pushes vertices in and out along a ripple. */
const wavy = (g: THREE.BufferGeometry, amp: number, freq: number) => {
  const p = g.getAttribute("position");
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    const k = 1 + Math.sin(y * freq + z * freq * 0.6) * amp + Math.sin(y * freq * 2.3 + x * 40) * amp * 0.4;
    p.setXYZ(i, x * k, y, z * (1 + (k - 1) * 0.6));
  }
  g.computeVertexNormals();
  return g;
};
/** A leather wing half as a thin extruded outline in the XZ plane (x outward, z forward). */
const wingGeo = (pts: [number, number][], side: 1 | -1) => {
  const sh = new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x * side, z)));
  const g = new THREE.ExtrudeGeometry(sh, { depth: 0.008, bevelEnabled: false, curveSegments: 3 });
  g.translate(0, 0, -0.004);
  g.rotateX(Math.PI / 2);
  return g;
};

const FUR = 0x221f24;
const FUR_HI = 0x302c33;
const FEATHER = 0x1a181b;
const NOSE = 0x0c0a0a;
const EYE = 0x2a1409;
const TONGUE = 0xc25a62;
const PAD = 0x151313;
const WING = 0x5a1414;
const WING_RIB = 0x2a0c0c;

function buildBoe(mat: THREE.Material): Rig {
  const b = new DogBuilder();
  b.bone("root", null, 0, 0, 0);
  b.bone("body", "root", 0, 0.34, 0);
  b.bone("chest", "body", 0, 0.02, 0.13);
  b.bone("hips", "body", 0, 0.01, -0.14);
  b.bone("neck", "chest", 0, 0.07, 0.08);
  b.bone("head", "neck", 0, 0.11, 0.05);
  b.bone("jaw", "head", 0, -0.04, 0.06);
  b.bone("earL", "head", 0.068, 0.025, -0.015);
  b.bone("earR", "head", -0.068, 0.025, -0.015);
  b.bone("wingL", "chest", 0.06, 0.1, 0.0);
  b.bone("wingL2", "wingL", 0.28, 0, 0);
  b.bone("wingR", "chest", -0.06, 0.1, 0.0);
  b.bone("wingR2", "wingR", -0.28, 0, 0);
  b.bone("tail", "hips", 0, 0.06, -0.1);
  b.bone("tail2", "tail", 0, 0, -0.06);
  for (const [s, sx] of [["L", 1], ["R", -1]] as const) {
    b.bone("fu" + s, "chest", sx * 0.068, -0.05, 0.03);
    b.bone("fl" + s, "fu" + s, 0, -0.14, 0);
    b.bone("fp" + s, "fl" + s, 0, -0.135, 0);
    b.bone("hu" + s, "hips", sx * 0.07, -0.03, -0.02);
    b.bone("hl" + s, "hu" + s, 0, -0.14, -0.015);
    b.bone("hp" + s, "hl" + s, 0, -0.14, 0.015);
  }
  // torso: a deep chest, a level back, feathering under the belly
  b.part("body", ell(0.115, 0.115, 0.2, 0, 0, 0, 12), FUR);
  b.part("body", ell(0.08, 0.03, 0.17, 0, 0.09, 0, 8), FUR_HI);
  b.part("body", wavy(ell(0.095, 0.06, 0.16, 0, -0.08, -0.01, 10), 0.08, 60), FEATHER);
  b.part("chest", ell(0.128, 0.15, 0.13, 0, -0.01, 0.03, 12), FUR);
  b.part("chest", wavy(ell(0.085, 0.1, 0.07, 0, -0.085, 0.085, 9), 0.1, 55), FEATHER);
  b.part("hips", ell(0.112, 0.118, 0.12, 0, 0.01, -0.02, 10), FUR);
  b.part("neck", rot(ell(0.075, 0.11, 0.08, 0, 0.0, 0, 9), 0.5, 0, 0).translate(0, 0.04, 0.02), FUR);
  // head: domed skull, square muzzle, hanging flews, dark soft eyes
  b.part("head", ell(0.074, 0.07, 0.083, 0, 0.012, -0.005, 11), FUR);
  b.part("head", ell(0.062, 0.05, 0.06, 0, 0.05, 0.012, 9), FUR_HI);
  b.part("head", ell(0.05, 0.044, 0.07, 0, -0.024, 0.08, 9), FUR);
  b.part("head", ell(0.053, 0.03, 0.05, 0, -0.05, 0.09, 8), FEATHER);
  b.part("head", ell(0.027, 0.02, 0.018, 0, -0.004, 0.148, 7), NOSE);
  for (const sx of [1, -1]) {
    b.part("head", ell(0.019, 0.018, 0.011, sx * 0.037, 0.026, 0.066, 7), EYE);
    b.part("head", ell(0.005, 0.005, 0.003, sx * 0.033, 0.032, 0.076, 4), 0xe8e0d8);
    b.part("head", ell(0.022, 0.008, 0.012, sx * 0.036, 0.05, 0.06, 5), FUR_HI);
  }
  b.part("jaw", ell(0.036, 0.017, 0.05, 0, -0.008, 0.04, 8), FUR);
  b.part("jaw", ell(0.022, 0.007, 0.042, 0, 0.006, 0.05, 6), TONGUE);
  // the long wavy ears and their curls
  for (const [s, sx] of [["L", 1], ["R", -1]] as const) {
    b.part("ear" + s, wavy(ell(0.022, 0.12, 0.056, sx * 0.012, -0.1, 0, 10), 0.14, 70), FUR);
    b.part("ear" + s, ell(0.03, 0.04, 0.045, sx * 0.016, -0.2, 0.012, 7), FEATHER);
    b.part("ear" + s, ell(0.026, 0.035, 0.035, sx * 0.014, -0.215, -0.03, 6), FEATHER);
  }
  // legs with feathering behind, round cat-like feet
  for (const s of ["L", "R"]) {
    b.part("fu" + s, cap(0.036, 0.09, 0, -0.07, 0), FUR);
    b.part("fu" + s, wavy(ell(0.026, 0.07, 0.034, 0, -0.085, -0.03, 7), 0.12, 70), FEATHER);
    b.part("fl" + s, cap(0.026, 0.1, 0, -0.065, 0), FUR);
    b.part("fl" + s, wavy(ell(0.02, 0.06, 0.03, 0, -0.06, -0.022, 6), 0.12, 70), FEATHER);
    b.part("fp" + s, ell(0.033, 0.022, 0.045, 0, -0.012, 0.015, 7), PAD);
    b.part("hu" + s, ell(0.055, 0.09, 0.062, 0, -0.055, 0, 9), FUR);
    b.part("hu" + s, wavy(ell(0.034, 0.08, 0.04, 0, -0.08, -0.045, 7), 0.12, 70), FEATHER);
    b.part("hl" + s, cap(0.025, 0.1, 0, -0.07, 0), FUR);
    b.part("hl" + s, wavy(ell(0.02, 0.06, 0.03, 0, -0.06, -0.024, 6), 0.12, 70), FEATHER);
    b.part("hp" + s, ell(0.032, 0.022, 0.045, 0, -0.012, 0.018, 7), PAD);
  }
  // docked tail, feathered plume
  b.part("tail", rot(cap(0.026, 0.05, 0, 0, 0, 6), Math.PI / 2, 0, 0).translate(0, 0, -0.025), FUR);
  b.part("tail2", wavy(ell(0.036, 0.03, 0.07, 0, -0.004, -0.03, 8), 0.15, 60), FEATHER);
  // the ear-wings (scaled to nothing until the third phase)
  for (const [s, sx] of [["L", 1], ["R", -1]] as const) {
    b.part("wing" + s, wingGeo([[0, 0.05], [0.12, 0.08], [0.28, 0.07], [0.28, -0.14], [0.2, -0.12], [0.12, -0.17], [0.03, -0.13], [0, -0.06]], sx), WING);
    b.part("wing" + s + "2", wingGeo([[0, 0.07], [0.16, 0.05], [0.32, -0.04], [0.22, -0.06], [0.14, -0.15], [0.06, -0.11], [0, -0.14]], sx), WING);
    b.part("wing" + s, rot(cap(0.012, 0.26, 0, 0, 0, 5), 0, 0, Math.PI / 2).translate(sx * 0.14, 0.004, 0.065), WING_RIB);
    b.part("wing" + s + "2", rot(cap(0.009, 0.3, 0, 0, 0, 5), 0, -sx * 0.35, Math.PI / 2).translate(sx * 0.15, 0.004, 0.02), WING_RIB);
  }
  const rig = b.build(mat);
  rig.group.scale.setScalar(S);
  return rig;
}

/** The red leather collar and its brass tag (its own mesh: it glows, and it falls off). */
function buildCollar() {
  const band = new THREE.TorusGeometry(0.082, 0.014, 6, 20);
  band.rotateX(Math.PI / 2);
  const loop = new THREE.TorusGeometry(0.009, 0.003, 4, 8);
  loop.rotateY(Math.PI / 2);
  loop.translate(0, -0.012, 0.094);
  const tag = new THREE.CylinderGeometry(0.022, 0.022, 0.005, 12);
  tag.rotateX(Math.PI / 2);
  tag.translate(0, -0.038, 0.097);
  const parts: [THREE.BufferGeometry, number][] = [[band, 0x8e1a14], [loop, 0xc89a3a], [tag, 0xd2a446]];
  const geos = parts.map(([g, c]) => {
    const n = g.toNonIndexed();
    n.deleteAttribute("uv");
    const col = new THREE.Color(c);
    const arr = new Float32Array(n.getAttribute("position").count * 3);
    for (let i = 0; i < arr.length; i += 3) {
      arr[i] = col.r;
      arr[i + 1] = col.g;
      arr[i + 2] = col.b;
    }
    n.setAttribute("color", new THREE.Float32BufferAttribute(arr, 3));
    return n;
  });
  const geo = mergeGeometries(geos, false);
  if (!geo) throw new Error("boe: collar merge failed");
  geo.rotateX(0.5);
  geo.translate(0, 0.035, 0.025);
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0xff2410, emissiveIntensity: 0 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  return { mesh, mat };
}

function buildStickGeo() {
  const a = new THREE.CylinderGeometry(0.035, 0.045, 0.9, 6);
  a.rotateZ(Math.PI / 2);
  const b = new THREE.CylinderGeometry(0.014, 0.02, 0.26, 5);
  b.rotateZ(Math.PI / 2 - 0.7);
  b.translate(0.12, 0.07, 0);
  const g = mergeGeometries([a.toNonIndexed(), b.toNonIndexed()], false);
  if (!g) throw new Error("boe: stick merge failed");
  return g;
}

// ------------------------------------------------------------ posing

type Act = "idle" | "sit" | "lie" | "crouch" | "bite" | "lick" | "bark" | "growl" | "roll" | "leap" | "fly" | "dive" | "dizzy" | "hurt" | "dead";
type DogPose = { t: number; move: number; phase: number; act: Act; at: number; wag: number; wings: number; flap: number };

const ease = (x: number) => x * x * (3 - 2 * x);
const sinE = (x: number) => Math.sin(Math.min(1, Math.max(0, x)) * Math.PI);
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

function poseDog(p: Poser, o: DogPose, dt: number) {
  const { t, move, phase, act, at } = o;
  p.begin(dt, act === "bite" || act === "leap" || act === "dive" ? 22 : 11);
  const amp = Math.min(1, move);
  const run = clamp01(move - 1);
  let legK = 1;
  let bodyX = -run * Math.sin(phase) * 0.08;
  let bodyZ = 0;
  let bodyY = Math.abs(Math.sin(phase)) * 0.014 * amp * (1 + run * 2);
  let bodyBack = 0;
  let neckX = -0.1 + run * 0.15;
  let headX = 0.1 + Math.sin(t * 1.3) * 0.04;
  let headZ = 0;
  let jaw = 0.06 + amp * 0.12;
  let tailX = 0.55;
  let wag = o.wag;
  let earOut = 0.08 + run * 0.1;
  let earX = Math.sin(phase * 2) * 0.3 * amp + Math.sin(t * 2.1) * 0.05 + run * 0.5;
  let hipsYaw = 0;
  let roll: number | null = null;
  let rootZ = 0;
  let rootX = 0;
  let rootY = 0;
  let fu = 0;
  let fl = 0;
  let hu = 0;
  let hl = 0;
  let hp = 0;
  switch (act) {
    case "sit":
    case "dizzy": {
      const k = act === "sit" ? ease(clamp01(at * 2)) : 1;
      bodyX -= 0.55 * k;
      bodyY -= 0.07 * k;
      bodyBack -= 0.03 * k;
      fu += 0.55 * k;
      neckX -= 0.15 * k;
      headX += 0.35 * k;
      hu -= 0.95 * k;
      hl += 1.9 * k;
      hp -= 0.4 * k;
      legK = 0;
      if (act === "dizzy") {
        bodyZ = Math.sin(t * 3.5) * 0.16;
        headZ = Math.sin(t * 3.5 + 1) * 0.35;
        jaw = 0.4;
        earOut = 0.35 + Math.sin(t * 7) * 0.15;
        wag = 0.15;
      }
      break;
    }
    case "lie": {
      const k = ease(clamp01(at * 1.5));
      bodyY -= 0.19 * k;
      fu -= 1.45 * k;
      fl += 0.1 * k;
      hu -= 1.25 * k;
      hl += 2.3 * k;
      hp -= 0.9 * k;
      neckX += 0.1 * k;
      headX += 0.05 * k;
      tailX = 0.55 - 0.6 * k;
      legK = 1 - k;
      break;
    }
    case "crouch": {
      const k = ease(clamp01(at * 1.6));
      bodyX += 0.3 * k;
      bodyY -= 0.04 * k;
      fu -= 0.75 * k;
      fl += 0.45 * k;
      hu += 0.15 * k;
      hipsYaw = Math.sin(t * 22) * 0.15 * k;
      tailX = 0.8;
      wag = Math.max(wag, k);
      headX -= 0.35 * k;
      jaw = 0.2 + 0.2 * k;
      earOut = 0.2;
      legK = 1 - k;
      break;
    }
    case "bite": {
      const k = sinE(at);
      neckX += 0.5 * k;
      headX += 0.2 * k;
      jaw = 0.75 * k;
      bodyX += 0.12 * k;
      earX -= 0.4 * k;
      break;
    }
    case "lick":
      neckX += 0.35;
      headX += 0.15 + Math.sin(t * 12) * 0.12;
      jaw = 0.35;
      wag = 1;
      break;
    case "bark":
      headX -= 0.3;
      neckX -= 0.2;
      jaw = 0.55 * Math.abs(Math.sin(t * 9));
      wag = 1;
      break;
    case "growl":
      neckX += 0.3;
      headX += 0.25;
      jaw = 0.15 + Math.abs(Math.sin(t * 30)) * 0.04;
      tailX = -0.15;
      wag = 0;
      earOut = 0.28;
      break;
    case "roll":
      roll = clamp01(at) * Math.PI * 2;
      fu -= 0.8;
      fl += 1.2;
      hu -= 0.6;
      hl += 1.2;
      legK = 0;
      break;
    case "leap": {
      const k = sinE(at);
      bodyX += -0.3 * (1 - at) + 0.3 * at;
      fu -= 1.3 * k;
      hu += 1.2 * k;
      hl -= 0.3 * k;
      earX = 0.9 * k;
      jaw = 0.6;
      legK = 0;
      break;
    }
    case "fly":
      bodyX -= 0.08;
      fu -= 0.9;
      fl += 1.5;
      hu += 0.9;
      hl -= 1.4;
      earX = 0.6;
      tailX = 0.1;
      wag = 0;
      legK = 0;
      break;
    case "dive":
      bodyX += 0.6;
      fu -= 1.4;
      hu += 0.8;
      earX = 1.1;
      jaw = 0.6;
      neckX -= 0.3;
      legK = 0;
      break;
    case "hurt": {
      const k = sinE(at);
      bodyX -= 0.15 * k;
      headX -= 0.4 * k;
      tailX = -0.4;
      earOut = 0.4 * k;
      wag = 0;
      break;
    }
    case "dead": {
      const k = ease(clamp01(at));
      rootZ = (Math.PI / 2) * k;
      rootX = 0.3 * k;
      rootY = 0.1 * k;
      fu -= 0.35 * k;
      hu -= 0.25 * k;
      neckX += 0.25 * k;
      headX += 0.2 * k;
      jaw = 0.02;
      tailX = 0.3 * (1 - k);
      wag = 0;
      earX = 0;
      earOut = 0.5 * k;
      legK = 1 - k;
      break;
    }
  }
  p.set("root", 0, 0, rootZ).offset("root", rootX, rootY, 0);
  if (roll !== null) p.snap("body", bodyX, 0, roll);
  else p.set("body", bodyX, 0, bodyZ);
  p.offset("body", 0, bodyY, bodyBack);
  p.set("hips", 0, hipsYaw, 0);
  p.set("neck", neckX, 0, 0);
  p.set("head", headX, 0, headZ);
  p.set("jaw", jaw, 0, 0);
  const tw = Math.sin(t * 15) * 0.75 * wag;
  p.set("tail", tailX, tw, 0).set("tail2", 0.15, tw * 0.7, 0);
  p.set("earL", earX, 0, earOut).set("earR", earX, 0, -earOut);
  // the ears give themselves up to the wings
  const w = o.wings;
  const es = 1 - 0.7 * w;
  p.rig.bones.earL.scale.setScalar(es);
  p.rig.bones.earR.scale.setScalar(es);
  const ws = Math.max(0.001, w);
  for (const s of ["L", "R"] as const) {
    p.rig.bones["wing" + s].scale.setScalar(ws);
    p.rig.bones["wing" + s + "2"].scale.setScalar(1);
  }
  const fl0 = o.flap;
  const fz = (0.25 + Math.sin(t * 9) * 0.75) * fl0 + (1 - fl0) * 0.35;
  const fy = (1 - fl0) * 1.25;
  const fz2 = fl0 * Math.sin(t * 9 - 0.7) * 0.45;
  const fy2 = (1 - fl0) * 0.8;
  p.set("wingL", 0, fy, fz).set("wingR", 0, -fy, -fz);
  p.set("wingL2", 0, fy2, fz2).set("wingR2", 0, -fy2, -fz2);
  // legs: a diagonal trot, a rotary gallop when running
  const legs = (s: string, ph: number, front: boolean) => {
    const sw = Math.sin(ph) * 0.6 * amp * (1 + run * 0.4) * legK;
    const lift = Math.max(0, Math.cos(ph)) * 0.8 * amp * legK;
    if (front) {
      p.set("fu" + s, -sw + fu, 0, 0);
      p.set("fl" + s, lift * 0.7 + fl, 0, 0);
      p.set("fp" + s, 0, 0, 0);
    } else {
      p.set("hu" + s, -sw + hu, 0, 0);
      p.set("hl" + s, -lift * 0.8 + hl, 0, 0);
      p.set("hp" + s, hp, 0, 0);
    }
  };
  const g = run > 0.5;
  legs("L", phase, true);
  legs("R", phase + (g ? 0.5 : Math.PI), true);
  legs("L", phase + Math.PI, false);
  legs("R", phase + (g ? Math.PI + 0.5 : 0), false);
}

// ------------------------------------------------------------ the fight

class Boe implements Boss {
  readonly def = DEF;
  readonly phaseNames = ["", "Play", "The collar", "Ear-wings"];
  readonly adds: Mob[] = [];
  rig: Rig;
  poser: Poser;
  mat: THREE.MeshLambertMaterial;
  x = HOME.x;
  y = 0;
  z = HOME.z;
  yaw = HOME.yaw;
  hp = DEF.hp;
  max = DEF.hp;
  st: St = "dormant";
  t = 0;
  dur = 1;
  phaseN = 1;
  puppet = false;
  /** move speed this frame (m/s), forward along yaw */
  mv = 0;
  private gait = 0;
  private kx = 0;
  private kz = 0;
  /** attack target point (pounce, dive, fetch) */
  private tx = 0;
  private tz = 0;
  private sx = 0;
  private sz = 0;
  private sy = 0;
  /** charge line length */
  private len = 8;
  private chain = 0;
  private flash = 0;
  private cd = 1;
  private stickCd = 3;
  private pulseCd = 4;
  private pulseR = 0;
  private flyA = 0;
  private flyDir = 1;
  private wings = 0;
  private deadT = 0;
  private hitDone = false;
  private decal: Decal | null = null;
  private sticks: Stick[] = [];
  private stickSeq = 0;
  private hitSet = new Set<PlayerState>();
  private target: PlayerState | null = null;
  private retargetT = 0;
  private lickOn: PlayerState | null = null;
  private net: { x: number; z: number; y: number; yaw: number } | null = null;
  // meshes
  private collar: THREE.Mesh;
  private collarMat: THREE.MeshLambertMaterial;
  private collarHome: { p: THREE.Vector3; q: THREE.Quaternion; s: THREE.Vector3 };
  private collarFall: { vx: number; vy: number; vz: number; spin: number; rest: boolean } | null = null;
  private ring: THREE.Mesh;
  private ringMat: THREE.MeshBasicMaterial;
  private stickGeo = buildStickGeo();
  private stickMat = new THREE.MeshLambertMaterial({ color: 0x7a5634 });
  private mouthStick: THREE.Mesh;

  constructor(private env: BossEnv, private parent: THREE.Object3D) {
    this.mat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.FrontSide });
    this.rig = buildBoe(this.mat);
    this.poser = new Poser(this.rig);
    const c = buildCollar();
    this.collar = c.mesh;
    this.collarMat = c.mat;
    this.rig.bones.neck.add(this.collar);
    this.collarHome = { p: this.collar.position.clone(), q: this.collar.quaternion.clone(), s: this.collar.scale.clone() };
    this.mouthStick = new THREE.Mesh(this.stickGeo, this.stickMat);
    this.mouthStick.scale.setScalar(0.8 / S);
    this.mouthStick.position.set(0, 0.0, 0.05);
    this.mouthStick.visible = false;
    this.rig.bones.jaw.add(this.mouthStick);
    const rg = new THREE.RingGeometry(0.9, 1.0, 64);
    rg.rotateX(-Math.PI / 2);
    this.ringMat = new THREE.MeshBasicMaterial({ color: 0xff3a1a, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    this.ring = new THREE.Mesh(rg, this.ringMat);
    this.ring.renderOrder = 7;
    this.ring.frustumCulled = false;
    this.ring.visible = false;
    parent.add(this.ring);
    parent.add(this.rig.group);
    this.pose(10, "lie", 1);
  }

  // ---------------------------------------------------------- Boss contract

  get alive() {
    return this.st !== "dead" && this.st !== "dying";
  }
  get active() {
    return this.st !== "dormant" && this.st !== "dead";
  }
  get fighting() {
    return this.active && this.st !== "dying";
  }

  private get heard() {
    return this.env.heard(this.x, this.z, "kennel", 60);
  }
  private get sfx() {
    return this.heard ? this.env.audio : SILENT;
  }

  setMax(max: number) {
    if (!(max > 0)) return;
    const k = this.max > 0 ? this.hp / this.max : 1;
    this.max = max;
    this.hp = this.fighting ? Math.round(max * k) : this.st === "dead" ? 0 : max;
  }

  reset() {
    this.clearFight();
    this.restoreCollar();
    this.hp = this.max;
    this.st = "dormant";
    this.t = 0;
    this.dur = 1;
    this.phaseN = 1;
    this.x = HOME.x;
    this.z = HOME.z;
    this.y = 0;
    this.yaw = HOME.yaw;
    this.kx = this.kz = 0;
    this.wings = 0;
    this.deadT = 0;
    this.target = null;
    this.lickOn = null;
    this.pose(10, "lie", 1);
  }

  setDead() {
    this.clearFight();
    this.st = "dead";
    this.hp = 0;
    this.y = 0;
    this.x = AX + 1.2;
    this.z = AZ + 3;
    this.yaw = Math.PI * 0.8;
    this.wings = 0;
    this.deadT = 9;
    // the collar lies in the straw beside him
    this.restoreCollar();
    this.parent.attach(this.collar);
    this.collar.position.set(this.x - 1.4, 0.06, this.z - 0.6);
    this.collar.rotation.set(0, 0.7, 0);
    this.collarMat.emissiveIntensity = 0;
    this.collarFall = { vx: 0, vy: 0, vz: 0, spin: 0, rest: true };
    this.pose(10, "dead", 1);
  }

  startIntro() {
    if (this.st !== "dormant") return;
    this.target = null;
    this.go("intro", 1.6);
  }

  canTakeHit() {
    return this.fighting && this.st !== "phase" && !AIR.includes(this.st) && this.y < 0.5;
  }

  hitFlags(fromX: number, fromZ: number) {
    const ang = Math.atan2(fromX - this.x, fromZ - this.z);
    const off = Math.abs(Math.atan2(Math.sin(ang - this.yaw), Math.cos(ang - this.yaw)));
    const grounded = !AIR.includes(this.st) && this.y < 0.5 && !PRE.includes(this.st) && this.st !== "phase";
    return { behind: off > 2.1 && grounded, perched: false, dizzy: this.st === "dizzy" || this.st === "land" };
  }

  netHit(hp: number, fromX: number, fromZ: number, heavy: boolean, fire: boolean) {
    if (!this.alive) return;
    const f = this.hitFlags(fromX, fromZ);
    if (!this.puppet) {
      if (PRE.includes(this.st)) {
        // struck before the lick: the collar wakes at once
        this.go("glow", 1.1);
        this.env.floater("The collar glows red.", this.x, 3.4, this.z, "info");
      } else if (heavy && f.behind && RECOVERING.includes(this.st)) {
        this.go("hurt", 1.1);
        this.env.floater("Staggered!", this.x, 3.4, this.z, "crit");
      }
    }
    this.hp = Math.max(0, Math.min(this.hp, hp));
    this.flash = 0.12;
    this.env.dust.burst(fire ? 6 : 10, this.x + (fromX - this.x) * 0.3, this.y + 1.0, this.z + (fromZ - this.z) * 0.3, 3, 0x2a262c, 0.6, 0.14, { up: 1.5 });
    if (this.hp <= 0 && !this.puppet) this.beginDeath();
  }

  parry(s: number) {
    if (!this.fighting || AIR.includes(this.st) || PRE.includes(this.st) || this.st === "phase") return;
    this.parried(s);
  }

  setPuppet(on: boolean) {
    if (this.puppet === on) return;
    this.puppet = on;
    this.net = null;
    this.target = null;
    if (!on && this.fighting) {
      // take over mid-move: settle and decide afresh
      if (AIR.includes(this.st)) {
        if (this.phaseN === 3) {
          this.y = Math.max(this.y, 1);
          this.go("fly", 1.2);
          this.flyA = Math.atan2(this.x - AX, this.z - AZ);
        } else {
          this.y = 0;
          this.recover(0.5);
        }
      } else if (TELLS.includes(this.st) || ["charge", "nip", "pounce", "pulse", "fetch"].includes(this.st)) {
        this.y = 0;
        this.recover(0.5);
      }
    }
  }

  snap(): BoeSnap {
    const r = (v: number) => Math.round(v * 100) / 100;
    return {
      s: STATES.indexOf(this.st), t: r(Math.max(0, this.t)), d: r(this.dur), x: r(this.x), z: r(this.z), y: r(this.y), yw: r(this.yaw), hp: this.hp,
      ph: this.phaseN, tx: r(this.tx), tz: r(this.tz), ln: r(this.len), mv: r(this.mv), pr: r(this.pulseR),
      sk: this.sticks.map((k) => [k.id, r(k.x), r(k.z), r(k.t), k.snapped ? 1 : 0]),
    };
  }

  applySnap(raw: unknown) {
    const sn = raw as BoeSnap;
    if (!sn || typeof sn.s !== "number") return;
    const st = STATES[sn.s] ?? "dormant";
    if (!this.net || Math.hypot(sn.x - this.x, sn.z - this.z) > 12) {
      this.x = sn.x;
      this.z = sn.z;
      this.y = sn.y;
      this.yaw = sn.yw;
    }
    this.net = { x: sn.x, z: sn.z, y: sn.y, yaw: sn.yw };
    const prev = this.st;
    if (st !== prev || Math.abs(this.t - sn.t) > 0.25) {
      this.t = sn.t;
      this.dur = Math.max(0.001, sn.d);
    }
    if (st !== prev) {
      if (st === "dead" && prev !== "dying") this.setDead();
      else if (st === "dormant" && prev !== "dormant") this.reset();
      else {
        this.st = st;
        this.enter(st, prev);
      }
    }
    this.hp = Math.min(this.hp, sn.hp);
    if (sn.hp > this.hp + 40) this.hp = sn.hp;
    this.phaseN = sn.ph;
    this.tx = sn.tx;
    this.tz = sn.tz;
    this.len = sn.ln;
    this.mv = sn.mv;
    if (Math.abs(this.pulseR - sn.pr) > 1) this.pulseR = sn.pr;
    // sticks: show the ones we have not seen, forget the snapped ones that are gone
    const ids = new Set(sn.sk.map((k) => k[0]));
    for (const [id, x, z, t, snapped] of sn.sk) {
      if (snapped || this.sticks.some((k) => k.id === id)) continue;
      this.addStick(id, x, z, t);
    }
    for (let i = this.sticks.length - 1; i >= 0; i--) {
      const k = this.sticks[i];
      if (!ids.has(k.id) && (k.snapped || k.t <= 0.1)) {
        this.clearStick(k);
        this.sticks.splice(i, 1);
      }
    }
  }

  // ---------------------------------------------------------- per frame

  update(dt: number, inArena: boolean) {
    if (this.puppet) return this.puppetUpdate(dt);
    if (this.fighting && this.hp <= 0) this.beginDeath();
    if (this.st === "dormant" || this.st === "dead") {
      this.present(dt);
      return;
    }
    this.think(dt, inArena);
    this.present(dt);
  }

  private puppetUpdate(dt: number) {
    if (this.st !== "dormant" && this.st !== "dead") {
      this.t -= dt;
      if (this.net) {
        const k = Math.min(1, dt * 9);
        this.x += (this.net.x - this.x) * k;
        this.z += (this.net.z - this.z) * k;
        this.y += (this.net.y - this.y) * k;
        const dy = Math.atan2(Math.sin(this.net.yaw - this.yaw), Math.cos(this.net.yaw - this.yaw));
        this.yaw += dy * Math.min(1, dt * 10);
      }
      if (this.st === "pulse") this.pulseR += PULSE_V * dt;
    }
    this.present(dt);
  }

  /** The runner's decisions: states, timers, movement, blows. */
  private think(dt: number, inArena: boolean) {
    const env = this.env;
    const p = this.choose(dt);
    this.t -= dt;
    const k = 1 - Math.max(0, this.t) / this.dur;
    const d = Math.hypot(p.x - this.x, p.z - this.z);
    this.mv = 0;

    // phase changes (on the ground, between moves)
    if (this.fighting && !PRE.includes(this.st) && this.st !== "glow" && this.st !== "phase" && !AIR.includes(this.st)) {
      if (this.phaseN === 1 && this.hp < this.max * 0.66) {
        this.phaseN = 2;
        this.y = 0;
        this.go("phase", 1.6);
        env.floater("The collar burns.", this.x, 3.4, this.z, "info");
      } else if (this.phaseN === 2 && this.hp < this.max * 0.33) {
        this.phaseN = 3;
        this.y = 0;
        this.go("phase", 2.2);
        env.floater("His ears harden into wings.", this.x, 3.4, this.z, "info");
      }
    }

    switch (this.st) {
      case "intro":
        this.faceTo(p.x, p.z, 3, dt);
        if (this.t <= 0) this.go("play", 6);
        break;
      case "play": {
        // trots up for a pat and sits, wagging; leave him long enough and he licks
        this.faceTo(p.x, p.z, 5, dt);
        if (d > 2.0) this.mv = Math.min(3.4, (d - 1.8) * 2);
        if (Math.random() < dt * 0.35) this.sfx.yelp();
        if (this.t <= 0) {
          this.lickOn = p;
          this.go("lick", 1.5);
          env.speak(LINES.boeLick);
        }
        break;
      }
      case "lick": {
        const q = this.lickOn ?? p;
        const dq = Math.hypot(q.x - this.x, q.z - this.z);
        this.faceTo(q.x, q.z, 6, dt);
        if (dq > 1.6) this.mv = 2.2;
        if (k > 0.4 && !this.hitDone) {
          this.hitDone = true;
          // false safety: a small heal, only for the player on this client
          if (q === env.player && !q.dead && dq < 3.5) {
            const n = Math.max(1, Math.round(q.maxHp * 0.08));
            q.hp = Math.min(q.maxHp, q.hp + n);
            env.floater("+" + n, q.x, 2.2, q.z, "heal");
          }
        }
        if (this.t <= 0) this.go("glow", 1.4);
        break;
      }
      case "glow":
        this.faceTo(p.x, p.z, 3, dt);
        if (this.t <= 0) {
          this.phaseN = 1;
          this.stickCd = 4;
          this.pulseCd = 5;
          this.recover(0.3);
        }
        break;
      case "idle":
      case "recover": {
        if (this.st === "recover") {
          if (this.t <= 0) this.st = "idle";
          break;
        }
        this.faceTo(p.x, p.z, 4.5, dt);
        if (!inArena) break;
        this.cd -= dt;
        this.stickCd -= dt;
        this.pulseCd -= dt;
        if (this.phaseN === 1) {
          if (d > 3) this.mv = d > 7 ? 5 : 3.2;
        } else if (this.phaseN === 2) {
          if (d > 2.6) this.mv = d > 7 ? 6 : 4;
        }
        if (this.cd > 0) break;
        if (this.phaseN === 3) {
          this.go("lift", 0.8);
          break;
        }
        if (this.stickCd <= 0 && this.sticks.length < 2 && Math.random() < (this.phaseN === 1 ? 0.45 : 0.25)) {
          const a = Math.random() * Math.PI * 2;
          const r = 1.6 + Math.random() * 1.6;
          const c = this.clampArena(p.x + Math.sin(a) * r, p.z + Math.cos(a) * r, 2);
          this.tx = c.x;
          this.tz = c.z;
          this.stickCd = this.phaseN === 1 ? 7 : 10;
          this.go("fetch", 2.6);
        } else if (this.phaseN === 2 && this.pulseCd <= 0 && Math.random() < 0.55) {
          this.pulseCd = 8 + Math.random() * 3;
          this.go("pulsetell", 0.95);
        } else if (d < 3) {
          if (this.phaseN === 2 && Math.random() < 0.4) this.startPounce(p);
          else this.go("niptell", 0.45);
        } else if (d > 4 || this.phaseN === 2) {
          if (this.phaseN === 2 && Math.random() < 0.45) this.startPounce(p);
          else {
            this.chain = this.phaseN === 2 && Math.random() < 0.5 ? 1 : 0;
            this.go("chargetell", this.phaseN === 2 ? 0.65 : 0.75);
          }
        }
        break;
      }
      case "chargetell":
        if (k < 0.6) this.faceTo(p.x, p.z, 5, dt);
        this.len = Math.min(16, Math.max(6, d + 3));
        if (this.t <= 0) {
          this.sx = this.x;
          this.sz = this.z;
          this.go("charge", this.len / 15);
        }
        break;
      case "charge": {
        const sp = 15;
        const nx = this.x + Math.sin(this.yaw) * sp * dt;
        const nz = this.z + Math.cos(this.yaw) * sp * dt;
        const s = env.col.resolve(nx, nz, 0.9);
        const bumped = Math.abs(s.x - nx) + Math.abs(s.z - nz) > 0.05;
        this.x = s.x;
        this.z = s.z;
        this.strike((q) => Math.hypot(q.x - this.x, q.z - this.z) < 1.5, 14, this.x, this.z, { knock: 2.4 });
        if (bumped) {
          this.sfx.thud();
          if (this.heard) env.shake(0.3);
          this.go("dizzy", 1.6);
        } else if (this.t <= 0) {
          if (this.chain > 0) {
            this.chain--;
            this.go("chargetell", 0.6);
          } else if (Math.random() < 0.3) this.go("roll", 0.7);
          else this.recover(0.8);
        }
        break;
      }
      case "niptell":
        this.faceTo(p.x, p.z, 7, dt);
        if (this.t <= 0) {
          this.kx += Math.sin(this.yaw) * 5;
          this.kz += Math.cos(this.yaw) * 5;
          this.go("nip", 0.28);
        }
        break;
      case "nip":
        this.strike(
          (q) => {
            const ang = Math.atan2(q.x - this.x, q.z - this.z);
            return Math.hypot(q.x - this.x, q.z - this.z) < 2.9 && Math.abs(Math.atan2(Math.sin(ang - this.yaw), Math.cos(ang - this.yaw))) < 0.8;
          },
          10, this.x, this.z, { knock: 1.2, parryable: true, source: { stagger: (s) => this.parried(s) } },
        );
        if (this.t <= 0) this.recover(0.55);
        break;
      case "fetch": {
        const dd = Math.hypot(this.tx - this.x, this.tz - this.z);
        this.faceTo(this.tx, this.tz, 7, dt);
        this.mv = Math.min(5.5, dd * 4);
        if (dd < 0.7 || this.t <= 0) {
          const sx = this.x + Math.sin(this.yaw) * 1.0;
          const sz = this.z + Math.cos(this.yaw) * 1.0;
          const c = this.clampArena(sx, sz, 1.5);
          this.addStick("k" + ++this.stickSeq + Math.random().toString(36).slice(2, 4), c.x, c.z, STICK_T);
          this.go("drop", 0.6);
        }
        break;
      }
      case "drop":
        if (this.t <= 0) this.recover(0.4);
        break;
      case "pouncetell":
        if (k < 0.5) {
          const c = this.clampArena(p.x, p.z, 1.5);
          this.tx += (c.x - this.tx) * Math.min(1, dt * 4);
          this.tz += (c.z - this.tz) * Math.min(1, dt * 4);
        }
        this.faceTo(this.tx, this.tz, 6, dt);
        if (this.t <= 0) {
          this.sx = this.x;
          this.sz = this.z;
          this.kx = this.kz = 0;
          this.go("pounce", 0.55);
        }
        break;
      case "pounce": {
        const e = ease(k);
        this.x = this.sx + (this.tx - this.sx) * e;
        this.z = this.sz + (this.tz - this.sz) * e;
        this.y = Math.sin(k * Math.PI) * 2.0;
        if (this.t <= 0) {
          this.y = 0;
          this.x = this.tx;
          this.z = this.tz;
          this.strike((q) => Math.hypot(q.x - this.x, q.z - this.z) < 2.6, 18, this.x, this.z, { knock: 2.6 });
          if (Math.random() < 0.35) this.go("roll", 0.7);
          else this.recover(1.0);
        }
        break;
      }
      case "pulsetell":
        if (this.t <= 0) {
          this.pulseR = 0.8;
          this.go("pulse", (AR + 3) / PULSE_V);
        }
        break;
      case "pulse":
        this.pulseR += PULSE_V * dt;
        for (const q of this.foes()) {
          if (this.hitSet.has(q)) continue;
          const dq = Math.hypot(q.x - this.x, q.z - this.z);
          if (dq > this.pulseR) continue;
          // the ring passed this player: a dodge-roll through it is the only answer
          this.hitSet.add(q);
          if (q.iframe > 0) {
            if (q === env.player) env.floater("Through!", q.x, 2.4, q.z, "info");
            continue;
          }
          env.hurt(q, 15, this.x, this.z, { knock: 1.8, unblockable: true, src: "boe" });
        }
        if (this.t <= 0) {
          this.pulseR = 0;
          this.recover(0.6);
        }
        break;
      case "phase":
        this.faceTo(p.x, p.z, 2, dt);
        if (this.t <= 0) {
          this.pulseCd = 2;
          this.recover(0.3);
        }
        break;
      case "lift":
        this.y = ease(k) * FLY_Y;
        this.faceTo(p.x, p.z, 3, dt);
        if (this.t <= 0) {
          this.flyA = Math.atan2(this.x - AX, this.z - AZ);
          this.flyDir = Math.random() < 0.5 ? 1 : -1;
          this.go("fly", 2.4 + Math.random() * 1.2);
        }
        break;
      case "fly": {
        this.flyA += this.flyDir * dt * 0.95;
        const gx = AX + Math.sin(this.flyA) * 6.5;
        const gz = AZ + Math.cos(this.flyA) * 6.5;
        const dx = gx - this.x;
        const dz = gz - this.z;
        const dd = Math.hypot(dx, dz);
        const step = Math.min(dd, 8 * dt);
        if (dd > 0.01) {
          this.x += (dx / dd) * step;
          this.z += (dz / dd) * step;
          this.faceTo(gx, gz, 5, dt);
        }
        this.y += (FLY_Y + Math.sin(this.env.time * 3) * 0.25 - this.y) * Math.min(1, dt * 4);
        if (this.t <= 0) {
          const c = this.clampArena(p.x, p.z, 2);
          this.tx = c.x;
          this.tz = c.z;
          this.go("divetell", 0.9);
        }
        break;
      }
      case "divetell":
        if (k < 0.4) {
          const c = this.clampArena(p.x, p.z, 2);
          this.tx += (c.x - this.tx) * Math.min(1, dt * 5);
          this.tz += (c.z - this.tz) * Math.min(1, dt * 5);
        }
        this.faceTo(this.tx, this.tz, 6, dt);
        this.y += (FLY_Y + 0.5 - this.y) * Math.min(1, dt * 4);
        if (this.t <= 0) {
          this.sx = this.x;
          this.sz = this.z;
          this.sy = this.y;
          this.go("dive", 0.45);
        }
        break;
      case "dive": {
        const e = k * k;
        this.x = this.sx + (this.tx - this.sx) * e;
        this.z = this.sz + (this.tz - this.sz) * e;
        this.y = this.sy * (1 - e);
        if (this.t <= 0) {
          this.y = 0;
          this.x = this.tx;
          this.z = this.tz;
          this.strike((q) => Math.hypot(q.x - this.x, q.z - this.z) < 2.8, 22, this.x, this.z, { knock: 3 });
          this.go("land", 2.2);
        }
        break;
      }
      case "land":
      case "dizzy":
        if (this.t <= 0) this.recover(this.phaseN === 3 ? 0.4 : 0.2);
        break;
      case "hurt":
        if (this.t <= 0) this.recover(0.3);
        break;
      case "roll":
        this.mv = 1.5;
        if (this.t <= 0) this.recover(0.5);
        break;
      case "dying":
        this.y = Math.max(0, this.y - dt * 5);
        this.deadT += dt;
        if (this.t <= 0) this.st = "dead";
        break;
    }

    // motion
    if (this.mv > 0 && this.st !== "charge") {
      const nx = this.x + Math.sin(this.yaw) * this.mv * dt;
      const nz = this.z + Math.cos(this.yaw) * this.mv * dt;
      const s = env.col.resolve(nx, nz, 0.9);
      this.x = s.x;
      this.z = s.z;
    }
    if (this.kx || this.kz) {
      const s = env.col.resolve(this.x + this.kx * dt, this.z + this.kz * dt, 0.9);
      this.x = s.x;
      this.z = s.z;
      this.kx *= Math.exp(-dt * 6);
      this.kz *= Math.exp(-dt * 6);
      if (Math.abs(this.kx) + Math.abs(this.kz) < 0.05) this.kx = this.kz = 0;
    }
    if (this.st !== "dormant") {
      const c = this.clampArena(this.x, this.z, 1.2);
      this.x = c.x;
      this.z = c.z;
    }
    if (!Number.isFinite(this.x) || !Number.isFinite(this.z) || !Number.isFinite(this.y)) {
      this.x = AX;
      this.z = AZ + 4;
      this.y = 0;
    }
  }

  /** Shared by the runner and puppets: tells, the collar, sticks, the ring, the pose. */
  private present(dt: number) {
    const env = this.env;
    const k = 1 - Math.max(0, this.t) / this.dur;
    const time = env.time;
    if (this.flash > 0) this.flash -= dt;
    this.mat.emissive.setHex(this.flash > 0 ? 0xff9966 : 0x000000);
    this.mat.emissiveIntensity = this.flash > 0 ? 0.8 : 0;

    // the collar's glow
    let glow = 0;
    if (this.st === "glow") glow = k * 1.4;
    else if (this.st === "pulsetell") glow = 1 + k * 1.8;
    else if (this.st === "pulse") glow = 2.2 * (1 - k) + 0.6;
    else if (this.st === "phase") glow = 1.6 + Math.sin(time * 14) * 0.4;
    else if (this.st === "dying") glow = this.collarFall ? 0 : Math.random() < 0.5 ? 0.9 : 0.1;
    else if (this.fighting && !PRE.includes(this.st)) glow = 0.55 + Math.sin(time * 4) * 0.2 + (this.phaseN - 1) * 0.15;
    this.collarMat.emissiveIntensity = glow;

    // the wings
    const wTarget = this.phaseN === 3 && this.fighting ? (this.st === "phase" ? ease(clamp01((k - 0.2) / 0.8)) : 1) : 0;
    this.wings += (wTarget - this.wings) * Math.min(1, dt * (this.st === "phase" ? 12 : 3));
    if (this.wings < 0.002) this.wings = 0;

    // telegraphs
    const dc = this.decal;
    switch (this.st) {
      case "chargetell":
        dc?.show(2, this.x, 0, this.z, this.yaw, this.len, k, { w: 1.3 });
        break;
      case "niptell":
        dc?.show(1, this.x, 0, this.z, this.yaw, 2.9, k, { half: 0.8 });
        break;
      case "pouncetell":
        dc?.show(0, this.tx, 0, this.tz, 0, 2.6, k);
        break;
      case "pulsetell":
        dc?.show(0, this.x, 0, this.z, 0, 2.2, k, { color: 0xd8281a });
        if (Math.random() < dt * 20) env.sparks.emit({ x: this.x + Math.sin(this.yaw) * 0.9, y: 1.2, z: this.z + Math.cos(this.yaw) * 0.9, vx: (Math.random() - 0.5) * 2, vy: 1.5, vz: (Math.random() - 0.5) * 2, life: 0.4, size: 0.16, color: 0xff4a2a, grav: 2 });
        break;
      case "divetell":
        dc?.show(0, this.tx, 0, this.tz, 0, 2.8, k, { color: 0xc8402a });
        break;
    }
    if (this.st === "charge" || this.st === "pounce") {
      if (Math.random() < 0.6) env.dust.emit({ x: this.x, y: 0.2, z: this.z, vx: Math.random() - 0.5, vy: 1, vz: Math.random() - 0.5, life: 0.6, size: 0.4, color: 0x6a5a48, a: 0.6, grav: 1 });
    }
    if ((this.st === "dizzy" || this.st === "land") && Math.random() < dt * 6) {
      env.sparks.emit({ x: this.x + Math.sin(time * 5) * 0.7, y: this.y + 2.0, z: this.z + Math.cos(time * 5) * 0.7, life: 0.5, size: 0.18, color: 0xffe0a0, grav: -0.5 });
    }

    // the collar pulse ring
    if (this.st === "pulse" && this.pulseR > 0) {
      this.ring.visible = true;
      this.ring.position.set(this.x, 0.2, this.z);
      this.ring.scale.setScalar(Math.max(0.1, this.pulseR));
      this.ringMat.opacity = 0.85 * (1 - Math.min(1, this.pulseR / (AR + 3)) * 0.5);
    } else this.ring.visible = false;

    this.updateSticks(dt);
    this.updateCollarFall(dt);
    this.mouthStick.visible = this.st === "fetch";

    // pose
    let act: Act = "idle";
    let at = k;
    let wag = this.fighting ? 0.25 : 0.4;
    switch (this.st) {
      case "dormant":
        act = "lie";
        at = 1;
        wag = 0.15;
        break;
      case "intro":
        act = "bark";
        wag = 1;
        break;
      case "play":
        act = this.mv > 0.3 ? "idle" : "sit";
        at = 1;
        wag = 1;
        break;
      case "lick":
        act = "lick";
        break;
      case "glow":
      case "phase":
        act = "growl";
        break;
      case "idle":
        wag = this.phaseN === 1 ? 0.6 : 0.2;
        break;
      case "recover":
        act = "idle";
        wag = 0.5;
        break;
      case "chargetell":
      case "pouncetell":
      case "niptell":
        act = "crouch";
        break;
      case "charge":
        act = "idle";
        break;
      case "nip":
        act = "bite";
        break;
      case "fetch":
        wag = 1;
        break;
      case "drop":
        act = "bark";
        break;
      case "pounce":
        act = "leap";
        break;
      case "pulsetell":
      case "pulse":
        act = "sit";
        at = 1;
        wag = 0;
        break;
      case "lift":
      case "fly":
      case "divetell":
        act = "fly";
        break;
      case "dive":
        act = "dive";
        break;
      case "land":
      case "dizzy":
        act = "dizzy";
        break;
      case "hurt":
        act = "hurt";
        break;
      case "roll":
        act = "roll";
        break;
      case "dying":
        this.deadT += this.puppet ? dt : 0;
        if (this.deadT < 0.9) {
          act = "hurt";
          at = 0.5;
        } else if (this.deadT < 2.0) {
          act = "lie";
          at = (this.deadT - 0.9) / 0.8;
        } else {
          act = "dead";
          at = (this.deadT - 2.0) / 1.0;
        }
        if (this.deadT > 1.1 && !this.collarFall) this.dropCollar();
        if (this.puppet && this.t <= 0 && this.deadT > 3.2) this.st = "dead";
        wag = 0;
        break;
      case "dead":
        act = "dead";
        at = 1;
        wag = 0;
        if (!this.collarFall) this.dropCollar();
        break;
    }
    const speed = this.st === "charge" ? 15 : this.st === "pounce" ? 10 : this.mv;
    const move = speed / 3.2;
    this.gait += speed * dt * 3.2;
    const flap = this.st === "lift" || this.st === "fly" || this.st === "divetell" ? 1 : this.st === "dive" ? 0.3 : 0;
    this.pose(dt, act, at, move, wag, flap);
    this.rig.group.position.set(this.x, this.y + this.env.groundAt(this.x, this.z), this.z);
    this.rig.group.rotation.y = this.yaw;
  }

  private pose(dt: number, act: Act, at: number, move = 0, wag = 0.3, flap = 0) {
    poseDog(this.poser, { t: this.env.time, move, phase: this.gait, act, at, wag, wings: this.wings, flap }, dt);
  }

  // ---------------------------------------------------------- state plumbing

  private go(st: St, dur: number) {
    const prev = this.st;
    this.st = st;
    this.t = dur;
    this.dur = Math.max(0.001, dur);
    this.hitDone = false;
    this.hitSet.clear();
    this.enter(st, prev);
  }

  /** Sounds, decals and bursts when a state begins (the runner and puppets alike). */
  private enter(st: St, prev: St) {
    const env = this.env;
    if (TELLS.includes(prev) || st === "dying") {
      env.decals.release(this.decal);
      this.decal = null;
    }
    if (TELLS.includes(st)) {
      env.decals.release(this.decal);
      this.decal = env.decals.get();
    }
    if (prev === "pounce" || prev === "dive") {
      const big = prev === "dive";
      env.flashes.ring(this.x, 0, this.z, big ? 4.2 : 3.6, 0xff9a70, 0.55);
      env.dust.burst(big ? 32 : 22, this.x, 0.3, this.z, big ? 6 : 5, 0x6a5a48, 0.9, 0.35, { up: 1.5 });
      this.sfx.thud();
      if (this.heard) env.shake(big ? 0.6 : 0.4);
      if (big) env.floater("Dizzy!", this.x, 3.2, this.z, "info");
    }
    if (prev === "pulse") this.pulseR = 0;
    switch (st) {
      case "intro":
        this.sfx.yelp();
        this.sfx.yelp();
        break;
      case "lick":
        this.sfx.hiss(0.25, 2600, 0.08, { type: "bandpass" });
        break;
      case "glow":
        this.sfx.growl();
        this.sfx.bell(0.08, 196);
        env.flashes.ring(this.x, 0, this.z, 2.4, 0xff3a1a, 0.6);
        break;
      case "chargetell":
      case "pouncetell":
        this.sfx.growl();
        break;
      case "charge":
      case "pounce":
      case "dive":
        this.sfx.swing(true);
        break;
      case "nip":
        this.sfx.swing(false);
        this.sfx.clack();
        break;
      case "fetch":
        this.sfx.yelp();
        break;
      case "drop":
        this.sfx.clack();
        break;
      case "pulsetell":
        this.sfx.charge();
        break;
      case "pulse":
        this.sfx.thud();
        this.sfx.bell(0.14, 220);
        if (this.heard) env.shake(0.25);
        break;
      case "phase":
        this.sfx.growl();
        if (this.phaseN === 3) this.sfx.shriek();
        env.flashes.ring(this.x, 0, this.z, 3.2, 0xff3a1a, 0.7);
        break;
      case "lift":
        this.sfx.hiss(0.4, 380, 0.3, { type: "lowpass" });
        env.dust.burst(20, this.x, 0.3, this.z, 5, 0x6a5a48, 0.8, 0.35, { up: 1 });
        break;
      case "divetell":
        this.sfx.shriek();
        break;
      case "dizzy":
        env.floater("Dizzy!", this.x, 3.2, this.z, "info");
        break;
      case "hurt":
        this.sfx.yelp();
        break;
      case "roll":
        this.sfx.yelp();
        break;
      case "dying":
        this.deadT = 0;
        this.pulseR = 0;
        this.ring.visible = false;
        for (const s of this.sticks) this.clearStick(s);
        this.sticks = [];
        this.sfx.tone(1150, 0.5, "sine", 0.13, { to: 650 });
        this.sfx.tone(980, 0.7, "sine", 0.11, { to: 520, delay: 0.6 });
        break;
    }
  }

  private recover(t: number) {
    this.cd = (this.phaseN === 1 ? 0.7 : this.phaseN === 2 ? 0.35 : 0.5) + Math.random() * 0.4;
    this.go("recover", t);
  }

  private parried(s: number) {
    this.env.floater("Parried!", this.x, 3.2, this.z, "crit");
    this.go("dizzy", s + 0.6);
  }

  private startPounce(p: PlayerState) {
    const c = this.clampArena(p.x, p.z, 1.5);
    this.tx = c.x;
    this.tz = c.z;
    this.go("pouncetell", 0.7);
  }

  private beginDeath() {
    this.y = Math.max(0, this.y);
    this.go("dying", 3.4);
    this.env.floater("He whimpers.", this.x, 3.0, this.z, "info");
  }

  private clearFight() {
    this.env.decals.release(this.decal);
    this.decal = null;
    for (const s of this.sticks) this.clearStick(s);
    this.sticks = [];
    this.pulseR = 0;
    this.ring.visible = false;
    this.mouthStick.visible = false;
    this.kx = this.kz = 0;
  }

  private foes() {
    return this.env.players().filter((q) => q.zone === "kennel" && !q.dead);
  }

  /** Nearest player first; then every ~6 s the next player in the arena takes a turn. */
  private choose(dt: number): PlayerState {
    const foes = this.foes();
    const inA = foes.filter((q) => Math.hypot(q.x - AX, q.z - AZ) < AR + 2);
    const pool = inA.length ? inA : foes;
    if (this.target && !pool.includes(this.target)) this.target = null;
    this.retargetT -= dt;
    if (!this.target) {
      let best: PlayerState | null = null;
      let bd = 1e9;
      for (const q of pool) {
        const d = Math.hypot(q.x - this.x, q.z - this.z);
        if (d < bd) {
          bd = d;
          best = q;
        }
      }
      this.target = best;
      this.retargetT = 6;
    } else if (this.retargetT <= 0 && (this.st === "idle" || this.st === "recover" || this.st === "fly")) {
      this.retargetT = 6;
      if (pool.length > 1) this.target = pool[(pool.indexOf(this.target) + 1) % pool.length];
    }
    return this.target ?? this.env.player;
  }

  /** Hurts every standing player for whom `test` holds, once per move. */
  private strike(test: (q: PlayerState) => boolean, dmg: number, sx: number, sz: number, o: HurtOpts) {
    for (const q of this.foes()) {
      if (this.hitSet.has(q) || !test(q)) continue;
      this.hitSet.add(q);
      this.env.hurt(q, dmg, sx, sz, { ...o, src: "boe" });
    }
  }

  private faceTo(x: number, z: number, rate: number, dt: number) {
    if (Math.abs(x - this.x) + Math.abs(z - this.z) < 0.01) return;
    const ty = Math.atan2(x - this.x, z - this.z);
    const d = Math.atan2(Math.sin(ty - this.yaw), Math.cos(ty - this.yaw));
    this.yaw += Math.sign(d) * Math.min(Math.abs(d), rate * dt);
  }

  private clampArena(x: number, z: number, margin: number) {
    const dx = x - AX;
    const dz = z - AZ;
    const dd = Math.hypot(dx, dz);
    const lim = AR - margin;
    if (dd <= lim || dd < 1e-6) return { x, z };
    return { x: AX + (dx / dd) * lim, z: AZ + (dz / dd) * lim };
  }

  // ---------------------------------------------------------- sticks

  private addStick(id: string, x: number, z: number, t: number) {
    const mesh = new THREE.Mesh(this.stickGeo, this.stickMat);
    mesh.position.set(x, this.env.groundAt(x, z) + 0.05, z);
    mesh.rotation.y = Math.random() * Math.PI;
    mesh.castShadow = true;
    this.parent.add(mesh);
    this.sticks.push({ id, x, z, t, snapped: false, mesh, decal: this.env.decals.get() });
  }

  private clearStick(s: Stick) {
    this.env.decals.release(s.decal);
    s.decal = null;
    s.mesh.parent?.remove(s.mesh);
  }

  /** Dropped sticks: a ring that fills, then a snap that hurts (only where the world runs). */
  private updateSticks(dt: number) {
    const env = this.env;
    for (let i = this.sticks.length - 1; i >= 0; i--) {
      const s = this.sticks[i];
      s.t -= dt;
      if (!s.snapped) {
        s.decal?.show(0, s.x, 0, s.z, 0, STICK_R, 1 - Math.max(0, s.t) / STICK_T, { color: 0xb04a3a });
        if (s.t < 0.5) s.mesh.rotation.z = Math.sin(env.time * 60) * 0.06;
        if (s.t <= 0) {
          s.snapped = true;
          env.decals.release(s.decal);
          s.decal = null;
          env.dust.burst(14, s.x, 0.3, s.z, 4, 0x7a5634, 0.6, 0.2, { up: 2 });
          env.flashes.ring(s.x, 0, s.z, STICK_R, 0xffb070, 0.35);
          this.sfx.clack();
          this.sfx.hit(false, true);
          if (this.heard) env.shake(0.12);
          if (!this.puppet)
            for (const q of this.foes()) if (Math.hypot(q.x - s.x, q.z - s.z) < STICK_R) env.hurt(q, 12, s.x, s.z, { knock: 1.5, src: "boe" });
          s.t = 0.6;
        }
      } else if (s.t <= 0) {
        this.clearStick(s);
        this.sticks.splice(i, 1);
      } else {
        s.mesh.scale.setScalar(Math.max(0.01, s.t / 0.6));
        s.mesh.position.y = 0.05 + (0.6 - s.t) * 0.8;
      }
    }
  }

  // ---------------------------------------------------------- the collar

  private dropCollar() {
    this.parent.attach(this.collar);
    this.collarFall = { vx: (Math.random() - 0.5) * 2, vy: 2.2, vz: (Math.random() - 0.5) * 2, spin: (Math.random() - 0.5) * 8, rest: false };
    const p = this.collar.position;
    this.env.sparks.burst(18, p.x, p.y, p.z, 3, 0xff4a2a, 0.5, 0.15, { up: 2 });
    this.sfx.clack();
    this.sfx.tone(2400, 0.12, "square", 0.06, { to: 1200 });
    this.collarMat.emissiveIntensity = 0;
  }

  private updateCollarFall(dt: number) {
    const f = this.collarFall;
    if (!f || f.rest) return;
    const c = this.collar;
    f.vy -= 9.8 * dt;
    c.position.x += f.vx * dt;
    c.position.y += f.vy * dt;
    c.position.z += f.vz * dt;
    c.rotation.y += f.spin * dt;
    c.rotation.x *= Math.exp(-dt * 3);
    c.rotation.z *= Math.exp(-dt * 3);
    const floor = this.env.groundAt(c.position.x, c.position.z) + 0.06;
    if (c.position.y <= floor) {
      c.position.y = floor;
      if (f.vy < -2) {
        f.vy = -f.vy * 0.3;
        f.vx *= 0.5;
        f.vz *= 0.5;
        this.sfx.clack();
      } else {
        f.rest = true;
        c.rotation.x = 0;
        c.rotation.z = 0;
      }
    }
  }

  private restoreCollar() {
    this.collarFall = null;
    if (this.collar.parent !== this.rig.bones.neck) {
      this.collar.parent?.remove(this.collar);
      this.rig.bones.neck.add(this.collar);
    }
    this.collar.position.copy(this.collarHome.p);
    this.collar.quaternion.copy(this.collarHome.q);
    this.collar.scale.copy(this.collarHome.s);
  }
}

export function createBoe(env: BossEnv, parent: THREE.Object3D): Boss {
  return new Boe(env, parent);
}
