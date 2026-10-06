import { RealmError, type Backend, type Channel, type ChannelStatus, type PresenceMeta } from "./backend";

/** Talks to server/dev-server.mjs: HTTP for calls, one WebSocket per channel for live play. */
export function localBackend(wsUrl: string): Backend {
  const httpUrl = wsUrl.replace(/^ws/, "http");
  return {
    kind: "local",
    async rpc<T>(fn: string, args: Record<string, unknown>) {
      let res: Response;
      try {
        res = await fetch(`${httpUrl}/rpc/${fn}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(args) });
      } catch {
        throw new RealmError("The local realm server is not running");
      }
      const body = (await res.json().catch(() => ({}))) as { data?: T; error?: string };
      if (!res.ok || body.error) throw new RealmError(body.error || "The realm did not answer");
      return body.data as T;
    },
    channel(topic: string, key: string): Channel {
      const msgFns: ((p: unknown) => void)[] = [];
      const presFns: ((l: PresenceMeta[]) => void)[] = [];
      const statusFns: ((s: ChannelStatus) => void)[] = [];
      let meta: PresenceMeta | null = null;
      let ws: WebSocket | null = null;
      let closed = false;
      let retry = 0;
      const status = (s: ChannelStatus) => statusFns.forEach((f) => f(s));
      const open = () => {
        if (closed) return;
        status("connecting");
        const sock = new WebSocket(wsUrl);
        ws = sock;
        sock.onopen = () => {
          retry = 0;
          sock.send(JSON.stringify({ t: "join", topic, key }));
          if (meta) sock.send(JSON.stringify({ t: "track", meta }));
          status("connected");
        };
        sock.onmessage = (e) => {
          let m: { t: string; payload?: unknown; list?: PresenceMeta[] };
          try {
            m = JSON.parse(String(e.data));
          } catch {
            return;
          }
          if (m.t === "m") msgFns.forEach((f) => f(m.payload));
          else if (m.t === "presence") presFns.forEach((f) => f(m.list ?? []));
        };
        sock.onclose = () => {
          if (ws === sock) ws = null;
          if (closed) return status("closed");
          status("connecting");
          setTimeout(open, Math.min(4000, 400 * 2 ** retry++));
        };
      };
      open();
      return {
        send(payload) {
          if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ t: "send", payload }));
        },
        onMessage: (f) => void msgFns.push(f),
        onPresence: (f) => void presFns.push(f),
        onStatus: (f) => void statusFns.push(f),
        track(m) {
          meta = m;
          if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ t: "track", meta: m }));
        },
        leave() {
          closed = true;
          ws?.close();
        },
      };
    },
  };
}
