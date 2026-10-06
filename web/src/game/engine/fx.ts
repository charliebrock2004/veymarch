import * as THREE from "three";

/**
 * Ground telegraphs, swing arcs, shockwaves and beams. A tell is a pose, a shape and a sound
 * together (art bible §20): these are the shape.
 */

export type Shape = 0 | 1 | 2; // ring, cone, line

const decalVert = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const decalFrag = /* glsl */ `
  uniform float uP; uniform float uA; uniform vec3 uC; uniform int uShape; uniform float uHalf; uniform float uTime;
  varying vec2 vUv;
  void main() {
    vec2 p = vUv * 2.0 - 1.0;
    float inside = 0.0; float edge = 0.0; float fill = 0.0;
    if (uShape == 0) {
      float r = length(p);
      inside = step(r, 1.0);
      edge = smoothstep(0.86, 0.96, r) * inside;
      fill = step(r, uP) * inside;
    } else if (uShape == 1) {
      float r = length(p);
      float ang = atan(p.x, p.y);
      inside = step(r, 1.0) * step(abs(ang), uHalf);
      edge = max(smoothstep(0.86, 0.97, r), smoothstep(uHalf - 0.08, uHalf, abs(ang))) * inside;
      fill = step(r, uP) * inside;
    } else {
      float y = vUv.y;
      inside = step(abs(p.x), 1.0);
      edge = smoothstep(0.75, 0.95, abs(p.x));
      fill = step(y, uP);
    }
    float pulse = 0.75 + 0.25 * sin(uTime * 18.0);
    float a = (inside * 0.16 + fill * 0.32 + edge * 0.55 * pulse) * uA;
    if (a < 0.01) discard;
    gl_FragColor = vec4(uC, a);
    #include <colorspace_fragment>
  }`;

export class Decal {
  mesh: THREE.Mesh;
  mat: THREE.ShaderMaterial;
  busy = false;
  constructor(time: { value: number }) {
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uP: { value: 0 }, uA: { value: 1 }, uC: { value: new THREE.Color(0xd96a3a) }, uShape: { value: 0 }, uHalf: { value: 0.6 }, uTime: time },
      vertexShader: decalVert,
      fragmentShader: decalFrag,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -4,
    });
    const g = new THREE.PlaneGeometry(2, 2);
    g.rotateX(-Math.PI / 2);
    this.mesh = new THREE.Mesh(g, this.mat);
    this.mesh.renderOrder = 4;
    this.mesh.visible = false;
    this.mesh.frustumCulled = false;
  }
  /** Ring: radius r. Cone: radius r, half-angle. Line: half-width w, length r (from origin forward). */
  show(shape: Shape, x: number, y: number, z: number, yaw: number, r: number, progress: number, opts: { half?: number; w?: number; color?: number; alpha?: number } = {}) {
    this.mesh.visible = true;
    this.mat.uniforms.uShape.value = shape;
    this.mat.uniforms.uP.value = progress;
    this.mat.uniforms.uA.value = opts.alpha ?? 1;
    this.mat.uniforms.uHalf.value = opts.half ?? 0.6;
    this.mat.uniforms.uC.value.setHex(opts.color ?? 0xd96a3a);
    this.mesh.rotation.set(0, yaw, 0);
    if (shape === 2) {
      const w = opts.w ?? 0.8;
      this.mesh.scale.set(w, 1, r / 2);
      this.mesh.position.set(x + Math.sin(yaw) * r / 2, y + 0.12, z + Math.cos(yaw) * r / 2);
    } else {
      this.mesh.scale.set(r, 1, r);
      this.mesh.position.set(x, y + 0.12, z);
    }
  }
  hide() {
    this.mesh.visible = false;
  }
}

export class DecalPool {
  private all: Decal[] = [];
  constructor(private parent: THREE.Object3D, private time: { value: number }) {}
  get() {
    let d = this.all.find((x) => !x.busy);
    if (!d) {
      d = new Decal(this.time);
      this.parent.add(d.mesh);
      this.all.push(d);
    }
    d.busy = true;
    return d;
  }
  release(d: Decal | null | undefined) {
    if (!d) return;
    d.busy = false;
    d.hide();
  }
}

type Fading = { mesh: THREE.Mesh; life: number; max: number; grow: number; base: number };

/** Short-lived additive meshes: swing arcs and shockwave rings. */
export class Flashes {
  private items: Fading[] = [];
  private arcGeo = new THREE.RingGeometry(0.75, 1.0, 20, 1, -1.2, 2.4);
  private ringGeo = new THREE.RingGeometry(0.85, 1.0, 40);
  constructor(private parent: THREE.Object3D) {}
  private mat(color: number, opacity: number) {
    return new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  }
  arc(x: number, y: number, z: number, yaw: number, radius: number, vertical: boolean, color = 0xffe6b8, flip = false) {
    const m = new THREE.Mesh(this.arcGeo, this.mat(color, 0.7));
    m.position.set(x, y, z);
    if (vertical) m.rotation.set(0, yaw - Math.PI / 2, Math.PI / 2, "YXZ");
    else m.rotation.set(-Math.PI / 2, 0, -yaw + Math.PI / 2 + (flip ? Math.PI : 0), "YXZ");
    m.scale.setScalar(radius);
    m.renderOrder = 7;
    this.parent.add(m);
    this.items.push({ mesh: m, life: 0.16, max: 0.16, grow: 0.15, base: radius });
  }
  ring(x: number, y: number, z: number, radius: number, color = 0xffd9a0, life = 0.5) {
    const m = new THREE.Mesh(this.ringGeo, this.mat(color, 0.8));
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, y + 0.15, z);
    m.scale.setScalar(0.3);
    m.renderOrder = 7;
    this.parent.add(m);
    this.items.push({ mesh: m, life, max: life, grow: radius, base: 0.3 });
  }
  update(dt: number) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const f = this.items[i];
      f.life -= dt;
      const t = 1 - Math.max(0, f.life) / f.max;
      const s = f.base + f.grow * t;
      f.mesh.scale.setScalar(s);
      (f.mesh.material as THREE.MeshBasicMaterial).opacity = (1 - t) * 0.8;
      if (f.life <= 0) {
        this.parent.remove(f.mesh);
        (f.mesh.material as THREE.Material).dispose();
        this.items.splice(i, 1);
      }
    }
  }
}

/** A thin brass beam between two points (Cookie's button-eye beam). */
export class Beam {
  mesh: THREE.Mesh;
  private mat: THREE.MeshBasicMaterial;
  constructor(parent: THREE.Object3D) {
    const g = new THREE.CylinderGeometry(1, 1, 1, 8, 1, true);
    g.translate(0, 0.5, 0);
    g.rotateX(Math.PI / 2);
    this.mat = new THREE.MeshBasicMaterial({ color: 0xffc46b, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false });
    this.mesh = new THREE.Mesh(g, this.mat);
    this.mesh.visible = false;
    this.mesh.renderOrder = 8;
    this.mesh.frustumCulled = false;
    parent.add(this.mesh);
  }
  show(from: THREE.Vector3, to: THREE.Vector3, width: number, opacity: number) {
    this.mesh.visible = true;
    this.mesh.position.copy(from);
    this.mesh.lookAt(to);
    this.mesh.scale.set(width, width, from.distanceTo(to));
    this.mat.opacity = opacity;
  }
  hide() {
    this.mesh.visible = false;
  }
}
