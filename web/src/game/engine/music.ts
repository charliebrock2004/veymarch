/**
 * Music: one theme per place and per boss, written as small step sequences and played on
 * synthesised instruments (no files, like the rest of the sound). A theme is a chord loop, a
 * bass line, an arpeggio, a bank of two-bar melodies it picks from, drums and drones. Layers
 * marked `fight` come in with combat intensity. Themes crossfade; a place theme waits a moment
 * before it takes over so walking along a boundary does not flip the music back and forth.
 */

const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

type Inst = "pluck" | "flute" | "pad" | "bass" | "horn" | "bell" | "choir" | "fiddle" | "celesta" | "lowbell";

type ThemeDef = {
  bpm: number;
  /** eighth notes per bar */
  steps: number;
  /** one chord per bar (midi, root first) */
  chords: number[][];
  /** the melody's scale (midi, ascending; phrase digits index it) */
  scale: number[];
  vol: number;
  pad?: { inst: "pad" | "choir"; vol: number; oct?: number; fight?: boolean };
  bass?: { at: number[]; vol: number; oct?: number; len?: number; fight?: boolean };
  /** chord-tone index per step (3 = root an octave up), -1 rests */
  arp?: { pat: number[]; vol: number; inst: Inst; oct?: number; fight?: boolean; every?: number };
  /** two-bar phrases from the bank; chance per pair of bars */
  mel?: { phrases: string[]; vol: number; inst: Inst; chance: number; oct?: number; fight?: boolean };
  /** a pattern of two bars: k kick, s snare, t tom, h hat, f frame drum, . rest */
  drums?: { pat: string; vol: number; fight?: boolean }[];
  drone?: { notes: number[]; vol: number };
  toll?: { every: number; notes: number[]; vol: number; inst?: "bell" | "lowbell" };
};

/** Two bars of eighths: digits (and numbers) index the scale, "." holds, "-" rests. */
const P = {
  rise: "4 . . 3 4 . 5 . 4 . 2 . 0 . . .",
  climb: "0 . 2 . 4 . . . 5 4 3 . 2 . . .",
  fall: "7 . . 6 5 . 4 . 2 . 3 . 4 . . .",
  ask: "4 . 4 5 7 . 5 . 4 . . . - - - -",
  turn: "2 3 4 . 2 . 0 . 1 . 2 . 0 . . .",
  high: "7 . 5 . 4 . 5 . 7 . 9 . 7 . . .",
  slow: "4 . . . . . 2 . 0 . . . . . . .",
  call: "0 . . . 4 . . . 7 . . . . . . .",
  answer: "7 . . . 4 . . . 0 . . . . . . .",
  dance: "0 2 4 2 0 2 4 5 7 5 4 2 4 . . .",
  jig: "4 5 7 5 4 2 0 2 4 . 2 . 0 . . .",
  reel: "0 1 2 4 2 1 0 - 4 5 7 5 4 . . .",
  lament: "5 . . 4 3 . . . 2 . . 1 0 . . .",
  wisp: "9 . . . . . . . 11 . . . . . . .",
};

const tri = (r: number, q: "M" | "m" | "d" | "a" | "5" = "M") => [r, r + (q === "M" || q === "a" ? 4 : 3), r + (q === "d" ? 6 : q === "a" ? 8 : 7)];
const power = (r: number) => [r, r + 7, r + 12];
const scale = (root: number, steps: number[]) => {
  const out: number[] = [];
  for (let o = 0; o < 2; o++) for (const s of steps) out.push(root + o * 12 + s);
  return out;
};
const DORIAN = [0, 2, 3, 5, 7, 9, 10];
const MIXO = [0, 2, 4, 5, 7, 9, 10];
const AEOL = [0, 2, 3, 5, 7, 8, 10];
const IONIAN = [0, 2, 4, 5, 7, 9, 11];
const HARM = [0, 2, 3, 5, 7, 8, 11];
const PHRYG = [0, 1, 3, 5, 7, 8, 10];

