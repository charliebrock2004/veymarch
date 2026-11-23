import * as THREE from "three";

/**
 * One pooled particle system per blend mode, each a single draw call.
 * Particles are simulated on the CPU (a few hundred at most) and uploaded each frame.
 */

type P = { x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number; max: number; size: number; grow: number; r: number; g: number; b: number; a: number; drag: number; grav: number };

export class Particles {
  readonly points: THREE.Points;
  private pool: P[] = [];
  private live: P[] = [];
  private pos: Float32Array;
  private col: Float32Array;
  private siz: Float32Array;
  private geo: THREE.BufferGeometry;

  constructor(private cap: number, additive: boolean, scaleUniform: { value: number }) {
    this.pos = new Float32Array(cap * 3);
    this.col = new Float32Array(cap * 4);
    this.siz = new Float32Array(cap);
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute("position", new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute("pcolor", new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute("psize", new THREE.BufferAttribute(this.siz, 1).setUsage(THREE.DynamicDrawUsage));
    const mat = new THREE.ShaderMaterial({
      uniforms: { uScale: scaleUniform },
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      vertexShader: /* glsl */ `
        attribute vec4 pcolor; attribute float psize; uniform float uScale; varying vec4 vC;
        void main() {
          vC = pcolor;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = min(256.0, psize * uScale / max(0.1, -mv.z));
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        varying vec4 vC;
        void main() {
          vec2 d = gl_PointCoord - 0.5;
          float r = dot(d, d) * 4.0;
          float a = smoothstep(1.0, 0.15, r) * vC.a;
          if (a < 0.01) discard;
          gl_FragColor = vec4(vC.rgb, a);
          #include <colorspace_fragment>
        }`,
    });
    this.points = new THREE.Points(this.geo, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
    for (let i = 0; i < cap; i++)
      this.pool.push({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0, max: 1, size: 1, grow: 0, r: 1, g: 1, b: 1, a: 1, drag: 0, grav: 0 });
  }

  emit(o: { x: number; y: number; z: number; vx?: number; vy?: number; vz?: number; life: number; size: number; grow?: number; color: THREE.Color | number; a?: number; drag?: number; grav?: number }) {
    const p = this.pool.pop();
    if (!p) return;
    const c = typeof o.color === "number" ? tmp.setHex(o.color) : o.color;
    p.x = o.x; p.y = o.y; p.z = o.z;
    p.vx = o.vx ?? 0; p.vy = o.vy ?? 0; p.vz = o.vz ?? 0;
    p.life = p.max = o.life;
    p.size = o.size; p.grow = o.grow ?? 0;
    p.r = c.r; p.g = c.g; p.b = c.b; p.a = o.a ?? 1;
    p.drag = o.drag ?? 0; p.grav = o.grav ?? 0;
    this.live.push(p);
  }

  burst(n: number, x: number, y: number, z: number, speed: number, color: number, life: number, size: number, o: { up?: number; grav?: number; drag?: number; spread?: number; a?: number; grow?: number } = {}) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const u = (Math.random() * 2 - 1) * (o.spread ?? 1);
      const sp = speed * (0.4 + Math.random() * 0.6);
      this.emit({
        x, y, z,
        vx: Math.cos(a) * Math.sqrt(1 - u * u) * sp,
        vy: (o.up ?? 0) + Math.abs(u) * sp,
        vz: Math.sin(a) * Math.sqrt(1 - u * u) * sp,
        life: life * (0.6 + Math.random() * 0.6),
        size: size * (0.6 + Math.random() * 0.8),
        color, grav: o.grav ?? 6, drag: o.drag ?? 1.5, a: o.a ?? 1, grow: o.grow ?? 0,
      });
    }
  }

  get count() {
    return this.live.length;
  }

  update(dt: number) {
    const L = this.live;
    let n = 0;
    for (let i = L.length - 1; i >= 0; i--) {
      const p = L[i];
      p.life -= dt;
      if (p.life <= 0) {
        L[i] = L[L.length - 1];
        L.pop();
        this.pool.push(p);
        continue;
      }
      const d = Math.max(0, 1 - p.drag * dt);
      p.vx *= d; p.vz *= d; p.vy = p.vy * d - p.grav * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
    }
    for (const p of L) {
      if (n >= this.cap) break;
      const t = p.life / p.max;
      this.pos[n * 3] = p.x;
      this.pos[n * 3 + 1] = p.y;
      this.pos[n * 3 + 2] = p.z;
      this.col[n * 4] = p.r;
      this.col[n * 4 + 1] = p.g;
      this.col[n * 4 + 2] = p.b;
      this.col[n * 4 + 3] = p.a * Math.min(1, t * 3) * Math.min(1, (1 - t) * 8 + 0.2);
      this.siz[n] = p.size + p.grow * (1 - t);
      n++;
    }
    this.geo.setDrawRange(0, n);
    (this.geo.getAttribute("position") as THREE.BufferAttribute).needsUpdate = true;
    (this.geo.getAttribute("pcolor") as THREE.BufferAttribute).needsUpdate = true;
    (this.geo.getAttribute("psize") as THREE.BufferAttribute).needsUpdate = true;
  }

  clear() {
    while (this.live.length) this.pool.push(this.live.pop()!);
  }
}

const tmp = new THREE.Color();

/**
 * Static glow halos (lanterns, windows, braziers). One Points object; brightness follows the night.
 */
export function buildGlows(spots: { x: number; y: number; z: number; size: number; color: number }[], scale: { value: number }, intensity: { value: number }) {
  const n = spots.length;
  const pos = new Float32Array(n * 3);
  const col = new Float32Array(n * 3);
  const siz = new Float32Array(n);
  const c = new THREE.Color();
  spots.forEach((s, i) => {
    pos.set([s.x, s.y, s.z], i * 3);
    c.setHex(s.color);
    col.set([c.r, c.g, c.b], i * 3);
    siz[i] = s.size;
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("gcolor", new THREE.BufferAttribute(col, 3));
  geo.setAttribute("gsize", new THREE.BufferAttribute(siz, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uScale: scale, uI: intensity, uTime: { value: 0 } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      attribute vec3 gcolor; attribute float gsize; uniform float uScale; uniform float uI; uniform float uTime; varying vec3 vC;
      void main() {
        float flick = 0.88 + 0.12 * sin(uTime * 9.0 + position.x * 3.1 + position.z * 1.7);
        vC = gcolor * uI * flick;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = min(300.0, gsize * uScale / max(0.1, -mv.z));
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      varying vec3 vC;
      void main() {
        vec2 d = gl_PointCoord - 0.5;
        float r = dot(d, d) * 4.0;
        float a = exp(-r * 4.0) * 0.9;
        gl_FragColor = vec4(vC * a, a);
        #include <colorspace_fragment>
      }`,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  pts.renderOrder = 6;
  return { points: pts, time: mat.uniforms.uTime };
}
