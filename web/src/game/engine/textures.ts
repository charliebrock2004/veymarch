import * as THREE from "three";
import { rng, type Rand } from "./noise";

/**
 * Every texture is painted on a canvas at load. No downloads, no licences, and each one
 * stays inside the art bible's palette: bone stone, soot timber, moss, copper, wool, and
 * one nursery red that belongs to Cookie.
 */

type Paint = (g: CanvasRenderingContext2D, w: number, h: number, r: Rand) => void;

const cache = new Map<string, THREE.CanvasTexture>();

function make(key: string, w: number, h: number, paint: Paint, opts: { repeat?: boolean; color?: boolean; mips?: boolean } = {}) {
  const hit = cache.get(key);
  if (hit) return hit;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d")!;
  paint(g, w, h, rng(key.length * 7919 + key.charCodeAt(0) * 31));
  const t = new THREE.CanvasTexture(c);
  if (opts.color !== false) t.colorSpace = THREE.SRGBColorSpace;
  if (opts.repeat !== false) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  if (opts.mips === false) {
    t.generateMipmaps = false;
    t.minFilter = THREE.LinearFilter;
  }
  cache.set(key, t);
  return t;
}

const rgb = (r: number, g: number, b: number, a = 1) => `rgba(${r | 0},${g | 0},${b | 0},${a})`;

function speckle(g: CanvasRenderingContext2D, w: number, h: number, r: Rand, n: number, lo: number, hi: number, size: number, alpha = 1) {
  for (let i = 0; i < n; i++) {
    const v = lo + (hi - lo) * r();
    g.fillStyle = rgb(v, v, v, alpha);
    const s = size * (0.5 + r());
    g.fillRect(r() * w, r() * h, s, s * (0.6 + r() * 0.8));
  }
}

/** Near-white grain multiplied over terrain vertex colour. */
export const detailTex = () =>
  make("detail", 256, 256, (g, w, h, r) => {
    g.fillStyle = rgb(226, 226, 226);
    g.fillRect(0, 0, w, h);
    speckle(g, w, h, r, 2600, 170, 255, 3);
    for (let i = 0; i < 260; i++) {
      g.strokeStyle = rgb(160 + r() * 60, 170 + r() * 60, 140 + r() * 50, 0.55);
      g.lineWidth = 1;
      const x = r() * w;
      const y = r() * h;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + (r() - 0.5) * 6, y - 4 - r() * 6);
      g.stroke();
    }
  });

/** Lime plaster with dark timber framing; one tile is 4 m wide and 3 m tall. */
export const plasterTex = () =>
  make("plaster", 512, 384, (g, w, h, r) => {
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, "#ddd1bd");
    grad.addColorStop(0.75, "#d3c5ad");
    grad.addColorStop(1, "#a79a82");
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
    speckle(g, w, h, r, 1600, 150, 235, 3, 0.25);
    for (let i = 0; i < 30; i++) {
      g.fillStyle = rgb(120, 110, 90, 0.06);
      g.beginPath();
      g.ellipse(r() * w, r() * h, 20 + r() * 50, 10 + r() * 30, 0, 0, Math.PI * 2);
      g.fill();
    }
    const beam = (x0: number, y0: number, x1: number, y1: number, wd: number) => {
      g.strokeStyle = "#3c342c";
      g.lineWidth = wd;
      g.beginPath();
      g.moveTo(x0, y0);
      g.lineTo(x1, y1);
      g.stroke();
      g.strokeStyle = "rgba(255,240,220,0.08)";
      g.lineWidth = 2;
      g.stroke();
    };
    beam(0, 6, w, 6, 14);
    beam(0, h * 0.52, w, h * 0.52, 12);
    beam(0, h - 8, w, h - 8, 16);
    for (const x of [6, w / 3, (2 * w) / 3]) beam(x, 0, x, h, 13);
    beam(6, h * 0.52, w / 3, h - 8, 10);
    beam((2 * w) / 3, h * 0.52, w / 3 + 20, h - 8, 10);
    beam(w / 3, 6, (2 * w) / 3, h * 0.52, 9);
  });

