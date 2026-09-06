import { WORLD } from '../config.js';

const MIN_X = -24;
const MAX_X = 24;
const MIN_Z = -16;
const MAX_Z = 26;

export function createMinimap(root, game) {
  const wrap = document.createElement('div');
  wrap.className = 'minimap';
  wrap.innerHTML = `<canvas width="168" height="168"></canvas>`;
  root.appendChild(wrap);
  const canvas = wrap.querySelector('canvas');
  const ctx = canvas.getContext('2d');

  function worldToPx(x, z) {
    const px = ((x - MIN_X) / (MAX_X - MIN_X)) * canvas.width;
    const py = ((z - MIN_Z) / (MAX_Z - MIN_Z)) * canvas.height;
    return { x: px, y: py };
  }

  function pxToWorld(px, py) {
    const r = canvas.getBoundingClientRect();
    const x = ((px - r.left) / r.width) * (MAX_X - MIN_X) + MIN_X;
    const z = ((py - r.top) / r.height) * (MAX_Z - MIN_Z) + MIN_Z;
    return { x, z };
  }

  wrap.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    const p = pxToWorld(e.clientX, e.clientY);
    game.rts.focus(p.x, p.z);
  });

  function draw(g) {
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#163a48';
    ctx.fillRect(0, 0, w, h);

    const sea = worldToPx(0, WORLD.seaZ);
    ctx.fillStyle = '#2f8a4a';
    ctx.fillRect(0, 0, w, sea.y);
    ctx.fillStyle = '#e0b46a';
    ctx.fillRect(0, sea.y - 10, w, 14);
    ctx.fillStyle = '#1a6a78';
    ctx.fillRect(0, sea.y, w, h - sea.y);

    const p0 = worldToPx(WORLD.palisade.minX, WORLD.palisade.minZ);
    const p1 = worldToPx(WORLD.palisade.maxX, WORLD.palisade.maxZ);
    ctx.fillStyle = 'rgba(90, 140, 50, 0.85)';
    ctx.fillRect(p0.x, p0.y, p1.x - p0.x, p1.y - p0.y);
    ctx.strokeStyle = '#5a3214';
    ctx.lineWidth = 2;
    ctx.strokeRect(p0.x, p0.y, p1.x - p0.x, p1.y - p0.y);

    if (g.village) {
      for (const st of g.village.structures) {
        if (st.dead) continue;
        const p = worldToPx(st.x, st.z);
        ctx.fillStyle = st.kind === 'longhouse' ? '#c45a28' : st.onFire ? '#ff7a2a' : '#8a4e28';
        const s = st.kind === 'longhouse' ? 7 : 4;
        ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
      }
    }

    for (const u of g.units) {
      if (u.dead) continue;
      const p = worldToPx(u.x, u.z);
      ctx.fillStyle = u.side === 'viking' ? (u.selected ? '#ffe08a' : '#7cff4a') : '#ff5a3a';
      ctx.beginPath();
      ctx.arc(p.x, p.y, u.selected ? 3.2 : 2.2, 0, Math.PI * 2);
      ctx.fill();
    }

    if (g.rts) {
      const t = g.rts.target;
      const c = worldToPx(t.x, t.z);
      ctx.strokeStyle = 'rgba(255,240,200,0.85)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(c.x - 14, c.y - 10, 28, 20);
    }
  }

  return { draw, wrap };
}
