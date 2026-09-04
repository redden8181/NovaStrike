// ── Power-up synergies — data-driven combinations ───────────────────────────
// Add a new combo by appending one entry to SYNERGIES; no engine changes needed.

import type { PowerupType, SynergyId } from './types';

export interface SynergyEffects {
  fireRateMul?: number;
  damageMul?: number;
  extraStreams?: number;
  spreadMul?: number;
  bulletScale?: number;
  /** shield bounces enemy fire back as player bullets */
  reflect?: boolean;
  coinValueMul?: number;
  magnetMul?: number;
  /** seconds between automatic radial bursts (0/undefined = off) */
  novaBurst?: number;
}

export interface SynergyDef {
  id: SynergyId;
  name: string;
  desc: string;
  color: string;
  requires: PowerupType[];
  effects: SynergyEffects;
}

export const SYNERGIES: SynergyDef[] = [
  {
    id: 'barrage',
    name: 'ШКВАЛ',
    desc: 'Стена из снарядов',
    color: '#38bdf8',
    requires: ['rapid', 'triple'],
    effects: { fireRateMul: 1.25, extraStreams: 2, spreadMul: 1.45, damageMul: 0.92 },
  },
  {
    id: 'overheat',
    name: 'ПЕРЕГРЕВ',
    desc: 'Орудия на пределе',
    color: '#fb923c',
    requires: ['rapid', 'power'],
    effects: { fireRateMul: 1.5, damageMul: 1.5, bulletScale: 1.3 },
  },
  {
    id: 'reflector',
    name: 'ОТРАЖАТЕЛЬ',
    desc: 'Щит возвращает огонь',
    color: '#22d3ee',
    requires: ['shield', 'power'],
    effects: { reflect: true, damageMul: 1.1 },
  },
  {
    id: 'coinstorm',
    name: 'ЗОЛОТОЙ ШТОРМ',
    desc: 'Добыча намагничена',
    color: '#fbbf24',
    requires: ['magnet', 'double'],
    effects: { coinValueMul: 2, magnetMul: 1.6 },
  },
  {
    id: 'novaburst',
    name: 'ИМПУЛЬС НОВЫ',
    desc: 'Периодическая ударная волна',
    color: '#f472b6',
    requires: ['triple', 'power'],
    effects: { novaBurst: 2.4, damageMul: 1.15 },
  },
];

export const SYNERGY_MAP: Record<SynergyId, SynergyDef> = SYNERGIES.reduce(
  (acc, s) => ((acc[s.id] = s), acc),
  {} as Record<SynergyId, SynergyDef>,
);

export interface CombinedSynergyEffects {
  fireRateMul: number;
  damageMul: number;
  extraStreams: number;
  spreadMul: number;
  bulletScale: number;
  reflect: boolean;
  coinValueMul: number;
  magnetMul: number;
  novaBurst: number;
}

const NEUTRAL: CombinedSynergyEffects = {
  fireRateMul: 1,
  damageMul: 1,
  extraStreams: 0,
  spreadMul: 1,
  bulletScale: 1,
  reflect: false,
  coinValueMul: 1,
  magnetMul: 1,
  novaBurst: 0,
};

/**
 * Tracks which synergies are live for the current power-up cocktail.
 * Mutates its own cached arrays — safe to poll every frame.
 */
export class SynergyTracker {
  active: SynergyId[] = [];
  private combined: CombinedSynergyEffects = { ...NEUTRAL };
  private gainedBuf: SynergyDef[] = [];
  private lostBuf: SynergyDef[] = [];

  reset() {
    this.active.length = 0;
    this.combined = { ...NEUTRAL };
  }

  /** Recomputes active combos; returns what turned on/off this tick. */
  update(pw: Record<PowerupType, number>): { gained: SynergyDef[]; lost: SynergyDef[] } {
    this.gainedBuf.length = 0;
    this.lostBuf.length = 0;
    let changed = false;

    for (const def of SYNERGIES) {
      let ok = true;
      for (const req of def.requires) {
        if (pw[req] <= 0) {
          ok = false;
          break;
        }
      }
      const idx = this.active.indexOf(def.id);
      if (ok && idx === -1) {
        this.active.push(def.id);
        this.gainedBuf.push(def);
        changed = true;
      } else if (!ok && idx !== -1) {
        this.active.splice(idx, 1);
        this.lostBuf.push(def);
        changed = true;
      }
    }

    if (changed) this.recompute();
    return { gained: this.gainedBuf, lost: this.lostBuf };
  }

  private recompute() {
    const c = this.combined;
    c.fireRateMul = 1;
    c.damageMul = 1;
    c.extraStreams = 0;
    c.spreadMul = 1;
    c.bulletScale = 1;
    c.reflect = false;
    c.coinValueMul = 1;
    c.magnetMul = 1;
    c.novaBurst = 0;
    for (const id of this.active) {
      const e = SYNERGY_MAP[id].effects;
      c.fireRateMul *= e.fireRateMul ?? 1;
      c.damageMul *= e.damageMul ?? 1;
      c.extraStreams += e.extraStreams ?? 0;
      c.spreadMul *= e.spreadMul ?? 1;
      c.bulletScale *= e.bulletScale ?? 1;
      c.reflect = c.reflect || !!e.reflect;
      c.coinValueMul *= e.coinValueMul ?? 1;
      c.magnetMul *= e.magnetMul ?? 1;
      if (e.novaBurst) c.novaBurst = c.novaBurst ? Math.min(c.novaBurst, e.novaBurst) : e.novaBurst;
    }
  }

  effects(): CombinedSynergyEffects {
    return this.combined;
  }
}
