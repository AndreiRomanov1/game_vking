import * as THREE from 'three';
import { WORLD } from '../config.js';
import { fbm, terrainHeight } from './map.js';

export function createTerrain(scene) {
  const w = 86;
  const d = 92;
  const seg = 96;
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
      col.set(0x2f6d62);
    } else if (z > WORLD.seaZ - 1.8) {
      col.setRGB(0.92 - n * 0.08, 0.72 - n * 0.05, 0.42);
      if (z > WORLD.seaZ - 0.7) col.lerp(new THREE.Color(0xc4894a), 0.45);
    } else if (z > WORLD.beachZ0 - 0.4) {
      const t = THREE.MathUtils.clamp((WORLD.seaZ - 1.2 - z) / 7, 0, 1);
      col.setRGB(0.94, 0.76, 0.45).lerp(new THREE.Color(0x5dcc55), t * 0.55);
      col.offsetHSL(0, 0, (n - 0.5) * 0.08);
    } else if (Math.abs(x) < 14 && z < 6.2 && z > -12) {
      col.setRGB(0.42 + n * 0.1, 0.66 + n * 0.1, 0.22);
      if (Math.abs(x) < 1.6 && z < 5.5 && z > -8) {
        col.setRGB(0.72, 0.52, 0.28);
      }
    } else if (h > 2.2) {
      col.setRGB(0.55 + n * 0.1, 0.58, 0.5);
    } else {
      col.setRGB(0.18 + n * 0.1, 0.58 + n * 0.16, 0.16);
      col.offsetHSL((n - 0.5) * 0.04, 0.05, (n - 0.5) * 0.06);
    }
    colors[i * 3] = col.r;
    colors[i * 3 + 1] = col.g;
    colors[i * 3 + 2] = col.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const mat = new THREE.MeshLambertMaterial({
    vertexColors: true,
    flatShading: false,
  });
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
  const geo = new THREE.PlaneGeometry(78, 3.6, 40, 4);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color('#f3fff8') },
    },
    vertexShader: `
      varying vec2 vUv;
      uniform float uTime;
      void main() {
        vUv = uv;
        vec3 p = position;
        p.y += sin(position.x * 0.6 + uTime * 2.4) * 0.05;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      uniform float uTime;
      uniform vec3 uColor;
      void main() {
        float w = sin(vUv.x * 28.0 + uTime * 3.0) * 0.5 + 0.5;
        float band = smoothstep(0.0, 0.35, vUv.y) * smoothstep(1.0, 0.45, vUv.y);
        float a = band * (0.22 + 0.45 * w) * (0.55 + 0.45 * sin(vUv.x * 10.0 - uTime));
        gl_FragColor = vec4(uColor, a);
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
  const rockMat = new THREE.MeshLambertMaterial({ color: 0x8d7b68, flatShading: true });
  const moss = new THREE.MeshLambertMaterial({ color: 0x4a8a3a, flatShading: true });
  for (const side of [-1, 1]) {
    for (let i = 0; i < 10; i++) {
      const z = -16 + i * 4.6;
      const x = side * (22 + (i % 3) * 1.4);
      const h = 2.2 + (i % 4) * 0.7 + (z < -6 ? 2 : 0);
      const m = new THREE.Mesh(new THREE.DodecahedronGeometry(1.4 + (i % 3) * 0.25, 0), i % 2 ? rockMat : moss);
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
