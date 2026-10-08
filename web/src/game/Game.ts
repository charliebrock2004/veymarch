import * as THREE from "three";
import { CACHE_DEFS, DESCRIPTIONS, ITEMS, MOB_SPAWNS, MORE_LINES, RECIPES, SET_BONUS, SPEEDS, TRADES, type ItemDef } from "./content";
import { MODIFIERS, moddedName } from "./data/items.ts";
import { BOSSES, type BossDef } from "./data/bosses.ts";
import { LEVEL_XP, armourCut, levelOf, statsFor } from "./data/progression.ts";
import { QUEST_BY_ID, type QuestStep } from "./data/quests.ts";
import { SELL_RATE, SHOPS } from "./data/shops.ts";
import { autoStarts, journal, npcBusiness, readyToStep, tracked, type JournalEntry, type QuestBook, type QuestCtx } from "./systems/quests.ts";
import { addItem, canMine, consume, countOf, equip, equipped, gateOpen, grantUniques, item, recipeHint, strikeDamage, tryCraft, type Stack } from "./rules";
import { Audio } from "./engine/audio";
import type { ThemeId } from "./engine/music";
import { armourCode, armourLook } from "./play/gear";
import { Beam, DecalPool, Flashes } from "./engine/fx";
import { shared } from "./engine/kit";
import { makeMaterials } from "./engine/materials";
import { Particles, buildGlows } from "./engine/particles";
import { Poser, buildHuman, poseHuman, type ArmourLook, type HumanAction, type HumanLook, type Rig } from "./engine/rig";
import { buildSky } from "./engine/sky";
import { blockTex } from "./engine/textures";
import { buildDungeon, type Dungeon } from "./world/dungeon";
import { DUN, GATE, REGION_TITLE, SPAWN, regionAt } from "./world/layout";
import { PORTALS, SHRINES, STATIONS, STATION_NAMES, ZONES, toWorld, zoneAt, type PortalDef, type Station, type ZoneId } from "./data/zones";
import { buildOverworld, type NodeDef, type Overworld } from "./world/overworld";
import { ZONE_BUILDERS, type ZoneBuild, type ZoneEnv } from "./world/zone";
import "./world/zones/index";
import { Cookie } from "./play/boss";
import { BOSS_FACTORIES, type Boss, type BossEnv, type Hazard } from "./play/bossapi";
import "./play/bosses/index";
import type { Env, HurtOpts, PlayerState } from "./play/env";
import { MOBS, Mob, type MobKind, type MobSnap } from "./play/mobs";
import { NPCS, Npc, VOSS_NPCS } from "./play/npcs";
import { RemotePlayer, type NetPlayer } from "./play/remote";
import { weaponModel } from "./play/weapons";
import type { BossJson, CharacterJson, EnterJson, HeartbeatJson, QuestJson, Realm, StackJson } from "../net/realm";
import { Room, type Bundle, type Ev } from "../net/room";

// ------------------------------------------------------------------ public types

export type Look = { body: 0 | 1 | 2; skin: number; hair: 0 | 1 | 2 | 3; hairColor: number; coat: number };
export const SKINS = [0xf0d8c0, 0xe2c0a0, 0xc8a080, 0xa07858, 0x6e4a32];
export const HAIRS = [0x2a2118, 0x5a3a22, 0x8a5a2a, 0xb89a6a, 0x9a3a22, 0xd8d0c4];
export const COATS = [0x7a6248, 0x5e6b45, 0x6a3b2a, 0x3c4458, 0x8a7a5a, 0x2e2a26];
export const HAIR_STYLES = ["tied", "short", "long", "bald"] as const;
export const BODY_NAMES = ["Slight", "Average", "Broad"];

export type Quality = "low" | "medium" | "high";
export type Mode = "loading" | "title" | "create" | "play" | "bag" | "talk" | "dead" | "reward" | "end" | "pause" | "shop" | "journal" | "map";

/** Menus that sit over play (a shared world keeps running behind them). */
export const MENU_MODES: Mode[] = ["bag", "talk", "pause", "shop", "journal", "map"];

/** Multiplayer status for the HUD; null in single player. */
export type OnlineHud = {
  /** a single player world on this device */
  solo: boolean;
  code: string;
  world: string;
  day: number;
  status: "connecting" | "connected" | "closed";
  runner: boolean;
  players: { name: string; hp: number; max: number; dead: boolean; me: boolean; away: boolean; zone: string }[];
};

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
  talk: { name: string; role: string; text: string; more: boolean; trades: { id: string; label: string; ok: boolean }[]; shop: string | null } | null;
  /** level, experience inside it (0..1), and the numbers behind it */
  level: number;
  xp: number;
  xpLo: number;
  xpHi: number;
  crowns: number;
  defence: number;
  /** a full-screen announcement (KINGDOM UNLOCKED, a level, a finished quest) */
  banner: { title: string; sub: string; at: number } | null;
  journal: JournalEntry[];
  /** shrines for fast travel: open while resting at one */
  map: { here: string | null; shrines: { id: string; name: string; zone: string; zoneName: string; known: boolean; here: boolean }[] } | null;
  shop: { id: string; name: string; buys: boolean; stock: { id: string; name: string; price: number; ok: boolean }[]; sell: { uid: string; id: string; name: string; count: number; price: number }[] } | null;
  boss: { id: string; name: string; hp: number; max: number; phase: number; phaseName: string } | null;
  /** the boss line on screen (Finlay speaks) */
  bossLine: { text: string; at: number } | null;
  items: { uid: string; id: string; name: string; count: number; equipped: boolean; kind: string; slot: string; desc: string; dmg: number; def: number; rarity: string; tier: number; passive: string; set: string; mod: string; modText: string; enchants: { id: string; name: string; text: string; cost: string; ok: boolean }[] }[];
  crafts: { id: string; name: string; out: string; ok: boolean; have: string; station: string; can: boolean }[];
  station: Station;
  hour: number;
  night: boolean;
  reward: { id: string; name: string; desc: string }[] | null;
  rewardText: { title: string; sub: string; seal: string } | null;
  fade: number;
  stats: { time: number; deaths: number; kills: number };
  hurtAt: number;
  quality: Quality;
  muted: boolean;
  combat: boolean;
  charge: number;
  inDungeon: boolean;
  zone: ZoneId;
  fps: number;
  online: OnlineHud | null;
};

export type Press =
  | "attackDown" | "attackUp" | "dodge" | "interact" | "blockDown" | "blockUp" | "ember" | "bag" | "close" | "talk" | "wake" | "pause" | "resume" | "endClose" | "rewardClose" | "title" | "heal";

export type GameApi = {
  dispose: () => void;
  subscribe: (fn: (h: Hud) => void) => () => void;
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
  /** at the enchanter's lectern: set a modifier on a piece you carry */
  enchant: (uid: string, mod: string) => void;
  trade: (id: string) => void;
  openShop: (id: string) => void;
  buy: (item: string, n: number) => void;
  sell: (uid: string, n: number) => void;
  journal: () => void;
  travel: (shrine: string) => void;
  setQuality: (q: Quality) => void;
  setMuted: (m: boolean) => void;
  /** Enters a persistent world with a server character (the result of vm_join / vm_enter). */
  startOnline: (realm: Realm, enter: EnterJson) => void;
};

// ------------------------------------------------------------------ progress flags

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

const freshFlags = (): Flags => ({
  talked: false, ember: false, chest: false, hollow: false, shrine: false, entered: false, slab: false, nursery: false, cookie: false, gate: false, voss: false, ended: false, tanicKnife: false,
});

