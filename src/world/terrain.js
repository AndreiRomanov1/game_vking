import * as THREE from 'three';
import { WORLD, HUTS } from '../config.js';
import { fbm, terrainHeight } from './map.js';
import { grassDetail, sandDetail, stone, noiseTexture } from '../gfx/textures.js';

export function createTerrain(scene) {
  const w = 86;
  const d = 92;
  const seg = 128;
  const geo = new THREE.PlaneGeometry(w, d, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const col = new THREE.Color();

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const h = terrainHeight(x, z);
    pos.setY(i, h);
    const n = fbm(x * 0.2, z * 0.2);
    if (h < 0.04) {
      col.set(0x3a7a68);
    } else if (z > WORLD.seaZ - 1.8) {
      col.setRGB(0.9 - n * 0.08, 0.72 - n * 0.05, 0.46);
      if (z > WORLD.seaZ - 0.7) col.lerp(new THREE.Color(0xb98244), 0.5);
    } else if (z > WORLD.beachZ0 - 0.4) {
      const t = THREE.MathUtils.clamp((WORLD.seaZ - 1.2 - z) / 7, 0, 1);
      col.setRGB(0.95, 0.8, 0.52).lerp(new THREE.Color(0x63c455), t * 0.6);
      col.offsetHSL(0, 0, (n - 0.5) * 0.08);
    } else if (Math.abs(x) < 14 && z < 6.2 && z > -12) {
      col.setRGB(0.46 + n * 0.1, 0.7 + n * 0.1, 0.26);
      if (Math.abs(x) < 1.6 && z < 5.5 && z > -8) {
        col.setRGB(0.66, 0.5, 0.3);
      }
    } else if (h > 2.2) {
      const rock = THREE.MathUtils.clamp((h - 2.2) / 3, 0, 1);
      col.setRGB(0.3 + n * 0.1, 0.62 + n * 0.12, 0.24).lerp(new THREE.Color(0x8c8478), rock * 0.85);
    } else {
      col.setRGB(0.22 + n * 0.1, 0.62 + n * 0.16, 0.18);
      col.offsetHSL((n - 0.5) * 0.04, 0.05, (n - 0.5) * 0.06);
    }
    // packed earth around the huts and the longhouse
    if (Math.abs(x) < 14 && z < 6.2 && z > -12) {
      let worn = 0;
      for (const hut of HUTS) {
        const d = Math.hypot(x - hut.x, z - hut.z);
        worn = Math.max(worn, 1 - THREE.MathUtils.smoothstep(d, hut.s * 1.1, hut.s * 2.3 + n * 0.6));
      }
      const lh = WORLD.longhouse;
      const dx = Math.max(0, Math.abs(x - lh.x) - lh.w * 0.5);
      const dz = Math.max(0, Math.abs(z - lh.z) - lh.d * 0.5);
      worn = Math.max(worn, 1 - THREE.MathUtils.smoothstep(Math.hypot(dx, dz), 0.2, 1.8 + n * 0.5));
      col.lerp(new THREE.Color(0.6, 0.47, 0.3), worn * 0.75);
    }
    // trodden path from the gate down to the sand
    if (z > 5 && z < WORLD.beachZ0 + 1.2 && h > 0.04) {
      const halfW = 1.5 + (n - 0.5) * 0.6;
      const across = 1 - THREE.MathUtils.smoothstep(Math.abs(x), halfW * 0.5, halfW);
      const along = 1 - THREE.MathUtils.smoothstep(z, WORLD.beachZ0 - 0.4, WORLD.beachZ0 + 1.2);
      col.lerp(new THREE.Color(0.62, 0.48, 0.3), across * along * 0.9);
    }
    colors[i * 3] = col.r;
    colors[i * 3 + 1] = col.g;
    colors[i * 3 + 2] = col.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const grass = grassDetail();
  const sand = sandDetail();
  grass.map.repeat.set(34, 36);
  grass.normalMap.repeat.set(34, 36);

  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    map: grass.map,
    normalMap: grass.normalMap,
    normalScale: new THREE.Vector2(0.55, 0.55),
    roughness: 0.95,
    metalness: 0,
  });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uSandMap = { value: sand.map };
    shader.uniforms.uSandNormal = { value: sand.normalMap };
    shader.uniforms.uSeaZ = { value: WORLD.seaZ };
    shader.uniforms.uBeachZ = { value: WORLD.beachZ0 };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWorldPos;')
      .replace(
        '#include <worldpos_vertex>',
        '#include <worldpos_vertex>\nvWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;',
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vWorldPos;
        uniform sampler2D uSandMap;
        uniform sampler2D uSandNormal;
        uniform float uSeaZ;
        uniform float uBeachZ;
        float sandMix() {
          return smoothstep(uBeachZ - 1.6, uBeachZ + 0.8, vWorldPos.z);
        }`,
      )
      .replace(
        '#include <map_fragment>',
        `vec4 grassTex = texture2D(map, vMapUv);
        vec4 sandTex = texture2D(uSandMap, vMapUv * 1.9);
        float sandy = sandMix();
        diffuseColor *= mix(grassTex, sandTex, sandy);`,
      )
      .replace(
        '#include <normal_fragment_maps>',
        `#ifdef USE_NORMALMAP_TANGENTSPACE
        vec3 mapN = mix(texture2D(normalMap, vNormalMapUv).xyz, texture2D(uSandNormal, vNormalMapUv * 1.9).xyz, sandMix()) * 2.0 - 1.0;
        mapN.xy *= normalScale;
        normal = normalize(tbn * mapN);
        #endif`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
        float wet = smoothstep(uSeaZ - 3.6, uSeaZ - 0.4, vWorldPos.z);
        roughnessFactor = mix(roughnessFactor, 0.3, wet);`,
      );
  };
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.castShadow = false;
  mesh.name = 'terrain';
  scene.add(mesh);

  const foam = createFoam();
  scene.add(foam);

  const cliff = createSideCliffs();
  scene.add(cliff);

  return { mesh, sample: terrainHeight, foam };
}

function createFoam() {
  const geo = new THREE.PlaneGeometry(80, 3.8, 48, 4);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color('#f3fff8') },
      uNoise: { value: noiseTexture() },
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vWorld;
      uniform float uTime;
      void main() {
        vUv = uv;
        vec3 p = position;
        p.y += sin(position.x * 0.6 + uTime * 2.4) * 0.04;
        vec4 wp = modelMatrix * vec4(p, 1.0);
        vWorld = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      varying vec3 vWorld;
      uniform float uTime;
      uniform vec3 uColor;
      uniform sampler2D uNoise;
      void main() {
        float n = texture2D(uNoise, vWorld.xz * 0.12 + vec2(uTime * 0.03, uTime * 0.05)).r;
        float w = sin(vUv.x * 26.0 + uTime * 2.6 + n * 5.0) * 0.5 + 0.5;
        float band = smoothstep(0.0, 0.35, vUv.y) * smoothstep(1.0, 0.45, vUv.y);
        float a = band * (0.18 + 0.4 * w) * smoothstep(0.35, 0.7, n + w * 0.25);
        gl_FragColor = vec4(uColor, a * 0.85);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  const m = new THREE.Mesh(geo, mat);
  m.position.set(0, 0.08, WORLD.seaZ - 0.2);
  m.renderOrder = 2;
  m.userData.foamMat = mat;
  return m;
}

function createSideCliffs() {
  const g = new THREE.Group();
  const st = stone(4);
  const rockMat = new THREE.MeshStandardMaterial({
    color: 0x9a8b78,
    map: st.map,
    normalMap: st.normalMap,
    normalScale: new THREE.Vector2(0.8, 0.8),
    roughness: 0.92,
    flatShading: true,
  });
  const moss = new THREE.MeshStandardMaterial({
    color: 0x5a9a44,
    map: st.map,
    normalMap: st.normalMap,
    roughness: 0.95,
    flatShading: true,
  });
  for (const side of [-1, 1]) {
    for (let i = 0; i < 10; i++) {
      const z = -16 + i * 4.6;
      const x = side * (22 + (i % 3) * 1.4);
      const h = 2.2 + (i % 4) * 0.7 + (z < -6 ? 2 : 0);
      const m = new THREE.Mesh(new THREE.DodecahedronGeometry(1.4 + (i % 3) * 0.25, 1), i % 2 ? rockMat : moss);
      m.position.set(x, terrainHeight(x, z) + h * 0.2, z);
      m.scale.set(1.6, h * 0.55, 1.8);
      m.rotation.set(0.2, i, 0.1);
      m.castShadow = true;
      m.receiveShadow = true;
      g.add(m);
    }
  }
  return g;
}

export function updateTerrain(terrain, time) {
  if (terrain.foam?.userData.foamMat) {
    terrain.foam.userData.foamMat.uniforms.uTime.value = time;
  }
}
