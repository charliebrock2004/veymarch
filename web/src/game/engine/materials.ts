import * as THREE from "three";
import { windy } from "./kit";
import {
  barkTex, fernTex, flagstoneTex, leafTex, nurseryPaintTex, planksTex, plasterTex, shingleTex, stoneTex, thatchTex, wallpaperTex, wheatTex,
} from "./textures";

/** Shared materials. Vertex colour multiplies the map, so one material serves many tints. */
export function makeMaterials() {
  const L = (o: THREE.MeshLambertMaterialParameters) => new THREE.MeshLambertMaterial({ vertexColors: true, ...o });
  const leaves = (kind: "oak" | "beech" | "pine" | "bush", sway: number, from: number) =>
    windy(L({ map: leafTex(kind), alphaTest: 0.45, side: THREE.DoubleSide }), sway, from, 10);
  return {
    plaster: L({ map: plasterTex() }),
    stone: L({ map: stoneTex("bone") }),
    stoneGrey: L({ map: stoneTex("grey") }),
    stoneDark: L({ map: stoneTex("dark") }),
    thatch: L({ map: thatchTex() }),
    shingle: L({ map: shingleTex() }),
    planks: L({ map: planksTex("warm") }),
    planksDark: L({ map: planksTex("dark") }),
    paint: L({ map: nurseryPaintTex() }),
    wallpaper: L({ map: wallpaperTex() }),
    flagstone: L({ map: flagstoneTex() }),
    flat: L({}),
    metal: new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 60, specular: 0x555555 }),
    window: new THREE.MeshLambertMaterial({ color: 0x2a2018, emissive: 0xffb050, emissiveIntensity: 0 }),
    ember: new THREE.MeshBasicMaterial({ color: 0xff7a2a }),
    bark: L({ map: barkTex(false) }),
    barkPale: L({ map: barkTex(true) }),
    oak: leaves("oak", 0.35, 6),
    beech: leaves("beech", 0.3, 5),
    pine: leaves("pine", 0.2, 6),
    giantLeaves: leaves("oak", 0.5, 14),
    bush: windy(L({ map: leafTex("bush"), alphaTest: 0.45, side: THREE.DoubleSide }), 0.06, 0.2, 1.5),
    fern: windy(L({ map: fernTex(), alphaTest: 0.4, side: THREE.DoubleSide }), 0.08, 0.1, 1),
    grass: windy(L({ side: THREE.DoubleSide }), 0.12, 0.05, 0.6),
    wheat: windy(L({ map: wheatTex(), alphaTest: 0.4, side: THREE.DoubleSide }), 0.16, 0.2, 1.2),
    rock: L({}),
  };
}

export type Mats = ReturnType<typeof makeMaterials>;
