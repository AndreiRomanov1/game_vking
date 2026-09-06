import {
  pickGround,
  pickBuilding,
  unitAtPoint,
  selectInBox,
  applySelection,
} from './units/selection.js';
import { orderMove, orderAttack } from './units/ai.js';

export function bindInput(game) {
  const { canvas } = game;
  const box = document.getElementById('select-box');
  let down = false;
  let drag = false;
  let sx = 0;
  let sy = 0;
  let button = 0;

  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  canvas.addEventListener('pointerdown', (e) => {
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
    const point = pickGround(game.camera, e, canvas, game.terrain.mesh);
    if (!point) return;

    if (button === 0) {
      if (drag) {
        const picked = selectInBox(game.units, game.camera, canvas, sx, sy, e.clientX, e.clientY);
        applySelection(game.units, picked);
      } else {
        const u = unitAtPoint(game.units, point, 'viking');
        applySelection(game.units, u ? [u] : []);
      }
    } else if (button === 2) {
      const selected = game.units.filter((u) => u.selected && !u.dead);
      if (!selected.length) return;
      const enemy = unitAtPoint(game.units, point, 'defend');
      const building = pickBuilding(game.camera, e, canvas, game.village.structures);
      if (enemy) orderAttack(selected, game.map, enemy);
      else if (building) orderAttack(selected, game.map, building);
      else orderMove(selected, game.map, point.x, point.z, true);
    }
    drag = false;
  });

  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyF') {
      applySelection(
        game.units,
        game.units.filter((u) => !u.dead && u.side === 'viking'),
      );
    }
  });
}
