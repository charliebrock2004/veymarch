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
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse; uniform vec3 uTint; uniform float uSat; uniform float uContrast;
    uniform float uVignette; uniform float uLift; uniform float uFlash; uniform vec3 uFlashColor; uniform float uTime;
    varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)) + uTime) * 43758.5453); }
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      vec3 col = c.rgb * uTint;
      float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col = mix(vec3(l), col, uSat);
      col = (col - 0.5) * uContrast + 0.5 + uLift;
      vec2 d = vUv - 0.5;
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
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), DEFAULT_GRADE.bloom, 0.55, 0.82);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const grade = new ShaderPass(GradeShader);
  composer.addPass(grade);
  const u = grade.uniforms as typeof GradeShader.uniforms;
  const target = { ...DEFAULT_GRADE };
  const tint = new THREE.Color();
  let flash = 0;
  return {
    enabled: false,
    setSize(w: number, h: number, pr: number) {
      composer.setPixelRatio(pr);
      composer.setSize(w, h);
      bloom.resolution.set(w * pr * 0.5, h * pr * 0.5);
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
