import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/**
 * Procedural characters. Each body is one SkinnedMesh: parts are modelled in bone space,
 * rigidly weighted to their bone, merged, and bound. One draw call per character, and
 * every pose is computed in code, so there are no animation files to load.
 */

export type Rig = {
  group: THREE.Group;
  mesh: THREE.SkinnedMesh;
  bones: Record<string, THREE.Bone>;
  rest: Record<string, THREE.Vector3>;
  sockets: Record<string, THREE.Object3D>;
  height: number;
};

type PartDef = { bone: string; geo: THREE.BufferGeometry; color: THREE.Color };

class RigBuilder {
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
    return b;
  }
  part(bone: string, geo: THREE.BufferGeometry, color: THREE.ColorRepresentation) {
    this.parts.push({ bone, geo, color: new THREE.Color(color) });
  }
  build(mat: THREE.Material, height: number): Rig {
    const root = this.list[0];
    root.updateMatrixWorld(true);
    const geos: THREE.BufferGeometry[] = [];
    for (const p of this.parts) {
      let g = p.geo;
      if (!g.index) {
        const n = g.getAttribute("position").count;
        g.setIndex([...Array(n).keys()]);
      }
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
    const geo = mergeGeometries(geos, false)!;
    const mesh = new THREE.SkinnedMesh(geo, mat);
    mesh.add(root);
    mesh.updateMatrixWorld(true);
    mesh.bind(new THREE.Skeleton(this.list));
    mesh.castShadow = true;
    mesh.receiveShadow = false;
    mesh.frustumCulled = false;
    const group = new THREE.Group();
    group.add(mesh);
    const rest: Record<string, THREE.Vector3> = {};
    for (const b of this.list) rest[b.name] = b.position.clone();
    return { group, mesh, bones: this.bones, rest, sockets: {}, height };
  }
}

// ------------------------------------------------------------ part shapes (bone space)

const ell = (rx: number, ry: number, rz: number, x = 0, y = 0, z = 0, seg = 10) => {
  const g = new THREE.SphereGeometry(1, seg, Math.max(6, Math.floor(seg * 0.75)));
  g.scale(rx, ry, rz);
  g.translate(x, y, z);
  return g;
};
const cap = (r: number, len: number, x = 0, y = 0, z = 0, seg = 8) => {
  const g = new THREE.CapsuleGeometry(r, len, 3, seg);
  g.translate(x, y, z);
  return g;
};
const cyl = (r0: number, r1: number, h: number, x = 0, y = 0, z = 0, seg = 10, open = false) => {
  const g = new THREE.CylinderGeometry(r1, r0, h, seg, 1, open);
  g.translate(x, y, z);
  return g;
};
const box = (w: number, h: number, d: number, x = 0, y = 0, z = 0) => {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(x, y, z);
  return g;
};
const cone = (r: number, h: number, x = 0, y = 0, z = 0, seg = 8) => {
  const g = new THREE.ConeGeometry(r, h, seg);
  g.translate(x, y, z);
  return g;
};
const rot = (g: THREE.BufferGeometry, rx: number, ry: number, rz: number) => {
  g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, ry, rz)));
  return g;
};
const at = (g: THREE.BufferGeometry, x: number, y: number, z: number) => g.translate(x, y, z);

const charMat = new THREE.MeshLambertMaterial({ vertexColors: true });
export const characterMaterial = charMat;

// ------------------------------------------------------------ humanoids

export type HumanLook = {
  skin: number;
  hair: number;
  hairStyle: "tied" | "short" | "long" | "bald" | "hood";
  shirt: number;
  coat: number;
  coatLong?: boolean;
  trousers: number;
  boots: number;
  belt?: number;
  frame?: number;
  height?: number;
  beard?: boolean;
  apron?: number;
  pin?: boolean;
  cape?: number;
  ears?: "goblin";
  headScale?: number;
  hat?: "bearskin" | "redcap" | "straw";
  face?: "toy";
};

