// ── Daily Run — deterministic, fully offline ────────────────────────────────
// Событие закреплено за днём недели: по понедельникам одно, по вторникам другое.
// Внутри дня сид фиксирован датой, поэтому забег воспроизводим для всех.

import type { BaseShipId, PowerupType } from './types';

const MONTHS = ['ЯНВ', 'ФЕВ', 'МАР', 'АПР', 'МАЙ', 'ИЮН', 'ИЮЛ', 'АВГ', 'СЕН', 'ОКТ', 'НОЯ', 'ДЕК'];
const WEEKDAYS = ['ВОСКРЕСЕНЬЕ', 'ПОНЕДЕЛЬНИК', 'ВТОРНИК', 'СРЕДА', 'ЧЕТВЕРГ', 'ПЯТНИЦА', 'СУББОТА'];

/** Одна попытка в сутки — рейтинг честнее, фарм ретраями невозможен. */
export const DAILY_ATTEMPTS = 1;

/** Потолок добычи за ежедневный вылет: эталонный корабль не ломает экономику. */
export const DAILY_COIN_CAP = 2000;

/** Local calendar day as YYYY-MM-DD. */
export function todayKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** '2026-09-04' → '04 СЕН 2026' */
export function formatDailyKey(key: string): string {
  const [y, m, d] = key.split('-');
  const mi = Math.max(0, Math.min(11, Number(m) - 1));
  return `${d} ${MONTHS[mi]} ${y}`;
}

/** День недели 0..6 (0 — воскресенье) по ключу даты. */
export function weekdayOf(key: string): number {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).getDay();
}

export function weekdayName(key: string): string {
  return WEEKDAYS[weekdayOf(key)];
}

