import * as THREE from "three";
import { BOSSES } from "../../data/bosses.ts";
import type { Boss, BossEnv } from "../bossapi";
import { Finlay } from "./finlay";

/**
 * The Grave King (design bible 6.4). He fights as a dead captain of an older war: the same
 * three-phase duel as Finlay, his plate gone grave-green, his court's rite in phase three.
 */
export function createGraveKing(env: BossEnv, parent: THREE.Object3D): Boss {
  const b = new Finlay(env, parent, BOSSES.grave_king, { weapon: "wpn_grave_blade", phases: ["", "The king", "Crown cracked", "The court rises"], greeting: "Kneel. Everyone does, in the end." });
  b.plateMat.color.setHex(0xb8c4b0);
  b.plateMat.emissive = new THREE.Color(0x0e2a18);
  b.mat.color.setHex(0xa8b8a8);
  const crown = new THREE.Mesh(
    new THREE.CylinderGeometry(0.13, 0.12, 0.08, 7, 1, true),
    new THREE.MeshLambertMaterial({ color: 0x9a8a5a, emissive: 0x2a3a1a, side: THREE.DoubleSide }),
  );
  crown.position.set(0, 0.25, 0);
  b.helm.add(crown);
  b.wear("/models/skeleton_warrior.glb", "/models/skeleton_warrior.glb", 2.35, 0xb8c8a8, (a) => a.crown(0xe0b84a, 0x6a4a10));
  return b;
}
