import * as THREE from 'three';

function blobTex(color) {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
  g.addColorStop(0, color);
  g.addColorStop(0.45, color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.needsUpdate = true;
  return t;
}

export function createFx(scene) {
  const textures = {
    fire: blobTex('rgba(255,200,80,1)'),
    smoke: blobTex('rgba(80,70,60,0.7)'),
    splash: blobTex('rgba(200,240,255,1)'),
    hit: blobTex('rgba(255,240,140,1)'),
  };
  const mats = {
    fire: new THREE.SpriteMaterial({
      map: textures.fire,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
    smoke: new THREE.SpriteMaterial({
      map: textures.smoke,
      transparent: true,
      depthWrite: false,
    }),
    splash: new THREE.SpriteMaterial({
      map: textures.splash,
      transparent: true,
      depthWrite: false,
    }),
    hit: new THREE.SpriteMaterial({
      map: textures.hit,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  };

  const pool = [];
  const max = 280;
  for (let i = 0; i < max; i++) {
    const spr = new THREE.Sprite(mats.fire.clone());
    spr.visible = false;
    scene.add(spr);
    pool.push({
      spr,
      alive: false,
      life: 0,
      maxLife: 1,
      vx: 0,
      vy: 0,
      vz: 0,
      size: 0.4,
      type: 'fire',
    });
  }

  function spawnOne(x, y, z, type, extra = {}) {
    const p = pool.find((q) => !q.alive);
    if (!p) return;
    p.alive = true;
    p.type = type;
    p.life = extra.life ?? 0.6 + Math.random() * 0.5;
    p.maxLife = p.life;
    p.vx = extra.vx ?? (Math.random() - 0.5) * 1.4;
    p.vy = extra.vy ?? 1.2 + Math.random() * 1.4;
    p.vz = extra.vz ?? (Math.random() - 0.5) * 1.4;
    p.size = extra.size ?? 0.35 + Math.random() * 0.35;
    const src = mats[type] || mats.fire;
    p.spr.material.map = src.map;
    p.spr.material.blending = src.blending;
    p.spr.material.opacity = 1;
    p.spr.position.set(x, y, z);
    p.spr.scale.setScalar(p.size);
    p.spr.visible = true;
  }

  function burst(x, y, z, type, n = 8) {
    for (let i = 0; i < n; i++) {
      if (type === 'splash') {
        spawnOne(x, y, z, 'splash', {
          vx: (Math.random() - 0.5) * 2.5,
          vy: 1 + Math.random() * 2.5,
          vz: (Math.random() - 0.5) * 2.5,
          life: 0.45,
          size: 0.25 + Math.random() * 0.3,
        });
      } else if (type === 'hit') {
        spawnOne(x, y, z, 'hit', {
          vx: (Math.random() - 0.5) * 3,
          vy: 0.6 + Math.random() * 2,
          vz: (Math.random() - 0.5) * 3,
          life: 0.35,
          size: 0.2 + Math.random() * 0.25,
        });
      } else if (type === 'smoke') {
        spawnOne(x, y, z, 'smoke', {
          vx: (Math.random() - 0.5) * 0.4,
          vy: 0.6 + Math.random() * 0.5,
          vz: (Math.random() - 0.5) * 0.4,
          life: 1.4,
          size: 0.6 + Math.random() * 0.5,
        });
      } else {
        spawnOne(x, y, z, 'fire', {
          vx: (Math.random() - 0.5) * 0.6,
          vy: 1.2 + Math.random() * 1.6,
          vz: (Math.random() - 0.5) * 0.6,
          life: 0.55,
          size: 0.35 + Math.random() * 0.4,
        });
      }
    }
  }

  function emitFire(x, y, z, dt) {
    if (Math.random() < dt * 18) burst(x, y, z, 'fire', 1);
    if (Math.random() < dt * 8) burst(x, y + 0.3, z, 'smoke', 1);
  }

  function update(dt) {
    for (const p of pool) {
      if (!p.alive) continue;
      p.life -= dt;
      p.spr.position.x += p.vx * dt;
      p.spr.position.y += p.vy * dt;
      p.spr.position.z += p.vz * dt;
      if (p.type === 'fire' || p.type === 'smoke') p.vy += dt * 0.4;
      if (p.type === 'splash') p.vy -= dt * 9;
      const t = Math.max(0, p.life / p.maxLife);
      const s = p.size * (0.6 + (1 - t) * 0.8);
      p.spr.scale.setScalar(s);
      p.spr.material.opacity = p.type === 'smoke' ? t * 0.55 : t;
      if (p.life <= 0) {
        p.alive = false;
        p.spr.visible = false;
      }
    }
  }

  return { burst, emitFire, update };
}
