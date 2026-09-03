import type { SaveData } from './types';

const KEY = 'nova_strike_save_v1';

export function defaultSave(): SaveData {
  return {
    v: 1,
    best: 0,
    coins: 0,
    muted: false,
    upgrades: { power: 0, rate: 0, streams: 0, hull: 0, shield: 0, magnet: 0 },
    checkpoints: [],
    ship: 'falcon',
    shipsOwned: ['falcon'],
    achievements: [],
    stats: { kills: 0, totalCoins: 0, runs: 0, bestTime: 0, bossKills: 0 },
  };
}

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultSave();
    const parsed = JSON.parse(raw) as Partial<SaveData>;
    const d = defaultSave();
    return {
      ...d,
      ...parsed,
      upgrades: { ...d.upgrades, ...(parsed.upgrades ?? {}) },
      stats: { ...d.stats, ...(parsed.stats ?? {}) },
      checkpoints: Array.isArray(parsed.checkpoints) ? parsed.checkpoints : [],
      achievements: Array.isArray(parsed.achievements) ? parsed.achievements : [],
      shipsOwned: Array.isArray(parsed.shipsOwned) && parsed.shipsOwned.length ? parsed.shipsOwned : ['falcon'],
    };
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
