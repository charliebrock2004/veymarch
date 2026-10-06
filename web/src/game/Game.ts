import * as THREE from "three";
import { COOKIE_HP, BOE_HP, LINES, RECIPES, SPEEDS } from "./content";
import {
  addItem,
  canMine,
  consume,
  countOf,
  equipped,
  equip,
  gateOpen,
  item,
  recipeHint,
  strikeDamage,
  tryCraft,
  grantUniques,
  type Stack,
} from "./rules";

export type Hud = {
  ready: boolean;
  mode: "boot" | "menu" | "play" | "inventory" | "talk" | "dead";
  name: string;
  hp: number;
  maxHp: number;
  stam: number;
  maxStam: number;
  mana: number;
  maxMana: number;
  weapon: string;
  prompt: string;
  quest: string;
  talk: string;
  talkName: string;
  toast: string;
  banner: string;
  hour: number;
  night: boolean;
  place: string;
  ember: boolean;
  boss: string;
  bossHp: number;
  bossMax: number;
  items: { uid: string; name: string; count: number; equipped: boolean; kind: string }[];
  crafts: { id: string; name: string; ok: boolean; hint: string; station: string }[];
  floaters: { id: number; text: string; x: number; y: number }[];
  hasSave: boolean;
  seal: boolean;
};

export type GameApi = {
  dispose: () => void;
  start: (opts: { name: string; hair: "tied" | "short"; cont: boolean }) => void;
  setKeys: (codes: string[]) => void;
  setStick: (x: number, y: number) => void;
  look: (dx: number) => void;
  press: (what: "attackDown" | "attackUp" | "dodge" | "interact" | "blockDown" | "blockUp" | "ember" | "bag" | "close" | "wake" | "talk") => void;
  equipUid: (uid: string) => void;
  useUid: (uid: string) => void;
  craft: (id: string) => void;
  getYaw: () => number;
  getSpeed: () => number;
  subscribe: (fn: (h: Hud) => void) => () => void;
};

const SAVE_KEY = "veyrmarch.save.v1";
const PAD = { x: 0, z: 2 };
const DUN = 400;

type Wall = { minX: number; maxX: number; minZ: number; maxZ: number; on: () => boolean };
type NodeR = {
  id: string;
  x: number;
  z: number;
  def: string;
  tier: number;
  seal: string | null;
  left: number;
  max: number;
  mesh: THREE.Object3D;
};
type Mob = {
  id: string;
  kind: "wolf" | "goblin" | "elite" | "cookie" | "toy" | "boe";
  x: number;
  z: number;
  hp: number;
  max: number;
  yaw: number;
  alive: boolean;
  state: "idle" | "tele" | "strike" | "recover";
  struck: boolean;
  timer: number;
  vx: number;
  vz: number;
  damage: number;
  range: number;
  tele: number;
  speed: number;
  aggro: number;
  homeX: number;
  homeZ: number;
  group: THREE.Group;
  fireWeak: boolean;
};

type SaveBody = {
  schema: 1;
  name: string;
  hair: "tied" | "short";
  x: number;
  z: number;
  yaw: number;
  hp: number;
  stam: number;
  mana: number;
  maxMana: number;
  items: Stack[];
  seals: string[];
  ember: boolean;
  talked: boolean;
  rhyme: boolean;
  cookieDead: boolean;
  doorOpen: boolean;
  boeDead: boolean;
  shieldTaken: boolean;
  hour: number;
  seq: number;
  nodes: Record<string, number>;
  skillHits: number;
};

