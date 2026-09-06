import * as THREE from 'three';
import { MATCH_DAY_SECONDS } from './config.js';
import { glow } from './gfx/textures.js';

const SKY_VERT = `
  varying vec3 vDir;
  void main() {
    vDir = position;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
  }
`;

const SKY_FRAG = `
  uniform vec3 uTop;
  uniform vec3 uMid;
  uniform vec3 uHorizon;
  uniform vec3 uSunDir;
  uniform vec3 uSunColor;
  uniform vec3 uMoonDir;
  uniform float uTime;
  uniform float uNight;
  uniform float uSunUp;
  uniform float uCloud;
  varying vec3 vDir;

  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }
  float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    float a = hash21(i);
    float b = hash21(i + vec2(1.0, 0.0));
    float c = hash21(i + vec2(0.0, 1.0));
    float d = hash21(i + vec2(1.0, 1.0));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }
  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
    for (int i = 0; i < 5; i++) {
      v += a * vnoise(p);
      p = m * p;
      a *= 0.5;
    }
    return v;
  }

  void main() {
    vec3 n = normalize(vDir);
    float t = clamp(n.y, 0.0, 1.0);
    vec3 col = mix(uHorizon, uMid, smoothstep(0.0, 0.22, t));
    col = mix(col, uTop, smoothstep(0.18, 0.85, t));
    if (n.y < 0.0) col = uHorizon * (1.0 + n.y * 0.6);

    float sd = max(dot(n, uSunDir), 0.0);
    float md = max(dot(n, uMoonDir), 0.0);

    // clouds
    float cov = 0.0;
    vec3 cloudCol = vec3(1.0);
    if (n.y > 0.005) {
      vec2 cuv = n.xz / (n.y + 0.14) * 1.35;
      cuv += vec2(uTime * 0.011, uTime * 0.0045);
      float c = fbm(cuv);
      float c2 = fbm(cuv * 2.7 + 13.1 - uTime * 0.02);
      float dens = c * 0.75 + c2 * 0.25;
      cov = smoothstep(0.58 - uCloud * 0.2, 0.8, dens);
      cov *= smoothstep(0.0, 0.2, n.y);
      float shade = smoothstep(0.45, 0.95, dens);
      vec3 lit = mix(vec3(1.0, 0.98, 0.94), uSunColor, 0.45) * (0.85 + 0.55 * pow(sd, 3.0));
      vec3 shadow = mix(uMid, vec3(0.42, 0.47, 0.58), 0.55);
      cloudCol = mix(lit, shadow, shade * 0.85);
      cloudCol *= mix(1.0, 0.10, uNight);
      cloudCol += vec3(0.5, 0.6, 0.8) * pow(md, 6.0) * uNight * 0.4;
    }

    // sun glow + disc (occluded by clouds)
    float clear = 1.0 - cov * 0.92;
    col += uSunColor * (pow(sd, 5.0) * 0.16 + pow(sd, 48.0) * 0.55) * uSunUp;
    float disc = smoothstep(0.99925, 0.99965, sd) * uSunUp;
    col += uSunColor * disc * 5.5 * clear;

    // horizon warmth around the sun azimuth
    vec3 hn = normalize(vec3(n.x, 0.0, n.z));
    vec3 hs = normalize(vec3(uSunDir.x, 0.0, uSunDir.z));
    float az = max(dot(hn, hs), 0.0);
    col += uSunColor * pow(1.0 - t, 7.0) * az * 0.35 * (0.4 + 0.6 * (1.0 - uSunUp));

    // stars
    vec3 sp = n * 110.0;
    vec3 cell = floor(sp);
    vec3 f = fract(sp);
    float rnd = hash21(cell.xy * 1.31 + cell.z * 3.77);
    vec3 pt = vec3(hash21(cell.xy + cell.z), hash21(cell.yz + cell.x * 2.1), hash21(cell.zx + cell.y * 1.7));
    float d = length(f - pt);
    float star = smoothstep(0.09, 0.0, d) * step(0.78, rnd);
    float twinkle = 0.55 + 0.45 * sin(uTime * 2.6 + rnd * 60.0);
    col += vec3(0.85, 0.92, 1.0) * star * twinkle * uNight * (1.0 - cov) * smoothstep(0.02, 0.2, n.y) * 2.2;
    // milky band
    float band = exp(-pow(dot(n, normalize(vec3(0.5, 0.35, -0.8))), 2.0) * 9.0);
    col += vec3(0.25, 0.3, 0.45) * band * uNight * (1.0 - cov) * 0.25 * smoothstep(0.0, 0.25, n.y);

    // moon
    float moonDisc = smoothstep(0.99905, 0.99955, md);
    col += vec3(0.78, 0.85, 1.0) * (moonDisc * 2.6 + pow(md, 32.0) * 0.28 + pow(md, 6.0) * 0.06) * uNight * (1.0 - cov * 0.85);

    col = mix(col, cloudCol, cov * 0.94);

    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export function createDayCycle(scene, renderer) {
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const hemi = new THREE.HemisphereLight(0x9ed7ff, 0x4a7a32, 0.75);
  scene.add(hemi);
  const amb = new THREE.AmbientLight(0xfff3d4, 0.2);
  scene.add(amb);

  const sun = new THREE.DirectionalLight(0xfff1c4, 2.6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 2;
  sun.shadow.camera.far = 110;
  sun.shadow.camera.left = -40;
  sun.shadow.camera.right = 40;
  sun.shadow.camera.top = 32;
  sun.shadow.camera.bottom = -38;
  sun.shadow.bias = -0.0003;
  sun.shadow.normalBias = 0.035;
  scene.add(sun);
  scene.add(sun.target);
  sun.target.position.set(0, 0, 2);

  const moon = new THREE.DirectionalLight(0x8fb7ff, 0);
  scene.add(moon);
  const fill = new THREE.DirectionalLight(0xffd9a8, 0.35);
  fill.position.set(-20, 12, 30);
  scene.add(fill);

  const moonDir = new THREE.Vector3(-0.55, 0.62, -0.4).normalize();

  const skyGeo = new THREE.SphereGeometry(230, 48, 28);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      uTop: { value: new THREE.Color('#5ec8ff') },
      uMid: { value: new THREE.Color('#c4ecff') },
      uHorizon: { value: new THREE.Color('#fff1c2') },
      uSunDir: { value: new THREE.Vector3(0.2, 0.8, 0.3).normalize() },
      uSunColor: { value: new THREE.Color('#fff4c4') },
      uMoonDir: { value: moonDir.clone() },
      uTime: { value: 0 },
      uNight: { value: 0 },
      uSunUp: { value: 1 },
      uCloud: { value: 0.45 },
    },
    vertexShader: SKY_VERT,
    fragmentShader: SKY_FRAG,
  });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  sky.frustumCulled = false;
  sky.renderOrder = -10;
  scene.add(sky);

  const sunGlow = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glow(),
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: false,
      opacity: 0.85,
    }),
  );
  sunGlow.scale.set(60, 60, 1);
  scene.add(sunGlow);

  scene.fog = new THREE.FogExp2(0xb8dfff, 0.0068);

  const pal = {
    dayTop: new THREE.Color('#2f8fe0'),
    dayMid: new THREE.Color('#9dd6f7'),
    dayHor: new THREE.Color('#d6e9f2'),
    goldTop: new THREE.Color('#2f6fc4'),
    goldMid: new THREE.Color('#f3b877'),
    goldHor: new THREE.Color('#ff9a5a'),
    setTop: new THREE.Color('#1c2a6a'),
    setMid: new THREE.Color('#e85a48'),
    setHor: new THREE.Color('#ffb070'),
    nightTop: new THREE.Color('#03061a'),
    nightMid: new THREE.Color('#0d1540'),
    nightHor: new THREE.Color('#231a3a'),
  };

  const torchLights = [];

  function addTorchLight(x, y, z) {
    if (torchLights.length >= 6) return null;
    const l = new THREE.PointLight(0xff8a3a, 0, 15, 1.8);
    l.position.set(x, y, z);
    l.castShadow = false;
    scene.add(l);
    torchLights.push(l);
    return l;
  }

  const look = {
    t: 0,
    phase: 'День',
    torchT: 0,
    sunDir: new THREE.Vector3(),
    sunColor: new THREE.Color(),
    skyTop: new THREE.Color(),
    skyHorizon: new THREE.Color(),
    waterDeep: new THREE.Color(),
    waterShallow: new THREE.Color(),
    foam: new THREE.Color(),
    lightColor: new THREE.Color(),
    lightLevel: 1,
    night: 0,
    sunUp: 1,
    warmth: 0,
    k3: 0,
  };

  const tmpA = new THREE.Color();
  const tmpB = new THREE.Color();
  const tmpC = new THREE.Color();

  function update(matchTime, fireBoost = 0, anim = matchTime) {
    const t = THREE.MathUtils.clamp(matchTime / MATCH_DAY_SECONDS, 0, 1.15);
    const u = Math.min(1, t);

    let k1 = 0;
    let k2 = 0;
    let k3 = 0;
    if (u < 0.28) {
      k1 = 0;
    } else if (u < 0.5) {
      k1 = (u - 0.28) / 0.22;
    } else if (u < 0.72) {
      k1 = 1;
      k2 = (u - 0.5) / 0.22;
    } else {
      k1 = 1;
      k2 = 1;
      k3 = Math.min(1, (u - 0.72) / 0.28);
    }
    const nightS = k3 * k3 * (3 - 2 * k3);

    const top = tmpA.copy(pal.dayTop).lerp(pal.goldTop, k1).lerp(pal.setTop, k2).lerp(pal.nightTop, k3);
    const mid = tmpB.copy(pal.dayMid).lerp(pal.goldMid, k1).lerp(pal.setMid, k2).lerp(pal.nightMid, k3);
    const hor = tmpC.copy(pal.dayHor).lerp(pal.goldHor, k1).lerp(pal.setHor, k2).lerp(pal.nightHor, k3);

    skyMat.uniforms.uTop.value.copy(top);
    skyMat.uniforms.uMid.value.copy(mid);
    skyMat.uniforms.uHorizon.value.copy(hor);
    skyMat.uniforms.uTime.value = anim;
    skyMat.uniforms.uNight.value = nightS;

    const sunAngle = THREE.MathUtils.lerp(0.92, -0.28, Math.min(1, u * 1.05));
    const sunDir = look.sunDir.set(
      Math.sin(0.55) * Math.cos(sunAngle),
      Math.sin(sunAngle),
      Math.cos(0.55) * Math.cos(sunAngle),
    ).normalize();
    skyMat.uniforms.uSunDir.value.copy(sunDir);
    const sunCol = look.sunColor
      .set('#fff6d8')
      .lerp(new THREE.Color('#ffb060'), k1 * 0.6 + k2 * 0.4)
      .lerp(new THREE.Color('#ff6a32'), k2);
    skyMat.uniforms.uSunColor.value.copy(sunCol);
    const sunUp = THREE.MathUtils.clamp(sunDir.y * 6 + 0.35, 0, 1);
    skyMat.uniforms.uSunUp.value = sunUp;
    skyMat.uniforms.uCloud.value = 0.42 + k1 * 0.15;

    sun.position.copy(sunDir).multiplyScalar(46);
    sun.color.copy(sunCol);
    sun.intensity = 0.12 + Math.max(0, sunDir.y) * 2.8;
    renderer.toneMappingExposure = 1.08 - k2 * 0.1 - k3 * 0.08;

    hemi.color.copy(top).lerp(new THREE.Color('#9ecbff'), 0.3);
    hemi.color.lerp(new THREE.Color('#5a74b8'), nightS);
    hemi.groundColor.set(0x4c7a32).lerp(new THREE.Color(0x1a1a28), nightS);
    hemi.intensity = 0.85 - k2 * 0.25 - k3 * 0.38;
    amb.color.set(0xfff1d0).lerp(new THREE.Color(0x4a5c98), nightS);
    amb.intensity = 0.24 - k3 * 0.04 + fireBoost * 0.08;
    fill.intensity = 0.32 * (1 - k3 * 0.8);
    fill.color.copy(sunCol).lerp(new THREE.Color('#ffffff'), 0.5);

    moon.position.copy(moonDir).multiplyScalar(40);
    moon.intensity = nightS * 1.1;
    moon.color.set(0xa8c8ff);

    sunGlow.position.copy(sunDir).multiplyScalar(150);
    sunGlow.visible = sunUp > 0.02;
    sunGlow.material.opacity = 0.75 * sunUp;
    sunGlow.material.color.copy(sunCol);
    sunGlow.scale.setScalar(55 + k1 * 30);

    const fogCol = hor.clone().lerp(mid, 0.4);
    scene.fog.color.copy(fogCol);
    scene.fog.density = 0.0062 + k3 * 0.0035 + fireBoost * 0.0015;
    renderer.setClearColor(fogCol, 1);

    const torchT = THREE.MathUtils.clamp((u - 0.52) / 0.18, 0, 1);
    const torchSmooth = torchT * torchT * (3 - 2 * torchT);
    for (let i = 0; i < torchLights.length; i++) {
      const flicker = 0.85 + Math.sin(anim * 11 + i * 1.7) * 0.1 + Math.sin(anim * 23 + i) * 0.05;
      torchLights[i].intensity = torchSmooth * 4.2 * flicker + fireBoost * 0.2;
    }

    look.t = u;
    look.phase = u < 0.28 ? 'День' : u < 0.5 ? 'Золотой час' : u < 0.72 ? 'Закат' : 'Ночь';
    look.torchT = torchSmooth;
    look.skyTop.copy(top);
    look.skyHorizon.copy(hor);
    look.waterDeep.set('#0f5f78').lerp(new THREE.Color('#0a2e4a'), k2).lerp(new THREE.Color('#040d1c'), k3);
    look.waterShallow.set('#2cb8b8').lerp(new THREE.Color('#3a7a9a'), k2).lerp(new THREE.Color('#0f2438'), k3);
    look.foam.set('#eefff8').lerp(new THREE.Color('#7a8aa8'), k3);
    look.lightColor.copy(sunCol).lerp(new THREE.Color('#6a86c8'), nightS);
    look.lightLevel = 0.25 + 0.75 * Math.max(0, sunDir.y) * (1 - nightS) + nightS * 0.16;
    look.night = nightS;
    look.sunUp = sunUp;
    look.warmth = k1 * 0.5 + k2 * 0.5 - nightS * 0.6;
    look.k3 = k3;
    return look;
  }

  return { update, addTorchLight, sun, sky, look };
}