export function buildHuman(look: HumanLook): Rig {
  const b = new RigBuilder();
  const f = look.frame ?? 1;
  const hs = look.headScale ?? 1;
  b.bone("root", null, 0, 0, 0);
  b.bone("hips", "root", 0, 0.98, 0);
  b.bone("spine", "hips", 0, 0.12, 0);
  b.bone("chest", "spine", 0, 0.2, 0);
  b.bone("neck", "chest", 0, 0.2, 0);
  b.bone("head", "neck", 0, 0.08, 0);
  for (const [s, sx] of [["L", 1], ["R", -1]] as const) {
    b.bone("shoulder" + s, "chest", sx * 0.19 * f, 0.13, 0);
    b.bone("arm" + s, "shoulder" + s, 0, 0, 0);
    b.bone("fore" + s, "arm" + s, 0, -0.29, 0);
    b.bone("hand" + s, "fore" + s, 0, -0.26, 0);
    b.bone("thigh" + s, "hips", sx * 0.1 * f, -0.04, 0);
    b.bone("shin" + s, "thigh" + s, 0, -0.44, 0);
    b.bone("foot" + s, "shin" + s, 0, -0.42, 0);
  }
  const coat = look.coat;
  const toy = look.face === "toy";
  // torso
  b.part("hips", ell(0.17 * f, 0.13, 0.12, 0, 0.02, 0), look.trousers);
  b.part("spine", ell(0.165 * f, 0.15, 0.115, 0, 0.08, 0.005), look.shirt);
  b.part("chest", ell(0.205 * f, 0.18, 0.13, 0, 0.06, 0), coat);
  b.part("chest", ell(0.11 * f, 0.07, 0.09, 0.12 * f, 0.13, 0), coat);
  b.part("chest", ell(0.11 * f, 0.07, 0.09, -0.12 * f, 0.13, 0), coat);
  b.part("hips", cyl(look.coatLong ? 0.3 * f : 0.25 * f, 0.19 * f, look.coatLong ? 0.62 : 0.34, 0, look.coatLong ? -0.22 : -0.1, 0, 12, true), coat);
  b.part("spine", cyl(0.17 * f, 0.19 * f, 0.24, 0, 0.05, 0, 12, true), coat);
  b.part("hips", cyl(0.18 * f, 0.18 * f, 0.06, 0, 0.08, 0, 12), look.belt ?? 0x3c2a1c);
  b.part("hips", box(0.06, 0.05, 0.03, 0, 0.08, 0.18 * f), 0x9a8a6a);
  if (look.apron != null) {
    b.part("chest", box(0.3 * f, 0.3, 0.03, 0, 0.0, 0.135), look.apron);
    b.part("hips", box(0.32 * f, 0.5, 0.03, 0, -0.18, 0.19 * f), look.apron);
  }
  if (look.pin) b.part("chest", ell(0.022, 0.022, 0.012, 0.09, 0.12, 0.13), 0xb87333);
  if (look.cape != null) b.part("chest", rot(box(0.42 * f, 0.9, 0.03, 0, -0.38, -0.15), 0.08, 0, 0), look.cape);
  // neck and head
  b.part("neck", cyl(0.05, 0.055, 0.12, 0, 0.04, 0, 8), look.skin);
  const H = 0.118 * hs;
  b.part("head", ell(H, H * 1.12, H * 1.05, 0, 0.11 * hs, 0.005), look.skin);
  b.part("head", ell(H * 0.75, H * 0.45, H * 0.7, 0, 0.03 * hs, 0.03), look.skin);
  if (!toy) b.part("head", at(rot(cone(0.022 * hs, 0.06 * hs, 0, 0, 0, 5), Math.PI / 2, 0, 0), 0, 0.095 * hs, 0.125 * hs), look.skin);
  const eye = toy ? 0x1c1916 : 0x231d18;
  b.part("head", ell(0.017 * hs, 0.019 * hs, 0.01, 0.042 * hs, 0.125 * hs, 0.112 * hs, 6), eye);
  b.part("head", ell(0.017 * hs, 0.019 * hs, 0.01, -0.042 * hs, 0.125 * hs, 0.112 * hs, 6), eye);
  if (!toy) {
    b.part("head", box(0.04 * hs, 0.009, 0.01, 0.043 * hs, 0.152 * hs, 0.112 * hs), look.hair);
    b.part("head", box(0.04 * hs, 0.009, 0.01, -0.043 * hs, 0.152 * hs, 0.112 * hs), look.hair);
  } else {
    b.part("head", ell(0.025, 0.018, 0.01, 0.06, 0.085, 0.105, 6), 0xb05a50);
    b.part("head", ell(0.025, 0.018, 0.01, -0.06, 0.085, 0.105, 6), 0xb05a50);
  }
  if (look.ears === "goblin") {
    b.part("head", at(rot(cone(0.04 * hs, 0.2 * hs, 0, 0, 0, 5), 0, 0, -1.25), 0.15 * hs, 0.13 * hs, -0.01), look.skin);
    b.part("head", at(rot(cone(0.04 * hs, 0.2 * hs, 0, 0, 0, 5), 0, 0, 1.25), -0.15 * hs, 0.13 * hs, -0.01), look.skin);
  } else if (!toy) {
    b.part("head", ell(0.018, 0.03, 0.015, 0.118 * hs, 0.11 * hs, 0), look.skin);
    b.part("head", ell(0.018, 0.03, 0.015, -0.118 * hs, 0.11 * hs, 0), look.skin);
  }
  const capG = (r: number) => {
    const g = new THREE.SphereGeometry(r, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55);
    return g;
  };
  if (look.hat === "bearskin") {
    b.part("head", cyl(0.13, 0.12, 0.34, 0, 0.32, -0.01, 10), 0x1a1816);
    b.part("head", box(0.2, 0.025, 0.02, 0, 0.06, 0.11), 0xd7a441);
  } else if (look.hat === "redcap") {
    b.part("head", at(cone(0.14 * hs, 0.32 * hs, 0, 0, 0, 9), 0, 0.3 * hs, -0.04), 0x6e2420);
  } else if (look.hat === "straw") {
    b.part("head", cyl(0.25, 0.25, 0.02, 0, 0.2, 0, 14), 0xb59a55);
    b.part("head", cyl(0.13, 0.11, 0.1, 0, 0.25, 0, 12), 0xb59a55);
  } else if (look.hairStyle !== "bald") {
    const hairCap = capG(H * 1.1);
    hairCap.scale(1, 1.08, 1.1);
    hairCap.translate(0, 0.12 * hs, -0.012);
    b.part("head", hairCap, look.hair);
    if (look.hairStyle === "tied") {
      b.part("head", ell(0.05, 0.05, 0.05, 0, 0.12 * hs, -0.13), look.hair);
      b.part("head", at(rot(cap(0.035, 0.18, 0, 0, 0, 6), 0.3, 0, 0), 0, 0.0, -0.16), look.hair);
    } else if (look.hairStyle === "long") {
      b.part("head", box(0.22, 0.3, 0.06, 0, -0.02, -0.1), look.hair);
    } else if (look.hairStyle === "hood") {
      b.part("head", ell(0.15, 0.16, 0.16, 0, 0.12, -0.03), look.hair);
      b.part("chest", ell(0.22 * f, 0.08, 0.16, 0, 0.2, -0.02), look.hair);
    }
  }
  if (look.beard) b.part("head", ell(0.08, 0.07, 0.06, 0, 0.03, 0.085), look.hair);
  // limbs
  for (const s of ["L", "R"]) {
    b.part("arm" + s, cap(0.058 * f, 0.2, 0, -0.14, 0), coat);
    b.part("fore" + s, cap(0.047 * f, 0.18, 0, -0.13, 0), toy ? coat : look.shirt);
    b.part("fore" + s, cyl(0.056 * f, 0.056 * f, 0.05, 0, -0.03, 0, 8), coat);
    b.part("hand" + s, ell(0.045, 0.06, 0.035, 0, -0.045, 0.01, 8), toy ? 0xe4d7c3 : look.skin);
    b.part("thigh" + s, cap(0.078 * f, 0.3, 0, -0.22, 0), look.trousers);
    b.part("shin" + s, cap(0.06 * f, 0.18, 0, -0.14, 0), look.trousers);
    b.part("shin" + s, cyl(0.065 * f, 0.07 * f, 0.24, 0, -0.3, 0, 10), look.boots);
    b.part("foot" + s, ell(0.055, 0.045, 0.12, 0, 0.0, 0.05, 8), look.boots);
  }
  const height = (look.height ?? 1.8) / 1.8;
  const rig = b.build(charMat, 1.8 * height);
  rig.group.scale.setScalar(height);
  for (const s of ["L", "R"]) {
    const grip = new THREE.Group();
    grip.position.set(0, -0.06, 0.01);
    grip.rotation.x = Math.PI / 2;
    rig.bones["hand" + s].add(grip);
    rig.sockets["grip" + s] = grip;
  }
  const back = new THREE.Group();
  back.position.set(0, 0.05, -0.16);
  rig.bones.chest.add(back);
  rig.sockets.back = back;
  return rig;
}

