import * as THREE from 'three';
import { HUTS, TORCHES, WORLD } from '../config.js';
import { terrainHeight } from './map.js';
import { planks, thatch, stone, bark, glow } from '../gfx/textures.js';

let MATS = null;

function mats() {
  if (MATS) return MATS;
  const wallP = planks({ count: 7, base: '#9a5a2e', seed: 1 });
  const wallV = planks({ count: 6, base: '#7c4622', vertical: true, seed: 2 });
  const darkP = planks({ count: 5, base: '#5a3018', vertical: true, seed: 4 });
  const th = thatch(2);
  const st = stone(4);
  const bk = bark();
  MATS = {
    wall: new THREE.MeshStandardMaterial({ map: wallP.map, normalMap: wallP.normalMap, roughness: 0.88 }),
    wallV: new THREE.MeshStandardMaterial({ map: wallV.map, normalMap: wallV.normalMap, roughness: 0.88 }),
    dark: new THREE.MeshStandardMaterial({ map: darkP.map, normalMap: darkP.normalMap, roughness: 0.9 }),
    thatch: new THREE.MeshStandardMaterial({
      map: th.map,
      normalMap: th.normalMap,
      normalScale: new THREE.Vector2(0.9, 0.9),
      roughness: 0.98,
    }),
    thatchDark: new THREE.MeshStandardMaterial({
      map: th.map,
      normalMap: th.normalMap,
      color: 0xb07040,
      roughness: 0.98,
    }),
    stone: new THREE.MeshStandardMaterial({ map: st.map, normalMap: st.normalMap, roughness: 0.92 }),
    post: new THREE.MeshStandardMaterial({ color: 0x9a6a44, map: bk.map, normalMap: bk.normalMap, roughness: 0.95 }),
    iron: new THREE.MeshStandardMaterial({ color: 0x2e2e34, roughness: 0.5, metalness: 0.85 }),
    gold: new THREE.MeshStandardMaterial({ color: 0xffd24a, roughness: 0.3, metalness: 0.9, emissive: 0x553300, emissiveIntensity: 0.4 }),
    window: new THREE.MeshStandardMaterial({ color: 0x2a1a10, emissive: 0xffa040, emissiveIntensity: 0, roughness: 0.6 }),
    cloth: new THREE.MeshStandardMaterial({ color: 0xd4a024, roughness: 0.9, side: THREE.DoubleSide }),
  };
  return MATS;
}

