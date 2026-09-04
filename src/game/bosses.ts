// ── Boss system — definitions, phase machine, patterns and rendering ────────
// engine.ts owns collisions/score; this module owns behaviour and looks.

import type { BossId } from './types';
import { drawGlow } from './sprites';

const TAU = Math.PI * 2;
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

export interface BossDef {
  id: BossId;
  name: string;
  subtitle: string;
  /** base hull before tier/difficulty scaling */
  hp: number;
  /** core hit radius in design units */
  coreR: number;
  /** half width of the hull, for sweeping motion limits */
  halfW: number;
  color: string;
  turrets: { ox: number; oy: number; hp: number }[];
}

export const BOSSES: Record<BossId, BossDef> = {
  reaver: {
    id: 'reaver',
    name: 'ЖНЕЦ БЕЗДНЫ',
    subtitle: 'УНИЧТОЖЬ ТУРЕЛИ, ЗАТЕМ ЯДРО',
    hp: 130,
    coreR: 34,
    halfW: 84,
    color: '#f472b6',
    turrets: [
      { ox: -52, oy: 16, hp: 45 },
      { ox: 52, oy: 16, hp: 45 },
    ],
  },
  leviathan: {
    id: 'leviathan',
    name: 'ЛЕВИАФАН БЕЗДНЫ',
    subtitle: 'ТЯЖЁЛЫЙ ЛИНКОР — УВОРАЧИВАЙСЯ ОТ ЖАЛА',
    hp: 210,
    coreR: 38,
    halfW: 118,
    color: '#38bdf8',
    turrets: [
      { ox: -86, oy: 22, hp: 55 },
      { ox: 86, oy: 22, hp: 55 },
    ],
  },
  devourer: {
    id: 'devourer',
    name: 'ПОЖИРАТЕЛЬ ЗВЁЗД',
    subtitle: 'БЕЙ В ЯДРО, ПОКА ПАНЦИРЬ ОТКРЫТ',
    hp: 240,
    coreR: 40,
    halfW: 76,
    color: '#c084fc',
    turrets: [],
  },
  carrier: {
    id: 'carrier',
    name: 'ОМЕГА-НОСИТЕЛЬ',
    subtitle: 'СНЕСИ ТУРЕЛИ, ЧТОБЫ СНЯТЬ ЩИТ',
    hp: 260,
    coreR: 36,
    halfW: 110,
    color: '#fb923c',
    turrets: [
      { ox: -80, oy: -6, hp: 50 },
      { ox: -44, oy: 26, hp: 50 },
      { ox: 44, oy: 26, hp: 50 },
      { ox: 80, oy: -6, hp: 50 },
    ],
  },
};

export const BOSS_ORDER: BossId[] = ['reaver', 'leviathan', 'devourer', 'carrier'];

export function bossForTier(tier: number): BossId {
  return BOSS_ORDER[(Math.max(1, tier) - 1) % BOSS_ORDER.length];
}

export interface BossTurret {
  ox: number;
  oy: number;
  hp: number;
  max: number;
  alive: boolean;
  cool: number;
  burst: number;
  burstT: number;
}

export interface BossEntity {
  id: BossId;
  def: BossDef;
  name: string;
  tier: number;
  x: number;
  y: number;
  baseY: number;
  t: number;
  state: 'enter' | 'fight' | 'die';
  hp: number;
  max: number;
  phase: number;
  phaseFlash: number;
  flash: number;
  turrets: BossTurret[];
  /** generic pattern cursor */
  pattern: number;
  pT: number;
  /** shared timers bag (per-boss meaning) */
  t1: number;
  t2: number;
  t3: number;
  angle: number;
  /** devourer: shell open */
  open: boolean;
  /** carrier: shield up */
  shielded: boolean;
  /** leviathan lance */
  laserState: 0 | 1 | 2; // 0 idle, 1 telegraph, 2 firing
  laserX: number;
  laserDir: number;
  laserT: number;
  dieT: number;
  dieFx: number;
}

export interface BossHooks {
  bullet: (x: number, y: number, vx: number, vy: number, r: number, color: string, homing?: number) => void;
  spawnMinion: (x: number, y: number) => void;
  player: () => { x: number; y: number };
  dims: () => { w: number; h: number; u: number };
  rnd: () => number;
  sfx: (name: 'boom' | 'bigboom' | 'warn' | 'phase' | 'laser' | 'shieldHit') => void;
  shake: (amount: number) => void;
  banner: (text: string, sub: string, color: string, dur: number) => void;
  explode: (x: number, y: number, color: string, n: number, power: number) => void;
  onPhase: (phase: number) => void;
}

