import * as THREE from "three";
import { painted, windy, windyBaked } from "./kit";
import {
  foliageTex,
  barkTex, fernTex, flagstoneTex, nurseryPaintTex, planksTex, plasterTex, shingleTex, stoneTex, thatchTex, wallpaperTex, wheatTex,
} from "./textures";

/** Shared materials. Vertex colour multiplies the map, so one material serves many tints. */
export function makeMaterials() {
  const B = (o: THREE.MeshLambertMaterialParameters) => new THREE.MeshLambertMaterial({ vertexColors: true, ...o });
  const L = (o: THREE.MeshLambertMaterialParameters) => painted(new THREE.MeshLambertMaterial({ vertexColors: true, ...o }));
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
    fern: painted(windy(B({ map: fernTex(), alphaTest: 0.4, side: THREE.DoubleSide }), 0.08, 0.1, 1), 0.6),
    grass: windy(new THREE.MeshLambertMaterial({ vertexColors: true }), 0.12, 0.05, 0.6),
    wheat: painted(windy(B({ map: wheatTex(), alphaTest: 0.4, side: THREE.DoubleSide }), 0.16, 0.2, 1.2), 0.6),
    foliage: painted(windyBaked(B({ map: foliageTex(), alphaTest: 0.45, side: THREE.DoubleSide }), 0.35), 0.7),
    clutter: L({}),
  };
}

export type Mats = ReturnType<typeof makeMaterials>;