export function createVillage(scene, map, day) {
  const group = new THREE.Group();
  scene.add(group);
  const structures = [];
  const torchSprites = [];
  const smokeSources = [];
  const M = mats();

  const p = WORLD.palisade;
  const posts = [];
  const rnd = (i) => Math.abs(Math.sin(i * 12.9898) * 43758.5453) % 1;
  let pi = 0;
  for (let x = p.minX; x <= p.maxX + 0.01; x += 0.62) {
    const skipGate = Math.abs(x - WORLD.gate.x) < WORLD.gate.width * 0.48;
    if (!skipGate) posts.push({ x, z: p.maxZ, h: 1.55 + rnd(pi++) * 0.35 });
    posts.push({ x, z: p.minZ, h: 1.7 + rnd(pi++) * 0.4 });
  }
  for (let z = p.minZ + 0.62; z < p.maxZ; z += 0.62) {
    posts.push({ x: p.minX, z, h: 1.65 + rnd(pi++) * 0.3 });
    posts.push({ x: p.maxX, z, h: 1.65 + rnd(pi++) * 0.3 });
  }
  const postGeo = new THREE.CylinderGeometry(0.17, 0.22, 1, 7);
  const tipGeo = new THREE.ConeGeometry(0.17, 0.32, 7);
  const postMesh = new THREE.InstancedMesh(postGeo, M.post, posts.length);
  const tipMesh = new THREE.InstancedMesh(tipGeo, M.post, posts.length);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s3 = new THREE.Vector3();
  const v3 = new THREE.Vector3();
  posts.forEach((pt, i) => {
    const y = terrainHeight(pt.x, pt.z);
    q.setFromEuler(new THREE.Euler(0, rnd(i * 3) * 0.6, 0));
    m4.compose(v3.set(pt.x, y + pt.h * 0.5 - 0.1, pt.z), q, s3.set(1, pt.h, 1));
    postMesh.setMatrixAt(i, m4);
    m4.compose(v3.set(pt.x, y + pt.h - 0.1 + 0.16, pt.z), q, s3.set(1, 1, 1));
    tipMesh.setMatrixAt(i, m4);
  });
  postMesh.castShadow = true;
  postMesh.receiveShadow = true;
  tipMesh.castShadow = true;
  group.add(postMesh, tipMesh);

  for (const z of [p.minZ, p.maxZ]) {
    for (const seg of z === p.maxZ ? [[p.minX, WORLD.gate.x - 2.4], [WORLD.gate.x + 2.4, p.maxX]] : [[p.minX, p.maxX]]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(seg[1] - seg[0], 0.12, 0.14), M.dark);
      rail.position.set((seg[0] + seg[1]) * 0.5, terrainHeight((seg[0] + seg[1]) * 0.5, z) + 1.25, z + (z === p.maxZ ? -0.2 : 0.2));
      rail.castShadow = true;
      group.add(rail);
    }
  }

  const gate = makeGate(M);
  group.add(gate.group);
  structures.push(gate);

  const longhouse = makeLonghouse(M);
  group.add(longhouse.group);
  structures.push(longhouse);
  smokeSources.push({ x: WORLD.longhouse.x + 1.2, y: terrainHeight(WORLD.longhouse.x, WORLD.longhouse.z) + 4.4, z: WORLD.longhouse.z, st: longhouse, rate: 4 });

  for (const h of HUTS) {
    const hut = makeHut(h.x, h.z, h.s, M);
    group.add(hut.group);
    structures.push(hut);
    smokeSources.push({ x: h.x, y: terrainHeight(h.x, h.z) + 3.1 * h.s, z: h.z, st: hut, rate: 1.6 });
  }

  const towers = [
    makeTower(p.minX + 0.4, p.maxZ - 0.3, M),
    makeTower(p.maxX - 0.4, p.maxZ - 0.3, M),
  ];
  for (const t of towers) {
    group.add(t.group);
    structures.push(t);
  }

  group.add(makeWell(2.8, -3.2, M));
  const banner = makeBanner(-1.6, 4.6, M);
  group.add(banner.group);

  const windows = [];
  group.traverse((o) => {
    if (o.userData.window) windows.push(o);
  });

  for (const t of TORCHES) {
    const y = terrainHeight(t.x, t.z) + t.y;
    day.addTorchLight(t.x, y, t.z);
    const flame = makeFlameSprite();
    flame.position.set(t.x, y + 0.15, t.z);
    flame.scale.set(0.7, 1.1, 1);
    flame.visible = false;
    group.add(flame);
    torchSprites.push(flame);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, t.y - 0.2, 6), M.post);
    pole.position.set(t.x, y - t.y * 0.5 - 0.1, t.z);
    pole.castShadow = true;
    group.add(pole);
    const bowl = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.22, 7, 1, true), M.iron);
    bowl.rotation.x = Math.PI;
    bowl.position.set(t.x, y - 0.1, t.z);
    group.add(bowl);
  }

  function update(time, look) {
    const glowI = look ? look.torchT * 2.4 + look.night * 0.6 : 0;
    M.window.emissiveIntensity = glowI * (0.9 + Math.sin(time * 7.3) * 0.08);
    banner.cloth.rotation.y = Math.sin(time * 2.1) * 0.18;
    banner.cloth.rotation.z = Math.sin(time * 3.4) * 0.05;
  }

  map.syncBuildings(structures);
  return { group, structures, torchSprites, gate, smokeSources, update, windows };
}

function addWindow(group, x, y, z, ry = 0, w = 0.36, h = 0.3) {
  const win = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mats().window);
  win.position.set(x, y, z);
  win.rotation.y = ry;
  win.userData.window = true;
  group.add(win);
  return win;
}