export function createBoss(id: BossId, tier: number, hpScale: number, w: number, h: number, u: number): BossEntity {
  const def = BOSSES[id];
  const loop = Math.floor((tier - 1) / BOSS_ORDER.length);
  const hp = def.hp * (1 + 0.42 * (tier - 1)) * hpScale;
  return {
    id,
    def,
    name: loop > 0 ? `${def.name} ${loop + 1}` : def.name,
    tier,
    x: w / 2,
    y: -140 * u,
    baseY: h * (id === 'leviathan' ? 0.17 : 0.2),
    t: 0,
    state: 'enter',
    hp,
    max: hp,
    phase: 1,
    phaseFlash: 0,
    flash: 0,
    turrets: def.turrets.map((t) => ({
      ox: t.ox,
      oy: t.oy,
      hp: t.hp * (1 + 0.3 * (tier - 1)) * hpScale,
      max: t.hp * (1 + 0.3 * (tier - 1)) * hpScale,
      alive: true,
      cool: 1 + Math.random() * 1.2,
      burst: 0,
      burstT: 0,
    })),
    pattern: 0,
    pT: 0,
    t1: 0.9,
    t2: 1.6,
    t3: 3,
    angle: 0,
    open: false,
    shielded: def.turrets.length > 0 && id === 'carrier',
    laserState: 0,
    laserX: w / 2,
    laserDir: 1,
    laserT: 0,
    dieT: 0,
    dieFx: 0,
  };
}

export function bossPhaseLabel(phase: number): string {
  return phase >= 3 ? 'КРИТИЧНО' : `ФАЗА ${phase}`;
}

/** Phase thresholds: 1 → >60%, 2 → ≤60%, 3 → ≤25%. */
function phaseFor(hpK: number): number {
  if (hpK <= 0.25) return 3;
  if (hpK <= 0.6) return 2;
  return 1;
}

function checkPhase(b: BossEntity, hooks: BossHooks) {
  const next = phaseFor(b.hp / b.max);
  if (next <= b.phase) return;
  b.phase = next;
  b.phaseFlash = 1;
  b.pT = 0;
  hooks.onPhase(next);
  hooks.shake(next >= 3 ? 0.85 : 0.5);
  hooks.sfx('phase');
  const critical = next >= 3;
  hooks.banner(
    critical ? 'КРИТИЧНО' : `ФАЗА ${next}`,
    critical ? `${b.name} ТЕРЯЕТ УПРАВЛЕНИЕ` : 'ВРАГ УСИЛИВАЕТСЯ',
    critical ? '#ef4444' : '#fbbf24',
    1.7,
  );
  hooks.explode(b.x, b.y, critical ? '#ef4444' : '#fbbf24', critical ? 26 : 16, 1.4);
}

/** Damage entry point. Returns true when the boss just died. */
export function damageBossCore(b: BossEntity, dmg: number, hooks: BossHooks): boolean {
  if (b.state !== 'fight') return false;
  let mult = 1;
  if (b.id === 'devourer' && !b.open) mult = 0.15;
  if (b.id === 'carrier' && b.shielded) mult = 0.12;
  b.hp -= dmg * mult;
  b.flash = 1;
  checkPhase(b, hooks);
  if (b.hp <= 0) {
    b.state = 'die';
    b.dieT = 0;
    hooks.sfx('bigboom');
    return true;
  }
  return false;
}

/** Returns true when the turret was destroyed by this hit. */
export function damageBossTurret(b: BossEntity, idx: number, dmg: number, hooks: BossHooks): boolean {
  const t = b.turrets[idx];
  if (!t || !t.alive) return false;
  t.hp -= dmg;
  b.flash = 1;
  if (t.hp > 0) return false;
  t.alive = false;
  const { u } = hooks.dims();
  hooks.explode(b.x + t.ox * u, b.y + t.oy * u, '#fb923c', 22, 1.4);
  hooks.sfx('boom');
  hooks.shake(0.35);
  if (b.id === 'carrier' && b.shielded && b.turrets.every((x) => !x.alive)) {
    b.shielded = false;
    hooks.banner('ЩИТ СНЯТ', 'ЯДРО ОТКРЫТО', '#4ade80', 1.6);
    hooks.sfx('phase');
  }
  return true;
}

