// ── Ship abilities — self-contained state machine per run ───────────────────
// engine.ts only calls update()/activate() and reads modifiers().

import type { AbilityId } from './types';

export type AbilityPhase = 'ready' | 'charging' | 'active' | 'cooling';
export type AbilityIcon = 'dash' | 'flame' | 'shield' | 'beam' | 'rift';

export interface AbilityDef {
  id: AbilityId;
  name: string;
  short: string;
  desc: string;
  icon: AbilityIcon;
  color: string;
  cooldown: number;
  /** effect duration in seconds (0 = instant pulse) */
  duration: number;
  /** wind-up before the effect fires */
  charge: number;
  /** объединённая способность гибрида: эффекты обоих родителей сразу */
  parts?: AbilityId[];
}

export const ABILITIES: Record<AbilityId, AbilityDef> = {
  dash: {
    id: 'dash',
    name: 'АВАРИЙНЫЙ РЫВОК',
    short: 'РЫВОК',
    desc: 'Сжигает все снаряды рядом, рывок сквозь врагов и 1.5с неуязвимости после.',
    icon: 'dash',
    color: '#22d3ee',
    cooldown: 8,
    duration: 1.6,
    charge: 0,
  },
  afterburner: {
    id: 'afterburner',
    name: 'ФОРСАЖ',
    short: 'ФОРСАЖ',
    desc: 'Огромная скорость и темп огня, пламя сжигает снаряды за кормой.',
    icon: 'flame',
    color: '#a78bfa',
    cooldown: 10,
    duration: 5.5,
    charge: 0,
  },
  fortress: {
    id: 'fortress',
    name: 'КРЕПОСТЬ',
    short: 'КРЕПЬ',
    desc: 'Поле гасит вражеские снаряды, урон по корпусу почти не проходит.',
    icon: 'shield',
    color: '#34d399',
    cooldown: 14,
    duration: 6.5,
    charge: 0,
  },
  novabeam: {
    id: 'novabeam',
    name: 'ЛУЧ НОВЫ',
    short: 'ЛУЧ',
    desc: 'Заряжает жало, выжигающее всё прямо перед кораблём.',
    icon: 'beam',
    color: '#f472b6',
    cooldown: 13,
    duration: 2.25,
    charge: 0.65,
  },
  collapse: {
    id: 'collapse',
    name: 'КОЛЛАПС БЕЗДНЫ',
    short: 'РАЗРЫВ',
    desc: 'Имплозия близких снарядов в добычу и удар по врагам рядом.',
    icon: 'rift',
    color: '#c084fc',
    cooldown: 13,
    duration: 1.9,
    charge: 0,
  },
};

export interface AbilityModifiers {
  speedMul: number;
  fireRateMul: number;
  damageMul: number;
  damageTakenMul: number;
  invulnerable: boolean;
  phasing: boolean;
}

const NEUTRAL: AbilityModifiers = {
  speedMul: 1,
  fireRateMul: 1,
  damageMul: 1,
  damageTakenMul: 1,
  invulnerable: false,
  phasing: false,
};

const ACTIVE_MODS: Record<AbilityId, Partial<AbilityModifiers>> = {
  dash: { speedMul: 4.2, invulnerable: true, phasing: true, fireRateMul: 1.3 },
  afterburner: { speedMul: 1.8, fireRateMul: 1.6, damageMul: 1.1 },
  fortress: { speedMul: 0.6, damageTakenMul: 0.08, damageMul: 1.9 },
  novabeam: { speedMul: 0.85, fireRateMul: 0.45 },
  collapse: { speedMul: 1.1, invulnerable: true },
};

/** Короткое имя для слитой способности. */
const FUSED_SHORT: Partial<Record<AbilityId, string>> = {
  dash: 'РЫВОК',
  afterburner: 'ФОРСАЖ',
  fortress: 'КРЕПЬ',
  novabeam: 'ЛУЧ',
  collapse: 'РАЗРЫВ',
};

/**
 * Собирает одну усиленную способность из двух родительских.
 * Длительность и откат берутся по лучшему варианту, эффекты складываются.
 */
export function fuseAbilities(a: AbilityId, b: AbilityId): AbilityDef {
  const A = ABILITIES[a];
  const B = ABILITIES[b];
  if (a === b) return { ...A, cooldown: Math.max(4, A.cooldown - 2), duration: A.duration * 1.35 };
  return {
    id: a,
    parts: [a, b],
    name: `${A.name} + ${B.name}`,
    short: `${FUSED_SHORT[a] ?? A.short}·${FUSED_SHORT[b] ?? B.short}`,
    desc: `Объединённый модуль: ${A.desc.toLowerCase().replace(/\.$/, '')}, и одновременно ${B.desc.toLowerCase()}`,
    icon: A.icon,
    color: B.color,
    // слияние выгоднее по всем параметрам, чем любая исходная способность
    cooldown: Math.max(5, Math.round((Math.min(A.cooldown, B.cooldown) - 1) * 10) / 10),
    duration: Math.max(A.duration, B.duration) * 1.25,
    charge: Math.min(A.charge, B.charge),
  };
}

