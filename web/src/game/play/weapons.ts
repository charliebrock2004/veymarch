import * as THREE from "three";

/** Held-item models. Built along +y from the grip; the hand socket turns +y forward. */

const phong = (color: number, shininess = 40) => new THREE.MeshPhongMaterial({ color, shininess, specular: 0x444444 });
const lam = (color: number) => new THREE.MeshLambertMaterial({ color });

function mesh(g: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const o = new THREE.Mesh(g, m);
  o.position.set(x, y, z);
  o.rotation.set(rx, ry, rz);
  o.castShadow = true;
  return o;
}

function blade(len: number, w: number, color: number, shininess = 70) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, 0);
  s.lineTo(w / 2, 0);
  s.lineTo(w / 2.4, len * 0.85);
  s.lineTo(0, len);
  s.lineTo(-w / 2.4, len * 0.85);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.02, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.01, bevelSegments: 1 });
  g.translate(0, 0, -0.01);
  return mesh(g, phong(color, shininess));
}

export function weaponModel(id: string): THREE.Group {
  const g = new THREE.Group();
  const grip = lam(0x3c2a1c);
  switch (id) {
    case "wpn_stone_knife": {
      g.add(mesh(new THREE.CylinderGeometry(0.022, 0.026, 0.16, 6), lam(0x7a5e40), 0, 0.02, 0));
      g.add(mesh(new THREE.TorusGeometry(0.03, 0.01, 4, 8), lam(0xb59a55), 0, 0.08, 0, Math.PI / 2));
      const b = blade(0.22, 0.06, 0x2e2d2b, 20);
      b.position.y = 0.1;
      g.add(b);
      break;
    }
    case "wpn_copper_sword":
    case "wpn_iron_sword": {
      const steel = id === "wpn_iron_sword" ? 0x9aa0a6 : 0xc07a42;
      g.add(mesh(new THREE.CylinderGeometry(0.022, 0.024, 0.2, 6), grip, 0, 0.02, 0));
      g.add(mesh(new THREE.SphereGeometry(0.04, 6, 5), phong(0x8a6a40), 0, -0.1, 0));
      g.add(mesh(new THREE.BoxGeometry(0.24, 0.03, 0.05), phong(id === "wpn_iron_sword" ? 0x55595e : 0x8a5a30), 0, 0.13, 0));
      const b = blade(id === "wpn_iron_sword" ? 0.85 : 0.75, 0.07, steel, 90);
      b.position.y = 0.14;
      g.add(b);
      break;
    }
    case "wpn_cookie_blade": {
      g.add(mesh(new THREE.CylinderGeometry(0.024, 0.026, 0.22, 8), lam(0x8e2f2f), 0, 0.02, 0));
      g.add(mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.03, 12), lam(0x1c1916), 0, -0.11, 0, 0, 0, 0));
      g.add(mesh(new THREE.TorusGeometry(0.09, 0.02, 6, 12), phong(0xb5893a, 80), 0, 0.15, 0, 0, Math.PI / 2, 0));
      const b = blade(0.82, 0.1, 0x8e2f2f, 10);
      b.position.y = 0.16;
      g.add(b);
      const edge = blade(0.84, 0.05, 0xd4a64a, 100);
      edge.position.set(0, 0.15, 0.012);
      g.add(edge);
      break;
    }
    case "wpn_stone_pick":
    case "wpn_copper_pick":
    case "wpn_cookie_pick": {
      const haft = id === "wpn_cookie_pick" ? lam(0x8e2f2f) : lam(0x7a5e40);
      const head = id === "wpn_cookie_pick" ? phong(0xb5893a, 90) : id === "wpn_copper_pick" ? phong(0xc07a42, 60) : lam(0x6a6660);
      g.add(mesh(new THREE.CylinderGeometry(0.025, 0.028, 0.75, 6), haft, 0, 0.28, 0));
      const pick = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.42, 5), head);
      pick.rotation.z = Math.PI / 2;
      pick.position.set(0.18, 0.62, 0);
      pick.castShadow = true;
      g.add(pick);
      g.add(mesh(new THREE.BoxGeometry(0.12, 0.08, 0.08), head, -0.04, 0.62, 0));
      break;
    }
    case "wpn_smacko": {
      g.add(mesh(new THREE.CylinderGeometry(0.022, 0.024, 0.18, 6), grip, 0, 0.02, 0));
      g.add(mesh(new THREE.SphereGeometry(0.05, 8, 6), phong(0xb5893a, 90), 0, 0.13, 0));
      const b = blade(0.7, 0.06, 0xb0b4b8, 90);
      b.position.y = 0.15;
      g.add(b);
      break;
    }
    case "shield": {
      const s = mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.07, 14), lam(0x7a5e40), 0, 0, 0, Math.PI / 2, 0, 0);
      g.add(s);
      g.add(mesh(new THREE.TorusGeometry(0.31, 0.03, 5, 16), lam(0x4a3a2a), 0, 0, 0, 0, 0, 0));
      g.add(mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.05, 8), phong(0x55595e), 0, 0, 0.05, Math.PI / 2, 0, 0));
      break;
    }
    case "club": {
      g.add(mesh(new THREE.CylinderGeometry(0.05, 0.025, 0.7, 6), lam(0xd8ccb4), 0, 0.3, 0));
      g.add(mesh(new THREE.SphereGeometry(0.08, 6, 5), lam(0xd8ccb4), 0, 0.66, 0));
      break;
    }
    case "bigclub": {
      g.add(mesh(new THREE.CylinderGeometry(0.11, 0.04, 1.2, 7), lam(0x5b4632), 0, 0.5, 0));
      for (let i = 0; i < 4; i++) g.add(mesh(new THREE.ConeGeometry(0.03, 0.12, 4), lam(0x55595e), Math.cos(i * 1.6) * 0.1, 0.9, Math.sin(i * 1.6) * 0.1, 0, 0, Math.cos(i * 1.6) * -1.5));
      break;
    }
    case "spear": {
      g.add(mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.6, 5), lam(0x6a5440), 0, 0.4, 0));
      g.add(mesh(new THREE.ConeGeometry(0.04, 0.22, 4), lam(0x2e2d2b), 0, 1.3, 0));
      break;
    }
    case "musket": {
      g.add(mesh(new THREE.BoxGeometry(0.06, 0.9, 0.08), lam(0x5b4632), 0, 0.2, 0));
      g.add(mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.5, 6), phong(0x55595e), 0, 0.85, 0.02));
      g.add(mesh(new THREE.ConeGeometry(0.02, 0.3, 4), phong(0xd0d4d8, 90), 0, 1.25, 0.02));
      break;
    }
    case "lantern": {
      g.add(mesh(new THREE.BoxGeometry(0.14, 0.18, 0.14), new THREE.MeshBasicMaterial({ color: 0xffc070 }), 0, -0.15, 0));
      break;
    }
    case "hammer": {
      g.add(mesh(new THREE.CylinderGeometry(0.02, 0.022, 0.4, 6), lam(0x7a5e40), 0, 0.15, 0));
      g.add(mesh(new THREE.BoxGeometry(0.16, 0.08, 0.08), phong(0x55595e), 0, 0.34, 0));
      break;
    }
  }
  return g;
}
