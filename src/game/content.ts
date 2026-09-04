import type { AbilityId, EnemyKind, PowerupType, ShipId, UpgradeId } from './types';

// ── Вехи (долгосрочная прогрессия) ───────────────────────────────────────────
// kind 'checkpoint' → точка старта для классических забегов
// kind 'unlock'     → навсегда открывает режим или корабль
export interface MilestoneDef {
  score: number;
  kind: 'checkpoint' | 'unlock';
  name: string;
  detail: string;
  unlock?: string;
  color: string;
}

export const MILESTONES: MilestoneDef[] = [
  { score: 1000, kind: 'checkpoint', name: 'ЧЕКПОИНТ 1000', detail: 'Открыта точка старта', color: '#4ade80' },
  { score: 5000, kind: 'checkpoint', name: 'ЧЕКПОИНТ 5000', detail: 'Открыта точка старта', color: '#4ade80' },
  { score: 15000, kind: 'checkpoint', name: 'ЧЕКПОИНТ 15000', detail: 'Открыта точка старта', color: '#4ade80' },
  { score: 30000, kind: 'checkpoint', name: 'ЧЕКПОИНТ 30000', detail: 'Открыта точка старта', color: '#4ade80' },
  { score: 50000, kind: 'unlock', name: 'РЕЖИМ «БЕСКОНЕЧНЫЙ»', detail: 'Чистая погоня за счётом', unlock: 'endless', color: '#a78bfa' },
  { score: 100000, kind: 'unlock', name: 'БОСС-РУШ', detail: 'Открыт марафон линейных кораблей', unlock: 'bossrush', color: '#f472b6' },
  { score: 250000, kind: 'unlock', name: 'РЕЖИМ «ХАРДКОР»', detail: 'Одна жизнь, двойной счёт', unlock: 'hardcore', color: '#ef4444' },
  { score: 500000, kind: 'unlock', name: 'VOID-X', detail: 'Секретный прототип корпуса', unlock: 'ship:voidx', color: '#818cf8' },
];

/** Счёт, с которого можно стартовать в классике. */
export const CHECKPOINTS = MILESTONES.filter((m) => m.kind === 'checkpoint').map((m) => m.score);

// ── Постоянные улучшения ─────────────────────────────────────────────────────
export interface UpgradeDef {
  id: UpgradeId;
  name: string;
  sub: string;
  max: number;
  base: number;
  growth: number;
}

export const UPGRADES: UpgradeDef[] = [
  { id: 'power', name: 'МОЩЬ ОРУДИЯ', sub: 'Урон снарядов', max: 5, base: 60, growth: 2.1 },
  { id: 'rate', name: 'ТЕМП ОГНЯ', sub: 'Выстрелов в секунду', max: 5, base: 60, growth: 2.15 },
  { id: 'streams', name: 'МУЛЬТИЗАЛП', sub: 'Параллельных снарядов', max: 2, base: 240, growth: 3.4 },
  { id: 'hull', name: 'БРОНЯ КОРПУСА', sub: '+1 к прочности', max: 5, base: 80, growth: 2.05 },
  { id: 'shield', name: 'ЭМИТТЕР ЩИТА', sub: 'Длительность щита', max: 4, base: 70, growth: 2.0 },
  { id: 'magnet', name: 'ТЯГОВОЕ ПОЛЕ', sub: 'Радиус сбора монет', max: 5, base: 50, growth: 1.9 },
];

export const UPGRADE_MAP: Record<UpgradeId, UpgradeDef> = UPGRADES.reduce(
  (acc, u) => ((acc[u.id] = u), acc),
  {} as Record<UpgradeId, UpgradeDef>,
);

export function upgradeCost(id: UpgradeId, level: number): number {
  const def = UPGRADE_MAP[id];
  if (level >= def.max) return Infinity;
  return Math.round((def.base * Math.pow(def.growth, level)) / 5) * 5;
}

// ── Корабли ──────────────────────────────────────────────────────────────────
export interface ShipMods {
  speed: number;
  rate: number;
  damage: number;
  hull: number;
  streams: number;
}

export interface ShipDef {
  id: ShipId;
  name: string;
  tag: string;
  desc: string;
  cost: number;
  requires: number;
  requiresUnlock?: string;
  mods: ShipMods;
  ability: AbilityId;
  accent: string;
  voidDrive?: boolean;
}

export const SHIPS: ShipDef[] = [
  {
    id: 'falcon',
    name: 'FALCON-7',
    tag: 'БАЛАНС',
    desc: 'Надёжный перехватчик. Без слабостей и без сюрпризов.',
    cost: 0,
    requires: 0,
    mods: { speed: 1, rate: 1, damage: 1, hull: 0, streams: 0 },
    ability: 'dash',
    accent: '#22d3ee',
  },
  {
    id: 'comet',
    name: 'COMET',
    tag: 'СКОРОСТЬ',
    desc: 'Лёгкая рама. Обгонит бурю, но чувствует каждый удар.',
    cost: 1500,
    requires: 0,
    mods: { speed: 1.3, rate: 1.15, damage: 0.95, hull: -1, streams: 0 },
    ability: 'afterburner',
    accent: '#a78bfa',
  },
  {
    id: 'titan',
    name: 'TITAN-IX',
    tag: 'ТЯЖЕЛОВЕС',
    desc: 'Осадный фрегат. Медлителен, бронирован, бьёт как падающая луна.',
    cost: 4000,
    requires: 5000,
    mods: { speed: 0.8, rate: 0.95, damage: 1.3, hull: 3, streams: 0 },
    ability: 'fortress',
    accent: '#34d399',
  },
  {
    id: 'nova',
    name: 'NOVA-X',
    tag: 'АРТИЛЛЕРИЯ',
    desc: 'Лучевая пушка-прототип. Тройной ствол, чудовищная мощь.',
    cost: 9000,
    requires: 15000,
    mods: { speed: 0.95, rate: 0.85, damage: 1.65, hull: 0, streams: 1 },
    ability: 'novabeam',
    accent: '#f472b6',
  },
  {
    id: 'voidx',
    name: 'VOID-X',
    tag: 'СЕКРЕТ',
    desc: 'ДВИГАТЕЛЬ БЕЗДНЫ — урон растёт, пока летишь нетронутым.',
    cost: 0,
    requires: 500000,
    requiresUnlock: 'ship:voidx',
    mods: { speed: 1.12, rate: 1.05, damage: 1.15, hull: -1, streams: 1 },
    ability: 'collapse',
    accent: '#818cf8',
    voidDrive: true,
  },
];

