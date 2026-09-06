import * as THREE from 'three';

const CACHE = {};

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  return { c, ctx };
}

function strokeFill(ctx, fill, lw = 5) {
  ctx.fillStyle = fill;
  ctx.lineWidth = lw;
  ctx.strokeStyle = '#2a140c';
  ctx.fill();
  ctx.stroke();
}

function ell(ctx, x, y, rx, ry, fill, lw) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  strokeFill(ctx, fill, lw);
}

function poly(ctx, pts, fill, lw) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
  strokeFill(ctx, fill, lw);
}

function drawLegs(ctx, frame, x, y) {
  const step = frame === 'walk' ? 10 : 0;
  ctx.fillStyle = '#2a140c';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(x - 10, y);
  ctx.lineTo(x - 12 - step, y + 22);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x + 10, y);
  ctx.lineTo(x + 12 + step, y + 22);
  ctx.stroke();
  ell(ctx, x - 14 - step, y + 24, 7, 4, '#3a2210', 4);
  ell(ctx, x + 14 + step, y + 24, 7, 4, '#3a2210', 4);
}

function face(ctx, x, y, mood = 'grin') {
  ctx.fillStyle = '#2a140c';
  ctx.beginPath();
  ctx.arc(x - 8, y - 2, 3.2, 0, Math.PI * 2);
  ctx.arc(x + 8, y - 2, 3.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff6de';
  ctx.beginPath();
  ctx.arc(x - 8, y - 3, 1.2, 0, Math.PI * 2);
  ctx.arc(x + 8, y - 3, 1.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#2a140c';
  ctx.lineWidth = 3;
  ctx.beginPath();
  if (mood === 'grin') {
    ctx.arc(x, y + 8, 8, 0.15, Math.PI - 0.15);
  } else if (mood === 'scared') {
    ctx.ellipse(x, y + 10, 5, 6, 0, 0, Math.PI * 2);
  } else {
    ctx.arc(x, y + 6, 7, 0.2, Math.PI - 0.2, true);
  }
  ctx.stroke();
}

function hornHelm(ctx, x, y, color = '#c0c8d4') {
  poly(ctx, [[x - 34, y], [x - 46, y - 22], [x - 22, y - 8]], '#f4f0e4', 4);
  poly(ctx, [[x + 34, y], [x + 46, y - 22], [x + 22, y - 8]], '#f4f0e4', 4);
  ell(ctx, x, y + 4, 30, 16, color, 5);
  ell(ctx, x, y - 2, 18, 8, '#6a7380', 3);
}

function drawBerserk(ctx, frame) {
  const w = 128;
  const h = 160;
  ctx.clearRect(0, 0, w, h);
  const cx = 64;
  drawLegs(ctx, frame, cx, 118);
  ell(ctx, cx, 92, 28, 22, '#e8b090', 5);
  ctx.save();
  ctx.translate(cx - 26, 70);
  ctx.rotate(frame === 'attack' ? -1.1 : -0.35);
  poly(ctx, [[0, 0], [8, 4], [6, 42], [-4, 42]], '#c45a28', 4);
  ell(ctx, 2, 48, 10, 10, '#8a8a90', 4);
  ctx.restore();
  ctx.save();
  ctx.translate(cx + 26, 72);
  ctx.rotate(frame === 'attack' ? 0.9 : 0.4);
  poly(ctx, [[0, 0], [-6, 6], [18, 36], [28, 28]], '#c45a28', 4);
  ctx.restore();
  ell(ctx, cx, 52, 24, 22, '#f0c2a0', 5);
  ell(ctx, cx, 62, 22, 12, '#6a2a14', 4);
  poly(ctx, [[cx - 16, 38], [cx - 8, 8], [cx + 4, 18], [cx + 18, 6], [cx + 20, 36]], '#4a1c0c', 4);
  face(ctx, cx, 50, 'grin');
  if (frame === 'attack') {
    ctx.strokeStyle = '#ffee88';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx + 36, 40, 16, -0.4, 1.2);
    ctx.stroke();
  }
}

function drawVArcher(ctx, frame) {
  ctx.clearRect(0, 0, 128, 160);
  const cx = 64;
  drawLegs(ctx, frame, cx, 118);
  ell(ctx, cx, 94, 22, 20, '#2f8a4a', 5);
  ell(ctx, cx, 54, 20, 20, '#f0c2a0', 5);
  ell(ctx, cx, 40, 22, 12, '#3a6a2a', 4);
  poly(ctx, [[cx + 10, 36], [cx + 28, 18], [cx + 16, 38]], '#e8d24a', 3);
  face(ctx, cx, 54, 'grin');
  ctx.save();
  ctx.translate(cx + 18, 78);
  ctx.rotate(frame === 'attack' ? -0.4 : 0.15);
  ctx.strokeStyle = '#2a140c';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(10, 0, 22, -1.2, 1.2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(10, -20);
  ctx.lineTo(10, 20);
  ctx.stroke();
  if (frame === 'attack') {
    ctx.beginPath();
    ctx.moveTo(-16, 0);
    ctx.lineTo(28, 0);
    ctx.stroke();
  }
  ctx.restore();
}

function drawShield(ctx, frame) {
  ctx.clearRect(0, 0, 128, 160);
  const cx = 64;
  drawLegs(ctx, frame, cx, 118);
  ell(ctx, cx, 94, 24, 20, '#2a5aaa', 5);
  ell(ctx, cx, 54, 20, 19, '#f0c2a0', 5);
  hornHelm(ctx, cx, 38, '#c8d0dc');
  face(ctx, cx, 56, 'grin');
  const ox = frame === 'attack' ? 8 : 0;
  ell(ctx, cx - 18 + ox, 92, 22, 22, '#c42a22', 5);
  ell(ctx, cx - 18 + ox, 92, 10, 10, '#e8d24a', 4);
  ctx.save();
  ctx.translate(cx + 24, 80);
  ctx.rotate(frame === 'attack' ? 0.8 : 0.2);
  poly(ctx, [[0, -8], [8, -6], [6, 40], [-2, 40]], '#c0c4c8', 4);
  ctx.restore();
}

function drawMilitia(ctx, frame) {
  ctx.clearRect(0, 0, 128, 160);
  const cx = 64;
  drawLegs(ctx, frame, cx, 118);
  ell(ctx, cx, 96, 24, 20, '#c48a3a', 5);
  ell(ctx, cx, 56, 20, 18, '#f0c2a0', 5);
  ell(ctx, cx, 40, 16, 10, '#8a5a2a', 4);
  face(ctx, cx, 58, 'scared');
  ctx.save();
  ctx.translate(cx + 18, 70);
  ctx.rotate(frame === 'attack' ? -0.9 : -0.2);
  ctx.strokeStyle = '#2a140c';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(6, 48);
  ctx.stroke();
  poly(ctx, [[0, 48], [18, 42], [6, 58], [0, 52]], '#8a8f6a', 4);
  ctx.restore();
}

function drawDArcher(ctx, frame) {
  ctx.clearRect(0, 0, 128, 160);
  const cx = 64;
  drawLegs(ctx, frame, cx, 118);
  ell(ctx, cx, 96, 21, 18, '#8a7a4a', 5);
  ell(ctx, cx, 56, 18, 17, '#f0c2a0', 5);
  ell(ctx, cx, 42, 20, 14, '#6a7380', 5);
  ctx.fillStyle = '#2a140c';
  ctx.fillRect(46, 40, 36, 6);
  face(ctx, cx, 60, 'scared');
  ctx.save();
  ctx.translate(cx + 16, 80);
  ctx.rotate(frame === 'attack' ? -0.35 : 0.2);
  ctx.strokeStyle = '#2a140c';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(8, 0, 20, -1.1, 1.1);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(8, -18);
  ctx.lineTo(8, 18);
  ctx.stroke();
  ctx.restore();
}

function drawChief(ctx, frame) {
  ctx.clearRect(0, 0, 128, 160);
  const cx = 64;
  drawLegs(ctx, frame, cx, 124);
  ell(ctx, cx, 100, 36, 26, '#6a3a88', 5);
  ell(ctx, cx, 108, 28, 16, '#e8c878', 4);
  ell(ctx, cx, 58, 26, 22, '#f0c2a0', 5);
  ell(ctx, cx, 70, 22, 10, '#6a2a14', 4);
  hornHelm(ctx, cx, 36, '#e8c84a');
  face(ctx, cx, 58, 'angry');
  ctx.save();
  ctx.translate(cx + 30, 78);
  ctx.rotate(frame === 'attack' ? 1.0 : 0.35);
  poly(ctx, [[0, 0], [12, 8], [18, 46], [-4, 40]], '#8a8a90', 5);
  ell(ctx, 10, 50, 14, 14, '#6a6a70', 4);
  ctx.restore();
}

const DRAW = {
  berserk: drawBerserk,
  varcher: drawVArcher,
  shield: drawShield,
  militia: drawMilitia,
  darcher: drawDArcher,
  chief: drawChief,
};

export function getSpriteMaps(kind) {
  if (CACHE[kind]) return CACHE[kind];
  const frames = {};
  for (const f of ['idle', 'walk', 'attack']) {
    const { c, ctx } = canvas(128, 160);
    DRAW[kind](ctx, f);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    frames[f] = tex;
  }
  CACHE[kind] = frames;
  return frames;
}

export function makeArrowTex() {
  if (CACHE.arrow) return CACHE.arrow;
  const { c, ctx } = canvas(64, 16);
  ctx.strokeStyle = '#2a140c';
  ctx.fillStyle = '#d8c49a';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(6, 8);
  ctx.lineTo(48, 8);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(46, 2);
  ctx.lineTo(62, 8);
  ctx.lineTo(46, 14);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  const tex = new THREE.CanvasTexture(c);
  CACHE.arrow = tex;
  return tex;
}

export function makeShadowTex() {
  if (CACHE.shadow) return CACHE.shadow;
  const { c, ctx } = canvas(64, 64);
  const g = ctx.createRadialGradient(32, 32, 4, 32, 32, 28);
  g.addColorStop(0, 'rgba(20,10,4,0.45)');
  g.addColorStop(1, 'rgba(20,10,4,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  CACHE.shadow = new THREE.CanvasTexture(c);
  return CACHE.shadow;
}
