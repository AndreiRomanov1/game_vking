export const MATCH_DAY_SECONDS = 88;

export const WORLD = {
  seaZ: 16.4,
  beachZ0: 7.6,
  palisade: { minX: -13.6, maxX: 13.6, minZ: -11.8, maxZ: 5.9 },
  gate: { x: 0, z: 5.9, width: 4.6 },
  longhouse: { x: 0, z: -7.6, w: 8.2, d: 4.6 },
};

export const HUTS = [
  { x: -8.2, z: -1.6, s: 1.05 },
  { x: 8.4, z: -0.8, s: 0.95 },
  { x: -7.4, z: -8.4, s: 0.9 },
  { x: 7.6, z: -8.8, s: 1.1 },
  { x: -4.2, z: 2.1, s: 0.85 },
  { x: 5.1, z: 1.6, s: 0.88 },
];

export const TORCHES = [
  { x: -13.2, z: 5.6, y: 3.4 },
  { x: 13.2, z: 5.6, y: 3.4 },
  { x: -13.2, z: -11.4, y: 2.6 },
  { x: 13.2, z: -11.4, y: 2.6 },
  { x: 0, z: -1.2, y: 1.7 },
  { x: 0, z: -5.2, y: 2.4 },
];

export const SHIPS = [
  { x: 0.2, startZ: 24.8, endZ: 13.6, delay: 0.15, yaw: 0 },
  { x: -7.4, startZ: 26.4, endZ: 14.3, delay: 1.05, yaw: 0.08 },
  { x: 7.6, startZ: 25.8, endZ: 14.0, delay: 1.7, yaw: -0.1 },
];

export const VIKING_CREWS = [
  ['berserk', 'shield', 'archer', 'berserk', 'shield'],
  ['shield', 'archer', 'berserk', 'archer', 'shield'],
  ['berserk', 'archer', 'shield', 'berserk', 'archer'],
];

export const DEFENDERS = [
  { type: 'militia', x: -2.4, z: 4.4 },
  { type: 'militia', x: 2.5, z: 4.3 },
  { type: 'militia', x: 0.1, z: 3.2 },
  { type: 'militia', x: -5.4, z: 3.6 },
  { type: 'archer', x: -10.5, z: 4.4 },
  { type: 'archer', x: 10.6, z: 4.4 },
  { type: 'archer', x: -8.8, z: 1.2 },
  { type: 'militia', x: -3.2, z: -1.5 },
  { type: 'militia', x: 3.6, z: -2.2 },
  { type: 'archer', x: -4.8, z: -5.6 },
  { type: 'archer', x: 4.9, z: -5.8 },
  { type: 'militia', x: 1.6, z: -4.2 },
  { type: 'chief', x: 0.2, z: -6.4 },
];

export const PALETTE = {
  grass: 0x4cb84a,
  grassDark: 0x2f8a38,
  sand: 0xf0c07a,
  sandWet: 0xd9a05a,
  dirt: 0xb57a42,
  rock: 0x8a7b6c,
  thatch: 0xd9a23a,
  wood: 0x8a4e28,
  sailRed: 0xd23a2a,
};

export const UNIT_TYPES = {
  berserk: {
    side: 'viking',
    name: 'Берсерк',
    hp: 96,
    speed: 3.55,
    range: 1.4,
    damage: 18,
    cooldown: 0.68,
    radius: 0.48,
    sprite: 'berserk',
    melee: true,
    scale: 1.85,
  },
  archer: {
    side: 'viking',
    name: 'Лучник',
    hp: 58,
    speed: 3.35,
    range: 9.4,
    damage: 9,
    cooldown: 1.05,
    radius: 0.4,
    sprite: 'varcher',
    melee: false,
    scale: 1.7,
  },
  shield: {
    side: 'viking',
    name: 'Щитоносец',
    hp: 84,
    speed: 3.15,
    range: 1.45,
    damage: 12,
    cooldown: 0.78,
    radius: 0.46,
    sprite: 'shield',
    melee: true,
    scale: 1.78,
  },
  militia: {
    side: 'defend',
    name: 'Ополченец',
    hp: 62,
    speed: 2.85,
    range: 1.35,
    damage: 8,
    cooldown: 0.86,
    radius: 0.42,
    sprite: 'militia',
    melee: true,
    scale: 1.62,
  },
  darcher: {
    side: 'defend',
    name: 'Лучник деревни',
    hp: 48,
    speed: 2.7,
    range: 9.0,
    damage: 7,
    cooldown: 1.12,
    radius: 0.4,
    sprite: 'darcher',
    melee: false,
    scale: 1.6,
  },
  chief: {
    side: 'defend',
    name: 'Староста',
    hp: 160,
    speed: 2.35,
    range: 1.55,
    damage: 16,
    cooldown: 0.92,
    radius: 0.58,
    sprite: 'chief',
    melee: true,
    scale: 2.15,
  },
};

export const FUN_LINES = {
  hitViking: ['В Вальгаллу!', 'За ярла!', 'Ха-ха!', 'Ещё!'],
  hitDefend: ['Ой!', 'Моя курица!', 'Караул!', 'Не по голове!'],
  land: ['К берегу!', 'Драккары сели!', 'На песок!'],
  fire: ['Крыша пылает!', 'Жарче бани!', 'Деревня пышет!'],
  dusk: ['Солнце падает в море'],
  night: ['Ночь и зарево'],
};