/** Hit test against the boss silhouette. */
export function bossHitTest(
  b: BossEntity,
  x: number,
  y: number,
  r: number,
  u: number,
): { part: 'none' | 'core' | 'turret'; index: number } {
  if (b.state === 'die') return { part: 'none', index: -1 };
  for (let i = 0; i < b.turrets.length; i++) {
    const t = b.turrets[i];
    if (!t.alive) continue;
    const tx = b.x + t.ox * u;
    const ty = b.y + t.oy * u;
    const rr = (15 * u + r) ** 2;
    const dx = x - tx;
    const dy = y - ty;
    if (dx * dx + dy * dy < rr) return { part: 'turret', index: i };
  }
  const cr = b.def.coreR * u + r;
  const dx = x - b.x;
  const dy = y - b.y;
  if (dx * dx + dy * dy < cr * cr) return { part: 'core', index: -1 };
  // wide hull body counts as core, so shots never pass through the sprite
  if (Math.abs(dx) < b.def.halfW * u && Math.abs(dy) < 44 * u) return { part: 'core', index: -1 };
  return { part: 'none', index: -1 };
}

/** Vertical lance damage zone (leviathan), or null. */
export function bossLaserZone(b: BossEntity, u: number): { x: number; halfW: number } | null {
  if (b.id !== 'leviathan' || b.laserState !== 2) return null;
  return { x: b.laserX, halfW: 15 * u };
}

// ── behaviour ────────────────────────────────────────────────────────────────
export function updateBoss(b: BossEntity, dt: number, hooks: BossHooks) {
  const { w, h, u } = hooks.dims();
  b.t += dt;
  b.flash = Math.max(0, b.flash - dt * 6);
  b.phaseFlash = Math.max(0, b.phaseFlash - dt * 1.6);

  if (b.state === 'enter') {
    b.y = lerp(b.y, b.baseY, 1 - Math.exp(-dt * 1.7));
    if (b.y > b.baseY - 8 * u) b.state = 'fight';
    return;
  }

  if (b.state === 'die') {
    b.dieT += dt;
    b.dieFx -= dt;
    if (b.dieFx <= 0) {
      b.dieFx = 0.08;
      hooks.explode(
        b.x + (hooks.rnd() * 2 - 1) * b.def.halfW * u * 0.8,
        b.y + (hooks.rnd() * 2 - 1) * 34 * u,
        hooks.rnd() < 0.4 ? b.def.color : '#fbbf24',
        10,
        1.3,
      );
      hooks.shake(0.15);
      if (hooks.rnd() < 0.5) hooks.sfx('boom');
    }
    return;
  }

  // aggression scales with phase
  const aggro = b.phase === 3 ? 1.55 : b.phase === 2 ? 1.22 : 1;
  b.pT += dt * aggro;

  switch (b.id) {
    case 'reaver':
      updateReaver(b, dt, hooks, aggro, w, u);
      break;
    case 'leviathan':
      updateLeviathan(b, dt, hooks, aggro, w, h, u);
      break;
    case 'devourer':
      updateDevourer(b, dt, hooks, aggro, w, u);
      break;
    case 'carrier':
      updateCarrier(b, dt, hooks, aggro, w, u);
      break;
  }
}

function driftSideways(b: BossEntity, dt: number, w: number, u: number, speed: number, span: number) {
  b.x = w / 2 + Math.sin(b.t * speed) * Math.min(w * 0.26, span * u);
  b.y = lerp(b.y, b.baseY + Math.sin(b.t * 0.9) * 7 * u, dt * 2);
}

function aimAt(hooks: BossHooks, x: number, y: number): number {
  const p = hooks.player();
  return Math.atan2(p.y - y, p.x - x);
}

function runTurrets(b: BossEntity, dt: number, hooks: BossHooks, aggro: number, u: number, speed: number, color: string) {
  for (const t of b.turrets) {
    if (!t.alive) continue;
    const tx = b.x + t.ox * u;
    const ty = b.y + t.oy * u;
    if (t.burst > 0) {
      t.burstT -= dt;
      if (t.burstT <= 0) {
        t.burstT = 0.14;
        t.burst -= 1;
        const a = aimAt(hooks, tx, ty);
        hooks.bullet(tx, ty, Math.cos(a) * speed * u, Math.sin(a) * speed * u, 5 * u, color);
      }
    } else {
      t.cool -= dt * aggro;
      if (t.cool <= 0) {
        t.cool = 1.7;
        t.burst = b.phase >= 3 ? 4 : 3;
        t.burstT = 0;
      }
    }
  }
}

