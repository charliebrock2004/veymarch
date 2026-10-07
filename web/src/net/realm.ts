import { RealmError, getBackend, type Backend } from "./backend";

/**
 * Typed calls to the realm functions (web/server/schema.sql). The player is identified by a
 * device key: a random id + secret registered once and kept in local storage. The key can be
 * copied to another device to play the same characters there.
 */

export type LookJson = { body: 0 | 1 | 2; skin: number; hair: 0 | 1 | 2 | 3; hairColor: number; coat: number };
export type StackJson = { uid: string; def: string; count: number; equipped: boolean };

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
  boss: { cookie?: BossJson };
  nodes: Record<string, { left: number; regrow_at: string }>;
  dead_mobs: Record<string, string | null>;
  max: number;
  now: string;
  members: { character_id: string; name: string; look: LookJson; online: boolean }[];
};

export type EnterJson = {
  world: WorldJson;
  character: CharacterJson;
  member: { x: number | null; z: number | null; yaw: number; dungeon: boolean; flags: Record<string, boolean> };
};

export type Profile = { characters: CharacterJson[]; worlds: WorldCard[] };

export type HeartbeatJson = { ok: boolean; hour: number; day: number; flags: Record<string, boolean>; boss: { cookie?: BossJson }; now: string; online: number };

type Ident = { id: string; secret: string };
const KEY = "veyrmarch.player";

function readIdent(key: string): Ident | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const v = JSON.parse(raw) as Ident;
    return v.id && v.secret ? v : null;
  } catch {
    return null;
  }
}

function writeIdent(key: string, v: Ident) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* private mode: the key lives for this session only */
  }
}

function randomSecret() {
  const b = new Uint8Array(32);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}

export class Realm {
  private ident: Ident | null;
  private registering: Promise<Ident> | null = null;

  /** `key` is where this device keeps its player key: online and single player use separate ones. */
  constructor(public backend: Backend, private key = KEY) {
    this.ident = readIdent(key);
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

  async useDeviceKey(key: string) {
    const m = /^VM1\.([0-9a-f-]{36})\.([0-9a-f]{24,128})$/i.exec(key.trim());
    if (!m) throw new RealmError("That is not a VEYRMARCH player key");
    const next = { id: m[1].toLowerCase(), secret: m[2].toLowerCase() };
    await this.backend.rpc("vm_profile", { p_player: next.id, p_secret: next.secret });
    this.ident = next;
    writeIdent(this.key, next);
  }

  private async me(): Promise<Ident> {
    if (this.ident) return this.ident;
    if (!this.registering)
      this.registering = (async () => {
        const secret = randomSecret();
        const id = await this.backend.rpc<string>("vm_register", { p_secret: secret });
        const v = { id, secret };
        this.ident = v;
        writeIdent(this.key, v);
        return v;
      })().finally(() => (this.registering = null));
    return this.registering;
  }

  /** Every authenticated call. A key the server no longer knows is replaced once. */
  async call<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
    const me = await this.me();
    try {
      return await this.backend.rpc<T>(fn, { p_player: me.id, p_secret: me.secret, ...args });
    } catch (e) {
      if (e instanceof RealmError && e.code === "28000" && fn === "vm_profile") {
        this.ident = null;
        const again = await this.me();
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
}

/** Accepts what people actually type: lower case, spaces and dashes. Codes never use O, 0, I or 1. */
export function normalizeCode(raw: string) {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
}