function lookToHuman(l: Look, armour?: ArmourLook): HumanLook {
  return {
    armour,
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

type Interact = { x: number; z: number; r: number; zone: ZoneId; label: () => string | null; act: () => void; facing?: boolean };

type Projectile = { x: number; y: number; z: number; vx: number; vz: number; life: number; zone: ZoneId };

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

/** What the reward screen says when each boss falls. */
const REWARD_TEXT: Record<string, { title: string; sub: string; seal: string }> = {
  cookie: { title: "Cookie is defeated", sub: "The music box winds down. The toys go still.", seal: "Seal broken · The Green Gate answers the Core." },
  boe: { title: "Boe rests", sub: "The collar goes dark. He licks your hand, once, and lies down.", seal: "The red collar · Elspeth will want it back." },
  finlay: { title: "Finlay falls", sub: "The captain of the March kneels in the black rain and does not get up.", seal: "The Black Keep is silent." },
};

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
  /** every boss built so far (one per zone at most), by id */
  const bosses = new Map<string, Boss>();
  /** bosses whose fall this session already handled (the world flag can arrive first) */
  const bossFinished = new Set<string>();
  /** per boss: this character has never been paid for it, so its fall shows the reward screen */
  const rewardDue: Record<string, boolean> = {};
  let rewardBoss = "cookie";
  let doneBoss = "";
  let bossLine: Hud["bossLine"] = null;
  /** hazards under the local player (Finlay's rite): judged by this client */
  const hazards: { h: Hazard; left: number; decal: ReturnType<DecalPool["get"]> }[] = [];

  /** The boss of the zone you stand in. */
  /** A hazard under the local player: a circle that bites after a countdown unless you leave it. */
  function localHazard(h: Hazard) {
    if (P.dead) return;
    if (h.text) speak(h.text, false);
    hazards.push({ h, left: h.t, decal: decals.get() });
    audio.charge();
  }
  function netHazard(q: PlayerState, h: Hazard) {
    if (!online || !q.cid) return;
    online.room.event({ k: "hz", to: q.cid, x: r2(h.x), z: r2(h.z), r: h.r, t: h.t, d: h.dmg, tx: h.text ?? "" }, true);
  }
  function updateHazards(dt: number) {
    for (let i = hazards.length - 1; i >= 0; i--) {
      const hz = hazards[i];
      hz.left -= dt;
      const k = 1 - Math.max(0, hz.left) / hz.h.t;
      hz.decal.show(0, hz.h.x, groundAt(hz.h.x, hz.h.z), hz.h.z, 0, hz.h.r, k, { color: 0x6a8a2a, alpha: 0.5 + k * 0.3 });
      if (hz.left > 0) continue;
      decals.release(hz.decal);
      hazards.splice(i, 1);
      const inside = Math.hypot(P.x - hz.h.x, P.z - hz.h.z) < hz.h.r && !P.dead;
      if (inside) {
        // the rite takes you: no block, no parry, a long stagger
        hurtPlayer(hz.h.dmg, hz.h.x, hz.h.z, { unblockable: true, knock: 2.4 });
        if (!P.dead) startAction("hurt", 1.2, 2);
        sparks.burst(30, P.x, P.y + 1.2, P.z, 3, 0x7a9a3a, 1.0, 0.2, { up: 2 });
        say("The rite takes you.");
      } else floater("Out of the circle", P.x, P.y + 2.2, P.z, "info");
    }
  }

  /** A boss line: a subtitle for everyone, and a voice where the device has one. */
  function speak(text: string, broadcast: boolean) {
    bossLine = { text, at: performance.now() };
    if (broadcast && online) online.room.event({ k: "say", t: text }, true);
    try {
      if (!audio.muted && "speechSynthesis" in window) {
        const u = new SpeechSynthesisUtterance(text);
        u.pitch = 0.55;
        u.rate = 0.92;
        u.volume = 0.9;
        window.speechSynthesis.speak(u);
      }
    } catch {
      /* no voice on this device: the subtitle carries it */
    }
    push();
  }

  function zoneBoss(): Boss | null {
    for (const b of bosses.values()) if (b.def.zone === P.zone) return b;
    return null;
  }
  function arenaOf(d: BossDef) {
    return { x: ZONES[d.zone].ox + d.x, z: d.z, r: d.r };
  }
  function allAdds(): Mob[] {
    const out: Mob[] = [];
    for (const b of bosses.values()) for (const m of b.adds) out.push(m);
    return out;
  }
  const mobs: Mob[] = [];
  const npcs: Npc[] = [];

  // ------------------------------------------------------------ zones
  const zones = new Map<ZoneId, ZoneBuild>();
  const zoneLoads = new Map<ZoneId, Promise<boolean>>();
  let mats: ReturnType<typeof makeMaterials> | null = null;
  /** every world flag the server has told us about (doors, gates, bosses); `flags` keeps the slice's named ones */
  const worldFlags: Record<string, boolean> = {};
  function zoneRoot(z: ZoneId): THREE.Object3D {
    return (zones.get(z) ?? zones.get("over")!).root;
  }
  function groundAt(x: number, z: number) {
    const b = zones.get(zoneAt(x));
    return b ? b.groundAt(x, z) : 0;
  }
  function blockedAt(x: number, z: number) {
    const b = zones.get(zoneAt(x));
    return b?.blocked ? b.blocked(x, z) : false;
  }
  /** Which theme the moment wants, and how hard the fighting is. */
  const CALM_KINDS = new Set<string>(["deer", "horse", "mouse"]);
  function musicNow(): { theme: ThemeId; intensity: number } {
    if (mode === "loading") return { theme: "none", intensity: 0 };
    if (mode === "title" || mode === "create") return { theme: "title", intensity: 0 };
    if (mode === "end") return { theme: "ending", intensity: 0 };
    const b = zoneBoss();
    if (b && b.fighting && b.st !== "intro" && Math.hypot(P.x - b.x, P.z - b.z) < b.def.r + 20) {
      const id = b.def.id;
      if (id === "finlay" && hazards.length > 0) return { theme: "rite", intensity: 1 };
      return { theme: id === "cookie" || id === "boe" || id === "finlay" ? id : "keep", intensity: Math.min(1, b.phaseN / 3 + 0.2) };
    }
    let near = 0;
    for (const m of mobs) {
      if (m.zone !== P.zone || !m.alive || CALM_KINDS.has(m.kind)) continue;
      if (m.state !== "idle" && m.state !== "return" && m.state !== "flee" && Math.hypot(m.x - P.x, m.z - P.z) < 24) near++;
    }
    const intensity = Math.min(1, near / 2);
    const r = region ?? "";
    switch (P.zone) {
      case "over":
        return { theme: r === "hearthfen" ? "hearthfen" : r === "castle" || r === "nursery" ? "castle" : r === "kingdom" ? "kingdom" : "forest", intensity };
      case "castle":
        return { theme: "castle", intensity };
      case "kingdom":
        return { theme: r === "harrenvale" || r === "market" ? "town" : "kingdom", intensity };
      default:
        return { theme: P.zone, intensity };
    }
  }

  function regionTitle(reg: string): [string, string] {
    const t = (REGION_TITLE as Record<string, [string, string]>)[reg] ?? zones.get(P.zone)?.regions?.[reg];
    if (t) return t;
    const zn = ZONES[reg as ZoneId];
    return zn ? [zn.name, zn.sub] : [reg, ""];
  }
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
  // progression (the server owns it; these mirror its last answer)
  let xp = 0;
  let level = 1;
  let xpLo = 0;
  let xpHi = LEVEL_XP[1];
  let quests: QuestBook = {};
  /** caches this character already opened in this world */
  const cacheFlags = new Set<string>();
  const killCounts: Record<string, number> = {};
  /** quest calls in flight, or resting after a "not yet": id -> when it may be asked again */
  const questWait = new Map<string, number>();
  let questT = 0;
  let banner: Hud["banner"] = null;
  let shopId: string | null = null;
  /** consecutive connecting hits (Smacko's fourth hit lands twice) and a riposte after a parry (Finlay's Longsword) */
  let hitChain = 0;
  let riposte = 0;
  let toast = "";
  let toastId = 0;
  let placeName = "";
  let placeSub = "";
  let placeAt = 0;
  let region: string | null = null;
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
  /** shrines this character has rested at in this world (fast travel targets), and where it wakes */
  const discovered = new Set<string>(["hearthfen"]);
  let lastShrine: string | null = null;
  let mapHere: string | null = null;
  let introSeen = false;
  let stationNear: Station = "hand";
  let prompt = "";
  let promptAct: (() => void) | null = null;
  let deadMobs = new Set<string>();
  let ringT = 0;
  let bossDoneT = -1;
  let revealT = 0;
  let revealed = false;
  const good = { x: SPAWN.x, z: SPAWN.z, yaw: 0, cam: 0 };
  let nanWarned = false;

  // ------------------------------------------------------------ online state (null in single player)
  type Online = {
    realm: Realm;
    room: Room;
    worldId: string;
    code: string;
    worldName: string;
    charId: string;
    day: number;
    remotes: Map<string, RemotePlayer>;
    tickT: number;
    beatT: number;
    playAcc: number;
    boss: Record<string, BossJson>;
    arenaEmptyT: number;
    wxSent: number;
    runner: boolean;
    lastBeat: number;
    names: Set<string>;
  };
  let online: Online | null = null;
  /** changes with every new action, so other screens restart a repeated swing */
  let actionCount = 0;
  /** dead foes from the server: key -> seconds until they stand again (Infinity: for good) */
  const deadLeft = new Map<string, number>();
  let pendingRevive: string | null = null;
  let lastBossSt = "";
  /** A reward that arrived while the player was down or in a menu waits for them. */
  let rewardWaiting = false;
  /** the chapter ended while a menu was open: show the ending when play resumes */
  let endingDue = false;
  const r2 = (v: number) => Math.round(v * 100) / 100;

  // player
  const P: PlayerState & {
    stam: number; maxStam: number; mana: number; maxMana: number; vx: number; vz: number; kx: number; kz: number; speed: number;
    action: HumanAction; at: number; dur: number; hitAt: number; hitDone: boolean; combo: number; comboT: number; queued: boolean;
    holding: boolean; holdT: number; dodgeX: number; dodgeZ: number; stamT: number; hurtT: number; deadT: number; phase: number;
    lastStep: number; regenT: number; emberCd: number; sprint: boolean;
  } = {
    x: SPAWN.x, y: 0, z: SPAWN.z, yaw: SPAWN.yaw, hp: 100, maxHp: 100, iframe: 0, blocking: false, blockT: 0, shield: false, dead: false, zone: "over" as ZoneId,
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

  const env: BossEnv = {
    hazard: (q, h) => (q === P ? localHazard(h) : netHazard(q, h)),
    speak: (text) => speak(text, true),
    time: 0,
    player: P,
    hurtPlayer: (d, sx, sz, o) => hurtPlayer(d, sx, sz, o),
    players: () => (online ? [P as PlayerState, ...livePeers()] : [P]),
    hurt: (q, d, sx, sz, o) => (q === P ? env.hurtPlayer(d, sx, sz, o) : netHurt(q, d, sx, sz, o)),
    dust, sparks, decals, flashes, beam, audio,
    col: null as unknown as Env["col"],
    groundAt: (x, z) => groundAt(x, z),
    blocked: (x, z) => blockedAt(x, z),
    shake: (a) => (shake = Math.max(shake, a)),
    heard: (x, z, zn, r = 45) => zn === P.zone && Math.hypot(x - P.x, z - P.z) < r,
    floater: (t, x, y, z, k) => floater(t, x, y, z, k),
    combat: () => (combatT = 3),
    parent: (zn) => zoneRoot(zn),
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
      for (const m of mobs) if (m.alive && m.hp < m.max && m.zone === P.zone && m.distTo(P.x, P.z) < 26) list.push({ id: m.id, x: m.x, y: m.y + m.cfg.height + 0.5, z: m.z, hp: m.hp, max: m.max });
      for (const m of allAdds()) if (m.alive && m.hp < m.max && m.zone === P.zone) list.push({ id: m.id, x: m.x, y: m.y + m.cfg.height + 0.5, z: m.z, hp: m.hp, max: m.max });
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
    if (online) {
      const now = performance.now();
      const inWorld = mode !== "title" && mode !== "create" && mode !== "loading";
      for (const r of online.remotes.values()) {
        const st = r.state;
        const dist = Math.hypot(st.x - P.x, st.z - P.z);
        const p = inWorld && r.rig.group.visible && dist < 55 ? project(st.x, st.y + 2.2, st.z) : null;
        if (!p || !r.live(now)) {
          r.plate.style.display = "none";
          continue;
        }
        r.plate.style.display = "";
        r.plate.style.transform = `translate3d(${p.x}px, ${p.y}px, 0) translate(-50%, -100%)`;
        r.plate.style.opacity = String(Math.max(0.35, Math.min(1, 1.4 - dist / 40)));
        r.plate.classList.toggle("down", st.dead);
        r.plate.classList.toggle("hurt", st.hp < st.maxHp);
        ((r.plate.lastChild as HTMLElement).firstChild as HTMLElement).style.width = `${Math.max(0, Math.min(100, (st.hp / st.maxHp) * 100))}%`;
      }
    }
  }

  /** the modifier on the weapon in hand ("" for none) */
  function mainMod() {
    return items.find((s) => s.equipped && ITEMS[s.def]?.slot === "main")?.mod ?? "";
  }
  function mainWeapon() {
    const eq = equipped(items, "main");
    return item(eq?.def ?? "wpn_fists");
  }

  function equippedDefs(): ItemDef[] {
    const out: ItemDef[] = [];
    for (const s of items) if (s.equipped && ITEMS[s.def]) out.push(ITEMS[s.def]);
    return out;
  }
  /** Body armour (not the shield, which works by blocking). */
  function gearDefence() {
    let d = 0;
    for (const it of equippedDefs()) if (it.kind === "armour" && it.slot !== "off") d += it.defence;
    for (const s of items) if (s.equipped && s.mod) d += MODIFIERS[s.mod]?.def ?? 0;
    return d;
  }
  function setWorn(set: string) {
    return equippedDefs().filter((it) => it.set === set).length >= (SET_BONUS[set]?.pieces ?? 5);
  }
  /** Weapon speed by family: daggers are quick, greatswords take their time. */
  function swingScale(w: ItemDef) {
    return ({ dagger: 0.82, fists: 0.85, sword: 1, spear: 1.05, mace: 1.1, axe: 1.12, greatsword: 1.28, pick: 1 } as Record<string, number>)[w.family] ?? 1;
  }

  let wornCode = "";
  function syncGear() {
    P.calm = items.some((s) => s.equipped && s.def === "trk_hound_bell");
    if (!playerRig) return;
    // armour is part of the body mesh: a change of armour rebuilds the body (this runs again from there)
    const code = armourCode(armourLook(equippedDefs()));
    if (code !== wornCode) {
      wornCode = code;
      buildPlayer();
      return;
    }
    const w = mainWeapon();
    if (heldMain) heldMain.parent?.remove(heldMain);
    heldMain = null;
    if (w.id !== "wpn_fists") {
      heldMain = weaponModel(w.id);
      playerRig.sockets.gripR.add(heldMain);
    }
    const shield = items.find((s) => s.equipped && ITEMS[s.def]?.moveset === "shield");
    const sh = !!shield;
    P.shield = sh;
    if (heldOff) heldOff.parent?.remove(heldOff);
    heldOff = null;
    if (sh) {
      heldOff = weaponModel(shield.def === "arm_stump_shield" ? "shield" : shield.def);
      heldOff.rotation.set(0, Math.PI / 2, 0);
      heldOff.position.set(0.06, 0.05, -0.1);
      playerRig.bones.foreL.add(heldOff);
    }
  }

  function buildPlayer() {
    if (!world) return;
    const pose = playerRig ? { p: playerRig.group.position.clone(), r: playerRig.group.rotation.y, v: playerRig.group.visible } : null;
    if (playerRig) playerRig.group.parent?.remove(playerRig.group);
    wornCode = armourCode(armourLook(equippedDefs()));
    playerRig = buildHuman(lookToHuman(look, armourLook(equippedDefs())));
    if (pose) {
      playerRig.group.position.copy(pose.p);
      playerRig.group.rotation.y = pose.r;
      playerRig.group.visible = pose.v;
    }
    playerPoser = new Poser(playerRig);
    zoneRoot(P.zone).add(playerRig.group);
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
  /** The first portal on the way from this zone toward another (doors form a small graph). */
  function wayTo(target: ZoneId): THREE.Vector3 | null {
    if (target === P.zone) return null;
    const prev = new Map<ZoneId, PortalDef>();
    const seen = new Set<ZoneId>([P.zone]);
    const queue: ZoneId[] = [P.zone];
    while (queue.length) {
      const z = queue.shift()!;
      for (const p of PORTALS) {
        if (p.from !== z || seen.has(p.to)) continue;
        seen.add(p.to);
        prev.set(p.to, p);
        queue.push(p.to);
      }
    }
    let step = prev.get(target);
    if (!step) return null;
    while (step.from !== P.zone) step = prev.get(step.from)!;
    const w = toWorld(step.from, step.x, step.z);
    return new THREE.Vector3(w.x, 0, w.z);
  }

  /** Where a quest step points: its NPC, place, foe, boss arena or the door toward its zone. */
  function stepTarget(step: QuestStep): THREE.Vector3 | null {
    if (step.npc) {
      const n = npcs.find((x) => x.def.id === step.npc);
      if (n) return n.zone === P.zone ? new THREE.Vector3(n.x, 0, n.z) : wayTo(n.zone);
    }
    if (step.zone) {
      if (step.zone !== P.zone) return wayTo(step.zone);
      if (step.x !== undefined && step.z !== undefined) return new THREE.Vector3(ZONES[step.zone].ox + step.x, 0, step.z);
      return null;
    }
    if (step.boss) {
      const b = BOSSES[step.boss];
      if (b) return b.zone === P.zone ? new THREE.Vector3(ZONES[b.zone].ox + b.x, 0, b.z) : wayTo(b.zone);
    }
    if (step.kind) {
      let best: Mob | null = null;
      for (const m of mobs) if (m.alive && m.kind === step.kind && m.zone === P.zone && (!best || m.distTo(P.x, P.z) < best.distTo(P.x, P.z))) best = m;
      if (best) return new THREE.Vector3(best.x, 0, best.z);
      const sp = MOB_SPAWNS.find((x) => x[1] === step.kind);
      if (sp && sp[4] !== P.zone) return wayTo(sp[4]);
    }
    if (step.item) {
      const want = step.item.split("|");
      let best: NodeDef | null = null;
      let bd = 1e9;
      for (const n of zones.get(P.zone)?.nodes ?? [])
        if (want.includes(n.item) && nodeLeft(n) > 0) {
          const d = Math.hypot(n.x - P.x, n.z - P.z);
          if (d < bd) {
            bd = d;
            best = n;
          }
        }
      if (best) return new THREE.Vector3(best.x, 0, best.z);
    }
    return null;
  }

  function objective(): { text: string; sub: string; at: THREE.Vector3 | null } {
    if (!world || !dun) return { text: "", sub: "", at: null };
    const q = online ? tracked(quests) : null;
    if (q) {
      const st = quests[q.id];
      const step = q.steps[st.s];
      if (step) {
        // the castle's own puzzle points at its pieces
        if (step.k === "flag" && step.flag === "slab" && P.zone === "castle") return { text: step.text, sub: step.sub, at: dun.weight.position.clone() };
        if (step.k === "flag" && step.flag === "nursery" && P.zone === "castle") {
          const horse = mobs.find((m) => m.kind === "horse" && m.alive);
          return { text: step.text, sub: step.sub, at: horse ? new THREE.Vector3(horse.x, 0, horse.z) : dun.anchors.nurseryDoor };
        }
        if (step.k === "flag" && step.flag === "gate") return { text: step.text, sub: step.sub, at: P.zone === "over" ? world.anchors.gate : wayTo("over") };
        const prog = step.k === "kill" ? ` · ${Math.min(step.n ?? 1, Math.max(0, (killCounts[step.kind!] ?? 0) - st.b))}/${step.n ?? 1}` : (step.k === "have" || step.k === "give") && (step.n ?? 1) > 1 ? ` · ${Math.min(step.n ?? 1, step.item!.split("|").reduce((n, id) => Math.max(n, countOf(items, id)), 0))}/${step.n}` : "";
        return { text: step.text, sub: step.sub + prog, at: stepTarget(step) };
      }
    }
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
      if (P.zone !== "castle") return { text: "Find Cookie's Castle", sub: "North through the Giant Forest, up the hill", at: a.castleDoor };
      if (!flags.slab) return { text: "Move the brass weight", sub: "Push it onto the plate, or heave it", at: dun.weight.position.clone() };
      if (!flags.nursery) {
        const horse = mobs.find((m) => m.kind === "horse" && m.alive);
        return { text: "Silence the rocking horse", sub: "The toy gallery", at: horse ? new THREE.Vector3(horse.x, 0, horse.z) : dun.anchors.nurseryDoor };
      }
      return { text: "Defeat Cookie", sub: "The nursery courtyard. Dodge the bow.", at: dun.anchors.arena };
    }
    if (P.zone === "castle") return { text: "Leave the castle", sub: "The courtyard gate is open", at: dun.anchors.exitGate };
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
    if (obj.at && zoneAt(obj.at.x) === P.zone) {
      const ang = Math.atan2(obj.at.x - P.x, obj.at.z - P.z);
      bearing = Math.atan2(Math.sin(ang - camYaw), Math.cos(ang - camYaw));
      dist = Math.hypot(obj.at.x - P.x, obj.at.z - P.z);
    }
    const zb = zoneBoss();
    const bossOn = zb && zb.fighting;
    return {
      mode, loading, name,
      hp: Math.ceil(P.hp), maxHp: P.maxHp, stam: P.stam, maxStam: P.maxStam, mana: P.mana, maxMana: P.maxMana,
      ember: flags.ember, emberReady: P.mana >= 8 && P.emberCd <= 0,
      weapon: w.name, weaponId: w.id, shield: P.shield,
      prompt, objective: obj.text, objectiveSub: obj.sub, bearing, dist, camYaw,
      place: placeName, placeSub, placeAt, toast, toastId, talk,
      boss: bossOn ? { id: zb.def.id, name: zb.def.name, hp: zb.hp, max: zb.max, phase: zb.phaseN, phaseName: zb.phaseNames[zb.phaseN] ?? "" } : null,
      bossLine, rewardText: reward ? REWARD_TEXT[rewardBoss] ?? null : null,
      items: items.filter((s) => ITEMS[s.def] && ITEMS[s.def].kind !== "coin").map((s) => {
        const d = item(s.def);
        return {
          uid: s.uid, id: s.def, name: moddedName(d.name, s.mod), count: s.count, equipped: s.equipped, kind: d.kind, slot: d.slot, desc: DESCRIPTIONS[s.def] ?? "",
          dmg: d.damage, def: d.defence, rarity: d.rarity, tier: d.tier, passive: d.passive ?? "", set: d.set ?? "",
          mod: s.mod ?? "", modText: s.mod && MODIFIERS[s.mod] ? MODIFIERS[s.mod].text : "",
          // at the enchanter's lectern: the modifiers this piece can take, and their price
          enchants: stationNear === "enchanter" && !d.soulbound && d.stack === 1 && d.moveset.indexOf("pick") < 0 && (d.kind === "weapon" || d.kind === "armour")
            ? Object.values(MODIFIERS).filter((m) => m.on === d.kind && m.id !== s.mod).map((m) => ({
                id: m.id, name: m.name, text: m.text, cost: m.cost.map(([id, n]) => n + " " + item(id).name).join(", "),
                ok: m.cost.every(([id, n]) => countOf(items, id) >= n),
              }))
            : [],
        };
      }),
      level, xp, xpLo, xpHi, crowns: countOf(items, "coin_crown"), defence: gearDefence(), banner,
      journal: online && (mode === "journal" || mode === "pause") ? journal(quests, questCtx()) : [],
      shop: mode === "shop" && shopId ? shopView(shopId) : null,
      map: mode === "map" ? mapView() : null,
      crafts: RECIPES.map((r) => {
        const have = r.inputs.every((i) => countOf(items, i.id) >= i.n);
        const can = r.station === "hand" || r.station === stationNear;
        return { id: r.id, name: r.name, out: r.out, ok: have && can, have: recipeHint(r, items), station: r.station, can };
      }),
      station: stationNear,
      hour, night: hour >= 20.5 || hour < 5.5,
      reward, fade, stats: { time: playTime, deaths, kills }, hurtAt, quality, muted: audio.muted,
      combat: combatT > 0, charge: P.holding ? Math.min(1, P.holdT / 0.35) : 0,
      inDungeon: ZONES[P.zone].indoor, zone: P.zone, fps: Math.round(fps),
      online: online ? onlineHud() : null,
    };
  }
  function push() {
    if (!subs.size) return;
    const s = snapshot();
    for (const f of subs) f(s);
  }

  // ------------------------------------------------------------ world build (async so the loader can paint)
  const tick = () => new Promise<void>((res) => requestAnimationFrame(() => res()));
  const blockMats = ["A", "B", "C"].map((L, i) => new THREE.MeshLambertMaterial({ map: blockTex(L, ["#8e2f2f", "#b5893a", "#cdbba6"][i]) }));

  async function init() {
    loading = 0.05;
    push();
    await tick();
    const M = makeMaterials();
    mats = M;
    loading = 0.15;
    push();
    await tick();
    world = buildOverworld(M, { gate: () => flags.gate || (gateOpening && gateT > 0.8) });
    env.col = world.col;
    scene.add(world.root);
    zones.set("over", { root: world.root, groundAt: world.groundAt, blocked: world.inRiver, fires: world.fires, lamps: world.lamps, glows: [], nodes: world.nodes, anchors: world.anchors });
    loading = 0.6;
    push();
    await tick();
    dun = buildDungeon(M, world.col, { slab: () => flags.slab, nursery: () => flags.nursery, exit: () => flags.cookie });
    scene.add(dun.root);
    zones.set("castle", { root: dun.root, groundAt: () => 0, fires: dun.fires, lamps: [], glows: [], nodes: [], anchors: dun.anchors });
    const glows = buildGlows([...world.glows, ...dun.glows], pxScale, glowI);
    scene.add(glows.points);
    glowTime = glows.time;
    loading = 0.75;
    push();
    await tick();
    for (const d of NPCS) npcs.push(new Npc(d, world.root));
    for (const d of VOSS_NPCS) npcs.push(new Npc(d, world.root));
    cookie = new Cookie(env, dun.root, blockMats, dun.musicLid);
    bosses.set("cookie", cookie);
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
  const zoneGlowTimes: { value: number }[] = [];

  /** What a zone builder may touch. */
  function zoneEnv(): ZoneEnv {
    return {
      M: mats!, col: world!.col, audio,
      flag: (f) => !!worldFlags[f] || !!(flags as Record<string, boolean>)[f],
      setFlag: (f) => {
        if (worldFlags[f]) return;
        worldFlags[f] = true;
        worldFlag(f).catch(() => (worldFlags[f] = false));
      },
      say,
      players: () => env.players(),
      hurt: (d, sx, sz) => void hurtPlayer(d, sx, sz, { knock: 1.2 }),
      shake: (a) => (shake = Math.max(shake, a)),
    };
  }

  /** Builds a zone the first time anyone here needs it (its code is a separate download). */
  function ensureZone(z: ZoneId): Promise<boolean> {
    if (zones.has(z)) return Promise.resolve(true);
    const load = ZONE_BUILDERS[z];
    if (!load || !world || !mats) return Promise.resolve(false);
    let p = zoneLoads.get(z);
    if (!p) {
      p = (async () => {
        const builder = await load();
        const b = await builder(zoneEnv());
        b.root.visible = P.zone === z;
        scene.add(b.root);
        if (b.glows.length) {
          const gl = buildGlows(b.glows, pxScale, glowI);
          b.root.add(gl.points);
          zoneGlowTimes.push(gl.time);
        }
        zones.set(z, b);
        for (const d of b.npcs ?? []) npcs.push(new Npc({ ...d, zone: z }, b.root));
        for (const d of Object.values(BOSSES)) {
          const make = d.zone === z && !bosses.has(d.id) ? BOSS_FACTORIES[d.id] : undefined;
          if (!make) continue;
          const boss = (await make())(env, b.root);
          if (worldFlags[d.flag]) boss.setDead();
          else boss.reset();
          boss.setPuppet(!!online && !(P.zone === z && online.room.isRunner));
          const st = online?.boss[d.id];
          if (st && st.max > 0 && !st.dead) boss.setMax(st.max);
          bosses.set(d.id, boss);
        }
        spawnZoneMobs(z);
        buildInteracts();
        return true;
      })().catch((e) => {
        console.warn("veyrmarch: zone " + z + " failed to build", e);
        zoneLoads.delete(z);
        return false;
      });
      zoneLoads.set(z, p);
    }
    return p;
  }

  const mobKey = new Map<Mob, string>();
  const mobByKey = new Map<string, Mob>();

  function spawnMobs() {
    for (const m of mobs) m.remove();
    mobs.length = 0;
    mobKey.clear();
    mobByKey.clear();
    for (const z of zones.keys()) spawnZoneMobs(z);
  }

  /** Places one zone's foes (spawn positions are local to their zone; see data/world.ts). */
  function spawnZoneMobs(only: ZoneId) {
    for (const [key, k, x0, z0, zone] of MOB_SPAWNS) {
      // foes of zones not built yet, or of kinds this build cannot draw, wait for their zone
      if (zone !== only || mobByKey.has(key) || !zones.has(zone) || !(k in MOBS)) continue;
      const kind = k as MobKind;
      const w = toWorld(zone, x0, z0);
      const m = new Mob(kind, w.x, w.z, zone, env, !ZONES[zone].indoor && kind !== "soldier" && k !== "kennelmaster");
      m.key = key;
      mobs.push(m);
      mobKey.set(m, key);
      mobByKey.set(key, m);
      const left = deadLeft.get(key);
      if (deadMobs.has(key) || left !== undefined || (online && flags.cookie && kind === "soldier" && zone === "over")) {
        m.alive = false;
        m.state = "dead";
        m.deadT = 10;
        m.respawnT = left ?? Infinity;
        m.rig.group.visible = false;
      }
      if (online && !online.room.isRunner) m.puppet = true;
    }
  }

  function findMob(key: unknown): Mob | undefined {
    if (typeof key !== "string") return undefined;
    return mobByKey.get(key) ?? allAdds().find((t) => t.key === key);
  }

  // ------------------------------------------------------------ interactions
  const interacts: Interact[] = [];
  function buildInteracts() {
    interacts.length = 0;
    if (!world || !dun) return;
    const a = world.anchors;
    const d = dun.anchors;
    for (const [zid, zb] of zones)
      for (const n of zb.nodes) {
        interacts.push({
          x: n.x, z: n.z, r: 2.2, zone: zid,
          label: () => (nodeLeft(n) > 0 ? "Gather " + item(n.item).name : null),
          act: () => gather(n),
        });
      }
    for (const npc of npcs) {
      interacts.push({
        x: 0, z: 0, r: 2.4, zone: npc.zone,
        label: () => (npc.rig.group.visible ? "Talk · " + npc.def.name : null),
        act: () => talkTo(npc),
      });
      (interacts[interacts.length - 1] as Interact & { npc?: Npc }).npc = npc;
    }
    for (const st of STATIONS) {
      if (!zones.has(st.zone)) continue;
      const w = toWorld(st.zone, st.x, st.z);
      interacts.push({ x: w.x, z: w.z, r: Math.min(2.8, st.r), zone: st.zone, label: () => st.name, act: () => openBag() });
    }
    for (const [zid, zb] of zones) for (const it of zb.interacts ?? []) interacts.push({ ...it, zone: zid });
    // caches beyond Hearthfen: once per character per world (the server checks you stand by it)
    for (const c of CACHE_DEFS) {
      if (c.zone === "over" || !zones.has(c.zone)) continue;
      const w = toWorld(c.zone, c.x, c.z);
      interacts.push({
        x: w.x, z: w.z, r: 2.0, zone: c.zone, label: () => (cacheFlags.has(c.id) ? null : "Search"),
        act: () => {
          cacheFlags.add(c.id);
          audio.pickup();
          void heartbeat().then(() => memberFlag(c.id));
        },
      });
    }
    for (const p of PORTALS) {
      if (p.edge || !zones.has(p.from)) continue;
      const w = toWorld(p.from, p.x, p.z);
      const label = p.id === "castle_over_gate" ? () => (flags.cookie && bossDoneT < 0 && mode === "play" ? p.label : null) : () => p.label;
      interacts.push({ x: w.x, z: w.z, r: p.r, zone: p.from, label, act: () => travel(p) });
    }
    interacts.push({
      x: a.bed.x, z: a.bed.z, r: 2.0, zone: "over", label: () => "Rest (your bedroll)",
      act: () => fadeThen(() => {
        if (!online) {
          if (hour > 18 || hour < 6) hour = 6.6;
          else hour += 2;
        } else {
          // the world's clock moves on only if nobody else is here (it belongs to everyone)
          const o = online;
          heartbeat()
            .then(() => rpc<{ hour: number; day: number; slept: boolean }>("vm_rest"))
            .then((r) => {
              if (online !== o) return;
              hour = r.hour;
              o.day = r.day;
              if (!r.slept) say("Others are about. The world's clock keeps its own time.");
            })
            .catch(() => {});
        }
        P.hp = P.maxHp;
        P.stam = P.maxStam;
        P.mana = P.maxMana;
        respawnShrine = false;
        lastShrine = null;
        say("You rest. Mended.");
        if (online && discovered.size > 1) setTimeout(() => openMap("hearthfen"), 700);
      }),
    });
    interacts.push({
      x: a.chest.x, z: a.chest.z, r: 1.8, zone: "over", label: () => (flags.chest ? null : "Open your chest"),
      act: () => {
        flags.chest = true;
        if (online) memberFlag("chest");
        else loot([["cons_bandage", 2], ["mat_fibre", 2], ["mat_wood", 1]]);
        audio.pickup();
      },
    });
    interacts.push({
      x: a.hollow.x, z: a.hollow.z, r: 2.0, zone: "over", label: () => (flags.hollow ? null : "Search the hollow"),
      act: () => {
        flags.hollow = true;
        if (online) memberFlag("hollow");
        else loot([["mat_copper", 3], ["mat_leather", 1], ["cons_bandage", 1]]);
        say("Someone hid this in the giant's roots.");
        audio.pickup();
      },
    });
    // shrines: rest, wake here after a fall, and travel between the ones you know
    for (const sh of SHRINES) {
      if (sh.id === "hearthfen" || !zones.has(sh.zone)) continue;
      const w = sh.id === "forest" ? { x: a.shrine.x, z: a.shrine.z } : toWorld(sh.zone, sh.x, sh.z);
      interacts.push({ x: w.x, z: w.z, r: 2.6, zone: sh.zone, label: () => "Rest at the " + sh.name.toLowerCase().replace(/^the /, ""), act: () => restAtShrine(sh.id, w.x, w.z) });
    }
    interacts.push({
      x: a.bell.x, z: a.bell.z, r: 2.6, zone: "over", label: () => "Ring the bell",
      act: () => {
        ringT = 3;
        audio.bell(0.3, 330);
        online?.room.event({ k: "bell" });
      },
    });
    interacts.push({
      x: a.well.x, z: a.well.z, r: 2.0, zone: "over", label: () => "Drink from the well",
      act: () => {
        const h = Math.min(P.maxHp - P.hp, 15);
        P.hp += h;
        say(h > 0 ? "Cold water. +" + Math.round(h) : "Cold water.");
      },
    });
    interacts.push({
      x: a.gate.x, z: a.gate.z, r: 4.5, zone: "over", label: () => (flags.gate || gateOpening ? null : "The Green Gate"),
      act: () => {
        if (gateOpen(seals)) startGate();
        else {
          openTalkLines("The Green Gate", "A March-Seal", MORE_LINES.gateShut);
          world!.gate.sealMat.uniforms.uTime.value += 3;
        }
      },
    });
    // dungeon
    interacts.push({
      x: 0, z: 0, r: 2.6, zone: "castle", label: () => (flags.slab ? null : "Heave the weight"),
      act: () => {
        weightX = Math.min(9, weightX + 1.6);
        audio.thud();
        dust.burst(10, dun!.weight.position.x, 0.2, 44, 2, 0x8a7a68, 0.6, 0.2, { up: 1 });
        say(weightX >= 9 ? "" : "The weight grinds along its rails.");
      },
    });
    (interacts[interacts.length - 1] as Interact & { weight?: boolean }).weight = true;
    interacts.push({
      x: d.nurseryDoor.x, z: d.nurseryDoor.z, r: 2.8, zone: "castle", label: () => (flags.nursery ? null : "Painted door"),
      act: () => {
        const horse = mobs.find((m) => m.kind === "horse");
        if (horse && horse.alive && (!online || !deadLeft.has("dh"))) openTalkLines("", "", MORE_LINES.horseDoor);
        else openNursery();
      },
    });
  }

  function nearestInteract() {
    prompt = "";
    promptAct = null;
    let best = 1e9;
    for (const it of interacts) {
      if (it.zone !== P.zone) continue;
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
    if (online)
      for (const r of online.remotes.values()) {
        if (!r.state.dead || r.state.zone !== P.zone || !r.live(performance.now())) continue;
        const d = Math.hypot(r.state.x - P.x, r.state.z - P.z);
        if (d > 2.6 || d >= best) continue;
        best = d;
        prompt = "Revive " + r.name;
        promptAct = () => {
          if (P.action !== "none") return;
          P.yaw = Math.atan2(r.state.x - P.x, r.state.z - P.z);
          startAction("gather", 1.1, 0.85);
          pendingRevive = r.cid;
        };
      }
    stationNear = "hand";
    for (const st of STATIONS)
      if (st.zone === P.zone && Math.hypot(ZONES[st.zone].ox + st.x - P.x, st.z - P.z) < st.r) {
        stationNear = st.kind;
        break;
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
    audio.gather(n.item);
    const col = n.kind === "wood" ? 0x8a6a48 : n.kind === "fibre" ? 0x9aa05a : n.kind === "copper" ? 0xc07a42 : n.kind === "iron" ? 0x8a9098 : 0x9a948a;
    dust.burst(12, n.x, n.y + 0.5, n.z, 3, col, 0.7, 0.16, { up: 2, grav: 8 });
    if (n.kind !== "wood" && n.kind !== "fibre") sparks.burst(6, n.x, n.y + 0.5, n.z, 4, 0xffe0b0, 0.3, 0.12, { up: 2 });
    n.mesh.scale.setScalar(0.92);
    if (online) {
      // the server owns the node and the reward; the world sees the node shrink
      rpc<{ items: StackJson[]; item: string; node: { id: string; left: number; regrow_at: string }; now: string }>("vm_gather", { p_node: n.id })
        .then((r) => {
          setItems(r.items);
          const rg = Math.max(0, (Date.parse(r.node.regrow_at) - Date.parse(r.now)) / 1000);
          nodeState.set(n.id, { left: r.node.left, regrow: rg });
          online?.room.event({ k: "node", id: n.id, l: r.node.left, rg: Math.round(rg) });
          floater(`+1 ${item(r.item).name}`, n.x, n.y + 1.4, n.z, "heal");
          if (r.node.left <= 0) say(item(r.item).name + " · the node is spent for now");
          if (!hasEdge() && countOf(items, "mat_flint") >= 2 && countOf(items, "mat_wood") >= 1) say("Enough for a knife. Open the bag → Craft.");
        })
        .catch((e: Error) => {
          if (/spent/.test(e.message)) {
            nodeState.set(n.id, { left: 0, regrow: 75 });
            say("Someone got there first. The node is spent for now.");
          } else if (!/too fast/.test(e.message)) netError(e);
        });
      return;
    }
    st.left -= 1;
    st.regrow = 75;
    nodeState.set(n.id, st);
    items = addItem(items, n.item, 1, uid);
    floater(`+1 ${item(n.item).name}`, n.x, n.y + 1.4, n.z, "heal");
    if (st.left <= 0) say(item(n.item).name + " · the node is spent for now");
    if (!hasEdge() && countOf(items, "mat_flint") >= 2 && countOf(items, "mat_wood") >= 1) say("Enough for a knife. Open the bag → Craft.");
    push();
  }

  // ------------------------------------------------------------ talking
  function openTalkLines(nm: string, role: string, lines: string[], end?: () => void, trades = false) {
    talkQueue = [...lines];
    talk = { name: nm, role, text: talkQueue.shift() ?? "", more: talkQueue.length > 0, trades: trades ? tradeList() : [], shop: talkShop };
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
      talk = { ...talk, text: talkQueue.shift()!, more: talkQueue.length > 0, trades: talkTrades && !talkQueue.length ? tradeList() : [], shop: talkShop };
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

  let talkShop: string | null = null;

  function talkTo(npc: Npc) {
    talkNpc = npc;
    npc.talkT = 999;
    const id = npc.def.id;
    const keeps = SHOPS.find((sh) => sh.keeper === id && sh.zone === npc.zone);
    talkShop = keeps ? keeps.id : null;
    // quests first: an offer, or a step that is about this NPC
    const biz = online ? npcBusiness(quests, id, level, questCtx()) : null;
    if (biz?.kind === "offer") {
      const q = biz.quest;
      openTalkLines(npc.def.name, npc.def.role, q.offer, () => questCall(q.id, "start"));
      return;
    }
    if (biz?.kind === "step") {
      const q = biz.quest;
      const step = biz.step;
      if (biz.ready) {
        const lines = step.lines?.length ? step.lines : step.k === "give" ? [`You hand over ${step.n ?? 1} ${item(step.item!.split("|")[0]).name}.`] : [];
        const after = () =>
          questCall(q.id, "step", false, (r) => {
            if (r.done && q.thanks.length) openTalkLines(npc.def.name, npc.def.role, q.thanks);
          });
        if (lines.length) openTalkLines(npc.def.name, npc.def.role, lines, after);
        else {
          after();
          talkNpc = null;
          npc.talkT = 0.5;
        }
        return;
      }
      if (step.k === "give") {
        const have = step.item!.split("|").reduce((n, x) => Math.max(n, countOf(items, x)), 0);
        openTalkLines(npc.def.name, npc.def.role, [`${step.text}. You have ${have} of ${step.n ?? 1}.`]);
        return;
      }
    }
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
          charFlag("talked");
          audio.quest();
          say("New task: gather flint and wood");
        };
      } else if (hasEdge() && !flags.ember) {
        lines = [...L.tanicKnife, "Tanic presses a warm coal into your palm. Ember. It spends a little breath, and it burns what is made of cloth and wax.", ...L.tanicAfter];
        end = () => {
          flags.ember = true;
          charFlag("ember");
          P.maxMana = 30;
          P.mana = 30;
          audio.reward();
          say("Learned Ember · tap the flame button");
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
    else if (id === "hale") lines = flags.gate ? L.haleOpen : L.haleShut;
    else if (id.startsWith("guard")) lines = flags.gate ? L.guardOpen : pick(L.guard);
    else if (npc.def.after && (worldFlags[npc.def.after.flag] || (flags as Record<string, boolean>)[npc.def.after.flag])) lines = pick(npc.def.after.lines);
    else if (npc.def.lines?.length) lines = pick(npc.def.lines);
    else lines = pick(L.villager);
    openTalkLines(npc.def.name, npc.def.role, lines, end, trades);
  }

  // ------------------------------------------------------------ transitions
  function fadeThen(cb: () => void) {
    fadeTarget = 1;
    fadeCb = cb;
  }

  function restAtShrine(id: string, x: number, z: number) {
    const sh = SHRINES.find((s) => s.id === id);
    if (!sh) return;
    const first = !discovered.has(id);
    discovered.add(id);
    lastShrine = id;
    if (id === "forest") {
      if (online && !flags.shrine) memberFlag("shrine");
      flags.shrine = true;
      respawnShrine = true;
    }
    if (first) void heartbeat().then(() => memberFlag("sh_" + id));
    P.hp = P.maxHp;
    P.mana = P.maxMana;
    P.stam = P.maxStam;
    sparks.burst(30, x, groundAt(x, z) + 1.2, z, 2, 0xffd28a, 1.2, 0.2, { up: 1.5, grav: -0.5 });
    audio.bell(0.12, 523);
    if (first) {
      showBanner(sh.name, "Shrine found · you will wake here, and travel between shrines you know");
      if (id === "forest") openTalkLines("Ruined shrine", "Giant Forest", MORE_LINES.shrine);
    } else openMap(id);
  }

  function openMap(here: string | null) {
    if (mode !== "play" && mode !== "talk") return;
    talk = null;
    mapHere = here;
    mode = "map";
    audio.ui();
    push();
  }

  function mapView(): Hud["map"] {
    return {
      here: mapHere,
      shrines: SHRINES.map((sh) => ({ id: sh.id, name: sh.name, zone: sh.zone, zoneName: ZONES[sh.zone].name, known: discovered.has(sh.id), here: sh.id === mapHere })),
    };
  }

  /** Fast travel: the server checks you stand at a shrine you know and moves you to another. */
  function fastTravel(id: string) {
    const o = online;
    if (!o || !mapHere || id === mapHere || !discovered.has(id)) return;
    mode = "play";
    push();
    heartbeat()
      .then(() => rpc<{ zone: ZoneId; x: number; z: number }>("vm_travel", { p_shrine: id }))
      .then(async (r) => {
        if (online !== o) return;
        if (!(await ensureZone(r.zone))) return say("That road is not open yet.");
        fadeThen(() => {
          const from = P.zone;
          setZone(r.zone);
          P.x = r.x;
          P.z = r.z;
          P.y = groundAt(P.x, P.z);
          P.kx = P.kz = P.vx = P.vz = 0;
          snapCam();
          lastShrine = id;
          arrived(from, r.zone);
          void heartbeat();
        });
      })
      .catch(netError);
  }

  /** Shows one zone, hides the rest, and tells the room (each zone has its own runner). */
  function setZone(z: ZoneId) {
    P.zone = z;
    for (const [id, b] of zones) b.root.visible = id === z;
    if (playerRig) zoneRoot(z).add(playerRig.group);
    for (const p of bolts) p.life = 0;
    if (online) {
      online.room.setZone(z);
      applyRole(true);
    }
  }

  const portalOpen = (p: PortalDef) => !p.flag || !!worldFlags[p.flag];
  let travelling = false;
  let shutSaidAt = 0;

  /** Through a door or along a road into the next zone. The server checks the doorway too. */
  function travel(p: PortalDef) {
    if (travelling) return;
    if (!zones.has(p.to)) {
      if (ZONE_BUILDERS[p.to] && portalOpen(p) && !(p.id === "over_castle" && !hasEdge())) {
        // the next zone's code and scene are made the first time someone walks this way
        travelling = true;
        say("The road unrolls…");
        void ensureZone(p.to).then((ok) => {
          travelling = false;
          if (ok) travel(p);
          else say("The way is blocked. Try again in a moment.");
        });
        return;
      }
      if (!ZONE_BUILDERS[p.to]) {
        if (performance.now() - shutSaidAt > 4000) say("That road is not open yet.");
        shutSaidAt = performance.now();
        return;
      }
    }
    if (!portalOpen(p)) {
      if (p.edge) {
        if (performance.now() - shutSaidAt > 4000) say(p.shut ?? "It will not open.");
        shutSaidAt = performance.now();
      } else openTalkLines(p.label, "", [p.shut ?? "It will not open."]);
      return;
    }
    if (p.id === "over_castle" && !hasEdge()) {
      openTalkLines("", "", MORE_LINES.noEdge);
      return;
    }
    travelling = true;
    fadeThen(() => {
      travelling = false;
      const from = P.zone;
      setZone(p.to);
      const w = toWorld(p.to, p.tx, p.tz);
      P.x = w.x;
      P.z = w.z;
      P.y = groundAt(P.x, P.z);
      P.yaw = p.tyaw;
      camYaw = p.tyaw;
      P.kx = P.kz = P.vx = P.vz = 0;
      snapCam();
      arrived(from, p.to);
      void heartbeat();
    });
  }

  function arrived(from: ZoneId, to: ZoneId) {
    if (to === "castle" && !flags.entered) {
      flags.entered = true;
      memberFlag("entered");
      audio.quest();
    }
    if (from === "castle" && flags.cookie) say("The toys are still. The box has nothing left to call.");
    region = null;
  }

  /** Roads out of a zone work by walking into them. */
  function edgePortals() {
    if (mode !== "play" || P.dead || travelling) return;
    for (const p of PORTALS) {
      if (!p.edge || p.from !== P.zone) continue;
      const w = toWorld(p.from, p.x, p.z);
      const d = Math.hypot(P.x - w.x, P.z - w.z);
      if (d > p.r) continue;
      if (zones.has(p.to) && portalOpen(p)) travel(p);
      else {
        travel(p);
        // a shut road pushes you back a step
        const l = d || 1;
        P.x += ((P.x - w.x) / l) * (p.r - d + 0.4);
        P.z += ((P.z - w.z) / l) * (p.r - d + 0.4);
      }
      return;
    }
  }
  function openNursery() {
    flags.nursery = true;
    if (online)
      worldFlag("nursery").catch(() => {
        flags.nursery = false;
        openTalkLines("", "", MORE_LINES.horseDoor);
      });
    audio.thud();
    say("The painted door swings in. A music box is playing.");
  }

  function startGate(local = true) {
    if (gateOpening || flags.gate) return;
    if (online && local) worldFlag("gate").catch(() => {});
    gateOpening = true;
    gateT = 0;
    audio.gate();
    say("The Green Gate answers the Core.");
    shake = 0.3;
  }

  // ------------------------------------------------------------ combat
  function startAction(a: HumanAction, dur: number, hitAt: number) {
    // a new action forgets what an interrupted gather or revive was aimed at
    pendingGather = null;
    pendingRevive = null;
    actionCount++;
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
    for (const m of mobs) if (m.alive && m.zone === P.zone && m.kind !== "deer") consider(m.x, m.z, m.cfg.radius, m.y);
    const zb = zoneBoss();
    if (zb && zb.fighting) {
      consider(zb.x, zb.z, 1.1, zb.y);
      for (const m of zb.adds) if (m.alive) consider(m.x, m.z, m.cfg.radius, m.y);
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
    const cost = Math.round(((heavy ? w.stamHeavy * 1.3 : w.stamLight * 1.4) + 2) * (1 + (MODIFIERS[mainMod()]?.stam ?? 0)));
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
      startAction("heavy", 0.62 * swingScale(w), 0.3);
      P.combo = 0;
    } else {
      P.combo = P.comboT > 0 ? (P.combo % 3) + 1 : 1;
      const a: HumanAction = P.combo === 1 ? "light1" : P.combo === 2 ? "light2" : "light3";
      startAction(a, (P.combo === 3 ? 0.5 : 0.38) * swingScale(w), P.combo === 3 ? 0.42 : 0.36);
    }
    audio.swing(heavy);
  }

  function resolveSwing() {
    const w = mainWeapon();
    const heavy = P.action === "heavy";
    const reach = w.range + (heavy ? 0.9 : 0.7);
    const arc = heavy ? (w.family === "axe" ? 2.3 : 1.7) : w.family === "spear" ? 0.8 : 1.2;
    const fx = Math.sin(P.yaw);
    const fz = Math.cos(P.yaw);
    const ax = P.x + fx * 0.5;
    const az = P.z + fz * 0.5;
    let hits = 0;
    const chain = P.action === "light3" ? 1.2 : 1;
    // level, the Black Knight's Oath and a Finlay riposte all add to the weapon's own number
    const ripo = riposte > 0 ? 2 : 1;
    const dmgBase = strikeDamage({ weapon: w, heavy, skillRank: 0, weakness: false, blocking: false, shield: false, defence: 0 }) * statsFor(level).power * (setWorn("bk") ? 1.15 : 1) * ripo * (1 + (MODIFIERS[mainMod()]?.dmg ?? 0));
    const tryHit = (x: number, z: number, r: number, hit: (dmg: number) => number) => {
      const dx = x - P.x;
      const dz = z - P.z;
      const d = Math.hypot(dx, dz);
      if (d > reach + r) return;
      const ang = Math.abs(Math.atan2(Math.sin(Math.atan2(dx, dz) - P.yaw), Math.cos(Math.atan2(dx, dz) - P.yaw)));
      if (ang > arc && d > r + 0.4) return;
      let dmg = Math.max(1, Math.round(dmgBase * chain * (0.92 + Math.random() * 0.16)));
      // Smacko: every fourth connecting hit lands twice
      if (w.id === "wpn_smacko" && hits === 0 && (hitChain + 1) % 4 === 0) {
        dmg *= 2;
        floater("Smack!", x, P.y + 2.6, z, "crit");
      }
      const dealt = hit(dmg);
      if (dealt <= 0) return;
      if (hits === 0) hitChain++;
      hits++;
      const hx = P.x + (dx / (d || 1)) * Math.min(d, 1.2);
      const hz = P.z + (dz / (d || 1)) * Math.min(d, 1.2);
      sparks.burst(heavy ? 14 : 8, hx, P.y + 1.2, hz, heavy ? 6 : 4, 0xffe6b8, 0.35, 0.16, { up: 1, grav: 6 });
      floater(String(dealt), x, P.y + 2.0, z, heavy || chain > 1 ? "crit" : "dmg");
    };
    for (const m of mobs) if (m.alive && m.zone === P.zone) tryHit(m.x, m.z, m.cfg.radius, (d) => onMobHit(m, d, heavy));
    const zb = zoneBoss();
    if (zb) {
      if (zb.fighting) tryHit(zb.x, zb.z, 1.1, (d) => bossHit(zb, d, heavy, false));
      for (const m of zb.adds) if (m.alive) tryHit(m.x, m.z, m.cfg.radius, (d) => onMobHit(m, d, heavy));
    }
    flashes.arc(ax, P.y + 1.15, az, P.yaw, reach * 0.8, P.action === "light3" || heavy, w.id === "wpn_cookie_blade" ? 0xffb0a0 : 0xffe6b8, P.action === "light2");
    if (hits) {
      if (riposte > 0) riposte = 0;
      audio.hit(heavy);
      hitStop = heavy ? 0.09 : 0.055;
      shake = Math.max(shake, heavy ? 0.22 : 0.1);
      combatT = 3;
    }
  }

  function onMobHit(m: Mob, dmg: number, heavy: boolean, fire = false) {
    if (online && m.puppet) {
      // another client runs this foe: show the blow now, let the runner apply it
      if (!m.alive) return 0;
      const d = fire ? Math.round(dmg * m.cfg.fireWeak) : dmg;
      m.flash = 0.12;
      m.hp = Math.max(1, m.hp - d);
      online.room.event({ k: "hit", m: m.key, d: dmg, hv: heavy ? 1 : 0, f: fire ? 1 : 0, x: r2(P.x), z: r2(P.z) }, true);
      combatT = 3;
      return d;
    }
    const dealt = m.takeHit(dmg, P.x, P.z, heavy, fire, P);
    // Smacko's charged hits and a mace's heavy blows keep foes reeling
    const w = mainWeapon();
    if (heavy && m.alive && (w.id === "wpn_smacko" || w.family === "mace")) m.stagger(w.family === "mace" ? 1.4 : 1.1);
    if (online) {
      if (dealt > 0) online.room.event({ k: "hx", m: m.key });
      if (!m.alive) claimKill(m.key, m);
      return dealt;
    }
    if (!m.alive) {
      kills++;
      const key = mobKey.get(m);
      if (key && ZONES[m.zone].indoor) deadMobs.add(key);
      const drops: [string, number][] = [];
      for (const [id, n, ch] of m.cfg.loot) if (Math.random() < ch) drops.push([id, n]);
      if (drops.length) loot(drops);
      if (m.kind === "horse") {
        say("The rocking horse is still. The painted door is free.");
        audio.quest();
      }
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
    bolts.push({ x: P.x + fx * 0.8, y: P.y + 1.3, z: P.z + fz * 0.8, vx: fx * 19, vz: fz * 19, life: 0.9, zone: P.zone });
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
        if (!hit && m.alive && m.zone === b.zone && Math.hypot(m.x - b.x, m.z - b.z) < m.cfg.radius + 0.5) {
          const d = onMobHit(m, fireDmg, false, true);
          floater(d + " fire", m.x, m.y + 1.8, m.z, "fire");
          boom();
        }
      const bz = zoneBoss();
      if (!hit && bz && b.zone === bz.def.zone) {
        if (bz.fighting && Math.hypot(bz.x - b.x, bz.z - b.z) < 1.4) {
          const d = bossHit(bz, fireDmg, false, true);
          if (d) floater(d + " fire", bz.x, bz.y + 2.8, bz.z, "fire");
          boom();
        }
        for (const m of bz.adds)
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
    // a shared world does not stop for menus
    const exposed = mode === "play" || (online && (mode === "bag" || mode === "talk" || mode === "pause"));
    if (P.dead || !exposed) return false;
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
        if (mainWeapon().id === "wpn_finlay_longsword") riposte = 3;
        audio.parry();
        sparks.burst(20, P.x + Math.sin(P.yaw) * 0.7, P.y + 1.3, P.z + Math.cos(P.yaw) * 0.7, 6, 0xfff0c0, 0.4, 0.2, { up: 1 });
        floater("Parried!", P.x, P.y + 2.2, P.z, "crit");
        hitStop = 0.12;
        shake = 0.15;
        return false;
      }
      d = Math.round(d * (P.shield ? 0.3 : 0.6));
      P.stam -= dmg * (P.shield ? 0.9 : 1.3) * (setWorn("bk") ? 0.5 : 1);
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
    // armour takes its share of whatever got through
    if (d > 0) d = Math.max(1, Math.round(d * (1 - armourCut(gearDefence()))));
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
    talk = null;
    audio.death();
    if (!online)
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
      if (online) rpc("vm_died").catch(() => {});
      const died = P.zone;
      // a dungeon sends you back out of its front door; out in the open, back to your shrine or bed
      const door = ZONES[died].indoor && died !== "castle" ? PORTALS.find((p) => p.to === died && !ZONES[p.from].indoor) : undefined;
      const atDoor = died === "castle" ? flags.entered && !flags.cookie : !!door;
      if (door) {
        setZone(door.from);
        const w = toWorld(door.from, door.x, door.z);
        P.x = w.x;
        P.z = w.z - 2.5;
        P.yaw = 0;
      } else if (!atDoor && lastShrine && lastShrine !== "forest" && lastShrine !== "hearthfen" && zones.has(SHRINES.find((x) => x.id === lastShrine)!.zone)) {
        const sh = SHRINES.find((x) => x.id === lastShrine)!;
        setZone(sh.zone);
        const w = toWorld(sh.zone, sh.x, sh.z);
        P.x = w.x;
        P.z = w.z + 1.4;
        P.yaw = Math.PI;
      } else {
        setZone("over");
        const at = atDoor ? world!.anchors.castleDoor : respawnShrine && flags.shrine ? world!.anchors.shrine : world!.anchors.bed;
        P.x = at.x;
        P.z = at.z + (atDoor ? -3 : respawnShrine ? 1.2 : 0.6);
        P.yaw = atDoor ? 0 : respawnShrine ? Math.PI : 0.4;
      }
      camYaw = P.yaw;
      snapCam();
      mode = "play";
      say(atDoor ? "You wake at the castle door. The music box is still playing." : respawnShrine ? "You wake at the shrine." : "Hearthfen. Still breathing.");
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
    if (online) {
      if (r.station !== "hand" && r.station !== stationNear) {
        say("That needs a " + STATION_NAMES[r.station].toLowerCase() + ".");
        audio.block();
        return;
      }
      if (!r.inputs.every((i) => countOf(items, i.id) >= i.n)) {
        say("Missing materials.");
        audio.block();
        return;
      }
      // the server checks the station from your last known position, so tell it where you are first
      const go = r.station === "hand" ? Promise.resolve() : heartbeat();
      go.then(() => rpc<{ items: StackJson[]; made: string }>("vm_craft", { p_recipe: id, p_station: stationNear }))
        .then((res) => {
          setItems(res.items);
          const made = item(res.made);
          audio.craft();
          say(made.name + " crafted" + (made.slot === "main" && !made.moveset.includes("pick") ? " and equipped" : ""));
          if (made.id === "wpn_stone_knife") {
            audio.quest();
            setTimeout(() => say("Show Tanic your knife."), 1800);
          }
        })
        .catch(netError);
      return;
    }
    const res = tryCraft(items, id, stationNear as "hand" | "bench" | "forge", uid);
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
    push();
  }

  function doTrade(id: string) {
    const t = TRADES.find((x) => x.id === id);
    if (!t) return;
    if (online) {
      if (!t.give.every((g) => countOf(items, g.id) >= g.n)) {
        say("You don't have enough.");
        audio.block();
        return;
      }
      rpc<{ items: StackJson[] }>("vm_trade", { p_trade: id })
        .then((r) => {
          setItems(r.items);
          audio.pickup();
          say(`Traded for ${t.get.n} ${item(t.get.id).name}`);
          if (talk) talk = { ...talk, trades: tradeList() };
          push();
        })
        .catch(netError);
      return;
    }
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
      if (online) rpc<{ items: StackJson[] }>("vm_use", { p_uid: id }, false).then((r) => setItems(r.items)).catch(netError);
      P.hp = Math.min(P.maxHp, P.hp + d.heal);
      floater("+" + d.heal, P.x, P.y + 2, P.z, "heal");
      audio.pickup();
      say("Bandaged. +" + d.heal);
    } else if (d.slot !== "none") {
      items = equip(items, id);
      if (online) rpc<{ items: StackJson[] }>("vm_equip", { p_uid: id }, false).then((r) => setItems(r.items)).catch(netError);
      syncGear();
      audio.ui();
    }
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
    const camBoss = zoneBoss();
    const bossOn = camBoss && camBoss.fighting;
    camDist += ((portrait ? 7.2 : bossOn ? 7.4 : ZONES[P.zone].indoor ? 5.4 : 5.8) - camDist) * Math.min(1, rdt * 2);
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
      const by = Math.atan2(camBoss!.x - P.x, camBoss!.z - P.z);
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
    const g = groundAt(x, z) + 0.5;
    if (y < g) y = g;
    if (P.zone === "castle" && !(P.z > DUN.galleryZ1 + 6)) y = Math.min(y, 6.6);
    else if (ZONES[P.zone].indoor && P.zone !== "castle") y = Math.min(y, zones.get(P.zone)?.ceiling?.(P.x, P.z) ?? 6.6);
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
    if (ZONES[P.zone].indoor && mode !== "title") {
      const court = P.zone === "castle" && P.z > DUN.galleryZ1 + 4;
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
    // a zone may bring its own air: Blackwood mist, the Mire's green murk, rain over the Keep
    const zf = mode !== "title" && mode !== "create" ? zones.get(P.zone)?.fog : undefined;
    if (zf) {
      fogC.lerp(cA.setHex(zf.color), ZONES[P.zone].indoor ? 1 : 0.35 + 0.5 * dayK);
      density = zf.density;
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
    glowI.value = ZONES[P.zone].indoor ? 1.1 : 0.15 + night * 1.1;
    const wm = world.root.children.find((c) => c.name === "window") as THREE.Mesh | undefined;
    if (wm) (wm.material as THREE.MeshLambertMaterial).emissiveIntensity = 0.15 + night * 1.6;
    for (const s of world.shafts) s.visible = P.zone === "over" && dayK > 0.5 && quality !== "low";
    (world.shafts[0]?.material as THREE.MeshBasicMaterial | undefined)?.opacity !== undefined &&
      ((world.shafts[0].material as THREE.MeshBasicMaterial).opacity = 0.1 * dayK * (reg === "forest" ? 1 : 0.5));
    const litBoss = zoneBoss();
    const bossLit = litBoss && litBoss.stageLight && litBoss.active && litBoss.st !== "dead";
    stage.intensity += ((bossLit ? 60 : 0) - stage.intensity) * Math.min(1, rdt * 2);
    if (litBoss) stage.position.set(litBoss.x, litBoss.y + 6.5, litBoss.z - 1.5);
    // point lights: nearest fires (always) and lamps (at night)
    const cands: { p: THREE.Vector3; fire: boolean }[] = [];
    const zb = zones.get(P.zone);
    for (const p of zb?.fires ?? []) cands.push({ p, fire: true });
    if (!ZONES[P.zone].indoor && night > 0.3) for (const p of zb?.lamps ?? []) cands.push({ p, fire: false });
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
      l.intensity = (c.fire ? (ZONES[P.zone].indoor ? 14 : 9 + night * 8) : 10 * night) * flick;
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
        if (!blockedAt(nx, nz)) {
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
        if (P.action === "gather" && pendingRevive && online) {
          const r = online.remotes.get(pendingRevive);
          if (r && r.state.dead) {
            online.room.event({ k: "revive", to: pendingRevive, by: name }, true);
            sparks.burst(24, r.state.x, r.state.y + 1, r.state.z, 3, 0xffd28a, 1, 0.2, { up: 2, grav: -0.5 });
            audio.bell(0.12, 523);
            say("You pull " + r.name + " to their feet.");
          }
          pendingRevive = null;
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
      const wet = P.zone === "over" ? world.terrain.waterAt(P.x, P.z) : (zones.get(P.zone)?.waterAt?.(P.x, P.z) ?? 0);
      if (wet > 0.3) target *= 0.7;
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
      if (blockedAt(nx, nz)) {
        nx = P.x;
        nz = P.z;
      }
      P.x = nx;
      P.z = nz;
    }
    P.kx *= Math.exp(-dt * 9);
    P.kz *= Math.exp(-dt * 9);
    // the weight in the hall: push it by walking into it
    if (P.zone === "castle" && dun && !flags.slab) {
      const wp = dun.weight.position;
      if (Math.abs(P.z - wp.z) < 1.3 && P.x < wp.x && P.x > wp.x - 1.6 && P.vx > 0.5) weightX = Math.min(9, weightX + P.vx * dt * 0.5);
    }
    const solved = env.col.resolve(P.x, P.z, 0.42);
    P.x = solved.x;
    P.z = solved.z;
    {
      const zd = ZONES[P.zone];
      const pad = zd.indoor ? 0.5 : 6;
      P.x = Math.min(zd.ox + zd.bounds.maxX - pad, Math.max(zd.ox + zd.bounds.minX + pad, P.x));
      P.z = Math.min(zd.bounds.maxZ - pad, Math.max(zd.bounds.minZ + pad, P.z));
    }
    if (P.zone === "castle" && dun && !flags.slab) {
      const wp = dun.weight.position;
      if (Math.abs(P.z - wp.z) < 1.35 && Math.abs(P.x - wp.x) < 1.35) {
        if (Math.abs(P.x - wp.x) > Math.abs(P.z - wp.z)) P.x = wp.x + Math.sign(P.x - wp.x) * 1.35;
        else P.z = wp.z + Math.sign(P.z - wp.z) * 1.35;
      }
    }
    P.y = groundAt(P.x, P.z);
    const sp = Math.hypot(P.vx, P.vz);
    P.speed = sp;
    if (sp > 0.3 && (P.action === "none" || P.action === "charge" || P.action === "cast")) {
      const want = Math.atan2(P.vx, P.vz);
      const diff = Math.atan2(Math.sin(want - P.yaw), Math.cos(want - P.yaw));
      P.yaw += Math.sign(diff) * Math.min(Math.abs(diff), dt * 12);
    }
    // stamina, health, mana
    const regenMod = 1 + items.reduce((a, it) => a + (it.equipped && it.mod ? MODIFIERS[it.mod]?.regen ?? 0 : 0), 0);
    if (P.stamT <= 0 && !(P.sprint && inCombat)) P.stam = Math.min(P.maxStam, P.stam + (P.blocking ? 10 : 32) * dt * (setWorn("hound") ? 1.25 : 1) * regenMod);
    if (P.maxMana > 0) P.mana = Math.min(P.maxMana, P.mana + (inCombat ? 1.2 : 3) * dt);
    if (!inCombat && P.regenT <= 0 && P.hp > 0 && P.hp < P.maxHp) P.hp = Math.min(P.maxHp, P.hp + 2 * dt);
    // footsteps
    P.phase += (sp / (P.sprint ? 1.6 : 1.15)) * dt * Math.PI;
    if (sp > 1 && Math.floor(P.phase / Math.PI) !== P.lastStep) {
      P.lastStep = Math.floor(P.phase / Math.PI);
      const surf = P.zone === "castle" ? (P.z > DUN.doorZ && P.z < DUN.galleryZ1 ? "wood" : "stone") : P.zone !== "over" ? (zones.get(P.zone)?.surfaceAt?.(P.x, P.z) ?? "stone") : world.decks.some((d) => P.x >= d.minX && P.x <= d.maxX && P.z >= d.minZ && P.z <= d.maxZ) ? "wood" : world.terrain.pathAt(P.x, P.z) > 0.3 ? "dirt" : "grass";
      audio.step(surf);
      if (P.sprint && !ZONES[P.zone].indoor && Math.random() < 0.5) dust.emit({ x: P.x, y: P.y + 0.1, z: P.z, vx: (Math.random() - 0.5) * 0.6, vy: 0.5, vz: (Math.random() - 0.5) * 0.6, life: 0.7, size: 0.35, grow: 0.4, color: 0x9a8a70, a: 0.35, grav: 0 });
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
    for (const g of zoneGlowTimes) g.value = t;
    if (P.zone !== "over" && P.zone !== "castle") zones.get(P.zone)?.update?.(dt, t);
    // nodes regrow
    for (const n of zones.get(P.zone)?.nodes ?? []) {
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
    if (!flags.cookie && P.zone === "over") {
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
      if (online) worldFlag("slab").catch(() => {});
      audio.thud();
      shake = 0.3;
      say("The weight settles. The slab grinds up.");
      audio.quest();
    }
    dun.slab.position.y += ((flags.slab ? 9.2 : 3.1) - dun.slab.position.y) * Math.min(1, dt * 1.5);
    dun.plate.position.y = flags.slab ? 0.0 : 0.06;
    dun.nurseryDoor.rotation.y += ((flags.nursery ? -1.6 : 0) - dun.nurseryDoor.rotation.y) * Math.min(1, dt * 2);
    dun.exitGate.position.y += ((flags.cookie ? 6.5 : 0) - dun.exitGate.position.y) * Math.min(1, dt * 1.2);
    // marked floor tiles
    if (P.zone === "castle" && mode === "play") {
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
    // the boss of this zone: whoever stands in its arena wakes it; only the zone's runner decides
    const zb = zoneBoss();
    if (zb) {
      const A = arenaOf(zb.def);
      const arena = (q: PlayerState) => q.zone === zb.def.zone && !q.dead && Math.hypot(q.x - A.x, q.z - A.z) < A.r - 1.5;
      const inArena = online ? env.players().some(arena) : arena(P);
      const runs = !online || online.room.isRunner;
      if (runs && inArena && !worldFlags[zb.def.flag] && zb.st === "dormant") {
        zb.startIntro();
        // a new fight, sized for whoever is in the arena: the server picks the health
        if (online)
          rpc<Record<string, BossJson>>("vm_boss_reset", { p_boss: zb.def.id })
            .then((all) => {
              const st = all?.[zb.def.id];
              if (!online || !st) return;
              online.boss[zb.def.id] = st;
              zb.setMax(st.max);
              online.room.event({ k: "bmax", b: zb.def.id, m: st.max }, true);
            })
            .catch(() => {});
      }
      if (zb.st === "intro" && lastBossSt !== "intro") {
        introSeen = true;
        audio.bell(0.2, 523);
        placeAt = performance.now();
        placeName = zb.def.name;
        placeSub = zb.def.title;
      }
      lastBossSt = zb.st;
      zb.update(dt, inArena);
      if (zb.st === "dead" && !bossFinished.has(zb.def.id) && bossDoneT < 0) {
        bossDoneT = 1.4;
        doneBoss = zb.def.id;
      }
    }
    {
      if (rewardWaiting && mode === "play" && !P.dead) {
        rewardWaiting = false;
        mode = "reward";
        push();
      } else if (endingDue && mode === "play" && !P.dead) {
        endingDue = false;
        mode = "end";
        audio.reward();
        push();
      }
      if (bossDoneT > 0) {
        bossDoneT -= dt;
        if (bossDoneT <= 0) {
          bossDoneT = -1;
          void finishBoss(doneBoss);
        }
      }
    }
    // ambience particles
    smokeT -= dt;
    if (smokeT <= 0 && (P.zone === "over" || zones.get(P.zone)?.smoke?.length)) {
      smokeT = 0.18;
      for (const s of P.zone === "over" ? world.smoke : zones.get(P.zone)?.smoke ?? []) {
        if (Math.abs(s.x - P.x) > 90 || Math.abs(s.z - P.z) > 90) continue;
        dust.emit({ x: s.x + (Math.random() - 0.5) * 0.3, y: s.y, z: s.z + (Math.random() - 0.5) * 0.3, vx: 0.3 + Math.random() * 0.2, vy: 1.0 + Math.random() * 0.4, vz: 0.15, life: 4.5, size: 0.9, grow: 3.2, color: 0x9a928a, a: 0.16, drag: 0.2, grav: -0.05 });
      }
    }
    ambT -= dt;
    if (ambT <= 0) {
      ambT = 0.08;
      const fires = zones.get(P.zone)?.fires ?? [];
      for (const f of fires) {
        if (Math.abs(f.x - P.x) > 40 || Math.abs(f.z - P.z) > 40) continue;
        if (Math.random() < 0.6) sparks.emit({ x: f.x + (Math.random() - 0.5) * 0.4, y: f.y - 0.1, z: f.z + (Math.random() - 0.5) * 0.4, vx: (Math.random() - 0.5) * 0.5, vy: 1.2 + Math.random(), vz: (Math.random() - 0.5) * 0.5, life: 0.9, size: 0.12, color: 0xff9a40, grav: -0.3, drag: 0.5 });
      }
      const reg = region;
      const night = hour >= 20 || hour < 5.5;
      if (P.zone === "over" && (reg === "forest" || reg === "castle")) {
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
      } else if (P.zone === "over" && night && reg === "hearthfen" && Math.random() < 0.3) {
        const x = P.x + (Math.random() - 0.5) * 24;
        const z = P.z + (Math.random() - 0.5) * 24;
        sparks.emit({ x, y: world.groundAt(x, z) + 0.6 + Math.random(), z, vx: (Math.random() - 0.5) * 0.4, vy: 0.1, vz: (Math.random() - 0.5) * 0.4, life: 3, size: 0.13, color: 0xc8e070, grav: 0, drag: 0 });
      } else if (P.zone === "castle" && P.z > DUN.galleryZ1 + 4 && Math.random() < 0.4) {
        sparks.emit({ x: P.x + (Math.random() - 0.5) * 20, y: 1 + Math.random() * 6, z: P.z + (Math.random() - 0.5) * 20, vy: -0.2, life: 4, size: 0.08, color: 0xffd8a0, a: 0.6, grav: 0, drag: 0 });
      }
    }
    // npcs
    const night = hour >= 21 || hour < 5.6;
    for (const n of npcs) {
      const vis = n.zone === P.zone && Math.hypot(n.x - camera.position.x, n.z - camera.position.z) < 70;
      n.update(dt, t, night, groundAt, (x, z) => world!.col.resolve(x, z, 0.38), P, vis);
    }
    void rdt;
  }

  function finishCookie() {
    if (online) return void finishBoss("cookie");
    flags.cookie = true;
    const g = grantUniques(items, ["wpn_cookie_blade", "wpn_cookie_pick", "key_cookie_core"], uid);
    items = g.items;
    if (!seals.includes("seal_cookie")) seals = [...seals, "seal_cookie"];
    const blade = items.find((s) => s.def === "wpn_cookie_blade");
    if (blade) items = equip(items, blade.uid);
    syncGear();
    for (const m of mobs) if (m.kind === "soldier" && m.zone === "over" && m.alive) m.die();
    reward = ["wpn_cookie_blade", "wpn_cookie_pick", "key_cookie_core"].map((id) => ({ id, name: item(id).name, desc: DESCRIPTIONS[id] ?? "" }));
    mode = "reward";
    audio.reward();
    push();
  }

  function cull() {
    if (!world) return;
    const d = quality === "low" ? 95 : quality === "medium" ? 150 : 200;
    const gd = quality === "low" ? 0 : quality === "medium" ? 40 : 60;
    for (const s of world.scatters) s.cull(camera.position.x, camera.position.z, Math.min(s.maxDist, d));
    for (const s of world.grass) s.cull(camera.position.x, camera.position.z, gd);
    const zb = zones.get(P.zone);
    if (zb && P.zone !== "over") {
      for (const s of zb.scatters ?? []) s.cull(camera.position.x, camera.position.z, Math.min(s.maxDist, d));
      for (const s of zb.grass ?? []) s.cull(camera.position.x, camera.position.z, gd);
    }
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
    {
      const zb = zoneBoss();
      if (zb && zb.st === "dying") dt *= 0.55;
    }
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
      // a shared world keeps running behind menus; your own single player world waits for you
      const shared = online && !online.realm.solo;
      const sim = shared ? mode !== "title" && mode !== "create" && mode !== "loading" : mode === "play" || mode === "dead";
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
        const everyone = env.players();
        const nearAny = (m: Mob) => everyone.some((q) => q.zone === m.zone && (ZONES[m.zone].indoor || Math.hypot(m.x - q.x, m.z - q.z) <= 110));
        for (const m of mobs) {
          const localNear = m.zone === P.zone && (ZONES[m.zone].indoor || Math.hypot(m.x - P.x, m.z - P.z) <= 110);
          // the runner simulates every foe near any player; a puppet only needs to look right here
          // each zone has its own runner: only foes in this client's zone are its business
          const relevant = m.zone === P.zone && (m.puppet ? localNear : online ? nearAny(m) : localNear);
          if (!relevant && m.state !== "dead") {
            if (!localNear) m.rig.group.visible = false;
            continue;
          }
          if (!localNear) m.rig.group.visible = false;
          else if (m.state !== "dead" || m.deadT < 5) m.rig.group.visible = true;
          m.update(dt);
        }
        // keep mobs apart
        for (let i = 0; i < mobs.length; i++)
          for (let j = i + 1; j < mobs.length; j++) {
            const a = mobs[i];
            const b = mobs[j];
            if (!a.alive || !b.alive || a.zone !== b.zone || a.puppet || b.puppet) continue;
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
        updateHazards(dt);
        if (bossLine && performance.now() - bossLine.at > 4200) bossLine = null;
        updateLockRing();
        nearestInteract();
        edgePortals();
        const reg: string = P.zone === "castle" ? (P.z > DUN.galleryZ1 + 4 ? "nursery" : "dungeon") : P.zone === "over" ? regionAt(P.x, P.z) : zones.get(P.zone)?.regionAt?.(P.x, P.z) ?? P.zone;
        if (reg !== region) {
          if (reg === "castle" && !revealed && !flags.cookie) {
            revealed = true;
            revealT = 3.2;
          }
          region = reg;
          [placeName, placeSub] = regionTitle(reg);
          placeAt = performance.now();
          push();
        }
        if (P.zone === "over" && world && Math.hypot(P.x - GATE.x, P.z) < 15 && gateOpen(seals) && !flags.gate && !gateOpening) startGate();

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
        water: world && P.zone === "over" ? Math.min(1, world.terrain.waterAt(P.x, P.z) * 2 + (Math.abs(P.x - 82) < 18 ? 0.6 : 0)) : 0,
        forge: P.zone === "over" && mode !== "title" ? Math.max(0, 1 - Math.hypot(P.x - 11, P.z - 7) / 30) : mode === "title" ? 0.4 : 0,
        box: !flags.cookie && (P.zone === "castle" || P.zone === "over") ? (P.zone === "castle" ? (P.z > DUN.galleryZ1 - 10 ? 0.9 : 0.25) : Math.max(0, 1 - Math.hypot(P.x - 0, P.z - 170) / 40) * 0.5) : 0,
        boxRate: cookie ? cookie.boxRate : 1,
        indoor: ZONES[P.zone].indoor && !(P.zone === "castle" && P.z >= DUN.galleryZ1 + 4),
        ...musicNow(),
      });
      // network timers run on wall time, even when a slow frame stretches game time
      if (online) netFrame(Math.min(real, 1));
      // labels must use this frame's camera, not the last render's
      camera.updateMatrixWorld();
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
  };
  const onVis = () => {
    if (!document.hidden) online?.room.resume();
    if (document.hidden) {
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
  const onLost = (e: Event) => e.preventDefault();
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
        if (mode === "bag" || mode === "pause" || mode === "shop" || mode === "journal" || mode === "map") mode = "play";
        else if (mode === "talk") {
          talkQueue = [];
          advanceTalk();
        }
        push();
        return;
      case "pause":
        if (mode === "play") {
          mode = "pause";
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
        say(rewardBoss === "cookie" ? "The toys go still. Cookie's Core ticks against your ribs." : rewardBoss === "boe" ? "Boe's collar is light in your hand. Elspeth is in Harrenvale." : "The Keep is quiet.");
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

  // ------------------------------------------------------------ online play
  //
  // The server (web/server/schema.sql) owns characters, inventories, loot, world progress and
  // Cookie's health. One client, the "runner", simulates the enemies and Cookie and broadcasts
  // snapshots; the others draw puppets. Every client checks only its own dodge, block and parry:
  // the runner decides an attack reached you, your client decides whether it hurt.

  function livePeers(): PlayerState[] {
    if (!online) return [];
    const now = performance.now();
    const out: PlayerState[] = [];
    for (const r of online.remotes.values()) if (r.live(now)) out.push(r.state);
    return out;
  }

  function netHurt(q: PlayerState, dmg: number, sx: number, sz: number, o: HurtOpts = {}) {
    if (!online || !q.cid) return false;
    online.room.event({ k: "hurt", to: q.cid, d: dmg, sx: r2(sx), sz: r2(sz), kn: o.knock ?? 1, pa: o.parryable ? 1 : 0, ub: o.unblockable ? 1 : 0, src: o.src ?? "" }, true);
    return true;
  }

  /** A realm call for this character (and this world unless `world` is false). */
  function rpc<T>(fn: string, args: Record<string, unknown> = {}, world = true): Promise<T> {
    const o = online;
    if (!o) return Promise.reject(new Error("offline"));
    return o.realm.call<T>(fn, { ...(world ? { p_world: o.worldId } : {}), p_char: o.charId, ...args });
  }

  function netError(e: unknown) {
    const msg = String((e as Error)?.message ?? e);
    if (/Failed to fetch|NetworkError|not running|did not answer|Load failed/i.test(msg)) say("The realm is not answering. Your last change may not have saved.");
    else if (msg === "materials") say("Missing materials.");
    else if (msg === "station") say("Stand at the bench or the forge for that.");
    else if (msg.length < 90) say(msg);
    else say("The realm refused that.");
    audio.block();
  }

  /** The server's inventory replaces ours. */
  function setItems(list: StackJson[]) {
    items = list.map((s) => ({ uid: s.uid, def: s.def, count: s.count, equipped: s.equipped, mod: s.mod ?? null }));
    syncGear();
    push();
  }

  function lootDrops(drops: { item: string; n: number }[]) {
    for (const d of drops) floater(`+${d.n} ${item(d.item).name}`, P.x, P.y + 2.1, P.z, "heal");
  }

  function charFlag(f: string) {
    if (online) rpc("vm_char_flag", { p_flag: f }, false).catch(netError);
  }

  function memberFlag(f: string) {
    rpc<{ items: StackJson[]; drops: { item: string; n: number }[] }>("vm_member_flag", { p_flag: f })
      .then((r) => {
        setItems(r.items);
        lootDrops(r.drops);
      })
      .catch(netError);
  }

  function worldFlag(f: string) {
    return rpc<Record<string, boolean>>("vm_world_flag", { p_flag: f }).then((flagsNow) => {
      online?.room.event({ k: "flag", f }, true);
      return flagsNow;
    });
  }

  /** World progress made by anyone (an event, or the server's answer to a heartbeat). */
  function applyWorldFlag(f: string) {
    worldFlags[f] = true;
    if (f === "slab" && !flags.slab) {
      flags.slab = true;
      weightX = 9;
    } else if (f === "nursery" && !flags.nursery) {
      flags.nursery = true;
      audio.thud();
    } else if (f === "gate" && !flags.gate && !gateOpening) startGate(false);
    else if (f === "cookie" && !flags.cookie) {
      flags.cookie = true;
      if (!seals.includes("seal_cookie")) seals = [...seals, "seal_cookie"];
    }
    const bdef = Object.values(BOSSES).find((b) => b.flag === f);
    const b = bdef && bosses.get(bdef.id);
    if (b) {
      // a fight in progress finishes on screen: the runner plays the fall (its snapshot brings it to everyone);
      // a boss nobody here is watching, or an idle one, just lies still
      if (b.st !== "dying" && b.st !== "dead") {
        if (b.fighting && !b.puppet) b.hp = 0;
        else if (!b.fighting || P.zone !== b.def.zone) b.setDead();
      } else if (b.st === "dying" && b.puppet && P.zone !== b.def.zone) b.setDead();
    }
  }

  /** This client struck the killing blow: ask the server for the loot (once per foe per spawn). */
  function claimKill(key: string, m?: Mob) {
    kills++;
    if (m?.kind === "horse") {
      say("The rocking horse is still. The painted door is free.");
      audio.quest();
      deadLeft.set("dh", Infinity);
    }
    if (!online || !mobByKey.has(key)) return;
    rpc<{ items: StackJson[]; drops: { item: string; n: number }[]; dup: boolean; xp_gained?: number; level?: number; xp?: number }>("vm_loot", { p_mob: key })
      .then((r) => {
        setItems(r.items);
        if (r.dup) return;
        lootDrops(r.drops);
        const kind = m?.kind ?? MOB_SPAWNS.find((x) => x[0] === key)?.[1];
        if (kind) killCounts[kind] = (killCounts[kind] ?? 0) + 1;
        if (r.xp_gained) {
          if (m) floater(`+${r.xp_gained} XP`, m.x, m.y + m.cfg.height + 1.2, m.z, "info");
          // the server's total wins over our running sum (another tab, a quest, a boss)
          applyProgress({ xp: r.xp ?? xp + r.xp_gained, level: r.level });
        }
      })
      .catch(netError);
  }

  /** A blow on a boss: the server prices it against the shared health pool. Returns a local estimate for the number. */
  function bossHit(c: Boss, dmg: number, heavy: boolean, fire: boolean) {
    if (!online || !c.canTakeHit()) return 0;
    const f = c.hitFlags(P.x, P.z);
    let est = fire ? Math.round(dmg * 1.5) : dmg;
    if (f.perched && !fire) est = Math.max(1, Math.round(est * 0.5));
    if (heavy && f.behind && !fire) {
      est = Math.round(est * 1.3);
      floater("Back-stitch!", c.x, c.y + 3.6, c.z, "crit");
    }
    if (f.dizzy) est = Math.round(est * 1.3);
    const x = P.x;
    const z = P.z;
    const id = c.def.id;
    rpc<{ hp: number; max: number; dead: boolean; dealt: number }>("vm_boss_hit", { p_boss: id, p_heavy: heavy, p_fire: fire, p_behind: heavy && f.behind, p_perched: f.perched, p_dizzy: f.dizzy })
      .then((r) => {
        if (!r.dealt && !r.dead) return;
        if (r.max && r.max !== c.max) c.setMax(r.max);
        c.netHit(r.hp, x, z, heavy, fire);
        online?.room.event({ k: "bhp", b: id, hp: r.hp, x: r2(x), z: r2(z), hv: heavy ? 1 : 0, f: fire ? 1 : 0 }, true);
        if (r.dead) applyWorldFlag(c.def.flag);
      })
      .catch(netError);
    return est;
  }

  /** A boss fell in a shared world: the server already paid every fighter once. Show what we got. */
  async function finishBoss(id: string) {
    const def = BOSSES[id];
    if (!def || bossFinished.has(id)) return;
    bossFinished.add(id);
    worldFlags[def.flag] = true;
    if (id === "cookie") {
      flags.cookie = true;
      if (!seals.includes("seal_cookie")) seals = [...seals, "seal_cookie"];
      for (const m of mobs) if (m.kind === "soldier" && m.zone === "over" && m.alive && !m.puppet) m.die();
    }
    const o = online;
    if (!o) return;
    // decided at entry, not now: a refresh during the fall may already carry the prize
    const due = rewardDue[id];
    const first = def.rewards[0][0];
    try {
      const c = await o.realm.character(o.charId);
      if (online !== o) return;
      setItems(c.items);
      applyChar(c);
      const prize = c.items.find((s) => s.def === first);
      if (due && prize) {
        rewardDue[id] = false;
        if (ITEMS[first]?.slot === "main" && ITEMS[first].family !== "pick") {
          items = equip(items, prize.uid);
          syncGear();
          rpc<{ items: StackJson[] }>("vm_equip", { p_uid: prize.uid }, false).then((r) => setItems(r.items)).catch(() => {});
        }
        reward = def.rewards.map(([rid]) => ({ id: rid, name: item(rid).name, desc: DESCRIPTIONS[rid] ?? "" }));
        rewardBoss = id;
        if (mode === "play" || MENU_MODES.includes(mode)) mode = "reward";
        else rewardWaiting = true;
        audio.reward();
      } else say(prize ? `${def.name} falls again in this world.` : `${def.name} is defeated.`);
    } catch (e) {
      netError(e);
    }
    push();
  }

  function netState(): NetPlayer {
    return {
      x: r2(P.x), z: r2(P.z), y: r2(P.y), yw: r2(P.yaw), a: P.action, at: r2(P.action === "dead" ? P.at : P.at / P.dur), du: r2(P.dur), ac: actionCount,
      mv: r2(P.speed), sp: P.sprint ? 1 : 0, b: P.blocking ? 1 : 0, d: P.dead ? 1 : 0, zn: P.zone, cm: P.calm ? 1 : 0,
      hp: Math.ceil(P.hp), mh: P.maxHp, w: mainWeapon().id, sh: P.shield ? 1 : 0, ar: wornCode,
    };
  }

  type WorldSnap = { m: MobSnap[]; b: unknown; bi?: string };
  function worldSnap(): WorldSnap {
    const ps = env.players();
    // this client runs only its own zone: snapshot that zone's foes (and its boss)
    const near = (m: Mob) => ps.some((q) => q.zone === m.zone && Math.hypot(q.x - m.x, q.z - m.z) < 120);
    return {
      m: mobs.filter((m) => m.zone === P.zone && (near(m) || (m.state !== "idle" && m.state !== "dead"))).map((m) => m.snap()),
      b: zoneBoss()?.snap() ?? null,
      bi: zoneBoss()?.def.id ?? "",
    };
  }

  function onBundle(b: Bundle) {
    const o = online;
    if (!o) return;
    const now = performance.now();
    if (b.s) {
      const r = o.remotes.get(b.c);
      if (r) {
        const wasDead = r.state.dead;
        r.apply(b.s as NetPlayer, now);
        if (r.state.dead && !wasDead && r.state.zone === P.zone && Math.hypot(r.state.x - P.x, r.state.z - P.z) < 40) say(r.name + " is down. Reach them to pull them up.");
      }
    }
    if (b.w && b.wz === P.zone && !o.room.isRunner) {
      const w = b.w as WorldSnap;
      for (const sn of w.m) {
        const m = mobByKey.get(sn[0]);
        if (m && m.puppet) m.applySnap(sn);
      }
      const zb = zoneBoss();
      if (w.b && zb && zb.puppet && (w.bi ?? "cookie") === zb.def.id && !(worldFlags[zb.def.flag] && zb.st === "dead")) zb.applySnap(w.b);
    }
    if (b.ev) for (const ev of b.ev) onEvent(ev, b.c);
  }

  function onEvent(ev: Ev, from: string) {
    const o = online;
    if (!o) return;
    const me = o.room.cid;
    const num = (v: unknown, d = 0) => (typeof v === "number" && Number.isFinite(v) ? v : d);
    switch (ev.k) {
      case "hurt": {
        if (ev.to !== me) return;
        const src = String(ev.src ?? "");
        env.hurtPlayer(Math.min(60, num(ev.d)), num(ev.sx, P.x), num(ev.sz, P.z), {
          knock: num(ev.kn, 1), unblockable: !!ev.ub, parryable: !!ev.pa,
          source: ev.pa ? { stagger: (t: number) => o.room.event({ k: "parry", src, t }, true) } : undefined,
        });
        return;
      }
      case "parry": {
        if (!o.room.isRunner) return;
        const t = Math.min(2, num(ev.t, 1));
        const pb = bosses.get(String(ev.src));
        if (pb) pb.parry(t);
        else findMob(ev.src)?.stagger(t);
        return;
      }
      case "hit": {
        const m = findMob(ev.m);
        if (!m || !m.alive) return;
        // only the client that runs the world applies blows (a hidden tab that used to run it must not)
        if (!m.puppet && o.room.isRunner) {
          m.takeHit(Math.min(80, Math.max(0, num(ev.d))), num(ev.x, m.x), num(ev.z, m.z), !!ev.hv, !!ev.f, o.remotes.get(from)?.state);
          if (!m.alive) o.room.event({ k: "kill", m: m.key, to: from }, true);
        } else m.flash = 0.12;
        return;
      }
      case "hx": {
        const m = findMob(ev.m);
        if (m && m.puppet) m.flash = 0.12;
        return;
      }
      case "kill":
        if (ev.to === me) claimKill(String(ev.m), findMob(ev.m));
        return;
      case "bhp": {
        // applied even after the world flag: the runner needs the killing blow to finish the fight
        const b = bosses.get(String(ev.b ?? "cookie"));
        if (b && b.st !== "dead") {
          b.netHit(num(ev.hp, b.hp), num(ev.x), num(ev.z), !!ev.hv, !!ev.f);
          if (num(ev.hp, 1) <= 0) applyWorldFlag(b.def.flag);
        }
        return;
      }
      case "breset": {
        const b = bosses.get(String(ev.b ?? "cookie"));
        if (b && !worldFlags[b.def.flag] && b.st !== "dying") b.reset();
        return;
      }
      case "bmax": {
        const b = bosses.get(String(ev.b));
        if (b) b.setMax(num(ev.m, b.max));
        return;
      }
      case "hz":
        if (ev.to === me) localHazard({ kind: "rite", x: num(ev.x, P.x), z: num(ev.z, P.z), r: Math.min(4, num(ev.r, 2)), t: Math.min(8, num(ev.t, 5)), dmg: Math.min(80, num(ev.d, 30)), text: typeof ev.tx === "string" ? ev.tx : undefined });
        return;
      case "say":
        if (typeof ev.t === "string") speak(ev.t.slice(0, 120), false);
        return;
      case "flag":
        applyWorldFlag(String(ev.f));
        return;
      case "node": {
        const id = String(ev.id);
        if (world?.nodes.some((n) => n.id === id)) nodeState.set(id, { left: num(ev.l), regrow: num(ev.rg, 75) });
        return;
      }
      case "wx":
        weightX = Math.max(weightX, Math.min(9, num(ev.v)));
        return;
      case "bell":
        ringT = 3;
        if (P.zone === "over") audio.bell(0.22, 330);
        return;
      case "revive":
        if (ev.to === me && P.dead) {
          P.dead = false;
          P.hp = Math.round(P.maxHp * 0.4);
          P.action = "none";
          P.iframe = 1.2;
          mode = "play";
          sparks.burst(24, P.x, P.y + 1, P.z, 3, 0xffd28a, 1, 0.2, { up: 2, grav: -0.5 });
          audio.bell(0.12, 523);
          say(String(ev.by ?? "Someone") + " pulls you to your feet.");
          push();
        }
        return;
    }
  }

  /** Presence changed: add avatars for newcomers, drop the ones who left. */
  function syncPeers() {
    const o = online;
    if (!o || !world || !dun) return;
    for (const [cid, meta] of o.room.peers) {
      if (o.remotes.has(cid)) continue;
      // the same character reconnecting replaces its old avatar
      for (const [old, r] of o.remotes)
        if (r.charId === meta.ch) {
          r.remove();
          o.remotes.delete(old);
        }
      o.remotes.set(cid, new RemotePlayer(cid, meta.ch, meta.name, lookToHuman(meta.look as Look), (z) => zones.get(z)?.root ?? null, overlay));
      if (!o.names.has(meta.ch)) say(meta.name + " joined the world.");
      o.names.add(meta.ch);
    }
    for (const [cid, r] of o.remotes)
      if (!o.room.peers.has(cid)) {
        r.remove();
        o.remotes.delete(cid);
        if (![...o.remotes.values()].some((x) => x.charId === r.charId)) {
          o.names.delete(r.charId);
          say(r.name + " left the world.");
        }
      }
    push();
  }

  /** Every few seconds (and before position-checked actions): save where we are, read the shared clock and progress. */
  function heartbeat(): Promise<void> {
    const o = online;
    if (!o) return Promise.resolve();
    o.beatT = 5;
    o.lastBeat = performance.now();
    const play = Math.floor(o.playAcc);
    o.playAcc -= play;
    return rpc<HeartbeatJson>("vm_heartbeat", { p_x: r2(P.x), p_z: r2(P.z), p_yaw: r2(P.yaw), p_dungeon: P.zone === "castle", p_zone: P.zone, p_hp: Math.max(1, Math.round(P.hp)), p_play: play })
      .then((h) => {
        if (online !== o) return;
        let dh = h.hour - hour;
        if (dh > 12) dh -= 24;
        if (dh < -12) dh += 24;
        if (Math.abs(dh) > 0.08) hour = h.hour;
        o.day = h.day;
        for (const [f, on] of Object.entries(h.flags ?? {})) if (on) applyWorldFlag(f);
        for (const [id, st] of Object.entries(h.boss ?? {})) {
          if (!st) continue;
          o.boss[id] = st;
          const b = bosses.get(id);
          if (!b) continue;
          if (st.max > 0 && st.max !== b.max && !st.dead) b.setMax(st.max);
          // the server's pool is the truth: a lost "bhp" message cannot leave the runner's boss healthier
          if (!b.puppet && b.fighting && st.hp < b.hp) b.hp = st.hp;
        }
        o.room.aloneHint = h.online <= 1;
      })
      .catch(() => {
        /* a missed beat: the next one retries */
      });
  }

  /** The runner resets an abandoned fight so the next attempt starts fresh, for everyone. */
  function runnerDuties(dt: number) {
    const o = online!;
    const b = zoneBoss();
    if (!b || worldFlags[b.def.flag] || !b.fighting || b.st === "intro") {
      o.arenaEmptyT = 0;
      return;
    }
    const A = arenaOf(b.def);
    const anyone = env.players().some((q) => q.zone === b.def.zone && !q.dead && Math.hypot(q.x - A.x, q.z - A.z) < A.r + 4);
    o.arenaEmptyT = anyone ? 0 : o.arenaEmptyT + dt;
    if (o.arenaEmptyT > 6) {
      o.arenaEmptyT = 0;
      b.reset();
      rpc("vm_boss_reset", { p_boss: b.def.id }).catch(() => {});
      o.room.event({ k: "breset", b: b.def.id }, true);
    }
  }

  /** Start or stop simulating enemies and Cookie (called the moment the role changes). */
  function applyRole(force = false) {
    const o = online;
    if (!o) return;
    const runner = o.room.isRunner;
    if (runner === o.runner && !force) return;
    o.runner = runner;
    for (const m of mobs) m.setPuppet(!runner);
    for (const b of bosses.values()) b.setPuppet(!runner);
  }

  function netFrame(rdt: number) {
    const o = online!;
    const now = performance.now();
    // a long gap between frames means the page slept (a locked phone): listen before taking over
    if (rdt >= 1) o.room.resume();
    o.room.elect();
    applyRole();
    const runner = o.room.isRunner;
    for (const r of o.remotes.values()) r.update(rdt, now, env.time, P.zone);
    o.tickT -= rdt;
    if (o.tickT <= 0) {
      o.tickT = 1 / o.room.rate;
      o.room.tick(netState(), runner ? worldSnap() : undefined);
    }
    if (weightX > o.wxSent + 0.3) {
      o.wxSent = weightX;
      o.room.event({ k: "wx", v: r2(weightX) });
    }
    o.playAcc += rdt;
    o.beatT -= rdt;
    if (o.beatT <= 0) void heartbeat();
    if (runner) runnerDuties(rdt);
    questT -= rdt;
    if (questT <= 0) {
      questT = 1;
      questTick();
    }
    if (banner && performance.now() - banner.at > 5200) {
      banner = null;
      push();
    }
  }

  // ------------------------------------------------------------ progression, quests and shops
  function questCtx(): QuestCtx {
    return {
      level, zone: P.zone, x: P.x, z: P.z,
      count: (id) => countOf(items, id),
      charFlag: (f) => (f === "talked" ? flags.talked : f === "ember" ? flags.ember : false),
      worldFlag: (f) => !!worldFlags[f] || !!(flags as Record<string, boolean>)[f],
      kills: (k) => killCounts[k] ?? 0,
      boss: (id) => !!worldFlags[BOSSES[id]?.flag ?? id],
    };
  }

  function showBanner(title: string, sub: string) {
    banner = { title, sub, at: performance.now() };
    push();
  }

  /** Mirrors the server's view of this character's experience, level, health and quests. */
  function applyProgress(p: { xp?: number; level?: number; xp_lo?: number; xp_hi?: number; max_hp?: number; quests?: QuestBook; kill_counts?: Record<string, number> }, announce = true) {
    const before = level;
    if (p.xp !== undefined) xp = p.xp;
    level = p.level ?? levelOf(xp);
    xpLo = p.xp_lo ?? LEVEL_XP[level - 1] ?? 0;
    xpHi = p.xp_hi ?? LEVEL_XP[level] ?? xpLo;
    const st = statsFor(level);
    P.maxHp = p.max_hp ?? st.maxHp;
    P.maxStam = st.maxStam;
    if (P.maxMana > 0) P.maxMana = st.mana;
    if (p.quests) quests = p.quests;
    if (p.kill_counts) Object.assign(killCounts, p.kill_counts);
    if (announce && level > before) {
      P.hp = P.maxHp;
      P.stam = P.maxStam;
      sparks.burst(40, P.x, P.y + 1.2, P.z, 3, 0xffd86a, 1.2, 0.22, { up: 3, grav: -0.5 });
      audio.reward();
      showBanner("Level " + level, `Health ${P.maxHp} · Stamina ${P.maxStam} · Strikes ${Math.round((statsFor(level).power - 1) * 100)}% harder`);
    }
    push();
  }

  function applyChar(c: CharacterJson, announce = true) {
    applyProgress({ xp: c.xp, level: c.level, xp_lo: c.xp_lo, xp_hi: c.xp_hi, max_hp: c.max_hp, quests: c.quests, kill_counts: c.kill_counts }, announce);
  }

  function questTick() {
    if (!online || mode === "title" || mode === "create" || mode === "loading") return;
    for (const id of autoStarts(quests, level)) questCall(id, "start");
    const ctx = questCtx();
    for (const id of readyToStep(quests, ctx)) {
      const step = QUEST_BY_ID[id].steps[quests[id].s];
      // a "reach" is checked against the saved position: save it first
      questCall(id, "step", step?.k === "reach");
    }
  }

  function questCall(id: string, op: "start" | "step", beatFirst = false, then?: (r: QuestJson) => void) {
    const o = online;
    if (!o) return;
    const now = performance.now();
    if ((questWait.get(id) ?? 0) > now) return;
    questWait.set(id, now + 60000);
    (beatFirst ? heartbeat() : Promise.resolve())
      .then(() => rpc<QuestJson>("vm_quest", { p_quest: id, p_op: op }))
      .then((r) => {
        if (online !== o) return;
        questWait.set(id, 0);
        questResult(id, op, r);
        then?.(r);
      })
      .catch((e: Error) => {
        const step = QUEST_BY_ID[id]?.steps[quests[id]?.s ?? 0];
        questWait.set(id, performance.now() + (/not yet/i.test(e?.message ?? "") ? (step?.k === "boss" ? 30000 : 4000) : 15000));
      });
  }

  function questResult(id: string, op: "start" | "step", r: QuestJson) {
    const q = QUEST_BY_ID[id];
    const wasDone = !!quests[id]?.done;
    quests = r.quests ?? quests;
    if (r.items) setItems(r.items);
    applyProgress({ xp: r.xp, level: r.level });
    if (!q) return;
    if (op === "start") {
      audio.quest();
      say((q.main ? "" : "New quest: ") + (q.steps[0]?.text ?? q.name));
      return;
    }
    if (r.done && !wasDone) {
      audio.reward();
      const gifts = [q.rewards.xp ? q.rewards.xp + " XP" : "", q.rewards.crowns ? q.rewards.crowns + " crowns" : "", ...q.rewards.items.map(([it, n]) => (n > 1 ? n + " " : "") + item(it).name)].filter(Boolean).join(" · ");
      if (id === "q_gate") showBanner("KINGDOM UNLOCKED", "Harrenvale opens its gates: smiths, armourers, a tavern, the Castellan's work.");
      else showBanner(q.name, "Quest complete · " + gifts);
      // the last road of this chapter ends here
      if (id === "q_keep")
        setTimeout(() => {
          if (mode === "play" || mode === "reward") {
            mode = "end";
            audio.reward();
            push();
          } else endingDue = true;
        }, 5600);
      return;
    }
    const next = q.steps[r.step];
    if (next) {
      audio.quest();
      say(next.text);
    }
  }

  function shopView(id: string): Hud["shop"] {
    const sh = SHOPS.find((x) => x.id === id);
    if (!sh) return null;
    const crowns = countOf(items, "coin_crown");
    return {
      id: sh.id, name: sh.name, buys: sh.buys,
      stock: sh.stock.map(([it, price]) => {
        const p = price ?? ITEMS[it]?.value ?? 1;
        return { id: it, name: item(it).name, price: p, ok: crowns >= p };
      }),
      sell: sh.buys
        ? items
            .filter((s) => {
              const d = ITEMS[s.def];
              return d && !d.soulbound && d.kind !== "key" && d.kind !== "coin" && !s.equipped && Math.floor(d.value * SELL_RATE) >= 1;
            })
            .map((s) => ({ uid: s.uid, id: s.def, name: item(s.def).name, count: s.count, price: Math.floor(item(s.def).value * SELL_RATE) }))
        : [],
    };
  }

  function openShop(id: string) {
    if (!SHOPS.some((x) => x.id === id)) return;
    shopId = id;
    talk = null;
    talkQueue = [];
    mode = "shop";
    audio.ui();
    // the server checks the counter from the saved position
    void heartbeat();
    push();
  }

  function buy(itemId: string, n: number) {
    if (!shopId) return;
    rpc<{ items: StackJson[]; crowns: number }>("vm_buy", { p_shop: shopId, p_item: itemId, p_n: n })
      .then((r) => {
        setItems(r.items);
        audio.pickup();
        say(`Bought ${n > 1 ? n + " " : ""}${item(itemId).name}`);
      })
      .catch(netError);
  }

  function sell(uid: string, n: number) {
    if (!shopId) return;
    const s = items.find((x) => x.uid === uid);
    rpc<{ items: StackJson[]; crowns: number }>("vm_sell", { p_shop: shopId, p_uid: uid, p_n: n })
      .then((r) => {
        setItems(r.items);
        audio.pickup();
        if (s) say(`Sold ${n > 1 ? n + " " : ""}${item(s.def).name}`);
      })
      .catch(netError);
  }

  function onlineHud(): OnlineHud {
    const o = online!;
    const now = performance.now();
    const zone = (zn: ZoneId, x: number, z: number) => (zn === "over" ? REGION_TITLE[regionAt(x, z)][0] : ZONES[zn]?.name ?? zn);
    const players: OnlineHud["players"] = [{ name, hp: Math.ceil(P.hp), max: P.maxHp, dead: P.dead, me: true, away: false, zone: zone(P.zone, P.x, P.z) }];
    for (const r of o.remotes.values())
      players.push({ name: r.name, hp: r.state.hp, max: r.state.maxHp, dead: r.state.dead, me: false, away: !r.live(now), zone: zone(r.state.zone, r.state.x, r.state.z) });
    return { solo: o.realm.solo, code: o.code, world: o.worldName, day: o.day, status: o.room.status, runner: o.room.isRunner, players };
  }

  function leaveOnline() {
    const o = online;
    if (!o) return;
    void rpc("vm_heartbeat", { p_x: r2(P.x), p_z: r2(P.z), p_yaw: r2(P.yaw), p_dungeon: P.zone === "castle", p_zone: P.zone, p_hp: Math.max(1, Math.round(P.hp)), p_play: Math.floor(o.playAcc) })
      .catch(() => {})
      .finally(() => o.realm.call("vm_leave", { p_world: o.worldId, p_char: o.charId }).catch(() => {}));
    o.room.leave();
    for (const r of o.remotes.values()) r.remove();
    o.remotes.clear();
    online = null;
    for (const m of mobs) m.setPuppet(false);
    for (const b of bosses.values()) b.setPuppet(false);
    pendingRevive = null;
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
    for (const b of bosses.values()) {
      b.setPuppet(false);
      if (worldFlags[b.def.flag]) b.setDead();
      else b.reset();
      if (online) b.setPuppet(!online.room.isRunner);
    }
    if (online) online.runner = online.room.isRunner;
    spawnMobs();
    setZone(P.zone);
    if (P.zone === "castle" && P.z > DUN.galleryZ1 && !flags.cookie) {
      P.x = dun!.anchors.nurseryDoor.x;
      P.z = dun!.anchors.nurseryDoor.z - 2;
    }
    push();
  }

  const api: GameApi = {
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      leaveOnline();
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("visibilitychange", onVis);
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
      setZone("over");
      buildPlayer();
      P.y = world ? world.groundAt(P.x, P.z) : 0;
      push();
    },
    preview(l) {
      look = l;
      buildPlayer();
    },
    toTitle() {
      leaveOnline();
      mode = "title";
      talk = null;
      reward = null;
      setZone("over");
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
      if (online) rpc<{ items: StackJson[] }>("vm_equip", { p_uid: id }, false).then((r) => setItems(r.items)).catch(netError);
      syncGear();
      audio.ui();
      push();
    },
    use: useItem,
    craft: doCraft,
    enchant(uid: string, mod: string) {
      if (!online || stationNear !== "enchanter") return;
      const o = online;
      void heartbeat()
        .then(() => rpc<{ items: StackJson[] }>("vm_enchant", { p_uid: uid, p_mod: mod }))
        .then((r) => {
          if (online !== o) return;
          setItems(r.items);
          audio.craft();
          const s = items.find((x) => x.uid === uid);
          if (s) say(moddedName(item(s.def).name, s.mod) + ".");
        })
        .catch(netError);
    },
    trade: doTrade,
    openShop,
    buy,
    sell,
    travel: fastTravel,
    journal() {
      if (mode === "play" || mode === "pause") {
        mode = "journal";
        audio.ui();
        push();
      }
    },
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
    startOnline(realm, e) {
      audio.unlock();
      leaveOnline();
      const c = e.character;
      const w = e.world;
      const mem = e.member;
      name = c.name;
      look = c.look as Look;
      items = c.items.map((x) => ({ uid: x.uid, def: x.def, count: x.count, equipped: x.equipped }));
      flags = {
        ...freshFlags(),
        talked: !!c.flags.talked, ember: !!c.flags.ember, voss: !!c.flags.voss, ended: !!c.flags.ended,
        chest: !!mem.flags.chest, hollow: !!mem.flags.hollow, shrine: !!mem.flags.shrine, entered: !!mem.flags.entered,
        slab: !!w.flags.slab, nursery: !!w.flags.nursery, cookie: !!w.flags.cookie, gate: !!w.flags.gate,
      };
      seals = flags.cookie ? ["seal_cookie"] : [];
      const nowS = Date.parse(w.now);
      nodeState.clear();
      for (const [id, st] of Object.entries(w.nodes ?? {})) {
        const rg = (Date.parse(st.regrow_at) - nowS) / 1000;
        if (rg > 0) nodeState.set(id, { left: st.left, regrow: rg });
      }
      deadMobs.clear();
      deadLeft.clear();
      for (const [k, v] of Object.entries(w.dead_mobs ?? {})) {
        if (v === null) deadLeft.set(k, Infinity);
        else {
          const left = (Date.parse(v) - nowS) / 1000;
          if (left > 0) deadLeft.set(k, left);
        }
      }
      hour = w.hour;
      playTime = c.play_seconds;
      deaths = c.deaths;
      kills = c.kills;
      weightX = flags.slab ? 9 : 0;
      respawnShrine = flags.shrine;
      bossDoneT = -1;
      bossFinished.clear();
      for (const d of Object.values(BOSSES)) {
        if (w.flags?.[d.flag]) bossFinished.add(d.id);
        rewardDue[d.id] = !c.items.some((s) => s.def === d.rewards[0][0]);
      }
      rewardWaiting = false;
      endingDue = false;
      gateOpening = false;
      P.maxHp = c.max_hp;
      P.hp = c.hp > 0 ? Math.min(c.hp, c.max_hp) : c.max_hp;
      P.maxMana = c.mana_max;
      P.mana = P.maxMana;
      for (const k of Object.keys(killCounts)) delete killCounts[k];
      quests = {};
      questWait.clear();
      banner = null;
      level = c.level ?? 1;
      applyChar(c, false);
      cacheFlags.clear();
      for (const [f, on] of Object.entries(mem.flags ?? {})) if (on) cacheFlags.add(f);
      discovered.clear();
      discovered.add("hearthfen");
      for (const f of cacheFlags) if (f.startsWith("sh_")) discovered.add(f.slice(3));
      if (cacheFlags.has("shrine")) discovered.add("forest");
      lastShrine = null;
      for (const k of Object.keys(worldFlags)) delete worldFlags[k];
      for (const [f, on] of Object.entries(w.flags ?? {})) if (on) worldFlags[f] = true;
      if (mem.x !== null && mem.z !== null) {
        P.x = mem.x;
        P.z = mem.z;
        P.yaw = mem.yaw;
        P.zone = mem.zone && mem.zone in ZONES ? (mem.zone as ZoneId) : mem.dungeon ? "castle" : "over";
        if (!zones.has(P.zone)) {
          P.zone = "over";
          P.x = SPAWN.x;
          P.z = SPAWN.z;
        }
      } else {
        // first time in this world: wake by the bell, a step apart from whoever is already here
        const others = w.members.filter((m) => m.online && m.character_id !== c.id).length;
        const a = others * 2.1 + 0.6;
        P.x = SPAWN.x + (others ? Math.cos(a) * 2.2 : 0);
        P.z = SPAWN.z + (others ? Math.sin(a) * 2.2 : 0);
        P.yaw = SPAWN.yaw;
        P.zone = "over";
        if (world) {
          const r = world.col.resolve(P.x, P.z, 0.5);
          P.x = r.x;
          P.z = r.z;
        }
      }
      Object.assign(P, { dead: false, action: "none", kx: 0, kz: 0, vx: 0, vz: 0, stam: P.maxStam });
      const room = new Room(realm.backend, w.id, { id: c.id, name: c.name, look: c.look }, P.zone);
      online = {
        realm, room, worldId: w.id, code: w.code, worldName: w.name, charId: c.id, day: w.day, remotes: new Map(), tickT: 0, beatT: 5, playAcc: 0,
        boss: Object.fromEntries(Object.entries(w.boss ?? {}).filter(([, v]) => !!v)) as Record<string, BossJson>, arenaEmptyT: 0, wxSent: weightX, runner: false, lastBeat: 0,
        names: new Set(w.members.filter((m) => m.online && m.character_id !== c.id).map((m) => m.character_id)),
      };
      room.aloneHint = !w.members.some((m) => m.online && m.character_id !== c.id);
      room.onBundle = onBundle;
      room.onPeers = syncPeers;
      room.onStatus = () => push();
      room.onRole = () => applyRole();
      buildPlayer();
      fadeThen(() => {
        beginPlay();
        placeAt = performance.now();
        setTimeout(() => say(`${w.name} · Day ${w.day}. Code ${w.code}.`), 1200);
      });
    },
  };

  // test hooks for the browser harness (not used by the game)
  window.__veyr = {
    state: () => ({ x: P.x, z: P.z, y: P.y, hp: P.hp, action: P.action, hold: P.holding, holdT: P.holdT, time: env.time, frameN, mode, region, dungeon: P.zone === "castle", zone: P.zone, flags: { ...flags }, items: items.map((s) => s.def + ":" + s.count), seals: [...seals], cookie: cookie ? { hp: cookie.hp, st: cookie.st, phase: cookie.phaseN } : null, fps }),
    teleport: (x: number, z: number, where?: boolean | ZoneId) => {
      const zn: ZoneId = where === undefined ? zoneAt(x) : typeof where === "boolean" ? (where ? "castle" : "over") : where;
      if (zn !== P.zone) setZone(zn);
      P.x = x;
      P.z = z;
      P.y = groundAt(x, z);
      snapCam();
      nearestInteract();
    },
    give: (id: string, n: number) => {
      items = addItem(items, id, n, uid);
      push();
    },
    /** build a zone now (as walking toward it would) */
    loadZone: (z: ZoneId) => ensureZone(z),
    /** a world flag as this client sees it; `set` asks the server like a lever would */
    setWorldFlag: (f: string) => worldFlag(f).then(() => !!worldFlags[f]).catch((e: Error) => "refused: " + (e?.message ?? e)),
    bossState: (id: string) => {
      const b = bosses.get(id);
      return b ? { x: b.x, y: b.y, z: b.z, yaw: b.yaw, hp: b.hp, max: b.max, st: b.st, phase: b.phaseN, puppet: b.puppet } : null;
    },
    hazards: () => hazards.map((h) => ({ x: h.h.x, z: h.h.z, r: h.h.r, left: h.left })),
    theme: () => audio.theme,
    zoneMobs: (z: ZoneId) => mobs.filter((m) => m.zone === z).map((m) => ({ key: mobKey.get(m) ?? m.key, k: m.kind, x: m.x, z: m.z, hp: m.hp, alive: m.alive, st: m.state })),
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
    mobs: () => mobs.filter((m) => m.alive && m.zone === P.zone).map((m) => ({ k: m.kind, x: m.x, z: m.z, hp: m.hp })),
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
    online: () =>
      online
        ? {
            cid: online.room.cid, runner: online.room.isRunner, code: online.code, status: online.room.status,
            peers: [...online.remotes.values()].map((r) => ({ name: r.name, x: r.state.x, z: r.state.z, live: r.live(performance.now()), dead: r.state.dead, dn: r.state.zone === "castle", zone: r.state.zone, visible: r.rig.group.visible })),
            mobs: mobs.filter((m) => m.alive).map((m) => ({ key: m.key, k: m.kind, x: m.x, z: m.z, hp: m.hp, puppet: m.puppet, st: m.state })),
            boss: cookie ? { hp: cookie.hp, st: cookie.st, puppet: cookie.puppet, toys: cookie.toys.length } : null,
            kills,
          }
        : null,
    refresh: () => {
      if (online) void online.realm.character(online.charId).then((c) => setItems(c.items));
    },
    beat: () => heartbeat(),
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
