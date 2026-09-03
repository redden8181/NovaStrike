// ── Shared game types ────────────────────────────────────────────────────────

export type PowerupType = 'rapid' | 'double' | 'triple' | 'shield' | 'power' | 'magnet';
export type UpgradeId = 'power' | 'rate' | 'streams' | 'hull' | 'shield' | 'magnet';
export type ShipId = 'falcon' | 'comet' | 'titan' | 'nova';
export type EnemyKind = 'scout' | 'weaver' | 'gunner' | 'diver' | 'tank';

export interface Stats {
  kills: number;
  totalCoins: number;
  runs: number;
  bestTime: number;
  bossKills: number;
}

export interface SaveData {
  v: number;
  best: number;
  coins: number;
  muted: boolean;
  upgrades: Record<UpgradeId, number>;
  checkpoints: number[]; // unlocked checkpoint scores, sorted
  ship: ShipId;
  shipsOwned: ShipId[];
  achievements: string[]; // unlocked ids
  stats: Stats;
}

export interface ActivePowerup {
  type: PowerupType;
  left: number;
  total: number;
}

export interface HudState {
  score: number;
  best: number;
  coins: number; // total including pending
  hp: number;
  maxHp: number;
  level: number;
  shielded: boolean;
  powerups: ActivePowerup[];
  boss: { hp: number; max: number; name: string } | null;
  elapsed: number;
  muted: boolean;
  paused: boolean;
}

export interface RunResult {
  score: number;
  best: number;
  newBest: boolean;
  coins: number; // earned this run
  kills: number;
  time: number;
  level: number;
  startCheckpoint: number;
  newCheckpoints: number[];
  newAchievements: string[];
  bossKills: number;
}

export interface EngineApi {
  getSave: () => SaveData;
  commit: (fn: (s: SaveData) => SaveData) => void;
  onHud: (h: HudState) => void;
  onGameOver: (r: RunResult) => void;
}

export interface EngineConfig {
  ship: ShipId;
  startScore: number;
  startCheckpoint: number;
}
