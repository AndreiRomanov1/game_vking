import { MATCH_DAY_SECONDS } from '../config.js';
import { project } from '../fx/floatingText.js';
import { readyAbilities, useAbility } from '../abilities.js';
import { createMinimap } from './minimap.js';

export function createHud(root, canvas, camera, game) {
  root.innerHTML = `
    <div class="hud-play" id="hud-play">
      <div class="hud-top">
        <div class="hud-title">НАБЕГ</div>
        <div class="hud-sub">сожги холл · награбь золото · не дай себя перебить</div>
      </div>
      <div class="hud-caption" id="caption"></div>
      <div class="raid-panel">
        <div class="raid-gold" id="gold">✦ 0</div>
        <div class="raid-counts" id="counts">своих 0 · врагов 0</div>
      </div>
      <div class="day-wrap">
        <div class="day-label" id="day-label">День</div>
        <div class="day-bar"><div class="day-needle" id="day-needle"></div></div>
      </div>
      <button class="mute-btn" id="mute" type="button">звук</button>
      <div class="hud-help">
        ЛКМ — выделить · рамка — отряд · Shift — добавить<br/>
        ПКМ — идти / бить · Shift+ПКМ — только идти<br/>
        X — стой · H — держись · Z — атака-ход · F — все<br/>
        R ярость · T щиты · G залп · WASD камера · пробел — к отряду
      </div>
      <div class="hud-sel" id="sel">
        <div id="sel-text">Выдели викингов и веди на ворота</div>
        <div class="abil-row" id="abils"></div>
      </div>
    </div>
    <div class="overlay show" id="menu">
      <div class="panel">
        <div class="panel-kicker">драккары у берега</div>
        <h1>НАБЕГ</h1>
        <p>Высади викингов, сломай ворота и сожги лонгхаус. Хижины и староста дают золото. Ночью удар сильнее.</p>
        <button class="btn" id="start" type="button">В НАБЕГ</button>
        <div class="panel-hint">ЛКМ — выбор · ПКМ — приказ · F — весь отряд</div>
      </div>
    </div>
    <div class="overlay" id="pause">
      <div class="panel">
        <h1>ПАУЗА</h1>
        <button class="btn" id="resume" type="button">Продолжить</button>
        <button class="btn ghost" id="restart-pause" type="button">Заново</button>
      </div>
    </div>
    <div class="overlay" id="end">
      <div class="panel">
        <h1 id="end-title">ДЕРЕВНЯ НАША!</h1>
        <div class="stats" id="end-stats"></div>
        <button class="btn" id="restart" type="button">Ещё раз</button>
      </div>
    </div>
  `;

  const caption = root.querySelector('#caption');
  const dayLabel = root.querySelector('#day-label');
  const needle = root.querySelector('#day-needle');
  const selText = root.querySelector('#sel-text');
  const abils = root.querySelector('#abils');
  const goldEl = root.querySelector('#gold');
  const countsEl = root.querySelector('#counts');
  const menu = root.querySelector('#menu');
  const pause = root.querySelector('#pause');
  const end = root.querySelector('#end');
  const muteBtn = root.querySelector('#mute');
  const hpLayer = document.createElement('div');
  hpLayer.className = 'hp-layer';
  root.appendChild(hpLayer);
  const bars = new Map();
  let capT = 0;
  let lastAbil = '';
  const play = root.querySelector('#hud-play');
  const minimap = createMinimap(root, game);
  play.hidden = true;
  minimap.wrap.hidden = true;

  root.querySelector('#start').addEventListener('click', () => game.startMatch?.());
  root.querySelector('#resume').addEventListener('click', () => game.togglePause?.());
  root.querySelector('#restart').addEventListener('click', () => window.location.reload());
  root.querySelector('#restart-pause').addEventListener('click', () => window.location.reload());
  muteBtn.addEventListener('click', () => {
    const muted = game.audio.toggleMute();
    setMuted(muted);
  });

  function setMuted(muted) {
    muteBtn.textContent = muted ? 'тихо' : 'звук';
    muteBtn.classList.toggle('off', muted);
  }

  function say(text) {
    caption.textContent = text;
    capT = 3.4;
    caption.style.opacity = '1';
  }

  function hideMenu() {
    menu.classList.remove('show');
    play.hidden = false;
    minimap.wrap.hidden = false;
  }

  function setPaused(on) {
    pause.classList.toggle('show', on);
  }

  function bindAbilities() {
    abils.querySelectorAll('[data-abil]').forEach((btn) => {
      btn.onclick = () => useAbility(game.units, btn.dataset.abil, api, game.audio, game.floats);
    });
  }

  function update(dt, g) {
    capT -= dt;
    if (capT <= 0) caption.style.opacity = '0';
    const u = Math.min(1, g.matchTime / MATCH_DAY_SECONDS);
    needle.style.left = `${u * 100}%`;
    dayLabel.textContent = g.look?.phase || 'День';
    goldEl.textContent = `✦ ${g.gold}`;
    const viks = g.units.filter((un) => un.side === 'viking' && !un.dead).length;
    const defs = g.units.filter((un) => un.side === 'defend' && !un.dead).length;
    countsEl.textContent = `своих ${viks} · врагов ${defs}`;

    const picked = g.units.filter((un) => un.selected && !un.dead);
    if (!picked.length) {
      selText.innerHTML = 'Выдели викингов и веди на ворота';
    } else if (picked.length === 1) {
      const un = picked[0];
      selText.innerHTML = `<b>${un.def.name}</b>${Math.ceil(un.hp)} / ${un.maxHp} HP`;
    } else {
      const tally = {};
      for (const un of picked) tally[un.def.name] = (tally[un.def.name] || 0) + 1;
      const bits = Object.entries(tally).map(([n, c]) => `${n} ×${c}`);
      selText.innerHTML = `<b>Отряд × ${picked.length}</b>${bits.join(' · ')}`;
    }

    const states = readyAbilities(g.units);
    const html = states
      .filter((a) => a.available)
      .map((a) => {
        const wait = a.ready ? '' : ` ${Math.ceil(a.cooldownLeft)}с`;
        const cls = a.ready ? '' : ' cd';
        return `<button class="abil${cls}" data-abil="${a.id}" type="button"><i>${a.hint}</i>${a.name}${wait}</button>`;
      })
      .join('');
    if (html !== lastAbil) {
      lastAbil = html;
      abils.innerHTML = html;
      bindAbilities();
    }

    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    const need = [];
    for (const un of g.units) {
      if (un.dead) continue;
      if (un.selected || un.hp < un.maxHp) need.push({ kind: 'u', un });
    }
    for (const st of g.village.structures) {
      if (st.dead) continue;
      if (st.hp < st.maxHp || st.onFire) need.push({ kind: 's', st });
    }
    const seen = new Set();
    for (const item of need) {
      const id = item.kind === 'u' ? item.un.id : item.st.id;
      seen.add(id);
      let bar = bars.get(id);
      if (!bar) {
        bar = document.createElement('div');
        const enemy = item.kind === 'u' ? item.un.side === 'defend' : true;
        bar.className = 'hp-bar' + (enemy ? ' enemy' : '') + (item.kind === 's' ? ' build' : '');
        bar.innerHTML = '<i></i>';
        hpLayer.appendChild(bar);
        bars.set(id, bar);
      }
      const src = item.kind === 'u' ? item.un : item.st;
      const lift = item.kind === 'u' ? 1.45 * src.def.scale : 2.6;
      const p = project(camera, { x: src.x, y: (src.y ?? src.group.position.y) + lift, z: src.z }, w, h);
      bar.style.left = `${p.x}px`;
      bar.style.top = `${p.y}px`;
      bar.querySelector('i').style.width = `${Math.max(0, (src.hp / src.maxHp) * 100)}%`;
    }
    for (const [id, el] of bars) {
      if (!seen.has(id)) {
        el.remove();
        bars.delete(id);
      }
    }

    if (g.started && !g.paused) minimap.draw(g);
  }

  function endMatch(win, stats) {
    const title = win ? 'ДЕРЕВНЯ НАША!' : 'ДРАККАРЫ РАЗБИТЫ...';
    root.querySelector('#end-title').textContent = title;
    const m = Math.floor(stats.time / 60);
    const s = Math.floor(stats.time % 60)
      .toString()
      .padStart(2, '0');
    const grade =
      !win ? 'Поражение' : stats.gold >= 300 ? 'Богатый ярл' : stats.gold >= 160 ? 'Удачный набег' : 'Худая добыча';
    root.querySelector('#end-stats').innerHTML = `
      <div><span>Оценка</span><b>${grade}</b></div>
      <div><span>Золото</span><b>${stats.gold}</b></div>
      <div><span>Пало защитников</span><b>${stats.kills}</b></div>
      <div><span>Сожжено строений</span><b>${stats.buildings}</b></div>
      <div><span>Время</span><b>${m}:${s}</b></div>
    `;
    end.classList.add('show');
  }

  const api = { say, update, end: endMatch, hideMenu, setPaused, setMuted };
  return api;
}
