import { ABILITIES, FUN_LINES } from './config.js';

export function readyAbilities(units) {
  const picked = units.filter((u) => !u.dead && u.selected && u.side === 'viking');
  const out = [];
  for (const ab of Object.values(ABILITIES)) {
    const match = picked.filter((u) => ab.kinds.includes(u.kind));
    const ready = match.filter((u) => (u.abilityCd[ab.id] || 0) <= 0);
    const cd = match.reduce((m, u) => Math.max(m, u.abilityCd[ab.id] || 0), 0);
    out.push({
      ...ab,
      available: match.length > 0,
      ready: ready.length > 0,
      count: match.length,
      cooldownLeft: cd,
    });
  }
  return out;
}

export function useAbility(units, id, hud, audio, floats) {
  const ab = ABILITIES[id];
  if (!ab) return false;
  const match = units.filter(
    (u) => !u.dead && u.selected && u.side === 'viking' && ab.kinds.includes(u.kind) && (u.abilityCd[id] || 0) <= 0,
  );
  if (!match.length) return false;
  for (const u of match) {
    u.abilityCd[id] = ab.cooldown;
    if (id === 'rage') u.buffs.rage = ab.duration;
    if (id === 'wall') u.buffs.wall = ab.duration;
    if (id === 'volley') u.buffs.volley = ab.shots;
    floats?.spawn?.(u.x, u.y + 1.6, u.z, ab.name, id === 'wall' ? '#9ad4ff' : '#ffd24a');
  }
  hud?.say?.(FUN_LINES[id][0]);
  audio?.ability?.();
  return true;
}

export function tickBuffs(units, dt) {
  for (const u of units) {
    if (!u.buffs) continue;
    if (u.buffs.rage > 0) u.buffs.rage = Math.max(0, u.buffs.rage - dt);
    if (u.buffs.wall > 0) u.buffs.wall = Math.max(0, u.buffs.wall - dt);
    for (const key of Object.keys(u.abilityCd || {})) {
      u.abilityCd[key] = Math.max(0, u.abilityCd[key] - dt);
    }
  }
}

export function moveSpeed(unit) {
  let s = unit.def.speed;
  if (unit.buffs?.rage > 0) s *= 1.38;
  if (unit.buffs?.wall > 0) s *= 0.62;
  return s;
}

export function attackDamage(unit) {
  let dmg = unit.def.damage;
  if (unit.buffs?.rage > 0) dmg *= 1.45;
  if (unit.buffs?.volley > 0) dmg *= 1.4;
  return dmg;
}
