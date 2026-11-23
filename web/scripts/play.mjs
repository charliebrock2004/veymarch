// Gameplay check (talents, finds, bounties, combat)
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
  const R = {};
  // finds: every one in the loaded outdoor zones has a spot; open one cache and read one stone
  for (const z of ["kingdom", "hunt", "mire", "waste"]) await V("loadZone", z);
  await page.waitForTimeout(500);
  const finds = await V("finds");
  R.findsPlaced = finds.filter((f) => f.at).length + "/" + finds.length; console.log(R.findsPlaced, JSON.stringify(await V("state")).slice(0, 300));
  for (const id of ["c_over_mill", "s_over_first", "c_king_west"]) {
    const f = (await V("finds")).find((x) => x.id === id);
    await V("teleport", f.at.x + 1.2, f.at.z + 1.2, f.zone);
    await V("face", Math.PI * 1.25, 0.3);
    await settle(6);
    await page.screenshot({ path: join(out, `${tag}-find-${id}.png`), timeout: 180000 });
    await V("interact");
    await settle(4);
  }
  await page.screenshot({ path: join(out, `${tag}-find-open.png`), timeout: 180000 });
  R.findsGot = (await V("finds")).filter((f) => f.got).map((f) => f.id);
  // talents
  await V("setLevel", 6);
  R.before = await V("talents");
  await page.keyboard.press("KeyJ").catch(() => {});
  if ((await V("state")).mode !== "journal") await page.locator(".vm-hud button").first().click().catch(() => {});
  await page.waitForTimeout(800);
  R.mode = (await V("state")).mode;
  await page.getByRole("button", { name: /^Talents/ }).click();
  await page.getByRole("button", { name: /Hardy/ }).click();
  await page.getByRole("button", { name: /Fleet/ }).click();
  await page.getByRole("button", { name: /Keen Edge/ }).click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: join(out, `${tag}-talents.png`), timeout: 180000 });
  R.after = await V("talents");
  for (const k of ["wolf", "wolf", "wolf", "wolf", "wolf", "goblin", "goblin", "goblin", "goblin", "goblin", "goblin", "redcap", "redcap"]) await V("noteKill", k);
  await page.getByRole("button", { name: /^Bounties/ }).click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: join(out, `${tag}-bounties.png`), timeout: 180000 });
  const claim = page.getByRole("button", { name: "Claim" });
  R.claimable = await claim.count();
  if (R.claimable) await claim.first().click();
  R.bounties = await V("bounties");
  await page.keyboard.press("Escape");
  // combat: find wolves and swing at them
  await V("teleport", -4, 72, "over");
  await settle(4);
  R.mobs = (await V("zoneMobs", "over"))?.slice?.(0, 3);
  console.log(JSON.stringify(R));
} catch (e) { errors.push("harness: " + e.message); }
console.log(JSON.stringify({ errors }));
await browser.close();
