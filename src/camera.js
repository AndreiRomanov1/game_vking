import * as THREE from 'three';

export function createRtsCamera(canvas) {
  const camera = new THREE.PerspectiveCamera(
    46,
    canvas.clientWidth / canvas.clientHeight || 1,
    0.4,
    400,
  );

  const target = new THREE.Vector3(0, 0.4, 8);
  const desired = target.clone();
  let dist = 31;
  let distTarget = 31;
  let yaw = 0.22;
  let yawTarget = 0.22;
  const keys = new Set();
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  let pointerX = 0.5;
  let pointerY = 0.5;
  let pointerIn = false;
  let edgeScroll = false;
  let shakeAmp = 0;
  let shakeT = 0;
  let smoothing = 10;
  let fly = null;
  let pitchOffset = 0;
  let pitchOffsetTarget = 0;

  function pitchFor(d) {
    const t = THREE.MathUtils.clamp((d - 11) / 37, 0, 1);
    return THREE.MathUtils.degToRad(THREE.MathUtils.lerp(24, 52, t) + pitchOffset);
  }

  function apply() {
    const pitch = pitchFor(dist);
    const cp = Math.cos(pitch);
    camera.position.set(
      target.x + Math.sin(yaw) * dist * cp,
      target.y + Math.sin(pitch) * dist,
      target.z + Math.cos(yaw) * dist * cp,
    );
    camera.lookAt(target);
    if (shakeAmp > 0.001) {
      const s = shakeAmp;
      camera.position.x += Math.sin(shakeT * 47.1) * s;
      camera.position.y += Math.sin(shakeT * 59.3 + 1.3) * s * 0.7;
      camera.position.z += Math.cos(shakeT * 41.7 + 2.1) * s;
      camera.rotation.z += Math.sin(shakeT * 37.0) * s * 0.02;
    }
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
  window.addEventListener('blur', () => keys.clear());

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
    desired.x -= Math.cos(yaw) * dx * pan + Math.sin(yaw) * dy * pan * 0.25;
    desired.z += Math.sin(yaw) * dx * pan - Math.cos(yaw) * dy * pan;
    clampDesired();
  });

  canvas.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      distTarget = THREE.MathUtils.clamp(distTarget + e.deltaY * 0.02, 11, 48);
    },
    { passive: false },
  );

  function clampDesired() {
    desired.x = THREE.MathUtils.clamp(desired.x, -28, 28);
    desired.z = THREE.MathUtils.clamp(desired.z, -18, 32);
  }

  function setPointer(nx, ny, inside) {
    pointerX = nx;
    pointerY = ny;
    pointerIn = inside;
  }

  function setEdgeScroll(on) {
    edgeScroll = on;
  }

  function update(dt) {
    if (fly) {
      fly.t += dt / fly.dur;
      const k = Math.min(1, fly.t);
      const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      target.x = THREE.MathUtils.lerp(fly.fromX, fly.toX, e);
      target.z = THREE.MathUtils.lerp(fly.fromZ, fly.toZ, e);
      dist = THREE.MathUtils.lerp(fly.fromD, fly.toD, e);
      yaw = THREE.MathUtils.lerp(fly.fromYaw, fly.toYaw, e);
      pitchOffset = THREE.MathUtils.lerp(fly.fromPitch, 0, e);
      pitchOffsetTarget = 0;
      desired.set(target.x, target.y, target.z);
      distTarget = dist;
      yawTarget = yaw;
      if (k >= 1) fly = null;
      shakeT += dt;
      shakeAmp *= Math.max(0, 1 - dt * 3.2);
      apply();
      return;
    }
    const sp = dist * 0.6 * dt;
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
      desired.x += Math.cos(yaw) * mx * sp + Math.sin(yaw) * mz * sp;
      desired.z += -Math.sin(yaw) * mx * sp + Math.cos(yaw) * mz * sp;
      clampDesired();
    }
    if (keys.has('KeyQ')) yawTarget += dt * 0.8;
    if (keys.has('KeyE')) yawTarget -= dt * 0.8;

    const k = 1 - Math.exp(-dt * smoothing);
    target.x += (desired.x - target.x) * k;
    target.z += (desired.z - target.z) * k;
    dist += (distTarget - dist) * (1 - Math.exp(-dt * 7));
    yaw += (yawTarget - yaw) * (1 - Math.exp(-dt * 8));
    pitchOffset += (pitchOffsetTarget - pitchOffset) * (1 - Math.exp(-dt * 6));

    shakeT += dt;
    shakeAmp *= Math.max(0, 1 - dt * 3.2);
    apply();
  }

  function focus(x, z, d, immediate = true) {
    desired.x = x;
    desired.z = z;
    clampDesired();
    if (d) distTarget = d;
    if (immediate) {
      target.x = desired.x;
      target.z = desired.z;
      if (d) dist = d;
      apply();
    }
  }

  function flyTo(fromX, fromZ, fromD, fromYaw, toX, toZ, toD, toYaw, dur) {
    fly = { t: 0, dur, fromX, fromZ, fromD, fromYaw, toX, toZ, toD, toYaw, fromPitch: pitchOffset };
    target.x = fromX;
    target.z = fromZ;
    dist = fromD;
    yaw = fromYaw;
    apply();
  }

  function setPitchOffset(deg, immediate = false) {
    pitchOffsetTarget = deg;
    if (immediate) pitchOffset = deg;
  }

  function shake(amount) {
    shakeAmp = Math.min(0.9, shakeAmp + amount);
  }

  function setYaw(y, immediate = false) {
    yawTarget = y;
    if (immediate) yaw = y;
  }

  return {
    camera,
    target,
    update,
    resize,
    focus,
    flyTo,
    shake,
    apply,
    setPointer,
    setEdgeScroll,
    setYaw,
    setPitchOffset,
    get flying() {
      return !!fly;
    },
    get dist() {
      return dist;
    },
    get yaw() {
      return yaw;
    },
  };
}