export const THEMES = {
  title: {
    bpm: 72, steps: 8, vol: 1,
    chords: [tri(50, "m"), tri(48), tri(43), tri(50, "m")],
    scale: scale(62, DORIAN),
    pad: { inst: "pad", vol: 0.05 },
    bass: { at: [0], vol: 0.12, len: 8 },
    arp: { pat: [0, 1, 2, 3, 2, 1, 0, -1], vol: 0.06, inst: "pluck" },
    mel: { phrases: [P.rise, P.climb, P.fall, P.slow, P.lament], vol: 0.07, inst: "flute", chance: 0.75 },
  },
  hearthfen: {
    bpm: 86, steps: 8, vol: 0.9,
    chords: [tri(50), tri(48), tri(43), tri(50)],
    scale: scale(62, MIXO),
    pad: { inst: "pad", vol: 0.035 },
    bass: { at: [0, 5], vol: 0.1, len: 3 },
    arp: { pat: [0, 2, 1, 3, 0, 2, 1, 2], vol: 0.055, inst: "pluck" },
    mel: { phrases: [P.rise, P.climb, P.turn, P.ask, P.high], vol: 0.06, inst: "flute", chance: 0.55 },
    drums: [{ pat: "f...h...f.f.h...", vol: 0.05, fight: true }],
  },
  forest: {
    bpm: 64, steps: 8, vol: 0.85,
    chords: [tri(52, "m"), tri(48), tri(55), tri(50)],
    scale: scale(64, AEOL),
    pad: { inst: "pad", vol: 0.04 },
    mel: { phrases: [P.slow, P.lament, P.fall], vol: 0.055, inst: "flute", chance: 0.35 },
    drone: { notes: [40, 47], vol: 0.025 },
    drums: [{ pat: "t.......t.t.....", vol: 0.08, fight: true }],
    bass: { at: [0, 3, 6], vol: 0.1, len: 2, fight: true },
  },
  castle: {
    bpm: 60, steps: 8, vol: 0.7,
    chords: [tri(48), tri(48), tri(53), tri(55)],
    scale: scale(72, IONIAN),
    drone: { notes: [36, 43], vol: 0.03 },
    toll: { every: 4, notes: [48, 43], vol: 0.07, inst: "lowbell" },
    drums: [{ pat: "k.......k...k...", vol: 0.12, fight: true }],
  },
  kingdom: {
    bpm: 90, steps: 8, vol: 0.9,
    chords: [tri(55), tri(48), tri(52, "m"), tri(50)],
    scale: scale(55, IONIAN),
    pad: { inst: "pad", vol: 0.035 },
    bass: { at: [0, 4], vol: 0.1, len: 4 },
    arp: { pat: [0, -1, 1, -1, 2, -1, 1, -1], vol: 0.05, inst: "pluck", oct: 12 },
    mel: { phrases: [P.call, P.answer, P.climb, P.high], vol: 0.06, inst: "horn", chance: 0.5 },
    drums: [{ pat: "f...h...f.f.h...", vol: 0.045 }, { pat: "k...s...k.k.s...", vol: 0.1, fight: true }],
  },
  town: {
    bpm: 104, steps: 8, vol: 0.85,
    chords: [tri(53), tri(46), tri(48), tri(53)],
    scale: scale(65, IONIAN),
    pad: { inst: "pad", vol: 0.025 },
    bass: { at: [0, 3, 4, 6], vol: 0.09, len: 1 },
    arp: { pat: [0, 1, 2, 1, 3, 1, 2, 1], vol: 0.045, inst: "pluck" },
    mel: { phrases: [P.dance, P.jig, P.turn, P.ask], vol: 0.055, inst: "flute", chance: 0.7 },
    drums: [{ pat: "f.h.f.h.f.hhf.h.", vol: 0.04 }],
  },
  hunt: {
    bpm: 62, steps: 8, vol: 0.85,
    chords: [tri(45, "m"), tri(41), tri(50, "m"), tri(52)],
    scale: scale(57, AEOL),
    pad: { inst: "pad", vol: 0.035, oct: -12 },
    drone: { notes: [33, 40], vol: 0.03 },
    mel: { phrases: [P.call, P.answer, P.slow], vol: 0.06, inst: "horn", chance: 0.4 },
    drums: [{ pat: "t...t...t.t.t...", vol: 0.09, fight: true }],
    bass: { at: [0, 2, 4, 6], vol: 0.1, len: 1, fight: true },
  },
  kennel: {
    bpm: 84, steps: 8, vol: 0.8,
    chords: [tri(48, "m"), tri(49), tri(48, "m"), tri(46, "m")],
    scale: scale(60, PHRYG),
    bass: { at: [0, 2, 3, 5, 6], vol: 0.1, len: 1 },
    drone: { notes: [36], vol: 0.03 },
    drums: [{ pat: "h..h..h.h..h..hh", vol: 0.03 }, { pat: "k..sk.s.k..sk.ss", vol: 0.12, fight: true }],
    arp: { pat: [3, 3, 3, 3, 3, 3, 3, 3], vol: 0.03, inst: "fiddle", oct: 12, fight: true },
  },
  mire: {
    bpm: 52, steps: 8, vol: 0.85,
    chords: [tri(46, "a"), tri(48, "a"), tri(46, "a"), tri(44, "a")],
    scale: scale(58, [0, 2, 4, 6, 8, 10, 12]),
    pad: { inst: "pad", vol: 0.03 },
    drone: { notes: [34, 41], vol: 0.035 },
    toll: { every: 2, notes: [58, 56, 61, 54], vol: 0.06, inst: "lowbell" },
    mel: { phrases: [P.wisp, P.slow], vol: 0.03, inst: "celesta", chance: 0.4 },
    drums: [{ pat: "t.....t.t.......", vol: 0.08, fight: true }],
  },
  keep: {
    bpm: 58, steps: 8, vol: 0.9,
    chords: [tri(50, "m"), tri(46), tri(43, "m"), tri(45)],
    scale: scale(62, HARM),
    pad: { inst: "choir", vol: 0.05 },
    drone: { notes: [38], vol: 0.03 },
    toll: { every: 4, notes: [38], vol: 0.09, inst: "lowbell" },
    drums: [{ pat: "t...............", vol: 0.1 }, { pat: "k..tk.t.k..tk.t.", vol: 0.12, fight: true }],
    mel: { phrases: [P.lament, P.slow], vol: 0.05, inst: "horn", chance: 0.3, oct: -12 },
  },
  cookie: {
    // Cookie's own music box carries the tune; this is the march under it
    bpm: 128, steps: 8, vol: 0.9,
    chords: [power(36), power(36), power(43), power(36)],
    scale: scale(60, IONIAN),
    bass: { at: [0, 2, 4, 6], vol: 0.12, len: 1 },
    drums: [{ pat: "k.h.s.h.k.k.s.h.", vol: 0.12 }, { pat: "....t.......t.t.", vol: 0.1, fight: true }],
  },
  boe: {
    bpm: 126, steps: 8, vol: 0.95,
    chords: [tri(43, "m"), tri(51), tri(46), tri(50)],
    scale: scale(67, AEOL),
    bass: { at: [0, 3, 4, 6], vol: 0.12, len: 1 },
    arp: { pat: [0, -1, 2, -1, 1, -1, 2, 3], vol: 0.04, inst: "pluck", oct: 12 },
    mel: { phrases: [P.reel, P.jig, P.dance], vol: 0.05, inst: "fiddle", chance: 0.8 },
    drums: [{ pat: "k.hsk.hsk.hsk.hs", vol: 0.1 }, { pat: "t..t..t.t..t..tt", vol: 0.09, fight: true }],
    pad: { inst: "pad", vol: 0.03, fight: true },
  },
  finlay: {
    bpm: 108, steps: 8, vol: 1,
    chords: [tri(50, "m"), tri(46), tri(48), tri(45)],
    scale: scale(50, HARM),
    pad: { inst: "choir", vol: 0.045 },
    bass: { at: [0, 3, 6], vol: 0.13, len: 2 },
    arp: { pat: [0, -1, -1, 0, -1, 0, -1, -1], vol: 0.06, inst: "horn" },
    mel: { phrases: [P.call, P.answer, P.lament, P.fall], vol: 0.06, inst: "horn", chance: 0.6, oct: 12 },
    drums: [{ pat: "k..tk.t.k..tk.ss", vol: 0.13 }, { pat: "t.t.t.t.t.t.tttt", vol: 0.08, fight: true }],
  },
  /** Finlay's finger rite: everything drops to a drone and a heartbeat */
  rite: {
    bpm: 66, steps: 8, vol: 1,
    chords: [tri(38, "m")],
    scale: scale(62, HARM),
    drone: { notes: [26, 33, 38.3], vol: 0.04 },
    drums: [{ pat: "k.k.............", vol: 0.16 }],
  },
  ending: {
    bpm: 66, steps: 8, vol: 1,
    chords: [tri(50), tri(47, "m"), tri(43), tri(45)],
    scale: scale(62, IONIAN),
    pad: { inst: "pad", vol: 0.05 },
    bass: { at: [0], vol: 0.11, len: 8 },
    arp: { pat: [0, 1, 2, 3, 2, 1, 2, 1], vol: 0.05, inst: "pluck" },
    mel: { phrases: [P.rise, P.climb, P.fall, P.high, P.lament], vol: 0.07, inst: "flute", chance: 0.9 },
  },
} satisfies Record<string, ThemeDef>;

