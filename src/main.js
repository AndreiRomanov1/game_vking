import * as THREE from 'three';
import { DEFENDERS, FUN_LINES, LOOT } from './config.js';
import { createRtsCamera } from './camera.js';
import { createDayCycle } from './daycycle.js';
import { createMap, terrainHeight } from './world/map.js';
import { createTerrain, updateTerrain } from './world/terrain.js';
import { createWater, updateWater } from './world/water.js';
import { createVillage } from './world/village.js';
import { createProps } from './world/props.js';
import { createGrass } from './world/grass.js';
import { createVillagers, updateVillagers } from './world/villagers.js';
import { createShips, updateShips, deckWorld } from './world/ships.js';
import { createUnit, place, addUnitToScene, updateBillboards } from './units/unit.js';
import { createCombat, resolveMelee } from './units/combat.js';
import { updateMovement, updateVikingAuto, updateDefenders, disembark } from './units/ai.js';
import { applySelection } from './units/selection.js';
import { tickBuffs } from './abilities.js';
import { createFx } from './fx/particles.js';
import { createFloatingText } from './fx/floatingText.js';
import { createHud } from './ui/hud.js';
import { createMarkers } from './ui/markers.js';
import { createAudio } from './audio.js';
import { bindInput } from './input.js';
import { createPostFx, QUALITY_LABELS } from './gfx/postfx.js';

const canvas = document.getElementById('game');
const hudRoot = document.getElementById('hud');
const fadeEl = document.getElementById('fade');

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: 'high-performance',
  alpha: false,
  stencil: false,
});
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const rts = createRtsCamera(canvas);
const camera = rts.camera;
rts.focus(0, 5, 30);
rts.setPitchOffset(-22, true);

const map = createMap();
const day = createDayCycle(scene, renderer);
const terrain = createTerrain(scene);
const water = createWater(scene);
const village = createVillage(scene, map, day);
const props = createProps(scene);
const grass = createGrass(scene, { count: 15000, seed: 1 });
const flowers = createGrass(scene, {
  count: 900,
  seed: 5,
  flowers: true,
  base: '#3a7a28',
  tip: '#ffd94a',
  height: 0.34,
  width: 0.11,
});
const villagers = createVillagers(scene);
const ships = createShips(scene);
const fx = createFx(scene);
const combat = createCombat();
const floats = createFloatingText(hudRoot, camera, canvas);
const markers = createMarkers(scene);
const audio = createAudio();

const fireLights = [];
for (let i = 0; i < 4; i++) {
  const l = new THREE.PointLight(0xff7a2a, 0, 13, 1.9);
  scene.add(l);
  fireLights.push(l);
}

const units = [];

for (const ship of ships) {
  ship.crew.forEach((kind, k) => {
    const local = { x: ((k % 3) - 1) * 0.38, z: ((k / 3) | 0) * 0.7 - 0.55 };
    const p = deckWorld(ship, local.x, local.z);
    const u = createUnit(kind, p.x, p.z, { state: 'aboard', ship, local });
    u.y = p.y;
    place(u);
    addUnitToScene(scene, u);
    units.push(u);
  });
}

for (const d of DEFENDERS) {
  const kind = d.type === 'archer' ? 'darcher' : d.type;
  const u = createUnit(kind, d.x, d.z);
  addUnitToScene(scene, u);
  units.push(u);
}

const game = {
  canvas,
  scene,
  camera,
  renderer,
  map,
  terrain,
  village,
  units,
  look: null,
  matchTime: 0,
  started: false,
  paused: false,
  over: false,
  gold: 0,
  stats: { kills: 0, buildings: 0, gold: 0, time: 0 },
  attackMovePending: false,
  groups: { 1: [], 2: [], 3: [] },
  rts,
  audio,
  floats,
  markers,
  hud: null,
  postfx: null,
  startMatch: null,
  togglePause: null,
};

const postfx = createPostFx(renderer, scene, camera, {
  onChange: (level) => game.hud?.setQuality(QUALITY_LABELS[level]),
  onLevel: (level) => {
    grass.mesh.visible = level >= 1;
    flowers.mesh.visible = level >= 1;
    day.setShadowQuality(level);
  },
});
game.postfx = postfx;

const hud = createHud(hudRoot, canvas, camera, game);
game.hud = hud;
hud.setQuality(QUALITY_LABELS[postfx.level]);

combat.onHit = () => audio.hit();
combat.onKill = (unit, loot = 0) => {
  if (unit.side === 'defend') game.stats.kills += 1;
  if (loot) addGold(loot, unit.x, unit.y + 1.6, unit.z);
};
combat.onArrow = () => audio.arrow();