function radialSpray(b: BossEntity, hooks: BossHooks, u: number, count: number, speed: number, color: string, spin: number) {
  b.angle += spin;
  for (let i = 0; i < count; i++) {
    const a = b.angle + (TAU * i) / count;
    hooks.bullet(
      b.x + Math.cos(a) * 24 * u,
      b.y + Math.sin(a) * 24 * u,
      Math.cos(a) * speed * u,
      Math.sin(a) * speed * u,
      5 * u,
      color,
    );
  }
}

// VOID REAVER — the original: spray, turret bursts, sweeping bombs, minions
function updateReaver(b: BossEntity, dt: number, hooks: BossHooks, aggro: number, w: number, u: number) {
  const patterns = b.phase >= 3 ? [0, 1, 2, 3] : b.phase === 2 ? [0, 1, 2] : [0, 1];
  const cur = patterns[b.pattern % patterns.length];
  if (b.pT > 4.4) {
    b.pT = 0;
    b.pattern += 1;
  }

  if (cur === 2) {
    const p = (b.pT % 4.4) / 4.4;
    const tri = p < 0.5 ? p * 2 : (1 - p) * 2;
    b.x = lerp(w * 0.18, w * 0.82, tri);
    b.y = lerp(b.y, b.baseY + 26 * u, dt * 2);
    b.t1 -= dt * aggro;
    if (b.t1 <= 0) {
      b.t1 = 0.15;
      for (const off of [-30, 30]) {
        hooks.bullet(b.x + off * u, b.y + 30 * u, 0, 195 * u, 5 * u, b.def.color);
      }
    }
  } else {
    driftSideways(b, dt, w, u, 0.55, 110);
  }

  if (cur === 0) {
    b.t2 -= dt * aggro;
    if (b.t2 <= 0) {
      b.t2 = b.phase >= 3 ? 0.7 : 0.95;
      radialSpray(b, hooks, u, 10 + b.tier * 2 + b.phase * 2, 135, b.def.color, 0.42);
    }
  }
  if (cur === 1) runTurrets(b, dt, hooks, aggro, u, 215, '#fb923c');
  if (cur === 3) {
    b.t3 -= dt;
    if (b.t3 <= 0) {
      b.t3 = 1.1;
      hooks.spawnMinion(clamp(b.x + (hooks.rnd() * 2 - 1) * 80 * u, 26, w - 26), b.y + 30 * u);
    }
  }
}

// VOID LEVIATHAN — spread volleys, sweeping lance, escort waves
function updateLeviathan(b: BossEntity, dt: number, hooks: BossHooks, aggro: number, w: number, h: number, u: number) {
  driftSideways(b, dt, w, u, 0.42, 90);

  // lance cycle
  if (b.laserState === 0) {
    b.laserT -= dt * aggro;
    if (b.laserT <= 0) {
      b.laserState = 1;
      b.laserT = 0.9;
      b.laserX = b.x;
      b.laserDir = hooks.player().x > b.x ? 1 : -1;
      hooks.sfx('warn');
    }
  } else if (b.laserState === 1) {
    b.laserT -= dt;
    b.laserX = lerp(b.laserX, b.x, dt * 6);
    if (b.laserT <= 0) {
      b.laserState = 2;
      b.laserT = b.phase >= 3 ? 2.1 : 1.5;
      hooks.sfx('laser');
      hooks.shake(0.35);
    }
  } else {
    b.laserT -= dt;
    const sweep = (b.phase >= 3 ? 190 : 130) * u * dt * b.laserDir;
    b.laserX += sweep;
    if (b.laserX < w * 0.12 || b.laserX > w * 0.88) b.laserDir *= -1;
    if (b.laserT <= 0) {
      b.laserState = 0;
      b.laserT = b.phase >= 3 ? 2.6 : 4;
    }
  }

  // spread volleys
  b.t1 -= dt * aggro;
  if (b.t1 <= 0) {
    b.t1 = b.phase >= 3 ? 1.15 : 1.7;
    const fan = 4 + b.phase * 2;
    const base = aimAt(hooks, b.x, b.y + 30 * u);
    for (let i = 0; i < fan; i++) {
      const a = base + (i - (fan - 1) / 2) * 0.19;
      hooks.bullet(b.x, b.y + 30 * u, Math.cos(a) * 175 * u, Math.sin(a) * 175 * u, 5 * u, b.def.color);
    }
  }

  runTurrets(b, dt, hooks, aggro * 0.8, u, 200, '#7dd3fc');

  if (b.phase >= 2) {
    b.t3 -= dt;
    if (b.t3 <= 0) {
      b.t3 = b.phase >= 3 ? 2.2 : 3.4;
      hooks.spawnMinion(clamp(b.x + (hooks.rnd() * 2 - 1) * 110 * u, 26, w - 26), b.y + 24 * u);
    }
  }
  void h;
}

