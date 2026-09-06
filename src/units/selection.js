import * as THREE from 'three';
import { setSelected } from './unit.js';

const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

export function pointerNdc(e, canvas) {
  const r = canvas.getBoundingClientRect();
  ndc.x = ((e.clientX - r.left) / r.width) * 2 - 1;
  ndc.y = -((e.clientY - r.top) / r.height) * 2 + 1;
  return ndc;
}

export function pickGround(camera, e, canvas, terrainMesh) {
  pointerNdc(e, canvas);
  raycaster.setFromCamera(ndc, camera);
  if (terrainMesh) {
    const hit = raycaster.intersectObject(terrainMesh, false)[0];
    if (hit) return hit.point;
  }
  const out = new THREE.Vector3();
  raycaster.ray.intersectPlane(ground, out);
  return out;
}

export function pickBuilding(camera, e, canvas, structures) {
  pointerNdc(e, canvas);
  raycaster.setFromCamera(ndc, camera);
  const meshes = [];
  for (const s of structures) {
    if (s.dead) continue;
    s.group.traverse((ch) => {
      if (ch.isMesh) meshes.push(ch);
    });
  }
  const hits = raycaster.intersectObjects(meshes, false);
  if (!hits.length) return null;
  let obj = hits[0].object;
  while (obj) {
    const found = structures.find((s) => s.group === obj);
    if (found) return found;
    obj = obj.parent;
  }
  return null;
}

export function unitAtPoint(units, point, side = null) {
  let best = null;
  let bd = 0.95;
  for (const u of units) {
    if (u.dead) continue;
    if (side && u.side !== side) continue;
    const d = Math.hypot(u.x - point.x, u.z - point.z);
    const r = 0.7 * u.def.scale;
    if (d < r && d < bd) {
      bd = d;
      best = u;
    }
  }
  return best;
}

export function selectInBox(units, camera, canvas, x0, y0, x1, y1) {
  const r = canvas.getBoundingClientRect();
  const minX = Math.min(x0, x1);
  const maxX = Math.max(x0, x1);
  const minY = Math.min(y0, y1);
  const maxY = Math.max(y0, y1);
  const v = new THREE.Vector3();
  const picked = [];
  for (const u of units) {
    if (u.dead || u.side !== 'viking') continue;
    v.set(u.x, u.y + 0.8, u.z).project(camera);
    const sx = (v.x * 0.5 + 0.5) * r.width + r.left;
    const sy = (-v.y * 0.5 + 0.5) * r.height + r.top;
    if (sx >= minX && sx <= maxX && sy >= minY && sy <= maxY) picked.push(u);
  }
  return picked;
}

export function applySelection(units, picked) {
  const set = new Set(picked);
  for (const u of units) setSelected(u, set.has(u));
}
