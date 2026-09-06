import * as THREE from 'three';
import { MATCH_DAY_SECONDS } from './config.js';

export function createDayCycle(scene, renderer) {
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const hemi = new THREE.HemisphereLight(0x9ed7ff, 0x4a7a32, 0.85);
  scene.add(hemi);
  const amb = new THREE.AmbientLight(0xfff3d4, 0.28);
  scene.add(amb);

  const sun = new THREE.DirectionalLight(0xfff1c4, 2.35);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 2;
  sun.shadow.camera.far = 90;
  sun.shadow.camera.left = -38;
  sun.shadow.camera.right = 38;
  sun.shadow.camera.top = 30;
  sun.shadow.camera.bottom = -36;
  sun.shadow.bias = -0.00035;
  sun.shadow.normalBias = 0.04;
  scene.add(sun);
  scene.add(sun.target);
  sun.target.position.set(0, 0, 2);

  const moon = new THREE.DirectionalLight(0x8fb7ff, 0);
  scene.add(moon);

  const skyGeo = new THREE.SphereGeometry(220, 32, 20);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    toneMapped: false,
    uniforms: {
      uTop: { value: new THREE.Color('#5ec8ff') },
      uMid: { value: new THREE.Color('#c4ecff') },
      uHorizon: { value: new THREE.Color('#fff1c2') },
      uSunDir: { value: new THREE.Vector3(0.2, 0.8, 0.3).normalize() },
      uSunColor: { value: new THREE.Color('#fff4c4') },
      uSunSize: { value: 0.04 },
    },
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uTop;
      uniform vec3 uMid;
      uniform vec3 uHorizon;
      uniform vec3 uSunDir;
      uniform vec3 uSunColor;
      uniform float uSunSize;
      varying vec3 vDir;
      void main() {
        vec3 n = normalize(vDir);
        float h = clamp(n.y * 0.5 + 0.5, 0.0, 1.0);
        vec3 col = mix(uHorizon, uMid, smoothstep(0.0, 0.45, h));
        col = mix(col, uTop, smoothstep(0.4, 1.0, h));
        float sun = pow(max(0.0, dot(n, normalize(uSunDir))), 48.0);
        float disc = smoothstep(uSunSize, uSunSize * 0.35, 1.0 - max(0.0, dot(n, normalize(uSunDir))));
        col += uSunColor * sun * 0.55;
        col += uSunColor * disc * 1.2;
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  scene.add(sky);

  const sunBall = new THREE.Mesh(
    new THREE.SphereGeometry(3.2, 16, 16),
    new THREE.MeshBasicMaterial({ color: 0xfff2a8, fog: false }),
  );
  scene.add(sunBall);
  const moonBall = new THREE.Mesh(
    new THREE.SphereGeometry(2.2, 16, 16),
    new THREE.MeshBasicMaterial({ color: 0xe8f0ff, fog: false }),
  );
  scene.add(moonBall);

  scene.fog = new THREE.FogExp2(0xb8dfff, 0.0085);

  const pal = {
    dayTop: new THREE.Color('#3db7ff'),
    dayMid: new THREE.Color('#b8e9ff'),
    dayHor: new THREE.Color('#fff0b8'),
    goldTop: new THREE.Color('#3a8ad9'),
    goldMid: new THREE.Color('#ffc07a'),
    goldHor: new THREE.Color('#ff8a4a'),
    setTop: new THREE.Color('#2a3a88'),
    setMid: new THREE.Color('#ff6a4a'),
    setHor: new THREE.Color('#ffb070'),
    nightTop: new THREE.Color('#070b22'),
    nightMid: new THREE.Color('#1a2458'),
    nightHor: new THREE.Color('#3a2a48'),
  };

  const torchLights = [];

  function addTorchLight(x, y, z) {
    if (torchLights.length >= 6) return null;
    const l = new THREE.PointLight(0xff8a3a, 0, 16, 1.7);
    l.position.set(x, y, z);
    l.castShadow = false;
    scene.add(l);
    torchLights.push(l);
    return l;
  }

  function update(matchTime, fireBoost = 0) {
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

    const top = pal.dayTop
      .clone()
      .lerp(pal.goldTop, k1)
      .lerp(pal.setTop, k2)
      .lerp(pal.nightTop, k3);
    const mid = pal.dayMid
      .clone()
      .lerp(pal.goldMid, k1)
      .lerp(pal.setMid, k2)
      .lerp(pal.nightMid, k3);
    const hor = pal.dayHor
      .clone()
      .lerp(pal.goldHor, k1)
      .lerp(pal.setHor, k2)
      .lerp(pal.nightHor, k3);

    skyMat.uniforms.uTop.value.copy(top);
    skyMat.uniforms.uMid.value.copy(mid);
    skyMat.uniforms.uHorizon.value.copy(hor);

    const sunAngle = THREE.MathUtils.lerp(1.05, -0.28, Math.min(1, u * 1.05));
    const sunDir = new THREE.Vector3(
      Math.sin(0.55) * Math.cos(sunAngle),
      Math.sin(sunAngle),
      Math.cos(0.55) * Math.cos(sunAngle),
    ).normalize();
    skyMat.uniforms.uSunDir.value.copy(sunDir);
    const sunCol = new THREE.Color('#fff6c8')
      .lerp(new THREE.Color('#ff9a48'), k1 * 0.6 + k2 * 0.4)
      .lerp(new THREE.Color('#ff6a32'), k2);
    skyMat.uniforms.uSunColor.value.copy(sunCol);

    sun.position.copy(sunDir.clone().multiplyScalar(46));
    sun.color.copy(sunCol);
    const sunUp = Math.max(0, sunDir.y);
    sun.intensity = 0.15 + sunUp * 2.3;
    renderer.toneMappingExposure = 1.18 - k2 * 0.12 - k3 * 0.18;

    hemi.color.copy(top.clone().lerp(new THREE.Color('#9ecbff'), 0.3));
    hemi.groundColor.set(k3 > 0.4 ? 0x1a120e : 0x4c7a32);
    hemi.intensity = 0.95 - k2 * 0.25 - k3 * 0.55;
    amb.color.set(k3 > 0.5 ? 0x4a5a88 : 0xfff1d0);
    amb.intensity = 0.32 - k3 * 0.12 + fireBoost * 0.08;

    moon.position.set(-18, 28, -12);
    moon.intensity = k3 * 0.45;
    moon.color.set(0xa8c8ff);

    sunBall.position.copy(sunDir.clone().multiplyScalar(110));
    sunBall.visible = sunUp > -0.05;
    sunBall.material.color.copy(sunCol);
    moonBall.position.set(-70, 78, -40);
    moonBall.visible = k3 > 0.25;
    moonBall.material.opacity = k3;
    moonBall.material.transparent = true;

    const fogCol = hor.clone().lerp(mid, 0.35);
    scene.fog.color.copy(fogCol);
    scene.fog.density = 0.0075 + k3 * 0.0045;
    renderer.setClearColor(fogCol, 1);

    const torchT = THREE.MathUtils.clamp((u - 0.52) / 0.18, 0, 1);
    const torchSmooth = torchT * torchT * (3 - 2 * torchT);
    for (let i = 0; i < torchLights.length; i++) {
      const flicker = 0.85 + Math.sin(matchTime * 11 + i * 1.7) * 0.12;
      torchLights[i].intensity = torchSmooth * 2.8 * flicker + fireBoost * 0.15;
    }

    return {
      t: u,
      phase:
        u < 0.28 ? 'День' : u < 0.5 ? 'Золотой час' : u < 0.72 ? 'Закат' : 'Ночь',
      torchT: torchSmooth,
      sunDir,
      waterDeep: new THREE.Color('#1a7a8a')
        .lerp(new THREE.Color('#0a3a58'), k2)
        .lerp(new THREE.Color('#061428'), k3),
      waterShallow: new THREE.Color('#3ad0c8')
        .lerp(new THREE.Color('#3a8aaa'), k2)
        .lerp(new THREE.Color('#163048'), k3),
      foam: new THREE.Color('#e8fff8').lerp(new THREE.Color('#c8d8e8'), k3),
      sunColor: sunCol,
      k3,
    };
  }

  return { update, addTorchLight, sun, sky };
}