export function mountGame(canvas: HTMLCanvasElement): GameApi {
  const keys = new Set<string>();
  const subs = new Set<(h: Hud) => void>();
  let stickX = 0;
  let stickY = 0;
  let looking = false;
  let playing = false;
  let mode: Hud["mode"] = "menu";
  let name = "Walker";
  let hair: "tied" | "short" = "tied";
  let yaw = Math.PI;
  let camYaw = Math.PI;
  let x = PAD.x;
  let z = PAD.z;
  let hp = 80;
  let maxHp = 80;
  let stam = 60;
  let maxStam = 60;
  let mana = 0;
  let maxMana = 0;
  let speed = 0;
  let seq = 1;
  let items: Stack[] = [];
  let seals: string[] = [];
  let ember = false;
  let talked = false;
  let rhyme = false;
  let cookieDead = false;
  let doorOpen = false;
  let boeDead = false;
  let shieldTaken = false;
  let daySeconds = (8 / 24) * 1440;
  let iframe = 0;
  let dodgeLeft = 0;
  let dodgeX = 0;
  let dodgeZ = 0;
  let attackCd = 0;
  let attackHold = 0;
  let holdingAttack = false;
  let blocking = false;
  let swing = 0;
  let toast = "";
  let toastT = 0;
  let banner = "";
  let bannerT = 0;
  let talkName = "";
  let talk = "";
  let talkQueue: string[] = [];
  let skillHits = 0;
  let combo = 0;
  let comboUntil = 0;
  let shake = 0;
  let saveT = 0;
  let hudT = 0;
  let floaterId = 1;
  const floaters: { id: number; text: string; x: number; y: number; z: number; life: number }[] = [];
  let hurtLock = 0;
  let trapArm = 0;
  let trapFired = false;
  const pendingToys: { x: number; z: number }[] = [];
  let nearBench = false;
  let prompt = "";
  let promptFn: (() => void) | null = null;
  const uid = () => "i" + seq++;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: "high-performance" });
  renderer.setClearColor(0xc4b49a);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xc4b49a, 18, 70);
  const camera = new THREE.PerspectiveCamera(52, 1, 0.1, 180);
  const hemi = new THREE.HemisphereLight(0xe7dcc8, 0x3c342c, 0.9);
  const dir = new THREE.DirectionalLight(0xf0d7a8, 1.2);
  dir.position.set(-20, 36, 8);
  scene.add(hemi, dir);

  const mats = new Map<number, THREE.MeshLambertMaterial>();
  const geos = new Map<string, THREE.BufferGeometry>();
  const mat = (hex: number) => {
    let m = mats.get(hex);
    if (!m) {
      m = new THREE.MeshLambertMaterial({ color: hex });
      mats.set(hex, m);
    }
    return m;
  };
  const geoBox = (w: number, h: number, d: number) => {
    const k = `b${w}_${h}_${d}`;
    let g = geos.get(k);
    if (!g) {
      g = new THREE.BoxGeometry(w, h, d);
      geos.set(k, g);
    }
    return g;
  };
  const put = (parent: THREE.Object3D, w: number, h: number, d: number, color: number, px: number, py: number, pz: number) => {
    const mesh = new THREE.Mesh(geoBox(w, h, d), mat(color));
    mesh.position.set(px, py, pz);
    parent.add(mesh);
    return mesh;
  };

  const walls: Wall[] = [];
  const circles: { x: number; z: number; r: number }[] = [];
  const nodes: NodeR[] = [];
  const mobs: Mob[] = [];
  const npcs: { id: string; name: string; x: number; z: number; group: THREE.Group }[] = [];

  const groundTex = document.createElement("canvas");
  groundTex.width = 512;
  groundTex.height = 512;
  const gctx = groundTex.getContext("2d")!;
  gctx.fillStyle = "#5E6B45";
  gctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 1800; i++) {
    gctx.fillStyle = i % 3 === 0 ? "#4E5A38" : "#6B7550";
    gctx.fillRect(Math.random() * 512, Math.random() * 512, 3, 2);
  }
  const groundMat = new THREE.MeshLambertMaterial({ map: new THREE.CanvasTexture(groundTex) });
  groundMat.map!.colorSpace = THREE.SRGBColorSpace;
  groundMat.map!.wrapS = groundMat.map!.wrapT = THREE.RepeatWrapping;
  groundMat.map!.repeat.set(18, 18);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(220, 220), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0, 50);
  scene.add(ground);

  const wheat = new THREE.Mesh(new THREE.PlaneGeometry(70, 36), mat(0xc6a15b));
  wheat.rotation.x = -Math.PI / 2;
  wheat.position.set(62, 0.02, 8);
  scene.add(wheat);
  const path = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 100), mat(0x8a7156));
  path.rotation.x = -Math.PI / 2;
  path.position.set(0, 0.03, 50);
  scene.add(path);
  const road = new THREE.Mesh(new THREE.PlaneGeometry(50, 4), mat(0xb7a48a));
  road.rotation.x = -Math.PI / 2;
  road.position.set(40, 0.03, 8);
  scene.add(road);
  const creek = new THREE.Mesh(new THREE.PlaneGeometry(8, 3), mat(0x7e8c86));
  creek.rotation.x = -Math.PI / 2;
  creek.position.set(3, 0.04, 24);
  scene.add(creek);

  const dunFloor = new THREE.Mesh(new THREE.PlaneGeometry(16, 86), mat(0xd7c3b0));
  dunFloor.rotation.x = -Math.PI / 2;
  dunFloor.position.set(DUN, 0.02, 40);
  scene.add(dunFloor);

  function building(px: number, pz: number, w: number, d: number, h: number, roof: number) {
    const g = new THREE.Group();
    put(g, w, 0.4, d, 0xe4d7c3, 0, 0.2, 0);
    put(g, w - 0.4, h, d - 0.4, 0x6e6256, 0, 0.4 + h / 2, 0);
    put(g, w + 0.3, 0.35, d + 0.3, roof, 0, 0.4 + h + 0.2, 0);
    put(g, 0.18, h, 0.18, 0x3c342c, -w / 2, h / 2, d / 2);
    put(g, 0.18, h, 0.18, 0x3c342c, w / 2, h / 2, d / 2);
    put(g, 0.18, h, 0.18, 0x3c342c, -w / 2, h / 2, -d / 2);
    put(g, 0.18, h, 0.18, 0x3c342c, w / 2, h / 2, -d / 2);
    g.position.set(px, 0, pz);
    scene.add(g);
    walls.push({ minX: px - w / 2, maxX: px + w / 2, minZ: pz - d / 2, maxZ: pz + d / 2, on: () => true });
  }

  building(-8, 5, 6, 5, 3.2, 0x3c342c);
  building(7, -2, 5, 4, 2.6, 0x4a4036);
  building(-2, -8, 7, 4, 3, 0x3c342c);

  function person(px: number, pz: number, tall: number, coat: number, hairCol: number, pin: boolean) {
    const g = new THREE.Group();
    put(g, 0.28, 0.7, 0.28, 0x2a241e, -0.14, 0.35, 0);
    put(g, 0.28, 0.7, 0.28, 0x2a241e, 0.14, 0.35, 0);
    put(g, 0.55, 0.7 * tall, 0.32, coat, 0, 0.7 + 0.25 * tall, 0);
    put(g, 0.32, 0.32, 0.32, 0xd7b89a, 0, 1.15 + 0.35 * tall, 0);
    put(g, 0.34, 0.16, 0.36, hairCol, 0, 1.32 + 0.35 * tall, -0.02);
    if (pin) put(g, 0.08, 0.08, 0.08, 0xb87333, 0.18, 1.05, 0.16);
    g.position.set(px, 0, pz);
    scene.add(g);
    return g;
  }

  const player = person(x, z, 1, 0x4a433c, 0x6b4423, true);
  const hairMesh = player.children[4] as THREE.Mesh;
  const armL = put(player, 0.16, 0.55, 0.16, 0xd7b89a, -0.38, 1.15, 0);
  const armR = put(player, 0.16, 0.55, 0.16, 0xd7b89a, 0.38, 1.15, 0);
  const weaponMat = new THREE.MeshLambertMaterial({ color: 0xd9d3cc });
  const weaponMesh = new THREE.Mesh(geoBox(0.08, 0.55, 0.08), weaponMat);
  weaponMesh.position.set(0.38, 0.85, 0.28);
  player.add(weaponMesh);
  weaponMesh.visible = false;
  const legL = player.children[0] as THREE.Mesh;
  const legR = player.children[1] as THREE.Mesh;

  npcs.push({ id: "tanic", name: "Tanic", x: -5, z: 9, group: person(-5, 9, 1.18, 0x3c342c, 0x5a3a22, true) });
  npcs.push({ id: "mara", name: "Mara", x: -8, z: 8.2, group: person(-8, 8.2, 1, 0x6a3b2a, 0x2a2118, false) });
  npcs.push({ id: "penn", name: "Old Penn", x: 10, z: 6, group: person(10, 6, 0.92, 0xc4b07a, 0xddd4c4, false) });
  npcs.push({ id: "bramble", name: "Captain Bramble", x: -12, z: 2, group: person(-12, 2, 1.05, 0x2e3428, 0x3a2a1c, true) });
  npcs.push({ id: "child", name: "The children", x: 6, z: 3, group: person(6, 3, 0.62, 0x8e2f2f, 0xd7b89a, false) });
  const voss = person(72, 8, 1.05, 0x2a2622, 0x4a4038, true);
  npcs.push({ id: "voss", name: "Castellan Voss", x: 72, z: 8, group: voss });

  const benchMark = new THREE.Group();
  put(benchMark, 1.4, 0.7, 0.6, 0x6e5436, 0, 0.35, 0);
  put(benchMark, 0.3, 0.3, 0.3, 0xb87333, 0.3, 0.8, 0);
  benchMark.position.set(-6, 0, 7.2);
  scene.add(benchMark);

  const bed = put(scene, 1.1, 0.18, 1.8, 0x6e6256, 3, 0.1, -4);
  const stump = new THREE.Group();
  put(stump, 0.7, 0.45, 0.7, 0x5a4632, 0, 0.22, 0);
  const shieldPickup = put(stump, 0.55, 0.7, 0.12, 0x8a7156, 0, 0.8, 0);
  stump.position.set(4.2, 0, 6);
  scene.add(stump);

  function tree(px: number, pz: number, scale: number, solid: boolean) {
    const trunk = new THREE.Mesh(geoBox(0.35 * scale, 1.8 * scale, 0.35 * scale), mat(0x3c342c));
    trunk.position.set(px, 0.9 * scale, pz);
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(1.15 * scale, 2.4 * scale, 6), mat(0x5e6b45));
    leaf.position.set(px, 2.3 * scale, pz);
    scene.add(trunk, leaf);
    if (solid) circles.push({ x: px, z: pz, r: 0.55 * scale });
  }
  const treeSpots: [number, number, number, boolean][] = [
    [-8, 20, 1.1, true], [9, 22, 1.3, true], [-12, 30, 1, false], [11, 34, 1.4, true],
    [-7, 42, 1.2, true], [8, 48, 1, false], [-14, 54, 1.5, true], [13, 58, 1.1, true],
    [-6, 66, 1.2, false], [10, 72, 1.4, true], [-11, 78, 1, true], [7, 84, 1.3, false],
    [16, 40, 1.6, true], [-18, 46, 1.2, true], [18, 68, 1.1, true], [-4, 90, 1, false],
  ];
  for (const [tx, tz, sc, sol] of treeSpots) tree(tx, tz, sc, sol);

  function nodeMesh(px: number, pz: number, color: number, id: string, def: string, tier: number, seal: string | null, count: number) {
    const mesh = new THREE.Mesh(geoBox(0.7, 0.35, 0.5), mat(color));
    mesh.position.set(px, 0.2, pz);
    scene.add(mesh);
    nodes.push({ id, x: px, z: pz, def, tier, seal, left: count, max: count, mesh });
  }
  nodeMesh(2.2, 23, 0x2a2a28, "flint_a", "mat_flint", 0, null, 2);
  nodeMesh(-2.4, 27, 0x2a2a28, "flint_b", "mat_flint", 0, null, 2);
  nodeMesh(7, 30, 0x6e5436, "wood_a", "mat_wood", 0, null, 3);
  nodeMesh(-5, 36, 0x6e5436, "wood_b", "mat_wood", 0, null, 3);
  nodeMesh(5, 46, 0xc2b48a, "fibre_a", "mat_fibre", 0, null, 3);
  nodeMesh(-8, 60, 0xc2b48a, "fibre_b", "mat_fibre", 0, null, 2);
  nodeMesh(4, 25.5, 0xb87333, "copper_a", "mat_copper", 2, null, 4);
  nodeMesh(58, 10, 0x6a6e74, "iron_a", "mat_iron", 4, "seal_cookie", 4);

  const castle = new THREE.Group();
  put(castle, 8, 5, 6, 0xe4d7c3, 0, 2.5, 0);
  put(castle, 8.4, 0.5, 6.4, 0x8e2f2f, 0, 5.1, 0);
  put(castle, 1.2, 2.2, 0.3, 0x8e2f2f, 0, 1.4, 3.05);
  put(castle, 1.4, 1.1, 1.4, 0xb87333, 2.4, 3.6, 0.4);
  castle.position.set(0, 0, 98);
  scene.add(castle);
  walls.push({ minX: -4, maxX: 4, minZ: 95, maxZ: 101, on: () => true });

  const gateL = put(scene, 1.1, 4.2, 1.1, 0xe4d7c3, 30, 2.1, 5.2);
  const gateR = put(scene, 1.1, 4.2, 1.1, 0xe4d7c3, 30, 2.1, 10.8);
  const gateBar = put(scene, 0.4, 0.5, 6.2, 0x3c342c, 30, 2.4, 8);
  walls.push({
    minX: 29.2, maxX: 30.8, minZ: 5.4, maxZ: 10.6,
    on: () => !gateOpen(seals),
  });

  const fort = new THREE.Group();
  put(fort, 10, 7, 8, 0x2a2622, 0, 3.5, 0);
  put(fort, 2.2, 9, 2.2, 0x1c1916, -4, 4.5, -3);
  put(fort, 2.2, 9, 2.2, 0x1c1916, 4, 4.5, -3);
  put(fort, 1.6, 2.4, 0.2, 0xc6a15b, 0, 2.2, 4.1);
  fort.position.set(84, 0, 8);
  scene.add(fort);
  walls.push({ minX: 79, maxX: 89, minZ: 4, maxZ: 12, on: () => true });

  function roomWalls() {
    const x0 = DUN - 6;
    const x1 = DUN + 6;
    walls.push({ minX: x0 - 0.6, maxX: x0, minZ: -2, maxZ: 80, on: () => true });
    walls.push({ minX: x1, maxX: x1 + 0.6, minZ: -2, maxZ: 80, on: () => true });
    walls.push({ minX: x0, maxX: x1, minZ: -2, maxZ: -1, on: () => true });
    walls.push({ minX: x0, maxX: x1, minZ: 78, maxZ: 79, on: () => true });
    put(scene, 0.5, 3.2, 82, 0x3c342c, x0 - 0.2, 1.6, 39);
    put(scene, 0.5, 3.2, 82, 0x3c342c, x1 + 0.2, 1.6, 39);
    put(scene, 1.5, 0.2, 1.5, 0x8e2f2f, DUN - 1.5, 0.12, 28);
    put(scene, 1.5, 0.2, 1.5, 0x8e2f2f, DUN + 1.5, 0.12, 28);
    put(scene, 2.2, 0.15, 2.2, 0xb87333, DUN + 2, 0.08, 48);
  }
  roomWalls();
  const doorSlab = put(scene, 8, 3, 0.4, 0x3c342c, DUN, 1.5, 52);
  walls.push({ minX: DUN - 4, maxX: DUN + 4, minZ: 51.6, maxZ: 52.4, on: () => !doorOpen });

  const weight = new THREE.Group();
  put(weight, 0.9, 0.7, 0.9, 0x8a8178, 0, 0.35, 0);
  weight.position.set(DUN - 2, 0, 44);
  scene.add(weight);

  const boxHazard = put(scene, 1.3, 1.3, 1.3, 0x8e2f2f, DUN + 3, 0.7, 64);
  boxHazard.visible = false;

  function makeMob(kind: Mob["kind"], px: number, pz: number, hp0: number, color: number, damage: number, aggro: number, tele: number, spd: number, fireWeak: boolean): Mob {
    const group = new THREE.Group();
    if (kind === "cookie") {
      put(group, 1.3, 1.15, 1.1, 0xf4f1ea, 0, 0.9, 0);
      put(group, 1.45, 0.7, 0.5, 0x8e2f2f, 0, 0.85, 0.35);
      put(group, 0.28, 0.28, 0.28, 0xb87333, 0, 1.15, 0.55);
      put(group, 0.16, 0.16, 0.1, 0x1c1916, -0.22, 1.2, 0.5);
      put(group, 0.16, 0.16, 0.1, 0x1c1916, 0.22, 1.2, 0.5);
      put(group, 0.2, 0.35, 0.35, 0xf4f1ea, -0.35, 0.35, 0);
      put(group, 0.2, 0.35, 0.35, 0xf4f1ea, 0.35, 0.35, 0);
    } else if (kind === "boe") {
      put(group, 1.1, 0.55, 0.45, 0x1a1816, 0, 0.5, 0);
      put(group, 0.4, 0.35, 0.4, 0x1a1816, 0, 0.75, 0.35);
      put(group, 0.18, 0.12, 0.12, 0x8e2f2f, 0, 0.55, 0.1);
    } else if (kind === "toy") {
      put(group, 0.45, 0.55, 0.4, 0xf4f1ea, 0, 0.4, 0);
      put(group, 0.5, 0.3, 0.2, 0x8e2f2f, 0, 0.4, 0.15);
    } else {
      put(group, 0.9, 0.45, 0.4, color, 0, 0.45, 0);
      put(group, 0.35, 0.3, 0.4, color, 0, 0.62, 0.35);
      put(group, 0.12, 0.3, 0.12, color, -0.25, 0.2, 0.15);
      put(group, 0.12, 0.3, 0.12, color, 0.25, 0.2, 0.15);
    }
    group.position.set(px, 0, pz);
    scene.add(group);
    const mob: Mob = {
      id: kind + px + pz, kind, x: px, z: pz, hp: hp0, max: hp0, yaw: 0, alive: true,
      state: "idle", timer: 0, struck: false, vx: 0, vz: 0, damage, range: kind === "cookie" ? 2.2 : 1.5,
      tele, speed: spd, aggro, homeX: px, homeZ: pz, group, fireWeak,
    };
    mobs.push(mob);
    return mob;
  }

  makeMob("wolf", 12, 40, 24, 0x4a4036, 12, 12, 0.5, 3.4, false);
  makeMob("wolf", -10, 56, 24, 0x4a4036, 12, 12, 0.5, 3.4, false);
  makeMob("goblin", -14, 64, 20, 0x6b7a45, 10, 11, 0.32, 4.1, false);
  makeMob("elite", DUN, 34, 40, 0x8e2f2f, 14, 8, 0.7, 3.2, false);
  const cookie = makeMob("cookie", DUN, 66, COOKIE_HP, 0xf4f1ea, 16, 30, 0.55, 2.2, true);
  const boe = makeMob("boe", -18, 52, BOE_HP, 0x1a1816, 16, 7, 0.6, 5.2, false);

  const sfx = {
    ctx: null as AudioContext | null,
    go() {
      if (!this.ctx) this.ctx = new AudioContext();
      if (this.ctx.state === "suspended") void this.ctx.resume();
      return this.ctx;
    },
    tone(freq: number, dur: number, type: OscillatorType, gain = 0.04) {
      const ctx = this.ctx;
      if (!ctx) return;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type;
      o.frequency.value = freq;
      g.gain.setValueAtTime(gain, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
      o.connect(g);
      g.connect(ctx.destination);
      o.start();
      o.stop(ctx.currentTime + dur);
    },
  };

  function say(text: string) {
    toast = text;
    toastT = 2.4;
    pushHud();
  }
  function floater(text: string, px: number, py: number, pz: number) {
    floaters.push({ id: floaterId++, text, x: px, y: py, z: pz, life: 0.8 });
  }
  function skillRank() {
    return Math.min(4, Math.floor(skillHits / 3));
  }
  function mainWeapon() {
    const eq = equipped(items, "main");
    return item(eq?.def ?? "wpn_fists");
  }
  function hasShield() {
    return items.some((s) => s.equipped && item(s.def).moveset === "shield");
  }
  function syncWeapon() {
    const wpn = mainWeapon();
    weaponMesh.visible = wpn.id !== "wpn_fists";
    const color = wpn.moveset === "cookie_blade" ? 0x8e2f2f : wpn.moveset === "pick" || wpn.moveset === "cookie_pick" ? 0x8a8178 : wpn.id === "wpn_copper_sword" ? 0xb87333 : 0xd9d3cc;
    weaponMat.color.setHex(color);
    weaponMesh.scale.set(1, wpn.moveset.includes("pick") ? 1.1 : wpn.damage > 14 ? 1.25 : 0.85, 1);
  }
  function syncHair() {
    hairMesh.scale.set(1, hair === "short" ? 0.7 : 1.3, hair === "tied" ? 1.4 : 1);
  }

  function placeName() {
    if (x > 300) {
      if (z > 52) return "Nursery courtyard";
      if (z > 36) return "Weight hall";
      if (z > 22) return "Marked floor";
      return "Castle mouth";
    }
    if (x > 34) return "Harrenvale road";
    if (z > 18) return "Giant Forest";
    return "Hearthfen";
  }
  function hour() {
    return ((daySeconds % 1440) / 1440) * 24;
  }
  function night() {
    return hour() >= 16 || hour() < 5;
  }
  function objective() {
    if (countOf(items, "wpn_stone_knife") + countOf(items, "wpn_copper_sword") + countOf(items, "wpn_cookie_blade") === 0 && countOf(items, "wpn_smacko") === 0) {
      return talked ? "Flint and wood. A knife, by hand or at the bench." : "Tanic is on the smith lane. Speak to him.";
    }
    if (!cookieDead) return x > 300 ? "Cookie keeps the nursery. Dodge the bow." : "North road. The nursery castle. Don't go in bare-handed.";
    if (!gateOpen(seals)) return "The core should have opened the Green Gate.";
    if (x < 34) return "East of the smith. The Green Gate.";
    return "Wheat, then a shut fortress. That is as far as this road goes.";
  }

  function snapshot(): Hud {
    const wpn = mainWeapon();
    const station = nearBench ? "bench" : "hand";
    const projected = floaters.map((f) => {
      const v = new THREE.Vector3(f.x, f.y, f.z).project(camera);
      return { id: f.id, text: f.text, x: (v.x * 0.5 + 0.5) * canvas.clientWidth, y: (-v.y * 0.5 + 0.5) * canvas.clientHeight };
    });
    const boss = mobs.find((m) => m.alive && (m.kind === "cookie" || m.kind === "boe") && Math.hypot(m.x - x, m.z - z) < 18);
    return {
      ready: true,
      mode: playing ? mode : "menu",
      name, hp, maxHp, stam, maxStam, mana, maxMana,
      weapon: wpn.name,
      prompt, quest: objective(), talk, talkName, toast, banner,
      hour: hour(), night: night(), place: placeName(), ember,
      boss: boss ? (boss.kind === "cookie" ? "Cookie" : "Boe") : "",
      bossHp: boss?.hp ?? 0,
      bossMax: boss?.max ?? 1,
      items: items.map((s) => ({ uid: s.uid, name: item(s.def).name, count: s.count, equipped: s.equipped, kind: item(s.def).kind })),
      crafts: RECIPES.map((r) => ({
        id: r.id,
        name: r.name,
        ok: (r.station === "hand" || nearBench) && r.inputs.every((i) => countOf(items, i.id) >= i.n),
        hint: recipeHint(r, items),
        station: r.station,
      })),
      floaters: projected,
      hasSave: !!localStorage.getItem(SAVE_KEY),
      seal: gateOpen(seals),
    };
  }

  function pushHud() {
    const snap = snapshot();
    for (const fn of subs) fn(snap);
  }

  function checksum(body: string) {
    let h = 2166136261;
    for (let i = 0; i < body.length; i++) {
      h ^= body.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0).toString(16);
  }
  function persist() {
    const body: SaveBody = {
      schema: 1, name, hair, x, z, yaw, hp, stam, mana, maxMana, items, seals, ember, talked, rhyme,
      cookieDead, doorOpen, boeDead, shieldTaken, hour: hour(), seq, skillHits,
      nodes: Object.fromEntries(nodes.map((n) => [n.id, n.left])),
    };
    const raw = JSON.stringify(body);
    localStorage.setItem(SAVE_KEY, JSON.stringify({ checksum: checksum(raw), body: raw }));
  }
  function readSave(): SaveBody | null {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    try {
      const env = JSON.parse(raw) as { checksum: string; body: string };
      if (env.checksum !== checksum(env.body)) return null;
      const body = JSON.parse(env.body) as SaveBody;
      if (body.schema !== 1) return null;
      return body;
    } catch {
      return null;
    }
  }

  function applySave(body: SaveBody) {
    name = body.name;
    hair = body.hair;
    x = body.x;
    z = body.z;
    yaw = body.yaw;
    camYaw = body.yaw;
    hp = body.hp;
    stam = body.stam;
    mana = body.mana;
    maxMana = body.maxMana;
    items = body.items;
    seals = body.seals;
    ember = body.ember;
    talked = body.talked;
    rhyme = body.rhyme;
    cookieDead = body.cookieDead;
    doorOpen = body.doorOpen;
    boeDead = body.boeDead;
    shieldTaken = body.shieldTaken;
    daySeconds = (body.hour / 24) * 1440;
    seq = body.seq;
    skillHits = body.skillHits ?? 0;
    for (const n of nodes) if (body.nodes[n.id] != null) n.left = body.nodes[n.id];
  }

  function freshBags() {
    items = addItem([], "arm_cloth", 1, uid);
    const cloth = items[0];
    if (cloth) cloth.equipped = true;
  }

  function dist(px: number, pz: number) {
    return Math.hypot(px - x, pz - z);
  }

  function openTalk(who: string, lines: string[]) {
    talkName = who;
    talkQueue = lines;
    talk = lines[0] ?? "";
    mode = "talk";
    sfx.go();
  }

  function interact() {
    if (!playing || mode === "dead") return;
    if (mode === "talk") {
      talkQueue.shift();
      talk = talkQueue[0] ?? "";
      if (!talk) mode = "play";
      pushHud();
      return;
    }
    if (promptFn) {
      promptFn();
      pushHud();
    }
  }

  function gather(n: NodeR) {
    const tool = mainWeapon().tier;
    const why = canMine(n.tier, n.seal, Math.max(tool, n.tier === 0 ? 0 : tool), seals);
    if (n.tier === 0) {
      /* fists are legal */
    } else if (why) {
      say(why === "sealed" ? "The vein is still sealed." : "That needs a better pick.");
      return;
    }
    if (n.left <= 0) {
      say("Nothing left but the scar.");
      return;
    }
    n.left -= 1;
    items = addItem(items, n.def, 1, uid);
    sfx.tone(320, 0.08, "triangle", 0.04);
    say(item(n.def).name);
    if (countOf(items, "wpn_stone_knife") === 0 && countOf(items, "mat_flint") >= 2 && countOf(items, "mat_wood") >= 1) {
      say("Enough for a knife. Bag, then craft.");
    }
  }

  function doCraft(id: string) {
    const station = nearBench ? "bench" : "hand";
    const result = tryCraft(items, id, station, uid);
    if (!result.ok) {
      say(result.reason === "station" ? "That wants the bench." : "Missing materials.");
      return;
    }
    items = result.items;
    const made = result.made ? item(result.made) : null;
    if (made && made.slot === "main") {
      const stack = items.find((s) => s.def === made.id);
      if (stack) items = equip(items, stack.uid);
    }
    sfx.tone(440, 0.1, "square", 0.04);
    say(made ? made.name + " made." : "Made.");
    syncWeapon();
    if (made?.id === "wpn_stone_knife" && !ember) {
      say("Knife's done. Tanic will show you Ember if you ask.");
    }
  }

  function strike(heavy: boolean) {
    if (mode !== "play" || attackCd > 0 || iframe > 0 && false) return;
    const wpn = mainWeapon();
    const cost = heavy ? wpn.stamHeavy : wpn.stamLight;
    if (stam < cost) {
      say("No breath.");
      return;
    }
    stam -= cost;
    attackCd = heavy ? 0.72 : 0.42;
    swing = heavy ? 0.28 : 0.18;
    if (wpn.id !== "wpn_fists") skillHits += 1;
    let chain = 1;
    if (!heavy) {
      if (performance.now() / 1000 < comboUntil && combo > 0) combo += 1;
      else combo = 1;
      if (combo >= 3) {
        chain = 1.15;
        combo = 0;
      }
      comboUntil = performance.now() / 1000 + 0.75;
    } else combo = 0;
    sfx.tone(heavy ? 120 : 200, 0.07, "triangle", 0.05);
    const fx = -Math.sin(yaw);
    const fz = -Math.cos(yaw);
    let hit = false;
    for (const mob of mobs) {
      if (!mob.alive) continue;
      const dx = mob.x - x;
      const dz = mob.z - z;
      const d = Math.hypot(dx, dz);
      if (d > wpn.range + 0.5) continue;
      const dot = d < 0.001 ? 1 : (dx * fx + dz * fz) / d;
      if (dot < 0.15) continue;
      const dmg = strikeDamage({
        weapon: wpn, heavy, skillRank: skillRank(), weakness: false, blocking: false, shield: false, defence: 0,
      });
      const dealt = Math.max(1, Math.round(dmg * chain));
      mob.hp -= dealt;
      hit = true;
      floater(String(dealt), mob.x, 1.6, mob.z);
      shake = heavy ? 0.12 : 0.05;
      if (mob.hp <= 0) killMob(mob);
    }
    if (hit) sfx.tone(90, 0.08, "square", 0.04);
  }

  function castEmber() {
    if (!ember || mode !== "play") return;
    if (mana < 8) {
      say("No breath for Ember.");
      return;
    }
    if (attackCd > 0) return;
    mana -= 8;
    attackCd = 0.55;
    sfx.tone(620, 0.12, "sawtooth", 0.04);
    const fx = -Math.sin(yaw);
    const fz = -Math.cos(yaw);
    for (const mob of mobs) {
      if (!mob.alive) continue;
      const dx = mob.x - x;
      const dz = mob.z - z;
      const d = Math.hypot(dx, dz);
      if (d > 7.5) continue;
      const dot = d < 0.001 ? 1 : (dx * fx + dz * fz) / d;
      if (dot < 0.2) continue;
      let dmg = 12;
      if (mob.fireWeak) dmg = Math.round(dmg * 1.25);
      mob.hp -= dmg;
      floater(dmg + " fire", mob.x, 1.8, mob.z);
      if (mob.hp <= 0) killMob(mob);
    }
  }

  function killMob(mob: Mob) {
    mob.alive = false;
    mob.hp = 0;
    mob.group.visible = false;
    if (mob.kind === "wolf" || mob.kind === "goblin" || mob.kind === "elite") {
      const drop = mob.kind === "wolf" ? "mat_bone" : "mat_leather";
      items = addItem(items, drop, 1, uid);
      say(item(drop).name + " — " + (mob.kind === "elite" ? "the redcap falls" : "down"));
    }
    if (mob.kind === "boe" && !boeDead) {
      boeDead = true;
      const grant = grantUniques(items, ["wpn_smacko"], uid);
      items = grant.items;
      say("Smacko. The collar is quiet.");
      banner = "Smacko is yours. It is not a seal.";
      bannerT = 4;
    }
    if (mob.kind === "cookie" && !cookieDead) {
      cookieDead = true;
      const grant = grantUniques(items, ["wpn_cookie_blade", "wpn_cookie_pick", "key_cookie_core"], uid);
      items = grant.items;
      seals = seals.includes("seal_cookie") ? seals : [...seals, "seal_cookie"];
      const blade = items.find((s) => s.def === "wpn_cookie_blade");
      if (blade) items = equip(items, blade.uid);
      syncWeapon();
      banner = "Cookie's Blade. Cookie's Pickaxe. Cookie's Core. The Green Gate answers.";
      bannerT = 5.5;
      sfx.tone(523, 0.18, "sine", 0.05);
      say("The toys go still.");
      persist();
    }
  }

  function resetBoss(mob: Mob, hp0: number) {
    if ((mob.kind === "cookie" && cookieDead) || (mob.kind === "boe" && boeDead)) return;
    mob.hp = hp0;
    mob.alive = true;
    mob.state = "idle";
    mob.timer = 0;
    mob.x = mob.homeX;
    mob.z = mob.homeZ;
    mob.group.visible = true;
    mob.group.position.set(mob.x, 0, mob.z);
  }

  function playerHurt(dmg: number, srcX: number, srcZ: number) {
    if (iframe > 0 || mode !== "play" || hurtLock > 0) return;
    let dealt = dmg;
    if (blocking && hasShield()) dealt = Math.max(1, Math.round(dmg * 0.35));
    hp -= dealt;
    hurtLock = 0.45;
    floater(String(dealt), x, 1.7, z);
    shake = 0.16;
    sfx.tone(70, 0.12, "sawtooth", 0.05);
    const dx = x - srcX;
    const dz = z - srcZ;
    const d = Math.hypot(dx, dz) || 1;
    x += (dx / d) * 1.3;
    z += (dz / d) * 1.3;
    if (hp <= 0) {
      hp = 0;
      mode = "dead";
      say("Down. The pad will have you.");
      if (!cookieDead) resetBoss(cookie, COOKIE_HP);
      for (const m of mobs) if (m.kind === "toy") {
        m.alive = false;
        m.group.visible = false;
      }
    }
  }

  function wake() {
    hp = maxHp;
    stam = maxStam;
    x = PAD.x;
    z = PAD.z;
    yaw = Math.PI;
    camYaw = Math.PI;
    mode = "play";
    say("Hearthfen. Still breathing.");
    persist();
  }

  function collide(px: number, pz: number) {
    let cx = px;
    let cz = pz;
    for (const c of circles) {
      const dx = cx - c.x;
      const dz = cz - c.z;
      const d = Math.hypot(dx, dz);
      const min = 0.4 + c.r;
      if (d < min && d > 0.0001) {
        cx += (dx / d) * (min - d);
        cz += (dz / d) * (min - d);
      }
    }
    for (const w of walls) {
      if (!w.on()) continue;
      const minX = w.minX - 0.4;
      const maxX = w.maxX + 0.4;
      const minZ = w.minZ - 0.4;
      const maxZ = w.maxZ + 0.4;
      if (cx < minX || cx > maxX || cz < minZ || cz > maxZ) continue;
      const dl = cx - minX;
      const dr = maxX - cx;
      const df = cz - minZ;
      const db = maxZ - cz;
      const m = Math.min(dl, dr, df, db);
      if (m === dl) cx = minX;
      else if (m === dr) cx = maxX;
      else if (m === df) cz = minZ;
      else cz = maxZ;
    }
    if (cx < 300) {
      cx = Math.max(-40, Math.min(96, cx));
      cz = Math.max(-18, Math.min(110, cz));
    } else {
      cx = Math.max(DUN - 5.4, Math.min(DUN + 5.4, cx));
      cz = Math.max(0.4, Math.min(76, cz));
    }
    return { x: cx, z: cz };
  }

  function nearestPrompt() {
    prompt = "";
    promptFn = null;
    nearBench = dist(-6, 7.2) < 3.2;
    if (nearBench) {
      prompt = "Bench";
      promptFn = () => { mode = "inventory"; };
    }
    let best = nearBench ? 3.2 : 99;
    const consider = (d: number, label: string, fn: () => void) => {
      if (d < best && d < 2.4) {
        best = d;
        prompt = label;
        promptFn = fn;
      }
    };
    for (const n of nodes) {
      consider(dist(n.x, n.z), n.left > 0 ? item(n.def).name : "Spent node", () => gather(n));
    }
    for (const npc of npcs) {
      consider(dist(npc.x, npc.z), npc.name, () => talkTo(npc.id));
    }
    if (!shieldTaken) consider(dist(4.2, 6), "Stump shield", () => {
      shieldTaken = true;
      shieldPickup.visible = false;
      items = addItem(items, "arm_stump_shield", 1, uid);
      say("Stump shield. It is ugly. It blocks.");
    });
    consider(dist(3, -4), "Bedroll", () => {
      daySeconds = (7 / 24) * 1440;
      hp = maxHp;
      stam = maxStam;
      if (maxMana > 0) mana = maxMana;
      say("Dawn. You are mended.");
      persist();
    });
    consider(dist(0, 94), "Castle door", () => {
      const armed = items.some((s) => item(s.def).kind === "weapon" && s.def !== "wpn_fists" && (s.equipped || true) && countOf(items, s.def) > 0 && s.def.startsWith("wpn_") && s.def !== "wpn_fists");
      const hasEdge = ["wpn_stone_knife", "wpn_copper_sword", "wpn_cookie_blade", "wpn_smacko", "wpn_stone_pick"].some((id) => countOf(items, id) > 0);
      if (!hasEdge && !armed) {
        say(LINES.noEdge);
        return;
      }
      x = DUN;
      z = 4;
      yaw = Math.PI;
      camYaw = Math.PI;
      say("Painted wood. Then brass.");
    });
    if (x > 300 && z < 8) consider(dist(DUN, 4), "Leave", () => {
      x = 0;
      z = 90;
      yaw = Math.PI;
      camYaw = Math.PI;
      say(cookieDead ? LINES.cookieDead : "The hill is behind you.");
      persist();
    });
    if (x > 300 && !doorOpen) consider(dist(DUN - 2, 44), "Heave the weight", () => {
      doorOpen = true;
      weight.position.set(DUN + 2, 0, 48);
      say("The slab answers the weight.");
      sfx.tone(180, 0.2, "triangle", 0.05);
    });
    consider(dist(30, 8), gateOpen(seals) ? "Green Gate" : "Sealed gate", () => {
      say(gateOpen(seals) ? LINES.gateOpen : LINES.gateShut);
    });
    if (cookieDead) consider(dist(cookie.x, cookie.z), "Still toys", () => say(LINES.cookieDead));
  }

  function talkTo(id: string) {
    if (id === "tanic") {
      talked = true;
      const lines = [LINES.tanic1, LINES.tanic2];
      const hasEdge = countOf(items, "wpn_stone_knife") > 0 || countOf(items, "wpn_copper_sword") > 0;
      if (hasEdge && !ember) {
        ember = true;
        maxMana = 20;
        mana = 20;
        lines.push(LINES.learned);
      }
      if (cookieDead) lines.push(LINES.tanic3);
      openTalk("Tanic", lines);
      return;
    }
    if (id === "child") {
      rhyme = true;
      openTalk("The children", [LINES.rhyme]);
      return;
    }
    if (id === "mara") return openTalk("Mara", [LINES.mara]);
    if (id === "penn") return openTalk("Old Penn", [LINES.penn]);
    if (id === "bramble") return openTalk("Captain Bramble", [LINES.bramble]);
    if (id === "voss") return openTalk("Castellan Voss", [gateOpen(seals) ? LINES.vossOpen : LINES.vossClosed]);
  }

  function stepMob(mob: Mob, dt: number) {
    if (!mob.alive) return;
    if (mob.kind === "cookie" && cookieDead) return;
    if (mob.kind === "boe" && boeDead) return;
    const inArena = x > 300 === mob.x > 300;
    const d = dist(mob.x, mob.z);
    const sees = inArena && d < mob.aggro && mode === "play";
    mob.timer -= dt;
    if (mob.state === "idle") {
      if (sees) {
        mob.state = "tele";
        mob.timer = mob.tele;
        mob.struck = false;
        if (mob.kind === "cookie") sfx.tone(520, 0.1, "sine", 0.03);
      } else {
        mob.x += Math.sin(performance.now() / 700 + mob.homeX) * dt * 0.15;
      }
    } else if (mob.state === "tele") {
      const dx = x - mob.x;
      const dz = z - mob.z;
      const len = Math.hypot(dx, dz) || 1;
      mob.yaw = Math.atan2(-dx, -dz);
      if (mob.kind !== "cookie" || cookie.hp > COOKIE_HP * 0.66) {
        mob.x += (dx / len) * mob.speed * 0.35 * dt;
        mob.z += (dz / len) * mob.speed * 0.35 * dt;
      }
      if (mob.timer <= 0) {
        mob.state = "strike";
        mob.timer = 0.18;
      }
    } else if (mob.state === "strike") {
      if (!mob.struck) {
        mob.struck = true;
        if (d < mob.range + 0.45) playerHurt(mob.damage, mob.x, mob.z);
        if (mob.kind === "cookie" && cookie.hp <= COOKIE_HP * 0.66 && d < 3.3) playerHurt(18, mob.x, mob.z);
        if (mob.kind === "boe") {
          x += -Math.sin(mob.yaw) * 1.6;
          z += -Math.cos(mob.yaw) * 1.6;
        }
      }
      if (mob.timer <= 0) {
        mob.state = "recover";
        mob.timer = mob.kind === "elite" ? 0.9 : 0.55;
      }
    } else if (mob.state === "recover") {
      if (mob.timer <= 0) mob.state = "idle";
    }
    if (mob.kind === "cookie" && mob.alive) {
      const phase3 = mob.hp <= COOKIE_HP * 0.33;
      boxHazard.visible = phase3;
      if (phase3) {
        const swingT = (performance.now() / 1000) % 4;
        const side = swingT < 2 ? 1 : -1;
        boxHazard.position.set(DUN + side * 3, 0.7 + Math.sin(swingT * 4) * 0.2, 62 + (swingT % 2) * 4);
        if (Math.hypot(x - boxHazard.position.x, z - boxHazard.position.z) < 1.25) playerHurt(12, boxHazard.position.x, boxHazard.position.z);
      }
      const toys = mobs.filter((m) => m.kind === "toy" && m.alive).length;
      if (sees && toys + pendingToys.length < 4 && Math.random() < dt * 0.12) {
        pendingToys.push({ x: mob.x + (Math.random() - 0.5) * 3, z: mob.z + 1.5 });
      }
    }
    mob.group.position.set(mob.x, 0, mob.z);
    mob.group.rotation.y = mob.yaw + Math.PI;
    if (mob.state === "tele") {
      const bow = mob.kind === "cookie" ? 0.7 : 0.35;
      mob.group.rotation.x = Math.sin((mob.tele - mob.timer) * 18) * bow * 0.25 + (mob.kind === "cookie" ? 0.35 : 0.2);
    } else mob.group.rotation.x = 0;
    if (mob.kind === "cookie" && mob.hp <= COOKIE_HP * 0.66 && mob.state === "strike") {
      mob.group.rotation.y += 12 * dt;
    }
  }

  function step(dt: number) {
    daySeconds += dt;
    if (toastT > 0) toastT -= dt;
    if (toastT <= 0) toast = "";
    if (bannerT > 0) {
      bannerT -= dt;
      if (bannerT <= 0) banner = "";
    }
    for (let i = floaters.length - 1; i >= 0; i--) {
      floaters[i].life -= dt;
      floaters[i].y += dt;
      if (floaters[i].life <= 0) floaters.splice(i, 1);
    }
    if (!playing || mode === "menu") {
      speed = 0;
      return;
    }
    if (mode === "inventory" || mode === "talk" || mode === "dead") {
      speed = 0;
      stam = Math.min(maxStam, stam + 10 * dt);
      return;
    }
    let ix = 0;
    let iz = 0;
    if (keys.has("KeyW") || keys.has("ArrowUp")) iz += 1;
    if (keys.has("KeyS") || keys.has("ArrowDown")) iz -= 1;
    if (keys.has("KeyD") || keys.has("ArrowRight")) ix += 1;
    if (keys.has("KeyA") || keys.has("ArrowLeft")) ix -= 1;
    ix += stickX;
    iz += -stickY;
    const mag = Math.hypot(ix, iz);
    if (mag > 1) {
      ix /= mag;
      iz /= mag;
    }
    const fx = -Math.sin(camYaw);
    const fz = -Math.cos(camYaw);
    const rx = Math.cos(camYaw);
    const rz = -Math.sin(camYaw);
    let wx = fx * iz + rx * ix;
    let wz = fz * iz + rz * ix;
    const moving = Math.hypot(wx, wz) > 0.08;
    const stickMag = Math.hypot(stickX, stickY);
    const sprint = (keys.has("ShiftLeft") || keys.has("ShiftRight") || stickMag > 0.92) && stam > 1 && moving;
    const target = moving ? (sprint ? SPEEDS.sprint : SPEEDS.walk) * Math.min(1, Math.hypot(wx, wz)) : 0;
    speed = target;
    if (sprint) stam = Math.max(0, stam - 12 * dt);
    else stam = Math.min(maxStam, stam + 14 * dt);
    if (moving) {
      const face = Math.atan2(-wx, -wz);
      const diff = Math.atan2(Math.sin(face - yaw), Math.cos(face - yaw));
      const stepTurn = 10 * dt;
      yaw += Math.abs(diff) < stepTurn ? diff : Math.sign(diff) * stepTurn;
      if (!looking) {
        const cd = Math.atan2(Math.sin(yaw - camYaw), Math.cos(yaw - camYaw));
        camYaw += cd * (1 - Math.exp(-4 * dt));
      }
    }
    if (iframe > 0) iframe -= dt;
    if (hurtLock > 0) hurtLock -= dt;
    if (attackCd > 0) attackCd -= dt;
    if (swing > 0) swing -= dt;
    if (holdingAttack) attackHold += dt;
    if (dodgeLeft > 0) {
      dodgeLeft -= dt;
      x += dodgeX * dt;
      z += dodgeZ * dt;
    } else if (moving) {
      const len = Math.hypot(wx, wz) || 1;
      x += (wx / len) * speed * dt;
      z += (wz / len) * speed * dt;
    }
    const solved = collide(x, z);
    x = solved.x;
    z = solved.z;
    if (maxMana > 0 && !mobs.some((m) => m.alive && dist(m.x, m.z) < 8)) mana = Math.min(maxMana, mana + 3 * dt);
    for (const mob of mobs) stepMob(mob, dt);
    while (pendingToys.length) {
      const t = pendingToys.pop()!;
      const toy = makeMob("toy", t.x, t.z, 12, 0xf4f1ea, 6, 10, 0.25, 3.3, true);
      toy.homeX = toy.x;
      toy.homeZ = toy.z;
    }
    for (const n of nodes) {
      if (n.left <= 0) n.mesh.scale.setScalar(0.35);
      else n.mesh.scale.setScalar(1);
    }
    if (shieldTaken) shieldPickup.visible = false;
    gateBar.position.y = gateOpen(seals) ? 4.6 : 2.4;
    doorSlab.position.y = doorOpen ? 4.2 : 1.5;
    if (x > 32 && x < 36 && gateOpen(seals) && z > 5 && z < 11) {
      /* crossed */
    }
    nearestPrompt();
    const trap = x > 300 && z > 26 && z < 31 && Math.abs(x - DUN) < 3.2;
    if (trap && mode === "play") {
      trapArm += dt;
      if (trapArm > 0.65 && !trapFired) {
        trapFired = true;
        playerHurt(14, x, z + 1);
        say("The floor finished its tell.");
      }
    } else {
      trapArm = 0;
      trapFired = false;
    }
    saveT += dt;
    if (saveT > 8) {
      saveT = 0;
      persist();
    }
  }

  function render(dt: number) {
    const portrait = canvas.clientHeight > canvas.clientWidth;
    const dist = portrait ? 6.4 : 8.2;
    const height = portrait ? 4.6 : 3.1;
    const cfx = -Math.sin(camYaw);
    const cfz = -Math.cos(camYaw);
    const wantX = x - cfx * dist;
    const wantZ = z - cfz * dist;
    const wantY =  height + (shake > 0 ? (Math.random() - 0.5) * shake : 0);
    const k = 1 - Math.exp(-6 * dt);
    camera.position.x += (wantX - camera.position.x) * k;
    camera.position.y += (wantY - camera.position.y) * k;
    camera.position.z += (wantZ - camera.position.z) * k;
    camera.lookAt(x, 1.3, z);
    if (shake > 0) shake = Math.max(0, shake - dt);
    player.position.set(x, 0, z);
    player.rotation.y = yaw + Math.PI;
    player.visible = iframe > 0 ? Math.sin(performance.now() / 40) > 0 : true;
    const bob = speed > 0.4 ? Math.sin(performance.now() / 140) : 0;
    legL.rotation.x = bob * 0.7;
    legR.rotation.x = -bob * 0.7;
    armR.rotation.x = swing > 0 ? -1.4 : bob * 0.4;
    armL.rotation.x = -bob * 0.3;
    const h = hour();
    const isNight = h >= 16 || h < 5;
    const sky = isNight ? 0x1c2430 : h < 8 ? 0xe7c39a : 0xc4b49a;
    const fog = scene.fog as THREE.Fog;
    fog.color.setHex(sky);
    renderer.setClearColor(sky);
    hemi.intensity = isNight ? 0.28 : 0.92;
    dir.intensity = isNight ? 0.18 : 1.15;
    dir.color.setHex(isNight ? 0x8aa0c8 : 0xf0d7a8);
    renderer.render(scene, camera);
  }

  let last = performance.now();
  let acc = 0;
  let raf = 0;
  const loop = (now: number) => {
    const frameDt = Math.min(0.05, (now - last) / 1000);
    last = now;
    acc += frameDt;
    while (acc >= 1 / 60) {
      step(1 / 60);
      acc -= 1 / 60;
    }
    resize();
    render(frameDt);
    hudT += frameDt;
    if (hudT > 0.1) {
      hudT = 0;
      pushHud();
    }
    raf = requestAnimationFrame(loop);
  };

  function resize() {
    const w = canvas.clientWidth || 1;
    const h = canvas.clientHeight || 1;
    const pr = Math.min(window.devicePixelRatio || 1, w < 700 ? 1.5 : 2);
    if (canvas.width !== Math.floor(w * pr) || canvas.height !== Math.floor(h * pr)) {
      renderer.setPixelRatio(pr);
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
  }

  const onKeyDown = (e: KeyboardEvent) => {
    keys.add(e.code);
    if (e.code === "KeyJ") press("attackDown");
    if (e.code === "KeyK") press("dodge");
    if (e.code === "KeyE") press("interact");
    if (e.code === "KeyF") press("blockDown");
    if (e.code === "KeyQ") press("ember");
    if (e.code === "KeyI") press("bag");
    if (e.code === "Escape") press("close");
  };
  const onKeyUp = (e: KeyboardEvent) => {
    keys.delete(e.code);
    if (e.code === "KeyJ") press("attackUp");
    if (e.code === "KeyF") press("blockUp");
  };
  const onBlur = () => keys.clear();
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", onBlur);

  function press(what: Parameters<GameApi["press"]>[0]) {
    sfx.go();
    if (what === "attackDown") {
      holdingAttack = true;
      attackHold = 0;
    }
    if (what === "attackUp") {
      if (holdingAttack) strike(attackHold > 0.28);
      holdingAttack = false;
      attackHold = 0;
    }
    if (what === "dodge" && mode === "play" && dodgeLeft <= 0 && stam >= 16) {
      stam -= 16;
      iframe = 0.25;
      dodgeLeft = 0.22;
      const fx = -Math.sin(yaw);
      const fz = -Math.cos(yaw);
      dodgeX = fx * 9;
      dodgeZ = fz * 9;
      sfx.tone(240, 0.06, "sine", 0.03);
    }
    if (what === "interact") interact();
    if (what === "blockDown") blocking = true;
    if (what === "blockUp") blocking = false;
    if (what === "ember") castEmber();
    if (what === "bag") mode = mode === "inventory" ? "play" : "inventory";
    if (what === "close") {
      if (mode === "inventory" || mode === "talk") mode = "play";
      banner = "";
    }
    if (what === "wake") wake();
    if (what === "talk") interact();
    pushHud();
  }

  function start(opts: { name: string; hair: "tied" | "short"; cont: boolean }) {
    sfx.go();
    const saved = opts.cont ? readSave() : null;
    if (saved) applySave(saved);
    else {
      name = opts.name.trim().slice(0, 18) || "Walker";
      hair = opts.hair;
      x = PAD.x;
      z = PAD.z;
      yaw = Math.PI;
      camYaw = Math.PI;
      hp = 80;
      stam = 60;
      mana = 0;
      maxMana = 0;
      items = [];
      seals = [];
      ember = false;
      talked = false;
      rhyme = false;
      cookieDead = false;
      doorOpen = false;
      boeDead = false;
      shieldTaken = false;
      skillHits = 0;
      daySeconds = (8 / 24) * 1440;
      freshBags();
      for (const n of nodes) n.left = n.max;
      resetBoss(cookie, COOKIE_HP);
      cookieDead = false;
      cookie.alive = true;
      cookie.group.visible = true;
      resetBoss(boe, BOE_HP);
    }
    if (cookieDead) {
      cookie.alive = false;
      cookie.group.visible = false;
    }
    if (boeDead) {
      boe.alive = false;
      boe.group.visible = false;
    }
    syncHair();
    syncWeapon();
    playing = true;
    mode = "play";
    say(saved ? "The road kept your pockets." : "Hearthfen. Fists, cloth, no class.");
    persist();
    pushHud();
  }

  resize();
  raf = requestAnimationFrame(loop);
  pushHud();

  const api: GameApi = {
    dispose() {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      renderer.dispose();
      if (window.__controlsTest) delete window.__controlsTest;
      if (window.__veyr) delete window.__veyr;
    },
    start,
    setKeys(codes) {
      keys.clear();
      for (const c of codes) keys.add(c);
    },
    setStick(sx, sy) {
      stickX = sx;
      stickY = sy;
    },
    look(dx) {
      looking = true;
      camYaw -= dx * 0.005;
      window.setTimeout(() => { looking = false; }, 400);
    },
    press,
    equipUid(id) {
      items = equip(items, id);
      syncWeapon();
      pushHud();
    },
    useUid(id) {
      const s = items.find((it) => it.uid === id);
      if (!s) return;
      const d = item(s.def);
      if (d.kind === "consumable" && d.heal > 0) {
        const next = consume(items, d.id, 1);
        if (!next) return;
        items = next;
        hp = Math.min(maxHp, hp + d.heal);
        say("Bound. " + d.heal + " back.");
      } else if (d.slot !== "none") {
        items = equip(items, id);
        syncWeapon();
      }
      pushHud();
    },
    craft: doCraft,
    getYaw: () => yaw,
    getSpeed: () => speed,
    subscribe(fn) {
      subs.add(fn);
      fn(snapshot());
      return () => subs.delete(fn);
    },
  };

  window.__controlsTest = {
    getYaw: () => yaw,
    getSpeed: () => speed,
    setKeys: (codes: string[]) => api.setKeys(codes),
  };
  window.__veyr = {
    pos: () => ({ x, z, hp, place: placeName() }),
    items: () => items.map((s) => s.def + ":" + s.count),
    seals: () => [...seals],
    give: (def: string, n: number) => { items = addItem(items, def, n, uid); pushHud(); },
    teleport: (px: number, pz: number) => { x = px; z = pz; },
    strike: () => strike(false),
    heavy: () => strike(true),
    interact: () => interact(),
    craft: (id: string) => doCraft(id),
    cookie: () => cookie.hp,
    seal: () => gateOpen(seals),
    face: (y: number) => { yaw = y; camYaw = y; },
    aim: (px: number, pz: number) => {
      yaw = Math.atan2(-(px - x), -(pz - z));
      camYaw = yaw;
    },
    mobs: () => mobs.filter((m) => m.alive).map((m) => ({ k: m.kind, x: m.x, z: m.z, hp: m.hp })),
    sip: () => {
      const next = consume(items, "cons_bandage", 1);
      if (!next) return false;
      items = next;
      hp = Math.min(maxHp, hp + item("cons_bandage").heal);
      pushHud();
      return true;
    },
    door: () => doorOpen,
  };

  return api;
}

declare global {
  interface Window {
    __controlsTest?: { getYaw: () => number; getSpeed: () => number; setKeys: (codes: string[]) => void };
    __veyr?: {
      pos: () => { x: number; z: number; hp: number; place: string };
      items: () => string[];
      seals: () => string[];
      give: (def: string, n: number) => void;
      teleport: (x: number, z: number) => void;
      strike: () => void;
      heavy: () => void;
      interact: () => void;
      craft: (id: string) => void;
      cookie: () => number;
      seal: () => boolean;
      face: (yaw: number) => void;
      aim: (x: number, z: number) => void;
      mobs: () => { k: string; x: number; z: number; hp: number }[];
      sip: () => boolean;
      door: () => boolean;
    };
  }
}
