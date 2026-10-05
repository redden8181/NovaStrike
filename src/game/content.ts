import type { AbilityId, EnemyKind, PowerupType, RankId, SaveData, ShipId, ShipUpgrades, TechId, UpgradeId } from './types';

// ── Ранги наград ─────────────────────────────────────────────────────────────
export interface RankDef {
  id: RankId;
  name: string;
  color: string;
}

export const RANKS: RankDef[] = [
  { id: 'bronze', name: 'БРОНЗА', color: '#c2703a' },
  { id: 'silver', name: 'СЕРЕБРО', color: '#cbd5e1' },
  { id: 'gold', name: 'ЗОЛОТО', color: '#fbbf24' },
  { id: 'platinum', name: 'ПЛАТИНА', color: '#5eead4' },
  { id: 'diamond', name: 'АЛМАЗ', color: '#38bdf8' },
  { id: 'master', name: 'МАСТЕР', color: '#a78bfa' },
  { id: 'legend', name: 'ЛЕГЕНДА', color: '#f472b6' },
  { id: 'void', name: 'БЕЗДНА', color: '#818cf8' },
];

export const rankAt = (i: number): RankDef => RANKS[Math.max(0, Math.min(RANKS.length - 1, i))];

// ── Трек очков: одна ячейка, которая растёт по рангам до 500 000 ─────────────
export interface MilestoneDef {
  score: number;
  rank: RankId;
  name: string;
  detail: string;
  unlock?: string;
  coins: number;
  /** можно ли стартовать забег с этой отметки */
  checkpoint: boolean;
  color: string;
}

export const MILESTONES: MilestoneDef[] = [
  { score: 1000, rank: 'bronze', name: 'БРОНЗА', detail: 'Точка старта 1 000', coins: 150, checkpoint: true, color: '#c2703a' },
  { score: 5000, rank: 'silver', name: 'СЕРЕБРО', detail: 'Точка старта 5 000', coins: 350, checkpoint: true, color: '#cbd5e1' },
  { score: 15000, rank: 'gold', name: 'ЗОЛОТО', detail: 'Точка старта 15 000', coins: 700, checkpoint: true, color: '#fbbf24' },
  { score: 30000, rank: 'platinum', name: 'ПЛАТИНА', detail: 'Точка старта 30 000', coins: 1400, checkpoint: true, color: '#5eead4' },
  {
    score: 60000,
    rank: 'diamond',
    name: 'АЛМАЗ',
    detail: 'Открыт режим «Бесконечный»',
    unlock: 'endless',
    coins: 2500,
    checkpoint: true,
    color: '#38bdf8',
  },
  {
    score: 120000,
    rank: 'master',
    name: 'МАСТЕР',
    detail: 'Открыт «Босс-руш»',
    unlock: 'bossrush',
    coins: 4000,
    checkpoint: true,
    color: '#a78bfa',
  },
  {
    score: 250000,
    rank: 'legend',
    name: 'ЛЕГЕНДА',
    detail: 'Открыт «Хардкор»',
    unlock: 'hardcore',
    coins: 7000,
    checkpoint: false,
    color: '#f472b6',
  },
  {
    score: 500000,
    rank: 'void',
    name: 'БЕЗДНА',
    detail: 'Открыт корабль VOID-X',
    unlock: 'ship:voidx',
    coins: 15000,
    checkpoint: false,
    color: '#818cf8',
  },
];

export const CHECKPOINTS = MILESTONES.filter((m) => m.checkpoint).map((m) => m.score);

// ── Треки наград — каждая ячейка растёт по рангам ────────────────────────────
export type TrackMetric = 'score' | 'kills' | 'coins' | 'bosses' | 'time' | 'runs' | 'synergy';

export interface TrackDef {
  id: string;
  name: string;
  sub: string;
  metric: TrackMetric;
  format: 'num' | 'time';
  /** пороги по возрастанию, по одному на ранг */
  steps: number[];
  /** награда монетами за каждую ступень */
  coins: number[];
}

