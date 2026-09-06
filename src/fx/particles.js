import * as THREE from 'three';
import { softParticle, smokeParticle } from '../gfx/textures.js';

const VERT = `
  attribute float aSize;
  attribute float aAlpha;
  attribute vec3 aColor;
  attribute float aRot;
  uniform float uScale;
  varying float vAlpha;
  varying vec3 vColor;
  varying float vRot;
  #include <fog_pars_vertex>
  void main() {
    vAlpha = aAlpha;
    vColor = aColor;
    vRot = aRot;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * uScale / max(-mvPosition.z, 0.2);
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;

const FRAG = `
  uniform sampler2D uMap;
  uniform float uFogMix;
  varying float vAlpha;
  varying vec3 vColor;
  varying float vRot;
  #include <fog_pars_fragment>
  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float c = cos(vRot);
    float s = sin(vRot);
    uv = vec2(c * uv.x - s * uv.y, s * uv.x + c * uv.y) + 0.5;
    vec4 tex = texture2D(uMap, uv);
    float a = tex.a * vAlpha;
    if (a < 0.004) discard;
    gl_FragColor = vec4(vColor * tex.rgb, a);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #ifdef USE_FOG
      float fogFactor = 1.0 - exp(-fogDensity * fogDensity * vFogDepth * vFogDepth);
      gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, fogFactor * uFogMix);
    #endif
  }
