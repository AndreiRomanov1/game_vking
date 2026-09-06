import * as THREE from 'three';
import { WORLD } from '../config.js';

export function createWater(scene) {
  const geo = new THREE.PlaneGeometry(110, 70, 80, 50);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    toneMapped: false,
    uniforms: {
      uTime: { value: 0 },
      uDeep: { value: new THREE.Color('#156e7a') },
      uShallow: { value: new THREE.Color('#3ad4c6') },
      uFoam: { value: new THREE.Color('#e8fff6') },
      uSunDir: { value: new THREE.Vector3(0.3, 0.8, 0.4).normalize() },
      uSunColor: { value: new THREE.Color('#fff4c8') },
      uShoreZ: { value: WORLD.seaZ },
    },
    vertexShader: `
      uniform float uTime;
      varying vec3 vWorld;
      varying float vWave;
      void main() {
        vec3 p = position;
        float t = uTime;
        float w1 = sin(p.x * 0.16 + t * 1.05);
        float w2 = sin(p.z * 0.13 + t * 0.72);
        float w3 = sin((p.x * 0.21 + p.z * 0.17) + t * 1.4);
        float h = w1 * 0.22 + w2 * 0.16 + w3 * 0.07;
        p.y += h;
        vWave = h;
        vec4 wp = modelMatrix * vec4(p, 1.0);
        vWorld = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform vec3 uDeep;
      uniform vec3 uShallow;
      uniform vec3 uFoam;
      uniform vec3 uSunDir;
      uniform vec3 uSunColor;
      uniform float uShoreZ;
      uniform float uTime;
      varying vec3 vWorld;
      varying float vWave;
      void main() {
        if (vWorld.z < uShoreZ - 0.35) discard;
        float shore = smoothstep(uShoreZ + 14.0, uShoreZ + 0.2, vWorld.z);
        vec3 col = mix(uDeep, uShallow, shore);
        float bands = 0.5 + 0.5 * sin(vWorld.x * 0.22 + vWorld.z * 0.18 + uTime * 0.6);
        col = mix(col, col * 1.12, bands * 0.25);
        float foamLine = smoothstep(uShoreZ + 2.8, uShoreZ - 0.1, vWorld.z);
        foamLine *= 1.0 - smoothstep(uShoreZ + 0.4, uShoreZ - 1.4, vWorld.z);
        float scallop = 0.55 + 0.45 * sin(vWorld.x * 1.6 + uTime * 2.2);
        col = mix(col, uFoam, foamLine * scallop);
        float caps = smoothstep(0.18, 0.32, vWave);
        col = mix(col, uFoam, caps * 0.35);
        float glint = pow(max(0.0, 0.55 + 0.45 * sin(vWorld.x * 0.9 - uTime * 1.8)), 12.0);
        col += uSunColor * glint * 0.12 * (1.0 - shore * 0.5);
        float alpha = mix(0.94, 0.82, shore);
        gl_FragColor = vec4(col, alpha);
      }
    `,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(0, -0.06, WORLD.seaZ + 20);
  mesh.renderOrder = 1;
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
}
