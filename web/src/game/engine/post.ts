import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";

/** How a region's light is graded after tone mapping. */
export type Grade = { tint: number; sat: number; contrast: number; vignette: number; bloom: number; lift: number };

export const DEFAULT_GRADE: Grade = { tint: 0xffffff, sat: 1.08, contrast: 1.06, vignette: 0.32, bloom: 0.28, lift: 0 };

const GradeShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uTint: { value: new THREE.Color(0xffffff) },
    uSat: { value: 1 },
    uContrast: { value: 1 },
    uVignette: { value: 0.3 },
    uLift: { value: 0 },
    uFlash: { value: 0 },
    uFlashColor: { value: new THREE.Color(0xffffff) },
    uTime: { value: 0 },
    uSun: { value: new THREE.Vector2(0.5, 0.5) },
    uRays: { value: 0 },
    uRayColor: { value: new THREE.Color(0xffe2b0) },
    uPx: { value: new THREE.Vector2(1 / 1280, 1 / 720) },
    uSharp: { value: 0.35 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse; uniform vec3 uTint; uniform float uSat; uniform float uContrast;
    uniform float uVignette; uniform float uLift; uniform float uFlash; uniform vec3 uFlashColor; uniform float uTime;
    uniform vec2 uSun; uniform float uRays; uniform vec3 uRayColor; uniform vec2 uPx; uniform float uSharp;
    varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)) + uTime) * 43758.5453); }
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      vec2 d = vUv - 0.5;
      // lens: the faintest colour fringe toward the corners
      float edge = dot(d, d);
      vec2 ca = d * edge * 0.006;
      c.r = texture2D(tDiffuse, vUv - ca).r;
      c.b = texture2D(tDiffuse, vUv + ca).b;
      // unsharp mask: put back the crispness bloom and resampling take away
      vec3 blur = (texture2D(tDiffuse, vUv + vec2(uPx.x, 0.0)).rgb + texture2D(tDiffuse, vUv - vec2(uPx.x, 0.0)).rgb
        + texture2D(tDiffuse, vUv + vec2(0.0, uPx.y)).rgb + texture2D(tDiffuse, vUv - vec2(0.0, uPx.y)).rgb) * 0.25;
      c.rgb += (c.rgb - blur) * uSharp;
      // light shafts: march toward the sun, gathering whatever bright sky is not hidden
      if (uRays > 0.004) {
        vec2 stepv = (uSun - vUv) / 22.0;
        vec2 p = vUv + stepv * h(vUv * 331.0);
        float acc = 0.0; float w = 1.0;
        for (int i = 0; i < 22; i++) {
          vec3 s = texture2D(tDiffuse, clamp(p, 0.0, 1.0)).rgb;
          acc += smoothstep(0.72, 1.0, dot(s, vec3(0.2126, 0.7152, 0.0722))) * w;
          w *= 0.95; p += stepv;
        }
        float near = smoothstep(1.1, 0.0, length((vUv - uSun) * vec2(1.6, 1.0)));
        c.rgb += uRayColor * acc / 22.0 * uRays * near;
      }
      vec3 col = c.rgb * uTint;
      float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col = mix(vec3(l), col, uSat);
      col = (col - 0.5) * uContrast + 0.5 + uLift;
      // split tone: cool the shadows a touch, warm the highlights
      float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col += mix(vec3(-0.012, 0.0, 0.02), vec3(0.018, 0.008, -0.016), smoothstep(0.15, 0.85, lum));
      float v = smoothstep(0.85, 0.2, length(d * vec2(1.15, 1.0)));
      col *= mix(1.0 - uVignette, 1.0, v);
      col = mix(col, uFlashColor, uFlash * (1.0 - v * 0.6));
      col += (h(vUv * 917.0) - 0.5) * 0.012;
      gl_FragColor = vec4(clamp(col, 0.0, 1.0), c.a);
    }`,
};

/**
 * Bloom, colour grade, vignette and a soft damage flash. Only runs on High quality:
 * phones on Medium and Low draw straight to the screen.
 */
export function createPost(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) {
  const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType }));
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), DEFAULT_GRADE.bloom, 0.62, 0.8);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const grade = new ShaderPass(GradeShader);
  composer.addPass(grade);
  const u = grade.uniforms as typeof GradeShader.uniforms;
  const target = { ...DEFAULT_GRADE };
  const tint = new THREE.Color();
  let flash = 0;
  let rays = 0;
  let bloomScale = 0.5;
  return {
    enabled: false,
    /** Medium runs a lighter chain: quarter-res bloom, no light shafts. */
    setLite(lite: boolean) {
      bloomScale = lite ? 0.25 : 0.5;
      u.uSharp.value = lite ? 0.2 : 0.35;
      this.lite = lite;
    },
    lite: false,
    /** Where the sun is on screen (0..1) and how strongly its shafts should show. */
    setSun(x: number, y: number, strength: number, color: THREE.Color) {
      u.uSun.value.set(x, y);
      u.uRayColor.value.copy(color);
      rays = this.lite ? 0 : strength;
    },
    setSize(w: number, h: number, pr: number) {
      composer.setPixelRatio(pr);
      composer.setSize(w, h);
      bloom.resolution.set(w * pr * bloomScale, h * pr * bloomScale);
      u.uPx.value.set(1 / (w * pr), 1 / (h * pr));
    },
    setGrade(g: Grade) {
      Object.assign(target, g);
    },
    flash(color: number, amount: number) {
      u.uFlashColor.value.setHex(color);
      flash = Math.max(flash, amount);
    },
    render(dt: number) {
      const k = Math.min(1, dt * 1.5);
      u.uTint.value.lerp(tint.setHex(target.tint), k);
      u.uSat.value += (target.sat - u.uSat.value) * k;
      u.uContrast.value += (target.contrast - u.uContrast.value) * k;
      u.uVignette.value += (target.vignette - u.uVignette.value) * k;
      u.uLift.value += (target.lift - u.uLift.value) * k;
      bloom.strength += (target.bloom - bloom.strength) * k;
      flash = Math.max(0, flash - dt * 2.5);
      u.uFlash.value = flash;
      u.uRays.value += (rays - u.uRays.value) * Math.min(1, dt * 3);
      u.uTime.value = (u.uTime.value + dt) % 100;
      composer.render(dt);
    },
  };
}

/** Each region's look: warm Hearthfen, gilded Kingdom, cold green Mire, iron-grey Keep, ash-white Wasteland. */
export const ZONE_GRADES: Record<string, Grade> = {
  over: { tint: 0xfff4e4, sat: 1.12, contrast: 1.06, vignette: 0.3, bloom: 0.3, lift: 0 },
  castle: { tint: 0xffe8d0, sat: 1.1, contrast: 1.1, vignette: 0.42, bloom: 0.45, lift: 0 },
  kingdom: { tint: 0xfff0d8, sat: 1.1, contrast: 1.05, vignette: 0.28, bloom: 0.32, lift: 0.005 },
  hunt: { tint: 0xeef4e0, sat: 1.0, contrast: 1.08, vignette: 0.38, bloom: 0.25, lift: 0 },
  kennel: { tint: 0xffe6d0, sat: 1.02, contrast: 1.1, vignette: 0.44, bloom: 0.4, lift: 0 },
  mire: { tint: 0xdff0dc, sat: 0.86, contrast: 1.1, vignette: 0.46, bloom: 0.35, lift: 0.01 },
  keep: { tint: 0xe4e8f0, sat: 0.82, contrast: 1.14, vignette: 0.48, bloom: 0.3, lift: 0 },
  waste: { tint: 0xece8e4, sat: 0.62, contrast: 1.12, vignette: 0.45, bloom: 0.42, lift: 0.015 },
  citadel: { tint: 0xd8e0f4, sat: 0.7, contrast: 1.18, vignette: 0.55, bloom: 0.55, lift: 0 },
};