export type ThemeId = keyof typeof THEMES | "none";

const BOSS_THEMES = new Set<ThemeId>(["cookie", "boe", "finlay", "rite"]);

class Playing {
  readonly gain: GainNode;
  step = 0;
  next: number;
  /** the melody waiting to be played: scale index, -1 rest, -2 hold */
  mel: number[] = [];
  drones: OscillatorNode[] = [];
  /** set when fading out: stop after this time */
  until = Infinity;
  constructor(readonly id: Exclude<ThemeId, "none">, readonly def: ThemeDef, ctx: AudioContext, dest: AudioNode) {
    this.gain = ctx.createGain();
    this.gain.gain.value = 0.0001;
    this.gain.connect(dest);
    this.next = ctx.currentTime + 0.1;
  }
}

export class Music {
  private cur: Playing | null = null;
  private fading: Playing[] = [];
  private want: ThemeId = "none";
  private wantSince = 0;
  private intensity = 0;

  constructor(private ctx: AudioContext, private bus: AudioNode, private noise: AudioBuffer) {}

  get playing(): ThemeId {
    return this.cur?.id ?? "none";
  }

  /** Called every frame: which theme the moment wants, and how hard the fighting is (0..1). */
  tick(id: ThemeId, intensity: number, enabled: boolean) {
    const now = this.ctx.currentTime;
    this.intensity += (Math.max(0, Math.min(1, intensity)) - this.intensity) * Math.min(1, 0.05);
    if (id !== this.want) {
      this.want = id;
      this.wantSince = now;
    }
    const settle = BOSS_THEMES.has(id) || id === "ending" || id === "title" || !this.cur ? 0 : 1.6;
    if (id !== this.playing && now - this.wantSince >= settle) this.switchTo(id);
    for (const p of [...this.fading, ...(this.cur ? [this.cur] : [])]) {
      // a hidden tab stops frames: start again from now rather than catching up
      if (p.next < now - 0.2) p.next = now + 0.05;
      while (p.next < now + 0.25) {
        if (enabled) this.playStep(p, p.next);
        p.next += 60 / p.def.bpm / 2;
        p.step++;
      }
    }
    for (let i = this.fading.length - 1; i >= 0; i--) {
      const p = this.fading[i];
      if (now < p.until) continue;
      for (const o of p.drones) o.stop();
      p.gain.disconnect();
      this.fading.splice(i, 1);
    }
  }

