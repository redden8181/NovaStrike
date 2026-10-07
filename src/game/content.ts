import type {
  AbilityId,
  BaseShipId,
  EnemyKind,
  FusedShipId,
  PowerupType,
  RankId,
  SaveData,
  ShipId,
  ShipUpgrades,
  TechId,
  UpgradeId,
} from './types';

import { ABILITIES, fuseAbilities, type AbilityDef } from './abilities';

/** Версия сборки — показывается в меню. */
export const BUILD_VERSION = '2.0.1';

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
    score: 100000,
    rank: 'master',
    name: 'МАСТЕР',
    detail: 'Открыт корабль VOID-X',
    unlock: 'ship:voidx',
    coins: 4000,
    checkpoint: true,
    color: '#a78bfa',
  },
  {
    score: 200000,
    rank: 'legend',
    name: 'ЛЕГЕНДА',
    detail: 'Открыт «Босс-руш»',
    unlock: 'bossrush',
    coins: 7000,
    checkpoint: false,
    color: '#f472b6',
  },
  {
    score: 400000,
    rank: 'void',
    name: 'БЕЗДНА',
    detail: 'Открыт «Хардкор»',
    unlock: 'hardcore',
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
  group: 'weapon' | 'hull' | 'turret';
}

/** Группа в ангаре — для вкладок интерфейса. */
export type UpgradeGroup = 'weapon' | 'hull' | 'turret';

export const UPGRADES: UpgradeDef[] = [
  { id: 'power', name: 'МОЩЬ ОРУДИЯ', sub: '+18% урона за уровень', max: 6, base: 60, growth: 2.0, group: 'weapon' },
  { id: 'rate', name: 'ТЕМП ОГНЯ', sub: '+22% скорострельности', max: 6, base: 60, growth: 2.05, group: 'weapon' },
  { id: 'streams', name: 'МУЛЬТИЗАЛП', sub: '+1 ствол на носу', max: 3, base: 220, growth: 2.8, group: 'weapon' },
  { id: 'tech', name: 'ТЕХНИКА', sub: 'Уникальная система корпуса', max: 5, base: 140, growth: 2.2, group: 'weapon' },
  { id: 'hull', name: 'ПРОЧНОСТЬ', sub: '+25 к запасу HP', max: 8, base: 70, growth: 1.85, group: 'hull' },
  { id: 'armor', name: 'БРОНЕПЛАСТИНЫ', sub: '+4% снижения урона', max: 6, base: 90, growth: 2.0, group: 'hull' },
  { id: 'shield', name: 'ЭМИТТЕР ЩИТА', sub: 'Длительность щита', max: 5, base: 70, growth: 1.95, group: 'hull' },
  { id: 'magnet', name: 'ТЯГОВОЕ ПОЛЕ', sub: 'Радиус сбора монет', max: 5, base: 50, growth: 1.9, group: 'hull' },
  { id: 'turretL', name: 'ЛЕВАЯ ТУРЕЛЬ', sub: 'Автопушка бьёт назад', max: 1, base: 900, growth: 1, group: 'turret' },
  { id: 'turretR', name: 'ПРАВАЯ ТУРЕЛЬ', sub: 'Автопушка бьёт назад', max: 1, base: 900, growth: 1, group: 'turret' },
  { id: 'turretPower', name: 'КАЛИБР ТУРЕЛЕЙ', sub: '+20% урона турелей', max: 5, base: 180, growth: 2.0, group: 'turret' },
  { id: 'turretRate', name: 'ПРИВОД ТУРЕЛЕЙ', sub: '+20% скорострельности', max: 5, base: 180, growth: 2.0, group: 'turret' },
  { id: 'turretStreams', name: 'ЗАЛП ТУРЕЛЕЙ', sub: '+1 снаряд у каждой', max: 2, base: 500, growth: 2.6, group: 'turret' },
];

export const UPGRADE_MAP: Record<UpgradeId, UpgradeDef> = UPGRADES.reduce(
  (acc, u) => ((acc[u.id] = u), acc),
  {} as Record<UpgradeId, UpgradeDef>,
);