export const SHIP_MAP: Record<ShipId, ShipDef> = SHIPS.reduce(
  (acc, s) => ((acc[s.id] = s), acc),
  {} as Record<ShipId, ShipDef>,
);

/** Уровни двигателя Бездны: убийства без попаданий → бонус урона. */
export const VOID_DRIVE_TIERS: { kills: number; bonus: number }[] = [
  { kills: 10, bonus: 0.05 },
  { kills: 25, bonus: 0.1 },
  { kills: 50, bonus: 0.2 },
];

export function voidDriveBonus(streak: number): number {
  let bonus = 0;
  for (const t of VOID_DRIVE_TIERS) if (streak >= t.kills) bonus = t.bonus;
  return bonus;
}

// ── Временные усилители ──────────────────────────────────────────────────────
export interface PowerupDef {
  id: PowerupType;
  name: string;
  color: string;
  duration: number;
  weight: number;
  minScore: number;
}

export const POWERUPS: PowerupDef[] = [
  { id: 'rapid', name: 'СКОРОСТРЕЛ', color: '#ffd23f', duration: 8, weight: 3, minScore: 0 },
  { id: 'double', name: 'ДВОЙНОЙ ВЫСТРЕЛ', color: '#4ade80', duration: 12, weight: 3, minScore: 0 },
  { id: 'triple', name: 'ТРОЙНОЙ ВЫСТРЕЛ', color: '#38bdf8', duration: 10, weight: 2.4, minScore: 700 },
  { id: 'magnet', name: 'МАГНИТ', color: '#c084fc', duration: 12, weight: 2.2, minScore: 300 },
  { id: 'power', name: 'ПЕРЕГРУЗКА', color: '#f472b6', duration: 10, weight: 2, minScore: 500 },
  { id: 'shield', name: 'ЩИТ', color: '#22d3ee', duration: 7, weight: 2.2, minScore: 150 },
];

export const POWERUP_MAP: Record<PowerupType, PowerupDef> = POWERUPS.reduce(
  (acc, p) => ((acc[p.id] = p), acc),
  {} as Record<PowerupType, PowerupDef>,
);

// ── Враги ────────────────────────────────────────────────────────────────────
export interface EnemyDef {
  kind: EnemyKind;
  hp: number;
  r: number;
  speed: number;
  score: number;
  coins: [number, number];
  powerChance: number;
}

export const ENEMIES: Record<EnemyKind, EnemyDef> = {
  scout: { kind: 'scout', hp: 3, r: 14, speed: 96, score: 50, coins: [0, 2], powerChance: 0.05 },
  weaver: { kind: 'weaver', hp: 5, r: 15, speed: 74, score: 80, coins: [1, 2], powerChance: 0.06 },
  gunner: { kind: 'gunner', hp: 9, r: 17, speed: 54, score: 120, coins: [1, 3], powerChance: 0.08 },
  diver: { kind: 'diver', hp: 4, r: 13, speed: 60, score: 100, coins: [1, 2], powerChance: 0.06 },
  tank: { kind: 'tank', hp: 32, r: 27, speed: 30, score: 260, coins: [3, 6], powerChance: 0.16 },
};

// ── Медали ───────────────────────────────────────────────────────────────────
export interface AchievementDef {
  id: string;
  name: string;
  desc: string;
  reward: number;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'kills100', name: 'ИСТРЕБИТЕЛЬ', desc: 'Уничтожить 100 врагов', reward: 150 },
  { id: 'coins500', name: 'КОЛЛЕКЦИОНЕР', desc: 'Собрать 500 монет суммарно', reward: 200 },
  { id: 'survive300', name: 'В БЕЗДНЕ', desc: 'Продержаться 5 минут за один забег', reward: 300 },
  { id: 'score10k', name: 'АС', desc: 'Набрать 10 000 за один забег', reward: 250 },
  { id: 'boss1', name: 'УБИЙЦА ГИГАНТОВ', desc: 'Уничтожить линейный корабль', reward: 400 },
  { id: 'synergy', name: 'ЦЕПНАЯ РЕАКЦИЯ', desc: 'Активировать синергию усилителей', reward: 200 },
  { id: 'bossrush5', name: 'МАРАФОН', desc: 'Сбить 5 линейных кораблей подряд', reward: 600 },
  { id: 'hardcore10k', name: 'БЕЗ ПРАВА НА ОШИБКУ', desc: 'Набрать 10 000 в хардкоре', reward: 700 },
  { id: 'daily', name: 'РУТИНА', desc: 'Пройти ежедневное испытание', reward: 250 },
  { id: 'voidmax', name: 'СИЛА БЕЗДНЫ', desc: 'Довести двигатель Бездны до максимума', reward: 800 },
];

export const ACHIEVEMENT_MAP = ACHIEVEMENTS.reduce(
  (acc, a) => ((acc[a.id] = a), acc),
  {} as Record<string, AchievementDef>,
);