  private switchTo(id: ThemeId) {
    const now = this.ctx.currentTime;
    if (this.cur) {
      const old = this.cur;
      old.gain.gain.cancelScheduledValues(now);
      old.gain.gain.setTargetAtTime(0.0001, now, BOSS_THEMES.has(id) ? 0.25 : 0.9);
      old.until = now + 5;
      this.fading.push(old);
      this.cur = null;
    }
    if (id === "none") return;
    const def: ThemeDef = THEMES[id];
    const p = new Playing(id, def, this.ctx, this.bus);
    p.gain.gain.setTargetAtTime(def.vol, now, BOSS_THEMES.has(id) ? 0.3 : 1.2);
    for (const n of def.drone?.notes ?? []) p.drones.push(this.drone(midi(n), def.drone!.vol, p.gain));
    this.cur = p;
  }

  private playStep(p: Playing, t: number) {
    const d = p.def;
    const stepDur = 60 / d.bpm / 2;
    const bar = Math.floor(p.step / d.steps);
    const s = p.step % d.steps;
    const chord = d.chords[bar % d.chords.length];
    const k = this.intensity;
    const lv = (vol: number, fight?: boolean) => (fight ? vol * k : vol);
    if (d.pad && s === 0) {
      const v = lv(d.pad.vol, d.pad.fight);
      if (v > 0.002) for (const n of chord) this.note(d.pad.inst, midi(n + 12 + (d.pad.oct ?? 0)), stepDur * d.steps * 1.1, v, t, p.gain);
    }
    if (d.bass && d.bass.at.includes(s)) {
      const v = lv(d.bass.vol, d.bass.fight);
      if (v > 0.002) this.note("bass", midi(chord[0] - 12 + (d.bass.oct ?? 0)), stepDur * (d.bass.len ?? 1) * 0.95, v, t, p.gain);
    }
    if (d.arp) {
      const idx = d.arp.pat[s % d.arp.pat.length];
      const v = lv(d.arp.vol, d.arp.fight);
      if (idx >= 0 && v > 0.002) this.note(d.arp.inst, midi(chord[idx % 3] + 12 * Math.floor(idx / 3) + 12 + (d.arp.oct ?? 0)), stepDur * 1.6, v, t, p.gain);
    }
    if (d.mel) {
      if (s === 0 && bar % 2 === 0 && p.mel.length === 0 && Math.random() < d.mel.chance) {
        const ph = d.mel.phrases[Math.floor(Math.random() * d.mel.phrases.length)];
        p.mel = ph.split(/\s+/).map((tok) => (tok === "." ? -2 : tok === "-" ? -1 : Number(tok)));
      }
      const tok = p.mel.shift();
      if (tok !== undefined && tok >= 0) {
        let len = 1;
        while (p.mel[len - 1] === -2) len++;
        const v = lv(d.mel.vol, d.mel.fight);
        const n = d.scale[Math.min(d.scale.length - 1, tok)];
        if (v > 0.002) this.note(d.mel.inst, midi(n + (d.mel.oct ?? 0)), stepDur * len * 0.98, v, t, p.gain);
      }
    }
    for (const dr of d.drums ?? []) {
      const c = dr.pat[p.step % dr.pat.length];
      const v = lv(dr.vol, dr.fight);
      if (c !== "." && v > 0.002) this.drum(c, v, t, p.gain);
    }
    if (d.toll && s === 0 && bar % d.toll.every === 0) {
      const n = d.toll.notes[Math.floor(bar / d.toll.every) % d.toll.notes.length];
      this.note(d.toll.inst ?? "bell", midi(n + 12), 3.5, d.toll.vol, t, p.gain);
    }
  }

