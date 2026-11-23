// Boss fight check: reach Boe in single player and fight him to the end
// based on the zone tour: node scripts/tour.mjs --url http://127.0.0.1:4173/ --out ~/shots --tag a [--views name,name] [--w 1280 --h 720]
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
const arg = (k, d) => { const i = process.argv.indexOf("--" + k); return i > 0 ? process.argv[i + 1] : d; };
const url = arg("url", "http://127.0.0.1:4173/"), out = arg("out", "./shots"), tag = arg("tag", "now"), only = arg("views", "");
const W = +arg("w", 1280), H = +arg("h", 720), quality = arg("quality", "high");
const pw = await import(process.env.PLAYWRIGHT || "/home/ubuntu/repos/chalkline-v4/node_modules/playwright/index.mjs");
mkdirSync(out, { recursive: true });
// [name, zone, local x, z, yaw, hour]
const VIEWS = [
  ["village", "over", 1.5, -16, 3.3, 10], ["forest", "over", -4, 72, 0.1, 13], ["creek", "over", 3, 42, 0.2, 9], ["night", "over", -2, -4, 2.2, 22.5],
  ["castle", "castle", 0, 40, 0, 12], ["kingdom", "kingdom", 0, 0, 0.5, 15], ["kingdom2", "kingdom", 20, -40, 2.5, 18.5],
  ["hunt", "hunt", 0, 0, 0.3, 11], ["kennel", "kennel", 0, 30, 0, 12], ["mire", "mire", 0, 0, 0.4, 14], ["keep", "keep", 0, 40, 0, 12],
  ["waste", "waste", 0, 0, 0.3, 13], ["citadel", "citadel", 0, 40, 0, 12],
];
const OX = { over: 0, castle: 1200, kingdom: 3000, hunt: 5000, kennel: 7000, mire: 9000, keep: 11000, waste: 13000, citadel: 15000 };
const browser = await pw.chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--disable-background-timer-throttling", "--disable-renderer-backgrounding"] });
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
await ctx.addInitScript((q) => { try { localStorage.setItem("veyrmarch.hint", "1"); localStorage.setItem("veyrmarch.quality", q); localStorage.setItem("veyrmarch.muted", "1"); localStorage.setItem("veyrmarch.realm", "off"); } catch {} }, quality);
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
const V = (fn, ...a) => page.evaluate(([f, a]) => window.__veyr[f](...a), [fn, a]);
const settle = async (n = 8) => { const f0 = (await V("state")).frameN; await page.waitForFunction((f) => window.__veyr.state().frameN > f, f0 + n, { timeout: 180000 }); };
const stats = {};
try {
  await page.goto(url);
  await page.waitForSelector(".vm-title", { timeout: 240000 });
  await page.screenshot({ path: join(out, `${tag}-title.png`), timeout: 180000 });
  await page.getByRole("button", { name: /^Single Player/ }).click();
  await page.getByRole("button", { name: "New Character" }).click();
  await page.waitForSelector(".vm-creator");
  await page.locator(".vm-creator input").fill("Shots");
  await page.getByRole("button", { name: /^(Create|Wake in Hearthfen)$/ }).click();
  for (let i = 0; i < 40; i++) {
    if (await page.evaluate(() => window.__veyr?.state().mode === "play")) break;
    for (const n of [/^Continue/, /New World/, /^Create$/]) { const b = page.getByRole("button", { name: n }).first(); if (await b.isVisible().catch(() => false)) { await b.click({ timeout: 60000 }).catch(() => {}); break; } }
    await page.waitForTimeout(1500);
  }
  await page.waitForFunction(() => window.__veyr?.state().mode === "play", null, { timeout: 120000 });
  await settle(4);
  await page.screenshot({ path: join(out, `${tag}-hud.png`), timeout: 180000 });
  await V("god", true);
  // the cold open ends once you leave the road; wait to wake in bed before testing
  await V("teleport", 0, 40, "over");
  for (let i = 0; i < 300; i++) { const s = await V("state"); if (s.hp > 50 && s.mode === "play" && Math.abs(s.z - 40) > 5) break; await page.waitForTimeout(200); }
  await settle(10);
  const wolf = (await V("zoneMobs", "over")).find((m) => m.k === "wolf" && m.alive);
  await V("teleport", wolf.x - 4, wolf.z - 4, "over");
  await V("aim", wolf.x, wolf.z);
  await settle(4);
  console.log("mode", (await V("state")).mode, JSON.stringify(wolf), JSON.stringify(await V("state")).slice(0,120));
  console.log("cands", await V("lockList"));
  await V("press", "lock");
  await settle(6);
  const l1 = await V("lock");
  console.log("locked", JSON.stringify(l1), "btn", await page.locator(".vm-lock.is-on").count());
  await page.keyboard.down("KeyD"); await settle(25); await page.keyboard.up("KeyD");
  const l2 = await V("lock"), st = await V("state");
  const want = Math.atan2(l2.at.x - st.x, l2.at.z - st.z);
  console.log("strafe: cam off by", (Math.atan2(Math.sin(want - l2.camYaw), Math.cos(want - l2.camYaw))).toFixed(2), "body off by", (Math.atan2(Math.sin(want - l2.yaw), Math.cos(want - l2.yaw))).toFixed(2));
  await page.screenshot({ path: join(out, `${tag}-lock.png`), timeout: 180000 });
  for (let i = 0; i < 80; i++) {
    const l = await V("lock"); if (!l.at) break;
    await V("teleport", l.at.x, l.at.z - 1.2, "over");
    await V("swing", false); await settle(3);
  }
  console.log("after kill", JSON.stringify((await V("lock")).at), "btn", await page.locator(".vm-lock.is-on").count());
  await page.keyboard.press("KeyT"); await settle(3);
  await page.keyboard.press("KeyT"); await settle(3);
  console.log("toggle twice", JSON.stringify((await V("lock")).at));
  console.log("end", JSON.stringify(await V("bossState", "boe")), JSON.stringify(await V("state")).slice(0, 300));
  await page.waitForTimeout(3000);
  await page.screenshot({ path: join(out, `${tag}-bosskill.png`), timeout: 180000 });
} catch (e) { errors.push("harness: " + e.message); }
console.log(JSON.stringify({ errors }));
await browser.close();
