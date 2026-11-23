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
  private allMats: THREE.MeshStandardMaterial[] = [];
  /** Materials of grafted armour, which keep their own cloth colours. */
  private worn = new Set<THREE.MeshStandardMaterial>();

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
        this.allMats.push(mine);
        if (!src.emissiveMap && src.emissive.getHex() === 0) this.mats.push(mine);
      }
      m.material = mine;
    });
    this.head = this.root.getObjectByName("head");
    this.handR = this.root.getObjectByName("handslotr");
    this.handL = this.root.getObjectByName("handslotl");
  }

  /**
   * Repaint palette swatches of a KayKit adventurer's atlas: skin, hair and the two main cloth colours.
   * The atlas is an 8 x 4 grid of gradient swatches; each keeps its shading and takes the new hue.
   */
  recolour(c: { skin?: number; hair?: number; coat?: number }) {
    const jobs: [number, number, number][] = [];
    if (c.skin !== undefined) jobs.push([0, 0, c.skin]);
    if (c.hair !== undefined) jobs.push([1, 0, c.hair]);
    if (c.coat !== undefined) jobs.push([0, 1, c.coat], [1, 1, c.coat]);
    const done = new Map<THREE.Texture, THREE.Texture>();
    for (const m of this.allMats) {
      const src = m.map;
      const img = src?.image as (CanvasImageSource & { width: number; height: number }) | undefined;
      if (!src || !img || !img.width) continue;
      let tex = done.get(src);
      if (!tex) {
        const cv = document.createElement("canvas");
        cv.width = img.width;
        cv.height = img.height;
        const g = cv.getContext("2d");
        if (!g) return this;
        try {
          g.drawImage(img, 0, 0);
          const w = Math.floor(cv.width / 8), h = Math.floor(cv.height / 4);
          for (const [col, row, hex] of jobs) {
            if (row === 1 && this.worn.has(m)) continue;
            const d = g.getImageData(col * w, row * h, w, h);
            const px = d.data;
            let sum = 0, sat = 0;
            for (let i = 0; i < px.length; i += 4) {
              sum += px[i] * 0.3 + px[i + 1] * 0.59 + px[i + 2] * 0.11;
              sat += Math.max(px[i], px[i + 1], px[i + 2]) - Math.min(px[i], px[i + 1], px[i + 2]);
            }
            const n = px.length / 4;
            // leave grey or white swatches (steel, linen) alone when asked for a cloth colour
            if (row === 1 && sat / n < 40) continue;
            const mean = sum / n || 1;
            const r = (hex >> 16) & 255, gg = (hex >> 8) & 255, b = hex & 255;
            for (let i = 0; i < px.length; i += 4) {
              const k = (px[i] * 0.3 + px[i + 1] * 0.59 + px[i + 2] * 0.11) / mean;
              px[i] = Math.min(255, r * k);
              px[i + 1] = Math.min(255, gg * k);
              px[i + 2] = Math.min(255, b * k);
            }
            g.putImageData(d, col * w, row * h);
          }
        } catch {
          return this;
        }
        tex = new THREE.CanvasTexture(cv);
        tex.flipY = src.flipY;
        tex.colorSpace = src.colorSpace;
        tex.wrapS = src.wrapS;
        tex.wrapT = src.wrapT;
        tex.magFilter = src.magFilter;
        tex.minFilter = src.minFilter;
        tex.channel = src.channel;
        done.set(src, tex);
      }
      m.map = tex;
      m.needsUpdate = true;
    }
    return this;
  }

  /** Hide the stock weapons and shields parented to the hands, so the game's own can go there. */
  /**
   * Wear parts of another adventurer: this body's meshes matching `part` are hidden and the donor's take their place,
   * bound to this skeleton (the adventurers share one). Hats and helmets ride the head bone.
   */
  graft(donor: ModelTemplate, part: RegExp, tint = 0xffffff) {
    const bones = new Map<string, THREE.Bone>();
    let host: THREE.Object3D | undefined;
    this.root.traverse((o) => {
      if ((o as THREE.Bone).isBone) bones.set(o.name, o as THREE.Bone);
      const m = o as THREE.SkinnedMesh;
      if (m.isSkinnedMesh) host ??= m.parent ?? undefined;
      if (m.isMesh && part.test(o.name)) o.visible = false;
    });
    const src = cloneSkinned(donor.scene);
    src.updateMatrixWorld(true);
    const take: THREE.Mesh[] = [];
    src.traverse((o) => {
      if ((o as THREE.Mesh).isMesh && part.test(o.name)) take.push(o as THREE.Mesh);
    });
    const own = new Map<THREE.Material, THREE.MeshStandardMaterial>();
    for (const m of take) {
      const sm = m as THREE.SkinnedMesh;
      if (sm.isSkinnedMesh) {
        const mine = sm.skeleton.bones.map((b) => bones.get(b.name));
        if (mine.some((b) => !b) || !host) continue;
        host.add(sm);
        sm.bind(new THREE.Skeleton(mine as THREE.Bone[], sm.skeleton.boneInverses), sm.bindMatrix);
      } else {
        const to = m.parent && bones.get(m.parent.name);
        if (!to) continue;
        to.add(m);
      }
      const from = m.material as THREE.MeshStandardMaterial;
      let mat = own.get(from);
      if (!mat) {
        mat = from.clone();
        mat.color.multiply(new THREE.Color(tint));
        mat.roughness = Math.max(mat.roughness, 0.85);
        own.set(from, mat);
        this.allMats.push(mat);
        this.mats.push(mat);
        this.worn.add(mat);
      }
      m.material = mat;
      m.visible = true;
    }
    return this;
  }

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

  /** A gold crown on the skull, with a soft glow. */
  crown(color: number, glow: number) {
    let skull: THREE.Object3D | undefined;
    this.root.traverse((o) => {
      if (/_Head$/.test(o.name)) skull = o;
      if (/_Helmet$/.test(o.name)) o.visible = false;
    });
    if (!skull || !this.head) return this;
    this.root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(skull);
    const c = box.getCenter(new THREE.Vector3());
    const d = box.getSize(new THREE.Vector3());
    const r = Math.max(d.x, d.z) * 0.4;
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color, emissive: glow, emissiveIntensity: 0.6, metalness: 0.3, roughness: 0.4 });
    const band = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.94, d.y * 0.16, 12, 1, true), mat);
    mat.side = THREE.DoubleSide;
    g.add(band);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const spike = new THREE.Mesh(new THREE.ConeGeometry(r * 0.16, d.y * (i % 2 ? 0.22 : 0.36), 4), mat);
      spike.position.set(Math.sin(a) * r, d.y * (i % 2 ? 0.17 : 0.24), Math.cos(a) * r);
      g.add(spike);
    }
    g.position.set(c.x, c.y - d.y * 0.02, c.z);
    g.traverse((o) => (o.castShadow = true));
    this.root.add(g);
    g.updateMatrixWorld(true);
    this.head.attach(g);
    return this;
  }

  /** Fit the model's bind-pose height to `h` metres. */
  fit(h: number) {
    this.root.scale.setScalar(1);
    this.root.updateMatrixWorld(true);
    const box = new THREE.Box3();
    this.root.traverse((o) => {
      const m = o as THREE.SkinnedMesh;
      if (!m.isSkinnedMesh) return;
      m.skeleton.update();
      m.computeBoundingBox();
      box.union(m.boundingBox!.clone().applyMatrix4(m.matrixWorld));
    });
    const y = box.max.y - Math.min(0, box.min.y);
    if (y > 0 && Number.isFinite(y)) this.root.scale.setScalar(h / y);
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

type Worn = Partial<Record<"head" | "chest" | "hands" | "legs" | "feet", string>>;

/** A player's modelled body: the chest piece picks the body, other armour is grafted on, then the creator's colours go over it. */
export function dressAdventurer(body: number, col: { skin: number; hair: number; coat: number }, worn: Worn): Promise<ModelActor> {
  const chest = worn.chest;
  const kit = (st: string | undefined) => (st === "leather" ? ADV.hooded : st === "hound" ? ADV.barbarian : st ? ADV.knight : "");
  const limbs: [string, RegExp, string | undefined][] = [
    [kit(worn.head), /_(Helmet|Hat|Head_Hooded)$/, worn.head],
    [kit(worn.hands), /_Arm(Left|Right)$/, worn.hands],
    [kit(worn.legs ?? worn.feet), /_Leg(Left|Right)$/, worn.legs ?? worn.feet],
  ];
  const url = kit(chest) || [ADV.rogue, ADV.hooded, ADV.barbarian][body] || ADV.hooded;
  return Promise.all([loadAdventurer(url), ...limbs.map(([u]) => (u && u !== url ? loadModel(u) : Promise.resolve<ModelTemplate | null>(null)))] as const).then(([[tpl, anim], ...donors]) => {
    const a = new ModelActor(tpl, 1.78 / ADV_HEIGHT, ADV_HEAD, chest === "bk" ? 0x6a6470 : 0xd8d0c4, anim).emptyHands();
    a.root.traverse((o) => {
      if (/_(Helmet|Hat)$/.test(o.name)) o.visible = !!worn.head && kit(worn.head) === url;
    });
    limbs.forEach(([u, part, st], i) => {
      const d = donors[i];
      // a hood replaces the whole head; a hat or helmet sits on it
      if (d) a.graft(d, u === ADV.hooded && i === 0 ? /_Head(_Hooded)?$/ : part, st === "bk" ? 0x6a6470 : 0xd8d0c4);
    });
    return a.recolour({ skin: col.skin, hair: col.hair, coat: chest ? undefined : col.coat });
  });
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
