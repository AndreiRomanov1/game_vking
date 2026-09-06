const DIRS = [
  [1, 0, 1],
  [-1, 0, 1],
  [0, 1, 1],
  [0, -1, 1],
  [1, 1, 1.41],
  [1, -1, 1.41],
  [-1, 1, 1.41],
  [-1, -1, 1.41],
];

function heur(i, j, gi, gj) {
  const dx = Math.abs(i - gi);
  const dy = Math.abs(j - gj);
  return dx + dy + (1.41 - 2) * Math.min(dx, dy);
}

export function findPath(map, x0, z0, x1, z1) {
  const a = map.worldToCell(x0, z0);
  const goalWant = map.worldToCell(x1, z1);
  let g = { ...goalWant };
  if (!map.inBounds(g.i, g.j) || map.walk[map.idx(g.i, g.j)] !== 1) {
    let found = false;
    for (let r = 1; r <= 10 && !found; r++) {
      for (let dj = -r; dj <= r && !found; dj++) {
        for (let di = -r; di <= r; di++) {
          const i = goalWant.i + di;
          const j = goalWant.j + dj;
          if (map.inBounds(i, j) && map.walk[map.idx(i, j)] === 1) {
            g = { i, j };
            found = true;
            break;
          }
        }
      }
    }
    if (!found) return [];
  }
  if (!map.inBounds(a.i, a.j)) return [];

  const startKey = a.i + a.j * map.cols;
  const goalKey = g.i + g.j * map.cols;
  if (startKey === goalKey) return [{ x: x1, z: z1 }];

  const open = [startKey];
  const came = new Int32Array(map.cols * map.rows).fill(-1);
  const gScore = new Float32Array(map.cols * map.rows).fill(1e9);
  const fScore = new Float32Array(map.cols * map.rows).fill(1e9);
  const inOpen = new Uint8Array(map.cols * map.rows);
  gScore[startKey] = 0;
  fScore[startKey] = heur(a.i, a.j, g.i, g.j);
  inOpen[startKey] = 1;

  let steps = 0;
  while (open.length && steps < 2800) {
    steps++;
    let bi = 0;
    let bv = fScore[open[0]];
    for (let k = 1; k < open.length; k++) {
      if (fScore[open[k]] < bv) {
        bv = fScore[open[k]];
        bi = k;
      }
    }
    const current = open[bi];
    open[bi] = open[open.length - 1];
    open.pop();
    inOpen[current] = 0;
    if (current === goalKey) break;
    const ci = current % map.cols;
    const cj = (current / map.cols) | 0;
    for (const [di, dj, c] of DIRS) {
      const ni = ci + di;
      const nj = cj + dj;
      if (!map.inBounds(ni, nj)) continue;
      const nk = map.idx(ni, nj);
      if (map.walk[nk] !== 1) continue;
      const ng = gScore[current] + c;
      if (ng < gScore[nk]) {
        came[nk] = current;
        gScore[nk] = ng;
        fScore[nk] = ng + heur(ni, nj, g.i, g.j);
        if (!inOpen[nk]) {
          open.push(nk);
          inOpen[nk] = 1;
        }
      }
    }
  }

  if (came[goalKey] === -1 && startKey !== goalKey) {
    return [{ x: x1, z: z1 }];
  }

  const cells = [];
  let k = goalKey;
  cells.push(k);
  while (k !== startKey && k !== -1) {
    k = came[k];
    if (k === -1) break;
    cells.push(k);
  }
  cells.reverse();
  const path = [];
  for (const key of cells) {
    const i = key % map.cols;
    const j = (key / map.cols) | 0;
    const w = map.cellToWorld(i, j);
    path.push(w);
  }
  if (path.length) path[path.length - 1] = { x: x1, z: z1 };
  return simplify(path);
}

function simplify(path) {
  if (path.length < 3) return path;
  const out = [path[0]];
  for (let i = 1; i < path.length - 1; i++) {
    const a = out[out.length - 1];
    const b = path[i];
    const c = path[i + 1];
    const abx = b.x - a.x;
    const abz = b.z - a.z;
    const bcx = c.x - b.x;
    const bcz = c.z - b.z;
    if (Math.abs(abx * bcz - abz * bcx) > 0.35) out.push(b);
  }
  out.push(path[path.length - 1]);
  return out;
}

export function formationSlots(x, z, n) {
  const slots = [];
  if (n <= 1) return [{ x, z }];
  slots.push({ x, z });
  let placed = 1;
  let ring = 1;
  while (placed < n) {
    const count = ring * 6;
    for (let i = 0; i < count && placed < n; i++) {
      const a = (i / count) * Math.PI * 2;
      slots.push({ x: x + Math.cos(a) * ring * 1.15, z: z + Math.sin(a) * ring * 1.15 });
      placed++;
    }
    ring++;
  }
  return slots;
}