/** Bone-stone blocks with mortar. */
export const stoneTex = (tint: "bone" | "grey" | "dark" = "bone") =>
  make("stone_" + tint, 512, 512, (g, w, h, r) => {
    const base = tint === "bone" ? [200, 190, 172] : tint === "grey" ? [150, 148, 140] : [92, 86, 80];
    g.fillStyle = rgb(base[0] * 0.55, base[1] * 0.55, base[2] * 0.55);
    g.fillRect(0, 0, w, h);
    const rows = 8;
    const rh = h / rows;
    for (let row = 0; row < rows; row++) {
      let x = row % 2 ? -30 : 0;
      while (x < w) {
        const bw = 50 + r() * 70;
        const v = 0.82 + r() * 0.3;
        g.fillStyle = rgb(base[0] * v, base[1] * v, base[2] * v * 0.98);
        const inset = 3;
        g.beginPath();
        g.roundRect(x + inset, row * rh + inset, bw - inset * 2, rh - inset * 2, 6);
        g.fill();
        g.fillStyle = rgb(255, 250, 240, 0.08);
        g.fillRect(x + inset, row * rh + inset, bw - inset * 2, 5);
        g.fillStyle = rgb(0, 0, 0, 0.12);
        g.fillRect(x + inset, row * rh + rh - inset - 6, bw - inset * 2, 6);
        x += bw;
      }
    }
    speckle(g, w, h, r, 3000, 60, 230, 2, 0.18);
    for (let i = 0; i < 18; i++) {
      g.fillStyle = rgb(80, 100, 60, 0.18);
      g.beginPath();
      g.ellipse(r() * w, h - r() * 90, 30 + r() * 60, 8 + r() * 18, 0, 0, Math.PI * 2);
      g.fill();
    }
  });

export const thatchTex = () =>
  make("thatch", 256, 256, (g, w, h, r) => {
    g.fillStyle = "#7a6440";
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2600; i++) {
      const x = r() * w;
      const y = r() * h;
      const v = 0.7 + r() * 0.5;
      g.strokeStyle = rgb(170 * v, 140 * v, 88 * v, 0.8);
      g.lineWidth = 1 + r();
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + (r() - 0.5) * 4, y + 10 + r() * 16);
      g.stroke();
    }
    for (let y = 0; y < h; y += 32) {
      g.fillStyle = "rgba(40,30,20,0.25)";
      g.fillRect(0, y + 28, w, 4);
    }
  });

export const shingleTex = () =>
  make("shingle", 256, 256, (g, w, h, r) => {
    g.fillStyle = "#2c2620";
    g.fillRect(0, 0, w, h);
    const rowH = 24;
    for (let row = 0; row * rowH < h; row++) {
      let x = row % 2 ? -14 : 0;
      while (x < w) {
        const sw = 22 + r() * 14;
        const v = 0.75 + r() * 0.45;
        g.fillStyle = rgb(74 * v, 64 * v, 54 * v);
        g.fillRect(x + 1, row * rowH, sw - 2, rowH - 2);
        g.fillStyle = "rgba(0,0,0,0.35)";
        g.fillRect(x + 1, row * rowH + rowH - 5, sw - 2, 3);
        if (r() < 0.25) {
          g.fillStyle = rgb(80, 96, 58, 0.5);
          g.fillRect(x + 2, row * rowH + 2, sw * 0.6, rowH * 0.5);
        }
        x += sw;
      }
    }
  });

