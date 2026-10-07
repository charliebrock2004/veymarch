/**
 * The realm backend: remote procedure calls for everything persistent, and one realtime channel
 * per world for live play. Two implementations share this shape:
 *   - Supabase (production): Postgres functions over PostgREST, Realtime broadcast + presence.
 *   - Local (development and tests): server/dev-server.mjs, the same SQL in PGlite plus a tiny
 *     WebSocket relay. Chosen with ?realm=local or ?realm=ws://host:port.
 */

export type PresenceMeta = {
  /** connection id, unique per open world session */
  cid: string;
  /** character id */
  ch: string;
  name: string;
  look: unknown;
  /** when this connection joined (ms); the earliest connection runs the world */
  j: number;
};

export type ChannelStatus = "connecting" | "connected" | "closed";

export interface Channel {
  send(payload: unknown): void;
  onMessage(fn: (payload: unknown) => void): void;
  onPresence(fn: (list: PresenceMeta[]) => void): void;
  onStatus(fn: (s: ChannelStatus) => void): void;
  track(meta: PresenceMeta): void;
  leave(): void;
}

export interface Backend {
  kind: "supabase" | "local" | "solo";
  rpc<T>(fn: string, args: Record<string, unknown>): Promise<T>;
  channel(topic: string, key: string): Channel;
}

export class RealmError extends Error {
  constructor(message: string, public code = "") {
    super(message);
  }
}

let cached: Promise<Backend | null> | null = null;

/** The backend this build talks to, or null when online play is not configured. */
export function getBackend(): Promise<Backend | null> {
  if (cached) return cached;
  cached = (async () => {
    // A development override, honoured only when the page itself is served from this machine:
    // a link must never be able to point a player's key at someone else's server.
    const dev = import.meta.env.DEV || /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
    let local: string | null = null;
    if (dev) {
      const q = new URLSearchParams(location.search).get("realm");
      local = q;
      try {
        if (q) localStorage.setItem("veyrmarch.realm", q);
        else local = localStorage.getItem("veyrmarch.realm");
      } catch {
        /* storage blocked */
      }
      if (local === "off" || local === "supabase") local = null;
      if (local && local !== "local" && !/^wss?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?\/?$/.test(local)) local = null;
    }
    if (local) {
      const url = local === "local" ? `ws://${location.hostname}:8787` : local;
      const { localBackend } = await import("./local");
      return localBackend(url);
    }
    const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
    // the publishable key (sb_publishable_…) is public by design; the legacy anon key also works
    const key = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY) as string | undefined;
    if (!url || !key) return null;
    const { supabaseBackend } = await import("./supabase");
    return supabaseBackend(url, key);
  })();
  // a failed download (offline for a moment) must not stick until the page reloads
  cached.catch(() => (cached = null));
  return cached;
}
