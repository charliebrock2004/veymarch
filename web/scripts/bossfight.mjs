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
  await V("setLevel", 12).catch(() => {});
  await V("loadZone", "kennel");
  await page.waitForTimeout(400);
  await V("teleport", 7000, 107, "kennel");
  await V("face", 0);
  for (let i = 0; i < 600; i++) { const b = await V("bossState", "boe"); if (b && b.st !== "idle" && b.st !== "intro" && b.st !== "wait" && b.st !== "sleep") break; await page.waitForTimeout(100); }
  const b0 = await V("bossState", "boe");
  console.log("start", JSON.stringify(b0));
  console.log("placed", await V("soloPlace"));
  let b = b0, last = 520;
  for (let i = 0; i < 1400 && b && b.hp > 0 && b.st !== "dying" && b.st !== "dead"; i++) {
    b = await V("bossState", "boe");
    await V("teleport", b.x, b.z - 1.6, "kennel");
    await V("aim", b.x, b.z);
    await V("swing", i % 4 === 3);
    await settle(3);
    if (i % 20 === 0 || b.hp < last - 60) { console.log(i, b.st, "phase", b.phase, Math.round(b.hp), "/", b.max); last = b.hp; }
  }
  await page.waitForTimeout(6000);
  console.log("end", JSON.stringify(await V("bossState", "boe")), JSON.stringify(await V("state")).slice(0, 300));
  await page.waitForTimeout(3000);
  await page.screenshot({ path: join(out, `${tag}-bosskill.png`), timeout: 180000 });
} catch (e) { errors.push("harness: " + e.message); }
console.log(JSON.stringify({ errors }));
await browser.close();
