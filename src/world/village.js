import * as THREE from 'three';
import { HUTS, TORCHES, WORLD } from '../config.js';
import { terrainHeight } from './map.js';

function wood(color = 0x8b4e2a) {
  return new THREE.MeshLambertMaterial({ color, flatShading: true });
}

export function createVillage(scene, map, day) {
  const group = new THREE.Group();
  scene.add(group);
  const structures = [];
  const torchSprites = [];

  const postGeo = new THREE.CylinderGeometry(0.18, 0.22, 1.9, 6);
  const postMat = wood(0x7a3f1f);
  const p = WORLD.palisade;

  function addPost(x, z, h = 1.7) {
    const m = new THREE.Mesh(postGeo, postMat);
    m.position.set(x, terrainHeight(x, z) + h * 0.5, z);
    m.scale.y = h / 1.7;
    m.rotation.y = Math.random() * 0.4;
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
    return m;
  }

  for (let x = p.minX; x <= p.maxX + 0.01; x += 0.62) {
    const skipGate = Math.abs(x - WORLD.gate.x) < WORLD.gate.width * 0.48;
    if (!skipGate) addPost(x, p.maxZ, 1.55 + Math.random() * 0.35);
    addPost(x, p.minZ, 1.7 + Math.random() * 0.4);
  }
  for (let z = p.minZ + 0.62; z < p.maxZ; z += 0.62) {
    addPost(p.minX, z, 1.65 + Math.random() * 0.3);
    addPost(p.maxX, z, 1.65 + Math.random() * 0.3);
  }

  const rail = new THREE.Mesh(
    new THREE.BoxGeometry(p.maxX - p.minX, 0.12, 0.12),
    wood(0x6a3418),
  );
  rail.position.set(0, 1.35, p.minZ);
  group.add(rail);

  const gate = makeGate();
  group.add(gate.group);
  structures.push(gate);

  const longhouse = makeLonghouse();
  group.add(longhouse.group);
  structures.push(longhouse);
  for (const h of HUTS) {
    const hut = makeHut(h.x, h.z, h.s);
    group.add(hut.group);
    structures.push(hut);
  }

  const towers = [
    makeTower(p.minX + 0.4, p.maxZ - 0.3),
    makeTower(p.maxX - 0.4, p.maxZ - 0.3),
  ];
  for (const t of towers) {
    group.add(t.group);
    structures.push(t);
  }

  const well = makeWell(2.8, -3.2);
  group.add(well);

  const banner = makeBanner(-1.6, 4.6);
  group.add(banner);

  for (const t of TORCHES) {
    const y = terrainHeight(t.x, t.z) + t.y;
    day.addTorchLight(t.x, y, t.z);
    const flame = makeFlameSprite();
    flame.position.set(t.x, y + 0.15, t.z);
    flame.scale.set(0.7, 1.1, 1);
    flame.visible = false;
    group.add(flame);
    torchSprites.push(flame);
    const bowl = new THREE.Mesh(
      new THREE.ConeGeometry(0.12, 0.2, 6),
      new THREE.MeshLambertMaterial({ color: 0x4a2a14, emissive: 0x331800 }),
    );
    bowl.position.set(t.x, y - 0.12, t.z);
    group.add(bowl);
  }

  map.syncBuildings(structures);
  return { group, structures, torchSprites, gate };
}

function makeGate() {
  const group = new THREE.Group();
  const mat = wood(0x6e3518);
  const left = new THREE.Mesh(new THREE.BoxGeometry(1.9, 2.4, 0.28), mat);
  const right = new THREE.Mesh(new THREE.BoxGeometry(1.9, 2.4, 0.28), mat);
  left.position.set(-1.15, 1.35, 0);
  right.position.set(1.15, 1.35, 0);
  left.castShadow = true;
  right.castShadow = true;
  group.add(left, right);
  const bar = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.22, 0.22), wood(0x4a220e));
  bar.position.set(0, 2.35, 0);
  group.add(bar);
  const y = terrainHeight(WORLD.gate.x, WORLD.gate.z);
  group.position.set(WORLD.gate.x, y, WORLD.gate.z);
  return {
    id: 'gate',
    kind: 'gate',
    name: 'Ворота',
    hp: 110,
    maxHp: 110,
    x: WORLD.gate.x,
    z: WORLD.gate.z,
    radius: 2.4,
    group,
    onFire: false,
    dead: false,
    doors: [left, right],
  };
}

function makeLonghouse() {
  const group = new THREE.Group();
  const { x, z, w, d } = WORLD.longhouse;
  const y = terrainHeight(x, z);
  const wall = new THREE.Mesh(new THREE.BoxGeometry(w, 2.1, d), wood(0x8a4a24));
  wall.position.y = 1.15;
  wall.castShadow = true;
  wall.receiveShadow = true;
  group.add(wall);
  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(5.6, 2.4, 4),
    new THREE.MeshLambertMaterial({ color: 0xc45a28, flatShading: true }),
  );
  roof.position.y = 3.05;
  roof.rotation.y = Math.PI / 4;
  roof.scale.set(1.15, 1, 0.62);
  roof.castShadow = true;
  group.add(roof);
  const door = new THREE.Mesh(
    new THREE.BoxGeometry(1.3, 1.6, 0.12),
    new THREE.MeshLambertMaterial({ color: 0x3a1c0c }),
  );
  door.position.set(0, 0.9, d * 0.5);
  group.add(door);
  for (const s of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 2.6, 6), wood(0x5a2c12));
    post.position.set(s * (w * 0.48), 1.3, d * 0.52);
    group.add(post);
  }
  const gold = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 8, 8),
    new THREE.MeshLambertMaterial({ color: 0xffd24a, emissive: 0x553300 }),
  );
  gold.position.set(0, 4.15, 0);
  group.add(gold);
  group.position.set(x, y, z);
  return {
    id: 'longhouse',
    kind: 'longhouse',
    name: 'Лонгхаус',
    hp: 220,
    maxHp: 220,
    x,
    z,
    radius: 4.2,
    group,
    onFire: false,
    dead: false,
  };
}