export const planksTex = (tone: "dark" | "warm" = "warm") =>
  make("planks_" + tone, 256, 256, (g, w, h, r) => {
    const base = tone === "dark" ? [70, 58, 46] : [118, 92, 64];
    g.fillStyle = rgb(base[0] * 0.6, base[1] * 0.6, base[2] * 0.6);
    g.fillRect(0, 0, w, h);
    const n = 6;
    for (let i = 0; i < n; i++) {
      const v = 0.8 + r() * 0.35;
      g.fillStyle = rgb(base[0] * v, base[1] * v, base[2] * v);
      g.fillRect(i * (w / n) + 2, 0, w / n - 4, h);
      for (let k = 0; k < 14; k++) {
        g.strokeStyle = rgb(base[0] * 0.55, base[1] * 0.55, base[2] * 0.55, 0.5);
        g.lineWidth = 1;
        const x = i * (w / n) + 4 + r() * (w / n - 8);
        g.beginPath();
        g.moveTo(x, 0);
        g.bezierCurveTo(x + 3, h * 0.3, x - 3, h * 0.6, x + 2, h);
        g.stroke();
      }
      g.fillStyle = "#2a2420";
      g.beginPath();
      g.arc(i * (w / n) + w / n / 2, 14, 2.5, 0, Math.PI * 2);
      g.arc(i * (w / n) + w / n / 2, h - 14, 2.5, 0, Math.PI * 2);
      g.fill();
    }
  });

export const barkTex = (pale = false) =>
  make(pale ? "bark_pale" : "bark", 128, 256, (g, w, h, r) => {
    const base = pale ? [196, 188, 172] : [112, 96, 78];
    g.fillStyle = rgb(base[0], base[1], base[2]);
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 220; i++) {
      const v = 0.55 + r() * 0.7;
      g.strokeStyle = rgb(base[0] * v, base[1] * v, base[2] * v, 0.8);
      g.lineWidth = 1 + r() * 3;
      const x = r() * w;
      g.beginPath();
      g.moveTo(x, r() * h);
      g.lineTo(x + (r() - 0.5) * 6, r() * h);
      g.stroke();
    }
    if (pale)
      for (let i = 0; i < 40; i++) {
        g.fillStyle = "rgba(40,36,30,0.7)";
        g.fillRect(r() * w, r() * h, 6 + r() * 14, 2 + r() * 2);
      }
    for (let i = 0; i < 26; i++) {
      g.fillStyle = rgb(86, 104, 60, 0.35);
      g.beginPath();
      g.ellipse(r() * w, h * 0.7 + r() * h * 0.3, 8 + r() * 16, 6 + r() * 20, 0, 0, Math.PI * 2);
      g.fill();
    }
  });

/** A cluster of leaves on transparent ground, for alpha-tested foliage cards. */
export const leafTex = (kind: "oak" | "beech" | "pine" | "bush" = "oak") =>
  make("leaf_" + kind, 256, 256, (g, w, h, r) => {
    g.clearRect(0, 0, w, h);
    const palettes: Record<string, number[][]> = {
      oak: [[96, 120, 58], [124, 144, 68], [150, 160, 76], [82, 104, 50], [172, 168, 84]],
      beech: [[138, 156, 72], [164, 176, 84], [118, 138, 62], [188, 184, 96]],
      pine: [[62, 86, 58], [78, 104, 66], [52, 74, 52], [96, 116, 72]],
      bush: [[92, 116, 56], [114, 136, 64], [80, 98, 50], [140, 150, 74]],
    };
    const pal = palettes[kind];
    const cx = w / 2;
    const cy = h / 2;
    const count = kind === "pine" ? 420 : 300;
    for (let i = 0; i < count; i++) {
      const a = r() * Math.PI * 2;
      const rad = Math.sqrt(r()) * (w * 0.46);
      const x = cx + Math.cos(a) * rad;
      const y = cy + Math.sin(a) * rad;
      const c = pal[Math.floor(r() * pal.length)];
      const shade = 0.75 + (1 - (y / h)) * 0.4 + r() * 0.1;
      g.fillStyle = rgb(c[0] * shade, c[1] * shade, c[2] * shade);
      g.save();
      g.translate(x, y);
      g.rotate(a + (r() - 0.5));
      if (kind === "pine") {
        g.fillRect(-1, -9, 2.2, 18);
      } else {
        const s = kind === "beech" ? 8 : 9;
        g.beginPath();
        g.ellipse(0, 0, s * (0.6 + r() * 0.5), s * 0.42, 0, 0, Math.PI * 2);
        g.fill();
      }
      g.restore();
    }
  }, { repeat: false });

