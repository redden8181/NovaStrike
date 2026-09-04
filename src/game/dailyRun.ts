// ── Daily Run — deterministic, fully offline ────────────────────────────────
// Every calendar day maps to a fixed seed, so all runs on the same date share
// identical enemy formations, drops and boss order.

import type { PowerupType } from './types';

const MONTHS = ['ЯНВ', 'ФЕВ', 'МАР', 'АПР', 'МАЙ', 'ИЮН', 'ИЮЛ', 'АВГ', 'СЕН', 'ОКТ', 'НОЯ', 'ДЕК'];

/** Local calendar day as YYYY-MM-DD. */
export function todayKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** '2026-09-04' → '04 SEP 2026' */
export function formatDailyKey(key: string): string {
  const [y, m, d] = key.split('-');
  const mi = Math.max(0, Math.min(11, Number(m) - 1));
  return `${d} ${MONTHS[mi]} ${y}`;
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

export const DAILY_MUTATORS: DailyMutator[] = [
  { id: 'swarm', name: 'РОЙ', desc: 'Больше врагов, тоньше броня', color: '#4ade80', spawnRate: 1.45, enemyHp: 0.7, scoreMul: 1.1 },
  { id: 'armored', name: 'БРОНИРОВАННЫЕ', desc: 'Противники крепче, но медленнее', color: '#94a3b8', enemyHp: 1.55, enemySpeed: 0.85, scoreMul: 1.15 },
  { id: 'goldrush', name: 'ЗОЛОТАЯ ЛИХОРАДКА', desc: 'Двойная добыча монет', color: '#fbbf24', coinMul: 2 },
  { id: 'glass', name: 'СТЕКЛЯННЫЙ КОРПУС', desc: 'Одна прочность, двойной счёт', color: '#f472b6', oneHp: true, scoreMul: 2 },
  { id: 'hotstart', name: 'ГОРЯЧИЙ СТАРТ', desc: 'Запуск с активным Скорострелом', color: '#ffd23f', startPowerup: 'rapid' },
  { id: 'bosshunt', name: 'ОХОТА НА ЛИНКОРЫ', desc: 'Линейные корабли вдвое чаще', color: '#fb7185', bossInterval: 0.55, scoreMul: 1.2 },
  { id: 'hailstorm', name: 'ГРАД ОГНЯ', desc: 'Вражеские снаряды быстрее', color: '#38bdf8', bulletSpeed: 1.3, scoreMul: 1.15 },
  { id: 'blitz', name: 'БЛИЦ', desc: 'Всё движется быстрее', color: '#a78bfa', enemySpeed: 1.3, spawnRate: 1.15, scoreMul: 1.15 },
];

export interface DailyConfig {
  key: string;
  seed: number;
  label: string;
  mutators: DailyMutator[];
  /** combined modifiers */
  enemyHp: number;
  enemySpeed: number;
  spawnRate: number;
  bulletSpeed: number;
  coinMul: number;
  scoreMul: number;
  bossInterval: number;
  oneHp: boolean;
  startPowerup: PowerupType | null;
}

/** Builds today's (or any date's) deterministic configuration. */
export function buildDaily(key: string = todayKey()): DailyConfig {
  const seed = hashSeed(`nova-strike::${key}`);
  const rng = makeRng(seed);
  const pool = [...DAILY_MUTATORS];
  const picked: DailyMutator[] = [];
  const count = 2;
  for (let i = 0; i < count && pool.length; i++) {
    const idx = Math.floor(rng() * pool.length) % pool.length;
    picked.push(pool.splice(idx, 1)[0]);
  }
  const cfg: DailyConfig = {
    key,
    seed,
    label: formatDailyKey(key),
    mutators: picked,
    enemyHp: 1,
    enemySpeed: 1,
    spawnRate: 1,
    bulletSpeed: 1,
    coinMul: 1,
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
