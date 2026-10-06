// ── Режимы игры — правила и балансные модификаторы ───────────────────────────

import type { GameMode, SaveData } from './types';

export interface ModeDef {
  id: GameMode;
  name: string;
  tag: string;
  desc: string;
  color: string;
  /** id unlock'а в save.unlocks ('' = доступен всегда) */
  unlock: string;
  allowCheckpoints: boolean;
  /** принудительно одна прочность */
  oneLife: boolean;
  scoreMul: number;
  coinMul: number;
  /** множитель кривой сложности */
  difficultyMul: number;
  /** разрыв счёта между линейными кораблями (0 = режим сам водит боссов) */
  bossInterval: number;
  bossRush: boolean;
  seeded: boolean;
}

export const MODES: ModeDef[] = [
  {
    id: 'classic',
    name: 'КЛАССИКА',
    tag: 'КАМПАНИЯ',
    desc: 'Стандартный бесконечный вылет. Чекпоинты позволяют стартовать глубже.',
    color: '#22d3ee',
    unlock: '',
    allowCheckpoints: true,
    oneLife: false,
    scoreMul: 1,
    coinMul: 1,
    difficultyMul: 1,
    bossInterval: 8000,
    bossRush: false,
    seeded: false,
  },
  {
    id: 'endless',
    name: 'БЕСКОНЕЧНЫЙ',
    tag: 'МАКС. СЧЁТ',
    desc: 'Без чекпоинтов. Бездна не перестаёт усиливаться. Гонись за числом.',
    color: '#a78bfa',
    unlock: 'endless',
    allowCheckpoints: false,
    oneLife: false,
    scoreMul: 1.3,
    coinMul: 1.15,
    difficultyMul: 1.22,
    bossInterval: 7000,
    bossRush: false,
    seeded: false,
  },
  {
    id: 'bossrush',
    name: 'БОСС-РУШ',
    tag: 'ЛИНКОРЫ',
    desc: 'Линейный корабль за линейным. Небольшой ремонт между победами.',
    color: '#f472b6',
    unlock: 'bossrush',
    allowCheckpoints: false,
    oneLife: false,
    scoreMul: 1.2,
    coinMul: 1.4,
    difficultyMul: 1.1,
    bossInterval: 0,
    bossRush: true,
    seeded: false,
  },
  {
    id: 'hardcore',
    name: 'ХАРДКОР',
    tag: 'ОДНА ЖИЗНЬ',
    desc: 'Одно попадание — и конец. Без чекпоинтов. Двойной счёт, богаче добыча.',
    color: '#ef4444',
    unlock: 'hardcore',
    allowCheckpoints: false,
    oneLife: true,
    scoreMul: 2,
    coinMul: 1.75,
    difficultyMul: 1.3,
    bossInterval: 9000,
    bossRush: false,
    seeded: false,
  },
  {
    id: 'daily',
    name: 'ЕЖЕДНЕВНОЕ',
    tag: '3 ПОПЫТКИ',
    desc: 'Своё событие на каждый день недели. Общий корабль и сид для всех, тройная добыча.',
    color: '#fbbf24',
    unlock: '',
    allowCheckpoints: false,
    oneLife: false,
    scoreMul: 1,
    coinMul: 1,
    difficultyMul: 1.05,
    bossInterval: 8000,
    bossRush: false,
    seeded: true,
  },
];

export const MODE_MAP: Record<GameMode, ModeDef> = MODES.reduce(
  (acc, m) => ((acc[m.id] = m), acc),
  {} as Record<GameMode, ModeDef>,
);

/** Все режимы открыты с самого начала — пробовать можно что угодно. */
export function isModeUnlocked(_save: SaveData, _id: GameMode): boolean {
  return true;
}
