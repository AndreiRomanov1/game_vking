import * as THREE from 'three';
import { FUN_LINES } from '../config.js';
import { makeArrowTex } from './sprites.js';
import { killUnit } from './unit.js';
import { damageStructure } from '../world/village.js';

export function createCombat() {
  const arrows = [];
  const geo = new THREE.PlaneGeometry(0.7, 0.16);
  const mat = new THREE.MeshBasicMaterial({
    map: makeArrowTex(),
    transparent: true,
    alphaTest: 0.3,
    side: THREE.DoubleSide,
  });

  function shoot(from, to, dmg, side) {
    const mesh = new THREE.Mesh(geo, mat);
    const y = from.y + 0.9;
    mesh.position.set(from.x, y, from.z);
    arrows.push({
      mesh,
      x: from.x,
      y,
      z: from.z,
      tx: to.x,
      ty: (to.y ?? 0.5) + 0.8,
      tz: to.z,
      v: 16,
      dmg,
      side,
      target: to.unit || null,
      building: to.building || null,
      life: 1.4,
    });
    return mesh;
  }

  function update(dt, units, buildings, scene, fx, floats, map, onEvent) {
    for (let i = arrows.length - 1; i >= 0; i--) {
      const a = arrows[i];
      const dx = a.tx - a.x;
      const dy = a.ty - a.y;
      const dz = a.tz - a.z;
      const dist = Math.hypot(dx, dy, dz) || 0.001;
      const step = a.v * dt;
      if (step >= dist || a.life <= 0) {
        applyHit(a, units, buildings, fx, floats, map, onEvent);
        scene.remove(a.mesh);
        arrows.splice(i, 1);
        continue;
      }
      a.x += (dx / dist) * step;
      a.y += (dy / dist) * step;
      a.z += (dz / dist) * step;
      a.life -= dt;
      a.mesh.position.set(a.x, a.y, a.z);
      a.mesh.lookAt(a.tx, a.ty, a.tz);
    }
  }

  return { shoot, update, arrows };
}

function pickLine(list) {
  return list[(Math.random() * list.length) | 0];
}

export function applyDamage(unit, dmg, fx, floats) {
  if (unit.dead) return;
  unit.hp -= dmg;
  unit.hitFlash = 0.12;
  fx?.burst?.(unit.x, unit.y + 0.9, unit.z, 'hit', 6);
  if (Math.random() < 0.35) {
    const lines = unit.side === 'viking' ? FUN_LINES.hitViking : FUN_LINES.hitDefend;
    floats?.spawn?.(unit.x, unit.y + 1.5, unit.z, pickLine(lines), unit.side === 'viking' ? '#ffd24a' : '#fff0d0');
  }
  if (unit.hp <= 0) killUnit(unit, fx, floats);
}

function applyHit(a, units, buildings, fx, floats, map, onEvent) {
  if (a.target && !a.target.dead) {
    applyDamage(a.target, a.dmg, fx, floats);
    return;
  }
  if (a.building && !a.building.dead) {
    damageStructure(a.building, a.dmg, map, fx, onEvent, buildings);
    return;
  }
  let best = null;
  let bestD = 0.9;
  for (const u of units) {
    if (u.dead || u.side === a.side) continue;
    const d = Math.hypot(u.x - a.x, u.z - a.z);
    if (d < bestD) {
      bestD = d;
      best = u;
    }
  }
  if (best) applyDamage(best, a.dmg, fx, floats);
}

export function tryAttack(unit, target, buildings, combat, scene, dt) {
  if (!target || unit.dead) return false;
  const isB = target.building || target.kind === 'gate' || target.hp !== undefined && target.group;
  const tx = target.x;
  const tz = target.z;
  const range = unit.def.range + (isB ? (target.radius || 1) : target.def?.radius || 0.4);
  const d = Math.hypot(unit.x - tx, unit.z - tz);
  if (d > range + 0.15) return false;
  unit.cooldown -= dt;
  unit.state = 'attack';
  unit.frame = 'attack';
  if (unit.cooldown > 0) return true;
  unit.cooldown = unit.def.cooldown;
  unit.bob += 2;
  if (unit.def.melee) {
    unit._pendingMelee = { target, dmg: unit.def.damage };
  } else {
    const dest = isB
      ? { x: tx, z: tz, y: 1.2, building: target }
      : { x: tx, z: tz, y: target.y, unit: target };
    const mesh = combat.shoot(unit, dest, unit.def.damage, unit.side);
    scene.add(mesh);
  }
  return true;
}

export function resolveMelee(units, buildings, fx, floats, map, onEvent) {
  for (const u of units) {
    const p = u._pendingMelee;
    if (!p) continue;
    u._pendingMelee = null;
    if (p.target.group && !p.target.dead) {
      damageStructure(p.target, p.dmg, map, fx, onEvent, buildings);
    } else if (p.target.hp !== undefined && !p.target.dead && p.target.mesh) {
      applyDamage(p.target, p.dmg, fx, floats);
    }
  }
}

export function nearestEnemy(unit, units, maxD = 1e9) {
  let best = null;
  let bd = maxD;
  for (const o of units) {
    if (o.dead || o.side === unit.side) continue;
    const d = Math.hypot(o.x - unit.x, o.z - unit.z);
    if (d < bd) {
      bd = d;
      best = o;
    }
  }
  return best;
}

export function nearestBuilding(unit, buildings, maxD = 1e9) {
  let best = null;
  let bd = maxD;
  for (const b of buildings) {
    if (b.dead) continue;
    const d = Math.hypot(b.x - unit.x, b.z - unit.z);
    if (d < bd) {
      bd = d;
      best = b;
    }
  }
  return best;
}
