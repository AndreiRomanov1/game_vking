import {
  pickGround,
  pickBuilding,
  unitAtPoint,
  selectInBox,
  applySelection,
  addToSelection,
  selectKind,
} from './units/selection.js';
import { orderMove, orderAttack, orderStop, orderHold } from './units/ai.js';
import { useAbility } from './abilities.js';

export function bindInput(game) {
  const { canvas } = game;
  const box = document.getElementById('select-box');
  let down = false;
  let drag = false;
  let sx = 0;
  let sy = 0;
  let button = 0;
  let lastClick = 0;
  let lastKind = null;

  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  window.addEventListener('pointermove', (e) => {
    const r = canvas.getBoundingClientRect();
    game.rts.setPointer((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height, true);
  });
  canvas.addEventListener('pointerleave', () => game.rts.setPointer(0.5, 0.5, false));

  canvas.addEventListener('pointerdown', (e) => {
    if (!game.started || game.paused || game.over) return;
    if (e.button === 1 || e.altKey) return;
    down = true;
    drag = false;
    button = e.button;
    sx = e.clientX;
    sy = e.clientY;
    canvas.setPointerCapture(e.pointerId);
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!down || button !== 0) return;
    if (Math.hypot(e.clientX - sx, e.clientY - sy) > 6) {
      drag = true;
      box.style.display = 'block';
      const x = Math.min(sx, e.clientX);
      const y = Math.min(sy, e.clientY);
      box.style.left = `${x}px`;
      box.style.top = `${y}px`;
      box.style.width = `${Math.abs(e.clientX - sx)}px`;
      box.style.height = `${Math.abs(e.clientY - sy)}px`;
    }
  });

  canvas.addEventListener('pointerup', (e) => {
    if (!down) return;
    down = false;
    box.style.display = 'none';
    if (!game.started || game.paused || game.over) {
      drag = false;
      return;
    }
    const point = pickGround(game.camera, e, canvas, game.terrain.mesh);
    if (!point) {
      drag = false;
      return;
    }

    const shift = e.shiftKey;
    const selected = () => game.units.filter((u) => u.selected && !u.dead);

    if (game.attackMovePending && button === 0) {
      game.attackMovePending = false;
      canvas.classList.remove('atk-cursor');
      const enemy = unitAtPoint(game.units, point, 'defend');
      const building = pickBuilding(game.camera, e, canvas, game.village.structures);
      const sel = selected();
      if (enemy) {
        orderAttack(sel, game.map, enemy);
        game.markers.attack(enemy.x, enemy.z);
      } else if (building) {
        orderAttack(sel, game.map, building);
        game.markers.attack(building.x, building.z);
      } else {
        orderMove(sel, game.map, point.x, point.z, true);
        game.markers.move(point.x, point.z);
      }
      game.audio.click();
      drag = false;
      return;
    }

    if (button === 0) {
      if (drag) {
        const picked = selectInBox(game.units, game.camera, canvas, sx, sy, e.clientX, e.clientY);
        if (shift) addToSelection(game.units, picked);
        else applySelection(game.units, picked);
      } else {
        const u = unitAtPoint(game.units, point, 'viking');
        const now = performance.now();
        if (u && lastKind === u.kind && now - lastClick < 320) {
          selectKind(game.units, u.kind);
        } else if (shift) {
          applySelection(game.units, u ? [u] : [], true);
        } else {
          applySelection(game.units, u ? [u] : []);
        }
        lastClick = now;
        lastKind = u?.kind || null;
      }
    } else if (button === 2) {
      const sel = selected();
      if (!sel.length) {
        drag = false;
        return;
      }
      const enemy = unitAtPoint(game.units, point, 'defend');
      const building = pickBuilding(game.camera, e, canvas, game.village.structures);
      if (enemy) {
        orderAttack(sel, game.map, enemy);
        game.markers.attack(enemy.x, enemy.z);
      } else if (building) {
        orderAttack(sel, game.map, building);
        game.markers.attack(building.x, building.z);
      } else {
        orderMove(sel, game.map, point.x, point.z, !shift);
        game.markers.move(point.x, point.z);
      }
      game.audio.click();
    }
    drag = false;
  });

  window.addEventListener('keydown', (e) => {
    if (e.code === 'Enter' && !game.started) {
      game.startMatch?.();
      return;
    }
    if (e.code === 'Escape') {
      game.togglePause?.();
      return;
    }
    if (e.code === 'KeyM') {
      const muted = game.audio.toggleMute();
      game.hud.setMuted?.(muted);
      return;
    }
    if (!game.started || game.paused || game.over) return;

    if (e.code === 'KeyF') {
      applySelection(
        game.units,
        game.units.filter((u) => !u.dead && u.side === 'viking'),
      );
    }
    if (e.code === 'KeyX') {
      orderStop(game.units.filter((u) => u.selected && !u.dead));
    }
    if (e.code === 'KeyH') {
      orderHold(game.units.filter((u) => u.selected && !u.dead));
    }
    if (e.code === 'KeyZ') {
      game.attackMovePending = !game.attackMovePending;
      canvas.classList.toggle('atk-cursor', game.attackMovePending);
    }
    if (e.code === 'Space') {
      e.preventDefault();
      const sel = game.units.filter((u) => u.selected && !u.dead);
      if (sel.length) {
        const x = sel.reduce((s, u) => s + u.x, 0) / sel.length;
        const z = sel.reduce((s, u) => s + u.z, 0) / sel.length;
        game.rts.focus(x, z);
      }
    }
    if (e.code === 'Home') {
      game.rts.focus(0.3, 15.2, 31);
    }
    if (e.code === 'KeyR') useAbility(game.units, 'rage', game.hud, game.audio, game.floats);
    if (e.code === 'KeyT') useAbility(game.units, 'wall', game.hud, game.audio, game.floats);
    if (e.code === 'KeyG') useAbility(game.units, 'volley', game.hud, game.audio, game.floats);

    const num = { Digit1: 1, Digit2: 2, Digit3: 3 }[e.code];
    if (num) {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        game.groups[num] = game.units.filter((u) => u.selected && !u.dead);
      } else {
        const group = game.groups[num] || [];
        applySelection(
          game.units,
          group.filter((u) => !u.dead),
        );
      }
    }
  });
}