// ------------------------------------------------------------ quadrupeds

export type QuadLook = { kind: "wolf" | "deer" | "dog"; fur: number; belly: number; size?: number; antlers?: boolean; collar?: number };

export function buildQuad(look: QuadLook): Rig {
  const b = new RigBuilder();
  const deer = look.kind === "deer";
  const legH = deer ? 0.42 : 0.28;
  const bodyY = deer ? 1.05 : 0.66;
  b.bone("root", null, 0, 0, 0);
  b.bone("body", "root", 0, bodyY, 0);
  b.bone("chest", "body", 0, 0.03, deer ? 0.32 : 0.28);
  b.bone("hips", "body", 0, 0, deer ? -0.3 : -0.28);
  b.bone("neck", "chest", 0, deer ? 0.16 : 0.08, 0.16);
  b.bone("head", "neck", 0, deer ? 0.38 : 0.12, deer ? 0.08 : 0.14);
  b.bone("jaw", "head", 0, -0.04, 0.06);
  b.bone("tail", "hips", 0, 0.06, -0.18);
  b.bone("tail2", "tail", 0, 0, -0.18);
  for (const [s, sx] of [["L", 1], ["R", -1]] as const) {
    b.bone("fu" + s, "chest", sx * 0.11, -0.08, 0.04);
    b.bone("fl" + s, "fu" + s, 0, -legH, 0);
    b.bone("fp" + s, "fl" + s, 0, -legH, 0);
    b.bone("hu" + s, "hips", sx * 0.11, -0.04, -0.02);
    b.bone("hl" + s, "hu" + s, 0, -legH, 0);
    b.bone("hp" + s, "hl" + s, 0, -legH, 0);
  }
  const fur = look.fur;
  const belly = look.belly;
  b.part("body", ell(0.2, 0.2, 0.36, 0, 0, 0), fur);
  b.part("body", ell(0.16, 0.12, 0.3, 0, -0.08, 0), belly);
  b.part("chest", ell(0.21, 0.23, 0.22, 0, 0, 0.02), fur);
  if (!deer) b.part("chest", ell(0.17, 0.2, 0.14, 0, 0.02, 0.1), belly);
  b.part("hips", ell(0.18, 0.19, 0.2, 0, 0.02, 0), fur);
  if (deer) {
    b.part("neck", rot(cap(0.08, 0.36, 0, 0.18, 0.02, 8), 0.35, 0, 0), fur);
    b.part("head", ell(0.085, 0.09, 0.13, 0, 0.0, 0.05), fur);
    b.part("head", ell(0.06, 0.06, 0.1, 0, -0.03, 0.15), belly);
    b.part("head", ell(0.03, 0.06, 0.02, 0.08, 0.08, -0.02), fur);
    b.part("head", ell(0.03, 0.06, 0.02, -0.08, 0.08, -0.02), fur);
    if (look.antlers) {
      for (const sx of [1, -1]) {
        b.part("head", at(rot(cyl(0.012, 0.018, 0.34, 0, 0.17, 0, 5), 0, 0, sx * -0.4), sx * 0.05, 0.06, -0.02), 0xcdbba6);
        b.part("head", at(rot(cyl(0.01, 0.014, 0.18, 0, 0.09, 0, 5), 0.6, 0, sx * -0.9), sx * 0.12, 0.22, -0.02), 0xcdbba6);
      }
    }
  } else {
    b.part("neck", ell(0.14, 0.15, 0.16, 0, 0.02, 0.0), fur);
    b.part("head", ell(0.12, 0.11, 0.13, 0, 0.0, 0.0), fur);
    b.part("head", at(rot(cyl(0.07, 0.035, 0.2, 0, 0, 0, 8), Math.PI / 2, 0, 0), 0, -0.02, 0.17), belly);
    b.part("head", ell(0.03, 0.025, 0.025, 0, 0.0, 0.275), 0x1c1916);
    b.part("jaw", at(rot(cyl(0.05, 0.028, 0.16, 0, 0, 0, 6), Math.PI / 2, 0, 0), 0, -0.02, 0.08), belly);
    const ear = look.kind === "dog" ? ell(0.05, 0.11, 0.03, 0, -0.06, 0) : cone(0.045, 0.12, 0, 0, 0, 5);
    b.part("head", at(ear.clone(), 0.075, 0.12, -0.04), fur);
    b.part("head", at(ear, -0.075, 0.12, -0.04), fur);
    b.part("head", ell(0.022, 0.016, 0.01, 0.055, 0.04, 0.11, 6), look.kind === "wolf" ? 0xc8a040 : 0x2a2018);
    b.part("head", ell(0.022, 0.016, 0.01, -0.055, 0.04, 0.11, 6), look.kind === "wolf" ? 0xc8a040 : 0x2a2018);
    if (look.collar != null) b.part("neck", cyl(0.13, 0.13, 0.05, 0, 0.0, 0.02, 12), look.collar);
  }
  const lr = deer ? 0.035 : 0.05;
  for (const s of ["L", "R"]) {
    b.part("fu" + s, cap(lr * 1.3, legH * 0.7, 0, -legH * 0.5, 0, 6), fur);
    b.part("fl" + s, cap(lr, legH * 0.75, 0, -legH * 0.5, 0, 6), deer ? fur : belly);
    b.part("fp" + s, ell(lr * 1.1, lr * 0.7, lr * 1.6, 0, 0, 0.02, 6), deer ? 0x2a2420 : fur);
    b.part("hu" + s, cap(lr * 1.6, legH * 0.7, 0, -legH * 0.45, 0, 6), fur);
    b.part("hl" + s, cap(lr, legH * 0.75, 0, -legH * 0.5, 0, 6), fur);
    b.part("hp" + s, ell(lr * 1.1, lr * 0.7, lr * 1.6, 0, 0, 0.02, 6), deer ? 0x2a2420 : fur);
  }
  if (deer) b.part("tail", ell(0.05, 0.07, 0.04, 0, 0.0, -0.02), belly);
  else {
    b.part("tail", at(rot(cyl(0.06, 0.05, 0.2, 0, 0, 0, 6), Math.PI / 2 + 0.6, 0, 0), 0, -0.05, -0.08), fur);
    b.part("tail2", at(rot(ell(0.07, 0.07, 0.15, 0, 0, 0, 7), 0.6, 0, 0), 0, -0.1, -0.08), look.kind === "dog" ? fur : belly);
  }
  const size = look.size ?? 1;
  const rig = b.build(charMat, bodyY + 0.3);
  rig.group.scale.setScalar(size);
  return rig;
}