export interface AbilityEvents {
  /** wind-up (or immediate activation) began */
  onStart: (def: AbilityDef) => void;
  /** the actual effect fires (after charge, if any) */
  onFire: (def: AbilityDef) => void;
  /** active window closed, cooldown starts */
  onEnd: (def: AbilityDef) => void;
  /** cooldown finished */
  onReady: (def: AbilityDef) => void;
}

export class AbilityRuntime {
  def: AbilityDef;
  phase: AbilityPhase = 'ready';
  /** remaining seconds of the current phase */
  timer = 0;
  /** 0..1 progress of the active window, for visuals */
  progress = 0;
  private mods: AbilityModifiers = { ...NEUTRAL };

  constructor(def: AbilityDef) {
    this.def = def;
  }

  reset(def: AbilityDef = this.def) {
    this.def = def;
    this.phase = 'ready';
    this.timer = 0;
    this.progress = 0;
    this.applyMods();
  }

  get isActive(): boolean {
    return this.phase === 'active';
  }

  get isCharging(): boolean {
    return this.phase === 'charging';
  }

  activate(ev: AbilityEvents): boolean {
    if (this.phase !== 'ready') return false;
    ev.onStart(this.def);
    if (this.def.charge > 0) {
      this.phase = 'charging';
      this.timer = this.def.charge;
    } else {
      this.phase = 'active';
      this.timer = Math.max(0.001, this.def.duration);
      ev.onFire(this.def);
    }
    this.applyMods();
    return true;
  }

  update(dt: number, ev: AbilityEvents) {
    switch (this.phase) {
      case 'charging':
        this.timer -= dt;
        this.progress = 1 - Math.max(0, this.timer) / Math.max(0.001, this.def.charge);
        if (this.timer <= 0) {
          this.phase = 'active';
          this.timer = Math.max(0.001, this.def.duration);
          ev.onFire(this.def);
        }
        break;
      case 'active':
        this.timer -= dt;
        this.progress = 1 - Math.max(0, this.timer) / Math.max(0.001, this.def.duration);
        if (this.timer <= 0) {
          this.phase = 'cooling';
          this.timer = this.def.cooldown;
          this.progress = 0;
          ev.onEnd(this.def);
        }
        break;
      case 'cooling':
        this.timer -= dt;
        if (this.timer <= 0) {
          this.phase = 'ready';
          this.timer = 0;
          ev.onReady(this.def);
        }
        break;
      case 'ready':
        break;
    }
    this.applyMods();
  }

  private applyMods() {
    const m = this.mods;
    m.speedMul = 1;
    m.fireRateMul = 1;
    m.damageMul = 1;
    m.damageTakenMul = 1;
    m.invulnerable = false;
    m.phasing = false;
    if (this.phase !== 'active') return;
    // у гибрида берём лучшее из обеих способностей
    const ids = this.def.parts ?? [this.def.id];
    for (const id of ids) {
      const src = ACTIVE_MODS[id];
      if (!src) continue;
      if (src.speedMul !== undefined) m.speedMul = Math.max(m.speedMul, src.speedMul);
      if (src.fireRateMul !== undefined) m.fireRateMul = Math.max(m.fireRateMul, src.fireRateMul);
      if (src.damageMul !== undefined) m.damageMul = Math.max(m.damageMul, src.damageMul);
      if (src.damageTakenMul !== undefined) m.damageTakenMul = Math.min(m.damageTakenMul, src.damageTakenMul);
      if (src.invulnerable) m.invulnerable = true;
      if (src.phasing) m.phasing = true;
    }
  }

  modifiers(): AbilityModifiers {
    return this.mods;
  }

  /** HUD payload — plain numbers only, no per-frame allocation upstream. */
  hudLeft(): number {
    return this.phase === 'cooling' || this.phase === 'active' || this.phase === 'charging' ? Math.max(0, this.timer) : 0;
  }

  hudTotal(): number {
    if (this.phase === 'cooling') return this.def.cooldown;
    if (this.phase === 'active') return Math.max(0.001, this.def.duration);
    if (this.phase === 'charging') return Math.max(0.001, this.def.charge);
    return this.def.cooldown;
  }
}
