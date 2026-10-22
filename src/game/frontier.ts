import type { RunResult, SaveData } from './types';

export const SECTOR_SECONDS = 45;
export const SECTORS = [
  { name: 'Тихая орбита', detail: 'Стабильное пространство', color: '#7dd3fc', score: 1, magnet: 1, spawn: 1, bullet: 1 },
  { name: 'Пояс обломков', detail: 'Больше врагов · очки за цели +25%', color: '#fbbf24', score: 1.25, magnet: 1, spawn: 0.8, bullet: 1 },
  { name: 'Магнитная туманность', detail: 'Радиус сбора монет +75%', color: '#6ee7b7', score: 1, magnet: 1.75, spawn: 1, bullet: 1 },
  { name: 'Ионный фронт', detail: 'Снаряды быстрее · очки за цели +50%', color: '#c4b5fd', score: 1.5, magnet: 1, spawn: 1, bullet: 1.2 },
] as const;

export function sectorAt(seconds: number) {
  return SECTORS[Math.floor(Math.max(0, seconds) / SECTOR_SECONDS) % SECTORS.length];
}

/** Only kills score a multiplier; survival and checkpoint points never do. */
export class CombatChain {
  count = 0;
  best = 0;
  left = 0;
  get multiplier() { return 1 + Math.min(4, Math.floor(this.count / 5)) * 0.25; }
  kill() { this.count++; this.best = Math.max(this.best, this.count); this.left = 6; }
  tick(dt: number) { this.left = Math.max(0, this.left - dt); if (!this.left) this.count = 0; }
  break() { this.count = 0; this.left = 0; }
}

export interface FlightRecord {
  date: string;
  mode: RunResult['mode'];
  ship: string;
  score: number;
  kills: number;
  time: number;
  coins: number;
  combo: number;
}
export interface OperationsData {
  date: string;
  progress: { kills: number; time: number; bosses: number };
  claimed: string[];
  bestCombo: number;
  flights: FlightRecord[];
}
export function emptyOperations(): OperationsData {
  return { date: '', progress: { kills: 0, time: 0, bosses: 0 }, claimed: [], bestCombo: 0, flights: [] };
}
export function operationsFor(save: SaveData, date: string): OperationsData {
  const data = save.operations ?? emptyOperations();
  return data.date === date ? data : { ...data, date, progress: { kills: 0, time: 0, bosses: 0 }, claimed: [] };
}
export function contractsFor(date: string) {
  const variant = [...date].reduce((sum, c) => sum + c.charCodeAt(0), 0) % 3;
  return [
    { id: 'kills', metric: 'kills', title: 'Зачистка сектора', goal: 35 + variant * 10, reward: 250 + variant * 50, unit: 'целей' },
    { id: 'time', metric: 'time', title: 'Дальний патруль', goal: 120 + variant * 30, reward: 300 + variant * 50, unit: 'секунд в бою' },
    { id: 'bosses', metric: 'bosses', title: 'Охота на линкор', goal: 1, reward: 600, unit: 'босс' },
  ] as const;
}
export function claimContract(save: SaveData, date: string, id: string): SaveData {
  const data = operationsFor(save, date);
  const contract = contractsFor(date).find(c => c.id === id);
  if (!contract || data.claimed.includes(id) || data.progress[contract.metric] < contract.goal) return save;
  return { ...save, coins: save.coins + contract.reward, operations: { ...data, claimed: [...data.claimed, id] } };
}
export function recordFlight(save: SaveData, date: string, flight: FlightRecord, bosses: number): SaveData {
  const data = operationsFor(save, date);
  const eligible = flight.mode !== 'daily';
  return { ...save, operations: {
    ...data,
    bestCombo: eligible ? Math.max(data.bestCombo, flight.combo) : data.bestCombo,
    progress: eligible ? { kills: data.progress.kills + flight.kills, time: data.progress.time + flight.time, bosses: data.progress.bosses + bosses } : data.progress,
    flights: [flight, ...data.flights].slice(0, 12),
  } };
}
