import * as THREE from 'three';

const cache = new Map();

function mk(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  return { c, ctx };
}

function hash(n) {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function noiseData(size, scale, octaves = 4, seed = 0) {
  const data = new Float32Array(size * size);
  let amp = 1;
  let freq = scale;
  let total = 0;
  for (let o = 0; o < octaves; o++) {
    const cells = Math.max(1, Math.round(freq));
    const grid = new Float32Array(cells * cells);
    for (let i = 0; i < cells * cells; i++) grid[i] = hash(i * 1.7 + seed * 31.7 + o * 101.3);
    for (let y = 0; y < size; y++) {
      const gy = (y / size) * cells;
      const y0 = Math.floor(gy);
      const fy = gy - y0;
      const uy = fy * fy * (3 - 2 * fy);
      const r0 = (y0 % cells) * cells;
      const r1 = ((y0 + 1) % cells) * cells;
      for (let x = 0; x < size; x++) {
        const gx = (x / size) * cells;
        const x0 = Math.floor(gx);
        const fx = gx - x0;
        const ux = fx * fx * (3 - 2 * fx);
        const c0 = x0 % cells;
        const c1 = (x0 + 1) % cells;
        const a = grid[r0 + c0];
        const b = grid[r0 + c1];
        const c = grid[r1 + c0];
        const d = grid[r1 + c1];
        data[y * size + x] += (a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy) * amp;
      }
    }
    total += amp;
    amp *= 0.5;
    freq *= 2;
  }
  for (let i = 0; i < data.length; i++) data[i] /= total;
  return data;
}

function heightToNormalTexture(height, size, strength = 2) {
  const { c, ctx } = mk(size, size);
  const img = ctx.createImageData(size, size);
  const d = img.data;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const l = height[y * size + ((x - 1 + size) % size)];
      const r = height[y * size + ((x + 1) % size)];
      const u = height[((y - 1 + size) % size) * size + x];
      const b = height[((y + 1) % size) * size + x];
      let nx = (l - r) * strength;
      let ny = (b - u) * strength;
      let nz = 1;
      const len = Math.hypot(nx, ny, nz);
      nx /= len;
      ny /= len;
      nz /= len;
      const i = (y * size + x) * 4;
      d[i] = (nx * 0.5 + 0.5) * 255;
      d[i + 1] = (ny * 0.5 + 0.5) * 255;
      d[i + 2] = (nz * 0.5 + 0.5) * 255;
      d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function heightFromCanvas(canvas) {
  const size = canvas.width;
  const ctx = canvas.getContext('2d');
  const d = ctx.getImageData(0, 0, size, canvas.height).data;
  const out = new Float32Array(size * canvas.height);
  for (let i = 0; i < out.length; i++) out[i] = d[i * 4] / 255;
  return out;
}

function colorTex(c, repeat = true) {
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  if (repeat) tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  return tex;
}

function memo(key, fn) {
  if (!cache.has(key)) cache.set(key, fn());
  return cache.get(key);
}

export function grassDetail() {
  return memo('grass', () => {
    const size = 256;
    const { c, ctx } = mk(size, size);
    const n = noiseData(size, 6, 4, 3);
    const img = ctx.createImageData(size, size);
    for (let i = 0; i < size * size; i++) {
      const v = n[i];
      const t = 205 + (v - 0.5) * 70;
      img.data[i * 4] = t * 0.93;
      img.data[i * 4 + 1] = t * 1.02;
      img.data[i * 4 + 2] = t * 0.78;
      img.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    const r = rng(11);
    for (let i = 0; i < 900; i++) {
      const x = r() * size;
      const y = r() * size;
      const len = 4 + r() * 9;
      const light = r() > 0.5;
      ctx.strokeStyle = light ? 'rgba(255,255,220,0.22)' : 'rgba(40,70,20,0.28)';
      ctx.lineWidth = 1 + r();
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (r() - 0.5) * 3, y - len);
      ctx.stroke();
    }
    const h = noiseData(size, 14, 3, 9);
    return { map: colorTex(c), normalMap: heightToNormalTexture(h, size, 1.6) };
  });
}

export function sandDetail() {
  return memo('sand', () => {
    const size = 256;
    const { c, ctx } = mk(size, size);
    const n = noiseData(size, 9, 4, 21);
    const img = ctx.createImageData(size, size);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = y * size + x;
        const ripple = Math.sin((x + n[i] * 40) * 0.16 + y * 0.03) * 0.5 + 0.5;
        const t = 214 + (n[i] - 0.5) * 40 + ripple * 14;
        img.data[i * 4] = t;
        img.data[i * 4 + 1] = t * 0.97;
        img.data[i * 4 + 2] = t * 0.9;
        img.data[i * 4 + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    const r = rng(5);
    for (let i = 0; i < 500; i++) {
      ctx.fillStyle = r() > 0.5 ? 'rgba(120,90,60,0.35)' : 'rgba(255,255,255,0.35)';
      ctx.fillRect(r() * size, r() * size, 1.2, 1.2);
    }
    const h = new Float32Array(size * size);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = y * size + x;
        h[i] = (Math.sin((x + n[i] * 40) * 0.16 + y * 0.03) * 0.5 + 0.5) * 0.6 + n[i] * 0.4;
      }
    }
    return { map: colorTex(c), normalMap: heightToNormalTexture(h, size, 1.2) };
  });
}

export function planks(opts = {}) {
  const { count = 6, base = '#9a5a2c', vertical = false, seed = 1, size = 512 } = opts;
  return memo(`planks-${count}-${base}-${vertical}-${seed}`, () => {
    const { c, ctx } = mk(size, size);
    const hc = mk(size, size);
    const r = rng(seed * 977);
    const baseCol = new THREE.Color(base);
    const plankW = size / count;
    for (let p = 0; p < count; p++) {
      const shade = 0.82 + r() * 0.36;
      const col = baseCol.clone().multiplyScalar(shade);
      const x0 = vertical ? p * plankW : 0;
      const y0 = vertical ? 0 : p * plankW;
      const w = vertical ? plankW : size;
      const h = vertical ? size : plankW;
      const grad = vertical
        ? ctx.createLinearGradient(x0, 0, x0 + w, 0)
        : ctx.createLinearGradient(0, y0, 0, y0 + h);
      grad.addColorStop(0, `#${col.clone().multiplyScalar(0.72).getHexString()}`);
      grad.addColorStop(0.15, `#${col.getHexString()}`);
      grad.addColorStop(0.85, `#${col.clone().multiplyScalar(0.95).getHexString()}`);
      grad.addColorStop(1, `#${col.clone().multiplyScalar(0.62).getHexString()}`);
      ctx.fillStyle = grad;
      ctx.fillRect(x0, y0, w, h);
      hc.ctx.fillStyle = `rgb(${150 + shade * 40},${150 + shade * 40},${150 + shade * 40})`;
      hc.ctx.fillRect(x0, y0, w, h);
      for (let g = 0; g < 26; g++) {
        const along = r();
        const across = r();
        ctx.strokeStyle = r() > 0.5 ? 'rgba(60,30,10,0.22)' : 'rgba(255,220,170,0.12)';
        ctx.lineWidth = 0.8 + r() * 1.4;
        ctx.beginPath();
        if (vertical) {
          const x = x0 + across * w;
          ctx.moveTo(x, along * size);
          ctx.bezierCurveTo(x + (r() - 0.5) * 8, along * size + 60, x + (r() - 0.5) * 8, along * size + 120, x + (r() - 0.5) * 6, along * size + 200);
        } else {
          const y = y0 + across * h;
          ctx.moveTo(along * size, y);
          ctx.bezierCurveTo(along * size + 60, y + (r() - 0.5) * 8, along * size + 120, y + (r() - 0.5) * 8, along * size + 200, y + (r() - 0.5) * 6);
        }
        ctx.stroke();
        hc.ctx.strokeStyle = 'rgba(0,0,0,0.25)';
        hc.ctx.lineWidth = 1;
        hc.ctx.stroke();
      }
      ctx.fillStyle = 'rgba(30,14,6,0.9)';
      hc.ctx.fillStyle = '#000';
      if (vertical) {
        ctx.fillRect(x0 + w - 3, 0, 3, size);
        hc.ctx.fillRect(x0 + w - 4, 0, 4, size);
      } else {
        ctx.fillRect(0, y0 + h - 3, size, 3);
        hc.ctx.fillRect(0, y0 + h - 4, size, 4);
      }
      for (let k = 0; k < 2; k++) {
        const nx = vertical ? x0 + w * 0.5 : size * (0.12 + k * 0.76);
        const ny = vertical ? size * (0.12 + k * 0.76) : y0 + h * 0.5;
        ctx.fillStyle = '#2a1a10';
        ctx.beginPath();
        ctx.arc(nx, ny, 3.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,240,200,0.5)';
        ctx.beginPath();
        ctx.arc(nx - 1, ny - 1, 1.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    const h = heightFromCanvas(hc.c);
    return { map: colorTex(c), normalMap: heightToNormalTexture(h, size, 2.2) };
  });
}

export function thatch(seed = 2) {
  return memo(`thatch-${seed}`, () => {
    const size = 512;
    const { c, ctx } = mk(size, size);
    const hc = mk(size, size);
    const r = rng(seed * 331);
    ctx.fillStyle = '#7a5520';
    ctx.fillRect(0, 0, size, size);
    hc.ctx.fillStyle = '#404040';
    hc.ctx.fillRect(0, 0, size, size);
    const cols = ['#d9a23a', '#c58a2c', '#e6b64d', '#b07a26', '#f0c860', '#9c6a20'];
    for (let i = 0; i < 4200; i++) {
      const x = r() * size;
      const y = r() * size;
      const len = 14 + r() * 30;
      const ang = Math.PI / 2 + (r() - 0.5) * 0.5;
      const col = cols[(r() * cols.length) | 0];
      ctx.strokeStyle = col;
      ctx.lineWidth = 1.2 + r() * 1.6;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len);
      ctx.stroke();
      const hv = 90 + r() * 150;
      hc.ctx.strokeStyle = `rgb(${hv},${hv},${hv})`;
      hc.ctx.lineWidth = ctx.lineWidth;
      hc.ctx.beginPath();
      hc.ctx.moveTo(x, y);
      hc.ctx.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len);
      hc.ctx.stroke();
    }
    for (let row = 0; row < 5; row++) {
      const y = (row + 0.5) * (size / 5);
      ctx.fillStyle = 'rgba(40,20,5,0.28)';
      ctx.fillRect(0, y + 24, size, 10);
    }
    const h = heightFromCanvas(hc.c);
    return { map: colorTex(c), normalMap: heightToNormalTexture(h, size, 1.8) };
  });
}

export function stone(seed = 4) {
  return memo(`stone-${seed}`, () => {
    const size = 512;
    const { c, ctx } = mk(size, size);
    const hc = mk(size, size);
    const r = rng(seed * 771);
    ctx.fillStyle = '#4a4440';
    ctx.fillRect(0, 0, size, size);
    hc.ctx.fillStyle = '#202020';
    hc.ctx.fillRect(0, 0, size, size);
    const cells = 9;
    const cw = size / cells;
    for (let j = 0; j < cells; j++) {
      for (let i = 0; i < cells; i++) {
        const cx = (i + 0.5) * cw + (r() - 0.5) * cw * 0.3;
        const cy = (j + 0.5) * cw + (r() - 0.5) * cw * 0.3;
        const rx = cw * (0.38 + r() * 0.12);
        const ry = cw * (0.34 + r() * 0.12);
        const shade = 120 + r() * 70;
        const grad = ctx.createRadialGradient(cx - rx * 0.3, cy - ry * 0.3, 2, cx, cy, Math.max(rx, ry));
        grad.addColorStop(0, `rgb(${shade + 30},${shade + 22},${shade + 12})`);
        grad.addColorStop(1, `rgb(${shade - 30},${shade - 32},${shade - 34})`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, r() * 0.6, 0, Math.PI * 2);
        ctx.fill();
        const hg = hc.ctx.createRadialGradient(cx, cy, 2, cx, cy, Math.max(rx, ry));
        hg.addColorStop(0, '#e0e0e0');
        hg.addColorStop(0.75, '#a0a0a0');
        hg.addColorStop(1, '#202020');
        hc.ctx.fillStyle = hg;
        hc.ctx.beginPath();
        hc.ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        hc.ctx.fill();
      }
    }
    const h = heightFromCanvas(hc.c);
    return { map: colorTex(c), normalMap: heightToNormalTexture(h, size, 2.4) };
  });
}

export function bark() {
  return memo('bark', () => {
    const size = 256;
    const { c, ctx } = mk(size, size);
    const n = noiseData(size, 4, 4, 17);
    const img = ctx.createImageData(size, size);
    const h = new Float32Array(size * size);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = y * size + x;
        const stripe = Math.sin(x * 0.25 + n[i] * 12) * 0.5 + 0.5;
        const v = 0.55 + stripe * 0.35 + (n[i] - 0.5) * 0.3;
        h[i] = v;
        img.data[i * 4] = 110 * v + 30;
        img.data[i * 4 + 1] = 70 * v + 18;
        img.data[i * 4 + 2] = 40 * v + 8;
        img.data[i * 4 + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return { map: colorTex(c), normalMap: heightToNormalTexture(h, size, 2.5) };
  });
}

export function waterNormal() {
  return memo('waterNormal', () => {
    const size = 256;
    const a = noiseData(size, 5, 4, 41);
    const b = noiseData(size, 11, 3, 43);
    const h = new Float32Array(size * size);
    for (let i = 0; i < h.length; i++) h[i] = a[i] * 0.65 + b[i] * 0.35;
    return heightToNormalTexture(h, size, 3.2);
  });
}

export function noiseTexture() {
  return memo('noiseTex', () => {
    const size = 256;
    const { c, ctx } = mk(size, size);
    const n = noiseData(size, 5, 5, 77);
    const img = ctx.createImageData(size, size);
    for (let i = 0; i < size * size; i++) {
      const v = n[i] * 255;
      img.data[i * 4] = v;
      img.data[i * 4 + 1] = v;
      img.data[i * 4 + 2] = v;
      img.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    return tex;
  });
}

export function softParticle() {
  return memo('softParticle', () => {
    const size = 128;
    const { c, ctx } = mk(size, size);
    const g = ctx.createRadialGradient(size / 2, size / 2, 2, size / 2, size / 2, size / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.35, 'rgba(255,255,255,0.75)');
    g.addColorStop(0.7, 'rgba(255,255,255,0.22)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    return new THREE.CanvasTexture(c);
  });
}

export function smokeParticle() {
  return memo('smokeParticle', () => {
    const size = 128;
    const { c, ctx } = mk(size, size);
    const n = noiseData(size, 4, 4, 91);
    const img = ctx.createImageData(size, size);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = (x - size / 2) / (size / 2);
        const dy = (y - size / 2) / (size / 2);
        const d = Math.hypot(dx, dy);
        const i = y * size + x;
        const soft = Math.max(0, 1 - d * d);
        const a = soft * soft * (0.55 + n[i] * 0.8);
        img.data[i * 4] = 255;
        img.data[i * 4 + 1] = 255;
        img.data[i * 4 + 2] = 255;
        img.data[i * 4 + 3] = Math.min(255, a * 255);
      }
    }
    ctx.putImageData(img, 0, 0);
    return new THREE.CanvasTexture(c);
  });
}

export function glow() {
  return memo('glow', () => {
    const size = 256;
    const { c, ctx } = mk(size, size);
    const g = ctx.createRadialGradient(size / 2, size / 2, 4, size / 2, size / 2, size / 2);
    g.addColorStop(0, 'rgba(255,250,235,1)');
    g.addColorStop(0.18, 'rgba(255,235,190,0.55)');
    g.addColorStop(0.5, 'rgba(255,200,120,0.14)');
    g.addColorStop(1, 'rgba(255,180,90,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  });
}

export function shieldFace(seed) {
  return memo(`shield-${seed}`, () => {
    const size = 128;
    const { c, ctx } = mk(size, size);
    const r = rng(seed * 53 + 7);
    const cols = ['#c42a22', '#e8d24a', '#2a6ad4', '#d4782a', '#f2e6c8', '#2f8a4a'];
    const a = cols[(r() * cols.length) | 0];
    let b = cols[(r() * cols.length) | 0];
    if (b === a) b = '#f2e6c8';
    ctx.fillStyle = a;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = b;
    const style = (r() * 3) | 0;
    if (style === 0) {
      for (let q = 0; q < 4; q += 2) {
        ctx.beginPath();
        ctx.moveTo(size / 2, size / 2);
        ctx.arc(size / 2, size / 2, size / 2, (q * Math.PI) / 2, ((q + 1) * Math.PI) / 2);
        ctx.fill();
      }
    } else if (style === 1) {
      for (let s = 0; s < 8; s += 2) {
        ctx.beginPath();
        ctx.moveTo(size / 2, size / 2);
        ctx.arc(size / 2, size / 2, size / 2, (s * Math.PI) / 4, ((s + 1) * Math.PI) / 4);
        ctx.fill();
      }
    } else {
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, size * 0.28, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = '#2a140c';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2 - 3, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#8a8a90';
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size * 0.13, 0, Math.PI * 2);
    ctx.fill();
    return colorTex(c, false);
  });
}
