import { WORLD } from '../config.js';

export function hash2(x, z) {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

export function noise2(x, z) {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const a = hash2(ix, iz);
  const b = hash2(ix + 1, iz);
  const c = hash2(ix, iz + 1);
  const d = hash2(ix + 1, iz + 1);
  const ux = fx * fx * (3 - 2 * fx);
  const uz = fz * fz * (3 - 2 * fz);
  return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz;
}

export function fbm(x, z) {
  return (
    noise2(x, z) * 0.55 +
    noise2(x * 2.1, z * 2.1) * 0.28 +
    noise2(x * 4.3, z * 4.3) * 0.17
  );
}

export function terrainHeight(x, z) {
  const n = fbm(x * 0.12, z * 0.12) - 0.5;
  const shore = WORLD.seaZ;
  let h;

  if (z > shore) {
    const t = Math.min(1, (z - shore) / 22);
    h = -0.08 - t * 2.15 + n * 0.08;
    h += Math.sin(x * 0.18) * 0.04;
  } else if (z > WORLD.beachZ0) {
    const t = (z - WORLD.beachZ0) / (shore - WORLD.beachZ0);
    h = 0.4 * (1 - t) + 0.02 * t + n * 0.05;
  } else {
    h = 0.44 + n * 0.07;
    if (z < -8) {
      const t = Math.min(1, (-8 - z) / 18);
      h += t * t * 4.8 + Math.max(0, Math.abs(x) - 5) * 0.1 * t;
      h += fbm(x * 0.08 + 9, z * 0.08) * t * 1.4;
    }
    const side = Math.max(0, Math.abs(x) - 18);
    h += side * 0.28;
  }

  if (Math.abs(x) < 14.5 && z < 6.4 && z > -12.4) {
    const edge = Math.min(
      1,
      Math.min(14.5 - Math.abs(x), 6.4 - z, z + 12.4) / 2.2,
    );
    const yard = 0.43 + n * 0.02;
    h = yard * edge + h * (1 - edge);
  }

  return h;
}

export function createMap() {
  const cell = 1;
  const originX = -36;
  const originZ = -32;
  const cols = 72;
  const rows = 78;
  const walk = new Uint8Array(cols * rows);
  const cost = new Float32Array(cols * rows);

  const idx = (i, j) => j * cols + i;

  const worldToCell = (x, z) => ({
    i: Math.floor((x - originX) / cell),
    j: Math.floor((z - originZ) / cell),
  });

  const cellToWorld = (i, j) => ({
    x: originX + (i + 0.5) * cell,
    z: originZ + (j + 0.5) * cell,
  });

  const inBounds = (i, j) => i >= 0 && j >= 0 && i < cols && j < rows;

  function rebuild(gateOpen) {
    walk.fill(0);
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const { x, z } = cellToWorld(i, j);
        const h = terrainHeight(x, z);
        let ok = h > 0.06 && z < WORLD.seaZ - 0.35;
        if (Math.abs(x) > 22 && h > 1.6) ok = false;
        if (z < -13.5 && h > 1.3) ok = false;

        const p = WORLD.palisade;
        const onWallX =
          (Math.abs(x - p.minX) < 0.7 || Math.abs(x - p.maxX) < 0.7) &&
          z > p.minZ - 0.6 &&
          z < p.maxZ + 0.6;
        const onWallZ =
          (Math.abs(z - p.minZ) < 0.7 || Math.abs(z - p.maxZ) < 0.7) &&
          x > p.minX - 0.6 &&
          x < p.maxX + 0.6;
        const inGate =
          Math.abs(x - WORLD.gate.x) < WORLD.gate.width * 0.5 &&
          Math.abs(z - WORLD.gate.z) < 1.15;
        if (onWallX || onWallZ) {
          ok = inGate ? !!gateOpen : false;
        }

        walk[idx(i, j)] = ok ? 1 : 0;
        cost[idx(i, j)] = ok ? 1 : 0;
      }
    }
  }

  rebuild(false);

  function syncBuildings(structures) {
    rebuild(!!this.gateOpen);
    if (!structures) return;
    for (const s of structures) {
      if (s.dead || s.kind === 'gate') continue;
      const w = s.kind === 'longhouse' ? WORLD.longhouse.w : Math.max(1.6, s.radius * 2);
      const d = s.kind === 'longhouse' ? WORLD.longhouse.d : Math.max(1.6, s.radius * 2);
      markBuilding(s.x, s.z, w, d, true);
    }
  }

  function isWalkableWorld(x, z) {
    const { i, j } = worldToCell(x, z);
    if (!inBounds(i, j)) return false;
    return walk[idx(i, j)] === 1;
  }

  function clampToWalkable(x, z) {
    if (isWalkableWorld(x, z)) return { x, z };
    let best = { x, z };
    let bestD = 1e9;
    for (let r = 1; r <= 8; r++) {
      for (let a = 0; a < 12; a++) {
        const ang = (a / 12) * Math.PI * 2;
        const nx = x + Math.cos(ang) * r;
        const nz = z + Math.sin(ang) * r;
        if (isWalkableWorld(nx, nz)) {
          const d = (nx - x) ** 2 + (nz - z) ** 2;
          if (d < bestD) {
            bestD = d;
            best = { x: nx, z: nz };
          }
        }
      }
      if (bestD < 1e8) return best;
    }
    return best;
  }

  function markBuilding(x, z, w, d, blocked) {
    const min = worldToCell(x - w * 0.5, z - d * 0.5);
    const max = worldToCell(x + w * 0.5, z + d * 0.5);
    for (let j = min.j; j <= max.j; j++) {
      for (let i = min.i; i <= max.i; i++) {
        if (!inBounds(i, j)) continue;
        walk[idx(i, j)] = blocked ? 0 : 1;
      }
    }
  }

  return {
    cell,
    originX,
    originZ,
    cols,
    rows,
    walk,
    idx,
    inBounds,
    worldToCell,
    cellToWorld,
    rebuild,
    syncBuildings,
    isWalkableWorld,
    clampToWalkable,
    markBuilding,
    gateOpen: false,
  };
}
