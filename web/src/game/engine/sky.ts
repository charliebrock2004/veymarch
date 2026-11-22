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
        vec3 sunD = normalize(uSunDir);
        float up = clamp(d.y, -1.0, 1.0);
        float t = pow(clamp(up, 0.0, 1.0), 0.45);
        vec3 col = mix(uHorizon, uZenith, t);
        col = mix(col, uHorizon * 0.82, clamp(-up * 4.0, 0.0, 1.0));
        float sd = max(dot(d, sunD), 0.0);
        float day = 1.0 - uNight;
        // low sun: a warm band along the horizon on the sun's side, a cool one opposite
        float low = (1.0 - smoothstep(0.1, 0.55, sunD.y)) * day;
        float band = exp(-abs(up) * 7.0);
        float side = dot(normalize(d.xz + 1e-4), normalize(sunD.xz + 1e-4)) * 0.5 + 0.5;
        col += vec3(1.0, 0.42, 0.16) * band * low * pow(side, 2.0) * 0.55;
        col += vec3(0.35, 0.22, 0.5) * band * low * pow(1.0 - side, 3.0) * 0.18;
        // haze where the sky meets the land
        col = mix(col, uHorizon * 1.06, exp(-abs(up) * 14.0) * 0.5);
        col += uSunColor * (pow(sd, 6.0) * 0.28 + pow(sd, 64.0) * 0.6 + pow(sd, 700.0) * 1.2) * (1.0 - uNight * 0.85);
        col += uSunColor * smoothstep(0.9993, 0.9997, sd) * 2.2 * day;
        // the moon rides opposite the sun, with a soft halo
        vec3 moonD = normalize(vec3(-sunD.x, 0.55, -sunD.z));
        float md = max(dot(d, moonD), 0.0);
        float disc = smoothstep(0.99955, 0.9998, md);
        vec2 mp = (d - moonD * md).xz * 90.0;
        float mare = 0.82 + 0.18 * n(mp * 3.0 + 7.0) - 0.22 * smoothstep(0.45, 0.75, fbm(mp * 1.4 + 3.0));
        vec3 moonCol = vec3(0.86, 0.9, 1.0);
        float cover = 0.0;
        if (up > 0.0) {
          // stars: three sizes, each with its own twinkle and tint; a faint river of them overhead
          vec2 sp = d.xz / (up + 0.3);
          float stars = 0.0;
          vec3 starCol = vec3(0.0);
          for (int i = 0; i < 3; i++) {
            float sc = 120.0 + float(i) * 95.0;
            vec2 cell = floor(sp * sc);
            vec2 fr = fract(sp * sc) - 0.5;
            float r = h(cell + float(i) * 17.0);
            float on = step(0.985 - float(i) * 0.004, r);
            float tw = 0.65 + 0.35 * sin(uTime * (1.5 + r * 4.0) + r * 90.0);
            float pt = smoothstep(0.38 - float(i) * 0.08, 0.0, length(fr)) * on * tw * (1.0 - float(i) * 0.25);
            stars += pt;
            starCol += pt * mix(vec3(0.75, 0.84, 1.0), vec3(1.0, 0.88, 0.7), h(cell + 3.3));
          }
          float river = smoothstep(0.42, 0.75, fbm(sp * 2.2 + vec2(sp.y * 1.5, 0.0))) * smoothstep(0.55, 0.0, abs(sp.x * 0.7 + sp.y * 0.5));
          vec3 night = starCol * 1.3 + vec3(0.5, 0.56, 0.75) * river * 0.16;
          // two cloud decks: slow high cirrus, nearer banks that the sun rims
          vec2 cp = d.xz / (up + 0.12) * 1.4 + vec2(uTime * 0.006, uTime * 0.002);
          float c = fbm(cp) * 0.78 + fbm(cp * 2.9 + 11.0) * 0.22;
          float cov = smoothstep(1.0 - uCloud, 1.0 - uCloud + 0.35, c);
          vec2 hp = d.xz / (up + 0.25) * 0.55 + vec2(uTime * 0.0018, -uTime * 0.0009);
          float cirrus = smoothstep(0.52, 0.85, fbm(hp * vec2(1.0, 3.2))) * 0.35;
          vec3 lit = mix(uHorizon * 1.08, vec3(1.0, 0.97, 0.92), 0.5) * (1.0 - uNight * 0.75);
          lit += vec3(1.0, 0.5, 0.25) * low * 0.35 * side;
          lit += moonCol * uNight * 0.1 * pow(md, 6.0);
          vec3 shade = mix(uZenith, uHorizon, 0.5) * 0.75;
          float edge = cov * (1.0 - cov) * 4.0;
          vec3 cc = mix(shade, lit, smoothstep(0.3, 0.9, c) + pow(sd, 4.0) * 0.4);
          cc += uSunColor * edge * pow(sd, 8.0) * 0.9 * day;
          float fadeUp = smoothstep(0.0, 0.18, up);
          cover = cov * fadeUp * 0.85;
          col += night * uNight * smoothstep(0.05, 0.35, up) * (1.0 - cover);
          col = mix(col, lit, cirrus * fadeUp * (1.0 - uNight * 0.6));
          col += moonCol * (pow(md, 40.0) * 0.12 + pow(md, 900.0) * 0.35) * uNight * (1.0 - cover * 0.6);
          col = mix(col, moonCol * mare * 1.25, disc * uNight * (1.0 - cover));
          col = mix(col, cc, cover);
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
