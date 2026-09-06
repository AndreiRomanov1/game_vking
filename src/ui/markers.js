import * as THREE from 'three';
import { terrainHeight } from '../world/map.js';

export function createMarkers(scene) {
  const items = [];
  const ringGeo = new THREE.RingGeometry(0.35, 0.55, 28);
  const flagGeo = new THREE.ConeGeometry(0.12, 0.35, 5);

  function spawn(x, z, color, attack) {
    const y = terrainHeight(x, z) + 0.05;
    const ring = new THREE.Mesh(
      ringGeo,
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.95,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, y, z);
    scene.add(ring);
    let flag = null;
    if (!attack) {
      flag = new THREE.Mesh(
        flagGeo,
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 }),
      );
      flag.position.set(x, y + 0.45, z);
      scene.add(flag);
    }
    items.push({ ring, flag, life: 0.85, x, z });
  }

  function move(x, z) {
    spawn(x, z, 0x7cff4a, false);
  }

  function attack(x, z) {
    spawn(x, z, 0xff5a3a, true);
  }

  function update(dt) {
    for (let i = items.length - 1; i >= 0; i--) {
      const it = items[i];
      it.life -= dt;
      const t = Math.max(0, it.life / 0.85);
      const s = 0.7 + (1 - t) * 1.4;
      it.ring.scale.setScalar(s);
      it.ring.material.opacity = t * 0.9;
      if (it.flag) {
        it.flag.position.y = terrainHeight(it.x, it.z) + 0.35 + (1 - t) * 0.4;
        it.flag.material.opacity = t;
      }
      if (it.life <= 0) {
        scene.remove(it.ring);
        if (it.flag) scene.remove(it.flag);
        items.splice(i, 1);
      }
    }
  }

  return { move, attack, update };
}