// STAR DEVOURER — armoured shell with a timed weak point
function updateDevourer(b: BossEntity, dt: number, hooks: BossHooks, aggro: number, w: number, u: number) {
  b.x = w / 2 + Math.sin(b.t * 0.7) * Math.min(w * 0.22, 80 * u);
  b.y = b.baseY + Math.sin(b.t * 1.3) * 12 * u;

  // shell rhythm: open window shortens as it degrades, but comes more often
  b.t1 -= dt;
  if (b.t1 <= 0) {
    b.open = !b.open;
    b.t1 = b.open ? (b.phase >= 3 ? 1.9 : 2.6) : b.phase >= 3 ? 2.2 : 3.2;
    if (b.open) {
      hooks.banner('ЯДРО ОТКРЫТО', 'БЕЙ СЕЙЧАС', '#4ade80', 1.1);
      hooks.sfx('phase');
    }
  }

  // radial patterns — denser while closed
  b.t2 -= dt * aggro;
  if (b.t2 <= 0) {
    b.t2 = b.open ? 1.5 : b.phase >= 3 ? 0.62 : 0.95;
    const count = b.open ? 8 : 12 + b.phase * 3;
    radialSpray(b, hooks, u, count, b.phase >= 3 ? 155 : 130, b.def.color, b.open ? -0.3 : 0.36);
  }

  // aimed lash
  if (b.phase >= 2) {
    b.t3 -= dt * aggro;
    if (b.t3 <= 0) {
      b.t3 = 2.4;
      const base = aimAt(hooks, b.x, b.y);
      for (let i = 0; i < 3; i++) {
        const a = base + (i - 1) * 0.16;
        hooks.bullet(b.x, b.y, Math.cos(a) * 205 * u, Math.sin(a) * 205 * u, 6 * u, '#e9d5ff');
      }
      if (b.phase >= 3) hooks.spawnMinion(clamp(b.x + (hooks.rnd() * 2 - 1) * 90 * u, 26, w - 26), b.y + 30 * u);
    }
  }
}

// OMEGA CARRIER — turret shield, fighter bays, homing missiles
function updateCarrier(b: BossEntity, dt: number, hooks: BossHooks, aggro: number, w: number, u: number) {
  driftSideways(b, dt, w, u, 0.36, 96);

  runTurrets(b, dt, hooks, aggro, u, 205, '#fdba74');

  // fighter launches
  b.t1 -= dt * aggro;
  if (b.t1 <= 0) {
    b.t1 = b.phase >= 3 ? 1.5 : b.phase === 2 ? 2.2 : 3;
    hooks.spawnMinion(clamp(b.x - 60 * u, 26, w - 26), b.y + 26 * u);
    if (b.phase >= 2) hooks.spawnMinion(clamp(b.x + 60 * u, 26, w - 26), b.y + 26 * u);
  }

  // homing missiles from phase 2
  if (b.phase >= 2) {
    b.t2 -= dt * aggro;
    if (b.t2 <= 0) {
      b.t2 = b.phase >= 3 ? 1.6 : 2.6;
      for (const off of [-30, 30]) {
        hooks.bullet(b.x + off * u, b.y + 34 * u, off * 0.9 * u, 130 * u, 6 * u, '#f87171', 1.6);
      }
    }
  }

  // phase 3 re-raises the shield periodically
  if (b.phase >= 3) {
    b.t3 -= dt;
    if (b.t3 <= 0) {
      b.t3 = 7;
      b.shielded = !b.shielded;
      if (b.shielded) {
        hooks.banner('ЩИТ ВОССТАНОВЛЕН', 'СНЕСИ ЕГО СНОВА', '#38bdf8', 1.4);
        hooks.sfx('shieldHit');
      }
    }
  }
}

