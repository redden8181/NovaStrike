import type { GameMode, SaveData, ShipId, ShipUpgrades } from './types';
import { todayKey } from './dailyRun';
import { emptyUpgrades } from './content';

const KEY = 'nova_strike_save_v1'; // ключ стабилен — старые сейвы продолжают грузиться
export const SAVE_VERSION = 6;

const SHIP_IDS: ShipId[] = ['falcon', 'comet', 'titan', 'nova', 'voidx'];

function emptyShipUpgrades(): Record<ShipId, ShipUpgrades> {
  const out = {} as Record<ShipId, ShipUpgrades>;
  for (const id of SHIP_IDS) out[id] = emptyUpgrades();
  return out;
}

export function defaultSave(): SaveData {
  return {
    v: SAVE_VERSION,
    best: 0,
    coins: 0,
    muted: false,
    shipUpgrades: emptyShipUpgrades(),
    checkpoints: [],
    ship: 'falcon',
    shipsOwned: ['falcon'],
    achievements: [],
    tracks: {},
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

/** Пороги счёта → id разблокировок (для старых сейвов без поля unlocks). */
const UNLOCK_BY_SCORE: { score: number; id: string }[] = [
  { score: 60000, id: 'endless' },
  { score: 120000, id: 'bossrush' },
  { score: 250000, id: 'hardcore' },
  { score: 500000, id: 'ship:voidx' },
];

/** Старое сохранение могло держать одну общую прокачку в поле `upgrades`. */
interface LegacySave extends Partial<SaveData> {
  upgrades?: Partial<ShipUpgrades>;
}

function migrate(raw: LegacySave): SaveData {
  const sourceVersion = typeof raw.v === 'number' ? raw.v : 1;
  const d = defaultSave();

  // v3 — разовая тестовая выдача прогресса; откатываем её полностью
  if (sourceVersion === 3) {
    return { ...d, muted: !!raw.muted, daily: { ...d.daily, ...(raw.daily ?? {}) } };
  }

  const save: SaveData = {
    ...d,
    ...raw,
    v: SAVE_VERSION,
    shipUpgrades: emptyShipUpgrades(),
    stats: { ...d.stats, ...(raw.stats ?? {}) },
    checkpoints: Array.isArray(raw.checkpoints) ? [...raw.checkpoints].sort((a, b) => a - b) : [],
    achievements: Array.isArray(raw.achievements) ? raw.achievements : [],
    shipsOwned: Array.isArray(raw.shipsOwned) && raw.shipsOwned.length ? raw.shipsOwned : ['falcon'],
    tracks: { ...(raw.tracks ?? {}) },
    unlocks: Array.isArray(raw.unlocks) ? [...raw.unlocks] : [],
    bestByMode: (raw.bestByMode ?? {}) as Partial<Record<GameMode, number>>,
    daily: { ...d.daily, ...(raw.daily ?? {}) },
  };

  // прокачка каждого корпуса (новая схема)
  if (raw.shipUpgrades) {
    for (const id of SHIP_IDS) {
      save.shipUpgrades[id] = { ...emptyUpgrades(), ...(raw.shipUpgrades[id] ?? {}) };
    }
  } else if (raw.upgrades) {
    // v<5: общая прокачка переносится на стартовый корпус
    save.shipUpgrades.falcon = { ...emptyUpgrades(), ...raw.upgrades };
  }

  // старые пороги 50 000 / 100 000 больше не используются — чистим мусор
  save.checkpoints = save.checkpoints.filter((c) => c !== 50000 && c !== 100000);

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

  const today = todayKey();
  if (save.daily.date !== today) {
    save.daily = { date: today, best: 0, runs: 0, lastScore: 0 };
  }
  if (!save.shipsOwned.includes(save.ship)) save.ship = 'falcon';
  return save;
}

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultSave();
    const save = migrate(JSON.parse(raw) as LegacySave);
    // фиксируем новую версию, чтобы разовые миграции не повторялись
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
    // хранилище недоступно (приватный режим) — игра всё равно работает
  }
}
