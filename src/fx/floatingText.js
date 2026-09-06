export function createFloatingText(hudRoot, camera, canvas) {
  const items = [];

  function spawn(x, y, z, text, color = '#fff4c4') {
    const el = document.createElement('div');
    el.className = 'float-text';
    el.textContent = text;
    el.style.color = color;
    hudRoot.appendChild(el);
    items.push({ el, x, y, z, life: 1.1, vy: 1.1 });
  }

  function update(dt) {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    const v = { x: 0, y: 0, z: 0 };
    for (let i = items.length - 1; i >= 0; i--) {
      const it = items[i];
      it.life -= dt;
      it.y += it.vy * dt;
      if (it.life <= 0) {
        it.el.remove();
        items.splice(i, 1);
        continue;
      }
      v.x = it.x;
      v.y = it.y;
      v.z = it.z;
      const p = project(camera, v, w, h);
      it.el.style.left = `${p.x}px`;
      it.el.style.top = `${p.y}px`;
      it.el.style.opacity = String(Math.min(1, it.life * 1.6));
    }
  }

  return { spawn, update };
}

export function project(camera, pos, w, h) {
  const v = project._v || (project._v = { set() {}, project() {} });
  return projectVec(camera, pos, w, h);
}

function projectVec(camera, pos, w, h) {
  const x = pos.x;
  const y = pos.y;
  const z = pos.z;
  const e = camera.matrixWorldInverse.elements;
  const p = camera.projectionMatrix.elements;
  const wx = e[0] * x + e[4] * y + e[8] * z + e[12];
  const wy = e[1] * x + e[5] * y + e[9] * z + e[13];
  const wz = e[2] * x + e[6] * y + e[10] * z + e[14];
  const ww = e[3] * x + e[7] * y + e[11] * z + e[15];
  const cx = p[0] * wx + p[4] * wy + p[8] * wz + p[12] * ww;
  const cy = p[1] * wx + p[5] * wy + p[9] * wz + p[13] * ww;
  const cw = p[3] * wx + p[7] * wy + p[11] * wz + p[15] * ww;
  const ndcX = cx / cw;
  const ndcY = cy / cw;
  return { x: (ndcX * 0.5 + 0.5) * w, y: (-ndcY * 0.5 + 0.5) * h };
}