function addGold(amount, x, y, z) {
  game.gold += amount;
  game.stats.gold += amount;
  floats.spawn(x, y, z, `+${amount}`, '#ffe08a');
  fx.burst(x, y - 0.4, z, 'gold', Math.min(18, 5 + (amount / 10) | 0));
  audio.gold();
}

function onEvent(type, st) {
  if (type === 'structureDown') {
    const label = st.kind === 'gate' ? FUN_LINES.gate[0] : st.kind === 'longhouse' ? 'Холл горит!' : 'Трах!';
    floats.spawn(st.x, 2.2, st.z, label, '#ffb24a');
    props.scareChickens(st.x, st.z);
    const loot = LOOT[st.kind] || 20;
    addGold(loot, st.x, 2.6, st.z);
    game.stats.buildings += 1;
    audio.fire();
    rts.shake(st.kind === 'longhouse' ? 0.55 : st.kind === 'gate' ? 0.45 : 0.22);
    if (st.kind === 'gate') {
      hud.say(FUN_LINES.gate[0]);
      spawnReserves();
    }
  }
}

let spawnedReserve = false;
function spawnReserves() {
  if (spawnedReserve) return;
  spawnedReserve = true;
  const spots = [
    { x: -1.4, z: -6.8 },
    { x: 1.5, z: -6.6 },
    { x: 0.1, z: -5.4 },
  ];
  for (const s of spots) {
    const u = createUnit('militia', s.x, s.z);
    addUnitToScene(scene, u);
    units.push(u);
    fx.burst(s.x, u.y + 0.3, s.z, 'dust', 8);
  }
  hud.say(FUN_LINES.reserve[0]);
}

game.startMatch = () => {
  if (game.started) return;
  game.started = true;
  hud.hideMenu();
  audio.start();
  hud.say('Драккары на горизонте!');
  rts.setEdgeScroll(true);
  rts.flyTo(rts.target.x, rts.target.z, rts.dist, rts.yaw, 0.3, 15.2, 31, 0.22, 2.8);
};

game.togglePause = () => {
  if (!game.started || game.over) return;
  game.paused = !game.paused;
  hud.setPaused(game.paused);
  rts.setEdgeScroll(!game.paused);
};

bindInput(game);
window.__raid = game;

let saidLand = false;
let saidDusk = false;
let saidNight = false;
let saidFire = false;

function resize() {
  postfx.resize();
  rts.resize();
  const size = new THREE.Vector2();
  renderer.getDrawingBufferSize(size);
  fx.setViewport(size.y, camera.fov);
}
window.addEventListener('resize', resize);
resize();

let last = performance.now();
let menuClock = 0;
let frames = 0;

function updateFireLights(time) {
  const burning = village.structures.filter((s) => s.onFire);
  burning.sort((a, b) => {
    const da = (a.x - rts.target.x) ** 2 + (a.z - rts.target.z) ** 2;
    const db = (b.x - rts.target.x) ** 2 + (b.z - rts.target.z) ** 2;
    return da - db;
  });
  for (let i = 0; i < fireLights.length; i++) {
    const l = fireLights[i];
    const st = burning[i];
    if (!st) {
      l.intensity = 0;
      continue;
    }
    l.position.set(st.x, st.group.position.y + 2.2, st.z);
    l.intensity = (5.5 + Math.sin(time * 17 + i * 2.1) * 1.3 + Math.sin(time * 31 + i) * 0.7) * (st.dead ? 0.7 : 1);
  }
}

function updateWorldVisuals(dt, matchTime, anim) {
  const burning = village.structures.filter((s) => s.onFire).length;
  game.look = day.update(matchTime, burning * 0.22, anim);
  updateWater(water, anim, game.look);
  updateTerrain(terrain, anim);
  grass.update(anim, game.look);
  flowers.update(anim, game.look);
  village.update(anim, game.look);
  fx.setLook(game.look);
  postfx.setMood(game.look);
  for (const src of village.smokeSources) {
    if (src.st.dead) continue;
    fx.emitSmoke(src.x, src.y, src.z, dt, src.rate * (0.6 + game.look.night * 0.8));
  }
  updateFireLights(anim);
}

