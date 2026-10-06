import type { GameMode, SaveData, ShipId, ShipUpgrades } from './types';
import { todayKey } from './dailyRun';
import { TEST_MODE, emptyUpgrades } from './content';

const KEY = 'nova_strike_save_v1'; // ключ стабилен — старые сейвы продолжают грузиться
const BACKUP_KEY = 'nova_strike_save_backup_v1';
export const SAVE_VERSION = 9;

const SHIP_IDS: ShipId[] = ['falcon', 'comet', 'titan', 'nova', 'voidx'];

/** В тестовом режиме открываем все режимы, корабли и вехи. */
function applyTestMode(save: SaveData): SaveData {
  if (!TEST_MODE) return save;
  const milestones = [1000, 5000, 15000, 30000, 60000, 120000, 250000, 500000];
  return {
    ...save,
    coins: Math.max(save.coins, 999999),
    checkpoints: [...new Set([...save.checkpoints, ...milestones])].sort((a, b) => a - b),
    unlocks: [...new Set([...save.unlocks, 'endless', 'bossrush', 'hardcore', 'ship:voidx'])],
    shipsOwned: [...new Set([...save.shipsOwned, ...SHIP_IDS])],
  };
}

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
    shipStars: {},
    fusions: [],
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
  { score: 100000, id: 'ship:voidx' },
  { score: 200000, id: 'bossrush' },
  { score: 400000, id: 'hardcore' },
];

/** Старое сохранение могло держать одну общую прокачку в поле `upgrades`. */
interface LegacySave extends Partial<SaveData> {
  upgrades?: Partial<ShipUpgrades>;
}

function migrate(raw: LegacySave): SaveData {
  const d = defaultSave();

  const save: SaveData = {
    ...d,
    ...raw,
    v: SAVE_VERSION,
    // Сначала сохраняем ВСЕ ключи (включая гибриды), ниже лишь дополняем базовые.
    shipUpgrades: { ...(raw.shipUpgrades ?? {}) },
    shipStars: { ...(raw.shipStars ?? {}) },
    fusions: Array.isArray(raw.fusions) ? [...raw.fusions] : [],
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

  // Миграции только добавляют заслуженные разблокировки — ничего не удаляют.
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
    if (!raw) return applyTestMode(defaultSave());
    const parsed = JSON.parse(raw) as LegacySave;
    const sourceVersion = typeof parsed.v === 'number' ? parsed.v : 1;
    // Перед любой сменой схемы сохраняем исходный JSON как страховку.
    if (sourceVersion < SAVE_VERSION) {
      localStorage.setItem(BACKUP_KEY, raw);
    }
    const save = applyTestMode(migrate(parsed));
    // фиксируем новую версию, чтобы разовые миграции не повторялись
    persist(save);
    return save;
  } catch {
    return applyTestMode(defaultSave());
  }
}

export function persist(save: SaveData): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(save));
  } catch {
    // хранилище недоступно (приватный режим) — игра всё равно работает
  }
}