function makeHut(x, z, s) {
  const group = new THREE.Group();
  const y = terrainHeight(x, z);
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.95 * s, 1.05 * s, 1.35 * s, 8),
    wood(0xb56a34),
  );
  body.position.y = 0.7 * s;
  body.castShadow = true;
  group.add(body);
  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(1.45 * s, 1.5 * s, 8),
    new THREE.MeshLambertMaterial({ color: 0xe0a336, flatShading: true }),
  );
  roof.position.y = 1.7 * s;
  roof.castShadow = true;
  group.add(roof);
  group.position.set(x, y, z);
  return {
    id: `hut-${x}-${z}`,
    kind: 'hut',
    name: 'Хижина',
    hp: 70,
    maxHp: 70,
    x,
    z,
    radius: 1.3 * s,
    group,
    onFire: false,
    dead: false,
  };
}

function makeTower(x, z) {
  const group = new THREE.Group();
  const y = terrainHeight(x, z);
  const post = new THREE.Mesh(new THREE.BoxGeometry(1.3, 3.2, 1.3), wood(0x6e3a18));
  post.position.y = 1.6;
  post.castShadow = true;
  group.add(post);
  const top = new THREE.Mesh(
    new THREE.BoxGeometry(1.8, 0.18, 1.8),
    wood(0x5a2c10),
  );
  top.position.y = 3.2;
  group.add(top);
  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(1.3, 1.1, 4),
    new THREE.MeshLambertMaterial({ color: 0xc45a28, flatShading: true }),
  );
  roof.position.y = 3.85;
  roof.rotation.y = Math.PI / 4;
  group.add(roof);
  group.position.set(x, y, z);
  return {
    id: `tower-${x}`,
    kind: 'tower',
    name: 'Вышка',
    hp: 90,
    maxHp: 90,
    x,
    z,
    radius: 1.2,
    group,
    onFire: false,
    dead: false,
  };
}

function makeWell(x, z) {
  const g = new THREE.Group();
  const y = terrainHeight(x, z);
  const stone = new THREE.Mesh(
    new THREE.CylinderGeometry(0.7, 0.78, 0.7, 8),
    new THREE.MeshLambertMaterial({ color: 0x8a8680, flatShading: true }),
  );
  stone.position.y = 0.35;
  stone.castShadow = true;
  g.add(stone);
  const water = new THREE.Mesh(
    new THREE.CircleGeometry(0.48, 12),
    new THREE.MeshLambertMaterial({ color: 0x2aa8c8, emissive: 0x113344 }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0.55;
  g.add(water);
  g.position.set(x, y, z);
  return g;
}

function makeBanner(x, z) {
  const g = new THREE.Group();
  const y = terrainHeight(x, z);
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.07, 3.1, 6),
    wood(0x4a2810),
  );
  pole.position.y = 1.55;
  g.add(pole);
  const cloth = new THREE.Mesh(
    new THREE.PlaneGeometry(1.15, 0.8),
    new THREE.MeshLambertMaterial({ color: 0xd4a024, side: THREE.DoubleSide }),
  );
  cloth.position.set(0.55, 2.45, 0);
  g.add(cloth);
  g.position.set(x, y, z);
  return g;
}

function makeFlameSprite() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 96;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 70, 4, 32, 40, 32);
  g.addColorStop(0, 'rgba(255,255,180,0.95)');
  g.addColorStop(0.35, 'rgba(255,140,40,0.85)');
  g.addColorStop(1, 'rgba(255,40,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 96);
  const tex = new THREE.CanvasTexture(c);
  const mat = new THREE.SpriteMaterial({
    map: tex,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  return new THREE.Sprite(mat);
}

export function damageStructure(st, dmg, map, fx, onEvent, allStructures) {
  if (st.dead) return;
  st.hp -= dmg;
  if (st.hp < st.maxHp * 0.55) st.onFire = true;
  if (st.hp <= 0) {
    st.hp = 0;
    st.dead = true;
    st.onFire = true;
    st.group.rotation.z = 0.4 + Math.random() * 0.3;
    st.group.position.y -= 0.35;
    st.group.scale.y *= 0.55;
    if (st.kind === 'gate') {
      map.gateOpen = true;
      for (const d of st.doors || []) {
        d.rotation.y = (d.position.x < 0 ? -1 : 1) * 1.1;
        d.position.z += 0.4;
      }
    }
    map.syncBuildings(allStructures);
    fx?.burst?.(st.x, st.group.position.y + 1, st.z, 'fire', 18);
    onEvent?.('structureDown', st);
  }
}
