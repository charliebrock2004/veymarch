import type { Backend, Channel, ChannelStatus, PresenceMeta } from "./backend";

/**
 * One open world session: a realtime channel, who is here, and who runs the world.
 *
 * Every client sends one bundle per tick: its own player state, any queued events, and (if it
 * runs the world) the enemy and boss snapshot. Bundling keeps the message count inside the
 * free Realtime quota (100 events/s, counted per send and per delivery).
 *
 * The "world runner" is the earliest live connection. It simulates enemies and Cookie and
 * broadcasts snapshots; everyone else shows puppets. If it goes quiet for a few seconds (a phone
 * locked, a tab closed) the next connection takes over from the last snapshot. Two runners can
 * briefly overlap after a phone wakes up; the one that took over more recently wins, because
 * its state is the fresher one.
 */

export type Bundle = {
  /** sender connection id */
  c: string;
  /** sender's player state */
  s?: unknown;
  /** world snapshot (runner only) */
  w?: unknown;
  /** when the sender became runner */
  hs?: number;
  /** events */
  ev?: Ev[];
};

export type Ev = { k: string; to?: string; [key: string]: unknown };

const LIVE_MS = 4000;
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
  /** when the channel first connected; a newcomer listens briefly before it may run the world */
  connectedAt = 0;
  peers = new Map<string, PresenceMeta & { seen: number; firstSeen: number }>();
  runner: string | null = null;
  runnerSince = 0;
  private ch: Channel;
  private queue: Ev[] = [];
  private lastFlush = 0;
  private me: PresenceMeta;
  onBundle: (b: Bundle) => void = () => {};
  onPeers: () => void = () => {};
  onStatus: (s: ChannelStatus) => void = () => {};

  constructor(backend: Backend, worldId: string, character: { id: string; name: string; look: unknown }) {
    this.me = { cid: this.cid, ch: character.id, name: character.name, look: character.look, j: this.joinedAt };
    this.ch = backend.channel("vm-" + worldId, this.cid);
    this.ch.onStatus((s) => {
      this.status = s;
      if (s === "connected" && !this.connectedAt) this.connectedAt = Date.now();
      this.onStatus(s);
    });
    this.ch.onPresence((list) => {
      const now = Date.now();
      const next = new Map<string, PresenceMeta & { seen: number; firstSeen: number }>();
      for (const m of list) {
        if (!m || m.cid === this.cid) continue;
        const old = this.peers.get(m.cid);
        next.set(m.cid, { ...m, seen: old?.seen ?? now, firstSeen: old?.firstSeen ?? now });
      }
      this.peers = next;
      this.elect();
      this.onPeers();
    });
    this.ch.onMessage((raw) => {
      const b = raw as Bundle;
      if (!b || typeof b.c !== "string" || b.c === this.cid) return;
      const p = this.peers.get(b.c);
      if (p) p.seen = Date.now();
      if (b.w !== undefined) {
        const prev = this.runner;
        if (this.runner === this.cid) {
          // someone else is also running the world: the more recent takeover wins
          if ((b.hs ?? 0) > this.runnerSince || ((b.hs ?? 0) === this.runnerSince && b.c < this.cid)) this.runner = b.c;
        } else this.runner = b.c;
        if (debug && prev !== this.runner) console.warn(`[net] ${this.cid} follows runner ${b.c} (since ${b.hs}, mine ${this.runnerSince})`);
      }
      this.onBundle(b);
    });
    this.ch.track(this.me);
  }

  /** Connections heard from recently (plus me), earliest first. */
  live(): { cid: string; j: number }[] {
    const now = Date.now();
    const out = [{ cid: this.cid, j: this.joinedAt }];
    for (const p of this.peers.values()) if (now - Math.max(p.seen, p.firstSeen) < LIVE_MS) out.push({ cid: p.cid, j: p.j });
    return out.sort((a, b) => a.j - b.j || (a.cid < b.cid ? -1 : 1));
  }

  /** Keeps the current runner while it is live; otherwise the earliest live connection. */
  elect() {
    const live = this.live();
    if (this.runner && live.some((p) => p.cid === this.runner)) return;
    // listen first: an existing runner announces itself with its next snapshot
    if (!this.connectedAt || Date.now() - this.connectedAt < 2500) return;
    const prev = this.runner;
    this.runner = live[0].cid;
    if (this.runner === this.cid && prev !== this.cid) this.runnerSince = Date.now();
    if (debug && prev !== this.runner) {
      const now = Date.now();
      console.warn(`[net] ${this.cid} runner ${prev} -> ${this.runner}; peers ${[...this.peers.values()].map((p) => `${p.cid}:${now - p.seen}ms`).join(" ")}`);
    }
  }

  get isRunner() {
    return this.runner === this.cid;
  }

  get count() {
    return this.live().length;
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
      if (this.queue.length) this.send({ c: this.cid, ev: this.queue.splice(0) });
    }, wait);
  }

  /** One tick: my state, world snapshot if I run the world, and queued events. */
  tick(state: unknown, world?: unknown) {
    const b: Bundle = { c: this.cid, s: state };
    if (world !== undefined && this.isRunner) {
      b.w = world;
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
