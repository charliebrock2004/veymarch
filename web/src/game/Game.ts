import * as THREE from "three";
import { DESCRIPTIONS, ITEMS, MORE_LINES, RECIPES, SPEEDS, TRADES } from "./content";
import { addItem, canMine, consume, countOf, equip, equipped, gateOpen, grantUniques, item, recipeHint, strikeDamage, tryCraft, type Stack } from "./rules";
import { Audio } from "./engine/audio";
import { Beam, DecalPool, Flashes } from "./engine/fx";
import { shared } from "./engine/kit";
import { makeMaterials } from "./engine/materials";
import { Particles, buildGlows } from "./engine/particles";
import { Poser, buildHuman, poseHuman, type HumanAction, type HumanLook, type Rig } from "./engine/rig";
import { buildSky } from "./engine/sky";
import { blockTex } from "./engine/textures";
import { buildDungeon, type Dungeon } from "./world/dungeon";
import { BOUNDS, DUN, DUN_X, GATE, REGION_TITLE, SPAWN, VOSS, regionAt, type Region } from "./world/layout";
import { buildOverworld, type NodeDef, type Overworld } from "./world/overworld";
import { Cookie } from "./play/boss";
import type { Env, HurtOpts, PlayerState } from "./play/env";
import { Mob, type MobKind } from "./play/mobs";
import { NPCS, Npc, VOSS_NPCS } from "./play/npcs";
import { weaponModel } from "./play/weapons";

// ------------------------------------------------------------------ public types

export type Look = { body: 0 | 1 | 2; skin: number; hair: 0 | 1 | 2 | 3; hairColor: number; coat: number };
export const SKINS = [0xf0d8c0, 0xe2c0a0, 0xc8a080, 0xa07858, 0x6e4a32];
export const HAIRS = [0x2a2118, 0x5a3a22, 0x8a5a2a, 0xb89a6a, 0x9a3a22, 0xd8d0c4];
export const COATS = [0x7a6248, 0x5e6b45, 0x6a3b2a, 0x3c4458, 0x8a7a5a, 0x2e2a26];
export const HAIR_STYLES = ["tied", "short", "long", "bald"] as const;
export const BODY_NAMES = ["Slight", "Average", "Broad"];

export type Quality = "low" | "medium" | "high";
export type Mode = "loading" | "title" | "create" | "play" | "bag" | "talk" | "dead" | "reward" | "end" | "pause";

export type SlotInfo = { slot: number; name: string; place: string; progress: string; time: number } | null;

export type Hud = {
  mode: Mode;
  loading: number;
  name: string;
  hp: number;
  maxHp: number;
  stam: number;
  maxStam: number;
  mana: number;
  maxMana: number;
  ember: boolean;
  emberReady: boolean;
  weapon: string;
  weaponId: string;
  shield: boolean;
  prompt: string;
  objective: string;
  objectiveSub: string;
  bearing: number | null;
  dist: number;
  camYaw: number;
  place: string;
  placeSub: string;
  placeAt: number;
  toast: string;
  toastId: number;
  talk: { name: string; role: string; text: string; more: boolean; trades: { id: string; label: string; ok: boolean }[] } | null;
  boss: { name: string; hp: number; max: number; phase: number } | null;
  items: { uid: string; id: string; name: string; count: number; equipped: boolean; kind: string; slot: string; desc: string; dmg: number }[];
  crafts: { id: string; name: string; out: string; ok: boolean; have: string; station: string; can: boolean }[];
  station: "hand" | "bench" | "forge";
  hour: number;
  night: boolean;
  reward: { id: string; name: string; desc: string }[] | null;
  fade: number;
  stats: { time: number; deaths: number; kills: number };
  hurtAt: number;
  quality: Quality;
  muted: boolean;
  slots: SlotInfo[];
  combat: boolean;
  charge: number;
  slot: number;
  inDungeon: boolean;
  fps: number;
};

export type Press =
  | "attackDown" | "attackUp" | "dodge" | "interact" | "blockDown" | "blockUp" | "ember" | "bag" | "close" | "talk" | "wake" | "pause" | "resume" | "endClose" | "rewardClose" | "title" | "heal";

export type GameApi = {
  dispose: () => void;
  subscribe: (fn: (h: Hud) => void) => () => void;
  newGame: (slot: number, name: string, look: Look) => void;
  continueGame: (slot: number) => void;
  deleteSlot: (slot: number) => void;
  create: (look: Look) => void;
  preview: (look: Look) => void;
  toTitle: () => void;
  setStick: (x: number, y: number) => void;
  setKeys: (codes: string[]) => void;
  look: (dx: number, dy: number) => void;
  press: (p: Press) => void;
  equip: (uid: string) => void;
  use: (uid: string) => void;
  craft: (id: string) => void;
  trade: (id: string) => void;
  setQuality: (q: Quality) => void;
  setMuted: (m: boolean) => void;
};

// ------------------------------------------------------------------ save format

const SAVE = (slot: number) => `veyrmarch.v2.slot${slot}`;

type Flags = {
  talked: boolean;
  ember: boolean;
  chest: boolean;
  hollow: boolean;
  shrine: boolean;
  entered: boolean;
  slab: boolean;
  nursery: boolean;
  cookie: boolean;
  gate: boolean;
  voss: boolean;
  ended: boolean;
  tanicKnife: boolean;
};

type Save = {
  v: 2;
  name: string;
  look: Look;
  x: number;
  z: number;
  yaw: number;
  dungeon: boolean;
  hp: number;
  mana: number;
  maxMana: number;
  items: Stack[];
  seals: string[];
  flags: Flags;
  nodes: Record<string, number>;
  hour: number;
  time: number;
  deaths: number;
  kills: number;
  seq: number;
  weightX: number;
  deadMobs: string[];
};

const freshFlags = (): Flags => ({
  talked: false, ember: false, chest: false, hollow: false, shrine: false, entered: false, slab: false, nursery: false, cookie: false, gate: false, voss: false, ended: false, tanicKnife: false,
});

function lookToHuman(l: Look): HumanLook {
  return {
    skin: SKINS[l.skin] ?? SKINS[1],
    hair: HAIRS[l.hairColor] ?? HAIRS[1],
    hairStyle: HAIR_STYLES[l.hair] ?? "tied",
    shirt: 0xcdbba6,
    coat: COATS[l.coat] ?? COATS[0],
    trousers: 0x3a342c,
    boots: 0x2a2420,
    frame: [0.9, 1, 1.12][l.body],
    height: [1.74, 1.8, 1.84][l.body],
    pin: true,
    belt: 0x3c2a1c,
  };
}

// ------------------------------------------------------------------ the game

type Interact = { x: number; z: number; r: number; dungeon: boolean; label: () => string | null; act: () => void; facing?: boolean };

type Projectile = { x: number; y: number; z: number; vx: number; vz: number; life: number; dungeon: boolean };

type Floater = { el: HTMLDivElement; x: number; y: number; z: number; life: number; max: number };

const TIME_KEYS: { h: number; el: number; sun: number; si: number; hs: number; hg: number; hi: number; zen: number; hor: number; fog: number; ex: number }[] = [
  { h: 0, el: -20, sun: 0x9ab0e0, si: 0.9, hs: 0x6a7aa8, hg: 0x2a2c38, hi: 1.0, zen: 0x101830, hor: 0x2e3a54, fog: 0x2a3448, ex: 1.35 },
  { h: 5, el: -6, sun: 0x9ab0e0, si: 0.9, hs: 0x7080a8, hg: 0x2a2c38, hi: 1.05, zen: 0x1e2a48, hor: 0x52506a, fog: 0x444a5e, ex: 1.3 },
  { h: 6.2, el: 4, sun: 0xffa868, si: 2.6, hs: 0xc0b8c8, hg: 0x5a4a3a, hi: 1.45, zen: 0x6080b0, hor: 0xf2c090, fog: 0xd0b090, ex: 1.12 },
  { h: 7.6, el: 16, sun: 0xffd6a4, si: 3.8, hs: 0xd8dce4, hg: 0x625440, hi: 1.7, zen: 0x6d94c4, hor: 0xeed8b8, fog: 0xd2c6ae, ex: 1.08 },
  { h: 12.5, el: 58, sun: 0xfff2e0, si: 4.2, hs: 0xdce4ec, hg: 0x6a5e4a, hi: 1.75, zen: 0x6a98cc, hor: 0xe4e0d2, fog: 0xcfd0c6, ex: 1.0 },
  { h: 17, el: 22, sun: 0xffd496, si: 3.8, hs: 0xd8d0c8, hg: 0x66543e, hi: 1.65, zen: 0x6a8cbc, hor: 0xeed4a8, fog: 0xd2bc9c, ex: 1.06 },
  { h: 19.4, el: 3, sun: 0xff9058, si: 2.4, hs: 0xb4a4b4, hg: 0x4a3c30, hi: 1.35, zen: 0x4a5480, hor: 0xeca070, fog: 0xb89078, ex: 1.15 },
  { h: 20.6, el: -6, sun: 0x9ab0e0, si: 0.9, hs: 0x7080a8, hg: 0x2a2c38, hi: 1.05, zen: 0x182240, hor: 0x40405c, fog: 0x363c50, ex: 1.3 },
  { h: 24, el: -20, sun: 0x9ab0e0, si: 0.9, hs: 0x6a7aa8, hg: 0x2a2c38, hi: 1.0, zen: 0x101830, hor: 0x2e3a54, fog: 0x2a3448, ex: 1.35 },
];

const OBJ_RANGE = 4.2;