// ------------------------------------------------------------ Cookie

export function buildCookie(): Rig {
  const b = new RigBuilder();
  b.bone("root", null, 0, 0, 0);
  b.bone("body", "root", 0, 0.1, 0);
  b.bone("head", "body", 0, 1.95, 0.05);
  b.bone("beak", "head", 0, -0.02, 0.48);
  b.bone("flipL", "body", 0.78, 1.55, 0);
  b.bone("flipR", "body", -0.78, 1.55, 0);
  b.bone("footL", "root", 0.34, 0.06, 0.2);
  b.bone("footR", "root", -0.34, 0.06, 0.2);
  b.bone("coatL", "body", 0.85, 1.75, 0.1);
  b.bone("coatR", "body", -0.85, 1.75, 0.1);
  b.bone("arm", "body", 0, 1.1, 0.45);
  b.bone("key", "body", 0, 1.3, -0.82);
  const black = 0x22201e;
  const cream = 0xe8dcc6;
  const red = 0x8e2f2f;
  const brass = 0xb5893a;
  b.part("body", ell(0.92, 1.22, 0.84, 0, 1.15, 0, 16), black);
  b.part("body", ell(0.7, 0.98, 0.5, 0, 1.0, 0.4, 14), cream);
  b.part("body", new THREE.CylinderGeometry(0.9, 1.0, 1.15, 18, 1, true, 0.75, Math.PI * 2 - 1.5).translate(0, 1.15, 0), red);
  b.part("body", rot(new THREE.TorusGeometry(0.62, 0.09, 6, 16), Math.PI / 2, 0, 0).translate(0, 1.78, 0), red);
  for (let i = 0; i < 9; i++) {
    const a = Math.PI * 0.2 + (i / 8) * Math.PI * 0.6;
    b.part("body", ell(0.02, 0.5, 0.02, Math.cos(a + Math.PI) * 0.88, 1.1, Math.sin(a + Math.PI) * 0.8), 0x5a1f1c);
  }
  b.part("head", ell(0.56, 0.52, 0.52, 0, 0, 0, 14), black);
  b.part("head", ell(0.4, 0.36, 0.2, 0, -0.05, 0.38, 12), cream);
  for (const sx of [1, -1]) {
    b.part("head", at(rot(cyl(0.11, 0.11, 0.05, 0, 0, 0, 14), Math.PI / 2, 0, 0), sx * 0.2, 0.1, 0.46), 0x111010);
    b.part("head", at(rot(new THREE.TorusGeometry(0.1, 0.018, 5, 14), 0, 0, 0), sx * 0.2, 0.1, 0.49), 0x3a3634);
    for (let k = 0; k < 4; k++) b.part("head", ell(0.016, 0.016, 0.01, sx * 0.2 + (k % 2 ? 0.035 : -0.035), 0.1 + (k < 2 ? 0.035 : -0.035), 0.5, 5), 0x5a5450);
  }
  b.part("head", ell(0.035, 0.035, 0.02, 0.24, 0.15, 0.51, 6), 0xffffff);
  b.part("head", cyl(0.42, 0.4, 0.06, 0, 0.42, 0, 16), black);
  b.part("head", cyl(0.25, 0.27, 0.42, 0, 0.64, 0, 14), black);
  b.part("head", cyl(0.27, 0.27, 0.07, 0, 0.5, 0, 14), red);
  b.part("beak", at(rot(cone(0.14, 0.42, 0, 0, 0, 10), Math.PI / 2, 0, 0), 0, 0, 0.15), brass);
  for (const [s, sx] of [["L", 1], ["R", -1]] as const) {
    b.part("flip" + s, at(rot(ell(0.13, 0.62, 0.32, 0, -0.5, 0, 10), 0, 0, sx * 0.25), sx * 0.08, 0, 0), black);
    b.part("foot" + s, ell(0.22, 0.08, 0.32, 0, 0, 0.12, 10), 0xc28a3a);
    const flap = new THREE.CylinderGeometry(0.92, 1.02, 1.2, 10, 1, true, sx > 0 ? 0 : -0.75, 0.75);
    flap.translate(-sx * 0.85, -0.6, -0.1);
    b.part("coat" + s, flap, red);
    for (let k = 0; k < 3; k++) b.part("coat" + s, ell(0.05, 0.05, 0.03, -sx * 0.62, -0.3 - k * 0.3, 0.86 - k * 0.02, 6), brass);
  }
  for (let i = 0; i < 3; i++) {
    const gear = new THREE.CylinderGeometry(0.3 - i * 0.07, 0.3 - i * 0.07, 0.06, 12);
    rot(gear, Math.PI / 2, 0, 0);
    gear.translate((i - 1) * 0.28, (i % 2) * 0.3 - 0.1, 0.02 * i);
    b.part("arm", gear, brass);
    for (let t = 0; t < 8; t++) {
      const a = (t / 8) * Math.PI * 2;
      const r = 0.31 - i * 0.07;
      b.part("arm", box(0.06, 0.06, 0.06, (i - 1) * 0.28 + Math.cos(a) * r, (i % 2) * 0.3 - 0.1 + Math.sin(a) * r, 0.02 * i), brass);
    }
  }
  b.part("arm", cyl(0.03, 0.03, 1.1, 0, 0, 0.08, 6), 0x8a6a30);
  b.part("key", at(rot(cyl(0.05, 0.05, 0.3, 0, 0, 0, 6), Math.PI / 2, 0, 0), 0, 0, -0.1), brass);
  b.part("key", at(rot(new THREE.TorusGeometry(0.16, 0.04, 6, 12), 0, 0, 0), 0.18, 0, -0.25), brass);
  b.part("key", at(rot(new THREE.TorusGeometry(0.16, 0.04, 6, 12), 0, 0, 0), -0.18, 0, -0.25), brass);
  const rig = b.build(charMat, 3.3);
  const bell = new THREE.Group();
  const bellMesh = new THREE.Mesh(
    new THREE.LatheGeometry([new THREE.Vector2(0.02, 0), new THREE.Vector2(0.1, 0.03), new THREE.Vector2(0.13, 0.2), new THREE.Vector2(0.2, 0.32), new THREE.Vector2(0.0, 0.32)], 12),
    new THREE.MeshLambertMaterial({ color: brass }),
  );
  bellMesh.rotation.x = Math.PI;
  bellMesh.position.y = -0.95;
  bell.add(bellMesh);
  rig.bones.flipR.add(bell);
  rig.sockets.bell = bell;
  rig.bones.arm.scale.setScalar(0.01);
  return rig;
}

