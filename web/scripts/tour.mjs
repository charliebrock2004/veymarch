// Zone tour screenshots: node scripts/tour.mjs --url http://127.0.0.1:4173/ --out ~/shots --tag a [--views name,name] [--w 1280 --h 720]
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
  await page.getByRole("button", { name: /^Single Player/ }).click({ timeout: 240000 });
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
  if (arg("nohud", "1") === "1") await page.addStyleTag({ content: ".vm-toast,.vm-region,.vm-hint{opacity:0!important}" });
  for (const [name, zone, x, z, yaw, hour] of VIEWS) {
    if (only && !only.split(",").includes(name)) continue;
    await V("setHour", hour);
    await V("loadZone", zone);
    await page.waitForTimeout(300);
    await V("teleport", OX[zone] + x, z, zone);
    await V("face", yaw);
    await settle(10);
    await page.screenshot({ path: join(out, `${tag}-${name}.png`), timeout: 180000 });
    stats[name] = { ...(await V("perf")), ...(await V("lights")) };
    if (process.argv.includes("--heavy")) stats[name].heavy = await V("heavy", 10);
  }
} catch (e) { errors.push("harness: " + e.message); }
writeFileSync(join(out, `${tag}-stats.json`), JSON.stringify({ stats, errors }, null, 1));
console.log(JSON.stringify({ stats, errors }));
await browser.close();