export const fernTex = () =>
  make("fern", 128, 256, (g, w, h, r) => {
    g.clearRect(0, 0, w, h);
    const cx = w / 2;
    g.strokeStyle = "#4b5a32";
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(cx, h);
    g.quadraticCurveTo(cx + 6, h / 2, cx - 4, 6);
    g.stroke();
    for (let i = 0; i < 26; i++) {
      const t = i / 26;
      const y = h - t * (h - 10);
      const x = cx + Math.sin(t * 2) * 4;
      const len = (1 - t) * 44 + 8;
      const v = 0.8 + r() * 0.4;
      g.fillStyle = rgb(84 * v, 108 * v, 52 * v);
      for (const side of [-1, 1]) {
        g.beginPath();
        g.moveTo(x, y);
        g.quadraticCurveTo(x + side * len * 0.6, y - 10, x + side * len, y - 4 - t * 6);
        g.quadraticCurveTo(x + side * len * 0.5, y + 2, x, y + 4);
        g.fill();
      }
    }
  }, { repeat: false });

export const wheatTex = () =>
  make("wheat", 128, 256, (g, w, h, r) => {
    g.clearRect(0, 0, w, h);
    for (let i = 0; i < 26; i++) {
      const x = 8 + r() * (w - 16);
      const top = 20 + r() * 60;
      const v = 0.8 + r() * 0.35;
      g.strokeStyle = rgb(170 * v, 146 * v, 80 * v);
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(x, h);
      g.quadraticCurveTo(x + (r() - 0.5) * 10, (top + h) / 2, x + (r() - 0.5) * 8, top);
      g.stroke();
      g.fillStyle = rgb(206 * v, 170 * v, 92 * v);
      g.beginPath();
      g.ellipse(x, top, 3.2, 12, (r() - 0.5) * 0.4, 0, Math.PI * 2);
      g.fill();
    }
  }, { repeat: false });

export const wallpaperTex = () =>
  make("wallpaper", 256, 256, (g, w, h, r) => {
    g.fillStyle = "#cdbca2";
    g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 64) {
      g.fillStyle = "rgba(142,47,47,0.55)";
      g.fillRect(x + 4, 0, 14, h);
      g.fillStyle = "rgba(184,115,51,0.45)";
      g.fillRect(x + 22, 0, 4, h);
    }
    for (let i = 0; i < 10; i++) {
      const x = 38 + (i % 4) * 64;
      const y = 30 + Math.floor(i / 4) * 90 + (i % 2) * 40;
      g.fillStyle = "rgba(60,52,44,0.35)";
      g.beginPath();
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2 - Math.PI / 2;
        g.lineTo(x + Math.cos(a) * 9, y + Math.sin(a) * 9);
        const b = a + Math.PI / 5;
        g.lineTo(x + Math.cos(b) * 4, y + Math.sin(b) * 4);
      }
      g.fill();
    }
    speckle(g, w, h, r, 900, 80, 200, 3, 0.2);
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, "rgba(40,30,20,0)");
    grad.addColorStop(1, "rgba(40,30,20,0.35)");
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 6; i++) {
      g.fillStyle = "rgba(30,24,18,0.25)";
      g.fillRect(r() * w, r() * h, 2 + r() * 3, 30 + r() * 80);
    }
  });

/** Painted nursery planking for the castle outside: cream and red, faded. */
export const nurseryPaintTex = () =>
  make("nurserypaint", 256, 256, (g, w, h, r) => {
    for (let i = 0; i < 8; i++) {
      g.fillStyle = i % 2 ? "#cbbba0" : "#8a3a33";
      g.fillRect(i * 32, 0, 32, h);
    }
    speckle(g, w, h, r, 2000, 60, 240, 3, 0.25);
    for (let i = 0; i < 50; i++) {
      g.fillStyle = "rgba(220,205,180,0.55)";
      g.fillRect(r() * w, r() * h, 4 + r() * 18, 2 + r() * 5);
    }
    for (let i = 0; i < 8; i++) {
      g.fillStyle = "rgba(0,0,0,0.5)";
      g.fillRect(i * 32, 0, 2, h);
    }
  });

