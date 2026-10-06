// A local realm for development and tests: the realm SQL in PGlite behind POST /rpc/<fn>, and a
// WebSocket relay that mimics Realtime broadcast + presence. Open the game with ?realm=local.
//   node server/dev-server.mjs [--port 8787] [--data ./.realm-data]
import { createServer } from "node:http";
import { WebSocketServer } from "ws";
import { openDb } from "./db.mjs";

const arg = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : fallback;
};
const port = Number(arg("--port", process.env.PORT || 8787));
const db = await openDb(arg("--data", undefined));

const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "content-type", "access-control-allow-methods": "POST, OPTIONS" };

const server = createServer((req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, cors);
    return res.end();
  }
  // test helper (local server only): put an item in a character's bag
  if (req.method === "POST" && req.url === "/dev/give") {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", async () => {
      try {
        const { char, def, n = 1, equip = false } = JSON.parse(body);
        await db.pg.query("select vm_add_item($1::uuid, $2, $3)", [char, def, n]);
        if (equip) await db.pg.query("select vm_equip_def($1::uuid, $2)", [char, def]);
        res.writeHead(200, { ...cors, "content-type": "application/json" });
        res.end("{}");
      } catch (e) {
        res.writeHead(400, cors);
        res.end(String(e?.message ?? e));
      }
    });
    return;
  }
  const m = /^\/rpc\/([a-z_]+)$/.exec(req.url || "");
  if (req.method !== "POST" || !m) {
    res.writeHead(404, cors);
    return res.end();
  }
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", async () => {
    let args = {};
    try {
      args = body ? JSON.parse(body) : {};
    } catch {
      res.writeHead(400, { ...cors, "content-type": "application/json" });
      return res.end(JSON.stringify({ error: "bad json" }));
    }
    try {
      const data = await db.rpc(m[1], args);
      res.writeHead(200, { ...cors, "content-type": "application/json" });
      res.end(JSON.stringify({ data }));
    } catch (e) {
      res.writeHead(400, { ...cors, "content-type": "application/json" });
      res.end(JSON.stringify({ error: String(e?.message ?? e) }));
    }
  });
});

/** topic -> Set<socket>; socket.meta is its presence */
const topics = new Map();
let sent = 0;
const wss = new WebSocketServer({ server });
const presence = (topic) => {
  const set = topics.get(topic);
  if (!set) return;
  const list = [...set].filter((s) => s.meta).map((s) => s.meta);
  const msg = JSON.stringify({ t: "presence", list });
  for (const s of set) s.send(msg);
};
wss.on("connection", (ws) => {
  ws.on("message", (raw) => {
    let m;
    try {
      m = JSON.parse(String(raw));
    } catch {
      return;
    }
    if (m.t === "join" && typeof m.topic === "string") {
      ws.topic = m.topic;
      if (!topics.has(m.topic)) topics.set(m.topic, new Set());
      topics.get(m.topic).add(ws);
      presence(m.topic);
    } else if (m.t === "track" && ws.topic) {
      ws.meta = m.meta;
      presence(ws.topic);
    } else if (m.t === "send" && ws.topic) {
      const msg = JSON.stringify({ t: "m", payload: m.payload });
      for (const s of topics.get(ws.topic) ?? []) if (s !== ws && s.readyState === 1) {
        s.send(msg);
        sent++;
      }
    }
  });
  ws.on("close", () => {
    const set = ws.topic && topics.get(ws.topic);
    if (set) {
      set.delete(ws);
      presence(ws.topic);
    }
  });
});

setInterval(() => {
  if (process.env.REALM_STATS && sent) console.log(`relay: ${(sent / 10).toFixed(1)} deliveries/s`);
  sent = 0;
}, 10000).unref();

server.listen(port, () => console.log(`VEYRMARCH local realm on http://localhost:${port} (open the game with ?realm=local)`));
