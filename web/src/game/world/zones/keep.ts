import * as THREE from "three";
import { ZONES } from "../../data/zones.ts";
import { zoneNodes } from "../nodes";
import type { ZoneBuild, ZoneEnv } from "../zone";

/** Keep (placeholder until its builder lands): flat ground and its nodes. */
export function buildKeep(env: ZoneEnv): ZoneBuild {
  const Z = ZONES.keep;
  const root = new THREE.Group();
  root.name = "keep";
  const w = Z.bounds.maxX - Z.bounds.minX;
  const d = Z.bounds.maxZ - Z.bounds.minZ;
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshLambertMaterial({ color: Z.indoor ? 0x3a3430 : 0x4a5a34 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(Z.ox + (Z.bounds.minX + Z.bounds.maxX) / 2, 0, (Z.bounds.minZ + Z.bounds.maxZ) / 2);
  ground.receiveShadow = true;
  root.add(ground);
  const groundAt = () => 0;
  const nodes = zoneNodes(env.M, root, env.col, "keep", groundAt);
  return { root, groundAt, fires: [], lamps: [], glows: [], nodes, anchors: {} };
}
