import * as THREE from 'three';
import { UNIT_TYPES } from '../config.js';
import { getSpriteMaps, makeShadowTex } from './sprites.js';
import { terrainHeight } from '../world/map.js';

const plane = new THREE.PlaneGeometry(1, 1.28);
const shadowGeo = new THREE.PlaneGeometry(1, 1);
const ringGeo = new THREE.RingGeometry(0.42, 0.52, 20);

export function createUnit(kind, x, z, extras = {}) {
  const def = UNIT_TYPES[kind];
  const maps = getSpriteMaps(def.sprite);
  const mat = new THREE.MeshLambertMaterial({
    map: maps.idle,
    transparent: true,
    alphaTest: 0.35,
    side: THREE.DoubleSide,
    emissive: new THREE.Color(0x33220a),
    emissiveIntensity: 0.35,
  });
  const mesh = new THREE.Mesh(plane, mat);
  mesh.scale.set(def.scale, def.scale, 1);
  mesh.castShadow = false;
  const shadow = new THREE.Mesh(
    shadowGeo,
    new THREE.MeshBasicMaterial({
      map: makeShadowTex(),
      transparent: true,
      depthWrite: false,
      opacity: 0.9,
    }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.scale.set(0.95 * def.scale, 0.55 * def.scale, 1);

  const ring = new THREE.Mesh(
    ringGeo,
    new THREE.MeshBasicMaterial({
      color: def.side === 'viking' ? 0x7cff4a : 0xff5a3a,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
    }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.visible = false;

  const hp = def.hp;
  const unit = {
    id: Math.random().toString(36).slice(2, 9),
    kind,
    def,
    side: def.side,
    x,
    z,
    y: terrainHeight(x, z),
    hp,
    maxHp: hp,
    mesh,
    mat,
    maps,
    shadow,
    ring,
    path: [],
    pathI: 0,
    state: extras.state || 'idle',
    order: extras.order || 'idle',
    target: null,
    cooldown: Math.random() * 0.4,
    bob: Math.random() * 10,
    frame: 'idle',
    selected: false,
    dead: false,
    hitFlash: 0,
    jumpT: extras.jumpT ?? 1,
    jumpFrom: extras.jumpFrom || null,
    home: { x, z },
    ship: extras.ship || null,
    local: extras.local || null,
    facing: 1,
    buffs: { rage: 0, wall: 0, volley: 0 },
    abilityCd: { rage: 0, wall: 0, volley: 0 },
  };
  place(unit);
  return unit;
}

export function place(unit) {
  const h = unit.y;
  unit.mesh.position.set(unit.x, h + 0.72 * unit.def.scale, unit.z);
  unit.shadow.position.set(unit.x, h + 0.04, unit.z);
  unit.ring.position.set(unit.x, h + 0.06, unit.z);
}

export function setSelected(unit, on) {
  unit.selected = on;
  unit.ring.visible = on;
}

export function killUnit(unit, fx, floats) {
  if (unit.dead) return;
  unit.dead = true;
  unit.selected = false;
  unit.ring.visible = false;
  unit.state = 'dead';
  unit.path = [];
  fx?.burst?.(unit.x, unit.y + 0.8, unit.z, 'hit', 10);
  floats?.spawn?.(unit.x, unit.y + 1.4, unit.z, unit.side === 'viking' ? 'Ой!' : 'Ай!', '#ffe08a');
}

export function updateBillboards(units, camera) {
  for (const u of units) {
    if (!u.mesh.visible) continue;
    u.mesh.lookAt(camera.position.x, u.mesh.position.y, camera.position.z);
  }
}

export function addUnitToScene(scene, unit) {
  scene.add(unit.mesh, unit.shadow, unit.ring);
}

export function removeUnitVisual(scene, unit) {
  scene.remove(unit.mesh, unit.shadow, unit.ring);
}