/** Deterministic 32-bit string hash (FNV-1a flavoured). */
export function hashSeed(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

/** mulberry32 — small, fast, well-distributed PRNG. */
export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface DailyMutator {
  id: string;
  name: string;
  desc: string;
  color: string;
  enemyHp?: number;
  enemySpeed?: number;
  spawnRate?: number;
  bulletSpeed?: number;
  coinMul?: number;
  scoreMul?: number;
  bossInterval?: number;
  oneHp?: boolean;
  startPowerup?: PowerupType;
}

export const DAILY_MUTATORS: Record<string, DailyMutator> = {
  swarm: { id: 'swarm', name: 'РОЙ', desc: 'Больше врагов, тоньше броня', color: '#4ade80', spawnRate: 1.45, enemyHp: 0.7, scoreMul: 1.1 },
  armored: { id: 'armored', name: 'БРОНИРОВАННЫЕ', desc: 'Противники крепче, но медленнее', color: '#94a3b8', enemyHp: 1.55, enemySpeed: 0.85, scoreMul: 1.15 },
  goldrush: { id: 'goldrush', name: 'ЗОЛОТАЯ ЛИХОРАДКА', desc: 'Двойная добыча монет', color: '#fbbf24', coinMul: 2 },
  glass: { id: 'glass', name: 'СТЕКЛЯННЫЙ КОРПУС', desc: 'Одна прочность, двойной счёт', color: '#f472b6', oneHp: true, scoreMul: 2 },
  hotstart: { id: 'hotstart', name: 'ГОРЯЧИЙ СТАРТ', desc: 'Запуск с активным Скорострелом', color: '#ffd23f', startPowerup: 'rapid' },
  bosshunt: { id: 'bosshunt', name: 'ОХОТА НА ЛИНКОРЫ', desc: 'Линейные корабли вдвое чаще', color: '#fb7185', bossInterval: 0.55, scoreMul: 1.2 },
  hailstorm: { id: 'hailstorm', name: 'ГРАД ОГНЯ', desc: 'Вражеские снаряды быстрее', color: '#38bdf8', bulletSpeed: 1.3, scoreMul: 1.15 },
  blitz: { id: 'blitz', name: 'БЛИЦ', desc: 'Всё движется быстрее', color: '#a78bfa', enemySpeed: 1.3, spawnRate: 1.15, scoreMul: 1.15 },
  shielded: { id: 'shielded', name: 'ЭНЕРГОЩИТ', desc: 'Старт под защитным полем', color: '#22d3ee', startPowerup: 'shield' },
  overdrive: { id: 'overdrive', name: 'ПЕРЕГРУЗКА', desc: 'Старт с удвоенным уроном', color: '#f472b6', startPowerup: 'power' },
};

/** Событие, закреплённое за днём недели. */
export interface DailyEvent {
  weekday: number;
  name: string;
  tagline: string;
  color: string;
  mutators: string[];
  /** фиксированный гибрид: на нём летят все участники */
  ship: [BaseShipId, BaseShipId];
}

export const DAILY_EVENTS: DailyEvent[] = [
  {
    weekday: 1,
    name: 'ЖЕЛЕЗНЫЙ ПОНЕДЕЛЬНИК',
    tagline: 'Толстая броня против плотных волн',
    color: '#34d399',
    mutators: ['armored', 'swarm'],
    ship: ['titan', 'falcon'],
  },
  {
    weekday: 2,
    name: 'ВТОРНИК СКОРОСТИ',
    tagline: 'Всё летит быстрее — реакция решает',
    color: '#a78bfa',
    mutators: ['blitz', 'hotstart'],
    ship: ['comet', 'nova'],
  },
  {
    weekday: 3,
    name: 'СРЕДА ЛИНКОРОВ',
    tagline: 'Капитальные корабли идут один за другим',
    color: '#fb7185',
    mutators: ['bosshunt', 'overdrive'],
    ship: ['nova', 'titan'],
  },
  {
    weekday: 4,
    name: 'ЧЕТВЕРГ БЕЗДНЫ',
    tagline: 'Шквал огня и никакой пощады',
    color: '#818cf8',
    mutators: ['hailstorm', 'shielded'],
    ship: ['voidx', 'comet'],
  },
  {
    weekday: 5,
    name: 'ЗОЛОТАЯ ПЯТНИЦА',
    tagline: 'Максимальная добыча за вылет',
    color: '#fbbf24',
    mutators: ['goldrush', 'swarm'],
    ship: ['falcon', 'comet'],
  },
  {
    weekday: 6,
    name: 'СУББОТНЯЯ МЯСОРУБКА',
    tagline: 'Рой врагов и усиленные орудия',
    color: '#4ade80',
    mutators: ['swarm', 'overdrive'],
    ship: ['titan', 'nova'],
  },
  {
    weekday: 0,
    name: 'ВОСКРЕСНЫЙ ПРЕДЕЛ',
    tagline: 'Одно попадание — конец. Двойной счёт',
    color: '#ef4444',
    mutators: ['glass', 'shielded'],
    ship: ['voidx', 'nova'],
  },
];

export function eventForKey(key: string): DailyEvent {
  const wd = weekdayOf(key);
  return DAILY_EVENTS.find((e) => e.weekday === wd) ?? DAILY_EVENTS[0];
}

export interface DailyConfig {
  key: string;
  seed: number;
  label: string;
  weekday: string;
  event: DailyEvent;
  mutators: DailyMutator[];
  /** фиксированный корабль события */
  ship: [BaseShipId, BaseShipId];
  enemyHp: number;
  enemySpeed: number;
  spawnRate: number;
  bulletSpeed: number;
  /** множитель урона вражеских атак */
  dmgMul: number;
  coinMul: number;
  scoreMul: number;
  bossInterval: number;
  oneHp: boolean;
  startPowerup: PowerupType | null;
}

/** Builds today's (or any date's) deterministic configuration. */
export function buildDaily(key: string = todayKey()): DailyConfig {
  const seed = hashSeed(`nova-strike::${key}`);
  const event = eventForKey(key);
  const picked = event.mutators.map((id) => DAILY_MUTATORS[id]).filter(Boolean);

  const cfg: DailyConfig = {
    key,
    seed,
    label: formatDailyKey(key),
    weekday: weekdayName(key),
    event,
    mutators: picked,
    ship: event.ship,
    // корабль выдаётся топовый, поэтому враги вдвое крепче и бьют вдвое больнее
    enemyHp: 2,
    enemySpeed: 1,
    spawnRate: 1,
    bulletSpeed: 1,
    dmgMul: 2,
    // ежедневное всегда щедрее обычного забега
    coinMul: 2.5,
    scoreMul: 1.1,
    bossInterval: 1,
    oneHp: false,
    startPowerup: null,
  };
  for (const m of picked) {
    cfg.enemyHp *= m.enemyHp ?? 1;
    cfg.enemySpeed *= m.enemySpeed ?? 1;
    cfg.spawnRate *= m.spawnRate ?? 1;
    cfg.bulletSpeed *= m.bulletSpeed ?? 1;
    cfg.coinMul *= m.coinMul ?? 1;
    cfg.scoreMul *= m.scoreMul ?? 1;
    cfg.bossInterval *= m.bossInterval ?? 1;
    cfg.oneHp = cfg.oneHp || !!m.oneHp;
    if (m.startPowerup) cfg.startPowerup = m.startPowerup;
  }
  return cfg;
}

/** Сколько попыток осталось сегодня. */
export function attemptsLeft(runsToday: number): number {
  return Math.max(0, DAILY_ATTEMPTS - runsToday);
}
