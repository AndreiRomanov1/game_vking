import * as THREE from 'three';
import { DEFENDERS, FUN_LINES } from './config.js';
import { createRtsCamera } from './camera.js';
import { createDayCycle } from './daycycle.js';
import { createMap, terrainHeight } from './world/map.js';
import { createTerrain, updateTerrain } from './world/terrain.js';
import { createWater, updateWater } from './world/water.js';
import { createVillage } from './world/village.js';
import { createProps } from './world/props.js';
import { createShips, updateShips, deckWorld } from './world/ships.js';
import { createUnit, place, addUnitToScene, updateBillboards } from './units/unit.js';
import { createCombat, resolveMelee } from './units/combat.js';
import {
  updateMovement,
  updateVikingAuto,
  updateDefenders,
  orderMove,
  disembark,
} from './units/ai.js';
import { createFx } from './fx/particles.js';
import { createFloatingText } from './fx/floatingText.js';
import { createHud } from './ui/hud.js';
import { bindInput } from './input.js';

const canvas = document.getElementById('game');
const hudRoot = document.getElementById('hud');

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: 'high-performance',
  alpha: false,
});
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const rts = createRtsCamera(canvas);
const camera = rts.camera;
rts.focus(0.3, 15.2, 31);

const map = createMap();
const day = createDayCycle(scene, renderer);
const terrain = createTerrain(scene);
const water = createWater(scene);
const village = createVillage(scene, map, day);
const props = createProps(scene);
const ships = createShips(scene);
const fx = createFx(scene);
const combat = createCombat();
const hud = createHud(hudRoot, canvas, camera);
const floats = createFloatingText(hudRoot, camera, canvas);

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
};

bindInput(game);

let saidLand = false;
let orderedCharge = false;
let saidDusk = false;
let saidNight = false;
let saidFire = false;
let moodFire = false;
let over = false;

hud.say('Драккары на горизонте!');

function onEvent(type, st) {
  if (type === 'structureDown') {
    const label = st.kind === 'gate' ? 'Ворота хрясь!' : st.kind === 'longhouse' ? 'Холл горит!' : 'Трах!';
    floats.spawn(st.x, 2.2, st.z, label, '#ffb24a');
    props.scareChickens(st.x, st.z);
  }
}

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h, false);
  rts.resize();
}
window.addEventListener('resize', resize);
resize();

let last = performance.now();

function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  game.matchTime += dt;
  const time = game.matchTime;

  const burning = village.structures.filter((s) => s.onFire).length;
  game.look = day.update(time, burning * 0.22);
  updateWater(water, time, game.look);
  updateTerrain(terrain, time);
  updateShips(ships, dt, time, fx);

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
      fx.burst(ship.mesh.position.x, 0.25, ship.mesh.position.z - 2.1, 'splash', 16);
    }
  }

  if (!saidLand && ships.every((s) => s.spawned)) {
    saidLand = true;
    hud.say(FUN_LINES.land[0]);
    floats.spawn(0, 2, 12, 'К берегу!', '#ffe08a');
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
    }
    place(u);
  }

  if (saidLand && !orderedCharge && time > 11.2) {
    orderedCharge = true;
    const viks = units.filter((u) => u.side === 'viking' && !u.dead && u.state !== 'aboard');
    orderMove(viks, map, 0.1, 5.0, true);
    hud.say('На ворота!');
  }

  const alert = village.gate.dead || village.structures.some((s) => s.onFire);
  updateMovement(units, map, dt);
  updateVikingAuto(units, village.structures, combat, scene, dt);
  updateDefenders(units, village.structures, map, combat, scene, dt, alert);
  resolveMelee(units, village.structures, fx, floats, map, onEvent);
  combat.update(dt, units, village.structures, scene, fx, floats, map, onEvent);

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
    if (u.hitFlash > 0) {
      u.hitFlash -= dt;
      u.mat.emissive.setHex(0xfff2aa);
      u.mat.emissiveIntensity = 0.9;
    } else {
      u.mat.emissive.setHex(0x33220a);
      u.mat.emissiveIntensity = 0.35;
    }
    if (u.side === 'viking' && u.state !== 'aboard' && time > 8) {
      props.scareChickens(u.x, u.z);
    }
  }

  for (const st of village.structures) {
    if (st.onFire) fx.emitFire(st.x, st.group.position.y + 1.5, st.z, dt);
  }

  if (!moodFire && game.look.k3 > 0.12) {
    const hut = village.structures.find((s) => s.kind === 'hut' && !s.dead);
    if (hut && !village.structures.some((s) => s.onFire)) {
      hut.onFire = true;
      moodFire = true;
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
  props.update(dt, time, camera);
  rts.update(dt);
  updateBillboards(units, camera);
  hud.update(dt, game);

  if (!over) {
    const hall = village.structures.find((s) => s.kind === 'longhouse');
    const viks = units.filter((u) => u.side === 'viking' && !u.dead);
    const defs = units.filter((u) => u.side === 'defend' && !u.dead);
    const landed = ships.every((s) => s.spawned);
    if (hall.dead || (landed && defs.length === 0)) {
      over = true;
      hud.end(true);
    } else if (landed && viks.length === 0) {
      over = true;
      hud.end(false);
    }
  }

  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