// ------------------------------------------------------------ rocking horse

export function buildRockingHorse(): Rig {
  const b = new RigBuilder();
  b.bone("root", null, 0, 0, 0);
  b.bone("body", "root", 0, 0.05, 0);
  b.bone("neck", "body", 0, 1.35, 0.55);
  b.bone("head", "neck", 0, 0.45, 0.15);
  const cream = 0xdcccae;
  const red = 0x8e2f2f;
  const wood = 0x5b4632;
  b.part("body", ell(0.32, 0.3, 0.7, 0, 1.15, 0, 12), cream);
  b.part("body", box(0.5, 0.08, 0.6, 0, 1.45, -0.05), red);
  for (const sx of [1, -1])
    for (const sz of [1, -1]) {
      b.part("body", at(rot(cyl(0.06, 0.07, 0.95, 0, 0, 0, 6), sz * 0.25, 0, sx * -0.12), sx * 0.2, 0.62, sz * 0.48), cream);
      b.part("body", ell(0.08, 0.06, 0.1, sx * 0.28, 0.16, sz * 0.66, 6), 0x2a2420);
    }
  for (const sx of [1, -1]) {
    const rocker = new THREE.TorusGeometry(2.0, 0.06, 5, 20, 0.75);
    rocker.rotateZ(-Math.PI / 2 - 0.375);
    rocker.rotateY(Math.PI / 2);
    rocker.translate(sx * 0.3, 2.1, 0);
    b.part("body", rocker, wood);
  }
  b.part("neck", rot(cap(0.15, 0.4, 0, 0.18, 0, 8), 0.45, 0, 0), cream);
  b.part("neck", box(0.06, 0.55, 0.22, 0, 0.25, -0.12), 0x3c342c);
  b.part("head", ell(0.14, 0.15, 0.32, 0, 0, 0.15, 10), cream);
  b.part("head", ell(0.03, 0.03, 0.02, 0.12, 0.05, 0.2, 6), 0x1c1916);
  b.part("head", ell(0.03, 0.03, 0.02, -0.12, 0.05, 0.2, 6), 0x1c1916);
  b.part("head", cone(0.05, 0.14, 0.07, 0.18, 0.02, 5), cream);
  b.part("head", cone(0.05, 0.14, -0.07, 0.18, 0.02, 5), cream);
  b.part("head", box(0.3, 0.04, 0.04, 0, -0.02, 0.32), red);
  return b.build(charMat, 2.2);
}

// ------------------------------------------------------------ posing

const qa = new THREE.Quaternion();
const ea = new THREE.Euler();

export class Poser {
  private k = 1;
  constructor(public rig: Rig) {}
  begin(dt: number, speed = 14) {
    this.k = 1 - Math.exp(-dt * speed);
    return this;
  }
  set(name: string, x: number, y = 0, z = 0) {
    const b = this.rig.bones[name];
    if (!b) return this;
    qa.setFromEuler(ea.set(x, y, z, "XYZ"));
    b.quaternion.slerp(qa, this.k);
    return this;
  }
  snap(name: string, x: number, y = 0, z = 0) {
    const b = this.rig.bones[name];
    if (b) b.quaternion.setFromEuler(ea.set(x, y, z, "XYZ"));
    return this;
  }
  offset(name: string, x: number, y: number, z: number) {
    const b = this.rig.bones[name];
    const r = this.rig.rest[name];
    if (!b || !r) return this;
    b.position.x += (r.x + x - b.position.x) * this.k;
    b.position.y += (r.y + y - b.position.y) * this.k;
    b.position.z += (r.z + z - b.position.z) * this.k;
    return this;
  }
}

export type HumanAction =
  | "none" | "light1" | "light2" | "light3" | "heavy" | "charge" | "cast" | "gather" | "hammer" | "talk" | "hurt"
  | "dodge" | "dead" | "windup" | "thrust" | "cheer" | "sweep" | "march";

export type HumanPose = { t: number; move: number; phase: number; action: HumanAction; at: number; block: boolean; armed: boolean };

const sinE = (x: number) => Math.sin(x * Math.PI);
const ease = (x: number) => x * x * (3 - 2 * x);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Two-key swing: wind to `a` over the first `split` of the action, then strike to `b`, then recover. */
function swingKeys(at: number, split: number) {
  if (at < split) return { w: ease(at / split), s: 0 };
  const s = (at - split) / (1 - split);
  return { w: 1, s: ease(Math.min(1, s * 1.6)), r: Math.max(0, (s - 0.6) / 0.4) };
}

