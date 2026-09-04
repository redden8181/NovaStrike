import type { GameMode, SaveData } from './types';
import { todayKey } from './dailyRun';

const KEY = 'nova_strike_save_v1'; // key kept stable so v1 saves keep loading
export const SAVE_VERSION = 4;

export function defaultSave(): SaveData {
  return {
    v: SAVE_VERSION,
    best: 0,
    coins: 0,
    muted: false,
    upgrades: { power: 0, rate: 0, streams: 0, hull: 0, shield: 0, magnet: 0 },
    checkpoints: [],
    ship: 'falcon',
    shipsOwned: ['falcon'],
    achievements: [],
    stats: {
      kills: 0,
      totalCoins: 0,
      runs: 0,
      bestTime: 0,
      bossKills: 0,
      bossRushBest: 0,
      hardcoreBest: 0,
      synergiesTriggered: 0,
      abilitiesUsed: 0,
    },
    unlocks: [],
    bestByMode: {},
    daily: { date: todayKey(), best: 0, runs: 0, lastScore: 0 },
  };
}

/** Milestone scores → unlock ids, applied on load so old saves gain unlocks. */
const UNLOCK_BY_SCORE: { score: number; id: string }[] = [
  { score: 50000, id: 'endless' },
  { score: 100000, id: 'bossrush' },
  { score: 250000, id: 'hardcore' },
  { score: 500000, id: 'ship:voidx' },
];

function migrate(raw: Partial<SaveData>): SaveData {
  const sourceVersion = typeof raw.v === 'number' ? raw.v : 1;
  const d = defaultSave();

  // v3 — это была одноразовая выдача тестового прогресса; откатываем её
  // (сохраняем только настройку звука и дата-метку).
  if (sourceVersion === 3) {
    return { ...d, muted: !!raw.muted, daily: { ...d.daily, ...(raw.daily ?? {}) } };
  }

  const save: SaveData = {
    ...d,
    ...raw,
    v: SAVE_VERSION,
    upgrades: { ...d.upgrades, ...(raw.upgrades ?? {}) },
    stats: { ...d.stats, ...(raw.stats ?? {}) },
    checkpoints: Array.isArray(raw.checkpoints) ? [...raw.checkpoints].sort((a, b) => a - b) : [],
    achievements: Array.isArray(raw.achievements) ? raw.achievements : [],
    shipsOwned: Array.isArray(raw.shipsOwned) && raw.shipsOwned.length ? raw.shipsOwned : ['falcon'],
    unlocks: Array.isArray(raw.unlocks) ? [...raw.unlocks] : [],
    bestByMode: (raw.bestByMode ?? {}) as Partial<Record<GameMode, number>>,
    daily: { ...d.daily, ...(raw.daily ?? {}) },
  };

  // v1 → v2/v4: derive milestone unlocks from the historic best score
  for (const u of UNLOCK_BY_SCORE) {
    if (save.best >= u.score) {
      if (!save.checkpoints.includes(u.score)) save.checkpoints.push(u.score);
      if (!save.unlocks.includes(u.id)) save.unlocks.push(u.id);
    }
  }
  save.checkpoints.sort((a, b) => a - b);
  if (save.unlocks.includes('ship:voidx') && !save.shipsOwned.includes('voidx')) {
    save.shipsOwned.push('voidx');
  }
  // roll the daily record over to a new day
  const today = todayKey();
  if (save.daily.date !== today) {
    save.daily = { date: today, best: 0, runs: 0, lastScore: 0 };
  }
  // a ship that no longer exists (or is locked) falls back to the starter
  if (!save.shipsOwned.includes(save.ship)) save.ship = 'falcon';
  return save;
}

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultSave();
    const save = migrate(JSON.parse(raw) as Partial<SaveData>);
    // Lock the migrated version in so one-time migrations never repeat.
    persist(save);
    return save;
  } catch {
    return defaultSave();
  }
}

export function persist(save: SaveData): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(save));
  } catch {
    // storage unavailable (private mode) — game still runs
  }
}
