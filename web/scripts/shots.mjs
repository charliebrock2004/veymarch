// Fixed-view screenshots and render statistics, for comparing graphics changes.
//   node scripts/shots.mjs --url http://127.0.0.1:4173/ --out ./shots --tag before [--quality high] [--views village,forest]
// Needs Playwright with a Chromium (this repo's agent machines: /opt/node22/lib/node_modules/playwright).
// Software WebGL is slow (~2 fps) and its colours are close to, not identical to, a phone GPU.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const arg = (k, d) => {
  const i = process.argv.indexOf("--" + k);
  return i > 0 ? process.argv[i + 1] : d;
};
const url = arg("url", "http://127.0.0.1:4173/");
const out = arg("out", "./shots");
const tag = arg("tag", "now");
const quality = arg("quality", "high");
const only = arg("views", "");
const pw = await import(process.env.PLAYWRIGHT || "/opt/node22/lib/node_modules/playwright/index.mjs");
mkdirSync(out, { recursive: true });

// [name, x, z, yaw (0 = north, +z), hour, dungeon, camera pitch tweak]
const VIEWS = [
  ["village", 1.5, -16, 3.3, 10, false],
  ["street", -6, -2, 0.6, 15.5, false],
  ["smithy", 6, 2, 1.7, 11, false],
  ["creek", 3, 42, 0.2, 9, false],
  ["forest", -4, 72, 0.1, 13, false],
  ["deepforest", -30, 100, 0.8, 16, false],
  ["approach", 2, 138, 0, 17.5, false],
  ["bridge", 70, 0, 1.57, 18.6, false],
  ["gate", 99, 0, 1.57, 12, false],
  ["dusk", 0, -10, 2.6, 19.6, false],
  ["night", -2, -4, 2.2, 22.5, false],
  ["hall", 1200, 40, 0, 12, true],
  ["arena", 1200, 86, 0, 12, true],
  ["hero", 1.5, -20, Math.PI, 10, false],
];

const browser = await pw.chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--disable-background-timer-throttling", "--disable-renderer-backgrounding"] });
const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
await ctx.addInitScript((q) => {
  try {
    localStorage.setItem("veyrmarch.hint", "1");
    localStorage.setItem("veyrmarch.quality", q);
    localStorage.setItem("veyrmarch.muted", "1");
    localStorage.setItem("veyrmarch.realm", "off");
  } catch {}
}, quality);
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
const V = (fn, ...a) => page.evaluate(([f, a]) => window.__veyr[f](...a), [fn, a]);
const stats = {};
try {
  await page.goto(url);
  await page.waitForSelector(".vm-title", { timeout: 240000 });
  await page.screenshot({ path: join(out, `${tag}-title.png`), timeout: 180000 });
  await page.getByRole("button", { name: /^Single Player/ }).click();
  await page.getByRole("button", { name: "New Character" }).click();
  await page.waitForSelector(".vm-creator");
  await page.waitForTimeout(1500);
  await page.screenshot({ path: join(out, `${tag}-creator.png`), timeout: 180000 });
  await page.locator(".vm-creator input").fill("Shots");
  await page.getByRole("button", { name: "Wake in Hearthfen" }).click();
  await page.waitForFunction(() => window.__veyr?.state().mode === "play", null, { timeout: 120000 });
  await V("god", true);
  await page.addStyleTag({ content: ".vm-hud,.vm-touch,.vm-toast,.vm-region{opacity:0!important}" });
  for (const [name, x, z, yaw, hour, dungeon] of VIEWS) {
    if (only && !only.split(",").includes(name)) continue;
    await V("setHour", hour);
    await V("teleport", x, z, dungeon);
    await V("face", yaw);
    if (name === "hero") await V("face", 0);
    // let fog, exposure and the camera settle (slow software frames)
    const f0 = (await V("state")).frameN;
    await page.waitForFunction((f) => window.__veyr.state().frameN > f + 8, f0, { timeout: 120000 });
    if (name === "hero") await page.evaluate(() => window.__veyr.face(Math.PI));
    await page.waitForTimeout(400);
    await page.screenshot({ path: join(out, `${tag}-${name}.png`), timeout: 180000 });
    stats[name] = await V("perf");
  }
} catch (e) {
  errors.push("harness: " + e.message);
}
writeFileSync(join(out, `${tag}-stats.json`), JSON.stringify({ quality, stats, errors }, null, 2));
console.log(JSON.stringify({ quality, stats, errors }, null, 1));
await browser.close();
