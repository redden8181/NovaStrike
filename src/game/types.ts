// ── Shared game types ────────────────────────────────────────────────────────

export type PowerupType = 'rapid' | 'double' | 'triple' | 'shield' | 'power' | 'magnet' | 'repair';
/** 'tech' — слот уникальной техники корабля (у каждого корпуса своя) */
export type UpgradeId =
  | 'power'
  | 'rate'
  | 'streams'
  | 'hull'
  | 'armor'
  | 'shield'
  | 'magnet'
  | 'tech'
  | 'turretL'
  | 'turretR'
  | 'turretPower'
  | 'turretRate'
  | 'turretStreams';
export type ShipId = 'falcon' | 'comet' | 'titan' | 'nova' | 'voidx';
export type TechId = 'missiles' | 'lightning' | 'bombs' | 'drones' | 'singularity';
export type EnemyKind = 'scout' | 'weaver' | 'gunner' | 'diver' | 'tank';
export type GameMode = 'classic' | 'endless' | 'bossrush' | 'hardcore' | 'daily';
export type SynergyId = 'barrage' | 'overheat' | 'reflector' | 'coinstorm' | 'novaburst';
export type AbilityId = 'dash' | 'afterburner' | 'fortress' | 'novabeam' | 'collapse';
export type BossId = 'reaver' | 'leviathan' | 'devourer' | 'carrier';
export type RankId = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond' | 'master' | 'legend' | 'void';

export type ShipUpgrades = Record<UpgradeId, number>;

export interface Stats {
  kills: number;
  totalCoins: number;
  runs: number;
  bestTime: number;
  bossKills: number;
  bossRushBest: number;
  hardcoreBest: number;
  synergiesTriggered: number;
  abilitiesUsed: number;
}

export interface DailyRecord {
  date: string;
  best: number;
  runs: number;
  lastScore: number;
}

export interface SaveData {
  v: number;
  best: number;
  coins: number;
  muted: boolean;
  /** прокачка отдельно для каждого корабля */
  shipUpgrades: Record<ShipId, ShipUpgrades>;
  /** достигнутые пороги счёта (точки старта + долгие разблокировки) */
  checkpoints: number[];
  ship: ShipId;
  shipsOwned: ShipId[];
  achievements: string[];
  /** id трека наград → количество полученных ступеней */
  tracks: Record<string, number>;
  stats: Stats;
  unlocks: string[];
  bestByMode: Partial<Record<GameMode, number>>;
  daily: DailyRecord;
}

export interface ActivePowerup {
  type: PowerupType;
  left: number;
  total: number;
}

export interface AbilityHud {
  id: AbilityId;
  name: string;
  phase: 'ready' | 'charging' | 'active' | 'cooling';
  left: number;
  total: number;
  color: string;
}

export interface SynergyHud {
  id: SynergyId;
  name: string;
  color: string;
}

export interface BossHud {
  hp: number;
  max: number;
  name: string;
  phase: number;
  critical: boolean;
}

export interface HudState {
  score: number;
  best: number;
  coins: number;
  hp: number;
  maxHp: number;
  /** снижение урона в процентах */
  armor: number;
  /** платный откат угрозы: готовность и цена */
  rollbackReady: boolean;
  rollbackLeft: number;
  rollbackCost: number;
  canAffordRollback: boolean;
  level: number;
  shielded: boolean;
  powerups: ActivePowerup[];
  synergies: SynergyHud[];
  ability: AbilityHud | null;
  boss: BossHud | null;
  elapsed: number;
  muted: boolean;
  paused: boolean;
  mode: GameMode;
  modeLabel: string;
  modeColor: string;
  scoreMul: number;
  bossesDown: number;
  voidBonus: number;
  voidStreak: number;
}

export interface RunResult {
  mode: GameMode;
  modeLabel: string;
  score: number;
  best: number;
  newBest: boolean;
  coins: number;
  kills: number;
  time: number;
  level: number;
  startCheckpoint: number;
  newCheckpoints: number[];
  newUnlocks: string[];
  newAchievements: string[];
  bossKills: number;
  dailyBest?: number;
}

export interface RunConfig {
  mode: GameMode;
  startCheckpoint: number;
}

export interface EngineApi {
  getSave: () => SaveData;
  commit: (fn: (s: SaveData) => SaveData) => void;
  onHud: (h: HudState) => void;
  onGameOver: (r: RunResult) => void;
}
