import * as THREE from 'three';
import { SHIPS, VIKING_CREWS } from '../config.js';
import { terrainHeight } from './map.js';
import { planks, shieldFace } from '../gfx/textures.js';

let HULL = null;

function hullMats() {
  if (HULL) return HULL;
  const p = planks({ count: 6, base: '#7a4424', seed: 6 });
  const dark = planks({ count: 4, base: '#4a2612', seed: 7 });
  HULL = {
    hull: new THREE.MeshStandardMaterial({ map: p.map, normalMap: p.normalMap, roughness: 0.82 }),
    dark: new THREE.MeshStandardMaterial({ map: dark.map, normalMap: dark.normalMap, roughness: 0.9 }),
    deck: new THREE.MeshStandardMaterial({ color: 0xb08a5a, map: p.map, roughness: 0.95 }),
    dragon: new THREE.MeshStandardMaterial({ color: 0x3aaa44, roughness: 0.6, metalness: 0.15, flatShading: true }),
    eye: new THREE.MeshStandardMaterial({ color: 0xffee88, emissive: 0xffaa22, emissiveIntensity: 1.2 }),
    rope: new THREE.MeshStandardMaterial({ color: 0xc8b088, roughness: 1 }),
    iron: new THREE.MeshStandardMaterial({ color: 0x3a3a40, roughness: 0.5, metalness: 0.8 }),
  };
  return HULL;
}

function makeSailTexture() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#efdfc0';
  ctx.fillRect(0, 0, 512, 512);
  ctx.fillStyle = '#c42a22';
  for (let i = 0; i < 8; i++) {
    if (i % 2 === 0) ctx.fillRect(i * 64, 0, 64, 512);
  }
  for (let i = 0; i < 400; i++) {
    ctx.fillStyle = Math.random() > 0.5 ? 'rgba(80,40,20,0.08)' : 'rgba(255,255,255,0.08)';
    ctx.fillRect(Math.random() * 512, Math.random() * 512, 2 + Math.random() * 6, 1);
  }
  for (let y = 0; y < 512; y += 96) {
    ctx.fillStyle = 'rgba(60,30,10,0.18)';
    ctx.fillRect(0, y, 512, 3);
  }
  ctx.strokeStyle = '#2a140c';
  ctx.lineWidth = 14;
  ctx.strokeRect(7, 7, 498, 498);
  ctx.fillStyle = '#1a1a18';
  ctx.beginPath();
  ctx.moveTo(256, 140);
  ctx.lineTo(336, 300);
  ctx.lineTo(176, 300);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(256, 128, 44, 32, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#efdfc0';
  ctx.beginPath();
  ctx.arc(240, 122, 6, 0, Math.PI * 2);
  ctx.arc(272, 122, 6, 0, Math.PI * 2);
  ctx.fill();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

let SAIL_TEX = null;

function makeDrakkar(index) {
  const g = new THREE.Group();
  const M = hullMats();
  const hull = new THREE.Mesh(new THREE.BoxGeometry(2.15, 0.7, 6.6), M.hull);
  hull.position.y = 0.28;
  hull.castShadow = true;
  hull.receiveShadow = true;
  g.add(hull);
  for (const side of [-1, 1]) {
    const strake = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.16, 6.7), M.dark);
    strake.position.set(side * 1.1, 0.62, 0);
    g.add(strake);
    const strake2 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, 6.4), M.dark);
    strake2.position.set(side * 1.05, 0.28, 0);
    g.add(strake2);
  }
  const deck = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.06, 6.2), M.deck);
  deck.position.y = 0.64;
  deck.receiveShadow = true;
  g.add(deck);
  const keel = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.4, 7.0), M.dark);
  keel.position.y = 0.05;
  g.add(keel);
  const stem = new THREE.Mesh(new THREE.BoxGeometry(0.22, 2.3, 0.5), M.hull);
  stem.position.set(0, 1.35, -3.35);
  stem.rotation.x = 0.38;
  stem.castShadow = true;
  g.add(stem);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, 0.7, 7), M.dragon);
  neck.position.set(0, 1.35, -0.1);
  neck.rotation.x = -0.4;
  stem.add(neck);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.34, 0.95), M.dragon);
  head.position.set(0, 1.62, -0.3);
  stem.add(head);
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 8), M.eye);
    eye.position.set(s * 0.17, 0.08, -0.25);
    head.add(eye);
    const horn = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.3, 5), M.dragon);
    horn.position.set(s * 0.12, 0.25, 0.1);
    horn.rotation.x = -0.6;
    head.add(horn);
  }
  const stern = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.3, 0.35), M.hull);
  stern.position.set(0, 1.0, 3.25);
  stern.rotation.x = -0.35;
  g.add(stern);
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.6, 5), M.dragon);
  tail.position.set(0, 0.85, 0);
  tail.rotation.x = 0.2;
  stern.add(tail);

  const shieldGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.06, 16);
  for (let i = 0; i < 6; i++) {
    for (const side of [-1, 1]) {
      const face = shieldFace(index * 12 + i * 2 + (side > 0 ? 1 : 0));
      const mat = new THREE.MeshStandardMaterial({ map: face, roughness: 0.6, metalness: 0.1 });
      const sh = new THREE.Mesh(shieldGeo, mat);
      sh.rotation.z = Math.PI / 2;
      sh.position.set(side * 1.14, 0.75, -2.1 + i * 0.85);
      sh.castShadow = true;
      g.add(sh);
    }
  }

  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 3.6, 7), M.dark);
  mast.position.y = 2.35;
  mast.castShadow = true;
  g.add(mast);
  const yard = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 4.0, 6), M.dark);
  yard.rotation.z = Math.PI / 2;
  yard.position.set(0, 3.7, 0.05);
  g.add(yard);
  if (!SAIL_TEX) SAIL_TEX = makeSailTexture();
  const sailGeo = new THREE.PlaneGeometry(3.8, 2.6, 10, 6);
  const sail = new THREE.Mesh(
    sailGeo,
    new THREE.MeshStandardMaterial({ map: SAIL_TEX, side: THREE.DoubleSide, roughness: 0.95 }),
  );
  sail.position.set(0, 2.35, 0.08);
  sail.castShadow = true;
  sail.userData.base = sailGeo.attributes.position.array.slice();
  g.add(sail);
  for (const s of [-1, 1]) {
    const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 3.9, 4), M.rope);
    rope.position.set(s * 1.0, 1.9, -1.6);
    rope.rotation.z = s * 0.5;
    rope.rotation.x = -0.6;
    g.add(rope);
  }

  for (const side of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      const oar = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.05, 0.1), M.dark);
      oar.position.set(side * 1.75, 0.5, -1.4 + i * 0.85);
      oar.rotation.z = side * 0.25;
      oar.userData.oar = true;
      oar.userData.side = side;
      oar.userData.i = i;
      g.add(oar);
    }
  }

  const deckAnchor = new THREE.Object3D();
  deckAnchor.position.y = 0.62;
  g.add(deckAnchor);
  g.userData.deck = deckAnchor;
  g.userData.sail = sail;
  return g;
}