export function poseHuman(p: Poser, pose: HumanPose, dt: number) {
  const { t, move, phase, action, at } = pose;
  p.begin(dt, action === "dodge" || action.startsWith("light") || action === "heavy" ? 26 : 13);
  const run = Math.min(1, Math.max(0, move - 1) / 0.6);
  const amp = Math.min(1, move) * (0.55 + run * 0.35);
  const sw = Math.sin(phase);
  const sw2 = Math.sin(phase + Math.PI);
  const breathe = Math.sin(t * 1.8) * 0.02;
  const bob = move > 0.05 ? Math.abs(Math.sin(phase)) * 0.045 * (1 + run) : 0;
  let hipsY = bob - (move > 0.05 ? 0.02 : 0);
  let lean = run * 0.18 + amp * 0.04;
  let chestY = sw * 0.12 * amp;
  let armLx = -sw * 0.75 * amp;
  let armRx = sw * 0.75 * amp;
  let armLz = 0.08;
  let armRz = -0.08;
  let armRy = 0;
  let foreL = -0.2 - run * 0.9;
  let foreR = -0.2 - run * 0.9;
  let thighL = sw * 0.6 * amp;
  let thighR = sw2 * 0.6 * amp;
  let shinL = Math.max(0, -Math.cos(phase)) * 1.0 * amp + 0.04;
  let shinR = Math.max(0, Math.cos(phase)) * 1.0 * amp + 0.04;
  let headX = -lean * 0.5 + breathe;
  let headY = 0;
  let rootX = 0;
  let rootZ = 0;
  let rootY = 0;
  let hipsX = 0;
  let chestX = breathe;
  if (pose.armed && move < 0.3 && action === "none") {
    armRx = -0.35;
    foreR = -0.55;
  }
  if (pose.block) {
    armLx = -1.25;
    armLz = 0.45;
    foreL = -1.35;
    chestY += 0.15;
  }
  switch (action) {
    case "light1":
    case "light2": {
      const k = swingKeys(at, 0.3);
      const dir = action === "light1" ? 1 : -1;
      const wx = -1.5;
      const wz = -0.9 * dir;
      const sx = -1.25;
      const sz = 0.55 * dir;
      armRx = lerp(lerp(armRx, wx, k.w), sx, k.s);
      armRz = lerp(lerp(armRz, dir > 0 ? wz : -0.2, k.w), dir > 0 ? sz : -1.1, k.s);
      armRy = lerp(0, dir * 0.6, k.s);
      foreR = lerp(-0.9, -0.15, k.s);
      chestY = lerp(lerp(chestY, -0.55 * dir, k.w), 0.5 * dir, k.s);
      lean += 0.08 * k.s;
      thighL = lerp(thighL, -0.35, k.s);
      shinL = lerp(shinL, 0.3, k.s);
      thighR = lerp(thighR, 0.25, k.s);
      break;
    }
    case "light3":
    case "thrust": {
      const k = swingKeys(at, 0.35);
      armRx = lerp(lerp(armRx, -2.7, k.w), -1.05, k.s);
      armRz = -0.15;
      foreR = lerp(-1.0, -0.05, k.s);
      chestX = lerp(-0.2 * k.w, 0.3, k.s);
      lean += 0.15 * k.s;
      thighL = lerp(0, -0.55, k.s);
      shinL = 0.35 * k.s;
      thighR = 0.3 * k.s;
      break;
    }
    case "charge":
    case "windup": {
      const k = ease(Math.min(1, at * 2));
      armRx = lerp(armRx, -2.9, k);
      armRz = -0.25;
      foreR = -0.9;
      armLx = lerp(armLx, -2.4, k);
      foreL = -1;
      chestX = -0.25 * k;
      chestY = -0.3 * k;
      thighL = -0.3 * k;
      shinR = 0.4 * k;
      thighR = 0.2 * k;
      hipsY -= 0.06 * k;
      break;
    }
    case "heavy": {
      const k = swingKeys(at, 0.2);
      armRx = lerp(-2.9, -0.55, k.s);
      armLx = lerp(-2.4, -0.7, k.s);
      armRz = -0.2;
      foreR = lerp(-0.9, -0.05, k.s);
      foreL = lerp(-1, -0.4, k.s);
      chestX = lerp(-0.3, 0.55, k.s);
      lean += 0.2 * k.s;
      hipsY -= 0.12 * k.s;
      thighL = -0.6 * k.s;
      shinL = 0.5 * k.s;
      thighR = 0.35 * k.s;
      shinR = 0.5 * k.s;
      break;
    }
    case "cast": {
      const k = sinE(Math.min(1, at * 1.3));
      armLx = -1.5 * k;
      armLz = 0.1;
      foreL = -0.1;
      chestY = 0.4 * k;
      armRx = 0.3 * k;
      break;
    }
    case "gather": {
      const c = (at * 2) % 1;
      const k = c < 0.45 ? ease(c / 0.45) : 1 - ease((c - 0.45) / 0.55);
      if (pose.armed) {
        armRx = lerp(-0.6, -2.7, k);
        armLx = lerp(-0.6, -2.2, k);
        foreR = -0.6;
        foreL = -0.7;
        chestX = lerp(0.45, -0.1, k);
      } else {
        armRx = -0.9 - k * 0.4;
        armLx = -0.8 - k * 0.3;
        foreR = -0.3;
        foreL = -0.3;
        chestX = 0.55;
        thighL = -0.9;
        thighR = -0.2;
        shinL = 1.1;
        shinR = 0.9;
        hipsY -= 0.25;
      }
      break;
    }
    case "hammer": {
      const c = (t * 1.6) % 1;
      const k = c < 0.6 ? ease(c / 0.6) : 1 - ease((c - 0.6) / 0.4);
      armRx = lerp(-0.8, -2.3, k);
      foreR = -0.8;
      armLx = -0.7;
      foreL = -0.9;
      chestX = 0.2;
      headX = 0.3;
      break;
    }
    case "sweep": {
      const c = Math.sin(t * 2.4);
      armRx = -0.5 + c * 0.25;
      armLx = -0.7 + c * 0.25;
      foreL = -0.5;
      foreR = -0.4;
      chestY = c * 0.3;
      chestX = 0.25;
      break;
    }
    case "talk": {
      armRx = -0.5 + Math.sin(t * 3) * 0.2;
      foreR = -1.0 + Math.sin(t * 2.2) * 0.3;
      armRz = -0.25;
      headY = Math.sin(t * 0.9) * 0.15;
      break;
    }
    case "cheer": {
      armRx = -2.9 + Math.sin(t * 8) * 0.2;
      armLx = -2.9 - Math.sin(t * 8) * 0.2;
      armRz = -0.3;
      armLz = 0.3;
      hipsY += Math.abs(Math.sin(t * 8)) * 0.08;
      break;
    }
    case "march": {
      armRx = -0.9;
      foreR = -1.2;
      armLx = sw * 0.3;
      thighL = sw * 0.75 * Math.min(1, move);
      thighR = sw2 * 0.75 * Math.min(1, move);
      shinL = 0.02;
      shinR = 0.02;
      lean = 0;
      chestY = 0;
      break;
    }
    case "hurt": {
      const k = sinE(Math.min(1, at));
      chestX = -0.4 * k;
      headX = -0.35 * k;
      armLx = -0.6 * k;
      armRx = -0.5 * k;
      armLz = 0.5 * k;
      armRz = -0.5 * k;
      lean = -0.2 * k;
      break;
    }
    case "dodge": {
      const k = Math.min(1, at);
      hipsX = k * Math.PI * 2;
      hipsY -= 0.48 * sinE(k);
      thighL = thighR = -1.5 * sinE(k);
      shinL = shinR = 1.9 * sinE(k);
      armLx = armRx = -1.2 * sinE(k);
      foreL = foreR = -1.6 * sinE(k);
      chestX = 0.5 * sinE(k);
      headX = 0.4 * sinE(k);
      lean = 0;
      break;
    }
    case "dead": {
      const k = ease(Math.min(1, at * 1.4));
      rootX = -Math.PI / 2 * k;
      rootY = 0.18 * k;
      armLz = 1.2 * k;
      armRz = -1.2 * k;
      armLx = armRx = -0.2;
      thighL = -0.15 * k;
      thighR = 0.1 * k;
      shinL = 0.4 * k;
      headY = 0.5 * k;
      lean = 0;
      chestY = 0;
      break;
    }
  }
  p.set("root", rootX, 0, rootZ).offset("root", 0, rootY, 0);
  p.set("hips", hipsX + lean * 0.4, chestY * -0.35, 0).offset("hips", 0, hipsY, 0);
  p.set("spine", lean * 0.4, chestY * 0.4, 0);
  p.set("chest", chestX + lean * 0.3, chestY * 0.6, 0);
  p.set("neck", headX * 0.4, headY * 0.5, 0);
  p.set("head", headX * 0.6, headY - chestY * 0.5, 0);
  p.set("armL", armLx, 0, armLz).set("foreL", foreL, 0, 0);
  p.set("armR", armRx, armRy, armRz).set("foreR", foreR, 0, 0);
  p.set("thighL", -thighL, 0, 0.02).set("shinL", shinL, 0, 0).set("footL", -0.1 + (move > 0.05 ? Math.max(0, Math.sin(phase)) * 0.4 : 0), 0, 0);
  p.set("thighR", -thighR, 0, -0.02).set("shinR", shinR, 0, 0).set("footR", -0.1 + (move > 0.05 ? Math.max(0, Math.sin(phase + Math.PI)) * 0.4 : 0), 0, 0);
}