export const TRACKS: TrackDef[] = [
  {
    id: 'score',
    name: 'РЕКОРД ОЧКОВ',
    sub: 'Лучший забег',
    metric: 'score',
    format: 'num',
    steps: MILESTONES.map((m) => m.score),
    coins: MILESTONES.map((m) => m.coins),
  },
  {
    id: 'kills',
    name: 'УНИЧТОЖЕНО',
    sub: 'Всего врагов за карьеру',
    metric: 'kills',
    format: 'num',
    steps: [100, 500, 1500, 4000, 10000, 25000, 60000, 150000],
    coins: [150, 300, 600, 1200, 2200, 4000, 7000, 14000],
  },
  {
    id: 'coins',
    name: 'ДОБЫЧА',
    sub: 'Всего собрано монет',
    metric: 'coins',
    format: 'num',
    steps: [500, 2000, 6000, 15000, 40000, 100000, 250000, 600000],
    coins: [150, 300, 600, 1200, 2200, 4000, 7000, 14000],
  },
  {
    id: 'bosses',
    name: 'ОХОТНИК НА ЛИНКОРЫ',
    sub: 'Сбито линейных кораблей',
    metric: 'bosses',
    format: 'num',
    steps: [1, 5, 15, 40, 90, 180, 350, 700],
    coins: [250, 500, 900, 1800, 3000, 5000, 9000, 18000],
  },
  {
    id: 'time',
    name: 'ВЫЖИВАНИЕ',
    sub: 'Лучшее время в одном забеге',
    metric: 'time',
    format: 'time',
    steps: [60, 150, 300, 600, 900, 1500, 2400, 3600],
    coins: [150, 300, 600, 1200, 2200, 4000, 7000, 14000],
  },
  {
    id: 'runs',
    name: 'НАЛЁТ',
    sub: 'Всего вылетов',
    metric: 'runs',
    format: 'num',
    steps: [5, 20, 50, 120, 300, 700, 1500, 3000],
    coins: [100, 250, 500, 1000, 1800, 3200, 6000, 12000],
  },
  {
    id: 'synergy',
    name: 'СИНЕРГЕТИК',
    sub: 'Срабатываний синергий',
    metric: 'synergy',
    format: 'num',
    steps: [1, 10, 30, 80, 200, 450, 1000, 2500],
    coins: [200, 350, 700, 1300, 2400, 4200, 7500, 15000],
  },
];

export function trackValue(def: TrackDef, save: SaveData): number {
  switch (def.metric) {
    case 'score':
      return save.best;
    case 'kills':
      return save.stats.kills;
    case 'coins':
      return save.stats.totalCoins;
    case 'bosses':
      return save.stats.bossKills;
    case 'time':
      return save.stats.bestTime;
    case 'runs':
      return save.stats.runs;
    case 'synergy':
      return save.stats.synergiesTriggered;
  }
}

/** Сколько ступеней трека фактически достигнуто сейчас. */
export function trackReached(def: TrackDef, value: number): number {
  let n = 0;
  for (const s of def.steps) if (value >= s) n++;
  return n;
}

// ── Постоянные улучшения (отдельные для каждого корабля) ─────────────────────
export interface UpgradeDef {
  id: UpgradeId;
  name: string;
  sub: string;
  max: number;
  base: number;
  growth: number;
}

export const UPGRADES: UpgradeDef[] = [
  { id: 'power', name: 'МОЩЬ ОРУДИЯ', sub: 'Урон снарядов', max: 6, base: 60, growth: 2.0 },
  { id: 'rate', name: 'ТЕМП ОГНЯ', sub: 'Выстрелов в секунду', max: 6, base: 60, growth: 2.05 },
  { id: 'streams', name: 'МУЛЬТИЗАЛП', sub: 'Параллельных снарядов', max: 3, base: 220, growth: 2.8 },
  { id: 'hull', name: 'БРОНЯ КОРПУСА', sub: '+1 к прочности', max: 6, base: 80, growth: 2.0 },
  { id: 'shield', name: 'ЭМИТТЕР ЩИТА', sub: 'Длительность щита', max: 5, base: 70, growth: 1.95 },
  { id: 'magnet', name: 'ТЯГОВОЕ ПОЛЕ', sub: 'Радиус сбора монет', max: 5, base: 50, growth: 1.9 },
  { id: 'tech', name: 'ТЕХНИКА', sub: 'Уникальная система корпуса', max: 5, base: 140, growth: 2.2 },
];

export const UPGRADE_MAP: Record<UpgradeId, UpgradeDef> = UPGRADES.reduce(
  (acc, u) => ((acc[u.id] = u), acc),
  {} as Record<UpgradeId, UpgradeDef>,
);

export function emptyUpgrades(): ShipUpgrades {
  return { power: 0, rate: 0, streams: 0, hull: 0, shield: 0, magnet: 0, tech: 0 };
}

export function upgradeCost(id: UpgradeId, level: number): number {
  const def = UPGRADE_MAP[id];
  if (level >= def.max) return Infinity;
  return Math.round((def.base * Math.pow(def.growth, level)) / 5) * 5;
}

/** Прокачка конкретного корпуса (у каждого своя). */
export function shipUpgradesOf(save: SaveData, ship: ShipId): ShipUpgrades {
  return { ...emptyUpgrades(), ...(save.shipUpgrades?.[ship] ?? {}) };
}

// ── Уникальные техники кораблей ──────────────────────────────────────────────
export interface TechDef {
  id: TechId;
  name: string;
  desc: string;
  color: string;
  /** базовый интервал срабатывания, сек (ускоряется с уровнем) */
  interval: number;
}