export function emptyUpgrades(): ShipUpgrades {
  return {
    power: 0,
    rate: 0,
    streams: 0,
    hull: 0,
    armor: 0,
    shield: 0,
    magnet: 0,
    tech: 0,
    turretL: 0,
    turretR: 0,
    turretPower: 0,
    turretRate: 0,
    turretStreams: 0,
  };
}

// ── Модель урона ─────────────────────────────────────────────────────────────
export const DAMAGE = {
  /** попадание вражеского снаряда */
  bullet: 10,
  /** таран врага */
  crash: 25,
  /** таран линейного корабля */
  bossCrash: 35,
  /** лазерное жало за секунду */
  laserPerSec: 45,
  /** максимальное суммарное снижение урона, % */
  armorCap: 70,
} as const;

/** Платная способность: откат уровня угрозы. */
export const ROLLBACK = {
  get cost() {
    return TEST_MODE ? 0 : 650;
  },
  cooldown: 60,
} as const;

/**
 * ТЕСТОВЫЙ РЕЖИМ — всё открыто и бесплатно.
 * Поставь true, чтобы снова включить песочницу.
 */
export const TEST_MODE = false;

export function upgradeCost(id: UpgradeId, level: number): number {
  const def = UPGRADE_MAP[id];
  if (level >= def.max) return Infinity;
  if (TEST_MODE) return 0;
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
  /** базовый запас прочности в HP */
  hp: number;
  /** базовое снижение урона, % */
  armor: number;
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
  /** индивидуальные лимиты прокачки корпуса (сколько пунктов можно вложить) */
  caps: Partial<Record<UpgradeId, number>>;
  /** гибрид: из каких корпусов собран */
  fusedFrom?: [BaseShipId, BaseShipId];
  /** гибрид: объединённая способность обоих родителей */
  fusedAbility?: AbilityDef;
}

// ── Ранги корпуса (звёзды) ───────────────────────────────────────────────────
export interface StarRank {
  name: string;
  color: string;
  /** +N к каждому лимиту прокачки */
  capBonus: number;
  /** множитель всех характеристик */
  statMul: number;
  cost: number;
}

export const STAR_RANKS: StarRank[] = [
  { name: 'СТАНДАРТ', color: '#94a3b8', capBonus: 0, statMul: 1, cost: 0 },
  { name: '★', color: '#cbd5e1', capBonus: 1, statMul: 1.06, cost: 2500 },
  { name: '★★', color: '#fbbf24', capBonus: 2, statMul: 1.13, cost: 6000 },
  { name: '★★★', color: '#fb923c', capBonus: 3, statMul: 1.21, cost: 14000 },
  { name: 'АЛМАЗ', color: '#38bdf8', capBonus: 5, statMul: 1.32, cost: 32000 },
  { name: 'ЛЕГЕНДА', color: '#f472b6', capBonus: 7, statMul: 1.45, cost: 70000 },
];

export const MAX_STAR = STAR_RANKS.length - 1;

export function starOf(save: SaveData, id: ShipId): number {
  return Math.min(MAX_STAR, save.shipStars?.[id] ?? 0);
}

export function starRank(star: number): StarRank {
  return STAR_RANKS[Math.max(0, Math.min(MAX_STAR, star))];
}

export function starUpCost(star: number): number {
  if (TEST_MODE) return 0;
  return STAR_RANKS[Math.min(MAX_STAR, star + 1)]?.cost ?? Infinity;
}

