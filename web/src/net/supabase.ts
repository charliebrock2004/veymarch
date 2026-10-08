import { createClient, type RealtimeChannel } from "@supabase/supabase-js";
import { RealmError, type Backend, type Channel, type ChannelStatus, type PresenceMeta } from "./backend";

/** How long a realm call may take before the player is told the realm is not answering. */
const CALL_MS = 20_000;

/** fetch with a deadline: a phone on a stalled network otherwise waits on a spinner forever. */
const timedFetch: typeof fetch = (input, init) => {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), CALL_MS);
  init?.signal?.addEventListener("abort", () => ctl.abort());
  return fetch(input, { ...init, signal: ctl.signal }).finally(() => clearTimeout(timer));
};

export function supabaseBackend(url: string, key: string): Backend {
  const sb = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: timedFetch },
    realtime: { params: { eventsPerSecond: 25 } },
  });
  return {
    kind: "supabase",
    async rpc<T>(fn: string, args: Record<string, unknown>) {
      const { data, error } = await sb.rpc(fn, args);
      if (error) throw new RealmError(error.message || "The realm did not answer", error.code ?? "");
      return data as T;
    },
    channel(topic: string, presenceKey: string): Channel {
      const msgFns: ((p: unknown) => void)[] = [];
      const presFns: ((l: PresenceMeta[]) => void)[] = [];
      const statusFns: ((s: ChannelStatus) => void)[] = [];
      let meta: PresenceMeta | null = null;
      let joined = false;
      let closed = false;
      let ch: RealtimeChannel;
      const status = (s: ChannelStatus) => {
        for (const f of statusFns) f(s);
      };
      // one channel object per connection attempt; a server-side close opens a fresh one
      const open = () => {
        const c = sb.channel(topic, { config: { broadcast: { self: false, ack: false }, presence: { key: presenceKey } } });
        ch = c;
        c.on("broadcast", { event: "m" }, (m) => {
          for (const f of msgFns) f(m.payload);
        });
        c.on("presence", { event: "sync" }, () => {
          const state = c.presenceState<PresenceMeta>();
          const list: PresenceMeta[] = [];
          for (const k of Object.keys(state)) {
            const metas = state[k];
            if (metas.length) list.push(metas[metas.length - 1] as unknown as PresenceMeta);
          }
          for (const f of presFns) f(list);
        });
        c.subscribe((s) => {
          if (closed || ch !== c) return;
          if (s === "SUBSCRIBED") {
            joined = true;
            status("connected");
            if (meta) void c.track(meta);
          } else if (s === "CHANNEL_ERROR" || s === "TIMED_OUT") {
            joined = false;
            status("connecting");
          } else if (s === "CLOSED") {
            joined = false;
            status("connecting");
            setTimeout(() => {
              if (closed || ch !== c) return;
              void sb.removeChannel(c);
              open();
            }, 1500);
          }
        });
      };
      open();
      status("connecting");
      return {
        send(payload) {
          if (!joined) return;
          void ch.send({ type: "broadcast", event: "m", payload });
        },
        onMessage: (f) => void msgFns.push(f),
        onPresence: (f) => void presFns.push(f),
        onStatus: (f) => void statusFns.push(f),
        track(m) {
          meta = m;
          if (joined) void ch.track(m);
        },
        leave() {
          closed = true;
          void ch.untrack().catch(() => {});
          void sb.removeChannel(ch);
        },
      };
    },
  };
}