  // ---------------------------------------------------------------- instruments

  private env(g: AudioParam, t: number, a: number, peak: number, hold: number, rel: number) {
    g.setValueAtTime(0.0001, t);
    g.exponentialRampToValueAtTime(peak, t + a);
    if (hold > a) g.setValueAtTime(peak, t + hold);
    g.exponentialRampToValueAtTime(0.0001, t + Math.max(a, hold) + rel);
  }

  private osc(type: OscillatorType, f: number, t: number, end: number, dest: AudioNode, detune = 0) {
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    o.detune.value = detune;
    o.connect(dest);
    o.start(t);
    o.stop(end + 0.05);
    return o;
  }

  private vibrato(o: OscillatorNode, t: number, end: number, rate: number, cents: number) {
    const l = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    l.frequency.value = rate;
    g.gain.value = cents;
    l.connect(g).connect(o.detune);
    l.start(t);
    l.stop(end + 0.05);
  }

  private note(inst: Inst, f: number, dur: number, vol: number, t: number, dest: AudioNode) {
    const c = this.ctx;
    const g = c.createGain();
    g.connect(dest);
    switch (inst) {
      case "pluck": {
        this.env(g.gain, t, 0.004, vol, 0, Math.min(1.2, dur + 0.5));
        const lp = c.createBiquadFilter();
        lp.type = "lowpass";
        lp.frequency.setValueAtTime(3200, t);
        lp.frequency.exponentialRampToValueAtTime(900, t + 0.4);
        lp.connect(g);
        const end = t + dur + 0.6;
        this.osc("triangle", f, t, end, lp);
        this.osc("sawtooth", f, t, end, lp, 4);
        break;
      }
      case "flute": {
        this.env(g.gain, t, 0.07, vol, dur * 0.85, 0.25);
        const o = this.osc("sine", f, t, t + dur + 0.3, g);
        this.vibrato(o, t, t + dur + 0.3, 5.2, 9);
        break;
      }
      case "pad":
      case "choir": {
        const a = inst === "choir" ? 0.9 : 1.2;
        this.env(g.gain, t, a, vol, dur * 0.7, dur * 0.5);
        const lp = c.createBiquadFilter();
        lp.type = "lowpass";
        lp.frequency.value = inst === "choir" ? 1300 : 800;
        lp.Q.value = inst === "choir" ? 2 : 0.7;
        lp.connect(g);
        const end = t + dur * 1.25;
        const o1 = this.osc("sawtooth", f, t, end, lp, -7);
        this.osc("sawtooth", f, t, end, lp, 7);
        if (inst === "choir") this.vibrato(o1, t, end, 4.6, 12);
        break;
      }
      case "bass": {
        this.env(g.gain, t, 0.01, vol, dur * 0.6, 0.18);
        this.osc("triangle", f, t, t + dur + 0.2, g);
        this.osc("sine", f / 2, t, t + dur + 0.2, g);
        break;
      }
      case "horn": {
        this.env(g.gain, t, 0.14, vol, dur * 0.8, 0.3);
        const lp = c.createBiquadFilter();
        lp.type = "lowpass";
        lp.frequency.setValueAtTime(400, t);
        lp.frequency.linearRampToValueAtTime(1100, t + 0.2);
        lp.connect(g);
        this.osc("sawtooth", f, t, t + dur + 0.35, lp);
        this.osc("square", f / 2, t, t + dur + 0.35, lp, 3);
        break;
      }
      case "fiddle": {
        this.env(g.gain, t, 0.03, vol, dur * 0.8, 0.12);
        const bp = c.createBiquadFilter();
        bp.type = "bandpass";
        bp.frequency.value = Math.min(4000, f * 2.5);
        bp.Q.value = 0.9;
        bp.connect(g);
        const o = this.osc("sawtooth", f, t, t + dur + 0.2, bp);
        this.vibrato(o, t, t + dur + 0.2, 6, 14);
        break;
      }
      case "bell":
      case "lowbell":
      case "celesta": {
        const lowpass = inst === "lowbell";
        const out = lowpass ? c.createBiquadFilter() : g;
        if (lowpass) {
          const lp = out as BiquadFilterNode;
          lp.type = "lowpass";
          lp.frequency.value = 900;
          lp.connect(g);
        }
        this.env(g.gain, t, 0.003, vol, 0, inst === "celesta" ? 1.4 : dur);
        const parts: [number, number][] = inst === "celesta" ? [[1, 1], [4, 0.2]] : [[1, 1], [2.76, 0.35], [5.4, 0.15], [0.5, 0.45]];
        for (const [m, v] of parts) {
          const pg = c.createGain();
          pg.gain.value = v;
          pg.connect(out);
          this.osc("sine", f * m, t, t + dur + 0.1, pg);
        }
        break;
      }
    }
  }