function loop(now) {
  // rAF timestamps can precede performance.now() taken during a slow init; never step backwards.
  const dt = THREE.MathUtils.clamp((now - last) / 1000, 0, 0.1) || 0;
  last = now;
  frames++;
  if (frames === 2) {
    fadeEl.classList.add('out');
    setTimeout(() => fadeEl.remove(), 2000);
  }
  const time = game.started && !game.paused ? (game.matchTime += dt) : game.matchTime;

  if (!game.started || game.paused) {
    if (!game.started) {
      menuClock += dt;
      rts.focus(
        Math.sin(menuClock * 0.09) * 5,
        5 + Math.cos(menuClock * 0.07) * 2.5,
        30 + Math.sin(menuClock * 0.05) * 2.5,
        false,
      );
      rts.setYaw(Math.sin(menuClock * 0.06) * 0.45);
    }
    const ambient = game.started ? time : menuClock;
    updateWorldVisuals(dt, time, ambient);
    updateShips(ships, 0, time, fx, ambient);
    for (const u of units) {
      if (u.state === 'aboard' && u.ship) {
        const p = deckWorld(u.ship, u.local.x, u.local.z);
        u.x = p.x;
        u.z = p.z;
        u.y = p.y;
        place(u);
      }
    }
    fx.update(dt);
    floats.update(dt);
    props.update(dt, ambient, camera, game.look);
    rts.update(game.paused ? 0 : dt);
    updateBillboards(units, camera);
    hud.update(dt, game);
    postfx.render(dt);
    requestAnimationFrame(loop);
    return;
  }

  updateWorldVisuals(dt, time, time);
  updateShips(ships, dt, time, fx);
  tickBuffs(units, dt);

  const torchOn = game.look.torchT > 0.12;
  for (const spr of village.torchSprites) {
    spr.visible = torchOn;
    const s = 0.62 + Math.sin(time * 13 + spr.position.x) * 0.14;
    spr.scale.set(s, s * 1.55, 1);
    if (torchOn && Math.random() < dt * 6) {
      fx.emitFire(spr.position.x, spr.position.y, spr.position.z, dt * 0.4);
    }
  }

  for (const u of units) {
    if (u.state === 'aboard' && u.ship) {
      const p = deckWorld(u.ship, u.local.x, u.local.z);
      u.x = p.x;
      u.z = p.z;
      u.y = p.y;
      place(u);
    }
  }

  for (const ship of ships) {
    if (ship.landed && !ship.spawned) {
      ship.spawned = true;
      const crew = units.filter((u) => u.ship === ship);
      crew.forEach((u, i) => {
        disembark(
          u,
          {
            x: ship.def.x + (i - 2) * 0.95,
            z: ship.def.endZ - 2.3 - (i % 2) * 0.55,
          },
          map,
        );
      });
      fx.burst(ship.mesh.position.x, 0.25, ship.mesh.position.z - 2.1, 'splash', 22);
      rts.shake(0.12);
    }
  }

  if (!saidLand && ships.every((s) => s.spawned)) {
    saidLand = true;
    hud.say(FUN_LINES.land[0]);
    floats.spawn(0, 2, 12, 'К берегу!', '#ffe08a');
    audio.land();
    applySelection(
      units,
      units.filter((u) => u.side === 'viking' && !u.dead),
    );
  }

  for (const u of units) {
    if (u.state !== 'jump') continue;
    u.jumpT += dt / 0.48;
    const t = Math.min(1, u.jumpT);
    u.x = THREE.MathUtils.lerp(u.jumpFrom.x, u.jumpTo.x, t);
    u.z = THREE.MathUtils.lerp(u.jumpFrom.z, u.jumpTo.z, t);
    const h1 = terrainHeight(u.jumpTo.x, u.jumpTo.z);
    u.y = THREE.MathUtils.lerp(u.jumpFrom.y, h1, t) + Math.sin(t * Math.PI) * 1.45;
    if (t >= 1) {
      u.state = 'idle';
      u.y = h1;
      u.home = { x: u.x, z: u.z };
      fx.burst(u.x, u.y + 0.1, u.z, 'dust', 5);
    }
    place(u);
  }

  const alert = village.gate.dead || village.structures.some((s) => s.onFire);
  updateMovement(units, map, dt);
  updateVikingAuto(units, village.structures, combat, scene, dt, game.look.k3);
  updateDefenders(units, village.structures, map, combat, scene, dt, alert);
  resolveMelee(units, village.structures, fx, floats, map, onEvent, combat);
  combat.update(dt, units, village.structures, scene, fx, floats, map, onEvent);
  updateVillagers(villagers, units, dt, camera, (v, amount) => {
    addGold(amount, v.x, v.y + 1.4, v.z);
    floats.spawn(v.x, v.y + 1.8, v.z, FUN_LINES.loot[(Math.random() * FUN_LINES.loot.length) | 0], '#fff0c8');
  });

  for (const u of units) {
    if (u.dead) {
      u.mesh.rotation.z += dt * 2.2;
      u.mesh.position.y = Math.max(u.y + 0.2, u.mesh.position.y - dt * 0.8);
      u.mesh.scale.multiplyScalar(Math.max(0.02, 1 - dt * 1.6));
      if (u.mesh.scale.y < 0.08) {
        u.mesh.visible = false;
        u.shadow.visible = false;
        u.ring.visible = false;
      }
      continue;
    }
    if (u.state !== 'aboard' && u.state !== 'jump') {
      u.y = terrainHeight(u.x, u.z);
      place(u);
    }
    u.bob += dt * (u.state === 'move' ? 11 : 4.2);
    u.mesh.position.y += Math.sin(u.bob) * 0.045 * u.def.scale;
    if (u.state === 'move' && u.side === 'viking' && Math.random() < dt * 2.5) {
      fx.burst(u.x, u.y + 0.05, u.z, 'dust', 1);
    }
    if (u.state === 'attack') {
      u.mat.map = u.maps.attack;
      u.mesh.scale.y = u.def.scale * (1.06 + Math.sin(time * 18) * 0.05);
    } else if (u.state === 'move' || u.state === 'jump') {
      u.mat.map = u.maps.walk;
      u.mesh.scale.y = u.def.scale;
    } else {
      u.mat.map = u.maps.idle;
      u.mesh.scale.y = u.def.scale;
    }
    u.mesh.scale.x = u.def.scale * (u.facing || 1);
    if (u.buffs.rage > 0) {
      u.mat.emissive.setHex(0xff4020);
      u.mat.emissiveIntensity = 1.15;
      u.mesh.scale.y *= 1.06;
      if (Math.random() < dt * 10) fx.burst(u.x, u.y + 0.9, u.z, 'ember', 1);
    } else if (u.buffs.wall > 0) {
      u.mat.emissive.setHex(0x4a88ff);
      u.mat.emissiveIntensity = 0.95;
    } else if (u.hitFlash > 0) {
      u.hitFlash -= dt;
      u.mat.emissive.setHex(0xfff2aa);
      u.mat.emissiveIntensity = 0.9;
    } else {
      u.mat.emissive.setHex(0x33220a);
      u.mat.emissiveIntensity = 0.35;
    }
    if (u.selected) {
      const pulse = 0.85 + Math.sin(time * 4 + u.bob) * 0.06;
      u.ring.scale.setScalar(u.def.scale * pulse);
      u.ring.material.opacity = 0.75 + Math.sin(time * 4 + u.bob) * 0.2;
    }
    if (u.side === 'viking' && u.state !== 'aboard' && time > 8) {
      props.scareChickens(u.x, u.z);
    }
  }

  for (const st of village.structures) {
    if (st.onFire) {
      const k = st.dead ? 0.8 : 1;
      const big = st.kind === 'longhouse' ? 1.9 : st.kind === 'hut' ? 1.5 : 1.25;
      fx.emitFire(st.x, st.group.position.y + 1.5, st.z, dt, k, big);
      if (st.kind === 'longhouse') {
        fx.emitFire(st.x - 2.4, st.group.position.y + 2.2, st.z, dt, 0.7 * k, 1.5);
        fx.emitFire(st.x + 2.4, st.group.position.y + 2.2, st.z, dt, 0.7 * k, 1.5);
      }
    }
  }

  if (game.look.phase === 'Закат' && !saidDusk) {
    saidDusk = true;
    hud.say(FUN_LINES.dusk[0]);
  }
  if (game.look.phase === 'Ночь' && !saidNight) {
    saidNight = true;
    hud.say(FUN_LINES.night[0]);
  }
  if (!saidFire && village.structures.some((s) => s.onFire)) {
    saidFire = true;
    hud.say(FUN_LINES.fire[0]);
  }

  fx.update(dt);
  floats.update(dt);
  markers.update(dt);
  props.update(dt, time, camera, game.look);
  rts.update(dt);
  updateBillboards(units, camera);
  hud.update(dt, game);

  if (!game.over) {
    const hall = village.structures.find((s) => s.kind === 'longhouse');
    const viks = units.filter((u) => u.side === 'viking' && !u.dead);
    const defs = units.filter((u) => u.side === 'defend' && !u.dead);
    const landed = ships.every((s) => s.spawned);
    if (hall.dead || (landed && defs.length === 0)) {
      game.over = true;
      game.stats.time = time;
      hud.end(true, game.stats);
      audio.win();
    } else if (landed && viks.length === 0) {
      game.over = true;
      game.stats.time = time;
      hud.end(false, game.stats);
      audio.lose();
    }
  }

  postfx.render(dt);
  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
