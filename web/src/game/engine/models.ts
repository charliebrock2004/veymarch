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
  handR: THREE.Object3D | undefined;
  handL: THREE.Object3D | undefined;

  /** `headScale` shrinks a stock model's oversized head toward the game's own proportions; `tint` mutes its colours. */
  constructor(private tpl: ModelTemplate, scale: number, private headScale = 1, tint = 0xffffff, anim?: ModelTemplate) {
    if (anim) this.tpl = { scene: tpl.scene, clips: anim.clips };
    this.root = cloneSkinned(tpl.scene);
    this.root.scale.setScalar(scale);
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
    this.handR = this.root.getObjectByName("handslotr");
    this.handL = this.root.getObjectByName("handslotl");
  }

  /** Hide the stock weapons and shields parented to the hands, so the game's own can go there. */
  emptyHands() {
    for (const h of [this.handR, this.handL]) for (const c of h?.children ?? []) c.visible = false;
    return this;
  }

  /** See-through, for spirits. */
  fade(opacity: number) {
    this.root.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
      if (!m) return;
      m.transparent = true;
      m.opacity = opacity;
      m.depthWrite = false;
      (o as THREE.Mesh).castShadow = false;
    });
    return this;
  }

  /** Monster features fixed to the head: pointed `ears` and/or glowing `eyes` of the given colours. */
  monster(ears?: number, eyes?: number) {
    let skull: THREE.Object3D | undefined;
    this.root.traverse((o) => {
      if (/_Head$/.test(o.name)) skull = o;
    });
    if (!skull || !this.head) return this;
    this.root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(skull);
    const c = box.getCenter(new THREE.Vector3());
    const d = box.getSize(new THREE.Vector3());
    const fix = (m: THREE.Mesh) => {
      this.root.add(m);
      m.updateMatrixWorld(true);
      this.head!.attach(m);
    };
    for (const side of [-1, 1]) {
      if (ears !== undefined) {
        const ear = new THREE.Mesh(new THREE.ConeGeometry(d.x * 0.11, d.y * 0.6, 5), new THREE.MeshStandardMaterial({ color: ears, roughness: 0.9 }));
        ear.position.set(c.x + side * d.x * 0.52, c.y + d.y * 0.02, c.z);
        ear.rotation.z = -side * 1.15;
        ear.scale.z = 0.45;
        ear.castShadow = true;
        fix(ear);
      }
      if (eyes !== undefined) {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(d.x * 0.07, 8, 6), new THREE.MeshBasicMaterial({ color: eyes }));
        eye.position.set(c.x + side * d.x * 0.2, c.y - d.y * 0.02, c.z + d.z * 0.47);
        fix(eye);
      }
    }
    return this;
  }

  has(name: string) {
    return this.tpl.clips.has(name);
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

/** The adventurer bodies share one rig; the knight file carries the clips for all of them. */
export const ADV_ANIMS = "/models/adv_knight.glb";
export const ADV = {
  knight: "/models/adv_knight.glb",
  rogue: "/models/adv_rogue.glb",
  hooded: "/models/adv_rogue_hooded.glb",
  barbarian: "/models/adv_barbarian.glb",
  mage: "/models/adv_mage.glb",
};
export const ADV_HEIGHT = 1.72;
export const ADV_HEAD = 0.58;

/** Resolves once both the body and the shared clips are in; `make` is skipped if `alive` says the owner has moved on. */
export function loadAdventurer(url: string): Promise<[ModelTemplate, ModelTemplate]> {
  return Promise.all([loadModel(url), loadModel(ADV_ANIMS)]);
}

type HumanLike = { move: number; action: string; at: number; block: boolean; armed: boolean };

/** Drives a modelled adventurer from the same pose inputs the code-built human takes. */
export function poseAdventurer(a: ModelActor, p: HumanLike, dt: number) {
  const at = Math.min(1, Math.max(0, p.at));
  switch (p.action) {
    case "light1": return a.pose(p.armed ? "1H_Melee_Attack_Slice_Diagonal" : "Unarmed_Melee_Attack_Punch_A", dt, 0.12 + at * 0.6, 1, 26);
    case "light2": return a.pose(p.armed ? "1H_Melee_Attack_Slice_Horizontal" : "Unarmed_Melee_Attack_Punch_B", dt, 0.12 + at * 0.6, 1, 26);
    case "light3":
    case "thrust": return a.pose(p.armed ? "1H_Melee_Attack_Stab" : "Unarmed_Melee_Attack_Punch_A", dt, 0.1 + at * 0.65, 1, 26);
    case "charge":
    case "windup": return a.pose("2H_Melee_Attack_Chop", dt, Math.min(0.3, at * 0.3), 1, 14);
    case "heavy": return a.pose("2H_Melee_Attack_Chop", dt, 0.2 + at * 0.6, 1, 26);
    case "hammer":
    case "gather": return a.pose("1H_Melee_Attack_Chop", dt, 0.15 + ((at * 3) % 1) * 0.55, 1, 16);
    case "cast": return a.pose("Spellcast_Shoot", dt, at * 0.8, 1, 16);
    case "hurt": return a.pose("Hit_A", dt, at * 0.8, 1, 24);
    case "dodge": return a.pose("Dodge_Forward", dt, at * 0.9, 1, 26);
    case "dead": return a.pose("Death_A", dt, Math.min(1, p.at / a.duration("Death_A")), 1, 20);
    case "talk": return a.pose("Interact", dt, undefined, 0.6, 6);
    case "cheer": return a.pose("Cheer", dt, undefined, 1, 8);
    case "sit": return a.pose("Sit_Floor_Idle", dt, undefined, 1, 6);
  }
  if (p.block) return a.pose("Blocking", dt, undefined, 1, 14);
  if (p.move > 1.15) return a.pose("Running_A", dt, undefined, p.move / 1.45);
  if (p.move > 0.08) return a.pose("Walking_A", dt, undefined, Math.max(0.5, p.move * 1.25));
  a.pose("Idle", dt, undefined, 1, 6);
}
