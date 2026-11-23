import { RealmError, getBackend, type Backend } from "./backend";
import { ensureIdent, readIdent, writeIdent, type Ident, type KeyStore } from "./ident";

/**
 * Typed calls to the realm functions (web/server/schema.sql). The player is identified by a
 * device key: a random id + secret registered once and kept in local storage. The key can be
 * copied to another device to play the same characters there.
 */

export type LookJson = { body: 0 | 1 | 2; skin: number; hair: 0 | 1 | 2 | 3; hairColor: number; coat: number };
export type StackJson = { uid: string; def: string; count: number; equipped: boolean; mod?: string | null };

export type CharacterJson = {
  id: string;
  name: string;
  look: LookJson;
  hp: number;
  max_hp: number;
  mana_max: number;
  flags: Record<string, boolean | string>;
  kills: number;
  deaths: number;
  play_seconds: number;
  level: number;
  weapon: string;
  items: StackJson[];
  last_world: string | null;
  place: string | null;
  /** experience, and the thresholds of the current level (equal at the cap) */
  xp?: number;
  xp_lo?: number;
  xp_hi?: number;
  crowns?: number;
  kill_counts?: Record<string, number>;
  quests?: Record<string, { s: number; b: number; done: boolean }>;
};

/** What vm_quest answers. */
export type QuestJson = {
  quests: Record<string, { s: number; b: number; done: boolean }>;
  items: StackJson[];
  xp: number;
  level: number;
  crowns: number;
  done: boolean;
  step: number;
};

export type WorldCard = {
  id: string;
  code: string;
  name: string;
  mine: boolean;
  day: number;
  hour: number;
  max: number;
  cookie: boolean;
  gate: boolean;
  players: number;
  online: number;
  members: { name: string; online: boolean }[];
};

export type BossJson = { hp: number; max: number; dead: boolean; fight: number };

export type WorldJson = {
  id: string;
  code: string;
  name: string;
  flags: Record<string, boolean>;
  hour: number;
  day: number;
  boss: Record<string, BossJson | undefined>;
  nodes: Record<string, { left: number; regrow_at: string }>;
  dead_mobs: Record<string, string | null>;
  max: number;
  now: string;
  members: { character_id: string; name: string; look: LookJson; online: boolean }[];
};

export type EnterJson = {
  world: WorldJson;
  character: CharacterJson;
  member: { x: number | null; z: number | null; yaw: number; dungeon: boolean; zone?: string; flags: Record<string, boolean> };
};

export type Profile = { characters: CharacterJson[]; worlds: WorldCard[] };

export type HeartbeatJson = { ok: boolean; hour: number; day: number; flags: Record<string, boolean>; boss: Record<string, BossJson | undefined>; now: string; online: number };

const KEY = "veyrmarch.player";

function storage(): KeyStore | null {
  try {
    return localStorage;
  } catch {
    return null;
  }
}

export class Realm {
  private ident: Ident | null;

  /** `key` is where this device keeps its player key: online and single player use separate ones. */
  constructor(public backend: Backend, private key = KEY) {
    this.ident = readIdent(storage(), key);
  }

  static async open(): Promise<Realm | null> {
    const b = await getBackend();
    return b ? new Realm(b) : null;
  }

  /** The private world database on this device (single player). */
  static async openSolo(): Promise<Realm> {
    const { soloBackend } = await import("./solo");
    return new Realm(await soloBackend(), KEY + ".solo");
  }

  get solo() {
    return this.backend.kind === "solo";
  }

  get playerId() {
    return this.ident?.id ?? null;
  }

  /** "VM1.<id>.<secret>": paste it on another device to play the same characters. */
  get deviceKey() {
    return this.ident ? `VM1.${this.ident.id}.${this.ident.secret}` : "";
  }

  /** The key this device used before the last switch (kept so a switch can be undone). */
  get previousKey() {
    const v = readIdent(storage(), this.key + ".prev");
    return v ? `VM1.${v.id}.${v.secret}` : "";
  }

  async useDeviceKey(key: string) {
    const m = /^VM1\.([0-9a-f-]{36})\.([0-9a-f]{24,128})$/i.exec(key.trim());
    if (!m) throw new RealmError("That is not a VEYRMARCH player key");
    const next = { id: m[1].toLowerCase(), secret: m[2].toLowerCase() };
    if (this.ident && this.ident.id === next.id && this.ident.secret === next.secret) return;
    await this.backend.rpc("vm_profile", { p_player: next.id, p_secret: next.secret });
    // the old key exists only on this device (the server keeps a hash): keep it to switch back
    if (this.ident) writeIdent(storage(), this.key + ".prev", this.ident);
    this.ident = next;
    writeIdent(storage(), this.key, next);
  }

  /** This device's key, registering it once (shared with every other Realm on the page). */
  private async me(stale?: Ident): Promise<Ident> {
    if (this.ident && !stale) return this.ident;
    this.ident = await ensureIdent(storage(), this.key, (secret) => this.backend.rpc<string>("vm_register", { p_secret: secret }), stale);
    return this.ident;
  }

  /** Every authenticated call. A key the server no longer knows is replaced once. */
  async call<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
    const me = await this.me();
    try {
      return await this.backend.rpc<T>(fn, { p_player: me.id, p_secret: me.secret, ...args });
    } catch (e) {
      if (e instanceof RealmError && e.code === "28000" && fn === "vm_profile") {
        const again = await this.me(me);
        return this.backend.rpc<T>(fn, { p_player: again.id, p_secret: again.secret, ...args });
      }
      throw e;
    }
  }

  profile() {
    return this.call<Profile>("vm_profile");
  }
  createCharacter(name: string, look: LookJson) {
    return this.call<CharacterJson>("vm_create_character", { p_name: name, p_look: look });
  }
  importCharacter(payload: unknown) {
    return this.call<CharacterJson>("vm_import_character", { p_payload: payload });
  }
  deleteCharacter(id: string) {
    return this.call<Profile>("vm_delete_character", { p_char: id });
  }
  character(id: string) {
    return this.call<CharacterJson>("vm_character", { p_char: id });
  }
  createWorld(name: string) {
    return this.call<WorldCard>("vm_create_world", { p_name: name });
  }
  join(code: string, charId: string) {
    return this.call<EnterJson>("vm_join", { p_code: code, p_char: charId });
  }
  enter(worldId: string, charId: string) {
    return this.call<EnterJson>("vm_enter", { p_world: worldId, p_char: charId });
  }
  /** Leave someone else's world for good (rejoin with its code). */
  leaveWorld(worldId: string) {
    return this.call<Profile>("vm_leave_world", { p_world: worldId });
  }
  /** Delete a world you made; everyone in it loses it from their list. */
  deleteWorld(worldId: string) {
    return this.call<Profile>("vm_delete_world", { p_world: worldId });
  }
}

/** Accepts what people actually type: lower case, spaces and dashes. Codes never use O, 0, I or 1. */
export function normalizeCode(raw: string) {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
}