export function createShips(scene) {
  const list = [];
  for (let i = 0; i < SHIPS.length; i++) {
    const def = SHIPS[i];
    const mesh = makeDrakkar(i);
    mesh.position.set(def.x, 0.15, def.startZ);
    mesh.rotation.y = def.yaw;
    scene.add(mesh);
    list.push({
      mesh,
      def,
      progress: 0,
      landed: false,
      spawned: false,
      crew: VIKING_CREWS[i],
      splash: 0,
    });
  }
  return list;
}

export function updateShips(ships, dt, matchTime, fx, time = matchTime) {
  for (const s of ships) {
    const wait = Math.max(0, matchTime - s.def.delay);
    const dur = 6.2;
    s.progress = Math.min(1, wait / dur);
    const ease = 1 - Math.pow(1 - s.progress, 1.6);
    const z = THREE.MathUtils.lerp(s.def.startZ, s.def.endZ, ease);
    const yWave = 0.12 + Math.sin(time * 2.2 + s.def.x) * 0.08;
    const beachY = terrainHeight(s.def.x, z);
    const y = s.progress > 0.88 ? THREE.MathUtils.lerp(yWave, beachY + 0.05, (s.progress - 0.88) / 0.12) : yWave;
    s.mesh.position.set(s.def.x + Math.sin(time * 0.7 + s.def.x) * 0.05, y, z);
    s.mesh.rotation.z = Math.sin(time * 1.8 + s.def.x) * 0.04;
    s.mesh.rotation.x = Math.sin(time * 1.4) * 0.03 + (1 - s.progress) * 0.02;
    const sail = s.mesh.userData.sail;
    sail.rotation.y = Math.sin(time * 1.6 + s.def.x) * 0.06;
    const posAttr = sail.geometry.attributes.position;
    const base = sail.userData.base;
    const belly = 0.25 + (1 - s.progress) * 0.35;
    for (let i = 0; i < posAttr.count; i++) {
      const bx = base[i * 3];
      const by = base[i * 3 + 1];
      const nx = bx / 1.9;
      const ny = by / 1.3;
      const bulge = (1 - nx * nx) * (1 - ny * ny * 0.6) * belly;
      posAttr.array[i * 3 + 2] = bulge + Math.sin(time * 3 + bx * 2.2 + by) * 0.03 * (1 - nx * nx);
    }
    posAttr.needsUpdate = true;
    s.mesh.traverse((ch) => {
      if (ch.userData.oar) {
        ch.rotation.x = Math.sin(time * 5 + ch.userData.i) * 0.35 * (1 - s.progress);
      }
    });
    if (s.progress > 0.05 && s.progress < 0.9 && Math.random() < dt * 14) {
      fx?.burst?.(s.mesh.position.x + (Math.random() - 0.5) * 1.6, 0.08, s.mesh.position.z - 3.0, 'splash', 2);
      fx?.burst?.(s.mesh.position.x + (Math.random() > 0.5 ? 1.2 : -1.2), 0.05, s.mesh.position.z + 1.5, 'splash', 1);
    }
    if (s.progress >= 1) s.landed = true;
  }
}

export function deckWorld(ship, ox, oz) {
  const p = new THREE.Vector3(ox, 0.15, oz);
  ship.mesh.updateWorldMatrix(true, false);
  p.applyMatrix4(ship.mesh.matrixWorld);
  return p;
}