export type QuadAction = "none" | "crouch" | "pounce" | "bite" | "hurt" | "dead" | "graze" | "howl" | "lick";
export type QuadPose = { t: number; move: number; phase: number; action: QuadAction; at: number };

export function poseQuad(p: Poser, pose: QuadPose, dt: number) {
  const { t, move, phase, action, at } = pose;
  p.begin(dt, action === "pounce" || action === "bite" ? 24 : 12);
  const amp = Math.min(1, move);
  const gallop = Math.min(1, Math.max(0, move - 1));
  const a = Math.sin(phase);
  const bph = gallop > 0.5 ? phase + 0.6 : phase + Math.PI;
  const bodyBob = Math.abs(Math.sin(phase)) * 0.05 * amp * (1 + gallop);
  let bodyX = -gallop * Math.sin(phase * 1) * 0.12;
  let bodyY = bodyBob;
  let headX = 0.05 + Math.sin(t * 1.4) * 0.03;
  let neckX = 0;
  let jaw = 0.05;
  let tail = Math.sin(t * 3) * 0.2;
  let tailX = -0.3;
  let fl = 1;
  let rootZ = 0;
  let crouch = 0;
  switch (action) {
    case "crouch":
      crouch = ease(Math.min(1, at * 1.5));
      headX = 0.35 * crouch;
      tailX = -0.6;
      jaw = 0.25 * crouch;
      break;
    case "pounce": {
      const k = sinE(Math.min(1, at));
      bodyX = -0.4 * k;
      bodyY = 0.35 * k;
      fl = 1 - k;
      jaw = 0.5;
      headX = -0.2;
      break;
    }
    case "bite": {
      const k = sinE(Math.min(1, at));
      neckX = 0.5 * k;
      headX = 0.3 * k;
      jaw = 0.6 * k;
      break;
    }
    case "hurt": {
      const k = sinE(Math.min(1, at));
      bodyX = 0.2 * k;
      headX = -0.4 * k;
      tailX = -1.0;
      break;
    }
    case "dead": {
      const k = ease(Math.min(1, at * 1.5));
      rootZ = (Math.PI / 2) * k;
      bodyY = -0.28 * k;
      headX = 0.4 * k;
      fl = 1 - k * 0.5;
      tail = 0;
      break;
    }
    case "graze":
      neckX = 0.9;
      headX = 0.5;
      break;
    case "howl":
      neckX = -0.6;
      headX = -0.5;
      jaw = 0.4;
      break;
    case "lick":
      neckX = 0.3 + Math.sin(t * 10) * 0.1;
      jaw = 0.3;
      tail = Math.sin(t * 14) * 0.6;
      break;
  }
  p.set("root", 0, 0, rootZ);
  p.set("body", bodyX, 0, 0).offset("body", 0, bodyY - crouch * 0.18, 0);
  p.set("neck", neckX - crouch * 0.2, 0, 0);
  p.set("head", headX, 0, 0);
  p.set("jaw", jaw, 0, 0);
  p.set("tail", tailX, tail, 0).set("tail2", -0.2, tail * 0.6, 0);
  const legs = (s: string, ph: number, front: boolean) => {
    const sw = Math.sin(ph) * 0.65 * amp * (1 + gallop * 0.3) * fl;
    const lift = Math.max(0, Math.cos(ph)) * 0.9 * amp * fl;
    if (front) {
      p.set("fu" + s, -sw - crouch * 0.5 + (action === "pounce" ? -1.0 * (1 - fl) : 0), 0, 0);
      p.set("fl" + s, lift * 0.6 + crouch * 0.7, 0, 0);
    } else {
      p.set("hu" + s, -sw + crouch * 0.9 + (action === "pounce" ? 0.9 * (1 - fl) : 0), 0, 0);
      p.set("hl" + s, -lift * 0.7 - crouch * 1.2, 0, 0);
    }
  };
  legs("L", phase, true);
  legs("R", phase + Math.PI, true);
  legs("L", bph + Math.PI, false);
  legs("R", bph, false);
  void a;
}