export const SHIPS: ShipDef[] = [
  {
    id: 'falcon',
    name: 'FALCON-7',
    tag: 'БАЛАНС',
    desc: 'Надёжный перехватчик: 100 HP, ровные характеристики, ракетный модуль.',
    cost: 0,
    requires: 0,
    mods: { speed: 1, rate: 1, damage: 1, hp: 100, armor: 0, streams: 0 },
    ability: 'dash',
    tech: 'missiles',
    accent: '#22d3ee',
    // ровный универсал — по 3 пункта почти везде
    caps: { power: 3, rate: 3, streams: 2, hull: 3, armor: 3, shield: 3, magnet: 3, tech: 3 },
  },
  {
    id: 'comet',
    name: 'COMET',
    tag: 'СКОРОСТЬ',
    desc: 'Молниеносный и хрупкий: всего 70 HP, зато шквал пуль и ЭМИ-защита.',
    cost: 1500,
    requires: 0,
    mods: { speed: 1.7, rate: 1.45, damage: 0.62, hp: 70, armor: 0, streams: 0 },
    ability: 'afterburner',
    tech: 'lightning',
    accent: '#a78bfa',
    // гонщик: много темпа и магнита, мало брони
    caps: { power: 2, rate: 6, streams: 2, hull: 2, armor: 1, shield: 4, magnet: 5, tech: 4 },
  },
  {
    id: 'titan',
    name: 'TITAN-IX',
    tag: 'ТЯЖЕЛОВЕС',
    desc: 'Ходячая крепость: 220 HP и 30% брони, но разворот как у баржи.',
    cost: 4000,
    requires: 5000,
    mods: { speed: 0.58, rate: 0.78, damage: 1.85, hp: 220, armor: 30, streams: 0 },
    ability: 'fortress',
    tech: 'bombs',
    accent: '#34d399',
    // танк: броня и прочность качаются глубоко
    caps: { power: 4, rate: 2, streams: 2, hull: 6, armor: 6, shield: 5, magnet: 2, tech: 4 },
  },
  {
    id: 'nova',
    name: 'NOVA-X',
    tag: 'АРТИЛЛЕРИЯ',
    desc: 'Чудовищный урон и лишний ствол ценой темпа огня. 120 HP, 10% брони.',
    cost: 9000,
    requires: 15000,
    mods: { speed: 0.92, rate: 0.62, damage: 2.45, hp: 120, armor: 10, streams: 1 },
    ability: 'novabeam',
    tech: 'drones',
    accent: '#f472b6',
    // артиллерия: оружие прокачивается максимально
    caps: { power: 6, rate: 2, streams: 4, hull: 3, armor: 3, shield: 3, magnet: 2, tech: 5 },
  },
  {
    id: 'voidx',
    name: 'VOID-X',
    tag: 'СЕКРЕТ',
    desc: 'ДВИГАТЕЛЬ БЕЗДНЫ — урон растёт, пока летишь нетронутым.',
    cost: 0,
    requires: 100000,
    requiresUnlock: 'ship:voidx',
    mods: { speed: 1.25, rate: 1.12, damage: 1.3, hp: 95, armor: 15, streams: 1 },
    ability: 'collapse',
    tech: 'singularity',
    accent: '#818cf8',
    voidDrive: true,
    // прототип: ровно сильный во всём
    caps: { power: 4, rate: 4, streams: 3, hull: 4, armor: 4, shield: 4, magnet: 4, tech: 5 },
  },
];

export const SHIP_MAP: Record<string, ShipDef> = SHIPS.reduce(
  (acc, s) => ((acc[s.id] = s), acc),
  {} as Record<string, ShipDef>,
);

// ── Слияние корпусов ─────────────────────────────────────────────────────────
export const FUSION_COST = 12000;

export function fusionId(a: BaseShipId, b: BaseShipId): FusedShipId {
  const [x, y] = [a, b].sort();
  return `fused:${x}+${y}`;
}

/** Короткое имя без индекса модели: FALCON-7 → FALCON */
const shortName = (n: string) => n.split('-')[0];

/**
 * Характеристики корпуса, прокачанного до предела своих лимитов.
 * Именно они складываются при слиянии — гибрид стартует не слабее,
 * чем два полностью прокачанных родителя вместе взятых.
 */
function maxedStats(def: ShipDef): ShipMods {
  const cap = (id: UpgradeId) => def.caps[id] ?? UPGRADE_MAP[id].max;
  return {
    damage: def.mods.damage * (1 + 0.18 * cap('power')),
    rate: def.mods.rate * (1 + 0.22 * cap('rate')),
    speed: def.mods.speed,
    hp: def.mods.hp + 25 * cap('hull'),
    armor: def.mods.armor + 4 * cap('armor'),
    streams: def.mods.streams + cap('streams'),
  };
}

