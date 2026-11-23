import type { Backend, Channel, ChannelStatus, PresenceMeta } from "./backend";

/**
 * One open world session: a realtime channel, who is here, and who runs each zone.
 *
 * Every client sends one bundle per tick: its own player state, its zone, any queued events, and
 * (if it runs its zone) the enemy and boss snapshot for that zone. Bundling keeps the message
 * count inside the free Realtime quota (100 events/s, counted per send and per delivery).
 *
 * Each zone has its own "runner": the client that simulates that zone's enemies and boss and
 * broadcasts snapshots; everyone else in the zone shows puppets. Nobody simulates a zone nobody
 * stands in. If a runner goes quiet for a few seconds (a phone locked, a tab closed, a walk
 * through a door) the next player in the zone takes over from the last snapshot. Two runners can
 * briefly overlap after a phone wakes up; the one that took over more recently wins, because its
 * state is the fresher one.
 */

export type Bundle = {
  /** sender connection id */
  c: string;
  /** sender's zone */
  z?: string;
  /** sender's player state */
  s?: unknown;
  /** zone snapshot (that zone's runner only) */
  w?: unknown;
  /** the zone `w` describes */
  wz?: string;
  /** when the sender became runner of `wz` */
  hs?: number;
  /** events */
  ev?: Ev[];
};

export type Ev = { k: string; to?: string; [key: string]: unknown };

type Peer = PresenceMeta & { seen: number; firstSeen: number; z: string };

const LIVE_MS = 4000;
/** after walking into a zone with others in it, listen this long for its runner before electing */
const ZONE_LISTEN_MS = 1500;
const debug = (() => {
  try {
    return localStorage.getItem("veyrmarch.netdebug") === "1";
  } catch {
    return false;
  }
})();

export class Room {
  readonly cid = Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  readonly joinedAt = Date.now();
  status: ChannelStatus = "connecting";
  /** when the channel last (re)connected or the page woke up: listen briefly before running the world */
  connectedAt = 0;
  /** the server's view (from the last enter or heartbeat): nobody else is in this world right now */
  aloneHint = false;
  peers = new Map<string, Peer>();
  /** runner of the zone this client stands in */
  runner: string | null = null;
  runnerSince = 0;
  zone: string;
  private zoneAt = Date.now();
  private ch: Channel;
  private queue: Ev[] = [];
  private lastFlush = 0;
  private me: PresenceMeta & { z: string };
  /** a single player world: nobody to wait for */
  private solo: boolean;
  onBundle: (b: Bundle) => void = () => {};
  onPeers: () => void = () => {};
  onStatus: (s: ChannelStatus) => void = () => {};
  /** fires as soon as this client starts or stops running its zone, even while no frames run */
  onRole: (runner: boolean) => void = () => {};

  constructor(backend: Backend, worldId: string, character: { id: string; name: string; look: unknown }, zone: string) {
    this.zone = zone;
    this.me = { cid: this.cid, ch: character.id, name: character.name, look: character.look, j: this.joinedAt, z: zone };
    this.solo = backend.kind === "solo";
    this.ch = backend.channel("vm-" + worldId, this.cid);
    this.ch.onStatus((s) => {
      this.status = s;
      if (s === "connected") this.connectedAt = Date.now();
      this.onStatus(s);
    });
    this.ch.onPresence((list) => {
      const now = Date.now();
      const next = new Map<string, Peer>();
      for (const m of list) {
        if (!m || m.cid === this.cid) continue;
        const old = this.peers.get(m.cid);
        const mz = (m as unknown as { z?: unknown }).z;
        const z = typeof mz === "string" ? mz : old?.z ?? "over";
        next.set(m.cid, { ...m, seen: old?.seen ?? now, firstSeen: old?.firstSeen ?? now, z: old && old.seen > now - 1000 ? old.z : z });
      }
      this.peers = next;
      this.elect();
      this.onPeers();
    });
    this.ch.onMessage((raw) => {
      const b = raw as Bundle;
      if (!b || typeof b.c !== "string" || b.c === this.cid) return;
      const p = this.peers.get(b.c);
      if (p) {
        p.seen = Date.now();
        if (typeof b.z === "string") p.z = b.z;
      }
      if (b.w !== undefined && b.wz === this.zone) {
        const prev = this.runner;
        if (this.runner === this.cid) {
          // someone else is also running this zone: the more recent takeover wins
          if ((b.hs ?? 0) > this.runnerSince || ((b.hs ?? 0) === this.runnerSince && b.c < this.cid)) this.runner = b.c;
        } else this.runner = b.c;
        if (prev !== this.runner) {
          if (debug) console.warn(`[net] ${this.cid} follows runner ${b.c} of ${this.zone} (since ${b.hs}, mine ${this.runnerSince})`);
          if (prev === this.cid) this.onRole(false);
        }
      }
      this.onBundle(b);
    });
    this.ch.track(this.me);
  }