export type CookieAction =
  | "idle" | "waddle" | "bow" | "spin" | "pecktell" | "peck" | "call" | "slide" | "beam" | "slamtell" | "slam" | "hurt" | "dead" | "intro";
export type CookiePose = { t: number; move: number; phase: number; action: CookieAction; at: number; coat: number; armature: number; spin: number };

export function poseCookie(p: Poser, pose: CookiePose, dt: number) {
  const { t, move, phase, action, at } = pose;
  p.begin(dt, action === "peck" || action === "slam" ? 22 : 10);
  let bodyX = 0;
  let bodyZ = Math.sin(phase) * 0.16 * Math.min(1, move) + Math.sin(t * 2) * 0.03;
  let bodyY = Math.abs(Math.sin(phase)) * 0.08 * Math.min(1, move);
  let headX = Math.sin(t * 1.7) * 0.05;
  let headY = 0;
  let flipL = 0.2 + Math.sin(t * 4) * 0.08;
  let flipR = -0.2 - Math.sin(t * 4) * 0.08;
  let flipLx = 0;
  let flipRx = 0;
  let footL = Math.max(0, Math.sin(phase)) * 0.12 * Math.min(1, move);
  let footR = Math.max(0, -Math.sin(phase)) * 0.12 * Math.min(1, move);
  switch (action) {
    case "intro":
    case "bow": {
      const k = action === "intro" ? sinE(Math.min(1, at)) : ease(Math.min(1, at * 1.3));
      bodyX = 0.7 * k;
      headX = 0.35 * k;
      flipLx = 0.6 * k;
      flipRx = 0.6 * k;
      flipL = 0.5 * k;
      flipR = -0.5 * k;
      break;
    }
    case "spin":
      flipL = 1.45;
      flipR = -1.45;
      bodyX = -0.05;
      bodyZ = Math.sin(t * 20) * 0.05;
      break;
    case "pecktell":
      headX = -0.5 * ease(Math.min(1, at * 1.5));
      bodyX = -0.18;
      flipL = 0.6;
      flipR = -0.6;
      break;
    case "peck": {
      const k = sinE(Math.min(1, at));
      headX = 0.9 * k;
      bodyX = 0.45 * k;
      break;
    }
    case "call": {
      flipR = -2.6 + Math.sin(t * 22) * 0.25;
      headX = -0.35;
      bodyY += Math.abs(Math.sin(t * 9)) * 0.1;
      break;
    }
    case "slide":
      bodyX = 1.25;
      headX = -0.6;
      flipL = 1.2;
      flipR = -1.2;
      flipLx = 1.2;
      flipRx = 1.2;
      bodyY = -0.35;
      break;
    case "beam":
      headX = 0.1;
      bodyX = -0.1;
      flipL = 0.9;
      flipR = -0.9;
      break;
    case "slamtell": {
      const k = ease(Math.min(1, at));
      bodyY = -0.35 * k;
      bodyX = 0.25 * k;
      flipL = 1.4 * k;
      flipR = -1.4 * k;
      flipLx = -1.6 * k;
      flipRx = -1.6 * k;
      break;
    }
    case "slam": {
      const k = Math.min(1, at);
      bodyY = Math.sin(k * Math.PI) * 2.6;
      bodyX = 0.4 * k;
      flipL = 2.2 - k;
      flipR = -2.2 + k;
      break;
    }
    case "hurt": {
      const k = sinE(Math.min(1, at));
      bodyX = -0.25 * k;
      headX = -0.3 * k;
      break;
    }
    case "dead": {
      const k = ease(Math.min(1, at));
      bodyX = -1.35 * k;
      bodyY = -0.25 * k;
      headX = -0.4 * k;
      flipL = 1.4 * k;
      flipR = -1.4 * k;
      footL = 0.4 * k;
      footR = 0.3 * k;
      break;
    }
  }
  p.set("root", 0, pose.spin, 0);
  p.set("body", bodyX, 0, bodyZ).offset("body", 0, bodyY, 0);
  p.set("head", headX, headY, 0);
  p.set("flipL", flipLx, 0, flipL).set("flipR", flipRx, 0, flipR);
  p.set("footL", -footL * 2, 0, 0).offset("footL", 0, footL, 0);
  p.set("footR", -footR * 2, 0, 0).offset("footR", 0, footR, 0);
  p.set("coatL", 0, pose.coat * 1.1, 0).set("coatR", 0, -pose.coat * 1.1, 0);
  const arm = p.rig.bones.arm;
  const as = Math.max(0.01, pose.armature);
  arm.scale.setScalar(arm.scale.x + (as - arm.scale.x) * Math.min(1, dt * 6));
  arm.rotation.z += dt * 2 * pose.armature;
  p.rig.bones.key.rotation.z += dt * (action === "spin" ? 14 : 2);
}

export function poseHorse(p: Poser, pose: { t: number; rock: number; charge: boolean; dead: number }, dt: number) {
  p.begin(dt, 10);
  const r = Math.sin(pose.t * (pose.charge ? 3 : 5)) * pose.rock;
  p.set("root", -pose.dead * 0.2, 0, pose.dead * 1.4);
  p.set("body", r * 0.35 + (pose.charge ? 0.15 : 0), 0, 0);
  p.set("neck", -r * 0.2 + (pose.charge ? 0.35 : 0), 0, 0);
  p.set("head", r * 0.1, Math.sin(pose.t * 1.3) * 0.1, 0);
}
