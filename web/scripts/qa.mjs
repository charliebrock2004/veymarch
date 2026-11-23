import { readFileSync } from "node:fs";
// Combat, bounty claim and reload persistence check
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
  const R = {};
  const src = readFileSync(new URL("../src/game/data/explore.ts", import.meta.url), "utf8");
  const defs = Object.fromEntries([...src.matchAll(/id: "(b_\w+)".*?kinds: \[([^\]]*)\], n: (\d+)/g)].map((m) => [m[1], { kind: m[2].split(",")[0].trim().replace(/"/g, ""), n: +m[3] }]));
  // real combat: walk up to a wolf and swing until it drops
  await V("god", true);
  const wolf = (await V("zoneMobs", "over")).find((m) => m.k === "wolf" && m.alive);
  R.wolf0 = wolf;
  await V("teleport", wolf.x, wolf.z - 1.3, "over");
  let w = wolf;
  for (let i = 0; i < 60 && w?.alive; i++) {
    w = (await V("zoneMobs", "over")).find((m) => m.key === wolf.key);
    if (!w?.alive) break;
    await V("teleport", w.x, w.z - 1.2, "over");
    await V("face", 0);
    await V("swing", i % 3 === 2);
    await settle(3);
    if (i === 2) await page.screenshot({ path: join(out, `${tag}-fight.png`), timeout: 180000 });
  }
  R.wolf1 = w;
  const st = await V("state");
  R.afterKill = { level: st.level, xp: st.xp, kills: st.kills };
  // dodge
  const p0 = await V("state");
  await page.keyboard.down("KeyW"); await page.keyboard.press("Space"); await settle(6); await page.keyboard.up("KeyW");
  const p1 = await V("state");
  R.dodge = { moved: Math.hypot(p1.x - p0.x, p1.z - p0.z).toFixed(2), action: p1.action };
  // talents and a bounty carried through to a claim
  R.soloXp = await V("soloXp", 6);
  const b0 = await V("bounties");
  const d = defs[b0.ids[0]];
  for (let i = 0; i < d.n; i++) await V("noteKill", d.kind);
  await page.keyboard.press("KeyJ").catch(() => {});
  if ((await V("state")).mode !== "journal") await page.locator(".vm-hud button").first().click().catch(() => {});
  await page.waitForTimeout(800);
  await page.getByRole("button", { name: /^Talents/ }).click();
  await page.getByRole("button", { name: /Hardy/ }).click();
  await page.getByRole("button", { name: /^Bounties/ }).click();
  await page.waitForTimeout(500);
  const claim = page.getByRole("button", { name: "Claim" });
  R.claimable = await claim.count();
  if (R.claimable) await claim.first().click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: join(out, `${tag}-claimed.png`), timeout: 180000 });
  R.bounties = await V("bounties");
  R.talents = await V("talents");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(1500);
  // reload: the character, its talents and the board come back
  await page.reload();
  await page.waitForSelector(".vm-title", { timeout: 240000 });
  await page.getByRole("button", { name: /^Single Player/ }).click();
  await page.waitForTimeout(1500);
  R.menu = await page.locator("button").allInnerTexts();
  for (let i = 0; i < 40; i++) {
    if (await page.evaluate(() => window.__veyr?.state().mode === "play")) break;
    for (const n of [/Shots/, /^Continue/, /^Play/, /^Enter/]) { const b = page.getByRole("button", { name: n }).first(); if (await b.isVisible().catch(() => false)) { await b.click({ timeout: 60000 }).catch(() => {}); break; } }
    await page.waitForTimeout(1500);
  }
  await page.waitForFunction(() => window.__veyr?.state().mode === "play", null, { timeout: 120000 });
  await settle(4);
  R.reTalents = await V("talents");
  R.savedTal = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("veyrmarch.codex.")).map((k) => JSON.parse(localStorage.getItem(k)).tal));
  R.reBounties = await V("bounties");
  const s2 = await V("state");
  R.reState = { hp: s2.hp, x: s2.x, z: s2.z };
  await page.screenshot({ path: join(out, `${tag}-reloaded.png`), timeout: 180000 });
  console.log(JSON.stringify(R, null, 1));
} catch (e) { errors.push("harness: " + e.message); }
console.log(JSON.stringify({ errors }));
await browser.close();