  private noiseHit(t: number, dur: number, type: BiquadFilterType, freq: number, vol: number, dest: AudioNode) {
    const c = this.ctx;
    const src = c.createBufferSource();
    src.buffer = this.noise;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    const g = c.createGain();
    this.env(g.gain, t, 0.002, vol, 0, dur);
    src.connect(f).connect(g).connect(dest);
    src.start(t, Math.random());
    src.stop(t + dur + 0.05);
  }

  private drum(kind: string, vol: number, t: number, dest: AudioNode) {
    const c = this.ctx;
    const thump = (f0: number, f1: number, dur: number, v: number) => {
      const g = c.createGain();
      g.connect(dest);
      this.env(g.gain, t, 0.003, v, 0, dur);
      const o = this.osc("sine", f0, t, t + dur, g);
      o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    };
    switch (kind) {
      case "k":
        thump(130, 42, 0.32, vol * 2.2);
        break;
      case "t":
        thump(150, 80, 0.4, vol * 1.6);
        this.noiseHit(t, 0.1, "lowpass", 700, vol * 0.5, dest);
        break;
      case "s":
        this.noiseHit(t, 0.14, "bandpass", 1900, vol * 1.4, dest);
        thump(210, 160, 0.09, vol * 0.6);
        break;
      case "h":
        this.noiseHit(t, 0.04, "highpass", 7000, vol * 0.7, dest);
        break;
      case "f":
        thump(95, 70, 0.22, vol * 1.3);
        this.noiseHit(t, 0.08, "lowpass", 500, vol * 0.6, dest);
        break;
    }
  }

  private drone(f: number, vol: number, dest: AudioNode) {
    const c = this.ctx;
    const g = c.createGain();
    g.gain.value = vol;
    const lp = c.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 420;
    lp.connect(g).connect(dest);
    const o = c.createOscillator();
    o.type = "sawtooth";
    o.frequency.value = f;
    o.connect(lp);
    const l = c.createOscillator();
    const lg = c.createGain();
    l.frequency.value = 0.13;
    lg.gain.value = 6;
    l.connect(lg).connect(o.detune);
    o.start();
    l.start();
    // stopping the drone stops its wobble too
    o.addEventListener("ended", () => l.stop());
    return o;
  }
}