function makeGate(M) {
  const group = new THREE.Group();
  const left = new THREE.Mesh(new THREE.BoxGeometry(1.9, 2.4, 0.26), M.wallV);
  const right = new THREE.Mesh(new THREE.BoxGeometry(1.9, 2.4, 0.26), M.wallV);
  left.position.set(-1.15, 1.35, 0);
  right.position.set(1.15, 1.35, 0);
  left.castShadow = right.castShadow = true;
  left.receiveShadow = right.receiveShadow = true;
  group.add(left, right);
  for (const door of [left, right]) {
    for (const by of [-0.7, 0.1, 0.8]) {
      const band = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.1, 0.3), M.iron);
      band.position.set(0, by, 0);
      door.add(band);
    }
  }
  const bar = new THREE.Mesh(new THREE.BoxGeometry(4.8, 0.26, 0.26), M.dark);
  bar.position.set(0, 2.55, 0);
  bar.castShadow = true;
  group.add(bar);
  for (const s of [-1, 1]) {
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 2.9, 8), M.post);
    pillar.position.set(s * 2.45, 1.45, 0);
    pillar.castShadow = true;
    group.add(pillar);
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), new THREE.MeshStandardMaterial({ color: 0xe8e0c8, roughness: 0.7 }));
    skull.position.set(s * 2.45, 3.0, 0);
    group.add(skull);
  }
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

function makeLonghouse(M) {
  const group = new THREE.Group();
  const { x, z, w, d } = WORLD.longhouse;
  const y = terrainHeight(x, z);
  const wall = new THREE.Mesh(new THREE.BoxGeometry(w, 2.1, d), M.wall);
  wall.position.y = 1.15;
  wall.castShadow = true;
  wall.receiveShadow = true;
  group.add(wall);
  const base = new THREE.Mesh(new THREE.BoxGeometry(w + 0.3, 0.4, d + 0.3), M.stone);
  base.position.y = 0.2;
  base.receiveShadow = true;
  group.add(base);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(5.6, 2.6, 4), M.thatchDark);
  roof.position.y = 3.15;
  roof.rotation.y = Math.PI / 4;
  roof.scale.set(1.2, 1, 0.66);
  roof.castShadow = true;
  roof.receiveShadow = true;
  group.add(roof);
  const ridge = new THREE.Mesh(new THREE.BoxGeometry(w * 1.05, 0.16, 0.22), M.dark);
  ridge.position.y = 4.42;
  group.add(ridge);
  for (const s of [-1, 1]) {
    const dragon = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.9, 5), M.dark);
    dragon.position.set(s * (w * 0.55), 4.7, 0);
    dragon.rotation.z = -s * 0.55;
    group.add(dragon);
  }
  const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.5), M.stone);
  chimney.position.set(1.2, 4.1, 0);
  group.add(chimney);
  const door = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.6, 0.12), M.dark);
  door.position.set(0, 0.9, d * 0.5 + 0.02);
  group.add(door);
  for (const s of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 2.6, 7), M.post);
    post.position.set(s * (w * 0.48), 1.3, d * 0.54);
    post.castShadow = true;
    group.add(post);
    addWindow(group, s * 2.4, 1.35, d * 0.5 + 0.02);
    addWindow(group, s * (w * 0.5 + 0.02), 1.35, 0.6, s * Math.PI * 0.5);
    addWindow(group, s * (w * 0.5 + 0.02), 1.35, -0.8, s * Math.PI * 0.5);
  }
  const gold = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 12), M.gold);
  gold.position.set(0, 4.62, 0);
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

function makeHut(x, z, s, M) {
  const group = new THREE.Group();
  const y = terrainHeight(x, z);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.95 * s, 1.05 * s, 1.35 * s, 10), M.wallV);
  body.position.y = 0.7 * s;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.1 * s, 1.15 * s, 0.25 * s, 10), M.stone);
  base.position.y = 0.12 * s;
  base.receiveShadow = true;
  group.add(base);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(1.5 * s, 1.55 * s, 10), M.thatch);
  roof.position.y = 1.75 * s;
  roof.castShadow = true;
  roof.receiveShadow = true;
  group.add(roof);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.12 * s, 0.16 * s, 0.35 * s, 6), M.dark);
  cap.position.y = 2.5 * s;
  group.add(cap);
  const door = new THREE.Mesh(new THREE.BoxGeometry(0.55 * s, 0.9 * s, 0.1), M.dark);
  door.position.set(0, 0.5 * s, 1.0 * s);
  group.add(door);
  addWindow(group, 0.75 * s, 0.85 * s, 0.7 * s, Math.PI * 0.25, 0.3 * s, 0.26 * s);
  addWindow(group, -0.75 * s, 0.85 * s, 0.7 * s, -Math.PI * 0.25, 0.3 * s, 0.26 * s);
  group.position.set(x, y, z);
  group.rotation.y = (x > 0 ? -0.3 : 0.3) + (z > 0 ? 0.4 : 0);
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

