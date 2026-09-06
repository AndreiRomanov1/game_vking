import * as THREE from 'three';
import { VILLAGERS, WORLD, LOOT, FUN_LINES } from '../config.js';
import { terrainHeight } from './map.js';
import { getSpriteMaps } from '../units/sprites.js';

export function createVillagers(scene) {
  const maps = getSpriteMaps('villager');
  const list = [];
  const plane = new THREE.PlaneGeometry(1, 1.2);
  for (const s of VILLAGERS) {
    const mat = new THREE.MeshLambertMaterial({
      map: maps.idle,
      transparent: true,
      alphaTest: 0.35,
      side: THREE.DoubleSide,
      emissive: 0x221508,
      emissiveIntensity: 0.25,
    });
    const mesh = new THREE.Mesh(plane, mat);
    mesh.scale.set(1.35, 1.35, 1);
    const y = terrainHeight(s.x, s.z);
    mesh.position.set(s.x, y + 0.85, s.z);
    scene.add(mesh);
    list.push({
      x: s.x,
      z: s.z,
      y,
      mesh,
      mat,
      maps,
      gone: false,
      flee: false,
      vx: 0,
      vz: 0,
      bob: Math.random() * 8,
      home: { x: s.x, z: s.z },
    });
  }
  return list;
}

export function updateVillagers(list, units, dt, camera, onPurse) {
  const hall = WORLD.longhouse;
  for (const v of list) {
    if (v.gone) continue;
    let near = null;
    let nd = 11;
    for (const u of units) {
      if (u.dead || u.side !== 'viking' || u.state === 'aboard') continue;
      const d = Math.hypot(u.x - v.x, u.z - v.z);
      if (d < nd) {
        nd = d;
        near = u;
      }
    }

    if (near && nd < 10) {
      v.flee = true;
      const awayX = v.x - near.x;
      const awayZ = v.z - near.z;
      const toHallX = hall.x - v.x;
      const toHallZ = hall.z - v.z;
      const mixX = toHallX * 1.4 + awayX * 0.4;
      const mixZ = toHallZ * 1.4 + awayZ * 0.4;
      const len = Math.hypot(mixX, mixZ) || 1;
      v.vx = (mixX / len) * 2.8;
      v.vz = (mixZ / len) * 2.8;
    }

    if (near && nd < 1.2) {
      v.gone = true;
      v.mesh.visible = false;
      onPurse?.(v, LOOT.purse, FUN_LINES.loot);
      continue;
    }

    if (v.flee) {
      v.x += v.vx * dt;
      v.z += v.vz * dt;
      v.mat.map = v.maps.walk;
      if (Math.hypot(v.x - hall.x, v.z - hall.z) < 2.4) {
        v.gone = true;
        v.mesh.visible = false;
        continue;
      }
    } else {
      v.bob += dt * 2.2;
      v.x = v.home.x + Math.sin(v.bob) * 0.35;
      v.z = v.home.z + Math.cos(v.bob * 0.7) * 0.25;
      v.mat.map = v.maps.idle;
    }

    v.y = terrainHeight(v.x, v.z);
    v.mesh.position.set(v.x, v.y + 0.82, v.z);
    v.mesh.lookAt(camera.position.x, v.mesh.position.y, camera.position.z);
  }
}
