import { MATCH_DAY_SECONDS } from '../config.js';
import { project } from '../fx/floatingText.js';

export function createHud(root, canvas, camera) {
  root.innerHTML = `
    <div class="hud-top">
      <div class="hud-title">НАБЕГ</div>
      <div class="hud-sub">викинги штурмуют прибрежную деревню</div>
    </div>
    <div class="hud-caption" id="caption"></div>
    <div class="day-wrap">
      <div class="day-label" id="day-label">День</div>
      <div class="day-bar"><div class="day-needle" id="day-needle"></div></div>
    </div>
    <div class="hud-help">
      ЛКМ — выделить · рамка — отряд<br/>
      ПКМ — идти / бить · WASD — камера<br/>
      Q/E — поворот · колёсико — зум
    </div>
    <div class="hud-sel" id="sel">Выдели викингов и веди на ворота</div>
    <div class="banner" id="banner"></div>
  `;
  const caption = root.querySelector('#caption');
  const dayLabel = root.querySelector('#day-label');
  const needle = root.querySelector('#day-needle');
  const sel = root.querySelector('#sel');
  const banner = root.querySelector('#banner');
  const hpLayer = document.createElement('div');
  hpLayer.style.position = 'absolute';
  hpLayer.style.inset = '0';
  root.appendChild(hpLayer);
  const bars = new Map();
  let capT = 0;

  function say(text) {
    caption.textContent = text;
    capT = 3.2;
    caption.style.opacity = '1';
  }

  function update(dt, game) {
    capT -= dt;
    if (capT <= 0) caption.style.opacity = '0';
    const u = Math.min(1, game.matchTime / MATCH_DAY_SECONDS);
    needle.style.left = `${u * 100}%`;
    dayLabel.textContent = game.look?.phase || 'День';

    const picked = game.units.filter((u) => u.selected && !u.dead);
    if (!picked.length) {
      sel.innerHTML = 'Выдели викингов и веди на ворота';
    } else if (picked.length === 1) {
      const u = picked[0];
      sel.innerHTML = `<b>${u.def.name}</b>${Math.ceil(u.hp)} / ${u.maxHp} HP`;
    } else {
      sel.innerHTML = `<b>Отряд × ${picked.length}</b>берсерки, луки и щиты`;
    }

    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    const need = [];
    for (const un of game.units) {
      if (un.dead) continue;
      if (un.selected || un.hp < un.maxHp) need.push(un);
    }
    const seen = new Set();
    for (const un of need) {
      seen.add(un.id);
      let bar = bars.get(un.id);
      if (!bar) {
        bar = document.createElement('div');
        bar.className = 'hp-bar' + (un.side === 'defend' ? ' enemy' : '');
        bar.innerHTML = '<i></i>';
        hpLayer.appendChild(bar);
        bars.set(un.id, bar);
      }
      const p = project(camera, { x: un.x, y: un.y + 1.45 * un.def.scale, z: un.z }, w, h);
      bar.style.left = `${p.x}px`;
      bar.style.top = `${p.y}px`;
      bar.querySelector('i').style.width = `${Math.max(0, (un.hp / un.maxHp) * 100)}%`;
    }
    for (const [id, el] of bars) {
      if (!seen.has(id)) {
        el.remove();
        bars.delete(id);
      }
    }
  }

  function end(win) {
    banner.textContent = win ? 'ДЕРЕВНЯ НАША!' : 'ДРАККАРЫ РАЗБИТЫ...';
    banner.classList.add('show');
  }

  return { say, update, end };
}
