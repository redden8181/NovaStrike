import type { EnemyKind, PowerupType, ShipId, UpgradeId } from './types';

// ── Checkpoints (unlocked forever once a run passes them) ────────────────────
export const CHECKPOINTS = [1000, 5000, 15000, 30000];

// ── Permanent upgrades ───────────────────────────────────────────────────────
export interface UpgradeDef {
  id: UpgradeId;
  name: string;
  sub: string;
  max: number;
  base: number;
  growth: number;
}

export const UPGRADES: UpgradeDef[] = [
  { id: 'power', name: 'WEAPON POWER', sub: 'Bullet damage', max: 5, base: 60, growth: 2.1 },
  { id: 'rate', name: 'FIRE RATE', sub: 'Shots per second', max: 5, base: 60, growth: 2.15 },
  { id: 'streams', name: 'MULTISHOT', sub: 'Parallel projectiles', max: 2, base: 240, growth: 3.4 },
  { id: 'hull', name: 'HULL PLATING', sub: '+1 max integrity', max: 5, base: 80, growth: 2.05 },
  { id: 'shield', name: 'SHIELD ARRAY', sub: 'Longer shield time', max: 4, base: 70, growth: 2.0 },
  { id: 'magnet', name: 'TRACTOR FIELD', sub: 'Coin pickup radius', max: 5, base: 50, growth: 1.9 },
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

// ── Ships ────────────────────────────────────────────────────────────────────
export interface ShipMods {
  speed: number; // follow speed multiplier
  rate: number; // fire rate multiplier
  damage: number; // damage multiplier
  hull: number; // flat max HP change
  streams: number; // extra base projectile streams
}

export interface ShipDef {
  id: ShipId;
  name: string;
  tag: string;
  desc: string;
  cost: number;
  requires: number; // checkpoint score required to unlock purchase (0 = none)
  mods: ShipMods;
  accent: string;
}

export const SHIPS: ShipDef[] = [
  {
    id: 'falcon',
    name: 'FALCON-7',
    tag: 'BALANCED',
    desc: 'Trusted interceptor. No vices, no surprises.',
    cost: 0,
    requires: 0,
    mods: { speed: 1, rate: 1, damage: 1, hull: 0, streams: 0 },
    accent: '#22d3ee',
  },
  {
    id: 'comet',
    name: 'COMET',
    tag: 'FAST',
    desc: 'Razor-light frame. Outrun the storm, feel every hit.',
    cost: 1500,
    requires: 0,
    mods: { speed: 1.3, rate: 1.15, damage: 0.95, hull: -1, streams: 0 },
    accent: '#a78bfa',
  },
  {
    id: 'titan',
    name: 'TITAN-IX',
    tag: 'HEAVY',
    desc: 'Siege frigate. Slow, armored, hits like a falling moon.',
    cost: 4000,
    requires: 5000,
    mods: { speed: 0.8, rate: 0.95, damage: 1.3, hull: 3, streams: 0 },
    accent: '#34d399',
  },
  {
    id: 'nova',
    name: 'NOVA-X',
    tag: 'ARTILLERY',
    desc: 'Prototype lance cannon. Triple bore, devastating yield.',
    cost: 9000,
    requires: 15000,
    mods: { speed: 0.95, rate: 0.85, damage: 1.65, hull: 0, streams: 1 },
    accent: '#f472b6',
  },
];

export const SHIP_MAP: Record<ShipId, ShipDef> = SHIPS.reduce(
  (acc, s) => ((acc[s.id] = s), acc),
  {} as Record<ShipId, ShipDef>,
);

// ── Temporary power-ups ──────────────────────────────────────────────────────
export interface PowerupDef {
  id: PowerupType;
  name: string;
  color: string;
  duration: number; // seconds (shield is adjusted by upgrade)
  weight: number;
  minScore: number; // only appears after this score
}

export const POWERUPS: PowerupDef[] = [
  { id: 'rapid', name: 'RAPID FIRE', color: '#ffd23f', duration: 8, weight: 3, minScore: 0 },
  { id: 'double', name: 'DOUBLE SHOT', color: '#4ade80', duration: 12, weight: 3, minScore: 0 },
  { id: 'triple', name: 'TRIPLE SHOT', color: '#38bdf8', duration: 10, weight: 2.4, minScore: 700 },
  { id: 'magnet', name: 'MAGNET', color: '#c084fc', duration: 12, weight: 2.2, minScore: 300 },
  { id: 'power', name: 'OVERDRIVE', color: '#f472b6', duration: 10, weight: 2, minScore: 500 },
  { id: 'shield', name: 'SHIELD', color: '#22d3ee', duration: 7, weight: 2.2, minScore: 150 },
];

// ── Enemies ──────────────────────────────────────────────────────────────────
export interface EnemyDef {
  kind: EnemyKind;
  hp: number;
  r: number;
  speed: number;
  score: number;
  coins: [number, number]; // drop range
  powerChance: number; // power-up drop chance
}

export const ENEMIES: Record<EnemyKind, EnemyDef> = {
  scout: { kind: 'scout', hp: 3, r: 14, speed: 96, score: 50, coins: [0, 2], powerChance: 0.05 },
  weaver: { kind: 'weaver', hp: 5, r: 15, speed: 74, score: 80, coins: [1, 2], powerChance: 0.06 },
  gunner: { kind: 'gunner', hp: 9, r: 17, speed: 54, score: 120, coins: [1, 3], powerChance: 0.08 },
  diver: { kind: 'diver', hp: 4, r: 13, speed: 60, score: 100, coins: [1, 2], powerChance: 0.06 },
  tank: { kind: 'tank', hp: 32, r: 27, speed: 30, score: 260, coins: [3, 6], powerChance: 0.16 },
};

// ── Achievements ─────────────────────────────────────────────────────────────
export interface AchievementDef {
  id: string;
  name: string;
  desc: string;
  reward: number;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'kills100', name: 'EXTERMINATOR', desc: 'Destroy 100 enemies', reward: 150 },
  { id: 'coins500', name: 'COLLECTOR', desc: 'Collect 500 coins in total', reward: 200 },
  { id: 'survive300', name: 'DEEP VOID', desc: 'Survive 5 minutes in one run', reward: 300 },
  { id: 'score10k', name: 'ACE PILOT', desc: 'Score 10,000 in one run', reward: 250 },
  { id: 'boss1', name: 'GIANT SLAYER', desc: 'Destroy a capital ship', reward: 400 },
];

export const ACHIEVEMENT_MAP = ACHIEVEMENTS.reduce(
  (acc, a) => ((acc[a.id] = a), acc),
  {} as Record<string, AchievementDef>,
);
