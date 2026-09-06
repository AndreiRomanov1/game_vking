import * as THREE from 'three';

export function createRtsCamera(canvas) {
  const camera = new THREE.PerspectiveCamera(
    42,
    canvas.clientWidth / canvas.clientHeight || 1,
    0.4,
    400,
  );

  const target = new THREE.Vector3(0, 0.4, 8);
  let dist = 31;
  let pitch = THREE.MathUtils.degToRad(48);
  let yaw = 0.22;
  const keys = new Set();
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  let pointerX = 0.5;
  let pointerY = 0.5;
  let pointerIn = false;
  let edgeScroll = false;

  function apply() {
    const cp = Math.cos(pitch);
    camera.position.set(
      target.x + Math.sin(yaw) * dist * cp,
      target.y + Math.sin(pitch) * dist,
      target.z + Math.cos(yaw) * dist * cp,
    );
    camera.lookAt(target);
  }

  apply();

  function resize() {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    camera.aspect = w / Math.max(1, h);
    camera.updateProjectionMatrix();
  }

  window.addEventListener('keydown', (e) => {
    keys.add(e.code);
  });
  window.addEventListener('keyup', (e) => {
    keys.delete(e.code);
  });

  canvas.addEventListener('pointerdown', (e) => {
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
    }
  });
  window.addEventListener('pointerup', () => {
    dragging = false;
  });
  window.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
    const pan = dist * 0.0022;
    target.x -= Math.cos(yaw) * dx * pan + Math.sin(yaw) * dy * pan * 0.25;
    target.z += Math.sin(yaw) * dx * pan - Math.cos(yaw) * dy * pan;
    target.x = THREE.MathUtils.clamp(target.x, -28, 28);
    target.z = THREE.MathUtils.clamp(target.z, -18, 32);
  });

  canvas.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      dist = THREE.MathUtils.clamp(dist + e.deltaY * 0.018, 12, 48);
    },
    { passive: false },
  );

  function setPointer(nx, ny, inside) {
    pointerX = nx;
    pointerY = ny;
    pointerIn = inside;
  }

  function setEdgeScroll(on) {
    edgeScroll = on;
  }

  function update(dt) {
    const sp = dist * 0.55 * dt;
    let mx = 0;
    let mz = 0;
    if (keys.has('KeyW') || keys.has('ArrowUp')) mz -= 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) mz += 1;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) mx -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) mx += 1;
    if (edgeScroll && pointerIn) {
      const m = 0.035;
      if (pointerY < m) mz -= 1;
      if (pointerY > 1 - m) mz += 1;
      if (pointerX < m) mx -= 1;
      if (pointerX > 1 - m) mx += 1;
    }
    if (mx || mz) {
      target.x += Math.cos(yaw) * mx * sp + Math.sin(yaw) * mz * sp;
      target.z += -Math.sin(yaw) * mx * sp + Math.cos(yaw) * mz * sp;
      target.x = THREE.MathUtils.clamp(target.x, -28, 28);
      target.z = THREE.MathUtils.clamp(target.z, -18, 32);
    }
    if (keys.has('KeyQ')) yaw += dt * 0.7;
    if (keys.has('KeyE')) yaw -= dt * 0.7;
    apply();
  }

  function focus(x, z, d) {
    target.x = x;
    target.z = z;
    if (d) dist = d;
    apply();
  }

  return { camera, target, update, resize, focus, apply, setPointer, setEdgeScroll };
}
