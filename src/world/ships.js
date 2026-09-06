import * as THREE from 'three';
import { SHIPS, VIKING_CREWS } from '../config.js';
import { terrainHeight } from './map.js';

function wood(color) {
  return new THREE.MeshLambertMaterial({ color, flatShading: true });
}

function makeSailTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#f2e2c4';
  ctx.fillRect(0, 0, 256, 256);
  ctx.fillStyle = '#c42a22';
  for (let i = 0; i < 8; i++) {
    if (i % 2 === 0) ctx.fillRect(i * 32, 0, 32, 256);
  }
  ctx.strokeStyle = '#2a140c';
  ctx.lineWidth = 8;
  ctx.strokeRect(4, 4, 248, 248);
  ctx.fillStyle = '#1a1a18';
  ctx.beginPath();
  ctx.moveTo(128, 70);
  ctx.lineTo(168, 150);
  ctx.lineTo(88, 150);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(128, 64, 22, 16, 0, 0, Math.PI * 2);
  ctx.fill();
  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 4;
  return tex;
}

function makeDrakkar() {
  const g = new THREE.Group();
  const hullMat = wood(0x6b3a1c);
  const hull = new THREE.Mesh(new THREE.BoxGeometry(2.15, 0.7, 6.6), hullMat);
  hull.position.y = 0.28;
  hull.castShadow = true;
  g.add(hull);
  const keel = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.4, 7.0), wood(0x4a220e));
  keel.position.y = 0.05;
  g.add(keel);
  const stem = new THREE.Mesh(new THREE.BoxGeometry(0.22, 2.3, 0.5), hullMat);
  stem.position.set(0, 1.35, -3.35);
  stem.rotation.x = 0.38;
  stem.castShadow = true;
  g.add(stem);
  const head = new THREE.Mesh(
    new THREE.BoxGeometry(0.38, 0.34, 0.95),
    new THREE.MeshLambertMaterial({ color: 0x3aaa44, flatShading: true }),
  );
  head.position.set(0, 1.2, -0.2);
  stem.add(head);
  const eye = new THREE.Mesh(
    new THREE.SphereGeometry(0.09, 8, 8),
    new THREE.MeshLambertMaterial({ color: 0xffee88, emissive: 0x665200 }),
  );
  eye.position.set(0.2, 0.08, -0.2);
  head.add(eye);
  const stern = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.1, 0.35), hullMat);
  stern.position.set(0, 1.05, 3.25);
  g.add(stern);

  const colors = [0xc42a22, 0xe8d24a, 0x2a6ad4, 0xd4782a];
  for (let i = 0; i < 6; i++) {
    const sh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.22, 0.08, 12),
      new THREE.MeshLambertMaterial({ color: colors[i % 4], flatShading: true }),
    );
    sh.rotation.x = Math.PI / 2;
    sh.position.set(1.12, 0.68, -2.1 + i * 0.85);
    g.add(sh);
    const sh2 = sh.clone();
    sh2.position.x = -1.12;
    g.add(sh2);
  }

  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 3.4, 6), wood(0x4a2812));
  mast.position.y = 2.25;
  g.add(mast);
  const sail = new THREE.Mesh(
    new THREE.PlaneGeometry(3.8, 2.6),
    new THREE.MeshLambertMaterial({
      map: makeSailTexture(),
      side: THREE.DoubleSide,
    }),
  );
  sail.position.set(0.18, 2.35, 0.05);
  g.add(sail);

  for (const side of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      const oar = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.05, 0.1), wood(0x5a3214));
      oar.position.set(side * 1.75, 0.5, -1.4 + i * 0.85);
      oar.rotation.z = side * 0.25;
      oar.userData.oar = true;
      oar.userData.side = side;
      oar.userData.i = i;
      g.add(oar);
    }
  }

  const deck = new THREE.Object3D();
  deck.position.y = 0.62;
  g.add(deck);
  g.userData.deck = deck;
  g.userData.sail = sail;
  return g;
}

export function createShips(scene) {
  const list = [];
  for (let i = 0; i < SHIPS.length; i++) {
    const def = SHIPS[i];
    const mesh = makeDrakkar();
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

export function updateShips(ships, dt, time, fx) {
  for (const s of ships) {
    const wait = Math.max(0, time - s.def.delay);
    const dur = 6.2;
    s.progress = Math.min(1, wait / dur);
    const ease = 1 - Math.pow(1 - s.progress, 1.6);
    const z = THREE.MathUtils.lerp(s.def.startZ, s.def.endZ, ease);
    const yWave = 0.12 + Math.sin(time * 2.2 + s.def.x) * 0.08;
    const beachY = terrainHeight(s.def.x, z);
    const y = s.progress > 0.88 ? THREE.MathUtils.lerp(yWave, beachY + 0.05, (s.progress - 0.88) / 0.12) : yWave;
    s.mesh.position.set(s.def.x + Math.sin(time * 0.7 + s.def.x) * 0.05, y, z);
    s.mesh.rotation.z = Math.sin(time * 1.8 + s.def.x) * 0.04;
    s.mesh.rotation.x = Math.sin(time * 1.4) * 0.03;
    s.mesh.userData.sail.rotation.y = Math.sin(time * 1.6 + s.def.x) * 0.06;
    s.mesh.traverse((ch) => {
      if (ch.userData.oar) {
        ch.rotation.x = Math.sin(time * 5 + ch.userData.i) * 0.35 * (1 - s.progress);
      }
    });
    if (s.progress > 0.2 && s.progress < 0.9 && Math.random() < dt * 8) {
      fx?.burst?.(s.mesh.position.x, 0.1, s.mesh.position.z - 2.2, 'splash', 2);
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
