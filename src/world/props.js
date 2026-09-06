import * as THREE from 'three';
import { WORLD } from '../config.js';
import { terrainHeight, fbm, hash2 } from './map.js';
import { bark, planks, stone, foliage } from '../gfx/textures.js';

function windMaterial(params) {
  const mat = new THREE.MeshStandardMaterial(params);
  mat.userData.uTime = { value: 0 };
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = mat.userData.uTime;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        {
          float ph = modelMatrix[3].x * 0.7 + modelMatrix[3].z * 0.5;
          float wgt = max(position.y, 0.0);
          transformed.x += (sin(uTime * 1.15 + ph) * 0.05 + sin(uTime * 2.3 + ph * 1.7) * 0.02) * wgt;
          transformed.z += (cos(uTime * 0.95 + ph * 1.3) * 0.035) * wgt;
        }`,
      );
  };
  return mat;
}

export function createProps(scene) {
  const group = new THREE.Group();
  scene.add(group);

  const barkT = bark();
  const trunkMat = new THREE.MeshStandardMaterial({
    color: 0x9a6a44,
    map: barkT.map,
    normalMap: barkT.normalMap,
    roughness: 0.95,
  });
  const leafT = foliage(6);
  const canopy = (color, extra = {}) =>
    windMaterial({
      color,
      map: leafT.map,
      normalMap: leafT.normalMap,
      normalScale: new THREE.Vector2(0.7, 0.7),
      roughness: 0.78,
      ...extra,
    });
  const pineA = canopy(0x86b878, { flatShading: true });
  const pineB = canopy(0x9ccc80, { flatShading: true });
  const leafA = canopy(0xe4ffb4);
  const leafB = canopy(0xf4ffc8);
  const bushMat = canopy(0xc8f0a0);
  const st = stone(4);
  const rockMat = new THREE.MeshStandardMaterial({
    color: 0xa39684,
    map: st.map,
    normalMap: st.normalMap,
    roughness: 0.9,
    flatShading: true,
  });
  const windMats = [pineA, pineB, leafA, leafB, bushMat];

  const pineGeos = [
    new THREE.ConeGeometry(1.15, 1.6, 7),
    new THREE.ConeGeometry(0.9, 1.4, 7),
    new THREE.ConeGeometry(0.6, 1.2, 7),
  ];
  const blobGeo = new THREE.IcosahedronGeometry(1, 2);
  const trunkGeo = new THREE.CylinderGeometry(0.12, 0.22, 1, 7);

  const spots = [];
  for (let i = 0; i < 46; i++) {
    let x = (fbm(i, 2) - 0.5) * 60;
    let z = -8 - fbm(i, 9) * 20;
    if (Math.abs(x) < 16 && z > -13) x += Math.sign(x || 1) * 12;
    if (z > 6) z = -14 - (i % 5);
    spots.push({ x, z, s: 0.85 + fbm(i, 3) * 0.9, pine: hash2(i, 3) > 0.42 });
  }
  for (const s of [-1, 1]) {
    for (let i = 0; i < 9; i++) {
      spots.push({ x: s * (16.5 + (i % 3) * 1.1), z: 4.5 - i * 2.1, s: 0.75 + (i % 3) * 0.2, pine: i % 3 !== 1 });
    }
  }

  for (const s of spots) {
    const y = terrainHeight(s.x, s.z);
    const tree = new THREE.Group();
    tree.position.set(s.x, y, s.z);
    tree.rotation.y = hash2(s.x, s.z) * Math.PI * 2;
    if (s.pine) {
      const th = 1.2 * s.s;
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.scale.set(s.s, th, s.s);
      trunk.position.y = th * 0.5;
      trunk.castShadow = true;
      tree.add(trunk);
      const mat = hash2(s.x * 2, s.z) > 0.5 ? pineA : pineB;
      let yy = th * 0.6;
      for (let k = 0; k < 3; k++) {
        const cone = new THREE.Mesh(pineGeos[k], mat);
        cone.scale.setScalar(s.s);
        cone.position.y = yy + pineGeos[k].parameters.height * 0.5 * s.s;
        cone.castShadow = true;
        cone.receiveShadow = true;
        tree.add(cone);
        yy += pineGeos[k].parameters.height * s.s * 0.62;
      }
    } else {
      const th = 1.5 * s.s;
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.scale.set(1.15 * s.s, th, 1.15 * s.s);
      trunk.position.y = th * 0.5;
      trunk.castShadow = true;
      tree.add(trunk);
      const mat = hash2(s.x, s.z * 2) > 0.5 ? leafA : leafB;
      const blobs = [
        [0, th + 0.7 * s.s, 0, 1.05],
        [0.55, th + 0.35 * s.s, 0.2, 0.7],
        [-0.5, th + 0.45 * s.s, -0.25, 0.75],
        [0.1, th + 1.25 * s.s, -0.1, 0.65],
      ];
      for (const [bx, by, bz, br] of blobs) {
        const b = new THREE.Mesh(blobGeo, mat);
        b.position.set(bx * s.s, by, bz * s.s);
        b.scale.set(br * s.s, br * s.s * 1.1, br * s.s);
        b.castShadow = true;
        b.receiveShadow = true;
        tree.add(b);
      }
    }
    group.add(tree);
  }

  for (let i = 0; i < 16; i++) {
    const x = (fbm(i, 12) - 0.5) * 34;
    const z = 7.5 + fbm(i, 15) * 8;
    if (Math.abs(x) < 3.2 && z > 12) continue;
    const y = terrainHeight(x, z);
    const r = new THREE.Mesh(new THREE.DodecahedronGeometry(0.16 + (i % 4) * 0.08, i % 3 === 0 ? 1 : 0), rockMat);
    r.position.set(x, y + 0.04, z);
    r.rotation.set(i, i * 0.4, 0.2);
    r.scale.y = 0.6;
    r.castShadow = true;
    r.receiveShadow = true;
    group.add(r);
  }

  const bushSpots = [
    [-11.5, 4.2], [11.8, 3.8], [-12.6, -3.5], [12.4, -6], [-3.6, -10.6], [4.4, -10.8],
    [-15.5, 7.2], [15.8, 6.6], [-19, 2], [19.5, -4], [-9.6, 6.9], [9.2, 7.1],
  ];
  for (const [bx, bz] of bushSpots) {
    const y = terrainHeight(bx, bz);
    for (let k = 0; k < 3; k++) {
      const b = new THREE.Mesh(blobGeo, bushMat);
      const r = 0.32 + hash2(bx + k, bz) * 0.22;
      b.position.set(bx + (hash2(bx, bz + k) - 0.5) * 0.7, y + r * 0.6, bz + (hash2(bx * 2, bz + k) - 0.5) * 0.7);
      b.scale.set(r, r * 0.8, r);
      b.castShadow = true;
      b.receiveShadow = true;
      group.add(b);
    }
  }

  const plankT = planks({ count: 5, base: '#8a5a30', seed: 3 });
  const barrelMat = new THREE.MeshStandardMaterial({
    color: 0xb08050,
    map: plankT.map,
    normalMap: plankT.normalMap,
    roughness: 0.85,
  });
  const ironMat = new THREE.MeshStandardMaterial({ color: 0x3a3a40, roughness: 0.55, metalness: 0.8 });
  const barrelGeo = new THREE.CylinderGeometry(0.28, 0.24, 0.62, 10);
  const ringGeo = new THREE.TorusGeometry(0.285, 0.02, 6, 14);
  const crateGeo = new THREE.BoxGeometry(0.55, 0.55, 0.55);
  const propSpots = [
    [-6.8, -0.6, 'barrel'], [-6.5, -1.2, 'barrel'], [9.6, -1.9, 'crate'], [6.5, 2.4, 'barrel'],
    [-3.1, 3.0, 'crate'], [3.2, -6.4, 'barrel'], [-6.2, -7.3, 'crate'], [8.9, -7.4, 'barrel'],
    [-2.6, 13.6, 'crate'], [-2.1, 13.9, 'barrel'],
  ];
  for (const [px, pz, kind] of propSpots) {
    const y = terrainHeight(px, pz);
    if (kind === 'barrel') {
      const b = new THREE.Mesh(barrelGeo, barrelMat);
      b.position.set(px, y + 0.31, pz);
      b.castShadow = true;
      b.receiveShadow = true;
      group.add(b);
      for (const ry of [-0.2, 0.2]) {
        const ring = new THREE.Mesh(ringGeo, ironMat);
        ring.rotation.x = Math.PI / 2;
        ring.position.set(px, y + 0.31 + ry, pz);
        group.add(ring);
      }
    } else {
      const c = new THREE.Mesh(crateGeo, barrelMat);
      c.position.set(px, y + 0.28, pz);
      c.rotation.y = hash2(px, pz) * 0.8;
      c.castShadow = true;
      c.receiveShadow = true;
      group.add(c);
    }
  }

  group.add(makePier(-4.2, WORLD.seaZ - 1.2));

  const coop = makeCoop(-9.4, 2.6);
  group.add(coop.group);

  const chickens = [];
  for (let i = 0; i < 5; i++) {
    const ch = makeChicken(-9.2 + i * 0.45, 3.1 + (i % 2) * 0.4);
    group.add(ch.mesh);
    chickens.push(ch);
  }

  const seagulls = [];
  for (let i = 0; i < 5; i++) {
    const sg = makeSeagull();
    group.add(sg.mesh);
    seagulls.push(sg);
  }

  function update(dt, time, camera, look) {
    for (const m of windMats) m.userData.uTime.value = time;
    const gullVis = look ? 1 - THREE.MathUtils.smoothstep(look.night, 0.15, 0.6) : 1;
    for (const ch of chickens) {
      if (ch.flee) {
        ch.x += ch.vx * dt;
        ch.z += ch.vz * dt;
        ch.vy -= 12 * dt;
        ch.y += ch.vy * dt;
        if (ch.y < terrainHeight(ch.x, ch.z) + 0.12) {
          ch.y = terrainHeight(ch.x, ch.z) + 0.12;
          ch.vy *= -0.35;
          ch.vx *= 0.92;
          ch.vz *= 0.92;
        }
      } else {
        ch.phase += dt * 2;
        ch.x += Math.sin(ch.phase) * dt * 0.35;
        ch.z += Math.cos(ch.phase * 0.7) * dt * 0.25;
        ch.y = terrainHeight(ch.x, ch.z) + 0.12;
      }
      ch.mesh.position.set(ch.x, ch.y + 0.15, ch.z);
      ch.mesh.lookAt(camera.position.x, ch.mesh.position.y, camera.position.z);
    }
    for (let i = 0; i < seagulls.length; i++) {
      const sg = seagulls[i];
      sg.a += dt * sg.spd;
      sg.mesh.position.set(
        Math.cos(sg.a) * sg.r + sg.cx,
        7 + Math.sin(sg.a * 2) * 0.8,
        Math.sin(sg.a) * sg.r + sg.cz,
      );
      sg.mesh.lookAt(camera.position.x, sg.mesh.position.y, camera.position.z);
      sg.mesh.scale.y = 0.75 + Math.sin(time * 9 + i) * 0.3;
      sg.mesh.visible = gullVis > 0.02;
      sg.mesh.material.opacity = gullVis;
    }
  }

  function scareChickens(x, z) {
    for (const ch of chickens) {
      const dx = ch.x - x;
      const dz = ch.z - z;
      if (!ch.flee && dx * dx + dz * dz < 16) {
        ch.flee = true;
        ch.vx = dx * 2 + (Math.random() - 0.5) * 4;
        ch.vz = dz * 2 + (Math.random() - 0.5) * 4;
        ch.vy = 3 + Math.random() * 2;
      }
    }
  }

  return { group, update, scareChickens, chickens, coop };
}

function makePier(x, z0) {
  const g = new THREE.Group();
  const p = planks({ count: 7, base: '#6e4a2c', seed: 8 });
  const deckMat = new THREE.MeshStandardMaterial({ color: 0xa08060, map: p.map, normalMap: p.normalMap, roughness: 0.9 });
  const deck = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.14, 6.4), deckMat);
  deck.position.set(x, 0.55, z0 + 2.6);
  deck.castShadow = true;
  deck.receiveShadow = true;
  g.add(deck);
  const postGeo = new THREE.CylinderGeometry(0.09, 0.11, 1.4, 6);
  const postMat = new THREE.MeshStandardMaterial({ color: 0x5a3a22, roughness: 0.95 });
  for (let i = 0; i < 4; i++) {
    for (const s of [-1, 1]) {
      const post = new THREE.Mesh(postGeo, postMat);
      post.position.set(x + s * 0.8, 0.2, z0 + 0.4 + i * 1.9);
      post.castShadow = true;
      g.add(post);
    }
  }
  return g;
}

function makeCoop(x, z) {
  const group = new THREE.Group();
  const y = terrainHeight(x, z);
  const p = planks({ count: 4, base: '#b8803a', seed: 5 });
  const box = new THREE.Mesh(
    new THREE.BoxGeometry(1.6, 0.9, 1.1),
    new THREE.MeshStandardMaterial({ color: 0xd0a060, map: p.map, normalMap: p.normalMap, roughness: 0.9 }),
  );
  box.position.y = 0.45;
  box.castShadow = true;
  box.receiveShadow = true;
  group.add(box);
  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(1.15, 0.7, 4),
    new THREE.MeshStandardMaterial({ color: 0xa33a22, roughness: 0.85, flatShading: true }),
  );
  roof.position.y = 1.15;
  roof.rotation.y = Math.PI / 4;
  roof.castShadow = true;
  group.add(roof);
  group.position.set(x, y, z);
  return { group, x, z };
}

function makeChicken(x, z) {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext('2d');
  ctx.lineJoin = 'round';
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#3a1c0c';
  ctx.fillStyle = '#f4f0e0';
  ctx.beginPath();
  ctx.ellipse(30, 38, 14, 11, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(44, 28, 8, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#e24a2a';
  ctx.beginPath();
  ctx.moveTo(50, 26);
  ctx.lineTo(58, 28);
  ctx.lineTo(50, 31);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#2a1a10';
  ctx.beginPath();
  ctx.arc(46, 27, 1.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e24a2a';
  ctx.beginPath();
  ctx.ellipse(30, 26, 4, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshLambertMaterial({
    map: tex,
    transparent: true,
    alphaTest: 0.4,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.55), mat);
  return {
    mesh,
    x,
    z,
    y: terrainHeight(x, z) + 0.12,
    phase: Math.random() * 10,
    flee: false,
    vx: 0,
    vz: 0,
    vy: 0,
  };
}

function makeSeagull() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 32;
  const ctx = c.getContext('2d');
  ctx.strokeStyle = '#f4f4f0';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(8, 18);
  ctx.quadraticCurveTo(32, 4, 56, 18);
  ctx.stroke();
  ctx.strokeStyle = '#2a2018';
  ctx.lineWidth = 1.2;
  ctx.stroke();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(1.4, 0.7),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, alphaTest: 0.2 }),
  );
  return {
    mesh,
    a: Math.random() * 6,
    r: 10 + Math.random() * 10,
    spd: 0.25 + Math.random() * 0.2,
    cx: (Math.random() - 0.5) * 10,
    cz: 10 + Math.random() * 12,
  };
}
