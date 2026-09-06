import * as THREE from 'three';
import { HUTS, WORLD } from '../config.js';
import { terrainHeight, hash2 } from './map.js';

function bladeGeometry(width, height, segments = 3) {
  const geo = new THREE.BufferGeometry();
  const verts = [];
  const idx = [];
  for (let s = 0; s <= segments; s++) {
    const t = s / segments;
    const w = width * (1 - t * 0.85) * 0.5;
    const bend = t * t * 0.18;
    verts.push(-w, t * height, bend, w, t * height, bend);
  }
  for (let s = 0; s < segments; s++) {
    const a = s * 2;
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setIndex(idx);
  return geo;
}

function blocked(x, z) {
  const h = terrainHeight(x, z);
  if (h < 0.12) return true;
  if (z > WORLD.beachZ0 - 0.6) return true;
  if (Math.abs(x) < 1.9 && z < 6.4 && z > -8.8) return true;
  const lh = WORLD.longhouse;
  if (Math.abs(x - lh.x) < lh.w * 0.5 + 0.5 && Math.abs(z - lh.z) < lh.d * 0.5 + 0.7) return true;
  for (const hut of HUTS) {
    const dx = x - hut.x;
    const dz = z - hut.z;
    if (dx * dx + dz * dz < (1.5 * hut.s) ** 2) return true;
  }
  const p = WORLD.palisade;
  const nearWallX = (Math.abs(x - p.minX) < 0.5 || Math.abs(x - p.maxX) < 0.5) && z > p.minZ - 0.5 && z < p.maxZ + 0.5;
  const nearWallZ = (Math.abs(z - p.minZ) < 0.5 || Math.abs(z - p.maxZ) < 0.5) && x > p.minX - 0.5 && x < p.maxX + 0.5;
  if (nearWallX || nearWallZ) return true;
  if (Math.abs(x) > 21 && h > 1.6) return true;
  if (h > 4.2) return true;
  const dxw = x - 2.8;
  const dzw = z + 3.2;
  if (dxw * dxw + dzw * dzw < 1.2) return true;
  return false;
}

export function createGrass(scene, opts = {}) {
  const {
    count = 16000,
    base = '#2f6a1e',
    tip = '#9ad64a',
    height = 0.42,
    width = 0.085,
    seed = 1,
    flowers = false,
    density = 1,
  } = opts;

  const geo = new THREE.InstancedBufferGeometry();
  const blade = bladeGeometry(width, height, flowers ? 2 : 3);
  geo.index = blade.index;
  geo.setAttribute('position', blade.getAttribute('position'));

  const offsets = new Float32Array(count * 3);
  const scales = new Float32Array(count);
  const yaws = new Float32Array(count);
  const phases = new Float32Array(count);
  const tints = new Float32Array(count);

  let placed = 0;
  let attempts = 0;
  while (placed < count && attempts < count * 12) {
    attempts++;
    const rx = hash2(attempts * 1.37 + seed * 91, seed * 13.1);
    const rz = hash2(seed * 7.7, attempts * 2.91 + seed * 41);
    const x = (rx - 0.5) * 66;
    const z = -26 + rz * 33.5;
    if (blocked(x, z)) continue;
    const h = terrainHeight(x, z);
    const slope = h > 2.2 ? 0.45 : 1;
    if (hash2(x * 13.7, z * 7.1) > slope * density) continue;
    offsets[placed * 3] = x;
    offsets[placed * 3 + 1] = h - 0.02;
    offsets[placed * 3 + 2] = z;
    const inside = Math.abs(x) < 14 && z < 6.2 && z > -12;
    scales[placed] = (inside ? 0.7 : 0.9) + hash2(x * 3.1, z * 5.3) * 0.7;
    yaws[placed] = hash2(x * 9.7, z * 1.3) * Math.PI * 2;
    phases[placed] = hash2(x * 0.7, z * 0.9) * Math.PI * 2;
    tints[placed] = hash2(x * 2.2 + 5, z * 4.4 + 3);
    placed++;
  }

  geo.instanceCount = placed;
  geo.setAttribute('aOffset', new THREE.InstancedBufferAttribute(offsets, 3));
  geo.setAttribute('aScale', new THREE.InstancedBufferAttribute(scales, 1));
  geo.setAttribute('aYaw', new THREE.InstancedBufferAttribute(yaws, 1));
  geo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phases, 1));
  geo.setAttribute('aTint', new THREE.InstancedBufferAttribute(tints, 1));

  const mat = new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    fog: true,
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        uTime: { value: 0 },
        uWind: { value: new THREE.Vector2(0.8, 0.35) },
        uBase: { value: new THREE.Color(base) },
        uTip: { value: new THREE.Color(tip) },
        uTipB: { value: new THREE.Color(flowers ? '#ffffff' : tip) },
        uLight: { value: new THREE.Color('#ffffff') },
        uLevel: { value: 1 },
        uFlower: { value: flowers ? 1 : 0 },
      },
    ]),
    vertexShader: `
      attribute vec3 aOffset;
      attribute float aScale;
      attribute float aYaw;
      attribute float aPhase;
      attribute float aTint;
      uniform float uTime;
      uniform vec2 uWind;
      varying float vH;
      varying float vTint;
      #include <fog_pars_vertex>
      void main() {
        vH = position.y / ${height.toFixed(3)};
        vTint = aTint;
        float c = cos(aYaw);
        float s = sin(aYaw);
        vec3 p = position;
        p.x *= aScale * 0.9;
        p.y *= aScale;
        vec3 rp = vec3(c * p.x - s * p.z, p.y, s * p.x + c * p.z);
        float gust = sin(uTime * 0.9 + aOffset.x * 0.18 + aOffset.z * 0.11) * 0.5 + 0.5;
        float sway = sin(uTime * 1.9 + aPhase + aOffset.x * 0.35 + aOffset.z * 0.2) * (0.35 + gust * 0.65)
          + sin(uTime * 3.3 + aPhase * 1.7) * 0.15;
        rp.xz += uWind * sway * vH * vH * 0.42 * aScale;
        vec3 world = aOffset + rp;
        vec4 mvPosition = viewMatrix * vec4(world, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader: `
      uniform vec3 uBase;
      uniform vec3 uTip;
      uniform vec3 uTipB;
      uniform vec3 uLight;
      uniform float uLevel;
      uniform float uFlower;
      varying float vH;
      varying float vTint;
      #include <fog_pars_fragment>
      void main() {
        vec3 tipCol = mix(uTip, uTipB, step(0.5, vTint));
        float k = uFlower > 0.5 ? smoothstep(0.55, 0.8, vH) : vH;
        vec3 col = mix(uBase, tipCol, k) * (0.82 + vTint * 0.36);
        float shade = uFlower > 0.5 ? 0.75 + k * 0.5 : 0.45 + vH * 0.75;
        col *= uLight * uLevel * shade;
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }
    `,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.receiveShadow = false;
  mesh.castShadow = false;
  scene.add(mesh);

  function update(time, look) {
    mat.uniforms.uTime.value = time;
    if (look) {
      mat.uniforms.uLight.value.copy(look.lightColor).lerp(new THREE.Color('#ffffff'), 0.35);
      mat.uniforms.uLevel.value = 0.28 + look.lightLevel * 0.8;
    }
  }

  return { mesh, update, count: placed };
}
