import * as THREE from "three";
import { windy, windyBaked } from "./kit";
import {
  foliageTex,
  barkTex, fernTex, flagstoneTex, nurseryPaintTex, planksTex, plasterTex, shingleTex, stoneTex, thatchTex, wallpaperTex, wheatTex,
} from "./textures";

/** Shared materials. Vertex colour multiplies the map, so one material serves many tints. */
export function makeMaterials() {
  const L = (o: THREE.MeshLambertMaterialParameters) => new THREE.MeshLambertMaterial({ vertexColors: true, ...o });
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
    fern: windy(L({ map: fernTex(), alphaTest: 0.4, side: THREE.DoubleSide }), 0.08, 0.1, 1),
    grass: windy(L({ side: THREE.DoubleSide }), 0.12, 0.05, 0.6),
    wheat: windy(L({ map: wheatTex(), alphaTest: 0.4, side: THREE.DoubleSide }), 0.16, 0.2, 1.2),
    foliage: windyBaked(L({ map: foliageTex(), alphaTest: 0.45, side: THREE.DoubleSide }), 0.35),
    clutter: L({}),
  };
}

export type Mats = ReturnType<typeof makeMaterials>;
