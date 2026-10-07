import { Music, type ThemeId } from "./music";

/**
 * Synthesised sound. No files: every cue is built from oscillators and filtered noise,
 * which keeps the build small and starts instantly on a phone. iOS only allows audio
 * after a touch, so `unlock` is called from the Start button.
 */

const LULLABY = [
  // Caller Cookie, button and bow, count the toys and don't be slow.
  76, 79, 76, 72, 74, 76, 74, 71, 72, 74, 76, 79, 81, 79, 76, 74, 72, 71, 72, 74, 72, 67, 69, 71, 72,
];

const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

export class Audio {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfx!: GainNode;
  private amb!: GainNode;
  private mus!: GainNode;
  private noise!: AudioBuffer;
  private windGain!: GainNode;
  private waterGain!: GainNode;
  private nightGain!: GainNode;
  private boxGain!: GainNode;
  private boxStep = 0;
  private boxNext = 0;
  private boxRate = 1;
  private birdNext = 0;
  private forgeNext = 0;
  private music: Music | null = null;
  enabled = true;
  muted = false;

  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      const c = this.ctx;
      this.master = c.createGain();
      this.master.gain.value = this.muted ? 0 : 0.9;
      this.master.connect(c.destination);
      const comp = c.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 4;
      comp.connect(this.master);
      this.sfx = c.createGain();
      this.sfx.gain.value = 0.8;
      this.sfx.connect(comp);
      this.amb = c.createGain();
      this.amb.gain.value = 0.5;
      this.amb.connect(comp);
      this.mus = c.createGain();
      this.mus.gain.value = 0.32;
      this.mus.connect(comp);
      this.noise = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      this.windGain = this.loopNoise(this.amb, "lowpass", 380, 0.6);
      this.waterGain = this.loopNoise(this.amb, "bandpass", 1600, 0);
      this.nightGain = c.createGain();
      this.nightGain.gain.value = 0;
      this.nightGain.connect(this.amb);
      this.boxGain = c.createGain();
      this.boxGain.gain.value = 0;
      this.boxGain.connect(this.mus);
      this.music = new Music(c, this.mus, this.noise);
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.9, this.ctx.currentTime, 0.05);
  }

  private loopNoise(dest: AudioNode, type: BiquadFilterType, freq: number, gain: number) {
    const c = this.ctx!;
    const src = c.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = type === "bandpass" ? 0.6 : 0.7;
    const g = c.createGain();
    g.gain.value = gain;
    src.connect(f).connect(g).connect(dest);
    src.start();
    return g;
  }

  private env(g: GainNode, t: number, a: number, peak: number, dur: number) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  }

  tone(freq: number, dur: number, type: OscillatorType = "sine", vol = 0.2, opts: { to?: number; delay?: number; dest?: AudioNode; attack?: number } = {}) {
    const c = this.ctx;
    if (!c || !this.enabled) return;
    const t = c.currentTime + (opts.delay ?? 0);
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (opts.to) o.frequency.exponentialRampToValueAtTime(opts.to, t + dur);
    this.env(g, t, opts.attack ?? 0.005, vol, dur);
    o.connect(g).connect(opts.dest ?? this.sfx);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  hiss(dur: number, freq: number, vol: number, opts: { type?: BiquadFilterType; to?: number; delay?: number; q?: number; dest?: AudioNode } = {}) {
    const c = this.ctx;
    if (!c || !this.enabled) return;
    const t = c.currentTime + (opts.delay ?? 0);
    const src = c.createBufferSource();
    src.buffer = this.noise;
    src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = c.createBiquadFilter();
    f.type = opts.type ?? "bandpass";
    f.frequency.setValueAtTime(freq, t);
    if (opts.to) f.frequency.exponentialRampToValueAtTime(opts.to, t + dur);
    f.Q.value = opts.q ?? 1.2;
    const g = c.createGain();
    this.env(g, t, 0.004, vol, dur);
    src.connect(f).connect(g).connect(opts.dest ?? this.sfx);
    src.start(t, Math.random());
    src.stop(t + dur + 0.05);
  }

  // ------------------------------------------------------------ cues
  swing(heavy: boolean) {
    this.hiss(heavy ? 0.3 : 0.16, heavy ? 900 : 1600, heavy ? 0.35 : 0.25, { to: heavy ? 300 : 600, q: 2 });
  }
  hit(heavy: boolean, soft = false) {
    this.tone(heavy ? 90 : 140, 0.16, "triangle", 0.5, { to: 50 });
    this.hiss(0.09, soft ? 900 : 2400, soft ? 0.35 : 0.45, { type: soft ? "lowpass" : "bandpass" });
  }
  hurt() {
    this.tone(150, 0.22, "sawtooth", 0.18, { to: 70 });
    this.hiss(0.14, 700, 0.3, { type: "lowpass" });
  }
  block() {
    this.tone(320, 0.12, "square", 0.12, { to: 180 });
    this.hiss(0.08, 3000, 0.25);
  }
  parry() {
    this.tone(1200, 0.35, "triangle", 0.22, { to: 1500 });
    this.tone(1800, 0.25, "sine", 0.12, { delay: 0.02 });
  }
  dodge() {
    this.hiss(0.22, 500, 0.28, { to: 1400, type: "bandpass", q: 0.8 });
  }
  step(surface: "grass" | "dirt" | "stone" | "wood") {
    const f = surface === "stone" ? 2200 : surface === "wood" ? 900 : surface === "dirt" ? 1200 : 1800;
    this.hiss(0.06, f, surface === "grass" ? 0.06 : 0.09, { type: surface === "wood" ? "lowpass" : "bandpass", q: 1.5 });
    if (surface === "wood") this.tone(140, 0.06, "sine", 0.06);
  }
  gather(kind: string) {
    if (kind === "mat_wood") {
      this.tone(180, 0.1, "triangle", 0.3, { to: 120 });
      this.hiss(0.1, 1100, 0.3);
    } else if (kind === "mat_fibre") {
      this.hiss(0.18, 3200, 0.22, { to: 1800 });
    } else {
      this.tone(1400 + Math.random() * 300, 0.18, "square", 0.08, { to: 900 });
      this.tone(260, 0.12, "triangle", 0.25, { to: 160 });
      this.hiss(0.08, 4200, 0.3);
    }
  }
  pickup() {
    this.tone(660, 0.12, "triangle", 0.15);
    this.tone(990, 0.16, "triangle", 0.12, { delay: 0.07 });
  }
  craft() {
    for (let i = 0; i < 3; i++) this.tone(800 + i * 150, 0.15, "square", 0.06, { delay: i * 0.12 });
    this.tone(523, 0.4, "triangle", 0.15, { delay: 0.38 });
    this.tone(784, 0.5, "triangle", 0.12, { delay: 0.45 });
  }
  ui() {
    this.tone(880, 0.05, "triangle", 0.08);
  }
  ember() {
    this.hiss(0.5, 400, 0.4, { to: 2400, type: "bandpass", q: 0.7 });
    this.tone(220, 0.4, "sawtooth", 0.08, { to: 440 });
  }
  burn() {
    this.hiss(0.35, 1800, 0.3, { to: 600 });
  }
  growl() {
    this.tone(85, 0.5, "sawtooth", 0.12, { to: 70, attack: 0.08 });
    this.hiss(0.5, 300, 0.15, { type: "lowpass" });
  }
  yelp() {
    this.tone(900, 0.18, "triangle", 0.15, { to: 500 });
  }
  shriek() {
    this.tone(700, 0.25, "sawtooth", 0.08, { to: 1100 });
  }
  wind() {
    this.tone(1800, 0.06, "square", 0.04);
    this.tone(2100, 0.06, "square", 0.04, { delay: 0.08 });
    this.tone(1900, 0.06, "square", 0.04, { delay: 0.16 });
  }
  clack() {
    this.tone(500 + Math.random() * 200, 0.07, "square", 0.08, { to: 300 });
  }
  squeak() {
    this.tone(1100, 0.15, "sine", 0.18, { to: 1600 });
  }
  bell(vol = 0.25, base = 392) {
    for (const [m, v] of [[1, 1], [2.76, 0.4], [5.4, 0.2], [0.5, 0.5]] as const) this.tone(base * m, 2.4, "sine", vol * v, { attack: 0.002 });
  }
  thud() {
    this.tone(60, 0.6, "sine", 0.6, { to: 35 });
    this.hiss(0.4, 300, 0.4, { type: "lowpass" });
  }
  charge() {
    this.tone(300, 0.6, "sawtooth", 0.07, { to: 1200, attack: 0.3 });
  }
  beam() {
    this.tone(1400, 0.5, "square", 0.06, { to: 1300 });
    this.hiss(0.5, 5000, 0.12);
  }
  death() {
    this.tone(220, 1.2, "triangle", 0.2, { to: 55 });
  }
  reward() {
    const notes = [62, 66, 69, 74, 78, 81];
    notes.forEach((n, i) => this.tone(midi(n), 0.9, "triangle", 0.14, { delay: i * 0.11 }));
    this.bell(0.2, midi(74));
  }
  gate() {
    this.bell(0.3, 196);
    this.bell(0.22, 247);
    for (let i = 0; i < 6; i++) this.tone(midi(62 + i * 5), 2.5, "sine", 0.05, { delay: 0.4 + i * 0.25, attack: 0.3 });
  }
  quest() {
    this.tone(midi(69), 0.25, "triangle", 0.12);
    this.tone(midi(74), 0.4, "triangle", 0.12, { delay: 0.12 });
  }

  /** Music box: the rhyme on a bell-like pluck. `rate` < 1 winds it down. */
  private boxNote(n: number) {
    const c = this.ctx!;
    const t = c.currentTime;
    for (const [m, v] of [[1, 1], [4.1, 0.25], [2, 0.3]] as const) {
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = "sine";
      o.frequency.value = midi(n) * m * this.boxRate;
      this.env(g, t, 0.002, 0.22 * v, 1.2);
      o.connect(g).connect(this.boxGain);
      o.start(t);
      o.stop(t + 1.3);
    }
  }

  /** the theme playing now (for tests and the debug overlay) */
  get theme(): ThemeId {
    return this.music?.playing ?? "none";
  }

  /**
   * Per-frame ambience: wind, water, birds by day, crickets by night, the smith's hammer
   * near the forge, Cookie's music box near the castle, and the music for the place or fight.
   */
  tick(o: { day: number; forest: number; water: number; forge: number; box: number; boxRate: number; indoor: boolean; theme: ThemeId; intensity: number }) {
    const c = this.ctx;
    if (!c) return;
    const t = c.currentTime;
    this.windGain.gain.setTargetAtTime(o.indoor ? 0.05 : 0.25 + o.forest * 0.25, t, 0.5);
    this.waterGain.gain.setTargetAtTime(o.water * 0.35, t, 0.3);
    this.boxGain.gain.setTargetAtTime(o.box, t, 0.4);
    this.boxRate = o.boxRate;
    if (!o.indoor && o.day > 0.4 && t > this.birdNext) {
      this.birdNext = t + 0.8 + Math.random() * (o.forest > 0.5 ? 2 : 4);
      const base = 2200 + Math.random() * 1800;
      const n = 2 + Math.floor(Math.random() * 4);
      for (let i = 0; i < n; i++) this.tone(base * (1 + Math.random() * 0.2), 0.08, "sine", 0.025, { to: base * (0.8 + Math.random() * 0.5), delay: i * 0.11, dest: this.amb });
    }
    if (!o.indoor && o.day < 0.3 && t > this.birdNext) {
      this.birdNext = t + 0.3 + Math.random() * 0.6;
      for (let i = 0; i < 3; i++) this.tone(4300, 0.03, "square", 0.008, { delay: i * 0.05, dest: this.amb });
    }
    if (o.forge > 0.02 && t > this.forgeNext) {
      this.forgeNext = t + 0.62 + Math.random() * 0.1;
      this.tone(1250, 0.25, "square", 0.05 * o.forge, { to: 1150, dest: this.amb });
      this.tone(2900, 0.2, "sine", 0.06 * o.forge, { dest: this.amb });
    }
    if (o.box > 0.01 && t > this.boxNext) {
      this.boxNext = t + 0.42 / Math.max(0.2, this.boxRate);
      this.boxNote(LULLABY[this.boxStep % LULLABY.length]);
      this.boxStep++;
    }
    this.music?.tick(o.theme, o.intensity, this.enabled);
  }
}