function makeTower(x, z, M) {
  const group = new THREE.Group();
  const y = terrainHeight(x, z);
  const legGeo = new THREE.CylinderGeometry(0.1, 0.13, 3.2, 6);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const leg = new THREE.Mesh(legGeo, M.post);
      leg.position.set(sx * 0.55, 1.6, sz * 0.55);
      leg.rotation.set(sz * 0.06, 0, -sx * 0.06);
      leg.castShadow = true;
      group.add(leg);
    }
  }
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.0, 1.5), M.wallV);
  cabin.position.y = 3.5;
  cabin.castShadow = true;
  group.add(cabin);
  const floor = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.16, 1.8), M.dark);
  floor.position.y = 3.05;
  floor.castShadow = true;
  group.add(floor);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(1.45, 1.1, 4), M.thatch);
  roof.position.y = 4.55;
  roof.rotation.y = Math.PI / 4;
  roof.castShadow = true;
  group.add(roof);
  const brace = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.08, 0.08), M.dark);
  brace.position.set(0, 1.6, 0.6);
  brace.rotation.z = 0.9;
  group.add(brace);
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

function makeWell(x, z, M) {
  const g = new THREE.Group();
  const y = terrainHeight(x, z);
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.78, 0.7, 10), M.stone);
  ring.position.y = 0.35;
  ring.castShadow = true;
  ring.receiveShadow = true;
  g.add(ring);
  const water = new THREE.Mesh(
    new THREE.CircleGeometry(0.5, 14),
    new THREE.MeshStandardMaterial({ color: 0x1a6a88, roughness: 0.1, metalness: 0.2 }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0.56;
  g.add(water);
  for (const s of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 1.5, 6), M.post);
    post.position.set(s * 0.62, 1.1, 0);
    post.castShadow = true;
    g.add(post);
  }
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.4, 6), M.post);
  beam.rotation.z = Math.PI / 2;
  beam.position.y = 1.8;
  g.add(beam);
  const top = new THREE.Mesh(new THREE.ConeGeometry(0.95, 0.5, 4), M.thatch);
  top.rotation.y = Math.PI / 4;
  top.position.y = 2.1;
  top.castShadow = true;
  g.add(top);
  const bucket = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.1, 0.18, 8), M.dark);
  bucket.position.set(0, 1.25, 0);
  g.add(bucket);
  g.position.set(x, y, z);
  return g;
}

function makeBanner(x, z, M) {
  const g = new THREE.Group();
  const y = terrainHeight(x, z);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 3.1, 6), M.post);
  pole.position.y = 1.55;
  pole.castShadow = true;
  g.add(pole);
  const clothGeo = new THREE.PlaneGeometry(1.15, 0.8, 6, 2);
  clothGeo.translate(0.575, 0, 0);
  const cloth = new THREE.Mesh(clothGeo, M.cloth);
  cloth.position.set(0.05, 2.45, 0);
  cloth.castShadow = true;
  g.add(cloth);
  const finial = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), M.gold);
  finial.position.y = 3.18;
  g.add(finial);
  g.position.set(x, y, z);
  return { group: g, cloth };
}

function makeFlameSprite() {
  const mat = new THREE.SpriteMaterial({
    map: glow(),
    color: 0xffa040,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    opacity: 0.9,
  });
  return new THREE.Sprite(mat);
}

export function damageStructure(st, dmg, map, fx, onEvent, allStructures) {
  if (st.dead) return;
  st.hp -= dmg;
  if (st.hp < st.maxHp * 0.55) st.onFire = true;
  if (fx?.burst && Math.random() < 0.6) fx.burst(st.x, st.group.position.y + 1.2, st.z, 'debris', 3);
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
    fx?.burst?.(st.x, st.group.position.y + 1.2, st.z, 'debris', 26);
    fx?.burst?.(st.x, st.group.position.y + 0.4, st.z, 'dust', 16);
    fx?.burst?.(st.x, st.group.position.y + 1.6, st.z, 'smoke', 10);
    onEvent?.('structureDown', st);
  }
}
