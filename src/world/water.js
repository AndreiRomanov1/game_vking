import * as THREE from 'three';
import { WORLD } from '../config.js';
import { waterNormal, noiseTexture } from '../gfx/textures.js';

export function createWater(scene) {
  const geo = new THREE.PlaneGeometry(120, 74, 120, 70);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    fog: true,
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        uTime: { value: 0 },
        uDeep: { value: new THREE.Color('#0f5f78') },
        uShallow: { value: new THREE.Color('#2cb8b8') },
        uFoam: { value: new THREE.Color('#eefff8') },
        uSkyTop: { value: new THREE.Color('#2f8fe0') },
        uSkyHorizon: { value: new THREE.Color('#e9f0e6') },
        uSunDir: { value: new THREE.Vector3(0.3, 0.8, 0.4).normalize() },
        uSunColor: { value: new THREE.Color('#fff4c8') },
        uShoreZ: { value: WORLD.seaZ },
        uNight: { value: 0 },
        uNormalMap: { value: null },
        uNoise: { value: null },
      },
    ]),
    vertexShader: `
      uniform float uTime;
      uniform float uShoreZ;
      varying vec3 vWorld;
      varying vec3 vNormal;
      varying float vWave;
      #include <fog_pars_vertex>

      float wave(vec2 p, vec2 dir, float freq, float speed, float amp, out vec2 grad) {
        float ph = dot(p, dir) * freq + uTime * speed;
        grad = dir * freq * cos(ph) * amp;
        return sin(ph) * amp;
      }

      void main() {
        vec3 p = position;
        vec4 wp0 = modelMatrix * vec4(p, 1.0);
        vec2 xz = wp0.xz;
        float depthFade = smoothstep(uShoreZ - 0.6, uShoreZ + 7.0, xz.y);
        float damp = 0.3 + 0.7 * depthFade;
        vec2 g = vec2(0.0);
        vec2 gi;
        float h = 0.0;
        h += wave(xz, normalize(vec2(0.25, 1.0)), 0.42, 1.05, 0.17, gi); g += gi;
        h += wave(xz, normalize(vec2(-0.55, 0.85)), 0.78, 1.65, 0.09, gi); g += gi;
        h += wave(xz, normalize(vec2(0.9, 0.35)), 1.5, 2.4, 0.045, gi); g += gi;
        h += wave(xz, normalize(vec2(-0.2, -1.0)), 2.6, 3.1, 0.02, gi); g += gi;
        h *= damp;
        g *= damp;
        p.y += h;
        vWave = h;
        vNormal = normalize(vec3(-g.x, 1.0, -g.y));
        vec4 wp = modelMatrix * vec4(p, 1.0);
        vWorld = wp.xyz;
        vec4 mvPosition = viewMatrix * wp;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader: `
      uniform vec3 uDeep;
      uniform vec3 uShallow;
      uniform vec3 uFoam;
      uniform vec3 uSkyTop;
      uniform vec3 uSkyHorizon;
      uniform vec3 uSunDir;
      uniform vec3 uSunColor;
      uniform float uShoreZ;
      uniform float uTime;
      uniform float uNight;
      uniform sampler2D uNormalMap;
      uniform sampler2D uNoise;
      varying vec3 vWorld;
      varying vec3 vNormal;
      varying float vWave;
      #include <fog_pars_fragment>

      void main() {
        if (vWorld.z < uShoreZ - 0.45) discard;

        vec2 uv1 = vWorld.xz * 0.09 + vec2(uTime * 0.028, uTime * 0.018);
        vec2 uv2 = vWorld.xz * 0.21 + vec2(-uTime * 0.022, uTime * 0.031);
        vec3 n1 = texture2D(uNormalMap, uv1).xyz * 2.0 - 1.0;
        vec3 n2 = texture2D(uNormalMap, uv2).xyz * 2.0 - 1.0;
        vec2 detail = n1.xy * 0.6 + n2.xy * 0.4;
        float shore = smoothstep(uShoreZ + 13.0, uShoreZ + 0.3, vWorld.z);
        vec3 N = normalize(vNormal + vec3(detail.x, 0.0, detail.y) * (0.32 - shore * 0.12));
        vec3 V = normalize(cameraPosition - vWorld);

        vec3 base = mix(uDeep, uShallow, shore);
        float ndv = max(dot(N, V), 0.0);
        float fres = mix(0.03, 1.0, pow(1.0 - ndv, 5.0));
        vec3 R = reflect(-V, N);
        vec3 sky = mix(uSkyHorizon, uSkyTop, clamp(R.y * 1.6, 0.0, 1.0));
        vec3 col = mix(base, sky, clamp(fres * 0.85 + 0.08, 0.0, 1.0));

        vec3 H = normalize(uSunDir + V);
        float ndh = max(dot(N, H), 0.0);
        float spec = pow(ndh, 260.0) * 2.6 + pow(ndh, 28.0) * 0.14;
        float sunUp = clamp(uSunDir.y * 4.0 + 0.2, 0.0, 1.0);
        col += uSunColor * spec * sunUp;
        // moon glints at night
        vec3 Hm = normalize(normalize(vec3(-0.55, 0.62, -0.4)) + V);
        col += vec3(0.55, 0.68, 1.0) * pow(max(dot(N, Hm), 0.0), 160.0) * 0.32 * uNight;

        // subsurface at crests
        col += uShallow * smoothstep(0.04, 0.22, vWave) * 0.3 * (1.0 - uNight * 0.85);

        // foam: shoreline wash + crest whitecaps
        float noise = texture2D(uNoise, vWorld.xz * 0.075 + vec2(uTime * 0.02, -uTime * 0.014)).r;
        float noise2 = texture2D(uNoise, vWorld.xz * 0.18 - vec2(uTime * 0.03, uTime * 0.01)).r;
        float foamLine = smoothstep(uShoreZ + 3.4, uShoreZ + 0.15, vWorld.z) * (1.0 - smoothstep(uShoreZ + 0.4, uShoreZ - 1.3, vWorld.z));
        float scallop = 0.5 + 0.5 * sin(vWorld.x * 1.05 + uTime * 1.7 + noise * 7.0);
        float foam = foamLine * smoothstep(0.3, 0.72, noise * 0.6 + scallop * 0.5 + noise2 * 0.2);
        foam += smoothstep(0.21, 0.33, vWave) * smoothstep(0.62, 0.92, noise2) * 0.5;
        foam = clamp(foam, 0.0, 1.0);
        vec3 foamCol = uFoam * (0.55 + 0.45 * sunUp) * (1.0 - uNight * 0.7);
        col = mix(col, foamCol, foam);

        float alpha = mix(0.965, 0.8, shore);
        alpha = mix(alpha, 1.0, foam);
        gl_FragColor = vec4(col, alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }
    `,
  });
  mat.uniforms.uNormalMap.value = waterNormal();
  mat.uniforms.uNoise.value = noiseTexture();
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(0, -0.06, WORLD.seaZ + 22);
  mesh.renderOrder = 1;
  mesh.frustumCulled = false;
  scene.add(mesh);
  return { mesh, mat };
}

export function updateWater(water, time, look) {
  water.mat.uniforms.uTime.value = time;
  if (!look) return;
  water.mat.uniforms.uDeep.value.copy(look.waterDeep);
  water.mat.uniforms.uShallow.value.copy(look.waterShallow);
  water.mat.uniforms.uFoam.value.copy(look.foam);
  water.mat.uniforms.uSunDir.value.copy(look.sunDir);
  water.mat.uniforms.uSunColor.value.copy(look.sunColor);
  water.mat.uniforms.uSkyTop.value.copy(look.skyTop);
  water.mat.uniforms.uSkyHorizon.value.copy(look.skyHorizon);
  water.mat.uniforms.uNight.value = look.night;
}