`;

const TYPES = {
  fire: { additive: true },
  ember: { additive: true },
  hit: { additive: true },
  spark: { additive: true },
  gold: { additive: true },
  smoke: { additive: false },
  splash: { additive: false },
  dust: { additive: false },
  debris: { additive: false },
};

function makeLayer(scene, capacity, additive) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(capacity * 3);
  const size = new Float32Array(capacity);
  const alpha = new Float32Array(capacity);
  const color = new Float32Array(capacity * 3);
  const rot = new Float32Array(capacity);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  geo.setAttribute('aAlpha', new THREE.BufferAttribute(alpha, 1));
  geo.setAttribute('aColor', new THREE.BufferAttribute(color, 3));
  geo.setAttribute('aRot', new THREE.BufferAttribute(rot, 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    fog: true,
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        uMap: { value: additive ? softParticle() : smokeParticle() },
        uScale: { value: 600 },
        uFogMix: { value: additive ? 0 : 1 },
      },
    ]),
    vertexShader: VERT,
    fragmentShader: FRAG,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  points.renderOrder = additive ? 6 : 5;
  scene.add(points);
  return { geo, mat, pos, size, alpha, color, rot, capacity, count: 0 };
}

export function createFx(scene) {
  const layers = {
    add: makeLayer(scene, 900, true),
    norm: makeLayer(scene, 700, false),
  };
  const particles = [];
  const wind = new THREE.Vector2(0.55, 0.2);
  let time = 0;
  let smokeTint = new THREE.Color(0.55, 0.52, 0.5);

  function spawn(type, x, y, z, o) {
    const layer = TYPES[type].additive ? layers.add : layers.norm;
    if (layer.count >= layer.capacity) return;
    layer.count++;
    particles.push({
      type,
      x,
      y,
      z,
      vx: o.vx || 0,
      vy: o.vy || 0,
      vz: o.vz || 0,
      life: o.life,
      maxLife: o.life,
      size: o.size,
      size1: o.size1 ?? o.size,
      rot: Math.random() * Math.PI * 2,
      rotV: o.rotV || 0,
      gravity: o.gravity || 0,
      drag: o.drag || 0,
      turb: o.turb || 0,
      seed: Math.random() * 100,
      c0: o.c0,
      c1: o.c1 || o.c0,
      a0: o.a0 ?? 1,
      additive: TYPES[type].additive,
    });
  }

  const C = (r, g, b) => [r, g, b];

  function burst(x, y, z, type, n = 8) {
    for (let i = 0; i < n; i++) {
      const ang = Math.random() * Math.PI * 2;
      switch (type) {
        case 'splash':
          spawn('splash', x, y, z, {
            vx: Math.cos(ang) * (0.6 + Math.random() * 2.2),
            vy: 1.2 + Math.random() * 2.8,
            vz: Math.sin(ang) * (0.6 + Math.random() * 2.2),
            life: 0.45 + Math.random() * 0.3,
            size: 0.22 + Math.random() * 0.3,
            size1: 0.5,
            gravity: -9,
            c0: C(0.92, 0.98, 1.0),
            a0: 0.85,
          });
          break;
        case 'hit':
          spawn('hit', x, y, z, {
            vx: Math.cos(ang) * (1 + Math.random() * 2.2),
            vy: 0.6 + Math.random() * 2,
            vz: Math.sin(ang) * (1 + Math.random() * 2.2),
            life: 0.28 + Math.random() * 0.12,
            size: 0.28 + Math.random() * 0.25,
            size1: 0.05,
            c0: C(2.4, 2.0, 1.2),
            c1: C(1.2, 0.5, 0.15),
          });
          if (i % 2 === 0) {
            spawn('spark', x, y, z, {
              vx: Math.cos(ang) * (3 + Math.random() * 4),
              vy: 2 + Math.random() * 4,
              vz: Math.sin(ang) * (3 + Math.random() * 4),
              life: 0.3 + Math.random() * 0.25,
              size: 0.09,
              size1: 0.03,
              gravity: -14,
              c0: C(3.0, 2.4, 1.4),
              c1: C(1.5, 0.6, 0.2),
            });
          }
          break;
        case 'smoke':
          spawn('smoke', x, y, z, {
            vx: (Math.random() - 0.5) * 0.4,
            vy: 0.7 + Math.random() * 0.6,
            vz: (Math.random() - 0.5) * 0.4,
            life: 1.8 + Math.random() * 1.4,
            size: 0.5 + Math.random() * 0.4,
            size1: 2.2 + Math.random() * 0.8,
            rotV: (Math.random() - 0.5) * 1.2,
            turb: 0.5,
            drag: 0.5,
            c0: C(0.42, 0.4, 0.4),
            c1: C(0.28, 0.27, 0.28),
            a0: 0.42,
          });
          break;
        case 'dust':
          spawn('dust', x, y, z, {
            vx: Math.cos(ang) * (0.4 + Math.random() * 1.2),
            vy: 0.3 + Math.random() * 0.8,
            vz: Math.sin(ang) * (0.4 + Math.random() * 1.2),
            life: 0.7 + Math.random() * 0.5,
            size: 0.35 + Math.random() * 0.3,
            size1: 1.1,
            drag: 1.5,
            c0: C(0.78, 0.66, 0.5),
            a0: 0.42,
          });
          break;
        case 'debris':
          spawn('debris', x, y, z, {
            vx: Math.cos(ang) * (1.5 + Math.random() * 3.5),
            vy: 2.5 + Math.random() * 5,
            vz: Math.sin(ang) * (1.5 + Math.random() * 3.5),
            life: 0.9 + Math.random() * 0.6,
            size: 0.14 + Math.random() * 0.16,
            size1: 0.12,
            rotV: (Math.random() - 0.5) * 14,
            gravity: -15,
            c0: C(0.42, 0.24, 0.12),
            c1: C(0.2, 0.1, 0.05),
          });
          break;
        case 'gold':
          spawn('gold', x, y, z, {
            vx: Math.cos(ang) * (0.5 + Math.random() * 1.2),
            vy: 1.5 + Math.random() * 2.2,
            vz: Math.sin(ang) * (0.5 + Math.random() * 1.2),
            life: 0.6 + Math.random() * 0.3,
            size: 0.16,
            size1: 0.04,
            gravity: -6,
            c0: C(3.0, 2.3, 0.8),
            c1: C(1.6, 1.0, 0.2),
          });
          break;
        case 'ember':
          spawn('ember', x, y, z, {
            vx: (Math.random() - 0.5) * 0.8,
            vy: 1.0 + Math.random() * 1.4,
            vz: (Math.random() - 0.5) * 0.8,
            life: 1.4 + Math.random() * 1.6,
            size: 0.07 + Math.random() * 0.07,
            size1: 0.03,
            turb: 1.4,
            c0: C(3.2, 1.7, 0.5),
            c1: C(1.4, 0.3, 0.05),
          });
          break;
        default:
          spawn('fire', x, y, z, {
            vx: (Math.random() - 0.5) * 0.7,
            vy: 1.4 + Math.random() * 1.8,
            vz: (Math.random() - 0.5) * 0.7,
            life: 0.5 + Math.random() * 0.4,
            size: 0.45 + Math.random() * 0.45,
            size1: 0.12,
            rotV: (Math.random() - 0.5) * 3,
            turb: 0.8,
            c0: C(2.6, 2.1, 1.1),
            c1: C(1.6, 0.35, 0.05),
            a0: 0.9,
          });
      }
    }
  }

  function emitFire(x, y, z, dt, intensity = 1) {
    if (Math.random() < dt * 22 * intensity) burst(x, y, z, 'fire', 1);
    if (Math.random() < dt * 9 * intensity) burst(x, y + 0.4, z, 'smoke', 1);
    if (Math.random() < dt * 7 * intensity) burst(x, y + 0.2, z, 'ember', 1);
  }

  function emitSmoke(x, y, z, dt, rate = 3) {
    if (Math.random() < dt * rate) {
      spawn('smoke', x, y, z, {
        vx: (Math.random() - 0.5) * 0.2,
        vy: 0.5 + Math.random() * 0.35,
        vz: (Math.random() - 0.5) * 0.2,
        life: 2.6 + Math.random() * 1.6,
        size: 0.3 + Math.random() * 0.2,
        size1: 1.6,
        rotV: (Math.random() - 0.5) * 0.8,
        turb: 0.35,
        drag: 0.4,
        c0: C(0.7, 0.68, 0.68),
        c1: C(0.5, 0.5, 0.52),
        a0: 0.22,
      });
    }
  }

  function setLook(look) {
    if (!look) return;
    smokeTint.copy(look.lightColor).lerp(new THREE.Color(1, 1, 1), 0.4).multiplyScalar(0.3 + look.lightLevel * 0.9);
  }

  function setViewport(heightPx, fovDeg) {
    const scale = heightPx / (2 * Math.tan(THREE.MathUtils.degToRad(fovDeg) * 0.5));
    layers.add.mat.uniforms.uScale.value = scale;
    layers.norm.mat.uniforms.uScale.value = scale;
  }

  function update(dt) {
    time += dt;
    layers.add.count = 0;
    layers.norm.count = 0;
    let ia = 0;
    let inn = 0;
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        particles[i] = particles[particles.length - 1];
        particles.pop();
        continue;
      }
      const t = 1 - p.life / p.maxLife;
      if (p.turb) {
        p.vx += Math.sin(time * 3.1 + p.seed) * p.turb * dt * 1.6;
        p.vz += Math.cos(time * 2.7 + p.seed * 1.3) * p.turb * dt * 1.6;
      }
      if (p.gravity) p.vy += p.gravity * dt;
      if (p.drag) {
        const k = Math.max(0, 1 - p.drag * dt);
        p.vx *= k;
        p.vz *= k;
      }
      if (p.type === 'smoke') {
        p.vx += wind.x * dt * 0.5;
        p.vz += wind.y * dt * 0.5;
      }
      if (p.type === 'debris' && p.y < 0.35 && p.vy < 0) {
        p.vy = -p.vy * 0.3;
        p.vx *= 0.6;
        p.vz *= 0.6;
        p.rotV *= 0.5;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.rot += p.rotV * dt;

      const layer = p.additive ? layers.add : layers.norm;
      const k = p.additive ? ia++ : inn++;
      if (k >= layer.capacity) continue;
      layer.count++;
      layer.pos[k * 3] = p.x;
      layer.pos[k * 3 + 1] = p.y;
      layer.pos[k * 3 + 2] = p.z;
      const sizeT = p.type === 'fire' ? Math.sin(Math.min(1, t * 1.25) * Math.PI) : t;
      layer.size[k] = p.type === 'fire' ? p.size * (0.4 + sizeT) : THREE.MathUtils.lerp(p.size, p.size1, t);
      let alpha;
      if (p.type === 'smoke') alpha = p.a0 * Math.sin(Math.min(1, t) * Math.PI) ** 0.7;
      else if (p.type === 'ember') alpha = (0.6 + 0.4 * Math.sin(time * 18 + p.seed)) * (1 - t * t);
      else if (p.type === 'debris') alpha = t < 0.8 ? 1 : 1 - (t - 0.8) / 0.2;
      else alpha = p.a0 * (1 - t * t);
      layer.alpha[k] = alpha;
      const ct = t;
      let r = p.c0[0] + (p.c1[0] - p.c0[0]) * ct;
      let g = p.c0[1] + (p.c1[1] - p.c0[1]) * ct;
      let b = p.c0[2] + (p.c1[2] - p.c0[2]) * ct;
      if (!p.additive && p.type !== 'debris') {
        r *= smokeTint.r * 1.4;
        g *= smokeTint.g * 1.4;
        b *= smokeTint.b * 1.4;
      }
      layer.color[k * 3] = r;
      layer.color[k * 3 + 1] = g;
      layer.color[k * 3 + 2] = b;
      layer.rot[k] = p.rot;
    }
    for (const layer of [layers.add, layers.norm]) {
      layer.geo.setDrawRange(0, layer.count);
      layer.geo.attributes.position.needsUpdate = true;
      layer.geo.attributes.aSize.needsUpdate = true;
      layer.geo.attributes.aAlpha.needsUpdate = true;
      layer.geo.attributes.aColor.needsUpdate = true;
      layer.geo.attributes.aRot.needsUpdate = true;
    }
  }

  return { burst, emitFire, emitSmoke, update, setLook, setViewport, wind };
}
