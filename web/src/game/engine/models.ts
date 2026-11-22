import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";

/** A loaded glTF character: the scene to clone per actor and its animation clips by name. */
export type ModelTemplate = { scene: THREE.Object3D; clips: Map<string, THREE.AnimationClip> };

const cache = new Map<string, ModelTemplate>();
const pending = new Map<string, Promise<ModelTemplate>>();
let loader: GLTFLoader | null = null;

export function loadModel(url: string): Promise<ModelTemplate> {
  const hit = pending.get(url);
  if (hit) return hit;
  loader ??= new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const p = loader.loadAsync(url).then((g) => {
    g.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.castShadow = true;
      m.receiveShadow = true;
      m.frustumCulled = false;
    });
    const t = { scene: g.scene, clips: new Map(g.animations.map((c) => [c.name, c])) };
    cache.set(url, t);
    return t;
  });
  pending.set(url, p);
  return p;
}

export const modelReady = (url: string) => cache.get(url);

/**
 * One on-screen instance of a model. `pose` names the clip that should be showing; the actor
 * cross-fades to it. Looping clips run on their own clock, scrubbed clips are placed at `at` (0..1).
 */
export class ModelActor {
  root: THREE.Object3D;
  private mixer: THREE.AnimationMixer;
  private actions = new Map<string, THREE.AnimationAction>();
  private current = "";
  private mats: THREE.MeshStandardMaterial[] = [];

  private head: THREE.Object3D | undefined;

  /** `headScale` shrinks a stock model's oversized head toward the game's own proportions; `tint` mutes its colours. */
  constructor(private tpl: ModelTemplate, scale: number, private headScale = 1, tint = 0xffffff) {
    this.root = cloneSkinned(tpl.scene);
    // stock figures are stocky: draw them a little leaner so they stand with the game's own cast
    this.root.scale.set(scale * 0.8, scale * 0.94, scale * 0.8);
    this.mixer = new THREE.AnimationMixer(this.root);
    const own = new Map<THREE.Material, THREE.MeshStandardMaterial>();
    this.root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const src = m.material as THREE.MeshStandardMaterial;
      let mine = own.get(src);
      if (!mine) {
        mine = src.clone();
        mine.color.multiply(new THREE.Color(tint));
        mine.roughness = Math.max(mine.roughness, 0.85);
        own.set(src, mine);
        if (!src.emissiveMap && src.emissive.getHex() === 0) this.mats.push(mine);
      }
      m.material = mine;
    });
    this.head = this.root.getObjectByName("head");
  }

  node(name: string) {
    return this.root.getObjectByName(name);
  }

  duration(name: string) {
    return this.tpl.clips.get(name)?.duration ?? 1;
  }

  private action(name: string) {
    let a = this.actions.get(name);
    if (!a) {
      const clip = this.tpl.clips.get(name);
      if (!clip) return null;
      a = this.mixer.clipAction(clip);
      a.play();
      a.setEffectiveWeight(0);
      this.actions.set(name, a);
    }
    return a;
  }

  /** `at` undefined: loop at `rate`. Otherwise hold the clip at that fraction of its length. */
  pose(name: string, dt: number, at?: number, rate = 1, fade = 8) {
    const a = this.action(name);
    if (!a) return;
    if (this.current !== name) {
      this.current = name;
      if (at === undefined) a.time = 0;
    }
    if (at === undefined) a.timeScale = rate;
    else {
      a.timeScale = 0;
      a.time = Math.min(0.999, Math.max(0, at)) * a.getClip().duration;
    }
    const k = Math.min(1, dt * fade);
    for (const [n, x] of this.actions) {
      const w = x.getEffectiveWeight();
      x.setEffectiveWeight(w + ((n === name ? 1 : 0) - w) * k);
    }
    this.mixer.update(dt);
    if (this.head && this.headScale !== 1) this.head.scale.setScalar(this.headScale);
  }

  flash(on: boolean) {
    for (const m of this.mats) {
      m.emissive.setHex(on ? 0xff8866 : 0x000000);
      m.emissiveIntensity = on ? 0.9 : 0;
    }
  }
}
