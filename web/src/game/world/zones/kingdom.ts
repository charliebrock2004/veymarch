import * as THREE from "three";
import { fbm, smoothstep } from "../../engine/noise";
import { buildFieldTerrain } from "../../engine/terrain";
import { ZONES } from "../../data/zones.ts";
import { zoneNodes } from "../nodes";
import type { ZoneBuild, ZoneEnv } from "../zone";

/**
 * The Medieval Kingdom: the Kingsroad, the farms and Harrenvale on its hill.
 * (Placeholder ground while the full builder is written: terrain, road and nodes only.)
 */
export function buildKingdom(env: ZoneEnv): ZoneBuild {
  const Z = ZONES.kingdom;
  const root = new THREE.Group();
  root.name = "kingdom";
  const grass = new THREE.Color(0x7c8a4e);
  const road = new THREE.Color(0x9a8262);
  const terrain = buildFieldTerrain({
    ox: Z.ox,
    bounds: Z.bounds,
    sample: (x, z) => {
      const h = (fbm(x * 0.01, z * 0.01, 3) - 0.5) * 6 + 6 * (1 - smoothstep(20, 60, Math.hypot(x, z)));
      const onRoad = 1 - smoothstep(2, 4, Math.abs(z));
      return { h, color: grass.clone().lerp(road, onRoad), path: onRoad };
    },
  });
  root.add(terrain.mesh);
  const groundAt = terrain.heightAt;
  const nodes = zoneNodes(env.M, root, env.col, "kingdom", groundAt);
  return { root, groundAt, fires: [], lamps: [], glows: [], nodes, anchors: {} };
}
