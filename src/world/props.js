import * as THREE from 'three';
import { terrainHeight, fbm } from './map.js';

export function createProps(scene) {
  const group = new THREE.Group();
  scene.add(group);

  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x5a3218, flatShading: true });
  const leafA = new THREE.MeshLambertMaterial({ color: 0x2f9a3a, flatShading: true });
  const leafB = new THREE.MeshLambertMaterial({ color: 0x48c24a, flatShading: true });
  const rockMat = new THREE.MeshLambertMaterial({ color: 0x8d8072, flatShading: true });

  const trees = [];
  const spots = [];
  for (let i = 0; i < 42; i++) {
    const ang = fbm(i * 1.7, 4) * 6;
    let x = (fbm(i, 2) - 0.5) * 58;
    let z = -8 - fbm(i, 9) * 20;
    if (Math.abs(x) < 16 && z > -13) x += Math.sign(x || 1) * 12;
    if (z > 6) z = -14 - (i % 5);
    spots.push({ x, z, s: 0.8 + fbm(i, 3) * 0.9, ang });
  }
  for (const s of [-1, 1]) {
    for (let i = 0; i < 8; i++) {
      spots.push({ x: s * (16 + (i % 3)), z: 4 - i * 2.2, s: 0.7 + (i % 3) * 0.2, ang: i });
    }
  }

  for (const s of spots) {
    const y = terrainHeight(s.x, s.z);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.22, 1.5 * s.s, 5), trunkMat);
    trunk.position.set(s.x, y + 0.75 * s.s, s.z);
    trunk.castShadow = true;
    const leaf = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1.05 * s.s, 0),
      iColor(s.x) ? leafA : leafB,
    );
    leaf.position.set(s.x, y + 1.7 * s.s, s.z);
    leaf.scale.y = 1.15;
    leaf.castShadow = true;
    group.add(trunk, leaf);
    trees.push(leaf);
  }

  for (let i = 0; i < 18; i++) {
    const x = (fbm(i, 12) - 0.5) * 26;
    const z = 8 + fbm(i, 15) * 7;
    if (Math.abs(x) < 3 && z > 12) continue;
    const y = terrainHeight(x, z);
    const r = new THREE.Mesh(new THREE.DodecahedronGeometry(0.28 + (i % 4) * 0.1, 0), rockMat);
    r.position.set(x, y + 0.12, z);
    r.rotation.set(i, i * 0.4, 0.2);
    r.castShadow = true;
    r.receiveShadow = true;
    group.add(r);
  }

  const coop = makeCoop(-9.4, 2.6);
  group.add(coop.group);

  const chickens = [];
  for (let i = 0; i < 5; i++) {
    const ch = makeChicken(-9.2 + i * 0.45, 3.1 + (i % 2) * 0.4);
    group.add(ch.mesh);
    chickens.push(ch);
  }

  const seagulls = [];
  for (let i = 0; i < 4; i++) {
    const sg = makeSeagull();
    group.add(sg.mesh);
    seagulls.push(sg);
  }

  const clouds = [];
  for (let i = 0; i < 7; i++) {
    const c = makeCloud();
    c.position.set((i - 3) * 14, 18 + (i % 3) * 3, -8 - (i % 2) * 12);
    c.scale.setScalar(2.4 + (i % 3));
    group.add(c);
    clouds.push(c);
  }

  function update(dt, time, camera) {
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
    }
    for (let i = 0; i < clouds.length; i++) {
      clouds[i].position.x += dt * (0.35 + i * 0.04);
      if (clouds[i].position.x > 55) clouds[i].position.x = -55;
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

function iColor(n) {
  return Math.abs(Math.sin(n * 12.3)) > 0.5;
}

function makeCoop(x, z) {
  const group = new THREE.Group();
  const y = terrainHeight(x, z);
  const box = new THREE.Mesh(
    new THREE.BoxGeometry(1.6, 0.9, 1.1),
    new THREE.MeshLambertMaterial({ color: 0xc48a3a, flatShading: true }),
  );
  box.position.y = 0.45;
  box.castShadow = true;
  group.add(box);
  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(1.15, 0.7, 4),
    new THREE.MeshLambertMaterial({ color: 0xa33a22, flatShading: true }),
  );
  roof.position.y = 1.15;
  roof.rotation.y = Math.PI / 4;
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
  ctx.beginPath();
  ctx.moveTo(8, 18);
  ctx.quadraticCurveTo(32, 4, 56, 18);
  ctx.stroke();
  ctx.strokeStyle = '#2a2018';
  ctx.lineWidth = 1.2;
  ctx.stroke();
  const tex = new THREE.CanvasTexture(c);
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

function makeCloud() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const ctx = c.getContext('2d');
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  const blobs = [
    [80, 80, 46],
    [130, 70, 52],
    [175, 82, 40],
    [110, 58, 36],
    [150, 55, 30],
  ];
  for (const [x, y, r] of blobs) {
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * 0.72, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  return new THREE.Sprite(
    new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0.88 }),
  );
}