/** Собирает определение гибрида из двух базовых корпусов. */
export function buildFusion(a: BaseShipId, b: BaseShipId): ShipDef {
  const A = SHIP_MAP[a];
  const B = SHIP_MAP[b];
  const ma = maxedStats(A);
  const mb = maxedStats(B);

  const caps: Partial<Record<UpgradeId, number>> = {};
  for (const u of UPGRADES) {
    const ca = A.caps[u.id] ?? 0;
    const cb = B.caps[u.id] ?? 0;
    // гибрид наследует лучший лимит каждой ветки и получает +1 сверху
    caps[u.id] = Math.min(u.max, Math.max(ca, cb) + 1);
  }

  const ability = fuseAbilities(A.ability, B.ability);
  return {
    id: fusionId(a, b),
    name: `${shortName(A.name)}·${shortName(B.name)}`,
    tag: 'ГИБРИД',
    desc: `Сплав ${A.name} и ${B.name}. Мощь обоих корпусов и объединённая способность.`,
    cost: 0,
    requires: 0,
    // сумма предельных характеристик обоих родителей
    mods: {
      speed: Math.max(ma.speed, mb.speed) * 1.1,
      rate: ma.rate + mb.rate,
      damage: ma.damage + mb.damage,
      hp: Math.round(ma.hp + mb.hp),
      armor: Math.min(DAMAGE.armorCap, Math.round(ma.armor + mb.armor)),
      streams: Math.max(1, Math.round((ma.streams + mb.streams) / 2)),
    },
    ability: A.ability,
    fusedAbility: ability,
    tech: B.tech,
    accent: B.accent,
    voidDrive: A.voidDrive || B.voidDrive,
    caps,
    fusedFrom: [a, b],
  };
}

/** Определение любого корабля, включая гибриды из сохранения. */
export function resolveShip(save: SaveData, id: ShipId): ShipDef {
  const base = SHIP_MAP[id];
  if (base) return base;
  const rec = save.fusions?.find((f) => f.id === id);
  if (rec) return buildFusion(rec.a, rec.b);
  return SHIP_MAP.falcon;
}

/** Все доступные игроку корпуса: базовые + созданные гибриды. */
export function allShips(save: SaveData): ShipDef[] {
  const fused = (save.fusions ?? []).map((f) => buildFusion(f.a, f.b));
  return [...SHIPS, ...fused];
}

/** Лимит прокачки конкретной ветки с учётом звёзд. */
export function capOf(def: ShipDef, id: UpgradeId, star: number): number {
  const global = UPGRADE_MAP[id].max;
  const base = def.caps[id] ?? global;
  if (id === 'turretL' || id === 'turretR') return global;
  return Math.min(global, base + starRank(star).capBonus);
}

/** Корпус прокачан полностью — условие для слияния. */
/** Турели — необязательный модуль, они не учитываются в условии полной прокачки. */
export function isFullyUpgraded(save: SaveData, id: ShipId): boolean {
  const def = resolveShip(save, id);
  const star = starOf(save, id);
  const lv = shipUpgradesOf(save, id);
  for (const u of UPGRADES) {
    if (u.group === 'turret') continue;
    if (lv[u.id] < capOf(def, u.id, star)) return false;
  }
  return true;
}

/** Способность корпуса с учётом слияния. */
export function abilityOf(def: ShipDef): AbilityDef {
  return def.fusedAbility ?? ABILITIES[def.ability];
}

/** Полностью прокачанный набор улучшений корпуса — эталон для ежедневного. */
export function maxUpgradesFor(def: ShipDef, star: number): ShipUpgrades {
  const out = emptyUpgrades();
  for (const u of UPGRADES) {
    out[u.id] = u.group === 'turret' ? u.max : capOf(def, u.id, star);
  }
  return out;
}

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