export const TECHS: Record<TechId, TechDef> = {
  missiles: {
    id: 'missiles',
    name: 'САМОНАВОДЯЩИЕСЯ РАКЕТЫ',
    desc: 'Залпы ракет сами находят ближайшую цель.',
    color: '#67e8f9',
    interval: 2.4,
  },
  lightning: {
    id: 'lightning',
    name: 'ЭМИ-МОЛНИЯ',
    desc: 'Разряд выжигает летящие в корабль снаряды и бьёт по врагам.',
    color: '#a78bfa',
    interval: 1.9,
  },
  bombs: {
    id: 'bombs',
    name: 'ОСКОЛОЧНЫЕ БОМБЫ',
    desc: 'Тяжёлая бомба детонирует и разлетается осколками.',
    color: '#34d399',
    interval: 3.2,
  },
  drones: {
    id: 'drones',
    name: 'БОЕВЫЕ ДРОНЫ',
    desc: 'Орбитальные дроны ведут собственный огонь.',
    color: '#f472b6',
    interval: 0.8,
  },
  singularity: {
    id: 'singularity',
    name: 'СИНГУЛЯРНОСТЬ',
    desc: 'Микро-воронка втягивает снаряды, добычу и рвёт врагов.',
    color: '#818cf8',
    interval: 6,
  },
};

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
  tech: TechId;
  accent: string;
  voidDrive?: boolean;
}

export const SHIPS: ShipDef[] = [
  {
    id: 'falcon',
    name: 'FALCON-7',
    tag: 'БАЛАНС',
    desc: 'Надёжный перехватчик. Ровные характеристики и ракетный модуль.',
    cost: 0,
    requires: 0,
    mods: { speed: 1, rate: 1, damage: 1, hull: 0, streams: 0 },
    ability: 'dash',
    tech: 'missiles',
    accent: '#22d3ee',
  },
  {
    id: 'comet',
    name: 'COMET',
    tag: 'СКОРОСТЬ',
    desc: 'Молниеносный и хрупкий. Шквал мелких пуль и ЭМИ-защита.',
    cost: 1500,
    requires: 0,
    mods: { speed: 1.7, rate: 1.45, damage: 0.62, hull: -1, streams: 0 },
    ability: 'afterburner',
    tech: 'lightning',
    accent: '#a78bfa',
  },
  {
    id: 'titan',
    name: 'TITAN-IX',
    tag: 'ТЯЖЕЛОВЕС',
    desc: 'Ходячая крепость: +4 корпуса, но разворачивается как баржа.',
    cost: 4000,
    requires: 5000,
    mods: { speed: 0.58, rate: 0.78, damage: 1.85, hull: 4, streams: 0 },
    ability: 'fortress',
    tech: 'bombs',
    accent: '#34d399',
  },
  {
    id: 'nova',
    name: 'NOVA-X',
    tag: 'АРТИЛЛЕРИЯ',
    desc: 'Чудовищный урон и лишний ствол ценой темпа огня.',
    cost: 9000,
    requires: 15000,
    mods: { speed: 0.92, rate: 0.62, damage: 2.45, hull: 0, streams: 1 },
    ability: 'novabeam',
    tech: 'drones',
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
    mods: { speed: 1.25, rate: 1.12, damage: 1.3, hull: -1, streams: 1 },
    ability: 'collapse',
    tech: 'singularity',
    accent: '#818cf8',
    voidDrive: true,
  },
];

export const SHIP_MAP: Record<ShipId, ShipDef> = SHIPS.reduce(
  (acc, s) => ((acc[s.id] = s), acc),
  {} as Record<ShipId, ShipDef>,
);

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
  /** мгновенный эффект без таймера */
  instant?: boolean;
}

export const POWERUPS: PowerupDef[] = [
  { id: 'rapid', name: 'СКОРОСТРЕЛ', color: '#ffd23f', duration: 8, weight: 3, minScore: 0 },
  { id: 'double', name: 'ДВОЙНОЙ ВЫСТРЕЛ', color: '#4ade80', duration: 12, weight: 3, minScore: 0 },
  { id: 'triple', name: 'ТРОЙНОЙ ВЫСТРЕЛ', color: '#38bdf8', duration: 10, weight: 2.4, minScore: 700 },
  { id: 'magnet', name: 'МАГНИТ', color: '#c084fc', duration: 12, weight: 2.2, minScore: 300 },
  { id: 'power', name: 'ПЕРЕГРУЗКА', color: '#f472b6', duration: 10, weight: 2, minScore: 500 },
  { id: 'shield', name: 'ЩИТ', color: '#22d3ee', duration: 7, weight: 2.4, minScore: 150 },
  { id: 'repair', name: 'РЕМОНТ КОРПУСА', color: '#4ade80', duration: 0, weight: 2.6, minScore: 0, instant: true },
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
