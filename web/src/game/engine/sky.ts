import * as THREE from "three";

/**
 * A gradient sky dome with a sun, drifting cloud banks, and stars at night.
 * The horizon colour is shared with the fog, so distant hills fade into the sky
 * instead of ending at a wall.
 */
export type Sky = {
  mesh: THREE.Mesh;
  set: (o: { zenith: THREE.Color; horizon: THREE.Color; sunDir: THREE.Vector3; sunColor: THREE.Color; night: number; time: number; cloud: number }) => void;
};

export function buildSky(): Sky {
  const uniforms = {
    uZenith: { value: new THREE.Color(0x6f8fb0) },
    uHorizon: { value: new THREE.Color(0xe8d2b0) },
    uSunDir: { value: new THREE.Vector3(0.3, 0.4, 0.5).normalize() },
    uSunColor: { value: new THREE.Color(0xffe2b0) },
    uNight: { value: 0 },
    uTime: { value: 0 },
    uCloud: { value: 0.55 },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        vec4 p = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * p;
        gl_Position.z = gl_Position.w;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uZenith; uniform vec3 uHorizon; uniform vec3 uSunDir; uniform vec3 uSunColor;
      uniform float uNight; uniform float uTime; uniform float uCloud;
      varying vec3 vDir;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
      float n(vec2 p){ vec2 i=floor(p); vec2 f=fract(p); f=f*f*(3.0-2.0*f);
        return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
      float fbm(vec2 p){ float s=0.0; float a=0.5; for(int i=0;i<4;i++){ s+=n(p)*a; p*=2.07; a*=0.5; } return s; }
      void main() {
        vec3 d = normalize(vDir);
        float up = clamp(d.y, -1.0, 1.0);
        float t = pow(clamp(up, 0.0, 1.0), 0.45);
        vec3 col = mix(uHorizon, uZenith, t);
        col = mix(col, uHorizon * 0.82, clamp(-up * 4.0, 0.0, 1.0));
        float sd = max(dot(d, normalize(uSunDir)), 0.0);
        col += uSunColor * (pow(sd, 6.0) * 0.28 + pow(sd, 64.0) * 0.6) * (1.0 - uNight * 0.85);
        col += uSunColor * smoothstep(0.9993, 0.9997, sd) * 2.2 * (1.0 - uNight);
        if (up > 0.0) {
          vec2 cp = d.xz / (up + 0.12) * 1.4 + vec2(uTime * 0.006, uTime * 0.002);
          float c = fbm(cp);
          float cov = smoothstep(1.0 - uCloud, 1.0 - uCloud + 0.35, c);
          vec3 lit = mix(uHorizon * 1.08, vec3(1.0, 0.97, 0.92), 0.5) * (1.0 - uNight * 0.75);
          vec3 shade = mix(uZenith, uHorizon, 0.5) * 0.75;
          vec3 cc = mix(shade, lit, smoothstep(0.3, 0.9, c) + pow(sd, 4.0) * 0.4);
          col = mix(col, cc, cov * smoothstep(0.0, 0.18, up) * 0.85);
          float st = step(0.9975, h(floor(d.xz / (up + 0.3) * 260.0)));
          col += vec3(st) * uNight * smoothstep(0.1, 0.4, up) * (1.0 - cov);
        }
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -10;
  mesh.name = "sky";
  return {
    mesh,
    set(o) {
      uniforms.uZenith.value.copy(o.zenith);
      uniforms.uHorizon.value.copy(o.horizon);
      uniforms.uSunDir.value.copy(o.sunDir);
      uniforms.uSunColor.value.copy(o.sunColor);
      uniforms.uNight.value = o.night;
      uniforms.uTime.value = o.time;
      uniforms.uCloud.value = o.cloud;
    },
  };
}