// ── История сборок (экран «i» в меню) ────────────────────────────────────────
export interface ChangelogEntry {
  version: string;
  title: string;
  items: string[];
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '2.0.1',
    title: 'ЧЕСТНОЕ ЕЖЕДНЕВНОЕ',
    items: [
      'Ежедневное событие больше не начисляет вехи, медали, ранги треков и общий рекорд',
      'Из события в профиль идут только монеты — не больше 2 000 за вылет',
      'Враги в событии вдвое крепче и бьют вдвое больнее: топовый корабль надо отработать',
      'Элита появляется с первых секунд события',
    ],
  },
  {
    version: '2.0.0',
    title: 'ПОЗДНЯЯ ИГРА',
    items: [
      'Урон врагов растёт вместе с уровнем угрозы — до ×6.5 на предельных этапах',
      'Потолок уровня поднят с 20 до 60: сложность больше не упирается в плато',
      'Элитные противники с золотым кольцом: втрое крепче, быстрее и дороже',
      'На поздних уровнях мелочь вытесняется стрелками, камикадзе и танками',
      'До 38 врагов и 160 снарядов на экране, волны по 5 целей',
      'Линкоры масштабируются вместе с врагами и приходят чаще',
    ],
  },
  {
    version: '1.9.0',
    title: 'СОБЫТИЯ НЕДЕЛИ',
    items: [
      'Все режимы открыты сразу — пробуй любой',
      'Ежедневное событие закреплено за днём недели: семь разных испытаний в ротации',
      'На событие выдаётся эталонный гибрид с максимальной прокачкой — одинаковый для всех',
      'Одна попытка в сутки: результат фиксируется с первого захода',
      'Добыча за ежедневный вылет ограничена 2 000 монет',
    ],
  },
  {
    version: '1.8.0',
    title: 'СИЛЬНЫЕ ГИБРИДЫ',
    items: [
      'Гибрид наследует сумму предельных характеристик обоих родителей — слияние всегда выгодно',
      'Способности объединяются в одну усиленную: эффекты обоих корпусов срабатывают разом, откат короче',
      'После слияния появляется экран с характеристиками нового корабля',
      'Турели больше не нужны для повышения ранга — достаточно веток «Оружие» и «Корпус»',
    ],
  },
  {
    version: '1.7.0',
    title: 'ЗВЁЗДЫ И СЛИЯНИЕ',
    items: [
      'Ранги корпуса: ★ → ★★ → ★★★ → АЛМАЗ → ЛЕГЕНДА. Каждый ранг поднимает лимиты прокачки и усиливает характеристики',
      'Слияние: два полностью прокачанных корпуса соединяются в гибрид с новым обликом, способностью и техникой',
      'Гибрид можно разобрать обратно и собрать другую пару',
      'У каждого корабля свои лимиты прокачки: у тяжёлого глубже броня, у артиллерии — оружие',
      'Снаряды турелей теперь самонаводящиеся',
      'VOID-X открывается на 100 000 очков',
    ],
  },
  {
    version: '1.6.0',
    title: 'ТУРЕЛИ И УРОН',
    items: [
      'Боковые турели с вращающимися стволами, покупаются раздельно',
      'Панель «Боевая мощь» в ангаре: урон снаряда, залпа и DPS',
      'У каждого улучшения показан точный прирост',
    ],
  },
  {
    version: '1.5.0',
    title: 'МОДЕЛЬ УРОНА',
    items: [
      'Жизни заменены на числовое HP: 70–220 в зависимости от корпуса',
      'Броня снижает урон в процентах, у TITAN-IX — 30%',
      'Платный откат уровня угрозы',
      'Длительность всех способностей увеличена',
    ],
  },
  {
    version: '1.4.0',
    title: 'РАНГОВЫЕ НАГРАДЫ',
    items: [
      'Награды собраны в ранговые ячейки: бронза → бездна',
      'Потолок врагов и снарядов на каждом уровне сложности',
      'Уникальная техника у каждого корпуса: ракеты, молния, бомбы, дроны, сингулярность',
      'Прокачка привязана к конкретному кораблю',
    ],
  },
  {
    version: '1.3.0',
    title: 'РЕЖИМЫ И БОССЫ',
    items: [
      'Режимы: Бесконечный, Босс-руш, Хардкор, Ежедневное испытание',
      'Четыре линейных корабля с тремя фазами боя',
      'Синергии усилителей и активные способности кораблей',
    ],
  },
];