export const flagstoneTex = () =>
  make("flagstone", 512, 512, (g, w, h, r) => {
    g.fillStyle = "#4a443d";
    g.fillRect(0, 0, w, h);
    const cells = 5;
    const s = w / cells;
    for (let i = 0; i < cells; i++)
      for (let j = 0; j < cells; j++) {
        const v = 0.75 + r() * 0.35;
        g.fillStyle = rgb(150 * v, 140 * v, 124 * v);
        g.beginPath();
        g.roundRect(i * s + 4 + r() * 4, j * s + 4 + r() * 4, s - 10 - r() * 6, s - 10 - r() * 6, 8);
        g.fill();
      }
    speckle(g, w, h, r, 4000, 50, 200, 2, 0.2);
  });

export const blockTex = (letter: string, color: string) =>
  make("block_" + letter + color, 128, 128, (g, w, h, r) => {
    g.fillStyle = color;
    g.fillRect(0, 0, w, h);
    g.strokeStyle = "#e4d7c3";
    g.lineWidth = 8;
    g.strokeRect(10, 10, w - 20, h - 20);
    g.fillStyle = "#e4d7c3";
    g.font = "bold 76px Georgia, serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(letter, w / 2, h / 2 + 4);
    speckle(g, w, h, r, 500, 40, 230, 3, 0.25);
  });

export const waterNormalTex = () =>
  make("waternormal", 256, 256, (g, w, h, r) => {
    const img = g.createImageData(w, h);
    const hgt = new Float32Array(w * h);
    for (let k = 0; k < 40; k++) {
      const fx = 1 + Math.floor(r() * 6);
      const fy = 1 + Math.floor(r() * 6);
      const ph = r() * Math.PI * 2;
      const amp = 1 / (fx + fy);
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) hgt[y * w + x] += Math.sin(((x * fx + y * fy) / w) * Math.PI * 2 + ph) * amp;
    }
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const l = hgt[y * w + ((x - 1 + w) % w)];
        const rr = hgt[y * w + ((x + 1) % w)];
        const u = hgt[((y - 1 + h) % h) * w + x];
        const d = hgt[((y + 1) % h) * w + x];
        let nx = (l - rr) * 2;
        let ny = (u - d) * 2;
        const len = Math.hypot(nx, ny, 1);
        nx /= len;
        ny /= len;
        const i = (y * w + x) * 4;
        img.data[i] = (nx * 0.5 + 0.5) * 255;
        img.data[i + 1] = (ny * 0.5 + 0.5) * 255;
        img.data[i + 2] = (1 / len) * 255;
        img.data[i + 3] = 255;
      }
    g.putImageData(img, 0, 0);
  }, { color: false });