  /** Walked through a door: forget the old zone's runner and find (or become) the new one's. */
  setZone(zone: string) {
    if (zone === this.zone) return;
    const was = this.isRunner;
    this.zone = zone;
    this.zoneAt = Date.now();
    this.runner = null;
    this.runnerSince = 0;
    this.me = { ...this.me, z: zone };
    this.ch.track(this.me);
    if (was) this.onRole(false);
    this.elect();
  }

  private isLive(p: Peer, now: number) {
    return now - Math.max(p.seen, p.firstSeen) < LIVE_MS;
  }

  /** Connections in my zone heard from recently (plus me), earliest first. */
  live(): { cid: string; j: number }[] {
    const now = Date.now();
    const out = [{ cid: this.cid, j: this.joinedAt }];
    for (const p of this.peers.values()) if (p.z === this.zone && this.isLive(p, now)) out.push({ cid: p.cid, j: p.j });
    return out.sort((a, b) => a.j - b.j || (a.cid < b.cid ? -1 : 1));
  }

  /**
   * Keeps the current runner while it is live and in this zone; otherwise the earliest live
   * connection here. A client never takes over on its own silence: after (re)connecting or waking
   * up it listens first (the runner's next snapshot settles it), while disconnected it only runs
   * the world if the server says nobody else is here, and after walking into a zone that has
   * other players it listens for that zone's runner before electing one.
   */
  elect() {
    const live = this.live();
    if (this.runner && live.some((p) => p.cid === this.runner)) return;
    if (!this.solo) {
      const now = Date.now();
      if (this.status !== "connected") {
        if (!(this.aloneHint && now - this.joinedAt > 5000)) return;
      } else if (!this.connectedAt || now - this.connectedAt < 2500) return;
      if (live.length > 1 && now - this.zoneAt < ZONE_LISTEN_MS) return;
    }
    const prev = this.runner;
    this.runner = live[0].cid;
    if (this.runner === this.cid && prev !== this.cid) this.runnerSince = Date.now();
    if (prev !== this.runner) {
      if (debug) {
        const now = Date.now();
        console.warn(`[net] ${this.cid} runner of ${this.zone}: ${prev} -> ${this.runner}; peers ${[...this.peers.values()].map((p) => `${p.cid}@${p.z}:${now - p.seen}ms`).join(" ")}`);
      }
      if (this.runner === this.cid || prev === this.cid) this.onRole(this.runner === this.cid);
    }
  }

  /** The page woke up (a phone unlocked, a tab came back): give everyone a moment to be heard again. */
  resume() {
    const now = Date.now();
    this.connectedAt = now;
    for (const p of this.peers.values()) p.seen = now;
  }

  get isRunner() {
    return this.runner === this.cid;
  }

  /** Everyone in the world heard from recently, me included (the message quota is per world). */
  get count() {
    const now = Date.now();
    let n = 1;
    for (const p of this.peers.values()) if (this.isLive(p, now)) n++;
    return n;
  }

  /** Ticks per second for player state, so N players stay under the realtime quota. */
  get rate() {
    const n = this.count;
    return n <= 2 ? 10 : n === 3 ? 7 : 5;
  }

  event(ev: Ev, urgent = false) {
    this.queue.push(ev);
    if (urgent) this.flushSoon();
  }

  private flushTimer = 0;
  private flushSoon() {
    if (this.flushTimer) return;
    const wait = Math.max(0, 80 - (Date.now() - this.lastFlush));
    this.flushTimer = window.setTimeout(() => {
      this.flushTimer = 0;
      if (this.queue.length) this.send({ c: this.cid, z: this.zone, ev: this.queue.splice(0) });
    }, wait);
  }

  /** One tick: my state and zone, my zone's snapshot if I run it, and queued events. */
  tick(state: unknown, world?: unknown) {
    const b: Bundle = { c: this.cid, z: this.zone, s: state };
    if (world !== undefined && this.isRunner) {
      b.w = world;
      b.wz = this.zone;
      b.hs = this.runnerSince;
    }
    if (this.queue.length) b.ev = this.queue.splice(0);
    this.send(b);
  }

  private send(b: Bundle) {
    this.lastFlush = Date.now();
    this.ch.send(b);
  }

  leave() {
    if (this.flushTimer) clearTimeout(this.flushTimer);
    this.ch.leave();
  }
}