export function mountGame(canvas: HTMLCanvasElement, overlay: HTMLDivElement): GameApi {
  // ------------------------------------------------------------ renderer and scene
  const isTouch = matchMedia("(pointer: coarse)").matches;
  let quality: Quality = (localStorage.getItem("veyrmarch.quality") as Quality) || (isTouch ? "medium" : "high");
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: quality !== "low", powerPreference: "high-performance", stencil: false });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = quality !== "low";
  renderer.shadowMap.type = quality === "high" ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0xc8bea8, 0.007);
  scene.background = new THREE.Color(0x1c1916);
  const camera = new THREE.PerspectiveCamera(60, 1, 0.15, 1500);
  camera.position.set(0, 6, -30);
  const hemi = new THREE.HemisphereLight(0xc8d0d8, 0x4e4434, 1.0);
  const sun = new THREE.DirectionalLight(0xffd2a0, 2.6);
  sun.castShadow = quality !== "low";
  sun.shadow.mapSize.set(quality === "high" ? 2048 : 1024, quality === "high" ? 2048 : 1024);
  const sc = sun.shadow.camera;
  sc.left = -34;
  sc.right = 34;
  sc.top = 34;
  sc.bottom = -34;
  sc.near = 1;
  sc.far = 220;
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.05;
  scene.add(hemi, sun, sun.target);
  const lightPool: THREE.PointLight[] = [];
  for (let i = 0; i < 4; i++) {
    const l = new THREE.PointLight(0xff9a50, 0, 16, 1.6);
    scene.add(l);
    lightPool.push(l);
  }
  const stage = new THREE.PointLight(0xffc888, 0, 26, 1.4);
  scene.add(stage);
  const sky = buildSky();
  scene.add(sky.mesh);

  const audio = new Audio();
  audio.setMuted(localStorage.getItem("veyrmarch.muted") === "1");
  const pxScale = { value: 400 };
  const glowI = { value: 0 };
  const dust = new Particles(900, false, pxScale);
  const sparks = new Particles(700, true, pxScale);
  scene.add(dust.points, sparks.points);
  const decals = new DecalPool(scene, shared.time);
  const flashes = new Flashes(scene);
  const beam = new Beam(scene);

  // ------------------------------------------------------------ state
  const subs = new Set<(h: Hud) => void>();
  let mode: Mode = "loading";
  let loading = 0;
  let world: Overworld | null = null;
  let dun: Dungeon | null = null;
  let cookie: Cookie | null = null;
  const mobs: Mob[] = [];
  const npcs: Npc[] = [];
  let slot = 0;
  let name = "Walker";
  let look: Look = { body: 1, skin: 1, hair: 0, hairColor: 1, coat: 0 };
  let items: Stack[] = [];
  let seals: string[] = [];
  let flags = freshFlags();
  let seq = 1;
  const uid = () => "i" + seq++;
  let hour = 6.6;
  let playTime = 0;
  let deaths = 0;
  let kills = 0;
  let toast = "";
  let toastId = 0;
  let placeName = "";
  let placeSub = "";
  let placeAt = 0;
  let region: Region | null = null;
  let talk: Hud["talk"] = null;
  let talkQueue: string[] = [];
  let talkTrades = false;
  let talkNpc: Npc | null = null;
  let onTalkEnd: (() => void) | null = null;
  let reward: Hud["reward"] = null;
  let fade = 0;
  let fadeTarget = 0;
  let fadeCb: (() => void) | null = null;
  let hurtAt = 0;
  let combatT = 0;
  let saveT = 0;
  let hudT = 0;
  let fps = 60;
  let gateT = 0;
  let gateOpening = false;
  let weightX = 0;
  let respawnShrine = false;
  let introSeen = false;
  let stationNear: "hand" | "bench" | "forge" = "hand";
  let prompt = "";
  let promptAct: (() => void) | null = null;
  let deadMobs = new Set<string>();
  let ringT = 0;
  let bossDoneT = -1;
  let revealT = 0;
  let revealed = false;
  const good = { x: SPAWN.x, z: SPAWN.z, yaw: 0, cam: 0 };
  let nanWarned = false;

  // player
  const P: PlayerState & {
    stam: number; maxStam: number; mana: number; maxMana: number; vx: number; vz: number; kx: number; kz: number; speed: number;
    action: HumanAction; at: number; dur: number; hitAt: number; hitDone: boolean; combo: number; comboT: number; queued: boolean;
    holding: boolean; holdT: number; dodgeX: number; dodgeZ: number; stamT: number; hurtT: number; deadT: number; phase: number;
    lastStep: number; regenT: number; emberCd: number; sprint: boolean;
  } = {
    x: SPAWN.x, y: 0, z: SPAWN.z, yaw: SPAWN.yaw, hp: 100, maxHp: 100, iframe: 0, blocking: false, blockT: 0, shield: false, dead: false, inDungeon: false,
    stam: 100, maxStam: 100, mana: 0, maxMana: 0, vx: 0, vz: 0, kx: 0, kz: 0, speed: 0,
    action: "none", at: 0, dur: 1, hitAt: 0.4, hitDone: true, combo: 0, comboT: 0, queued: false,
    holding: false, holdT: 0, dodgeX: 0, dodgeZ: 0, stamT: 0, hurtT: 0, deadT: 0, phase: 0, lastStep: 0, regenT: 0, emberCd: 0, sprint: false,
  };
  let playerRig: Rig | null = null;
  let playerPoser: Poser | null = null;
  let heldMain: THREE.Object3D | null = null;
  let heldOff: THREE.Object3D | null = null;

  // camera
  let camYaw = 0;
  let camPitch = 0.3;
  let camDist = 5.6;
  let lookT = 10;
  let shake = 0;
  let hitStop = 0;
  const camPos = new THREE.Vector3(0, 8, -40);
  const camTgt = new THREE.Vector3();

  // input
  let stickX = 0;
  let stickY = 0;
  const keys = new Set<string>();

  // projectiles
  const bolts: Projectile[] = [];
  const boltGeo = new THREE.SphereGeometry(0.18, 8, 6);
  const boltMat = new THREE.MeshBasicMaterial({ color: 0xffa040 });
  const boltMeshes: THREE.Mesh[] = [];

  // floaters
  const floaters: Floater[] = [];
  const bars = new Map<number, HTMLDivElement>();

  const env: Env = {
    time: 0,
    player: P,
    hurtPlayer: (d, sx, sz, o) => hurtPlayer(d, sx, sz, o),
    dust, sparks, decals, flashes, beam, audio,
    col: null as unknown as Env["col"],
    groundAt: (x, z) => (world ? world.groundAt(x, z) : 0),
    blocked: (x, z) => (world ? world.inRiver(x, z) : false),
    shake: (a) => (shake = Math.max(shake, a)),
    floater: (t, x, y, z, k) => floater(t, x, y, z, k),
    combat: () => (combatT = 3),
    parent: (d) => (d ? dun!.root : world!.root),
  };

  // ------------------------------------------------------------ helpers
  function say(text: string) {
    toast = text;
    toastId++;
    push();
  }

  function floater(text: string, x: number, y: number, z: number, kind: "dmg" | "heal" | "info" | "crit" | "fire" = "dmg") {
    if (floaters.length > 26) {
      const f = floaters.shift()!;
      f.el.remove();
    }
    const el = document.createElement("div");
    el.className = "vm-float vm-float-" + kind;
    el.textContent = text;
    overlay.appendChild(el);
    floaters.push({ el, x: x + (Math.random() - 0.5) * 0.4, y, z: z + (Math.random() - 0.5) * 0.4, life: kind === "info" || kind === "crit" ? 1.6 : 0.9, max: kind === "info" || kind === "crit" ? 1.6 : 0.9 });
  }

  const v3 = new THREE.Vector3();
  function project(x: number, y: number, z: number) {
    v3.set(x, y, z).project(camera);
    if (v3.z > 1) return null;
    return { x: (v3.x * 0.5 + 0.5) * canvas.clientWidth, y: (-v3.y * 0.5 + 0.5) * canvas.clientHeight };
  }

  function updateOverlay(dt: number) {
    for (let i = floaters.length - 1; i >= 0; i--) {
      const f = floaters[i];
      f.life -= dt;
      f.y += dt * 0.9;
      const p = project(f.x, f.y, f.z);
      if (f.life <= 0 || !p) {
        f.el.remove();
        floaters.splice(i, 1);
        continue;
      }
      const k = f.life / f.max;
      f.el.style.transform = `translate3d(${p.x}px, ${p.y}px, 0) translate(-50%, -50%) scale(${0.85 + Math.min(1, (1 - k) * 6) * 0.25})`;
      f.el.style.opacity = String(Math.min(1, k * 3));
    }
    const seen = new Set<number>();
    const list: { id: number; x: number; y: number; z: number; hp: number; max: number }[] = [];
    if (mode === "play") {
      for (const m of mobs) if (m.alive && m.hp < m.max && m.dungeon === P.inDungeon && m.distTo(P.x, P.z) < 26) list.push({ id: m.id, x: m.x, y: m.y + m.cfg.height + 0.5, z: m.z, hp: m.hp, max: m.max });
      if (cookie) for (const m of cookie.toys) if (m.alive && m.hp < m.max) list.push({ id: m.id, x: m.x, y: m.y + m.cfg.height + 0.5, z: m.z, hp: m.hp, max: m.max });
    }
    for (const b of list) {
      const p = project(b.x, b.y, b.z);
      if (!p) continue;
      seen.add(b.id);
      let el = bars.get(b.id);
      if (!el) {
        el = document.createElement("div");
        el.className = "vm-bar";
        el.innerHTML = "<i></i>";
        overlay.appendChild(el);
        bars.set(b.id, el);
      }
      el.style.transform = `translate3d(${p.x}px, ${p.y}px, 0) translate(-50%, -50%)`;
      (el.firstChild as HTMLElement).style.width = `${Math.max(0, (b.hp / b.max) * 100)}%`;
    }
    for (const [id, el] of bars)
      if (!seen.has(id)) {
        el.remove();
        bars.delete(id);
      }
  }

  function mainWeapon() {
    const eq = equipped(items, "main");
    return item(eq?.def ?? "wpn_fists");
  }

  function syncGear() {
    if (!playerRig) return;
    const w = mainWeapon();
    if (heldMain) heldMain.parent?.remove(heldMain);
    heldMain = null;
    if (w.id !== "wpn_fists") {
      heldMain = weaponModel(w.id);
      playerRig.sockets.gripR.add(heldMain);
    }
    const sh = items.some((s) => s.equipped && item(s.def).moveset === "shield");
    P.shield = sh;
    if (heldOff) heldOff.parent?.remove(heldOff);
    heldOff = null;
    if (sh) {
      heldOff = weaponModel("shield");
      heldOff.rotation.set(0, Math.PI / 2, 0);
      heldOff.position.set(0.06, 0.05, -0.1);
      playerRig.bones.foreL.add(heldOff);
    }
  }

  function buildPlayer() {
    if (!world) return;
    if (playerRig) playerRig.group.parent?.remove(playerRig.group);
    playerRig = buildHuman(lookToHuman(look));
    playerPoser = new Poser(playerRig);
    (P.inDungeon ? dun!.root : world.root).add(playerRig.group);
    heldMain = heldOff = null;
    syncGear();
  }

  function hasEdge() {
    return ["wpn_stone_knife", "wpn_copper_sword", "wpn_iron_sword", "wpn_cookie_blade", "wpn_smacko"].some((id) => countOf(items, id) > 0);
  }

  function toolTier() {
    let t = 0;
    for (const s of items) {
      const d = ITEMS[s.def];
      if (d && d.moveset.includes("pick")) t = Math.max(t, d.tier);
    }
    return t;
  }

  function nodeLeft(n: NodeDef) {
    return nodeState.get(n.id)?.left ?? n.max;
  }
  const nodeState = new Map<string, { left: number; regrow: number }>();

  // ------------------------------------------------------------ objective
  function objective(): { text: string; sub: string; at: THREE.Vector3 | null } {
    if (!world || !dun) return { text: "", sub: "", at: null };
    const a = world.anchors;
    const tanic = npcs.find((n) => n.def.id === "tanic");
    const tanicAt = tanic ? new THREE.Vector3(tanic.x, 0, tanic.z) : a.tanicDoor;
    const nearestNode = (kind: string) => {
      let best: NodeDef | null = null;
      let bd = 1e9;
      for (const n of world!.nodes)
        if (n.kind === kind && nodeLeft(n) > 0) {
          const d = Math.hypot(n.x - P.x, n.z - P.z);
          if (d < bd) {
            bd = d;
            best = n;
          }
        }
      return best ? new THREE.Vector3(best.x, 0, best.z) : null;
    };
    if (!flags.talked) return { text: "Speak to Tanic", sub: "Workshop lane, west of the bell", at: tanicAt };
    if (!hasEdge()) {
      if (countOf(items, "mat_flint") < 2) return { text: "Gather flint", sub: `Creek banks, north of the palisade · ${countOf(items, "mat_flint")}/2`, at: nearestNode("flint") };
      if (countOf(items, "mat_wood") < 1) return { text: "Gather wood", sub: "A fallen limb by the forest path", at: nearestNode("wood") };
      return { text: "Craft a Stone Knife", sub: "Open the bag → Craft. No bench needed.", at: null };
    }
    if (!flags.ember) return { text: "Show Tanic your knife", sub: "Workshop lane", at: tanicAt };
    if (!flags.cookie) {
      if (!P.inDungeon) return { text: "Find Cookie's Castle", sub: "North through the Giant Forest, up the hill", at: a.castleDoor };
      if (!flags.slab) return { text: "Move the brass weight", sub: "Push it onto the plate, or heave it", at: dun.weight.position.clone() };
      if (!flags.nursery) {
        const horse = mobs.find((m) => m.kind === "horse" && m.alive);
        return { text: "Silence the rocking horse", sub: "The toy gallery", at: horse ? new THREE.Vector3(horse.x, 0, horse.z) : dun.anchors.nurseryDoor };
      }
      return { text: "Defeat Cookie", sub: "The nursery courtyard. Dodge the bow.", at: dun.anchors.arena };
    }
    if (P.inDungeon) return { text: "Leave the castle", sub: "The courtyard gate is open", at: dun.anchors.exitGate };
    if (!flags.gate) return { text: "Take the Core to the Green Gate", sub: "East of Hearthfen, over the Broken Kingsbridge", at: a.gate };
    if (!flags.voss) return { text: "Walk the wheat", sub: "Harrenvale road, to Castellan Voss", at: a.voss };
    return { text: "The Kingdom waits", sub: "End of the slice. Cookie's Pickaxe breaks the iron by the gate.", at: null };
  }

  // ------------------------------------------------------------ hud
  function snapshot(): Hud {
    const w = mainWeapon();
    const obj = objective();
    let bearing: number | null = null;
    let dist = 0;
    if (obj.at && (obj.at.x > DUN_X - 200) === P.inDungeon) {
      const ang = Math.atan2(obj.at.x - P.x, obj.at.z - P.z);
      bearing = Math.atan2(Math.sin(ang - camYaw), Math.cos(ang - camYaw));
      dist = Math.hypot(obj.at.x - P.x, obj.at.z - P.z);
    }
    const bossOn = cookie && cookie.fighting && P.inDungeon;
    return {
      mode, loading, name,
      hp: Math.ceil(P.hp), maxHp: P.maxHp, stam: P.stam, maxStam: P.maxStam, mana: P.mana, maxMana: P.maxMana,
      ember: flags.ember, emberReady: P.mana >= 8 && P.emberCd <= 0,
      weapon: w.name, weaponId: w.id, shield: P.shield,
      prompt, objective: obj.text, objectiveSub: obj.sub, bearing, dist, camYaw,
      place: placeName, placeSub, placeAt, toast, toastId, talk,
      boss: bossOn ? { name: "Evil Toy Penguin Caller Cookie", hp: cookie!.hp, max: cookie!.max, phase: cookie!.phaseN } : null,
      items: items.map((s) => {
        const d = item(s.def);
        return { uid: s.uid, id: s.def, name: d.name, count: s.count, equipped: s.equipped, kind: d.kind, slot: d.slot, desc: DESCRIPTIONS[s.def] ?? "", dmg: d.damage };
      }),
      crafts: RECIPES.map((r) => {
        const have = r.inputs.every((i) => countOf(items, i.id) >= i.n);
        const can = r.station === "hand" || r.station === stationNear;
        return { id: r.id, name: r.name, out: r.out, ok: have && can, have: recipeHint(r, items), station: r.station, can };
      }),
      station: stationNear,
      hour, night: hour >= 20.5 || hour < 5.5,
      reward, fade, stats: { time: playTime, deaths, kills }, hurtAt, quality, muted: audio.muted,
      slots: mode === "title" || mode === "loading" || !slotCache ? (slotCache = readSlots()) : slotCache, combat: combatT > 0, charge: P.holding ? Math.min(1, P.holdT / 0.35) : 0, slot,
      inDungeon: P.inDungeon, fps: Math.round(fps),
    };
  }
  let slotCache: SlotInfo[] | null = null;
  function push() {
    if (!subs.size) return;
    const s = snapshot();
    for (const f of subs) f(s);
  }

  // ------------------------------------------------------------ saves
  function readSlots(): SlotInfo[] {
    const out: SlotInfo[] = [];
    for (let i = 0; i < 3; i++) {
      try {
        const raw = localStorage.getItem(SAVE(i));
        if (!raw) {
          out.push(null);
          continue;
        }
        const s = JSON.parse(raw) as Save;
        const progress = s.flags.voss ? "Reached the Kingdom" : s.flags.gate ? "The Green Gate is open" : s.flags.cookie ? "Cookie is defeated" : s.flags.entered ? "Inside Cookie's Castle" : s.flags.ember ? "Carries Ember" : s.flags.talked ? "Met Tanic" : "Just woke";
        const reg = s.dungeon ? "Cookie's Castle" : REGION_TITLE[regionAt(s.x, s.z)][0];
        out.push({ slot: i, name: s.name, place: reg, progress, time: s.time });
      } catch {
        out.push(null);
      }
    }
    return out;
  }

  function persist() {
    if (mode === "title" || mode === "create" || mode === "loading" || !world) return;
    const s: Save = {
      v: 2, name, look, x: P.x, z: P.z, yaw: P.yaw, dungeon: P.inDungeon, hp: Math.max(1, P.hp), mana: P.mana, maxMana: P.maxMana,
      items, seals, flags, nodes: Object.fromEntries([...nodeState].map(([k, v]) => [k, v.left])), hour, time: playTime, deaths, kills, seq,
      weightX, deadMobs: [...deadMobs],
    };
    try {
      localStorage.setItem(SAVE(slot), JSON.stringify(s));
    } catch {
      /* storage full or blocked: play on */
    }
  }

  function load(s: Save) {
    name = s.name;
    look = s.look;
    P.x = s.x;
    P.z = s.z;
    P.yaw = s.yaw;
    P.inDungeon = s.dungeon;
    P.hp = s.hp;
    P.mana = s.mana;
    P.maxMana = s.maxMana;
    items = s.items;
    seals = s.seals;
    flags = { ...freshFlags(), ...s.flags };
    nodeState.clear();
    for (const [k, v] of Object.entries(s.nodes ?? {})) nodeState.set(k, { left: v, regrow: 0 });
    hour = s.hour;
    playTime = s.time;
    deaths = s.deaths;
    kills = s.kills;
    seq = s.seq;
    weightX = s.weightX ?? 0;
    deadMobs = new Set(s.deadMobs ?? []);
  }

  // ------------------------------------------------------------ world build (async so the loader can paint)
  const tick = () => new Promise<void>((res) => requestAnimationFrame(() => res()));
  const blockMats = ["A", "B", "C"].map((L, i) => new THREE.MeshLambertMaterial({ map: blockTex(L, ["#8e2f2f", "#b5893a", "#cdbba6"][i]) }));

  async function init() {
    loading = 0.05;
    push();
    await tick();
    const M = makeMaterials();
    loading = 0.15;
    push();
    await tick();
    world = buildOverworld(M, { gate: () => flags.gate || (gateOpening && gateT > 0.8) });
    env.col = world.col;
    scene.add(world.root);
    loading = 0.6;
    push();
    await tick();
    dun = buildDungeon(M, world.col, { slab: () => flags.slab, nursery: () => flags.nursery, exit: () => flags.cookie });
    scene.add(dun.root);
    const glows = buildGlows([...world.glows, ...dun.glows], pxScale, glowI);
    scene.add(glows.points);
    glowTime = glows.time;
    loading = 0.75;
    push();
    await tick();
    for (const d of NPCS) npcs.push(new Npc(d, world.root));
    for (const d of VOSS_NPCS) npcs.push(new Npc(d, world.root));
    cookie = new Cookie(env, dun.root, blockMats, dun.musicLid);
    spawnMobs();
    buildPlayer();
    loading = 0.9;
    push();
    await tick();
    // warm the GPU: compile everything once from the title view
    renderer.compile(scene, camera);
    loading = 1;
    mode = "title";
    titleCam();
    push();
  }
  let glowTime: { value: number } = { value: 0 };

  const MOB_SPAWNS: [string, MobKind, number, number, boolean][] = [
    ["w1", "wolf", 14, 58, false], ["w2", "wolf", -18, 62, false], ["w3", "wolf", 16, 82, false], ["w4", "wolf", 21, 86, false], ["w5", "wolf", 22, 79, false],
    ["w6", "wolf", 30, 128, false], ["w7", "wolf", -36, 136, false],
    ["g1", "goblin", -39, 93, false], ["g2", "goblin", -46, 99, false], ["g3", "goblin", -37, 100, false], ["g4", "redcap", -43, 96, false],
    ["d1", "deer", 34, 100, false], ["d2", "deer", 37, 104, false], ["d3", "deer", -34, 124, false], ["d4", "deer", 46, 72, false], ["d5", "deer", 130, 30, false],
    ["s1", "soldier", -5, 150, false], ["s2", "soldier", 6, 154, false],
    ["dm1", "mouse", DUN_X - 4, 10, true], ["dm2", "mouse", DUN_X + 4, 12, true],
    ["ds1", "soldier", DUN_X - 4, 50, true], ["ds2", "soldier", DUN_X + 4, 52, true], ["dm3", "mouse", DUN_X, 46, true],
    ["ds3", "soldier", DUN_X - 3, 66, true], ["ds4", "soldier", DUN_X + 3, 76, true], ["dh", "horse", DUN_X, 72, true],
  ];
  const mobKey = new Map<Mob, string>();

  function spawnMobs() {
    for (const m of mobs) m.remove();
    mobs.length = 0;
    mobKey.clear();
    for (const [key, kind, x, z, d] of MOB_SPAWNS) {
      const m = new Mob(kind, x, z, d, env, !d && kind !== "soldier");
      mobs.push(m);
      mobKey.set(m, key);
      if (deadMobs.has(key)) {
        m.alive = false;
        m.state = "dead";
        m.deadT = 10;
        m.respawnT = Infinity;
        m.rig.group.visible = false;
      }
    }
  }

  // ------------------------------------------------------------ interactions
  const interacts: Interact[] = [];
  function buildInteracts() {
    interacts.length = 0;
    if (!world || !dun) return;
    const a = world.anchors;
    const d = dun.anchors;
    for (const n of world.nodes) {
      interacts.push({
        x: n.x, z: n.z, r: 2.2, dungeon: false,
        label: () => (nodeLeft(n) > 0 ? "Gather " + item(n.item).name : null),
        act: () => gather(n),
      });
    }
    for (const npc of npcs) {
      interacts.push({
        x: 0, z: 0, r: 2.4, dungeon: false,
        label: () => (npc.rig.group.visible ? "Talk · " + npc.def.name : null),
        act: () => talkTo(npc),
      });
      (interacts[interacts.length - 1] as Interact & { npc?: Npc }).npc = npc;
    }
    interacts.push({ x: a.bench.x, z: a.bench.z, r: 2.6, dungeon: false, label: () => "Workbench", act: () => openBag() });
    interacts.push({ x: a.forge.x, z: a.forge.z, r: 2.8, dungeon: false, label: () => "Mara's Forge", act: () => openBag() });
    interacts.push({
      x: a.bed.x, z: a.bed.z, r: 2.0, dungeon: false, label: () => "Rest (your bedroll)",
      act: () => fadeThen(() => {
        if (hour > 18 || hour < 6) hour = 6.6;
        else hour += 2;
        P.hp = P.maxHp;
        P.stam = P.maxStam;
        P.mana = P.maxMana;
        respawnShrine = false;
        say("You rest. Mended.");
        persist();
      }),
    });
    interacts.push({
      x: a.chest.x, z: a.chest.z, r: 1.8, dungeon: false, label: () => (flags.chest ? null : "Open your chest"),
      act: () => {
        flags.chest = true;
        loot([["cons_bandage", 2], ["mat_fibre", 2], ["mat_wood", 1]]);
        audio.pickup();
      },
    });
    interacts.push({
      x: a.hollow.x, z: a.hollow.z, r: 2.0, dungeon: false, label: () => (flags.hollow ? null : "Search the hollow"),
      act: () => {
        flags.hollow = true;
        loot([["mat_copper", 3], ["mat_leather", 1], ["cons_bandage", 1]]);
        say("Someone hid this in the giant's roots.");
        audio.pickup();
      },
    });
    interacts.push({
      x: a.shrine.x, z: a.shrine.z, r: 2.6, dungeon: false, label: () => "Rest at the shrine",
      act: () => {
        flags.shrine = true;
        respawnShrine = true;
        P.hp = P.maxHp;
        P.mana = P.maxMana;
        sparks.burst(30, a.shrine.x, world!.groundAt(a.shrine.x, a.shrine.z) + 1.2, a.shrine.z, 2, 0xffd28a, 1.2, 0.2, { up: 1.5, grav: -0.5 });
        audio.bell(0.12, 523);
        openTalkLines("Ruined shrine", "Giant Forest", MORE_LINES.shrine);
        persist();
      },
    });
    interacts.push({
      x: a.bell.x, z: a.bell.z, r: 2.6, dungeon: false, label: () => "Ring the bell",
      act: () => {
        ringT = 3;
        audio.bell(0.3, 330);
      },
    });
    interacts.push({
      x: a.well.x, z: a.well.z, r: 2.0, dungeon: false, label: () => "Drink from the well",
      act: () => {
        const h = Math.min(P.maxHp - P.hp, 15);
        P.hp += h;
        say(h > 0 ? "Cold water. +" + Math.round(h) : "Cold water.");
      },
    });
    interacts.push({
      x: a.castleDoor.x, z: a.castleDoor.z, r: 3.2, dungeon: false, label: () => "Enter Cookie's Castle",
      act: () => {
        if (!hasEdge()) {
          openTalkLines("", "", MORE_LINES.noEdge);
          return;
        }
        fadeThen(() => enterDungeon());
      },
    });
    interacts.push({
      x: a.gate.x, z: a.gate.z, r: 4.5, dungeon: false, label: () => (flags.gate || gateOpening ? null : "The Green Gate"),
      act: () => {
        if (gateOpen(seals)) startGate();
        else {
          openTalkLines("The Green Gate", "A March-Seal", MORE_LINES.gateShut);
          world!.gate.sealMat.uniforms.uTime.value += 3;
        }
      },
    });
    // dungeon
    interacts.push({ x: d.entry.x, z: d.entry.z - 1.6, r: 2.4, dungeon: true, label: () => "Leave the castle", act: () => fadeThen(() => leaveDungeon()) });
    interacts.push({
      x: 0, z: 0, r: 2.6, dungeon: true, label: () => (flags.slab ? null : "Heave the weight"),
      act: () => {
        weightX = Math.min(9, weightX + 1.6);
        audio.thud();
        dust.burst(10, dun!.weight.position.x, 0.2, 44, 2, 0x8a7a68, 0.6, 0.2, { up: 1 });
        say(weightX >= 9 ? "" : "The weight grinds along its rails.");
      },
    });
    (interacts[interacts.length - 1] as Interact & { weight?: boolean }).weight = true;
    interacts.push({
      x: d.nurseryDoor.x, z: d.nurseryDoor.z, r: 2.8, dungeon: true, label: () => (flags.nursery ? null : "Painted door"),
      act: () => {
        const horse = mobs.find((m) => m.kind === "horse");
        if (horse && horse.alive) openTalkLines("", "", MORE_LINES.horseDoor);
        else openNursery();
      },
    });
    interacts.push({
      x: d.exitGate.x, z: d.exitGate.z, r: 3.0, dungeon: true, label: () => (flags.cookie && bossDoneT < 0 && mode === "play" ? "Out to the hill" : null),
      act: () => fadeThen(() => leaveDungeon()),
    });
  }

  function nearestInteract() {
    prompt = "";
    promptAct = null;
    let best = 1e9;
    for (const it of interacts) {
      if (it.dungeon !== P.inDungeon) continue;
      let x = it.x;
      let z = it.z;
      const npc = (it as Interact & { npc?: Npc }).npc;
      if (npc) {
        x = npc.x;
        z = npc.z;
      }
      if ((it as Interact & { weight?: boolean }).weight && dun) {
        x = dun.weight.position.x;
        z = dun.weight.position.z;
      }
      const d = Math.hypot(x - P.x, z - P.z);
      if (d > it.r) continue;
      const ang = Math.atan2(x - P.x, z - P.z);
      const front = Math.abs(Math.atan2(Math.sin(ang - P.yaw), Math.cos(ang - P.yaw)));
      const score = d + front * 0.6;
      if (score >= best) continue;
      const label = it.label();
      if (!label) continue;
      best = score;
      prompt = label;
      promptAct = it.act;
    }
    stationNear = "hand";
    if (world && !P.inDungeon) {
      if (Math.hypot(world.anchors.bench.x - P.x, world.anchors.bench.z - P.z) < 3.4) stationNear = "bench";
      if (Math.hypot(world.anchors.forge.x - P.x, world.anchors.forge.z - P.z) < 3.6) stationNear = "forge";
    }
  }

  function loot(list: [string, number][]) {
    for (const [id, n] of list) {
      items = addItem(items, id, n, uid);
      floater(`+${n} ${item(id).name}`, P.x, P.y + 2.1, P.z, "heal");
    }
    push();
  }

  function gather(n: NodeDef) {
    if (P.action !== "none" && P.action !== "gather") return;
    const tier = n.tier >= 2 ? toolTier() : 9;
    const why = canMine(n.tier, n.seal, tier, seals);
    if (why) {
      audio.block();
      if (why === "sealed") openTalkLines("", "", ["The vein rings too green. A seal still holds this iron. Something must answer for it first."]);
      else say(n.tier >= 4 ? "Iron. No pick you own will bite it." : "Copper wants a pick. Craft a Stone Pick at the workbench.");
      return;
    }
    P.yaw = Math.atan2(n.x - P.x, n.z - P.z);
    startAction("gather", 0.62, 0.45);
    pendingGather = n;
  }
  let pendingGather: NodeDef | null = null;

  function finishGather(n: NodeDef) {
    const st = nodeState.get(n.id) ?? { left: n.max, regrow: 0 };
    if (st.left <= 0) return;
    st.left -= 1;
    st.regrow = 75;
    nodeState.set(n.id, st);
    items = addItem(items, n.item, 1, uid);
    audio.gather(n.item);
    const col = n.kind === "wood" ? 0x8a6a48 : n.kind === "fibre" ? 0x9aa05a : n.kind === "copper" ? 0xc07a42 : n.kind === "iron" ? 0x8a9098 : 0x9a948a;
    dust.burst(12, n.x, n.y + 0.5, n.z, 3, col, 0.7, 0.16, { up: 2, grav: 8 });
    if (n.kind !== "wood" && n.kind !== "fibre") sparks.burst(6, n.x, n.y + 0.5, n.z, 4, 0xffe0b0, 0.3, 0.12, { up: 2 });
    n.mesh.scale.setScalar(0.92);
    floater(`+1 ${item(n.item).name}`, n.x, n.y + 1.4, n.z, "heal");
    if (st.left <= 0) say(item(n.item).name + " · the node is spent for now");
    if (!hasEdge() && countOf(items, "mat_flint") >= 2 && countOf(items, "mat_wood") >= 1) say("Enough for a knife. Open the bag → Craft.");
    push();
  }

  // ------------------------------------------------------------ talking
  function openTalkLines(nm: string, role: string, lines: string[], end?: () => void, trades = false) {
    talkQueue = [...lines];
    talk = { name: nm, role, text: talkQueue.shift() ?? "", more: talkQueue.length > 0, trades: trades ? tradeList() : [] };
    talkTrades = trades;
    onTalkEnd = end ?? null;
    mode = "talk";
    audio.ui();
    push();
  }
  function tradeList() {
    return TRADES.map((t) => ({ id: t.id, label: t.label, ok: t.give.every((g) => countOf(items, g.id) >= g.n) }));
  }
  function advanceTalk() {
    if (!talk) return;
    if (talkQueue.length) {
      talk = { ...talk, text: talkQueue.shift()!, more: talkQueue.length > 0, trades: talkTrades && !talkQueue.length ? tradeList() : [] };
      audio.ui();
      push();
      return;
    }
    talk = null;
    if (talkNpc) talkNpc.talkT = 0.5;
    talkNpc = null;
    mode = "play";
    const cb = onTalkEnd;
    onTalkEnd = null;
    cb?.();
    push();
  }

  function talkTo(npc: Npc) {
    talkNpc = npc;
    npc.talkT = 999;
    const id = npc.def.id;
    const L = MORE_LINES;
    const pick = (a: string[]) => [a[Math.floor(Math.random() * a.length)]];
    let lines: string[];
    let end: (() => void) | undefined;
    let trades = false;
    if (id === "tanic") {
      if (!flags.talked) {
        lines = L.tanicHello;
        end = () => {
          flags.talked = true;
          audio.quest();
          say("New task: gather flint and wood");
          persist();
        };
      } else if (hasEdge() && !flags.ember) {
        lines = [...L.tanicKnife, "Tanic presses a warm coal into your palm. Ember. It spends a little breath, and it burns what is made of cloth and wax.", ...L.tanicAfter];
        end = () => {
          flags.ember = true;
          P.maxMana = 30;
          P.mana = 30;
          audio.reward();
          say("Learned Ember · tap the flame button");
          persist();
        };
      } else if (flags.cookie) lines = L.tanicCookie;
      else if (flags.ember) lines = L.tanicAfter;
      else lines = [L.tanicHello[2]];
    } else if (id === "mara") lines = pick(L.mara);
    else if (id === "penn") lines = pick(L.penn);
    else if (id === "bramble") lines = pick(L.bramble);
    else if (id === "sera") lines = L.sera;
    else if (id === "corrin") {
      lines = pick(L.corrin);
      trades = true;
    } else if (id.startsWith("child")) lines = flags.cookie ? L.childAfter : L.child;
    else if (id === "voss") {
      lines = flags.gate ? [L.voss[1]] : [L.voss[0]];
      if (flags.gate)
        end = () => {
          if (!flags.voss) {
            flags.voss = true;
            persist();
          }
          if (!flags.ended) {
            flags.ended = true;
            mode = "end";
            audio.reward();
            persist();
            push();
          }
        };
    } else if (id.startsWith("guard")) lines = pick(L.guard);
    else lines = pick(L.villager);
    openTalkLines(npc.def.name, npc.def.role, lines, end, trades);
  }

  // ------------------------------------------------------------ transitions
  function fadeThen(cb: () => void) {
    fadeTarget = 1;
    fadeCb = cb;
  }

  function setZone(inDungeon: boolean) {
    P.inDungeon = inDungeon;
    world!.root.visible = !inDungeon;
    dun!.root.visible = inDungeon;
    if (playerRig) (inDungeon ? dun!.root : world!.root).add(playerRig.group);
    for (const p of bolts) p.life = 0;
  }

  function enterDungeon() {
    setZone(true);
    P.x = dun!.anchors.entry.x;
    P.z = dun!.anchors.entry.z;
    P.yaw = 0;
    camYaw = 0;
    snapCam();
    if (!flags.entered) {
      flags.entered = true;
      audio.quest();
    }
    persist();
  }
  function leaveDungeon() {
    setZone(false);
    const a = world!.anchors.castleDoor;
    P.x = a.x;
    P.z = a.z - 2.5;
    P.yaw = Math.PI;
    camYaw = Math.PI;
    if (cookie && cookie.fighting) cookie.reset();
    snapCam();
    if (flags.cookie) say("The toys are still. The box has nothing left to call.");
    persist();
  }
  function openNursery() {
    flags.nursery = true;
    audio.thud();
    say("The painted door swings in. A music box is playing.");
    persist();
  }

  function startGate() {
    if (gateOpening || flags.gate) return;
    gateOpening = true;
    gateT = 0;
    audio.gate();
    say("The Green Gate answers the Core.");
    shake = 0.3;
  }

  // ------------------------------------------------------------ combat
  function startAction(a: HumanAction, dur: number, hitAt: number) {
    P.action = a;
    P.at = 0;
    P.dur = dur;
    P.hitAt = hitAt;
    P.hitDone = false;
  }

  function findTarget(range = 4.8): { x: number; z: number; r: number; y: number } | null {
    let best: { x: number; z: number; r: number; y: number } | null = null;
    let bs = 1e9;
    const fx = Math.hypot(P.vx, P.vz) > 0.5 ? Math.atan2(P.vx, P.vz) : P.yaw;
    const consider = (x: number, z: number, r: number, y: number) => {
      const d = Math.hypot(x - P.x, z - P.z);
      if (d > range + r) return;
      const ang = Math.abs(Math.atan2(Math.sin(Math.atan2(x - P.x, z - P.z) - fx), Math.cos(Math.atan2(x - P.x, z - P.z) - fx)));
      if (ang > 1.9) return;
      const sc = d + ang * 1.5;
      if (sc < bs) {
        bs = sc;
        best = { x, z, r, y };
      }
    };
    for (const m of mobs) if (m.alive && m.dungeon === P.inDungeon && m.kind !== "deer") consider(m.x, m.z, m.cfg.radius, m.y);
    if (cookie && P.inDungeon && cookie.fighting) {
      consider(cookie.x, cookie.z, 1.1, cookie.y);
      for (const m of cookie.toys) if (m.alive) consider(m.x, m.z, m.cfg.radius, m.y);
    }
    return best;
  }

  function softLock(range = 4.8) {
    const t = findTarget(range);
    if (t) P.yaw = Math.atan2(t.x - P.x, t.z - P.z);
  }

  let lockDecal: ReturnType<DecalPool["get"]> | null = null;
  function updateLockRing() {
    if (!lockDecal) lockDecal = decals.get();
    const t = mode === "play" && combatT > 0 ? findTarget(4.8) : null;
    if (!t) {
      lockDecal.hide();
      return;
    }
    lockDecal.show(0, t.x, t.y, t.z, 0, t.r + 0.45, 0, { color: 0xffd27a, alpha: 0.55 });
  }

  function attack(heavy: boolean) {
    if (mode !== "play" || P.dead) return;
    const w = mainWeapon();
    const cost = Math.round((heavy ? w.stamHeavy * 1.3 : w.stamLight * 1.4) + 2);
    if (P.action !== "none" && P.action !== "charge") {
      if (P.action.startsWith("light") && P.at > P.dur * 0.45) P.queued = true;
      return;
    }
    if (P.stam < cost * 0.5) {
      say("Out of breath");
      return;
    }
    P.stam = Math.max(0, P.stam - cost);
    P.stamT = 0.7;
    softLock();
    if (heavy) {
      startAction("heavy", 0.62, 0.3);
      P.combo = 0;
    } else {
      P.combo = P.comboT > 0 ? (P.combo % 3) + 1 : 1;
      const a: HumanAction = P.combo === 1 ? "light1" : P.combo === 2 ? "light2" : "light3";
      startAction(a, P.combo === 3 ? 0.5 : 0.38, P.combo === 3 ? 0.42 : 0.36);
    }
    audio.swing(heavy);
  }

  function resolveSwing() {
    const w = mainWeapon();
    const heavy = P.action === "heavy";
    const reach = w.range + (heavy ? 0.9 : 0.7);
    const arc = heavy ? 1.7 : 1.2;
    const fx = Math.sin(P.yaw);
    const fz = Math.cos(P.yaw);
    const ax = P.x + fx * 0.5;
    const az = P.z + fz * 0.5;
    let hits = 0;
    const chain = P.action === "light3" ? 1.2 : 1;
    const dmgBase = strikeDamage({ weapon: w, heavy, skillRank: 0, weakness: false, blocking: false, shield: false, defence: 0 });
    const tryHit = (x: number, z: number, r: number, hit: (dmg: number) => number) => {
      const dx = x - P.x;
      const dz = z - P.z;
      const d = Math.hypot(dx, dz);
      if (d > reach + r) return;
      const ang = Math.abs(Math.atan2(Math.sin(Math.atan2(dx, dz) - P.yaw), Math.cos(Math.atan2(dx, dz) - P.yaw)));
      if (ang > arc && d > r + 0.4) return;
      const dmg = Math.max(1, Math.round(dmgBase * chain * (0.92 + Math.random() * 0.16)));
      const dealt = hit(dmg);
      if (dealt <= 0) return;
      hits++;
      const hx = P.x + (dx / (d || 1)) * Math.min(d, 1.2);
      const hz = P.z + (dz / (d || 1)) * Math.min(d, 1.2);
      sparks.burst(heavy ? 14 : 8, hx, P.y + 1.2, hz, heavy ? 6 : 4, 0xffe6b8, 0.35, 0.16, { up: 1, grav: 6 });
      floater(String(dealt), x, P.y + 2.0, z, heavy || chain > 1 ? "crit" : "dmg");
    };
    for (const m of mobs) if (m.alive && m.dungeon === P.inDungeon) tryHit(m.x, m.z, m.cfg.radius, (d) => onMobHit(m, d, heavy));
    if (cookie && P.inDungeon) {
      if (cookie.fighting) tryHit(cookie.x, cookie.z, 1.1, (d) => cookie!.takeHit(d, P.x, P.z, heavy, false));
      for (const m of cookie.toys) if (m.alive) tryHit(m.x, m.z, m.cfg.radius, (d) => onMobHit(m, d, heavy));
    }
    flashes.arc(ax, P.y + 1.15, az, P.yaw, reach * 0.8, P.action === "light3" || heavy, w.id === "wpn_cookie_blade" ? 0xffb0a0 : 0xffe6b8, P.action === "light2");
    if (hits) {
      audio.hit(heavy);
      hitStop = heavy ? 0.09 : 0.055;
      shake = Math.max(shake, heavy ? 0.22 : 0.1);
      combatT = 3;
    }
  }

  function onMobHit(m: Mob, dmg: number, heavy: boolean, fire = false) {
    const dealt = m.takeHit(dmg, P.x, P.z, heavy, fire);
    if (!m.alive) {
      kills++;
      const key = mobKey.get(m);
      if (key && m.dungeon) deadMobs.add(key);
      const drops: [string, number][] = [];
      for (const [id, n, ch] of m.cfg.loot) if (Math.random() < ch) drops.push([id, n]);
      if (drops.length) loot(drops);
      if (m.kind === "horse") {
        say("The rocking horse is still. The painted door is free.");
        audio.quest();
      }
      persist();
    }
    return dealt;
  }

  function castEmber() {
    if (mode !== "play" || P.dead || !flags.ember) return;
    if (P.action !== "none") return;
    if (P.mana < 8) {
      say("No breath for Ember");
      return;
    }
    if (P.emberCd > 0) return;
    P.mana -= 8;
    P.emberCd = 0.6;
    softLock(14);
    startAction("cast", 0.5, 0.3);
    audio.ember();
  }

  function launchBolt() {
    const fx = Math.sin(P.yaw);
    const fz = Math.cos(P.yaw);
    bolts.push({ x: P.x + fx * 0.8, y: P.y + 1.3, z: P.z + fz * 0.8, vx: fx * 19, vz: fz * 19, life: 0.9, dungeon: P.inDungeon });
  }

  function updateBolts(dt: number) {
    while (boltMeshes.length < bolts.length) {
      const m = new THREE.Mesh(boltGeo, boltMat);
      scene.add(m);
      boltMeshes.push(m);
    }
    for (let i = bolts.length - 1; i >= 0; i--) {
      const b = bolts[i];
      b.life -= dt;
      b.x += b.vx * dt;
      b.z += b.vz * dt;
      sparks.emit({ x: b.x, y: b.y, z: b.z, vx: (Math.random() - 0.5), vy: Math.random(), vz: (Math.random() - 0.5), life: 0.35, size: 0.35, color: Math.random() < 0.5 ? 0xff7a2a : 0xffc060, grav: -1 });
      let hit = false;
      const boom = () => {
        hit = true;
        sparks.burst(24, b.x, b.y, b.z, 5, 0xff8a30, 0.5, 0.3, { up: 1, grav: 2 });
        audio.burn();
      };
      const fireDmg = 14;
      for (const m of mobs)
        if (!hit && m.alive && m.dungeon === b.dungeon && Math.hypot(m.x - b.x, m.z - b.z) < m.cfg.radius + 0.5) {
          const d = onMobHit(m, fireDmg, false, true);
          floater(d + " fire", m.x, m.y + 1.8, m.z, "fire");
          boom();
        }
      if (!hit && cookie && b.dungeon) {
        if (cookie.fighting && Math.hypot(cookie.x - b.x, cookie.z - b.z) < 1.4) {
          const d = cookie.takeHit(fireDmg, P.x, P.z, false, true);
          if (d) floater(d + " fire", cookie.x, cookie.y + 2.8, cookie.z, "fire");
          boom();
        }
        for (const m of cookie.toys)
          if (!hit && m.alive && Math.hypot(m.x - b.x, m.z - b.z) < m.cfg.radius + 0.5) {
            const d = onMobHit(m, fireDmg, false, true);
            floater(d + " fire", m.x, m.y + 1.6, m.z, "fire");
            boom();
          }
      }
      if (!hit && env.col.hit(b.x, b.z, 0)) boom();
      if (hit || b.life <= 0) bolts.splice(i, 1);
    }
    boltMeshes.forEach((m, i) => {
      const b = bolts[i];
      m.visible = !!b;
      if (b) m.position.set(b.x, b.y, b.z);
    });
  }

  function hurtPlayer(dmg: number, sx: number, sz: number, o: HurtOpts = {}) {
    if (P.dead || mode !== "play") return false;
    if (P.iframe > 0) {
      if (P.action === "dodge") floater("Dodged", P.x, P.y + 2.0, P.z, "info");
      return false;
    }
    let d = dmg;
    const ang = Math.atan2(sx - P.x, sz - P.z);
    const facing = Math.abs(Math.atan2(Math.sin(ang - P.yaw), Math.cos(ang - P.yaw))) < 1.75;
    if (P.blocking && facing && !o.unblockable) {
      if (P.blockT < 0.22 && o.parryable && o.source) {
        o.source.stagger(1.3);
        audio.parry();
        sparks.burst(20, P.x + Math.sin(P.yaw) * 0.7, P.y + 1.3, P.z + Math.cos(P.yaw) * 0.7, 6, 0xfff0c0, 0.4, 0.2, { up: 1 });
        floater("Parried!", P.x, P.y + 2.2, P.z, "crit");
        hitStop = 0.12;
        shake = 0.15;
        return false;
      }
      d = Math.round(d * (P.shield ? 0.3 : 0.6));
      P.stam -= dmg * (P.shield ? 0.9 : 1.3);
      P.stamT = 0.8;
      audio.block();
      sparks.burst(8, P.x + Math.sin(P.yaw) * 0.6, P.y + 1.2, P.z + Math.cos(P.yaw) * 0.6, 3, 0xffe0b0, 0.3, 0.15);
      if (P.stam <= 0) {
        P.stam = 0;
        P.blocking = false;
        d = dmg;
        say("Guard broken");
      }
    }
    P.hp -= d;
    hurtAt = performance.now();
    combatT = 4;
    P.regenT = 6;
    floater(String(d), P.x, P.y + 2.0, P.z, "dmg");
    audio.hurt();
    shake = Math.max(shake, 0.18 + d * 0.01);
    const dx = P.x - sx;
    const dz = P.z - sz;
    const l = Math.hypot(dx, dz) || 1;
    const k = o.knock ?? 1;
    P.kx += (dx / l) * k * 4;
    P.kz += (dz / l) * k * 4;
    if (P.action === "none" || P.action === "charge" || P.action === "gather") {
      startAction("hurt", 0.35, 2);
      P.holding = false;
    }
    if (P.hp <= 0) die();
    push();
    return true;
  }

  function die() {
    P.hp = 0;
    P.dead = true;
    P.deadT = 0;
    deaths++;
    startAction("dead", 99, 99);
    mode = "dead";
    audio.death();
    for (const m of mobs) {
      m.aggro = false;
      if (m.state !== "dead") m.state = "return";
    }
    push();
  }

  function wake() {
    if (!world || !dun) return;
    fadeThen(() => {
      P.dead = false;
      P.hp = P.maxHp;
      P.stam = P.maxStam;
      P.mana = P.maxMana;
      P.action = "none";
      P.kx = P.kz = 0;
      if (cookie && cookie.fighting) cookie.reset();
      if (P.inDungeon) setZone(false);
      const atDoor = flags.entered && !flags.cookie;
      const at = atDoor ? world!.anchors.castleDoor : respawnShrine && flags.shrine ? world!.anchors.shrine : world!.anchors.bed;
      P.x = at.x;
      P.z = at.z + (atDoor ? -3 : respawnShrine ? 1.2 : 0.6);
      P.yaw = atDoor ? 0 : respawnShrine ? Math.PI : 0.4;
      camYaw = P.yaw;
      snapCam();
      mode = "play";
      say(atDoor ? "You wake at the castle door. The music box is still playing." : respawnShrine ? "You wake at the shrine." : "Hearthfen. Still breathing.");
      persist();
    });
  }

  // ------------------------------------------------------------ inventory
  function openBag() {
    if (mode !== "play") return;
    mode = "bag";
    audio.ui();
    push();
  }

  function doCraft(id: string) {
    const r = RECIPES.find((x) => x.id === id);
    if (!r) return;
    const res = tryCraft(items, id, stationNear, uid);
    if (!res.ok) {
      say(res.reason === "station" ? (r.station === "forge" ? "That needs Mara's forge." : "That needs the workbench.") : "Missing materials.");
      audio.block();
      return;
    }
    items = res.items;
    const made = res.made ? item(res.made) : null;
    if (made && made.slot !== "none" && made.id !== "wpn_stone_pick" && made.id !== "wpn_copper_pick") {
      const s = items.find((x) => x.def === made.id);
      if (s) items = equip(items, s.uid);
    }
    syncGear();
    audio.craft();
    say((made?.name ?? "Item") + " crafted" + (made?.slot === "main" ? " and equipped" : ""));
    if (made?.id === "wpn_stone_knife") {
      audio.quest();
      setTimeout(() => say("Show Tanic your knife."), 1800);
    }
    persist();
    push();
  }

  function doTrade(id: string) {
    const t = TRADES.find((x) => x.id === id);
    if (!t) return;
    let next: Stack[] | null = items;
    for (const g of t.give) {
      next = next ? consume(next, g.id, g.n) : null;
    }
    if (!next) {
      say("You don't have enough.");
      audio.block();
      return;
    }
    items = addItem(next, t.get.id, t.get.n, uid);
    audio.pickup();
    say(`Traded for ${t.get.n} ${item(t.get.id).name}`);
    if (talk) talk = { ...talk, trades: tradeList() };
    persist();
    push();
  }

  function useItem(id: string) {
    const s = items.find((x) => x.uid === id);
    if (!s) return;
    const d = item(s.def);
    if (d.kind === "consumable" && d.heal > 0) {
      if (P.hp >= P.maxHp) {
        say("Already whole.");
        return;
      }
      const next = consume(items, d.id, 1);
      if (!next) return;
      items = next;
      P.hp = Math.min(P.maxHp, P.hp + d.heal);
      floater("+" + d.heal, P.x, P.y + 2, P.z, "heal");
      audio.pickup();
      say("Bandaged. +" + d.heal);
    } else if (d.slot !== "none") {
      items = equip(items, id);
      syncGear();
      audio.ui();
    }
    persist();
    push();
  }

  function quickHeal() {
    const s = items.find((x) => x.def === "cons_bandage");
    if (s) useItem(s.uid);
    else say("No bandages. Craft them from fibre.");
  }

  // ------------------------------------------------------------ camera
  function titleCam() {
    camPos.set(-22, 9, -34);
    camera.position.copy(camPos);
    camera.lookAt(0, 4, 10);
  }
  function snapCam() {
    const tx = P.x;
    const tz = P.z;
    camPos.set(tx - Math.sin(camYaw) * camDist, P.y + 3, tz - Math.cos(camYaw) * camDist);
    camera.position.copy(camPos);
  }

  function updateCamera(dt: number, rdt: number) {
    if (!world) return;
    if (mode === "title") {
      const t = performance.now() / 1000;
      const a = t * 0.04 + 2.2;
      camPos.set(Math.cos(a) * 30, 10 + Math.sin(t * 0.1) * 2, Math.sin(a) * 30 - 4);
      camera.position.lerp(camPos, 1 - Math.exp(-rdt * 2));
      camera.lookAt(0, 3.5, 4);
      return;
    }
    if (mode === "create") {
      const yaw = P.yaw;
      const fx = Math.sin(yaw);
      const fz = Math.cos(yaw);
      // stand in front of the character; aim a little to its right so it sits right of the panel
      camPos.set(P.x + fx * 3.1, P.y + 1.45, P.z + fz * 3.1);
      camera.position.copy(camPos);
      camera.lookAt(P.x - fz * 1.0, P.y + 1.0, P.z + fx * 1.0);
      return;
    }
    const portrait = canvas.clientHeight > canvas.clientWidth;
    const bossOn = cookie && cookie.fighting && P.inDungeon;
    camDist += ((portrait ? 7.2 : bossOn ? 7.4 : P.inDungeon ? 5.4 : 5.8) - camDist) * Math.min(1, rdt * 2);
    lookT += rdt;
    const moving = Math.hypot(P.vx, P.vz) > 0.5;
    if (lookT > 1.6 && moving && P.action === "none") {
      const tgtYaw = Math.atan2(P.vx, P.vz);
      const diff = Math.atan2(Math.sin(tgtYaw - camYaw), Math.cos(tgtYaw - camYaw));
      if (Math.abs(diff) < 2.6) camYaw += diff * Math.min(1, rdt * 0.9);
    }
    if (revealT > 0) {
      revealT -= rdt;
      const ty = Math.atan2(0 - P.x, 186 - P.z);
      const diff = Math.atan2(Math.sin(ty - camYaw), Math.cos(ty - camYaw));
      camYaw += diff * Math.min(1, rdt * 2.5);
      camPitch += (-0.12 - camPitch) * Math.min(1, rdt * 2.5);
      if (revealT <= 0) lookT = 0;
    } else if (lookT > 2.5 && camPitch < 0.22) camPitch += (0.3 - camPitch) * Math.min(1, rdt * 1.2);
    if (bossOn && lookT > 1.2) {
      const by = Math.atan2(cookie!.x - P.x, cookie!.z - P.z);
      const diff = Math.atan2(Math.sin(by - camYaw), Math.cos(by - camYaw));
      if (Math.abs(diff) > 0.45) camYaw += diff * Math.min(1, rdt * 1.6);
    }
    camTgt.set(P.x, P.y + 1.55, P.z);
    const cp = Math.cos(camPitch);
    let dist = camDist;
    const dirX = -Math.sin(camYaw) * cp;
    const dirZ = -Math.cos(camYaw) * cp;
    const dirY = Math.sin(camPitch);
    let lift = 0;
    for (let s = 0.6; s <= camDist; s += 0.3) {
      const x = camTgt.x + dirX * s;
      const z = camTgt.z + dirZ * s;
      if (env.col.hit(x, z, 0.25)) {
        dist = Math.max(2.4, s - 0.35);
        lift = (camDist - dist) * 0.55;
        break;
      }
    }
    const right = { x: -Math.cos(camYaw), z: Math.sin(camYaw) };
    const shoulder = portrait ? 0 : 0.45;
    let x = camTgt.x + dirX * dist + right.x * shoulder;
    let z = camTgt.z + dirZ * dist + right.z * shoulder;
    let y = camTgt.y + dirY * dist + lift;
    const g = world.groundAt(x, z) + 0.5;
    if (y < g) y = g;
    if (P.inDungeon && !(P.z > DUN.galleryZ1 + 6)) y = Math.min(y, 6.6);
    const k = 1 - Math.exp(-rdt * 10);
    camPos.x += (x - camPos.x) * k;
    camPos.y += (y - camPos.y) * k;
    camPos.z += (z - camPos.z) * k;
    camera.position.copy(camPos);
    if (shake > 0) {
      camera.position.x += (Math.random() - 0.5) * shake * 0.6;
      camera.position.y += (Math.random() - 0.5) * shake * 0.6;
      shake = Math.max(0, shake - rdt * 1.6);
    }
    x = camTgt.x + right.x * shoulder * 0.9;
    z = camTgt.z + right.z * shoulder * 0.9;
    camera.lookAt(x, camTgt.y, z);
    void dt;
  }

  // ------------------------------------------------------------ lighting
  const cA = new THREE.Color();
  const cB = new THREE.Color();
  const zen = new THREE.Color();
  const hor = new THREE.Color();
  const fogC = new THREE.Color();
  const sunDir = new THREE.Vector3();
  function lerpHex(a: number, b: number, t: number, out: THREE.Color) {
    return out.copy(cA.setHex(a)).lerp(cB.setHex(b), t);
  }

  function updateLighting(rdt: number) {
    if (!world) return;
    const h = mode === "title" || mode === "create" ? 8.2 : hour;
    let i = 0;
    while (i < TIME_KEYS.length - 2 && TIME_KEYS[i + 1].h <= h) i++;
    const a = TIME_KEYS[i];
    const b = TIME_KEYS[i + 1];
    const t = Math.min(1, Math.max(0, (h - a.h) / (b.h - a.h)));
    const el = THREE.MathUtils.lerp(a.el, b.el, t);
    const dayK = THREE.MathUtils.clamp((el + 4) / 14, 0, 1);
    const azi = ((h - 6) / 14) * Math.PI;
    const elR = THREE.MathUtils.degToRad(Math.max(el, 8));
    if (el > -2) sunDir.set(Math.cos(azi) * Math.cos(elR), Math.sin(elR), -Math.sin(azi) * Math.cos(elR) - 0.25);
    else sunDir.set(-0.3, 0.8, 0.45);
    sunDir.normalize();
    lerpHex(a.sun, b.sun, t, sun.color);
    sun.intensity = THREE.MathUtils.lerp(a.si, b.si, t);
    lerpHex(a.hs, b.hs, t, hemi.color);
    lerpHex(a.hg, b.hg, t, hemi.groundColor);
    hemi.intensity = THREE.MathUtils.lerp(a.hi, b.hi, t);
    lerpHex(a.zen, b.zen, t, zen);
    lerpHex(a.hor, b.hor, t, hor);
    lerpHex(a.fog, b.fog, t, fogC);
    let exposure = THREE.MathUtils.lerp(a.ex, b.ex, t);
    let density = 0.0065;
    const reg = region ?? "hearthfen";
    if (P.inDungeon && mode !== "title") {
      const court = P.z > DUN.galleryZ1 + 4;
      sun.color.setHex(court ? 0xffc890 : 0xffb070);
      sun.intensity = court ? 1.6 : 0.35;
      hemi.color.setHex(0x8a7a6a);
      hemi.groundColor.setHex(0x2a2018);
      hemi.intensity = court ? 0.9 : 0.55;
      zen.setHex(0x3a3050);
      hor.setHex(0xb07a5a);
      fogC.setHex(court ? 0x4a3438 : 0x1e1814);
      density = court ? 0.012 : 0.03;
      exposure = 1.15;
      sunDir.set(0.35, 0.9, -0.25).normalize();
    } else {
      if (reg === "forest" || reg === "castle") {
        density = 0.0105;
        fogC.lerp(cA.setHex(0x8a9068), 0.18 * dayK);
      } else if (reg === "kingdom" || reg === "gate" || reg === "bridge") density = 0.0042;
    }
    const fog = scene.fog as THREE.FogExp2;
    fog.color.lerp(fogC, Math.min(1, rdt * 2));
    fog.density += (density - fog.density) * Math.min(1, rdt * 1.5);
    renderer.toneMappingExposure += (exposure - renderer.toneMappingExposure) * Math.min(1, rdt * 2);
    sky.set({ zenith: zen, horizon: fog.color, sunDir, sunColor: sun.color, night: 1 - dayK, time: performance.now() / 1000, cloud: 0.5 });
    sky.mesh.position.copy(camera.position);
    const fx = mode === "play" || mode === "bag" || mode === "talk" || mode === "dead" || mode === "reward" || mode === "end" ? P.x : camera.position.x;
    const fz = mode === "play" || mode === "bag" || mode === "talk" || mode === "dead" || mode === "reward" || mode === "end" ? P.z : camera.position.z;
    const snap = 68 / (quality === "high" ? 2048 : 1024);
    const sx = Math.round(fx / snap) * snap;
    const sz = Math.round(fz / snap) * snap;
    sun.target.position.set(sx, 0, sz);
    sun.position.set(sx + sunDir.x * 100, sunDir.y * 100, sz + sunDir.z * 100);
    const night = 1 - dayK;
    glowI.value = P.inDungeon ? 1.1 : 0.15 + night * 1.1;
    const wm = world.root.children.find((c) => c.name === "window") as THREE.Mesh | undefined;
    if (wm) (wm.material as THREE.MeshLambertMaterial).emissiveIntensity = 0.15 + night * 1.6;
    for (const s of world.shafts) s.visible = !P.inDungeon && dayK > 0.5 && quality !== "low";
    (world.shafts[0]?.material as THREE.MeshBasicMaterial | undefined)?.opacity !== undefined &&
      ((world.shafts[0].material as THREE.MeshBasicMaterial).opacity = 0.1 * dayK * (reg === "forest" ? 1 : 0.5));
    const bossLit = P.inDungeon && cookie && cookie.active && cookie.st !== "dead";
    stage.intensity += ((bossLit ? 60 : 0) - stage.intensity) * Math.min(1, rdt * 2);
    if (cookie) stage.position.set(cookie.x, cookie.y + 6.5, cookie.z - 1.5);
    // point lights: nearest fires (always) and lamps (at night)
    const cands: { p: THREE.Vector3; fire: boolean }[] = [];
    const list = P.inDungeon ? dun!.fires : world.fires;
    for (const p of list) cands.push({ p, fire: true });
    if (!P.inDungeon && night > 0.3) for (const p of world.lamps) cands.push({ p, fire: false });
    cands.sort((u, v) => u.p.distanceToSquared(camTgt) - v.p.distanceToSquared(camTgt));
    const tnow = performance.now() / 1000;
    lightPool.forEach((l, k) => {
      const c = cands[k];
      if (!c || c.p.distanceTo(camTgt) > 40 || quality === "low" && k > 1) {
        l.intensity = 0;
        return;
      }
      l.position.copy(c.p);
      l.color.setHex(c.fire ? 0xff8a40 : 0xffb060);
      const flick = 0.85 + Math.sin(tnow * 11 + k * 3) * 0.08 + Math.sin(tnow * 23 + k) * 0.06;
      l.intensity = (c.fire ? (P.inDungeon ? 14 : 9 + night * 8) : 10 * night) * flick;
      l.distance = c.fire ? 14 : 12;
    });
  }

  // ------------------------------------------------------------ the frame
  let last = performance.now();
  let raf = 0;
  let frames = 0;
  let frameN = 0;
  let autoT = 0;
  let autoFrames = 0;
  let autoTime = 0;
  let autoDrops = 0;
  let fpsT = 0;
  let smokeT = 0;
  let ambT = 0;
  let cullT = 0;
  let disposed = false;

  function playerUpdate(dt: number) {
    if (!world || !playerRig || !playerPoser) return;
    const t = env.time;
    // input
    let ix = stickX;
    let iy = stickY;
    if (keys.has("KeyW") || keys.has("ArrowUp")) iy += 1;
    if (keys.has("KeyS") || keys.has("ArrowDown")) iy -= 1;
    if (keys.has("KeyD") || keys.has("ArrowRight")) ix += 1;
    if (keys.has("KeyA") || keys.has("ArrowLeft")) ix -= 1;
    const mag = Math.min(1, Math.hypot(ix, iy));
    const playing = mode === "play" && !P.dead;
    const fy = Math.sin(camYaw);
    const fyz = Math.cos(camYaw);
    let wx = fy * iy - fyz * ix;
    let wz = fyz * iy + fy * ix;
    const wl = Math.hypot(wx, wz);
    if (wl > 0.001) {
      wx /= wl;
      wz /= wl;
    }
    if (!playing) {
      wx = wz = 0;
    }
    // timers
    P.iframe = Math.max(0, P.iframe - dt);
    P.comboT = Math.max(0, P.comboT - dt);
    P.emberCd = Math.max(0, P.emberCd - dt);
    P.stamT = Math.max(0, P.stamT - dt);
    P.regenT = Math.max(0, P.regenT - dt);
    if (P.blocking) P.blockT += dt;
    if (P.holding) {
      P.holdT += dt;
      if (P.holdT > 0.25 && P.action === "none" && playing) startAction("charge", 99, 99);
    }
    const inCombat = combatT > 0;
    // action progress
    let canMove = true;
    let speedMul = 1;
    if (P.action !== "none") {
      P.at += dt;
      const k = P.at / P.dur;
      if (P.action === "dodge") {
        canMove = false;
        const sp = 9 * (1 - k * 0.55);
        const nx = P.x + P.dodgeX * sp * dt;
        const nz = P.z + P.dodgeZ * sp * dt;
        if (!world.inRiver(nx, nz)) {
          P.x = nx;
          P.z = nz;
        }
      } else if (P.action === "charge") {
        speedMul = 0.35;
      } else if (P.action === "gather" || P.action === "cast" || P.action === "hurt" || P.action === "dead") {
        canMove = P.action === "cast";
        speedMul = 0.3;
      } else {
        canMove = k > 0.7;
        speedMul = 0.35;
        if (!P.hitDone && P.at >= P.dur * P.hitAt * 0.95) {
          const lunge = P.action === "heavy" ? 2.4 : 1.5;
          P.kx += Math.sin(P.yaw) * lunge;
          P.kz += Math.cos(P.yaw) * lunge;
        }
      }
      if (!P.hitDone && P.at >= P.dur * P.hitAt) {
        P.hitDone = true;
        if (P.action.startsWith("light") || P.action === "heavy") resolveSwing();
        if (P.action === "cast") launchBolt();
        if (P.action === "gather" && pendingGather) {
          finishGather(pendingGather);
          pendingGather = null;
        }
      }
      if (P.action !== "dead" && P.at >= P.dur) {
        const wasLight = P.action.startsWith("light");
        P.action = "none";
        if (wasLight) P.comboT = 0.45;
        if (wasLight && P.queued) {
          P.queued = false;
          attack(false);
        }
      }
    }
    // movement
    const sprintWant = mag > 0.92 || keys.has("ShiftLeft") || keys.has("ShiftRight");
    P.sprint = sprintWant && (!inCombat || P.stam > 5) && P.action === "none" && !P.blocking;
    let target = 0;
    if (playing && canMove && mag > 0.08) {
      target = (P.sprint ? SPEEDS.sprint : SPEEDS.walk * Math.min(1, mag * 1.25)) * speedMul;
      if (P.blocking) target = Math.min(target, 2.0);
      const wet = world.terrain.waterAt(P.x, P.z);
      if (!P.inDungeon && wet > 0.3) target *= 0.7;
    }
    if (P.sprint && inCombat && target > 0) {
      P.stam = Math.max(0, P.stam - 11 * dt);
      P.stamT = 0.4;
    }
    const k = 1 - Math.exp(-dt * (target > 0 ? 10 : 14));
    P.vx += (wx * target - P.vx) * k;
    P.vz += (wz * target - P.vz) * k;
    if (P.action !== "dodge") {
      let nx = P.x + (P.vx + P.kx) * dt;
      let nz = P.z + (P.vz + P.kz) * dt;
      if (world.inRiver(nx, nz)) {
        nx = P.x;
        nz = P.z;
      }
      P.x = nx;
      P.z = nz;
    }
    P.kx *= Math.exp(-dt * 9);
    P.kz *= Math.exp(-dt * 9);
    // the weight in the hall: push it by walking into it
    if (P.inDungeon && dun && !flags.slab) {
      const wp = dun.weight.position;
      if (Math.abs(P.z - wp.z) < 1.3 && P.x < wp.x && P.x > wp.x - 1.6 && P.vx > 0.5) weightX = Math.min(9, weightX + P.vx * dt * 0.5);
    }
    const solved = env.col.resolve(P.x, P.z, 0.42);
    P.x = solved.x;
    P.z = solved.z;
    if (!P.inDungeon) {
      P.x = Math.min(BOUNDS.maxX - 6, Math.max(BOUNDS.minX + 6, P.x));
      P.z = Math.min(BOUNDS.maxZ - 6, Math.max(BOUNDS.minZ + 6, P.z));
    }
    if (P.inDungeon && dun && !flags.slab) {
      const wp = dun.weight.position;
      if (Math.abs(P.z - wp.z) < 1.35 && Math.abs(P.x - wp.x) < 1.35) {
        if (Math.abs(P.x - wp.x) > Math.abs(P.z - wp.z)) P.x = wp.x + Math.sign(P.x - wp.x) * 1.35;
        else P.z = wp.z + Math.sign(P.z - wp.z) * 1.35;
      }
    }
    P.y = world.groundAt(P.x, P.z);
    const sp = Math.hypot(P.vx, P.vz);
    P.speed = sp;
    if (sp > 0.3 && (P.action === "none" || P.action === "charge" || P.action === "cast")) {
      const want = Math.atan2(P.vx, P.vz);
      const diff = Math.atan2(Math.sin(want - P.yaw), Math.cos(want - P.yaw));
      P.yaw += Math.sign(diff) * Math.min(Math.abs(diff), dt * 12);
    }
    // stamina, health, mana
    if (P.stamT <= 0 && !(P.sprint && inCombat)) P.stam = Math.min(P.maxStam, P.stam + (P.blocking ? 10 : 32) * dt);
    if (P.maxMana > 0) P.mana = Math.min(P.maxMana, P.mana + (inCombat ? 1.2 : 3) * dt);
    if (!inCombat && P.regenT <= 0 && P.hp > 0 && P.hp < P.maxHp) P.hp = Math.min(P.maxHp, P.hp + 2 * dt);
    // footsteps
    P.phase += (sp / (P.sprint ? 1.6 : 1.15)) * dt * Math.PI;
    if (sp > 1 && Math.floor(P.phase / Math.PI) !== P.lastStep) {
      P.lastStep = Math.floor(P.phase / Math.PI);
      const surf = P.inDungeon ? (P.z > DUN.doorZ && P.z < DUN.galleryZ1 ? "wood" : "stone") : world.decks.some((d) => P.x >= d.minX && P.x <= d.maxX && P.z >= d.minZ && P.z <= d.maxZ) ? "wood" : world.terrain.pathAt(P.x, P.z) > 0.3 ? "dirt" : "grass";
      audio.step(surf);
      if (P.sprint && !P.inDungeon && Math.random() < 0.5) dust.emit({ x: P.x, y: P.y + 0.1, z: P.z, vx: (Math.random() - 0.5) * 0.6, vy: 0.5, vz: (Math.random() - 0.5) * 0.6, life: 0.7, size: 0.35, grow: 0.4, color: 0x9a8a70, a: 0.35, grav: 0 });
    }
    // pose
    const g = playerRig.group;
    g.position.set(P.x, P.y, P.z);
    g.rotation.y = P.yaw;
    const armed = mainWeapon().id !== "wpn_fists";
    const isPick = mainWeapon().moveset.includes("pick");
    poseHuman(playerPoser, {
      t, move: sp / SPEEDS.walk * (P.sprint ? 1.45 : 1), phase: P.phase,
      action: P.action, at: P.action === "dead" ? P.at : P.at / P.dur, block: P.blocking && P.action === "none", armed: armed || isPick,
    }, dt);
  }

  function worldUpdate(dt: number, rdt: number) {
    if (!world || !dun) return;
    const t = env.time;
    shared.time.value = t;
    glowTime.value = t;
    // nodes regrow
    for (const n of world.nodes) {
      const st = nodeState.get(n.id);
      if (st && st.left < n.max) {
        st.regrow -= dt;
        if (st.regrow <= 0) {
          st.left = n.max;
        }
      }
      const left = st ? st.left : n.max;
      const target = left <= 0 ? 0.35 : 1;
      const s = n.mesh.scale.x + (target - n.mesh.scale.x) * Math.min(1, dt * 6);
      n.mesh.scale.setScalar(s);
    }
    // water and gate
    world.waterMat.normalMap!.offset.y -= dt * 0.08;
    world.waterMat.normalMap!.offset.x += dt * 0.01;
    world.gate.sealMat.uniforms.uTime.value = t;
    if (gateOpening) {
      gateT += dt;
      const k = Math.min(1, gateT / 3.5);
      world.gate.sealMat.uniforms.uOpen.value = k * 1.3;
      world.gate.doorL.rotation.y = -1.35 - k * 0.1;
      world.gate.doorR.rotation.y = 1.35 + k * 0.1;
      if (gateT > 3.6 && !flags.gate) {
        flags.gate = true;
        gateOpening = false;
        audio.quest();
        say("The Green Gate is open. Walk the wheat.");
        persist();
      }
    } else if (flags.gate) {
      world.gate.sealMat.uniforms.uOpen.value = 1.3;
      world.gate.doorL.rotation.y = -1.45;
      world.gate.doorR.rotation.y = 1.45;
    } else {
      world.gate.sealMat.uniforms.uOpen.value = 0;
      world.gate.doorL.rotation.y = -1.35;
      world.gate.doorR.rotation.y = 1.35;
    }
    world.gate.seal.visible = !flags.gate;
    // bell, sails, key, banners, toy blocks
    if (ringT > 0) ringT -= dt;
    world.bell.rotation.x = ringT > 0 ? Math.sin(t * 7) * 0.45 * (ringT / 3) : Math.sin(t * 0.6) * 0.02;
    world.sails.rotation.z += dt * 0.5;
    if (!flags.cookie) world.key.rotation.y += dt * 0.35;
    for (const b of world.banners) b.rotation.y = -Math.PI / 2 + Math.sin(t * 2 + b.position.z) * 0.12;
    if (!flags.cookie && !P.inDungeon) {
      for (const tb of world.toyBlocks) {
        const d = Math.hypot(tb.position.x - P.x, tb.position.z - P.z);
        if (d < 14) tb.rotation.z = 0.15 + Math.sin(t * 9 + tb.position.x) * 0.04 * (1 - d / 14);
      }
    }
    // the dungeon puzzle
    const wp = dun.weight.position;
    const wantX = dun.anchors.weightHome.x + weightX;
    wp.x += (wantX - wp.x) * Math.min(1, dt * 4);
    if (!flags.slab && weightX >= 8.8) {
      flags.slab = true;
      audio.thud();
      shake = 0.3;
      say("The weight settles. The slab grinds up.");
      audio.quest();
      persist();
    }
    dun.slab.position.y += ((flags.slab ? 9.2 : 3.1) - dun.slab.position.y) * Math.min(1, dt * 1.5);
    dun.plate.position.y = flags.slab ? 0.0 : 0.06;
    dun.nurseryDoor.rotation.y += ((flags.nursery ? -1.6 : 0) - dun.nurseryDoor.rotation.y) * Math.min(1, dt * 2);
    dun.exitGate.position.y += ((flags.cookie ? 6.5 : 0) - dun.exitGate.position.y) * Math.min(1, dt * 1.2);
    // marked floor tiles
    if (P.inDungeon && mode === "play") {
      for (const tile of dun.tiles) {
        const on = Math.abs(P.x - tile.x) < 0.7 && Math.abs(P.z - tile.z) < 0.7;
        const st = tile as typeof tile & { arm?: number; cd?: number; decal?: ReturnType<DecalPool["get"]> | null; block?: THREE.Mesh | null };
        st.cd = Math.max(0, (st.cd ?? 0) - dt);
        if (on && !st.arm && !st.cd) {
          st.arm = 0.6;
          st.decal = decals.get();
          audio.clack();
          tile.mesh.position.y = -0.02;
        }
        if (st.arm) {
          st.arm -= dt;
          st.decal?.show(0, tile.x, 0, tile.z, 0, 1.4, 1 - st.arm / 0.6, { color: 0xb04a3a });
          if (st.arm <= 0) {
            st.arm = 0;
            decals.release(st.decal);
            st.decal = null;
            st.cd = 2.5;
            tile.mesh.position.y = 0.02;
            dust.burst(12, tile.x, 0.4, tile.z, 4, 0xd8c8b0, 0.6, 0.25, { up: 1.5 });
            audio.thud();
            flashes.ring(tile.x, 0, tile.z, 1.6, 0xffcf90, 0.35);
            if (Math.abs(P.x - tile.x) < 1.1 && Math.abs(P.z - tile.z) < 1.1) {
              hurtPlayer(12, tile.x, tile.z - 1, { knock: 1.5 });
              say("The floor finished its tell.");
            }
          }
        }
      }
    }
    // arena
    if (cookie) {
      const inArena = P.inDungeon && Math.hypot(P.x - DUN.arena.x, P.z - DUN.arena.z) < DUN.arena.r - 1.5;
      if (mode === "play" && inArena && !flags.cookie && cookie.st === "dormant") {
        cookie.startIntro();
        introSeen = true;
        audio.bell(0.2, 523);
        placeAt = performance.now();
        placeName = "Evil Toy Penguin Caller Cookie";
        placeSub = "It bows. Then the toys stand up.";
      }
      if (mode === "play" || cookie.st === "dying") cookie.update(dt, inArena);
      if (cookie.st === "dead" && !flags.cookie && bossDoneT < 0) {
        bossDoneT = 1.4;
      }
      if (bossDoneT > 0) {
        bossDoneT -= dt;
        if (bossDoneT <= 0) {
          bossDoneT = -1;
          finishCookie();
        }
      }
    }
    // ambience particles
    smokeT -= dt;
    if (smokeT <= 0 && !P.inDungeon) {
      smokeT = 0.18;
      for (const s of world.smoke) {
        if (Math.abs(s.x - P.x) > 90 || Math.abs(s.z - P.z) > 90) continue;
        dust.emit({ x: s.x + (Math.random() - 0.5) * 0.3, y: s.y, z: s.z + (Math.random() - 0.5) * 0.3, vx: 0.3 + Math.random() * 0.2, vy: 1.0 + Math.random() * 0.4, vz: 0.15, life: 4.5, size: 0.9, grow: 3.2, color: 0x9a928a, a: 0.16, drag: 0.2, grav: -0.05 });
      }
    }
    ambT -= dt;
    if (ambT <= 0) {
      ambT = 0.08;
      const fires = P.inDungeon ? dun.fires : world.fires;
      for (const f of fires) {
        if (Math.abs(f.x - P.x) > 40 || Math.abs(f.z - P.z) > 40) continue;
        if (Math.random() < 0.6) sparks.emit({ x: f.x + (Math.random() - 0.5) * 0.4, y: f.y - 0.1, z: f.z + (Math.random() - 0.5) * 0.4, vx: (Math.random() - 0.5) * 0.5, vy: 1.2 + Math.random(), vz: (Math.random() - 0.5) * 0.5, life: 0.9, size: 0.12, color: 0xff9a40, grav: -0.3, drag: 0.5 });
      }
      const reg = region;
      const night = hour >= 20 || hour < 5.5;
      if (!P.inDungeon && (reg === "forest" || reg === "castle")) {
        const a = Math.random() * Math.PI * 2;
        const r = 3 + Math.random() * 14;
        const x = P.x + Math.cos(a) * r;
        const z = P.z + Math.sin(a) * r;
        const y = world.groundAt(x, z);
        if (night) sparks.emit({ x, y: y + 0.6 + Math.random() * 2, z, vx: (Math.random() - 0.5) * 0.4, vy: (Math.random() - 0.5) * 0.3, vz: (Math.random() - 0.5) * 0.4, life: 3, size: 0.14, color: 0xc8e070, grav: 0, drag: 0 });
        else {
          if (Math.random() < 0.5) sparks.emit({ x, y: y + 1 + Math.random() * 4, z, vx: 0.1, vy: 0.05, vz: 0.05, life: 4, size: 0.07, color: 0xffd890, a: 0.6, grav: 0, drag: 0 });
          if (Math.random() < 0.25) dust.emit({ x, y: y + 8 + Math.random() * 6, z, vx: 0.6, vy: -0.6, vz: 0.3, life: 9, size: 0.16, color: Math.random() < 0.5 ? 0x8a8a40 : 0xb08a40, grav: 0.02, drag: 0 });
        }
      } else if (!P.inDungeon && night && reg === "hearthfen" && Math.random() < 0.3) {
        const x = P.x + (Math.random() - 0.5) * 24;
        const z = P.z + (Math.random() - 0.5) * 24;
        sparks.emit({ x, y: world.groundAt(x, z) + 0.6 + Math.random(), z, vx: (Math.random() - 0.5) * 0.4, vy: 0.1, vz: (Math.random() - 0.5) * 0.4, life: 3, size: 0.13, color: 0xc8e070, grav: 0, drag: 0 });
      } else if (P.inDungeon && P.z > DUN.galleryZ1 + 4 && Math.random() < 0.4) {
        sparks.emit({ x: P.x + (Math.random() - 0.5) * 20, y: 1 + Math.random() * 6, z: P.z + (Math.random() - 0.5) * 20, vy: -0.2, life: 4, size: 0.08, color: 0xffd8a0, a: 0.6, grav: 0, drag: 0 });
      }
    }
    // npcs
    const night = hour >= 21 || hour < 5.6;
    for (const n of npcs) {
      const vis = !P.inDungeon && Math.hypot(n.x - camera.position.x, n.z - camera.position.z) < 70;
      n.update(dt, t, night, world.groundAt, (x, z) => world!.col.resolve(x, z, 0.38), P, vis);
    }
    void rdt;
  }

  function finishCookie() {
    flags.cookie = true;
    const g = grantUniques(items, ["wpn_cookie_blade", "wpn_cookie_pick", "key_cookie_core"], uid);
    items = g.items;
    if (!seals.includes("seal_cookie")) seals = [...seals, "seal_cookie"];
    const blade = items.find((s) => s.def === "wpn_cookie_blade");
    if (blade) items = equip(items, blade.uid);
    syncGear();
    for (const m of mobs) if (m.kind === "soldier" && !m.dungeon && m.alive) m.die();
    reward = ["wpn_cookie_blade", "wpn_cookie_pick", "key_cookie_core"].map((id) => ({ id, name: item(id).name, desc: DESCRIPTIONS[id] ?? "" }));
    mode = "reward";
    audio.reward();
    persist();
    push();
  }

  function cull() {
    if (!world) return;
    const d = quality === "low" ? 95 : quality === "medium" ? 150 : 200;
    const gd = quality === "low" ? 0 : quality === "medium" ? 40 : 60;
    for (const s of world.scatters) s.cull(camera.position.x, camera.position.z, Math.min(s.maxDist, d));
    for (const s of world.grass) s.cull(camera.position.x, camera.position.z, gd);
  }

  function frame(now: number) {
    if (disposed) return;
    raf = requestAnimationFrame(frame);
    const real = Math.max(0.001, (now - last) / 1000);
    const rdt = Math.min(0.05, real);
    last = now;
    frames++;
    frameN++;
    fpsT += real;
    if (fpsT > 1) {
      fps = frames / fpsT;
      frames = 0;
      fpsT = 0;
    }
    // keep phones smooth: step graphics down once or twice if play stays under ~24 fps
    if (mode === "play" && !document.hidden && fade === 0) {
      autoT += real;
      if (autoT > 6) {
        autoFrames++;
        autoTime += real;
        if (autoTime > 5) {
          const f = autoFrames / autoTime;
          autoFrames = 0;
          autoTime = 0;
          if (f < 24 && quality !== "low" && autoDrops < 2) {
            autoDrops++;
            autoT = 0;
            api.setQuality(quality === "high" ? "medium" : "low");
            say("Graphics lowered to keep things smooth. Change it in the menu.");
          }
        }
      }
    } else autoT = 0;
    resize();
    let dt = rdt;
    if (hitStop > 0) {
      hitStop -= rdt;
      dt = rdt * 0.08;
    }
    if (cookie && cookie.st === "dying") dt *= 0.55;
    env.time += dt;
    if (fade !== fadeTarget) {
      fade += Math.sign(fadeTarget - fade) * rdt * 3.2;
      if (fade >= 1) {
        fade = 1;
        fadeCb?.();
        fadeCb = null;
        fadeTarget = 0;
      }
      if (fade <= 0 && fadeTarget === 0) fade = 0;
    }
    if (world) {
      const sim = mode === "play" || mode === "dead";
      if (sim) {
        hour = (hour + dt / 90) % 24;
        playTime += rdt;
        combatT = Math.max(0, combatT - dt);
      }
      const nanCheck = (tag: string) => {
        if (Number.isFinite(P.x) && Number.isFinite(P.z) && Number.isFinite(P.yaw) && Number.isFinite(camYaw) && Number.isFinite(P.kx) && Number.isFinite(P.vx)) {
          good.x = P.x;
          good.z = P.z;
          good.yaw = P.yaw;
          good.cam = camYaw;
          return;
        }
        if (!nanWarned) {
          nanWarned = true;
          console.warn("veyrmarch: recovered a non-finite player state at " + tag);
        }
        P.x = good.x;
        P.z = good.z;
        P.yaw = good.yaw;
        camYaw = good.cam;
        P.kx = P.kz = P.vx = P.vz = 0;
      };
      nanCheck("pre");
      playerUpdate(sim ? dt : 0.0001 + (mode === "create" ? rdt : 0));
      nanCheck("player");
      if (P.dead) P.deadT += rdt;
      if (sim) {
        for (const m of mobs) {
          if (m.dungeon !== P.inDungeon && m.state !== "dead") continue;
          if (!m.dungeon && Math.hypot(m.x - P.x, m.z - P.z) > 110) {
            m.rig.group.visible = false;
            continue;
          }
          if (m.state !== "dead" || m.deadT < 5) m.rig.group.visible = true;
          m.update(dt);
        }
        // keep mobs apart
        for (let i = 0; i < mobs.length; i++)
          for (let j = i + 1; j < mobs.length; j++) {
            const a = mobs[i];
            const b = mobs[j];
            if (!a.alive || !b.alive || a.dungeon !== b.dungeon) continue;
            const dx = b.x - a.x;
            const dz = b.z - a.z;
            const d = Math.hypot(dx, dz);
            const min = a.cfg.radius + b.cfg.radius;
            if (d < min && d > 0.001) {
              const push = (min - d) / 2;
              a.x -= (dx / d) * push;
              a.z -= (dz / d) * push;
              b.x += (dx / d) * push;
              b.z += (dz / d) * push;
            }
          }
        nanCheck("mobs");
        updateBolts(dt);
        updateLockRing();
        nearestInteract();
        const reg = P.inDungeon ? (P.z > DUN.galleryZ1 + 4 ? "nursery" : "dungeon") : regionAt(P.x, P.z);
        if (reg !== region) {
          if (reg === "castle" && !revealed && !flags.cookie) {
            revealed = true;
            revealT = 3.2;
          }
          region = reg;
          placeName = REGION_TITLE[reg][0];
          placeSub = REGION_TITLE[reg][1];
          placeAt = performance.now();
          push();
        }
        if (!P.inDungeon && world && Math.hypot(P.x - GATE.x, P.z) < 15 && gateOpen(seals) && !flags.gate && !gateOpening) startGate();
        if (!P.inDungeon && flags.gate && !flags.voss && Math.hypot(P.x - VOSS.x, P.z - VOSS.z) < 9 && mode === "play") {
          const voss = npcs.find((n) => n.def.id === "voss");
          if (voss) talkTo(voss);
        }
      }
      worldUpdate(sim ? dt : rdt * 0.5, rdt);
      nanCheck("world");
      dust.update(rdt);
      sparks.update(rdt);
      flashes.update(dt);
      updateCamera(dt, rdt);
      nanCheck("camera");
      updateLighting(rdt);
      cullT -= rdt;
      if (cullT <= 0) {
        cullT = 0.25;
        cull();
      }
      const pr = renderer.getPixelRatio();
      pxScale.value = canvas.height / pr / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) * pr;
      audio.tick({
        day: (hour > 6 && hour < 20) ? 1 : 0,
        forest: region === "forest" || region === "castle" ? 1 : 0,
        water: world && !P.inDungeon ? Math.min(1, world.terrain.waterAt(P.x, P.z) * 2 + (Math.abs(P.x - 82) < 18 ? 0.6 : 0)) : 0,
        forge: !P.inDungeon && mode !== "title" ? Math.max(0, 1 - Math.hypot(P.x - 11, P.z - 7) / 30) : mode === "title" ? 0.4 : 0,
        box: !flags.cookie ? (P.inDungeon ? (P.z > DUN.galleryZ1 - 10 ? 0.9 : 0.25) : Math.max(0, 1 - Math.hypot(P.x - 0, P.z - 170) / 40) * 0.5) : 0,
        boxRate: cookie ? cookie.boxRate : 1,
        indoor: P.inDungeon && P.z < DUN.galleryZ1 + 4,
        boss: cookie && cookie.fighting && P.inDungeon && cookie.st !== "intro" ? 1 : 0,
        music: mode === "title" ? 1 : P.inDungeon ? 0 : 0.6,
      });
      updateOverlay(rdt);
    }
    renderer.render(scene, camera);
    hudT += rdt;
    if (hudT > 0.1) {
      hudT = 0;
      push();
    }
    saveT += rdt;
    if (saveT > 12 && mode === "play") {
      saveT = 0;
      persist();
    }
  }

  function resize() {
    const w = canvas.clientWidth || 1;
    const h = canvas.clientHeight || 1;
    const cap = quality === "low" ? 1 : quality === "medium" ? 1.5 : 2;
    const pr = Math.min(window.devicePixelRatio || 1, cap);
    if (canvas.width !== Math.floor(w * pr) || canvas.height !== Math.floor(h * pr)) {
      renderer.setPixelRatio(pr);
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.fov = w < h ? 70 : 60;
      camera.updateProjectionMatrix();
    }
  }

  // ------------------------------------------------------------ input
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.repeat) return;
    if ((e.target as HTMLElement)?.tagName === "INPUT") return;
    keys.add(e.code);
    if (e.code === "KeyJ") press("attackDown");
    if (e.code === "KeyK" || e.code === "Space") press("dodge");
    if (e.code === "KeyE") press("interact");
    if (e.code === "KeyF") press("blockDown");
    if (e.code === "KeyQ") press("ember");
    if (e.code === "KeyI" || e.code === "Tab") {
      e.preventDefault();
      press("bag");
    }
    if (e.code === "KeyH") press("heal");
    if (e.code === "Escape") press(mode === "play" ? "pause" : "close");
  };
  const onKeyUp = (e: KeyboardEvent) => {
    keys.delete(e.code);
    if (e.code === "KeyJ") press("attackUp");
    if (e.code === "KeyF") press("blockUp");
  };
  const onBlur = () => {
    keys.clear();
    stickX = stickY = 0;
    P.blocking = false;
    P.holding = false;
    persist();
  };
  const onVis = () => {
    if (document.hidden) {
      persist();
      if (mode === "play") {
        mode = "pause";
        push();
      }
    }
  };
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", onBlur);
  document.addEventListener("visibilitychange", onVis);
  window.addEventListener("pagehide", persist);
  const onLost = (e: Event) => {
    e.preventDefault();
    persist();
  };
  const onRestored = () => location.reload();
  canvas.addEventListener("webglcontextlost", onLost);
  canvas.addEventListener("webglcontextrestored", onRestored);

  function press(p: Press) {
    audio.unlock();
    switch (p) {
      case "attackDown":
        if (mode !== "play" || P.dead) return;
        if (P.action === "none" || P.action.startsWith("light")) {
          P.holding = true;
          P.holdT = 0;
          if (P.action.startsWith("light")) attack(false);
        }
        return;
      case "attackUp":
        if (!P.holding) return;
        P.holding = false;
        if (P.action === "charge") {
          P.action = "none";
          attack(true);
        } else if (P.action === "none") attack(false);
        return;
      case "dodge": {
        if (mode !== "play" || P.dead) return;
        if (P.action === "dodge" || P.action === "hurt" && P.at < 0.15) return;
        if (P.action !== "none" && P.action !== "charge" && P.action !== "gather" && !(P.hitDone && P.at > P.dur * 0.5)) return;
        if (P.stam < 12) {
          say("Out of breath");
          return;
        }
        P.stam -= 20;
        P.stamT = 0.6;
        P.holding = false;
        let dx = P.vx;
        let dz = P.vz;
        const mag = Math.hypot(stickX, stickY) + (keys.size ? 1 : 0);
        if (mag < 0.2 || Math.hypot(dx, dz) < 0.3) {
          dx = -Math.sin(P.yaw);
          dz = -Math.cos(P.yaw);
          if (mag > 0.2) {
            dx = Math.sin(P.yaw);
            dz = Math.cos(P.yaw);
          }
        }
        const l = Math.hypot(dx, dz) || 1;
        P.dodgeX = dx / l;
        P.dodgeZ = dz / l;
        if (mag > 0.2) P.yaw = Math.atan2(P.dodgeX, P.dodgeZ);
        startAction("dodge", 0.46, 9);
        P.iframe = 0.32;
        audio.dodge();
        dust.burst(6, P.x, P.y + 0.1, P.z, 1.5, 0x9a8a70, 0.6, 0.35, { up: 0.5, grav: 0, a: 0.4 });
        return;
      }
      case "interact":
        if (mode === "talk") return advanceTalk();
        if (mode === "dead") return wake();
        if (mode !== "play" || P.dead) return;
        if (promptAct) promptAct();
        push();
        return;
      case "talk":
        return advanceTalk();
      case "blockDown":
        if (mode !== "play") return;
        P.blocking = true;
        P.blockT = 0;
        return;
      case "blockUp":
        P.blocking = false;
        return;
      case "ember":
        return castEmber();
      case "heal":
        if (mode === "play" || mode === "bag") quickHeal();
        return;
      case "bag":
        if (mode === "play") openBag();
        else if (mode === "bag") {
          mode = "play";
          push();
        }
        return;
      case "close":
        if (mode === "bag" || mode === "pause") mode = "play";
        else if (mode === "talk") {
          talkQueue = [];
          advanceTalk();
        }
        push();
        return;
      case "pause":
        if (mode === "play") {
          mode = "pause";
          persist();
          push();
        }
        return;
      case "resume":
        if (mode === "pause") mode = "play";
        push();
        return;
      case "wake":
        return wake();
      case "rewardClose":
        reward = null;
        mode = "play";
        say("The toys go still. Cookie's Core ticks against your ribs.");
        push();
        return;
      case "endClose":
        mode = "play";
        push();
        return;
      case "title":
        api.toTitle();
        return;
    }
  }

  // ------------------------------------------------------------ public api
  function beginPlay() {
    buildInteracts();
    syncGear();
    region = null;
    mode = "play";
    lookT = 10;
    camYaw = P.yaw;
    camPitch = 0.3;
    snapCam();
    if (cookie) {
      if (flags.cookie) cookie.setDead();
      else cookie.reset();
    }
    spawnMobs();
    setZone(P.inDungeon);
    if (P.inDungeon && P.z > DUN.galleryZ1 && !flags.cookie) {
      P.x = dun!.anchors.nurseryDoor.x;
      P.z = dun!.anchors.nurseryDoor.z - 2;
    }
    push();
  }

  const api: GameApi = {
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      persist();
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pagehide", persist);
      renderer.dispose();
      delete window.__veyr;
    },
    subscribe(fn) {
      subs.add(fn);
      fn(snapshot());
      return () => subs.delete(fn);
    },
    create(l) {
      if (mode === "loading") return;
      look = l;
      mode = "create";
      P.x = -3.4;
      P.z = -1.2;
      P.yaw = 2.35;
      P.inDungeon = false;
      setZone(false);
      buildPlayer();
      P.y = world ? world.groundAt(P.x, P.z) : 0;
      push();
    },
    preview(l) {
      look = l;
      buildPlayer();
    },
    newGame(s, nm, l) {
      audio.unlock();
      slot = s;
      name = nm.trim().slice(0, 18) || "Walker";
      look = l;
      items = addItem([], "arm_cloth", 1, uid);
      items[0].equipped = true;
      seals = [];
      flags = freshFlags();
      nodeState.clear();
      deadMobs.clear();
      hour = 7.3;
      playTime = 0;
      deaths = 0;
      kills = 0;
      weightX = 0;
      respawnShrine = false;
      bossDoneT = -1;
      gateOpening = false;
      Object.assign(P, { x: SPAWN.x, z: SPAWN.z, yaw: SPAWN.yaw, hp: 100, stam: 100, mana: 0, maxMana: 0, dead: false, inDungeon: false, action: "none", kx: 0, kz: 0, vx: 0, vz: 0 });
      buildPlayer();
      fadeThen(() => {
        beginPlay();
        persist();
        placeAt = performance.now();
        setTimeout(() => say("Dawn on the palisade road. A bell. Tanic is in the workshop lane."), 1200);
      });
    },
    continueGame(s) {
      audio.unlock();
      const raw = localStorage.getItem(SAVE(s));
      if (!raw) return;
      try {
        const data = JSON.parse(raw) as Save;
        if (data.v !== 2) return;
        slot = s;
        load(data);
        Object.assign(P, { dead: false, action: "none", kx: 0, kz: 0, vx: 0, vz: 0, stam: P.maxStam });
        buildPlayer();
        fadeThen(() => {
          beginPlay();
          say("The road kept your pockets.");
        });
      } catch {
        say("That save could not be read.");
      }
    },
    deleteSlot(s) {
      localStorage.removeItem(SAVE(s));
      slotCache = null;
      push();
    },
    toTitle() {
      persist();
      mode = "title";
      talk = null;
      reward = null;
      setZone(false);
      titleCam();
      push();
    },
    setStick(x, y) {
      stickX = x;
      stickY = y;
    },
    setKeys(codes) {
      keys.clear();
      for (const c of codes) keys.add(c);
    },
    look(dx, dy) {
      camYaw -= dx * 0.0065;
      camPitch = THREE.MathUtils.clamp(camPitch + dy * 0.004, -0.15, 1.05);
      lookT = 0;
    },
    press,
    equip(id) {
      items = equip(items, id);
      syncGear();
      audio.ui();
      persist();
      push();
    },
    use: useItem,
    craft: doCraft,
    trade: doTrade,
    setQuality(q) {
      quality = q;
      localStorage.setItem("veyrmarch.quality", q);
      renderer.shadowMap.enabled = q !== "low";
      sun.castShadow = q !== "low";
      renderer.shadowMap.type = q === "high" ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
      const size = q === "high" ? 2048 : 1024;
      if (sun.shadow.mapSize.x !== size) {
        sun.shadow.mapSize.set(size, size);
        sun.shadow.map?.dispose();
        sun.shadow.map = null;
      }
      canvas.width = 0;
      cull();
      push();
    },
    setMuted(m) {
      audio.setMuted(m);
      localStorage.setItem("veyrmarch.muted", m ? "1" : "0");
      push();
    },
  };

  // test hooks for the browser harness (not used by the game)
  window.__veyr = {
    state: () => ({ x: P.x, z: P.z, y: P.y, hp: P.hp, action: P.action, hold: P.holding, holdT: P.holdT, time: env.time, frameN, mode, region, dungeon: P.inDungeon, flags: { ...flags }, items: items.map((s) => s.def + ":" + s.count), seals: [...seals], cookie: cookie ? { hp: cookie.hp, st: cookie.st, phase: cookie.phaseN } : null, fps }),
    teleport: (x: number, z: number, dungeon?: boolean) => {
      if (dungeon !== undefined && dungeon !== P.inDungeon) setZone(dungeon);
      P.x = x;
      P.z = z;
      P.y = world ? world.groundAt(x, z) : 0;
      snapCam();
      nearestInteract();
    },
    give: (id: string, n: number) => {
      items = addItem(items, id, n, uid);
      push();
    },
    face: (yaw: number) => {
      P.yaw = yaw;
      camYaw = yaw;
    },
    aim: (x: number, z: number) => {
      P.yaw = Math.atan2(x - P.x, z - P.z);
      camYaw = P.yaw;
      nearestInteract();
    },
    setHour: (h: number) => (hour = h),
    mobs: () => mobs.filter((m) => m.alive && m.dungeon === P.inDungeon).map((m) => ({ k: m.kind, x: m.x, z: m.z, hp: m.hp })),
    toys: () => (cookie ? cookie.toys.filter((m) => m.alive).map((m) => ({ k: m.kind, x: m.x, z: m.z, hp: m.hp })) : []),
    heal: () => {
      P.hp = P.maxHp;
      P.stam = P.maxStam;
      P.mana = P.maxMana;
    },
    god: (on: boolean) => {
      (P as { god?: boolean }).god = on;
    },
    prompt: () => prompt,
    breakdown: () => {
      const out: Record<string, number> = {};
      const frustum = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
      scene.traverseVisible((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh && !(o as THREE.Points).isPoints) return;
        if (m.frustumCulled && m.geometry) {
          if (!m.geometry.boundingSphere) m.geometry.computeBoundingSphere();
          const bs = (m as THREE.InstancedMesh).isInstancedMesh ? (m as THREE.InstancedMesh).boundingSphere : m.geometry.boundingSphere;
          if (bs) {
            const sph = bs.clone().applyMatrix4(m.matrixWorld);
            if (!frustum.intersectsSphere(sph)) return;
          }
        }
        let k = (m as THREE.InstancedMesh).isInstancedMesh ? "instanced" : (m as THREE.SkinnedMesh).isSkinnedMesh ? "skinned" : (o as THREE.Points).isPoints ? "points" : "mesh";
        let par = o.parent;
        while (par && !par.name) par = par.parent;
        k += ":" + (par?.name || "?") + (m.name ? "/" + m.name : "");
        out[k] = (out[k] ?? 0) + 1;
      });
      return out;
    },
    perf: () => ({ calls: renderer.info.render.calls, tris: renderer.info.render.triangles, geos: renderer.info.memory.geometries, tex: renderer.info.memory.textures, progs: renderer.info.programs?.length ?? 0, fps }),
    cookiePos: () => (cookie ? { x: cookie.x, z: cookie.z, yaw: cookie.yaw, st: cookie.st } : null),
    npc: (id: string) => {
      const n = npcs.find((x) => x.def.id === id);
      return n ? { x: n.x, z: n.z } : null;
    },
    nodes: (kind: string) => (world ? world.nodes.filter((n) => n.kind === kind).map((n) => ({ id: n.id, x: n.x, z: n.z, left: nodeLeft(n) })) : []),
    anchors: () => (world && dun ? { ...Object.fromEntries(Object.entries(world.anchors).map(([k, v]) => [k, { x: v.x, z: v.z }])), dun: Object.fromEntries(Object.entries(dun.anchors).map(([k, v]) => [k, { x: v.x, z: v.z }])) } : null),
    swing: (heavy: boolean) => {
      P.action = "none";
      attack(heavy);
    },
    ember: () => castEmber(),
    interact: () => {
      if (mode === "play") nearestInteract();
      press("interact");
    },
  };
  const origHurt = hurtPlayer;
  env.hurtPlayer = (d, sx, sz, o) => ((P as { god?: boolean }).god ? false : origHurt(d, sx, sz, o));

  resize();
  raf = requestAnimationFrame(frame);
  void init();
  return api;
}

declare global {
  interface Window {
    __veyr?: Record<string, (...args: never[]) => unknown>;
  }
}
