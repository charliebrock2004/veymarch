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
  private rainGain!: GainNode;
  private leafGain!: GainNode;
  private moanGain!: GainNode;
  private wet!: GainNode;
  private farNext = 0;
  private dripNext = 0;
  private thunderNext = 0;
  private gust = 0;
  private vol = { music: 0.7, sfx: 0.8 };
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
      // the mix bus: glue compression, then a little weight below and air above
      const low = c.createBiquadFilter();
      low.type = "lowshelf";
      low.frequency.value = 110;
      low.gain.value = 3;
      const air = c.createBiquadFilter();
      air.type = "highshelf";
      air.frequency.value = 6500;
      air.gain.value = 2.5;
      const comp = c.createDynamicsCompressor();
      comp.threshold.value = -16;
      comp.knee.value = 12;
      comp.ratio.value = 3.5;
      comp.attack.value = 0.006;
      comp.release.value = 0.22;
      comp.connect(low).connect(air).connect(this.master);
      // one shared room: a generated impulse, darker and longer in the tail
      const verb = c.createConvolver();
      verb.buffer = this.impulse(2.8);
      this.wet = c.createGain();
      this.wet.gain.value = 0.2;
      const pre = c.createDelay(0.1);
      pre.delayTime.value = 0.022;
      pre.connect(verb).connect(this.wet).connect(comp);
      const send = (from: GainNode, amt: number) => {
        const g = c.createGain();
        g.gain.value = amt;
        from.connect(g).connect(pre);
      };
      this.sfx = c.createGain();
      this.sfx.gain.value = this.vol.sfx;
      this.sfx.connect(comp);
      send(this.sfx, 0.55);
      this.amb = c.createGain();
      this.amb.gain.value = 0.5;
      this.amb.connect(comp);
      send(this.amb, 0.35);
      this.mus = c.createGain();
      this.mus.gain.value = 0.46 * this.vol.music;
      this.mus.connect(comp);
      send(this.mus, 0.8);
      this.noise = c.createBuffer(1, c.sampleRate * 4, c.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      this.rainGain = this.loopNoise(this.amb, "highpass", 2600, 0);
      this.leafGain = this.loopNoise(this.amb, "bandpass", 5200, 0);
      this.moanGain = this.loopNoise(this.amb, "bandpass", 210, 0, 9);
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

  /** Sound and music levels, 0..1 each. */
  setVolume(kind: "music" | "sfx", v: number) {
    this.vol[kind] = Math.max(0, Math.min(1, v));
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    if (kind === "music") this.mus.gain.setTargetAtTime(0.46 * this.vol.music, t, 0.05);
    else {
      this.sfx.gain.setTargetAtTime(this.vol.sfx, t, 0.05);
      this.amb.gain.setTargetAtTime(0.62 * this.vol.sfx, t, 0.05);
    }
  }
  get volume() {
    return this.vol;
  }

  /** A stereo room impulse: decaying noise with early taps, the top end dying first. */
  private impulse(secs: number) {
    const c = this.ctx!;
    const n = Math.floor(c.sampleRate * secs);
    const buf = c.createBuffer(2, n, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      let lp = 0;
      for (let i = 0; i < n; i++) {
        const k = i / n;
        const cut = 0.55 - k * 0.45;
        lp += (Math.random() * 2 - 1 - lp) * cut;
        d[i] = lp * Math.pow(1 - k, 2.6) * 1.6;
      }
      for (const [ms, a] of [[11, 0.5], [19, 0.38], [31, 0.3], [47, 0.22], [71, 0.16]] as const) {
        const i = Math.floor((ms + ch * 3.7) * 0.001 * c.sampleRate);
        d[i] += a * (ch ? -1 : 1);
      }
    }
    return buf;
  }

  private out(g: GainNode, dest: AudioNode, pan?: number) {
    const c = this.ctx!;
    if (pan && c.createStereoPanner) {
      const p = c.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, pan));
      g.connect(p).connect(dest);
    } else g.connect(dest);
  }

  private loopNoise(dest: AudioNode, type: BiquadFilterType, freq: number, gain: number, q?: number) {
    const c = this.ctx!;
    const src = c.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q ?? (type === "bandpass" ? 0.6 : 0.7);
    const g = c.createGain();
    g.gain.value = gain;
    src.connect(f).connect(g).connect(dest);
    src.start(0, Math.random() * 3);
    return g;
  }

  private env(g: GainNode, t: number, a: number, peak: number, dur: number) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  }

  tone(freq: number, dur: number, type: OscillatorType = "sine", vol = 0.2, opts: { to?: number; delay?: number; dest?: AudioNode; attack?: number; pan?: number; detune?: number } = {}) {
    const c = this.ctx;
    if (!c || !this.enabled) return;
    const t = c.currentTime + (opts.delay ?? 0);
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (opts.to) o.frequency.exponentialRampToValueAtTime(opts.to, t + dur);
    if (opts.detune) o.detune.value = opts.detune;
    this.env(g, t, opts.attack ?? 0.005, vol, dur);
    o.connect(g);
    this.out(g, opts.dest ?? this.sfx, opts.pan);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  hiss(dur: number, freq: number, vol: number, opts: { type?: BiquadFilterType; to?: number; delay?: number; q?: number; dest?: AudioNode; pan?: number } = {}) {
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
    src.connect(f).connect(g);
    this.out(g, opts.dest ?? this.sfx, opts.pan);
    src.start(t, Math.random() * 3);
    src.stop(t + dur + 0.05);
  }

  // ------------------------------------------------------------ cues
  /** struck metal: a few inharmonic partials that ring out */
  private ring(base: number, dur: number, vol: number, delay = 0) {
    for (const [m, v] of [[1, 1], [2.32, 0.6], [3.87, 0.4], [5.19, 0.25], [6.71, 0.15]] as const)
      this.tone(base * m * (0.99 + Math.random() * 0.02), dur * (1 - m * 0.08), "sine", vol * v, { delay, attack: 0.002, pan: (Math.random() - 0.5) * 0.5 });
  }
  swing(heavy: boolean) {
    const pan = (Math.random() - 0.5) * 0.4;
    this.hiss(heavy ? 0.34 : 0.18, heavy ? 700 : 1300, heavy ? 0.4 : 0.28, { to: heavy ? 2600 : 3400, q: 2.4, pan: -pan });
    this.hiss(heavy ? 0.3 : 0.15, heavy ? 2200 : 3800, heavy ? 0.22 : 0.16, { to: heavy ? 500 : 900, q: 1.2, delay: heavy ? 0.08 : 0.04, pan });
    if (heavy) this.tone(120, 0.3, "sine", 0.18, { to: 60 });
  }
  hit(heavy: boolean, soft = false) {
    const r = 0.92 + Math.random() * 0.16;
    this.tone((heavy ? 95 : 150) * r, heavy ? 0.26 : 0.17, "sine", heavy ? 0.75 : 0.55, { to: 42 });
    this.tone((heavy ? 190 : 260) * r, 0.09, "triangle", 0.32, { to: 80 });
    this.hiss(0.05, soft ? 1400 : 3400, 0.5, { type: "bandpass", q: 0.7 });
    this.hiss(heavy ? 0.22 : 0.13, soft ? 600 : 1500, soft ? 0.4 : 0.36, { type: "lowpass", to: 300 });
    if (!soft) this.ring((heavy ? 620 : 880) * r, heavy ? 0.5 : 0.3, heavy ? 0.07 : 0.05);
    if (heavy) this.hiss(0.4, 180, 0.35, { type: "lowpass", delay: 0.02 });
  }
  hurt() {
    this.tone(170, 0.26, "sawtooth", 0.16, { to: 62 });
    this.tone(84, 0.3, "sine", 0.5, { to: 40 });
    this.hiss(0.16, 800, 0.36, { type: "lowpass", to: 250 });
    this.hiss(0.05, 2600, 0.3);
  }
  block() {
    this.tone(210, 0.14, "triangle", 0.35, { to: 110 });
    this.hiss(0.07, 2600, 0.4, { q: 0.8 });
    this.ring(540 + Math.random() * 80, 0.35, 0.07);
  }
  parry() {
    this.hiss(0.05, 6000, 0.4, { type: "highpass" });
    this.ring(1320, 0.9, 0.11);
    this.ring(1976, 0.7, 0.06, 0.03);
    this.tone(2640, 0.6, "sine", 0.06, { delay: 0.05, to: 2700 });
    this.tone(90, 0.2, "sine", 0.4, { to: 50 });
  }
  dodge() {
    this.hiss(0.26, 420, 0.3, { to: 1900, type: "bandpass", q: 0.9, pan: -0.3 });
    this.hiss(0.2, 1800, 0.14, { to: 500, type: "bandpass", q: 0.9, delay: 0.1, pan: 0.3 });
    this.hiss(0.09, 700, 0.2, { type: "lowpass", delay: 0.24 });
  }
  step(surface: "grass" | "dirt" | "stone" | "wood") {
    const r = 0.85 + Math.random() * 0.3;
    const pan = (Math.random() - 0.5) * 0.24;
    if (surface === "grass") {
      this.hiss(0.09, 2600 * r, 0.07, { q: 0.7, pan });
      this.hiss(0.05, 500, 0.08, { type: "lowpass", pan });
    } else if (surface === "dirt") {
      this.hiss(0.07, 1100 * r, 0.1, { q: 1.1, pan });
      this.tone(95 * r, 0.06, "sine", 0.1, { to: 60, pan });
    } else if (surface === "stone") {
      this.hiss(0.035, 3200 * r, 0.11, { q: 1.6, pan });
      this.tone(210 * r, 0.05, "triangle", 0.07, { to: 130, pan });
      this.hiss(0.05, 900, 0.05, { type: "lowpass", delay: 0.03, pan });
    } else {
      this.hiss(0.05, 800 * r, 0.1, { type: "lowpass", pan });
      this.tone(150 * r, 0.09, "sine", 0.13, { to: 105, pan });
      this.tone(305 * r, 0.05, "triangle", 0.04, { pan });
    }
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
    this.tone(660, 0.14, "triangle", 0.14);
    this.tone(990, 0.2, "triangle", 0.11, { delay: 0.07 });
    this.tone(1980, 0.3, "sine", 0.04, { delay: 0.07 });
    this.hiss(0.05, 5000, 0.08);
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
    this.hiss(0.6, 350, 0.45, { to: 2800, type: "bandpass", q: 0.7 });
    this.hiss(0.9, 2400, 0.16, { to: 700, type: "bandpass", q: 0.6, delay: 0.3 });
    this.tone(220, 0.45, "sawtooth", 0.08, { to: 440 });
    this.tone(70, 0.5, "sine", 0.4, { to: 45, delay: 0.25 });
  }
  burn() {
    this.hiss(0.35, 1800, 0.3, { to: 600 });
  }
  growl() {
    this.tone(85, 0.55, "sawtooth", 0.12, { to: 68, attack: 0.08 });
    this.tone(88, 0.55, "sawtooth", 0.09, { to: 73, attack: 0.08, detune: 35 });
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
    this.tone(64, 0.75, "sine", 0.7, { to: 30 });
    this.tone(128, 0.18, "triangle", 0.3, { to: 50 });
    this.hiss(0.5, 260, 0.45, { type: "lowpass", to: 90 });
    this.hiss(0.9, 1400, 0.1, { type: "bandpass", q: 0.5, delay: 0.05, to: 400 });
  }
  charge() {
    this.tone(300, 0.6, "sawtooth", 0.07, { to: 1200, attack: 0.3 });
  }
  beam() {
    this.tone(1400, 0.5, "square", 0.06, { to: 1300 });
    this.hiss(0.5, 5000, 0.12);
  }
  death() {
    this.tone(220, 1.6, "triangle", 0.2, { to: 55 });
    this.tone(110, 2.2, "sine", 0.3, { to: 41, attack: 0.05 });
    this.bell(0.14, 98);
    this.hiss(1.4, 900, 0.14, { type: "lowpass", to: 120 });
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
    // wind comes in gusts; leaves answer it in the forest
    this.gust = 0.55 + 0.3 * Math.sin(t * 0.21) + 0.15 * Math.sin(t * 0.53 + 1.3);
    const grave = o.theme === "waste" || o.theme === "citadel" || o.theme === "grave_king";
    const storm = o.theme === "keep" || o.theme === "finlay";
    this.windGain.gain.setTargetAtTime(o.indoor && !storm ? 0.05 : (0.2 + o.forest * 0.2 + (grave ? 0.2 : 0)) * (0.5 + this.gust), t, 0.8);
    this.leafGain.gain.setTargetAtTime(!o.indoor && o.forest > 0.5 ? 0.035 * Math.max(0, this.gust - 0.3) * 2 : 0, t, 0.6);
    this.moanGain.gain.setTargetAtTime(grave ? 0.5 * this.gust : 0, t, 1.2);
    this.rainGain.gain.setTargetAtTime(storm ? 0.16 : 0, t, 1.5);
    const hall = o.theme === "citadel" || o.theme === "grave_king" || o.theme === "kennel" || o.theme === "boe" ? 0.5 : o.indoor ? 0.38 : o.forest > 0.5 ? 0.2 : 0.14;
    this.wet.gain.setTargetAtTime(hall, t, 0.8);
    if (storm && t > this.thunderNext) {
      this.thunderNext = t + 14 + Math.random() * 22;
      const pan = Math.random() * 1.4 - 0.7;
      this.hiss(3.2, 140, 0.5, { type: "lowpass", to: 50, dest: this.amb, pan });
      this.tone(52, 2.6, "sine", 0.3, { to: 30, dest: this.amb, attack: 0.1, pan });
      this.hiss(0.5, 900, 0.14, { type: "lowpass", to: 200, dest: this.amb, pan });
    }
    if (o.theme === "citadel" && t > this.dripNext) {
      this.dripNext = t + 1.5 + Math.random() * 5;
      const f = 1500 + Math.random() * 1400;
      this.tone(f, 0.09, "sine", 0.05, { to: f * 1.7, dest: this.amb, pan: Math.random() * 1.6 - 0.8 });
    }
    // far-off voices: an owl or a wolf at night, a crow over the ash by day
    if (!o.indoor && t > this.farNext) {
      this.farNext = t + 9 + Math.random() * 16;
      const pan = Math.random() * 1.6 - 0.8;
      if (grave) {
        for (let i = 0; i < 2 + Math.floor(Math.random() * 2); i++) this.tone(620, 0.2, "sawtooth", 0.012, { to: 480, delay: i * 0.3, dest: this.amb, pan });
      } else if (o.day < 0.3 && Math.random() < 0.5) {
        this.tone(330, 1.8, "sine", 0.03, { to: 440, attack: 0.5, dest: this.amb, pan });
        this.tone(440, 1.4, "sine", 0.025, { to: 300, attack: 0.2, delay: 1.5, dest: this.amb, pan });
      } else if (o.day < 0.3) {
        for (const [d, l] of [[0, 0.22], [0.42, 0.12], [0.62, 0.4]] as const) this.tone(392, l, "sine", 0.03, { to: 340, attack: 0.04, delay: d, dest: this.amb, pan });
      }
    }
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
