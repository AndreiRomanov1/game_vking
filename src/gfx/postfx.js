import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';

export const QUALITY_LEVELS = ['low', 'medium', 'high', 'ultra'];
export const QUALITY_LABELS = { low: 'низкая', medium: 'средняя', high: 'высокая', ultra: 'ультра' };

const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uVignette: { value: 0.32 },
    uGrain: { value: 0.014 },
    uSaturation: { value: 1.12 },
    uContrast: { value: 1.06 },
    uAberration: { value: 0.0011 },
    uWarmth: { value: 0 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uVignette;
    uniform float uGrain;
    uniform float uSaturation;
    uniform float uContrast;
    uniform float uAberration;
    uniform float uWarmth;
    varying vec2 vUv;

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
    }

    void main() {
      vec2 d = vUv - 0.5;
      float r2 = dot(d, d);
      vec2 off = d * uAberration * (0.4 + r2 * 6.0);
      vec3 col;
      col.r = texture2D(tDiffuse, vUv + off).r;
      col.g = texture2D(tDiffuse, vUv).g;
      col.b = texture2D(tDiffuse, vUv - off).b;

      float luma = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col = mix(vec3(luma), col, uSaturation);
      col = (col - 0.18) * uContrast + 0.18;
      col *= vec3(1.0 + uWarmth * 0.12, 1.0 + uWarmth * 0.03, 1.0 - uWarmth * 0.1);

      float vig = smoothstep(0.95, 0.2, r2 * 1.7);
      col *= mix(1.0 - uVignette, 1.0, vig);

      float g = hash(vUv * 1024.0 + fract(uTime) * 100.0) - 0.5;
      col += g * uGrain * (0.25 + luma);

      gl_FragColor = vec4(max(col, vec3(0.0)), 1.0);
    }
  `,
};

export function createPostFx(renderer, scene, camera, opts = {}) {
  const size = new THREE.Vector2();
  renderer.getDrawingBufferSize(size);
  const target = new THREE.WebGLRenderTarget(size.x, size.y, {
    type: THREE.HalfFloatType,
    samples: 4,
  });
  const composer = new EffectComposer(renderer, target);
  const renderPass = new RenderPass(scene, camera);
  const gtao = new GTAOPass(scene, camera, size.x, size.y);
  gtao.output = GTAOPass.OUTPUT.Default;
  gtao.blendIntensity = 0.62;
  gtao.updateGtaoMaterial({
    radius: 0.7,
    distanceExponent: 1.4,
    thickness: 0.9,
    scale: 1.0,
    samples: 12,
    distanceFallOff: 1.0,
    screenSpaceRadius: false,
  });
  gtao.updatePdMaterial({
    lumaPhi: 10,
    depthPhi: 2,
    normalPhi: 3,
    radius: 4,
    radiusExponent: 1,
    rings: 2,
    samples: 12,
  });
  const bloom = new UnrealBloomPass(size.clone(), 0.28, 0.6, 0.86);
  const grade = new ShaderPass(GradeShader);
  const output = new OutputPass();
  composer.addPass(renderPass);
  composer.addPass(gtao);
  composer.addPass(bloom);
  composer.addPass(grade);
  composer.addPass(output);

  const maxDpr = window.devicePixelRatio || 1;
  const state = {
    level: 2,
    auto: true,
    ema: 1 / 60,
    settle: 4,
    time: 0,
  };

  function pixelRatioFor(level) {
    if (level === 0) return Math.min(1, maxDpr);
    if (level === 1) return Math.min(1.25, maxDpr);
    if (level === 2) return Math.min(1.5, maxDpr);
    return Math.min(2, maxDpr);
  }

  function applyLevel() {
    const l = state.level;
    gtao.enabled = l >= 2;
    bloom.enabled = l >= 1;
    bloom.strength = l >= 3 ? 0.34 : 0.26;
    grade.enabled = true;
    grade.uniforms.uGrain.value = l >= 2 ? 0.014 : 0.008;
    renderer.shadowMap.enabled = true;
    resize();
    opts.onLevel?.(l);
  }

  function setLevel(level, manual = false) {
    state.level = THREE.MathUtils.clamp(level, 0, 3);
    if (manual) state.auto = false;
    state.settle = 3;
    applyLevel();
    opts.onChange?.(QUALITY_LEVELS[state.level]);
  }

  function cycle() {
    setLevel((state.level + 1) % 4, true);
  }

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const pr = pixelRatioFor(state.level);
    renderer.setPixelRatio(pr);
    renderer.setSize(w, h, false);
    composer.setPixelRatio(pr);
    composer.setSize(w, h);
    camera.aspect = w / Math.max(1, h);
    camera.updateProjectionMatrix();
  }

  function render(dt) {
    state.time += dt;
    grade.uniforms.uTime.value = state.time;
    if (state.auto) {
      state.ema += (dt - state.ema) * 0.08;
      state.settle -= dt;
      if (state.settle <= 0) {
        if (state.ema > 0.042 && state.level > 0) {
          setLevel(state.level - 1);
        } else if (state.ema < 0.012 && state.level < 2) {
          setLevel(state.level + 1);
        }
      }
    }
    if (state.level === 0) {
      renderer.render(scene, camera);
    } else {
      composer.render(dt);
    }
  }

  function setMood(look) {
    grade.uniforms.uWarmth.value = look ? look.warmth : 0;
    grade.uniforms.uVignette.value = 0.3 + (look ? look.night * 0.14 : 0);
  }

  const q = new URLSearchParams(location.search).get('q');
  const idx = QUALITY_LEVELS.indexOf(q);
  if (idx >= 0) {
    state.level = idx;
    state.auto = false;
  }
  applyLevel();

  return {
    render,
    resize,
    setLevel,
    cycle,
    setMood,
    get level() {
      return QUALITY_LEVELS[state.level];
    },
    get auto() {
      return state.auto;
    },
  };
}
