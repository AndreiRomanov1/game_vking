import { findPath, formationSlots } from './pathfinding.js';
import { nearestEnemy, nearestBuilding, tryAttack } from './combat.js';
import { moveSpeed } from '../abilities.js';
import { WORLD } from '../config.js';

export function orderMove(units, map, x, z, attackMove = false) {
  const alive = units.filter((u) => !u.dead);
  const slots = formationSlots(x, z, alive.length);
  for (let i = 0; i < alive.length; i++) {
    const u = alive[i];
    const s = map.clampToWalkable(slots[i].x, slots[i].z);
    u.path = findPath(map, u.x, u.z, s.x, s.z);
    u.pathI = 0;
    u.order = attackMove ? 'attack-move' : 'move';
    u.target = null;
    u.state = 'move';
  }
}

export function orderAttack(units, map, target) {
  for (const u of units) {
    if (u.dead) continue;
    u.target = target;
    u.order = 'attack';
    const tx = target.x;
    const tz = target.z;
    const reach = Math.max(0.6, (u.def.range > 3 ? u.def.range * 0.55 : 1.1));
    const dx = u.x - tx;
    const dz = u.z - tz;
    const d = Math.hypot(dx, dz) || 1;
    const gx = tx + (dx / d) * Math.min(reach, d);
    const gz = tz + (dz / d) * Math.min(reach, d);
    const s = map.clampToWalkable(gx, gz);
    u.path = findPath(map, u.x, u.z, s.x, s.z);
    u.pathI = 0;
    u.state = 'move';
  }
}

export function updateMovement(units, map, dt) {
  for (const u of units) {
    if (u.dead || u.state === 'aboard' || u.state === 'jump') continue;
    if (!u.path || u.pathI >= u.path.length) {
      if (u.state === 'move' && u.order !== 'attack' && u.order !== 'attack-move') u.state = 'idle';
      continue;
    }
    const p = u.path[u.pathI];
    const dx = p.x - u.x;
    const dz = p.z - u.z;
    const dist = Math.hypot(dx, dz);
    const step = moveSpeed(u) * dt;
    if (dist <= step + 0.05) {
      u.x = p.x;
      u.z = p.z;
      u.pathI++;
    } else {
      u.x += (dx / dist) * step;
      u.z += (dz / dist) * step;
      u.facing = dx >= 0 ? 1 : -1;
      u.state = 'move';
      u.frame = 'walk';
    }
  }

  for (let i = 0; i < units.length; i++) {
    const a = units[i];
    if (a.dead || a.state === 'aboard') continue;
    for (let j = i + 1; j < units.length; j++) {
      const b = units[j];
      if (b.dead || b.state === 'aboard') continue;
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const d = Math.hypot(dx, dz);
      const min = a.def.radius + b.def.radius;
      if (d > 0.001 && d < min) {
        const push = (min - d) * 0.4;
        const nx = dx / d;
        const nz = dz / d;
        a.x -= nx * push * 0.5;
        a.z -= nz * push * 0.5;
        b.x += nx * push * 0.5;
        b.z += nz * push * 0.5;
      }
    }
    if (a.state !== 'aboard' && a.state !== 'jump' && !map.isWalkableWorld(a.x, a.z)) {
      const c = map.clampToWalkable(a.x, a.z);
      a.x = c.x;
      a.z = c.z;
    }
  }
}

export function orderStop(units) {
  for (const u of units) {
    if (u.dead) continue;
    u.path = [];
    u.pathI = 0;
    u.target = null;
    u.order = 'idle';
    u.state = 'idle';
  }
}

export function orderHold(units) {
  for (const u of units) {
    if (u.dead) continue;
    u.path = [];
    u.pathI = 0;
    u.target = null;
    u.order = 'hold';
    u.state = 'idle';
  }
}

export function updateVikingAuto(units, buildings, combat, scene, dt, nightT = 0) {
  for (const u of units) {
    if (u.dead || u.side !== 'viking') continue;
    if (u.state === 'aboard' || u.state === 'jump') continue;
    if (u.order === 'idle' || u.order === 'move') continue;
    if (u.order === 'hold') {
      const enemy = nearestEnemy(u, units, u.def.range + 0.4);
      if (enemy) tryAttack(u, enemy, buildings, combat, scene, dt, nightT);
      continue;
    }
    if (u.order === 'attack' && u.target && !u.target.dead) {
      if (tryAttack(u, u.target, buildings, combat, scene, dt, nightT)) {
        u.path = [];
      }
      continue;
    }
    const enemy = nearestEnemy(u, units, u.def.melee ? 7 : 11);
    if (enemy && tryAttack(u, enemy, buildings, combat, scene, dt, nightT)) {
      u.path = [];
      continue;
    }
    if (u.order === 'attack-move') {
      const b = nearestBuilding(u, buildings, u.def.melee ? 4 : 10);
      if (b && tryAttack(u, b, buildings, combat, scene, dt, nightT)) u.path = [];
    }
  }
}

export function updateDefenders(units, buildings, map, combat, scene, dt, alert) {
  for (const u of units) {
    if (u.dead || u.side !== 'defend') continue;
    const aggro = u.kind === 'chief' ? 11 : u.def.melee ? 13 : 14;
    const enemy = nearestEnemy(u, units, alert ? aggro + 8 : aggro);
    const guardHall =
      u.kind === 'chief' || (u.kind === 'militia' && u.home.z < -2.8);
    if (enemy) {
      if (tryAttack(u, enemy, buildings, combat, scene, dt, 0)) {
        u.path = [];
        continue;
      }
      const enemyAtHall = Math.hypot(enemy.x - WORLD.longhouse.x, enemy.z - WORLD.longhouse.z) < 9;
      if (guardHall && alert && !enemyAtHall) {
        if (Math.hypot(u.x - u.home.x, u.z - u.home.z) > 1.8 && !u.path.length) {
          u.path = findPath(map, u.x, u.z, u.home.x, u.home.z);
          u.pathI = 0;
          u.state = 'move';
        }
        continue;
      }
      if (u.def.melee || alert) {
        if (!u.path.length || Math.random() < dt * 0.8) {
          const s = map.clampToWalkable(enemy.x, enemy.z);
          u.path = findPath(map, u.x, u.z, s.x, s.z);
          u.pathI = 0;
          u.state = 'move';
          u.order = 'attack';
          u.target = enemy;
        }
      }
    } else if (u.kind !== 'darcher' && Math.hypot(u.x - u.home.x, u.z - u.home.z) > 1.4) {
      if (!u.path.length) {
        u.path = findPath(map, u.x, u.z, u.home.x, u.home.z);
        u.pathI = 0;
        u.state = 'move';
        u.order = 'move';
      }
    } else {
      u.state = 'idle';
      u.frame = 'idle';
    }
  }
}

export function disembark(unit, dest, map) {
  unit.state = 'jump';
  unit.jumpT = 0;
  unit.jumpFrom = { x: unit.x, y: unit.y, z: unit.z };
  const s = map.clampToWalkable(dest.x, dest.z);
  unit.jumpTo = s;
  unit.ship = null;
}