// ── rendering ────────────────────────────────────────────────────────────────
export function renderBoss(ctx: CanvasRenderingContext2D, b: BossEntity, u: number, px: number, py: number, h: number) {
  const color = b.def.color;

  // lance telegraph / beam is drawn behind the hull
  if (b.id === 'leviathan' && b.laserState > 0) {
    ctx.save();
    if (b.laserState === 1) {
      const a = 0.35 + 0.3 * Math.sin(b.t * 26);
      ctx.globalAlpha = a;
      ctx.strokeStyle = '#f87171';
      ctx.setLineDash([10, 8]);
      ctx.lineWidth = 2 * u;
      ctx.beginPath();
      ctx.moveTo(b.laserX, b.y);
      ctx.lineTo(b.laserX, h);
      ctx.stroke();
      ctx.setLineDash([]);
    } else {
      const halfW = 15 * u;
      const grad = ctx.createLinearGradient(b.laserX - halfW, 0, b.laserX + halfW, 0);
      grad.addColorStop(0, 'rgba(56,189,248,0)');
      grad.addColorStop(0.35, 'rgba(125,211,252,0.75)');
      grad.addColorStop(0.5, 'rgba(255,255,255,0.95)');
      grad.addColorStop(0.65, 'rgba(125,211,252,0.75)');
      grad.addColorStop(1, 'rgba(56,189,248,0)');
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = grad;
      ctx.fillRect(b.laserX - halfW * 1.6, b.y, halfW * 3.2, h - b.y);
      drawGlow(ctx, '#7dd3fc', b.laserX, b.y + 10 * u, 46 * u, 0.9, true);
    }
    ctx.restore();
  }

  ctx.save();
  ctx.translate(b.x, b.y);
  drawGlow(ctx, color, 0, 0, b.def.halfW * 1.5 * u, b.phase >= 3 ? 0.75 : 0.55);

  switch (b.id) {
    case 'reaver':
      drawReaver(ctx, b, u, color);
      break;
    case 'leviathan':
      drawLeviathan(ctx, b, u, color);
      break;
    case 'devourer':
      drawDevourer(ctx, b, u, color);
      break;
    case 'carrier':
      drawCarrier(ctx, b, u, color);
      break;
  }

  // turrets shared across bosses that have them
  for (const t of b.turrets) {
    const tx = t.ox * u;
    const ty = t.oy * u;
    if (t.alive) {
      drawGlow(ctx, '#fb923c', tx, ty, 20 * u, 0.8, true);
      ctx.fillStyle = '#292524';
      ctx.beginPath();
      ctx.arc(tx, ty, 12 * u, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = '#fb923c';
      ctx.lineWidth = 1.4;
      ctx.stroke();
      const wa = Math.atan2(py - (b.y + ty), px - (b.x + tx));
      ctx.save();
      ctx.translate(tx, ty);
      ctx.rotate(wa);
      ctx.fillStyle = '#44403c';
      ctx.fillRect(6 * u, -2.4 * u, 15 * u, 4.8 * u);
      ctx.fillStyle = '#fdba74';
      ctx.fillRect(19 * u, -2.4 * u, 2.6 * u, 4.8 * u);
      ctx.restore();
      // health ring
      ctx.strokeStyle = 'rgba(251,146,60,0.85)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(tx, ty, 15 * u, -Math.PI / 2, -Math.PI / 2 + TAU * clamp(t.hp / t.max, 0, 1));
      ctx.stroke();
    } else {
      ctx.fillStyle = '#0c0a09';
      ctx.beginPath();
      ctx.arc(tx, ty, 12 * u, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = 'rgba(120,113,108,0.5)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  // carrier energy shield
  if (b.id === 'carrier' && b.shielded) {
    const pulse = 0.85 + 0.15 * Math.sin(b.t * 5);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = 'rgba(56,189,248,0.75)';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.ellipse(0, 4 * u, b.def.halfW * 1.12 * u * pulse, 62 * u * pulse, 0, 0, TAU);
    ctx.stroke();
    ctx.globalAlpha = 0.14;
    ctx.fillStyle = '#38bdf8';
    ctx.fill();
    ctx.restore();
  }

  // hit flash
  if (b.flash > 0) {
    ctx.globalAlpha = b.flash * 0.42;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(0, 0, b.def.halfW * u, 44 * u, 0, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  // phase transition shock ring
  if (b.phaseFlash > 0) {
    ctx.save();
    ctx.globalAlpha = b.phaseFlash * 0.8;
    ctx.strokeStyle = b.phase >= 3 ? '#ef4444' : '#fbbf24';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, (1 - b.phaseFlash) * 220 * u, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }

  ctx.restore();
}

function drawCore(ctx: CanvasRenderingContext2D, b: BossEntity, u: number, r: number, dim = false) {
  const hpK = clamp(b.hp / b.max, 0, 1);
  const pulse = 0.8 + 0.2 * Math.sin(b.t * (b.phase >= 3 ? 7 : 4));
  const coreColor = dim ? '#64748b' : hpK > 0.6 ? '#22d3ee' : hpK > 0.3 ? '#fbbf24' : '#ef4444';
  drawGlow(ctx, coreColor, 0, 2 * u, r * 2 * pulse, dim ? 0.5 : 1, true);
  ctx.fillStyle = dim ? '#94a3b8' : '#ffffff';
  ctx.beginPath();
  ctx.arc(0, 2 * u, r * 0.5 * pulse, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = coreColor;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 2 * u, r * 0.85, b.t * 1.4, b.t * 1.4 + TAU * 0.8);
  ctx.stroke();
}

function drawReaver(ctx: CanvasRenderingContext2D, b: BossEntity, u: number, color: string) {
  const hg = ctx.createLinearGradient(0, -46 * u, 0, 44 * u);
  hg.addColorStop(0, '#1e293b');
  hg.addColorStop(0.55, '#0f172a');
  hg.addColorStop(1, '#020617');
  ctx.fillStyle = hg;
  ctx.beginPath();
  ctx.moveTo(0, 44 * u);
  ctx.lineTo(-30 * u, 30 * u);
  ctx.lineTo(-84 * u, 6 * u);
  ctx.lineTo(-70 * u, -20 * u);
  ctx.lineTo(-26 * u, -34 * u);
  ctx.lineTo(0, -44 * u);
  ctx.lineTo(26 * u, -34 * u);
  ctx.lineTo(70 * u, -20 * u);
  ctx.lineTo(84 * u, 6 * u);
  ctx.lineTo(30 * u, 30 * u);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.6;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(148,163,184,0.25)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-60 * u, -4 * u);
  ctx.lineTo(60 * u, -4 * u);
  ctx.moveTo(-40 * u, -22 * u);
  ctx.lineTo(40 * u, -22 * u);
  ctx.stroke();
  drawCore(ctx, b, u, 17 * u);
}

function drawLeviathan(ctx: CanvasRenderingContext2D, b: BossEntity, u: number, color: string) {
  // long armoured spine
  const hg = ctx.createLinearGradient(0, -40 * u, 0, 40 * u);
  hg.addColorStop(0, '#0f2136');
  hg.addColorStop(0.5, '#0b1220');
  hg.addColorStop(1, '#020617');
  ctx.fillStyle = hg;
  ctx.beginPath();
  ctx.moveTo(-118 * u, 4 * u);
  ctx.lineTo(-74 * u, -20 * u);
  ctx.lineTo(-24 * u, -30 * u);
  ctx.lineTo(0, -42 * u);
  ctx.lineTo(24 * u, -30 * u);
  ctx.lineTo(74 * u, -20 * u);
  ctx.lineTo(118 * u, 4 * u);
  ctx.lineTo(86 * u, 26 * u);
  ctx.lineTo(34 * u, 38 * u);
  ctx.lineTo(-34 * u, 38 * u);
  ctx.lineTo(-86 * u, 26 * u);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.6;
  ctx.stroke();
  // rib plating
  ctx.strokeStyle = 'rgba(125,211,252,0.22)';
  ctx.lineWidth = 1;
  for (let i = -3; i <= 3; i++) {
    ctx.beginPath();
    ctx.moveTo(i * 28 * u, -26 * u);
    ctx.lineTo(i * 24 * u, 32 * u);
    ctx.stroke();
  }
  // lance emitter
  ctx.fillStyle = b.laserState > 0 ? '#7dd3fc' : '#1e3a5f';
  ctx.beginPath();
  ctx.moveTo(-14 * u, 30 * u);
  ctx.lineTo(14 * u, 30 * u);
  ctx.lineTo(9 * u, 46 * u);
  ctx.lineTo(-9 * u, 46 * u);
  ctx.closePath();
  ctx.fill();
  if (b.laserState > 0) drawGlow(ctx, '#7dd3fc', 0, 44 * u, 26 * u, 0.9, true);
  drawCore(ctx, b, u, 19 * u);
}

function drawDevourer(ctx: CanvasRenderingContext2D, b: BossEntity, u: number, color: string) {
  const R = 62 * u;
  // writhing organic shell
  ctx.save();
  ctx.rotate(Math.sin(b.t * 0.5) * 0.12);
  const shell = ctx.createRadialGradient(0, 0, R * 0.2, 0, 0, R);
  shell.addColorStop(0, '#3b0764');
  shell.addColorStop(0.7, '#1e1b4b');
  shell.addColorStop(1, '#0b0716');
  ctx.fillStyle = shell;
  ctx.beginPath();
  const lobes = 9;
  for (let i = 0; i <= lobes; i++) {
    const a = (TAU * i) / lobes;
    const wob = 1 + 0.11 * Math.sin(b.t * 2.2 + i * 1.7);
    const px = Math.cos(a) * R * wob;
    const py = Math.sin(a) * R * 0.78 * wob;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.6;
  ctx.stroke();
  // tendrils
  ctx.strokeStyle = 'rgba(192,132,252,0.4)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 6; i++) {
    const a = (TAU * i) / 6 + b.t * 0.3;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * R * 0.5, Math.sin(a) * R * 0.42);
    ctx.quadraticCurveTo(
      Math.cos(a) * R * 1.1,
      Math.sin(a) * R * 0.9,
      Math.cos(a + 0.4) * R * 1.25,
      Math.sin(a + 0.4) * R * 1.0,
    );
    ctx.stroke();
  }
  ctx.restore();

  // iris shutter over the weak point
  if (b.open) {
    drawCore(ctx, b, u, 22 * u);
    ctx.strokeStyle = 'rgba(74,222,128,0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 2 * u, 30 * u + Math.sin(b.t * 6) * 2 * u, 0, TAU);
    ctx.stroke();
  } else {
    ctx.fillStyle = '#0b0716';
    ctx.beginPath();
    ctx.arc(0, 2 * u, 30 * u, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(148,163,184,0.6)';
    ctx.lineWidth = 2;
    ctx.stroke();
    // shutter blades
    ctx.strokeStyle = 'rgba(203,213,225,0.35)';
    ctx.lineWidth = 1.4;
    for (let i = 0; i < 6; i++) {
      const a = (TAU * i) / 6 + b.t * 0.6;
      ctx.beginPath();
      ctx.moveTo(0, 2 * u);
      ctx.lineTo(Math.cos(a) * 29 * u, 2 * u + Math.sin(a) * 29 * u);
      ctx.stroke();
    }
    drawCore(ctx, b, u, 10 * u, true);
  }
}

function drawCarrier(ctx: CanvasRenderingContext2D, b: BossEntity, u: number, color: string) {
  const hg = ctx.createLinearGradient(0, -36 * u, 0, 40 * u);
  hg.addColorStop(0, '#292524');
  hg.addColorStop(0.5, '#1c1917');
  hg.addColorStop(1, '#0c0a09');
  ctx.fillStyle = hg;
  // slab hull
  ctx.beginPath();
  ctx.moveTo(-110 * u, -12 * u);
  ctx.lineTo(-92 * u, -30 * u);
  ctx.lineTo(92 * u, -30 * u);
  ctx.lineTo(110 * u, -12 * u);
  ctx.lineTo(110 * u, 18 * u);
  ctx.lineTo(64 * u, 38 * u);
  ctx.lineTo(-64 * u, 38 * u);
  ctx.lineTo(-110 * u, 18 * u);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.6;
  ctx.stroke();
  // launch bays
  ctx.fillStyle = '#0a0a0a';
  for (let i = -1; i <= 1; i += 2) {
    ctx.fillRect(i * 34 * u - 16 * u, 20 * u, 32 * u, 14 * u);
  }
  ctx.strokeStyle = 'rgba(251,146,60,0.55)';
  ctx.lineWidth = 1.2;
  for (let i = -1; i <= 1; i += 2) {
    ctx.strokeRect(i * 34 * u - 16 * u, 20 * u, 32 * u, 14 * u);
    const glow = 0.4 + 0.4 * Math.sin(b.t * 4 + i);
    drawGlow(ctx, '#fb923c', i * 34 * u, 27 * u, 16 * u, glow, true);
  }
  // command tower
  ctx.fillStyle = '#1c1917';
  ctx.beginPath();
  ctx.moveTo(-22 * u, -30 * u);
  ctx.lineTo(-14 * u, -48 * u);
  ctx.lineTo(14 * u, -48 * u);
  ctx.lineTo(22 * u, -30 * u);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.stroke();
  drawCore(ctx, b, u, 16 * u, b.shielded);
}