export const glowTex = () =>
  make("glow", 64, 64, (g, w, h) => {
    const grad = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    grad.addColorStop(0, "rgba(255,255,255,1)");
    grad.addColorStop(0.25, "rgba(255,255,255,0.55)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
  }, { repeat: false });

/** Vertical fade for honey light shafts. */
export const shaftTex = () =>
  make("shaft", 64, 256, (g, w, h) => {
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, "rgba(255,255,255,0)");
    grad.addColorStop(0.2, "rgba(255,255,255,0.8)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
    const side = g.createLinearGradient(0, 0, w, 0);
    side.addColorStop(0, "rgba(0,0,0,1)");
    side.addColorStop(0.3, "rgba(0,0,0,0)");
    side.addColorStop(0.7, "rgba(0,0,0,0)");
    side.addColorStop(1, "rgba(0,0,0,1)");
    g.globalCompositeOperation = "destination-out";
    g.fillStyle = side;
    g.fillRect(0, 0, w, h);
  }, { repeat: false });

export const bannerTex = () =>
  make("banner", 128, 256, (g, w, h) => {
    g.fillStyle = "#2f3a4a";
    g.fillRect(0, 0, w, h);
    g.fillStyle = "#d7a441";
    g.beginPath();
    g.arc(w / 2, h * 0.4, 30, Math.PI, 0);
    g.fill();
    for (let i = 0; i < 9; i++) {
      const a = Math.PI + (i / 8) * Math.PI;
      g.fillRect(w / 2 + Math.cos(a) * 36 - 2, h * 0.4 + Math.sin(a) * 36 - 6, 4, 12);
    }
    g.fillRect(w / 2 - 34, h * 0.4 + 6, 68, 4);
    g.fillStyle = "#1c1916";
    g.beginPath();
    g.moveTo(0, h);
    g.lineTo(w / 2, h - 40);
    g.lineTo(w, h);
    g.fill();
  }, { repeat: false });

export const signTex = (mark: "anvil" | "bench" | "hive" | "bed" | "east" | "north" | "trade") =>
  make("sign_" + mark, 128, 64, (g, w, h, r) => {
    g.fillStyle = "#6e5436";
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 12; i++) {
      g.strokeStyle = "rgba(40,30,20,0.4)";
      g.beginPath();
      const y = r() * h;
      g.moveTo(0, y);
      g.lineTo(w, y + (r() - 0.5) * 6);
      g.stroke();
    }
    g.fillStyle = "#2a2018";
    g.strokeStyle = "#2a2018";
    g.lineWidth = 5;
    g.lineCap = "round";
    const cx = w / 2;
    const cy = h / 2;
    g.beginPath();
    if (mark === "anvil") {
      g.moveTo(cx - 26, cy - 8); g.lineTo(cx + 26, cy - 8); g.lineTo(cx + 14, cy + 2); g.lineTo(cx + 8, cy + 14);
      g.lineTo(cx - 8, cy + 14); g.lineTo(cx - 12, cy + 2); g.closePath(); g.fill();
    } else if (mark === "bench") {
      g.moveTo(cx - 28, cy - 4); g.lineTo(cx + 28, cy - 4); g.moveTo(cx - 20, cy - 4); g.lineTo(cx - 24, cy + 16);
      g.moveTo(cx + 20, cy - 4); g.lineTo(cx + 24, cy + 16); g.moveTo(cx - 6, cy - 14); g.lineTo(cx + 10, cy - 14); g.stroke();
    } else if (mark === "hive") {
      for (let i = 0; i < 4; i++) { g.moveTo(cx - 18 + i * 3, cy + 14 - i * 8); g.lineTo(cx + 18 - i * 3, cy + 14 - i * 8); }
      g.stroke();
    } else if (mark === "bed") {
      g.moveTo(cx - 26, cy + 10); g.lineTo(cx + 26, cy + 10); g.moveTo(cx - 26, cy - 10); g.lineTo(cx - 26, cy + 16);
      g.moveTo(cx - 16, cy); g.lineTo(cx + 22, cy); g.stroke();
    } else if (mark === "trade") {
      g.arc(cx - 12, cy, 10, 0, Math.PI * 2); g.moveTo(cx + 22, cy); g.arc(cx + 12, cy, 10, 0, Math.PI * 2); g.stroke();
    } else {
      const dx = mark === "east" ? 1 : 0;
      const dy = mark === "north" ? -1 : 0;
      g.moveTo(cx - dx * 24, cy - dy * 18); g.lineTo(cx + dx * 24, cy + dy * 18);
      g.moveTo(cx + dx * 24 + dy * 0, cy + dy * 18); g.lineTo(cx + dx * 12 - dy * 10, cy + dy * 6 - dx * 10);
      g.moveTo(cx + dx * 24, cy + dy * 18); g.lineTo(cx + dx * 12 + dy * 10, cy + dy * 6 + dx * 10);
      g.stroke();
    }
  }, { repeat: false });

/** Soft round sprite used by the particle shader. */
export const dotTex = () =>
  make("dot", 32, 32, (g, w, h) => {
    const grad = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    grad.addColorStop(0, "rgba(255,255,255,1)");
    grad.addColorStop(0.5, "rgba(255,255,255,0.6)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
  }, { repeat: false, color: false });
