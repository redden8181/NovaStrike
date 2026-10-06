import {
  ACHIEVEMENT_MAP,
  ENEMIES,
  MILESTONES,
  DAMAGE,
  POWERUPS,
  RANKS,
  ROLLBACK,
  POWERUP_MAP,
  SHIP_MAP,
  TECHS,
  TRACKS,
  VOID_DRIVE_TIERS,
  shipUpgradesOf,
  trackReached,
  trackValue,
  voidDriveBonus,
} from './content';
import type {
  AbilityHud,
  EnemyKind,
  EngineApi,
  GameMode,
  HudState,
  PowerupType,
  RunConfig,
  RunResult,
  ShipId,
  SynergyHud,
  TechId,
} from './types';
import { drawCoinDisc, drawEnemyKind, drawGlow, drawPowerupIcon, drawShip } from './sprites';
import { sfx } from './audio';
import { ABILITIES, AbilityRuntime, type AbilityDef, type AbilityEvents } from './abilities';
import { SYNERGY_MAP, SynergyTracker } from './synergies';
import { MODE_MAP, type ModeDef } from './modes';
import { buildDaily, makeRng, todayKey, type DailyConfig } from './dailyRun';
import { Background } from './background';
import {
  bossForTier,
  bossPhaseLabel,
  bossHitTest,
  bossLaserZone,
  createBoss,
  damageBossCore,
  damageBossTurret,
  renderBoss,
  updateBoss,
  type BossEntity,
  type BossHooks,
} from './bosses';

// ── helpers ─────────────────────────────────────────────────────────────────
const TAU = Math.PI * 2;
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const dist2 = (x1: number, y1: number, x2: number, y2: number) => {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return dx * dx + dy * dy;
};

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
  drag: number;
  grav: number;
}
/** kind: 0 обычный · 1 ракета (самонаведение) · 2 бомба · 3 осколок */
interface PBullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  dmg: number;
  r: number;
  power: boolean;
  kind: number;
  life: number;
  color: string;
}
interface EBullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  color: string;
  homing: number;
  life: number;
}
interface Enemy {
  kind: EnemyKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  hp: number;
  maxHp: number;
  r: number;
  score: number;
  coinMin: number;
  coinMax: number;
  powerChance: number;
  t: number;
  phase: number;
  baseX: number;
  flash: number;
  shootT: number;
  state: number;
  stateT: number;
  aimX: number;
  aimY: number;
}
interface CoinEnt {
  x: number;
  y: number;
  vx: number;
  vy: number;
  t: number;
}
interface PowerEnt {
  x: number;
  y: number;
  vy: number;
  t: number;
  type: PowerupType;
  color: string;
}
interface FloatText {
  x: number;
  y: number;
  t: number;
  max: number;
  text: string;
  color: string;
  size: number;
}
interface Banner {
  text: string;
  sub: string;
  t: number;
  max: number;
  color: string;
}

const EMPTY_TIMERS: Record<PowerupType, number> = {
  rapid: 0,
  double: 0,
  triple: 0,
  shield: 0,
  power: 0,
  magnet: 0,
  repair: 0,
};
const MAX_PARTS = 300;

export class GameEngine {
  private cv: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private api: EngineApi;

  private w = 0;
  private h = 0;
  private u = 1;
  private dpr = 1;
  private dimsCache = { w: 0, h: 0, u: 1 };
  private playerPos = { x: 0, y: 0 };

  private phase: 'menu' | 'intro' | 'playing' | 'dying' | 'over' = 'menu';
  private paused = false;
  private destroyed = false;
  private raf = 0;
  private last = 0;
  private time = 0;
  private shake = 0;
  private hurtFlash = 0;
  private introT = 0;
  private hudT = 0;
  private flushT = 0;

  // background subsystem (cosmetic, fully isolated)
  private bg = new Background();
  private resizeTimer = 0;
  private bgBuilt = false;
  private flashWhite = 0;

  // ── run configuration ──────────────────────────────────────────────────────
  private gameMode: GameMode = 'classic';
  private modeDef: ModeDef = MODE_MAP.classic;
  private daily: DailyConfig | null = null;
  private rng: () => number = Math.random;
  private shipId: ShipId = 'falcon';
  private startCp = 0;
  private scoreMul = 1;
  private coinMul = 1;

  // ── run state ──────────────────────────────────────────────────────────────
  private score = 0;
  private runCoins = 0;
  private runKills = 0;
  private runTime = 0;
  private level = 1;
  private bossesDown = 0;

  private fireRate = 4;
  private damage = 1;
  private streamsBase = 1;
  private maxHp = 100;
  private hp = 100;
  /** снижение урона, % */
  private armor = 0;
  private hitFx = 0;
  // боковые турели
  private turretL = false;
  private turretR = false;
  private turretDmg = 0;
  private turretRate = 1.6;
  private turretStreams = 1;
  private turretT = 0;
  private turretFlash = 0;
  // платный откат угрозы
  private rollbackT = 0;
  private diffOffset = 0;
  private shieldDur = 7;
  private magnetR = 62;
  private magnetRBig = 260;
  private followSpeed = 13;
  private invuln = 0;
  private dyingT = 0;

  private px = 0;
  private py = 0;
  private tx = 0;
  private ty = 0;
  private bank = 0;
  private prevPx = 0;
  private pointerActive = false;
  private pointerId = -1;
  private keys = new Set<string>();

  private fireT = 0;
  private muzzleT = 0;
  private pw: Record<PowerupType, number> = { ...EMPTY_TIMERS };
  private pwMax: Record<PowerupType, number> = { ...EMPTY_TIMERS };
  private rippleT = 0;
  private novaBurstT = 0;

  // systems
  private ability: AbilityRuntime = new AbilityRuntime(ABILITIES.dash);
  private synergy = new SynergyTracker();
  private abilityEvents: AbilityEvents;
  private dashVX = 0;
  private dashVY = 0;
  private beamT = 0;
  // уникальная техника корпуса
  private techId: TechId = 'missiles';
  private techLevel = 0;
  private techT = 0;
  private arcs: { x1: number; y1: number; x2: number; y2: number; life: number; color: string }[] = [];
  private vortex: { x: number; y: number; life: number; max: number; r: number } | null = null;
  private voidStreak = 0;
  private voidBonus = 0;
  private voidMaxFx = 0;
  private voidMaxed = false;

  // entities + free lists (pooling avoids per-frame allocation)
  private pBullets: PBullet[] = [];
  private eBullets: EBullet[] = [];
  private enemies: Enemy[] = [];
  private coinsArr: CoinEnt[] = [];
  private powers: PowerEnt[] = [];
  private parts: Particle[] = [];
  private floats: FloatText[] = [];
  private banners: Banner[] = [];
  private freeParts: Particle[] = [];
  private freePB: PBullet[] = [];
  private freeEB: EBullet[] = [];

  // spawning / bosses
  private spawnT = 1;
  private formationT = 8;
  private levelBannered = 1;
  private boss: BossEntity | null = null;
  private bossTier = 0;
  private nextBoss = 8000;
  private bossWarnT = 0;
  private rushGapT = 0;
  private bossHooks: BossHooks;

  // difficulty cache (recomputed once per frame)
  // level — текущий уровень угрозы, maxEnemies/maxBullets — потолки этого уровня
  private d = {
    c: 0,
    level: 1,
    speed: 1,
    hp: 1,
    interval: 1,
    bullet: 1,
    aggro: 1,
    burst: 1,
    maxEnemies: 7,
    maxBullets: 22,
  };

  // pending persistence
  private pendCoins = 0;
  private pendKills = 0;
  private pendBossKills = 0;
  private pendAch: string[] = [];
  private newCheckpoints: number[] = [];
  private newUnlocks: string[] = [];
  private unlockedAch: string[] = [];

  constructor(canvas: HTMLCanvasElement, api: EngineApi) {
    this.cv = canvas;
    this.api = api;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('no 2d context');
    this.ctx = ctx;

    this.abilityEvents = {
      onStart: (def) => this.onAbilityStart(def),
      onFire: (def) => this.onAbilityFire(def),
      onEnd: (def) => this.onAbilityEnd(def),
      onReady: () => sfx.play('abilityReady'),
    };

    this.bossHooks = {
      bullet: (x, y, vx, vy, r, color, homing) => this.spawnEBullet(x, y, vx, vy, r, color, homing ?? 0),
      spawnMinion: (x, y) => {
        // у босса своя квота: не больше 60% общего потолка, иначе нечем дышать
        if (this.enemies.length < this.d.maxEnemies * 0.6) {
          this.spawnEnemy(this.rng() < 0.35 ? 'diver' : 'scout', x, y);
        }
      },
      player: () => this.playerPos,
      dims: () => this.dimsCache,
      rnd: () => this.rng(),
      sfx: (n) => sfx.play(n),
      shake: (n) => {
        this.shake = Math.min(1, this.shake + n);
      },
      banner: (text, sub, color, dur) => this.pushBanner(text, sub, color, dur),
      explode: (x, y, color, n, power) => this.explode(x, y, color, n, power),
      onPhase: () => this.emitHud(),
    };

    this.resize();
    window.addEventListener('resize', this.resize);
    canvas.addEventListener('pointerdown', this.onDown, { passive: false });
    window.addEventListener('pointermove', this.onMove, { passive: false });
    window.addEventListener('pointerup', this.onUp);
    window.addEventListener('pointercancel', this.onUp);
    window.addEventListener('keydown', this.onKey);
    window.addEventListener('keyup', this.onKeyUp);
    document.addEventListener('visibilitychange', this.onVis);

    this.last = performance.now();
    this.raf = requestAnimationFrame(this.loop);
  }

  destroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.resize);
    this.cv.removeEventListener('pointerdown', this.onDown);
    window.removeEventListener('pointermove', this.onMove);
    window.removeEventListener('pointerup', this.onUp);
    window.removeEventListener('pointercancel', this.onUp);
    window.removeEventListener('keydown', this.onKey);
    window.removeEventListener('keyup', this.onKeyUp);
    document.removeEventListener('visibilitychange', this.onVis);
    window.clearTimeout(this.resizeTimer);
    sfx.stopAmbient();
  }

  // ── sizing ─────────────────────────────────────────────────────────────────
  private resize = () => {
    const parent = this.cv.parentElement;
    const w = parent ? parent.clientWidth : window.innerWidth;
    const h = parent ? parent.clientHeight : window.innerHeight;
    const u = clamp(h / 760, 0.75, 1.3);
    // iOS fires resize for every toolbar flicker — bail out when nothing changed
    if (this.bgBuilt && w === this.w && h === this.h && Math.abs(u - this.u) < 0.001) return;
    this.w = w;
    this.h = h;
    this.u = u;
    this.dimsCache.w = w;
    this.dimsCache.h = h;
    this.dimsCache.u = this.u;
    // devicePixelRatio is applied only up to a hard pixel budget (mobile safety)
    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    const MAXPX = 2_600_000;
    if (w * dpr * (h * dpr) > MAXPX) dpr = Math.max(1, Math.sqrt(MAXPX / (w * h)));
    this.dpr = dpr;
    this.cv.width = Math.round(w * dpr);
    this.cv.height = Math.round(h * dpr);
    this.cv.style.width = `${w}px`;
    this.cv.style.height = `${h}px`;
    // heavy prefab rebuild (nebula layout, vignette) is debounced against resize storms
    window.clearTimeout(this.resizeTimer);
    if (!this.bgBuilt) {
      this.bgBuilt = true;
      this.bg.resize(w, h, this.u);
    } else {
      this.resizeTimer = window.setTimeout(() => this.bg.resize(this.w, this.h, this.u), 180);
    }
    if (this.phase === 'menu' || this.phase === 'over') {
      this.px = w / 2;
      this.py = h * 0.82;
    }
  };

  // ── input ──────────────────────────────────────────────────────────────────
  private onDown = (e: PointerEvent) => {
    if (e.cancelable) e.preventDefault();
    sfx.unlock();
    if (this.phase !== 'playing' || this.paused) return;
    if (this.pointerId !== -1) return;
    this.pointerId = e.pointerId;
    this.pointerActive = true;
    this.setTarget(e.clientX, e.clientY);
  };

  private onMove = (e: PointerEvent) => {
    if (e.pointerId !== this.pointerId) return;
    if (e.cancelable) e.preventDefault();
    if (!this.pointerActive) return;
    this.setTarget(e.clientX, e.clientY);
  };

  private onUp = (e: PointerEvent) => {
    if (e.pointerId === this.pointerId) {
      this.pointerId = -1;
      this.pointerActive = false;
    }
  };

  private setTarget(cx: number, cy: number) {
    const rect = this.cv.getBoundingClientRect();
    const x = cx - rect.left;
    const y = cy - rect.top - 78 * this.u;
    this.tx = clamp(x, 18 * this.u, this.w - 18 * this.u);
    this.ty = clamp(y, this.h * 0.3, this.h * 0.93);
  }

  private onKey = (e: KeyboardEvent) => {
    this.keys.add(e.key);
    if (e.code === 'Space' || e.key === ' ') {
      e.preventDefault();
      this.activateAbility();
    }
  };
  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.key);
  };

  private onVis = () => {
    if (document.hidden) {
      if (this.phase === 'playing' || this.phase === 'intro') this.setPaused(true);
      this.flush(true);
    }
  };

  // ── public API ─────────────────────────────────────────────────────────────
  startRun(config: RunConfig) {
    const save = this.api.getSave();
    this.gameMode = config.mode;
    this.modeDef = MODE_MAP[config.mode];
    this.daily = this.modeDef.seeded ? buildDaily(todayKey()) : null;
    this.rng = this.daily ? makeRng(this.daily.seed) : Math.random;

    this.shipId = save.ship;
    const ship = SHIP_MAP[save.ship] ?? SHIP_MAP.falcon;
    const mods = ship.mods;
    // прокачка берётся у конкретного корпуса — у каждого своя
    const up = shipUpgradesOf(save, save.ship);
    this.techLevel = up.tech;
    this.techId = ship.tech;
    this.techT = 1.4;
    this.arcs.length = 0;
    this.vortex = null;
    this.fireRate = 4.1 * (1 + 0.22 * up.rate) * mods.rate;
    this.damage = 1 * (1 + 0.18 * up.power) * mods.damage;
    this.streamsBase = 1 + up.streams + mods.streams;
    // ── числовое HP вместо «жизней» ──
    this.maxHp = Math.round(mods.hp + 25 * up.hull);
    this.armor = Math.min(DAMAGE.armorCap, mods.armor + 4 * up.armor);
    if (this.modeDef.oneLife || this.daily?.oneHp) {
      this.maxHp = Math.max(10, Math.round(mods.hp * 0.1));
      this.armor = mods.armor;
    }
    this.hp = this.maxHp;
    // боковые турели
    this.turretL = up.turretL > 0;
    this.turretR = up.turretR > 0;
    this.turretDmg = this.damage * (0.34 + 0.2 * up.turretPower);
    this.turretRate = 1.6 * (1 + 0.2 * up.turretRate);
    this.turretStreams = 1 + up.turretStreams;
    this.turretT = 0;
    this.turretFlash = 0;
    this.rollbackT = 0;
    this.diffOffset = 0;
    this.hitFx = 0;
    this.shieldDur = 7 + 1.5 * up.shield;
    this.magnetR = 62 * (1 + 0.5 * up.magnet);
    this.magnetRBig = 260 * (1 + 0.25 * up.magnet);
    this.followSpeed = 13 * mods.speed;
    this.scoreMul = this.modeDef.scoreMul * (this.daily?.scoreMul ?? 1);
    this.coinMul = this.modeDef.coinMul * (this.daily?.coinMul ?? 1);

    this.ability.reset(ABILITIES[ship.ability]);
    this.synergy.reset();

    this.startCp = this.modeDef.allowCheckpoints ? config.startCheckpoint : 0;
    this.score = this.startCp;
    this.runCoins = 0;
    this.runKills = 0;
    this.runTime = 0;
    this.level = 1;
    this.levelBannered = 1;
    this.bossesDown = 0;
    this.invuln = 2;
    this.dyingT = 0;
    this.fireT = 0;
    this.beamT = 0;
    this.novaBurstT = 0;
    this.voidStreak = 0;
    this.voidBonus = 0;
    this.voidMaxFx = 0;
    this.voidMaxed = false;
    this.pw = { ...EMPTY_TIMERS };
    this.pwMax = { ...EMPTY_TIMERS };

    this.releaseAll();
    this.floats.length = 0;
    this.banners.length = 0;

    this.spawnT = 1.2;
    this.formationT = 9;
    this.boss = null;
    this.bossTier = 0;
    this.rushGapT = 0;
    const interval = this.bossInterval();
    this.nextBoss = this.modeDef.bossRush ? Infinity : (Math.floor(this.score / interval) + 1) * interval;
    this.bossWarnT = 0;
    this.pendCoins = 0;
    this.pendKills = 0;
    this.pendBossKills = 0;
    this.pendAch.length = 0;
    this.newCheckpoints.length = 0;
    this.newUnlocks.length = 0;
    this.unlockedAch.length = 0;
    this.shake = 0;
    this.hurtFlash = 0;

    this.px = this.w / 2;
    this.py = this.h + 60;
    this.tx = this.w / 2;
    this.ty = this.h * 0.8;
    this.pointerId = -1;
    this.pointerActive = false;

    this.phase = 'intro';
    this.introT = 1.15;
    this.paused = false;
    sfx.setMuted(save.muted);
    sfx.startAmbient();
    sfx.play(this.gameMode === 'daily' ? 'daily' : 'modeStart');

    this.api.commit((s) => ({ ...s, stats: { ...s.stats, runs: s.stats.runs + 1 } }));

    // daily gift power-up
    if (this.daily?.startPowerup) {
      const p = this.daily.startPowerup;
      this.pw[p] = POWERUP_MAP[p].duration;
      this.pwMax[p] = this.pw[p];
    }

    // opening banner per mode
    if (this.gameMode === 'daily' && this.daily) {
      this.pushBanner('ЕЖЕДНЕВНОЕ ИСПЫТАНИЕ', this.daily.mutators.map((m) => m.name).join(' + '), '#fbbf24', 2.4);
    } else if (this.gameMode === 'hardcore') {
      this.pushBanner('ХАРДКОР', 'ОДНО ПОПАДАНИЕ — ДВОЙНОЙ СЧЁТ', '#ef4444', 2.4);
    } else if (this.gameMode === 'bossrush') {
      this.pushBanner('БОСС-РУШ', 'ЛИНЕЙНЫЕ КОРАБЛИ УЖЕ БЛИЗКО', '#f472b6', 2.2);
    } else if (this.gameMode === 'endless') {
      this.pushBanner('БЕСКОНЕЧНЫЙ', 'БЕЗ ЧЕКПОИНТОВ — МАКСИМУМ СЧЁТА', '#a78bfa', 2.4);
    } else if (this.startCp > 0) {
      this.pushBanner(`ЧЕКПОИНТ ${this.startCp}`, 'УГРОЗА ПОВЫШЕНА — УДАЧИ', '#fbbf24', 2.2);
    } else {
      this.pushBanner('СЕКТОР НОЛЬ', 'ТЯНИ ПАЛЬЦЕМ — ПУШКИ СТРЕЛЯЮТ САМИ', '#22d3ee', 2.4);
    }
    this.emitHud();
  }

  setPaused(p: boolean) {
    if (this.phase !== 'playing' && this.phase !== 'intro') p = false;
    this.paused = p;
    if (p) {
      sfx.stopAmbient();
      this.flush(true);
    } else {
      sfx.startAmbient();
      this.last = performance.now();
    }
    this.emitHud();
  }

  isPaused() {
    return this.paused;
  }

  abortToMenu() {
    this.flush(true);
    this.phase = 'menu';
    this.paused = false;
    this.boss = null;
    this.releaseAll();
    sfx.stopAmbient();
  }

  /** Ability button / Space key. */
  activateAbility() {
    if (this.phase !== 'playing' || this.paused) return;
    if (this.ability.activate(this.abilityEvents)) {
      this.api.commit((s) => ({ ...s, stats: { ...s.stats, abilitiesUsed: s.stats.abilitiesUsed + 1 } }));
      this.emitHud();
    }
  }

  // ── pooling ────────────────────────────────────────────────────────────────
  private releaseAll() {
    for (const p of this.parts) this.freeParts.push(p);
    for (const b of this.pBullets) this.freePB.push(b);
    for (const b of this.eBullets) this.freeEB.push(b);
    this.parts.length = 0;
    this.pBullets.length = 0;
    this.eBullets.length = 0;
    this.enemies.length = 0;
    this.coinsArr.length = 0;
    this.powers.length = 0;
  }

  private addPart(
    x: number,
    y: number,
    vx: number,
    vy: number,
    max: number,
    size: number,
    color: string,
    drag: number,
    grav: number,
  ) {
    let p = this.freeParts.pop();
    if (!p) {
      if (this.parts.length >= MAX_PARTS) {
        p = this.parts.shift()!;
      } else {
        p = { x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, size: 1, color: '#fff', drag: 1, grav: 0 };
      }
    }
    p.x = x;
    p.y = y;
    p.vx = vx;
    p.vy = vy;
    p.life = 0;
    p.max = max;
    p.size = size;
    p.color = color;
    p.drag = drag;
    p.grav = grav;
    this.parts.push(p);
  }

  private addPBullet(
    x: number,
    y: number,
    vx: number,
    vy: number,
    dmg: number,
    r: number,
    power: boolean,
    kind = 0,
    color = '',
  ) {
    if (this.pBullets.length > 180) return;
    const b =
      this.freePB.pop() ?? { x: 0, y: 0, vx: 0, vy: 0, dmg: 0, r: 0, power: false, kind: 0, life: 0, color: '' };
    b.x = x;
    b.y = y;
    b.vx = vx;
    b.vy = vy;
    b.dmg = dmg;
    b.r = r;
    b.power = power;
    b.kind = kind;
    b.life = 0;
    b.color = color || (power ? '#f472b6' : '#67e8f9');
    this.pBullets.push(b);
  }

  private spawnEBullet(x: number, y: number, vx: number, vy: number, r: number, color: string, homing = 0) {
    // потолок пуль текущего уровня — ключевая защита от «залитого» экрана
    if (this.eBullets.length >= this.d.maxBullets) return;
    const b = this.freeEB.pop() ?? { x: 0, y: 0, vx: 0, vy: 0, r: 0, color: '#fff', homing: 0, life: 0 };
    b.x = x;
    b.y = y;
    const bm = this.daily?.bulletSpeed ?? 1;
    b.vx = vx * bm;
    b.vy = vy * bm;
    b.r = r;
    b.color = color;
    b.homing = homing;
    b.life = 0;
    this.eBullets.push(b);
  }

  // ── difficulty ─────────────────────────────────────────────────────────────
  private bossInterval(): number {
    const base = this.modeDef.bossInterval || 8000;
    return Math.max(2500, base * (this.daily?.bossInterval ?? 1));
  }

  /**
   * Единая кривая сложности. `c` — абстрактный «уровень давления»:
   * растёт от счёта и времени, модификаторы режима/дня применяются один раз.
   */
  private updateDiff() {
    const mul = this.modeDef.difficultyMul;
    // прогресс ускоряется на больших счетах, но плавно (sqrt-добавка после 45k)
    const base = this.score / 3000 + this.runTime / 280;
    const late = Math.sqrt(Math.max(0, this.score - 45000) / 14000);
    // diffOffset — купленные откаты угрозы
    const c = Math.max(0, (base + late) * mul - this.diffOffset);
    const d = this.d;
    d.c = c;
    d.level = clamp(1 + Math.floor(c), 1, 20);

    d.speed = (1 + Math.min(1.5, c * 0.14)) * (this.daily?.enemySpeed ?? 1);
    d.hp = (1 + c * 0.34) * (this.daily?.enemyHp ?? 1);
    d.interval = Math.max(0.34, 1.05 - Math.min(c, 12) * 0.058) / (this.daily?.spawnRate ?? 1);
    d.bullet = 1 + Math.min(0.75, c * 0.06);
    d.aggro = Math.min(1.35, 0.3 + c * 0.1);
    d.burst = c > 9 ? 3 : c > 4 ? 2 : 1;

    // ── потолки экрана: растут только с уровнем, поле никогда не «заливает» ──
    const dens = this.daily?.spawnRate ?? 1;
    d.maxEnemies = Math.round(Math.min(26, 6 + d.level * 1.1) * dens);
    d.maxBullets = Math.round(Math.min(96, 14 + d.level * 4.4) * dens);
  }

  // ── main loop ──────────────────────────────────────────────────────────────
  private loop = (now: number) => {
    if (this.destroyed) return;
    this.raf = requestAnimationFrame(this.loop);
    let dt = (now - this.last) / 1000;
    this.last = now;
    dt = clamp(dt, 0, 0.05);
    if (!this.paused) this.update(dt);
    this.render();
  };

  private update(dt: number) {
    this.time += dt;
    const live = this.phase === 'playing' || this.phase === 'intro' || this.phase === 'dying';
    this.updateDiff();
    const bgSpeed = live ? 1 + Math.min(1.5, this.d.c * 0.12) : 0.45;
    this.bg.update(dt, bgSpeed, this.w, this.h, this.u);

    if (!live) {
      this.updateParticles(dt);
      this.updateTexts(dt);
      return;
    }

    if (this.phase === 'dying') {
      this.dyingT += dt;
      if (Math.random() < 0.35) {
        this.explode(
          this.px + (Math.random() * 2 - 1) * 26 * this.u,
          this.py + (Math.random() * 2 - 1) * 20 * this.u,
          Math.random() < 0.5 ? '#fbbf24' : '#fb7185',
          8,
          1,
        );
      }
      this.updateWorld(dt * 0.35, true);
      if (this.dyingT > 1.5) this.endRun();
      return;
    }

    if (this.phase === 'intro') {
      this.introT -= dt;
      this.py = lerp(this.py, this.h * 0.8, 1 - Math.exp(-dt * 4));
      this.emitTrail(dt, 0.7);
      if (this.introT <= 0) {
        this.phase = 'playing';
        if (this.modeDef.bossRush) this.spawnNextBoss();
      }
    }

    this.runTime += dt;
    this.addScore(dt * 9);

    this.updatePlayer(dt);
    this.updateWorld(dt, false);
    this.updateSpawning(dt);
    this.updateBossState(dt);
    this.checkMilestones();

    this.flushT += dt;
    if (this.flushT > 1.2) {
      this.flushT = 0;
      this.flush(false);
      this.checkTracks();
    }
    this.hudT += dt;
    if (this.hudT > 0.1) {
      this.hudT = 0;
      this.emitHud();
    }
  }

  private updateWorld(dt: number, dying: boolean) {
    this.updateBullets(dt, dying);
    this.updateEnemies(dt, dying);
    this.updateTechEffects(dt);
    // «Крепость» непрерывно гасит снаряды, попавшие в поле
    if (this.ability.isActive && this.ability.def.id === 'fortress') {
      if (this.clearBulletsNear(this.px, this.py, 44 * this.u, '#34d399') > 0) sfx.play('shieldHit');
    }
    // луч «Новы» испаряет всё в своей колонне
    if (this.ability.isActive && this.ability.def.id === 'novabeam') {
      for (let i = this.eBullets.length - 1; i >= 0; i--) {
        const b = this.eBullets[i];
        if (b.y > this.py || Math.abs(b.x - this.px) > 20 * this.u) continue;
        this.addPart(b.x, b.y, 0, -120 * this.u, 0.25, 8 * this.u, '#f9a8d4', 1.6, 0);
        this.freeEB.push(b);
        this.eBullets.splice(i, 1);
      }
    }
    this.updatePickups(dt);
    this.updateParticles(dt);
    this.updateTexts(dt);
    this.shake = Math.max(0, this.shake - dt * 1.6);
    this.hurtFlash = Math.max(0, this.hurtFlash - dt * 1.8);
    this.flashWhite = Math.max(0, this.flashWhite - dt * 2.4);
    this.muzzleT = Math.max(0, this.muzzleT - dt);
    this.rippleT = Math.max(0, this.rippleT - dt * 2.6);
    this.voidMaxFx = Math.max(0, this.voidMaxFx - dt * 0.8);
  }

  private addScore(v: number) {
    this.score += v * this.scoreMul;
  }

  // ── abilities ──────────────────────────────────────────────────────────────
  private onAbilityStart(def: AbilityDef) {
    sfx.play(def.charge > 0 ? 'charge' : 'ability');
    if (def.charge === 0) this.shake = Math.min(1, this.shake + 0.2);
  }

  private onAbilityFire(def: AbilityDef) {
    switch (def.id) {
      case 'dash': {
        const dx = this.tx - this.px;
        const dy = this.ty - this.py;
        const len = Math.hypot(dx, dy);
        if (len > 12) {
          this.dashVX = (dx / len) * 900 * this.u;
          this.dashVY = (dy / len) * 900 * this.u;
        } else {
          this.dashVX = 0;
          this.dashVY = -900 * this.u;
        }
        // рывок выжигает всё, что летело в корабль — это спасательный инструмент
        this.clearBulletsNear(this.px, this.py, 190 * this.u, '#22d3ee');
        this.burst(this.px, this.py, '#22d3ee', 22, 300);
        this.shake = Math.min(1, this.shake + 0.3);
        break;
      }
      case 'afterburner':
        this.clearBulletsNear(this.px, this.py, 150 * this.u, '#a78bfa');
        this.burst(this.px, this.py + 14 * this.u, '#a78bfa', 22, 260);
        break;
      case 'fortress':
        this.clearBulletsNear(this.px, this.py, 170 * this.u, '#34d399');
        this.burst(this.px, this.py, '#34d399', 24, 220);
        this.shake = Math.min(1, this.shake + 0.25);
        break;
      case 'novabeam':
        sfx.play('beam');
        this.shake = Math.min(1, this.shake + 0.5);
        this.burst(this.px, this.py - 20 * this.u, '#f472b6', 24, 300);
        break;
      case 'collapse':
        this.voidCollapse();
        break;
    }
  }

  private onAbilityEnd(def: AbilityDef) {
    if (def.id === 'dash') {
      // ударная волна на выходе + запас неуязвимости, чтобы успеть выйти из-под огня
      this.clearBulletsNear(this.px, this.py, 150 * this.u, '#a5f3fc');
      this.burst(this.px, this.py, '#a5f3fc', 20, 260);
      this.invuln = Math.max(this.invuln, 1.5);
      sfx.play('boom');
    }
    this.dashVX = 0;
    this.dashVY = 0;
  }

  /** Сжигает вражеские снаряды в радиусе. Общий помощник для способностей. */
  private clearBulletsNear(x: number, y: number, r: number, color: string): number {
    const r2 = r * r;
    let n = 0;
    for (let i = this.eBullets.length - 1; i >= 0; i--) {
      const b = this.eBullets[i];
      if (dist2(b.x, b.y, x, y) > r2) continue;
      this.addPart(b.x, b.y, b.vx * 0.1, b.vy * 0.1, 0.3, 8 * this.u, color, 1.8, 0);
      this.freeEB.push(b);
      this.eBullets.splice(i, 1);
      n++;
    }
    return n;
  }

  /** VOID COLLAPSE: implode nearby enemy fire into salvage, shred close hostiles. */
  private voidCollapse() {
    const R = 210 * this.u;
    const R2 = R * R;
    sfx.play('voidmax');
    this.shake = Math.min(1, this.shake + 0.55);
    for (let i = this.eBullets.length - 1; i >= 0; i--) {
      const b = this.eBullets[i];
      if (dist2(b.x, b.y, this.px, this.py) < R2) {
        this.spawnCoin(b.x, b.y, 40);
        this.burst(b.x, b.y, '#c084fc', 3, 90);
        this.freeEB.push(b);
        this.eBullets.splice(i, 1);
      }
    }
    const dmg = 26 * this.totalDamage();
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (dist2(e.x, e.y, this.px, this.py) < R2) {
        e.hp -= dmg;
        e.flash = 1;
        if (e.hp <= 0) this.killEnemy(i);
      }
    }
    if (this.boss && this.boss.state === 'fight' && dist2(this.boss.x, this.boss.y, this.px, this.py) < R2 * 1.4) {
      this.damageBoss('core', -1, dmg * 1.5);
    }
    this.explode(this.px, this.py, '#818cf8', 26, 1.6);
  }

  // ── player ─────────────────────────────────────────────────────────────────
  private totalDamage(): number {
    return this.damage * (this.pw.power > 0 ? 2 : 1) * this.synergy.effects().damageMul * this.ability.modifiers().damageMul * (1 + this.voidBonus);
  }

  private updatePlayer(dt: number) {
    if (this.invuln > 0) this.invuln -= dt;

    // power-up timers
    for (const k of Object.keys(this.pw) as PowerupType[]) {
      if (this.pw[k] > 0) {
        this.pw[k] -= dt;
        if (this.pw[k] <= 0) {
          this.pw[k] = 0;
          if (k === 'shield') sfx.play('shieldDown');
        }
      }
    }

    // synergies react to the current cocktail
    const delta = this.synergy.update(this.pw);
    if (delta.gained.length) {
      // capture now — the tracker reuses its buffers next tick
      const gainedCount = delta.gained.length;
      for (const s of delta.gained) {
        this.pushBanner(`СИНЕРГИЯ — ${s.name}`, s.desc.toUpperCase(), s.color, 1.9);
        this.burst(this.px, this.py, s.color, 26, 300);
        this.shake = Math.min(1, this.shake + 0.3);
      }
      sfx.play('synergy');
      this.api.commit((s) => ({
        ...s,
        stats: { ...s.stats, synergiesTriggered: s.stats.synergiesTriggered + gainedCount },
      }));
      this.grantAchievement('synergy');
      this.emitHud();
    }
    if (delta.lost.length) {
      sfx.play('synergyOff');
      this.emitHud();
    }

    this.ability.update(dt, this.abilityEvents);
    const am = this.ability.modifiers();

    // keyboard fallback (desktop)
    const ks = 420 * this.u * dt;
    if (this.keys.has('ArrowLeft') || this.keys.has('a')) this.tx -= ks;
    if (this.keys.has('ArrowRight') || this.keys.has('d')) this.tx += ks;
    if (this.keys.has('ArrowUp') || this.keys.has('w')) this.ty -= ks;
    if (this.keys.has('ArrowDown') || this.keys.has('s')) this.ty += ks;
    this.tx = clamp(this.tx, 18 * this.u, this.w - 18 * this.u);
    this.ty = clamp(this.ty, this.h * 0.3, this.h * 0.93);

    this.prevPx = this.px;
    const speed = this.followSpeed * am.speedMul;
    const k = 1 - Math.exp(-dt * speed);
    const ky = 1 - Math.exp(-dt * speed * 0.8);
    this.px += (this.tx - this.px) * k;
    this.py += (this.ty - this.py) * ky;

    // dash impulse rides on top of the follow motion
    if (this.ability.isActive && this.ability.def.id === 'dash') {
      this.px = clamp(this.px + this.dashVX * dt, 16 * this.u, this.w - 16 * this.u);
      this.py = clamp(this.py + this.dashVY * dt, this.h * 0.16, this.h * 0.95);
      this.addPart(
        this.px,
        this.py + 6 * this.u,
        (Math.random() * 2 - 1) * 30,
        (Math.random() * 2 - 1) * 30,
        0.34,
        16 * this.u,
        '#22d3ee',
        2.4,
        0,
      );
    }

    const vx = dt > 0 ? (this.px - this.prevPx) / dt : 0;
    this.bank = lerp(this.bank, clamp(vx * 0.0011, -0.5, 0.5), clamp(dt * 9, 0, 1));
    this.playerPos.x = this.px;
    this.playerPos.y = this.py;

    const burn = this.ability.isActive && this.ability.def.id === 'afterburner';
    this.emitTrail(dt, (burn ? 1.6 : 0.55) + clamp(Math.abs(vx) / 400, 0, 0.6));

    this.updateFire(dt);
    this.updateTurrets(dt);
    this.updateBeam(dt);
    this.updateNovaBurst(dt);
    this.updateTech(dt);
    if (this.rollbackT > 0) this.rollbackT = Math.max(0, this.rollbackT - dt);
    this.hitFx = Math.max(0, this.hitFx - dt * 2.4);
  }

  // ── уникальная техника корпуса ─────────────────────────────────────────────
  private updateTech(dt: number) {
    if (this.techLevel <= 0 || this.phase !== 'playing') return;
    const def = TECHS[this.techId];
    const lvl = this.techLevel;
    this.techT -= dt;
    if (this.techT > 0) return;
    this.techT = Math.max(0.22, def.interval * (1 - 0.11 * (lvl - 1)));
    switch (this.techId) {
      case 'missiles':
        this.techMissiles(lvl);
        break;
      case 'lightning':
        this.techLightning(lvl);
        break;
      case 'bombs':
        this.techBomb(lvl);
        break;
      case 'drones':
        this.techDrones(lvl);
        break;
      case 'singularity':
        this.techSingularity(lvl);
        break;
    }
  }

  /** FALCON-7 — залп самонаводящихся ракет. */
  private techMissiles(lvl: number) {
    const count = lvl >= 5 ? 3 : lvl >= 3 ? 2 : 1;
    const dmg = this.totalDamage() * (2.6 + 0.9 * lvl);
    for (let i = 0; i < count; i++) {
      const off = (i - (count - 1) / 2) * 16 * this.u;
      this.addPBullet(this.px + off, this.py - 6 * this.u, off * 2.2, -330 * this.u, dmg, 6 * this.u, true, 1, '#67e8f9');
    }
    sfx.play('shoot');
  }

  /** COMET — ЭМИ-разряд: выжигает подлетающие снаряды и бьёт по врагу. */
  private techLightning(lvl: number) {
    const R = (140 + 26 * lvl) * this.u;
    const R2 = R * R;
    let zapped = 0;
    const maxZap = 2 + lvl;
    for (let i = this.eBullets.length - 1; i >= 0 && zapped < maxZap; i--) {
      const b = this.eBullets[i];
      if (dist2(b.x, b.y, this.px, this.py) > R2) continue;
      this.arcs.push({ x1: this.px, y1: this.py, x2: b.x, y2: b.y, life: 0.22, color: '#c4b5fd' });
      this.burst(b.x, b.y, '#a78bfa', 3, 90);
      this.freeEB.push(b);
      this.eBullets.splice(i, 1);
      zapped++;
    }
    // и добивает ближайшего врага
    let best = -1;
    let bestD = R2 * 1.6;
    for (let i = 0; i < this.enemies.length; i++) {
      const d = dist2(this.enemies[i].x, this.enemies[i].y, this.px, this.py);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    if (best >= 0) {
      const e = this.enemies[best];
      this.arcs.push({ x1: this.px, y1: this.py, x2: e.x, y2: e.y, life: 0.26, color: '#ddd6fe' });
      e.hp -= this.totalDamage() * (1.6 + 0.8 * lvl);
      e.flash = 1;
      this.burst(e.x, e.y, '#a78bfa', 5, 120);
      if (e.hp <= 0) this.killEnemy(best);
    }
    if (zapped || best >= 0) sfx.play('shieldHit');
  }

  /** TITAN-IX — осколочная бомба. */
  private techBomb(lvl: number) {
    const dmg = this.totalDamage() * (1.6 + 0.5 * lvl);
    this.addPBullet(this.px, this.py - 14 * this.u, 0, -210 * this.u, dmg, 10 * this.u, true, 2, '#34d399');
  }

  private explodeBomb(x: number, y: number, dmg: number) {
    const lvl = Math.max(1, this.techLevel);
    const R = (90 + 14 * lvl) * this.u;
    const R2 = R * R;
    this.explode(x, y, '#34d399', 22, 1.5);
    this.shake = Math.min(1, this.shake + 0.25);
    sfx.play('bigboom');
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (dist2(e.x, e.y, x, y) > R2) continue;
      e.hp -= dmg * 1.6;
      e.flash = 1;
      if (e.hp <= 0) this.killEnemy(i);
    }
    if (this.boss && this.boss.state === 'fight' && dist2(this.boss.x, this.boss.y, x, y) < R2 * 1.5) {
      this.damageBoss('core', -1, dmg * 1.4);
    }
    const shards = 7 + lvl;
    for (let i = 0; i < shards; i++) {
      const a = (TAU * i) / shards + Math.random() * 0.2;
      this.addPBullet(x, y, Math.cos(a) * 430 * this.u, Math.sin(a) * 430 * this.u, dmg * 0.7, 4.4 * this.u, true, 3, '#6ee7b7');
    }
  }

  /** NOVA-X — орбитальные дроны ведут свой огонь. */
  private techDrones(lvl: number) {
    const dmg = this.totalDamage() * (0.4 + 0.12 * lvl);
    const r = 34 * this.u;
    const a = this.time * 2.2;
    const n = lvl >= 4 ? 3 : 2;
    for (let i = 0; i < n; i++) {
      const ang = a + (TAU * i) / n;
      const dx = this.px + Math.cos(ang) * r;
      const dy = this.py + Math.sin(ang) * r * 0.55;
      this.addPBullet(dx, dy, 0, -700 * this.u, dmg, 3.6 * this.u, false, 0, '#f9a8d4');
    }
  }

  /** VOID-X — микро-сингулярность. */
  private techSingularity(lvl: number) {
    this.vortex = {
      x: clamp(this.px, 60 * this.u, this.w - 60 * this.u),
      y: this.py - 190 * this.u,
      life: 2.6,
      max: 2.6,
      r: (80 + 13 * lvl) * this.u,
    };
    sfx.play('voidmax');
  }

  /** Эффекты техники: дуги молний и воронка. */
  private updateTechEffects(dt: number) {
    for (let i = this.arcs.length - 1; i >= 0; i--) {
      this.arcs[i].life -= dt;
      if (this.arcs[i].life <= 0) this.arcs.splice(i, 1);
    }
    const v = this.vortex;
    if (!v) return;
    v.life -= dt;
    if (v.life <= 0) {
      this.explode(v.x, v.y, '#818cf8', 20, 1.4);
      this.vortex = null;
      return;
    }
    const R2 = v.r * v.r;
    const dmg = this.totalDamage() * (0.8 + 0.3 * this.techLevel) * dt * 6;
    for (let i = this.eBullets.length - 1; i >= 0; i--) {
      const b = this.eBullets[i];
      const dx = v.x - b.x;
      const dy = v.y - b.y;
      const d2 = dx * dx + dy * dy;
      if (d2 > R2 * 2.2) continue;
      const len = Math.sqrt(d2) || 1;
      b.vx += (dx / len) * 900 * dt;
      b.vy += (dy / len) * 900 * dt;
      if (d2 < 300 * this.u) {
        this.spawnCoin(b.x, b.y, 30);
        this.freeEB.push(b);
        this.eBullets.splice(i, 1);
      }
    }
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      const dx = v.x - e.x;
      const dy = v.y - e.y;
      const d2 = dx * dx + dy * dy;
      if (d2 > R2) continue;
      const len = Math.sqrt(d2) || 1;
      e.x += (dx / len) * 60 * dt;
      e.y += (dy / len) * 60 * dt;
      e.hp -= dmg;
      e.flash = 1;
      if (e.hp <= 0) this.killEnemy(i);
    }
    if (Math.random() < dt * 40) {
      const a = Math.random() * TAU;
      this.addPart(
        v.x + Math.cos(a) * v.r,
        v.y + Math.sin(a) * v.r,
        -Math.cos(a) * 160,
        -Math.sin(a) * 160,
        0.4,
        7 * this.u,
        '#818cf8',
        0.6,
        0,
      );
    }
  }

  private emitTrail(dt: number, power: number) {
    if (Math.random() < dt * 90 * power) {
      const burn = this.ability.isActive && this.ability.def.id === 'afterburner';
      this.addPart(
        this.px + (Math.random() * 2 - 1) * 3 * this.u,
        this.py + 16 * this.u,
        (Math.random() * 2 - 1) * 14,
        (60 + Math.random() * 70) * this.u,
        burn ? 0.5 : 0.4,
        (6 + Math.random() * 5) * this.u * power,
        Math.random() < 0.25 ? '#ffffff' : burn ? '#a78bfa' : '#22d3ee',
        0.9,
        0,
      );
    }
  }

  private updateFire(dt: number) {
    if (this.phase !== 'playing') return;
    const syn = this.synergy.effects();
    const am = this.ability.modifiers();
    const rate = this.fireRate * (this.pw.rapid > 0 ? 2.3 : 1) * syn.fireRateMul * am.fireRateMul;
    const interval = 1 / Math.max(0.5, rate);
    this.fireT += dt;
    let guard = 0;
    while (this.fireT >= interval && guard++ < 6) {
      this.fireT -= interval;
      this.fire();
    }
  }

  private fire() {
    const syn = this.synergy.effects();
    let n = this.streamsBase + syn.extraStreams;
    if (this.pw.triple > 0) n += 2;
    else if (this.pw.double > 0) n += 1;
    n = clamp(n, 1, 9);
    const dmg = this.totalDamage();
    const speed = 860 * this.u;
    const powered = this.pw.power > 0 || syn.damageMul > 1.2;
    const size = (powered ? 5.5 : 4) * this.u * syn.bulletScale;
    for (let i = 0; i < n; i++) {
      const off = i - (n - 1) / 2;
      const angle = off * 0.058 * syn.spreadMul;
      this.addPBullet(
        this.px + off * 9 * this.u,
        this.py - 16 * this.u,
        Math.sin(angle) * speed,
        -Math.cos(angle) * speed,
        dmg,
        size,
        powered,
      );
    }
    this.muzzleT = 0.05;
    sfx.play('shoot');
  }

  /** NOVA BURST synergy — periodic radial shockwave. */
  private updateNovaBurst(dt: number) {
    const interval = this.synergy.effects().novaBurst;
    if (!interval) {
      this.novaBurstT = 0;
      return;
    }
    this.novaBurstT += dt;
    if (this.novaBurstT < interval) return;
    this.novaBurstT = 0;
    const n = 14;
    const dmg = this.totalDamage() * 1.4;
    for (let i = 0; i < n; i++) {
      const a = (TAU * i) / n - Math.PI / 2;
      this.addPBullet(this.px, this.py, Math.cos(a) * 540 * this.u, Math.sin(a) * 540 * this.u, dmg, 6 * this.u, true);
    }
    this.burst(this.px, this.py, '#f472b6', 20, 260);
    sfx.play('powerup');
  }

  /** NOVA BEAM ability — continuous lance in front of the ship. */
  private updateBeam(dt: number) {
    const active = this.ability.isActive && this.ability.def.id === 'novabeam';
    if (!active) {
      this.beamT = 0;
      return;
    }
    this.beamT += dt;
    const halfW = 17 * this.u;
    const dps = 150 * this.totalDamage();
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (e.y > this.py || Math.abs(e.x - this.px) > halfW + e.r) continue;
      e.hp -= dps * dt;
      e.flash = 1;
      if (Math.random() < 0.4) this.burst(e.x, e.y, '#f9a8d4', 1, 60);
      if (e.hp <= 0) this.killEnemy(i);
    }
    const b = this.boss;
    if (b && b.state === 'fight' && Math.abs(b.x - this.px) < halfW + b.def.halfW * this.u && b.y < this.py) {
      this.damageBoss('core', -1, dps * dt * 0.8);
    }
    if (Math.random() < dt * 40) {
      this.addPart(this.px + (Math.random() * 2 - 1) * halfW, this.py - Math.random() * this.py, 0, -400 * this.u, 0.3, 10 * this.u, '#f9a8d4', 1, 0);
    }
    this.shake = Math.min(0.5, this.shake + dt * 0.6);
  }

  // ── bullets & collisions ───────────────────────────────────────────────────
  private updateBullets(dt: number, dying: boolean) {
    const pr = 11 * this.u;
    const syn = this.synergy.effects();

    for (let i = this.pBullets.length - 1; i >= 0; i--) {
      const b = this.pBullets[i];
      b.life += dt;
      // ракеты сами доводятся до ближайшей цели
      if (b.kind === 1) {
        let tx = -1;
        let ty = -1;
        let bestD = Infinity;
        for (const e of this.enemies) {
          if (e.y > b.y + 40) continue;
          const d = dist2(b.x, b.y, e.x, e.y);
          if (d < bestD) {
            bestD = d;
            tx = e.x;
            ty = e.y;
          }
        }
        if (tx < 0 && this.boss && this.boss.state === 'fight') {
          tx = this.boss.x;
          ty = this.boss.y;
        }
        if (tx >= 0) {
          const dx = tx - b.x;
          const dy = ty - b.y;
          const len = Math.hypot(dx, dy) || 1;
          const sp = Math.min(900 * this.u, Math.hypot(b.vx, b.vy) + 900 * this.u * dt);
          b.vx = lerp(b.vx, (dx / len) * sp, clamp(dt * 5.5, 0, 1));
          b.vy = lerp(b.vy, (dy / len) * sp, clamp(dt * 5.5, 0, 1));
        } else {
          b.vy -= 500 * this.u * dt;
        }
        if (Math.random() < dt * 50) {
          this.addPart(b.x, b.y, 0, 60 * this.u, 0.28, 7 * this.u, '#67e8f9', 1.4, 0);
        }
      }
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      // бомба детонирует на излёте
      if (b.kind === 2 && (b.life > 1.25 || b.y < this.h * 0.18)) {
        this.explodeBomb(b.x, b.y, b.dmg);
        this.freePB.push(b);
        this.pBullets.splice(i, 1);
        continue;
      }
      if (b.y < -30 || b.y > this.h + 30 || b.x < -30 || b.x > this.w + 30) {
        this.freePB.push(b);
        this.pBullets.splice(i, 1);
        continue;
      }
      if (this.boss && this.boss.state === 'fight' && this.hitBoss(b)) {
        this.freePB.push(b);
        this.pBullets.splice(i, 1);
        continue;
      }
      for (let j = this.enemies.length - 1; j >= 0; j--) {
        const e = this.enemies[j];
        const rr = (e.r + b.r) * (e.r + b.r);
        if (dist2(b.x, b.y, e.x, e.y) < rr) {
          if (b.kind === 2) {
            this.explodeBomb(b.x, b.y, b.dmg);
            this.freePB.push(b);
            this.pBullets.splice(i, 1);
            break;
          }
          e.hp -= b.dmg;
          e.flash = 1;
          this.burst(b.x, b.y, b.kind === 1 ? '#67e8f9' : '#a5f3fc', b.kind === 1 ? 10 : 3, b.kind === 1 ? 180 : 90);
          sfx.play(b.kind === 1 ? 'boom' : 'hit');
          this.freePB.push(b);
          this.pBullets.splice(i, 1);
          if (e.hp <= 0) this.killEnemy(j);
          break;
        }
      }
    }

    for (let i = this.eBullets.length - 1; i >= 0; i--) {
      const b = this.eBullets[i];
      b.life += dt;
      if (b.homing > 0 && b.life < 3) {
        const dx = this.px - b.x;
        const dy = this.py - b.y;
        const len = Math.hypot(dx, dy) || 1;
        const sp = Math.hypot(b.vx, b.vy) || 1;
        b.vx = lerp(b.vx, (dx / len) * sp, clamp(dt * b.homing, 0, 1));
        b.vy = lerp(b.vy, (dy / len) * sp, clamp(dt * b.homing, 0, 1));
      }
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.y > this.h + 40 || b.y < -60 || b.x < -40 || b.x > this.w + 40) {
        this.freeEB.push(b);
        this.eBullets.splice(i, 1);
        continue;
      }
      if (dying) continue;

      const rr = (pr + b.r) * (pr + b.r);
      if (dist2(b.x, b.y, this.px, this.py) < rr) {
        // REFLECTOR synergy turns incoming fire into friendly fire
        if (this.pw.shield > 0 && syn.reflect) {
          this.addPBullet(b.x, b.y - 6 * this.u, b.vx * -0.4, -Math.abs(b.vy) * 1.5 - 200 * this.u, this.totalDamage() * 1.2, 5 * this.u, true);
          this.burst(b.x, b.y, '#22d3ee', 5, 140);
          sfx.play('shieldHit');
          this.rippleT = 1;
          this.freeEB.push(b);
          this.eBullets.splice(i, 1);
          continue;
        }
        if (this.invuln <= 0 && !this.ability.modifiers().invulnerable) {
          this.freeEB.push(b);
          this.eBullets.splice(i, 1);
          this.damagePlayer(DAMAGE.bullet);
        }
      }
    }
  }

  private hitBoss(b: PBullet): boolean {
    const boss = this.boss!;
    const res = bossHitTest(boss, b.x, b.y, b.r, this.u);
    if (res.part === 'none') return false;
    this.burst(b.x, b.y, '#fbcfe8', 3, 80);
    sfx.play('hit');
    this.damageBoss(res.part, res.index, b.dmg);
    return true;
  }

  private damageBoss(part: 'core' | 'turret', index: number, dmg: number) {
    const boss = this.boss;
    if (!boss) return;
    if (part === 'turret') {
      if (damageBossTurret(boss, index, dmg, this.bossHooks)) {
        this.addScore(250);
      this.addFloat(boss.x + boss.turrets[index].ox * this.u, boss.y + boss.turrets[index].oy * this.u, '+250', '#f472b6', 15);
      }
      return;
    }
    const died = damageBossCore(boss, dmg, this.bossHooks);
    if (died) this.startBossDeath();
  }

  /**
   * Единая точка урона по игроку.
   * raw — базовый урон (DAMAGE.*), броня и «Крепость» снижают его,
   * щит поглощает полностью.
   */
  private damagePlayer(raw: number = DAMAGE.bullet) {
    if (this.phase === 'dying') return;
    const am = this.ability.modifiers();
    if (am.invulnerable) return;
    if (this.pw.shield > 0) {
      this.rippleT = 1;
      sfx.play('shieldHit');
      this.shake = Math.min(1, this.shake + 0.15);
      return;
    }
    // броня корпуса + «Крепость»
    const reduction = Math.min(DAMAGE.armorCap, this.armor) / 100;
    let dmg = raw * (1 - reduction) * am.damageTakenMul;
    dmg = Math.max(1, Math.round(dmg));
    this.hp -= dmg;

    // i-frames короче при мелком уроне — иначе броня давала бы двойную выгоду
    this.invuln = raw >= DAMAGE.crash ? 0.85 : 0.5;
    this.hurtFlash = Math.min(1, 0.35 + dmg / Math.max(30, this.maxHp * 0.4));
    this.shake = Math.min(1, this.shake + 0.25 + dmg / 120);
    this.hitFx = 1;
    this.burst(this.px, this.py, '#fb7185', 10, 200);
    this.addFloat(this.px + 18 * this.u, this.py - 24 * this.u, `-${dmg}`, '#fb7185', 13);
    sfx.play('hurt');
    // VOID DRIVE сбрасывается при любом попадании
    this.voidStreak = 0;
    this.voidBonus = 0;
    if (this.hp <= 0) {
      this.hp = 0;
      this.startDeath();
    }
    this.emitHud();
  }

  // ── боковые турели: бьют назад, по тем, кто уже прорвался ─────────────────
  private updateTurrets(dt: number) {
    if (this.phase !== 'playing') return;
    if (!this.turretL && !this.turretR) return;
    this.turretFlash = Math.max(0, this.turretFlash - dt * 6);
    this.turretT -= dt;
    if (this.turretT > 0) return;
    this.turretT = 1 / Math.max(0.3, this.turretRate);

    const sides: number[] = [];
    if (this.turretL) sides.push(-1);
    if (this.turretR) sides.push(1);

    for (const side of sides) {
      const tx = this.px + side * 24 * this.u;
      const ty = this.py + 8 * this.u;
      // ищем цель позади (ниже) корабля
      let bestX = tx + side * 40 * this.u;
      let bestY = this.h + 60;
      let bestD = Infinity;
      for (const e of this.enemies) {
        if (e.y < this.py - 6 * this.u) continue;
        const d = dist2(e.x, e.y, tx, ty);
        if (d < bestD) {
          bestD = d;
          bestX = e.x;
          bestY = e.y;
        }
      }
      const hasTarget = bestD < Infinity;
      const base = hasTarget ? Math.atan2(bestY - ty, bestX - tx) : Math.PI / 2 + side * 0.25;
      const n = this.turretStreams;
      for (let i = 0; i < n; i++) {
        const a = base + (i - (n - 1) / 2) * 0.16;
        this.addPBullet(
          tx,
          ty,
          Math.cos(a) * 620 * this.u,
          Math.sin(a) * 620 * this.u,
          this.turretDmg * (1 + this.voidBonus),
          3.4 * this.u,
          false,
          0,
          '#fbbf24',
        );
      }
    }
    this.turretFlash = 1;
    sfx.play('shoot');
  }

  /** Платная способность: откатывает уровень угрозы на один. */
  rollbackThreat(): boolean {
    if (this.phase !== 'playing' || this.paused) return false;
    if (this.rollbackT > 0) return false;
    const save = this.api.getSave();
    if (save.coins < ROLLBACK.cost) return false;

    this.api.commit((s) => ({ ...s, coins: Math.max(0, s.coins - ROLLBACK.cost) }));
    this.rollbackT = ROLLBACK.cooldown;
    this.diffOffset += 1;
    this.updateDiff();
    this.level = this.d.level;
    this.levelBannered = this.d.level;

    // визуально «сдувает» половину летящих снарядов — эффект должен читаться
    this.clearBulletsNear(this.px, this.py, Math.max(this.w, this.h), '#38bdf8');
    this.pushBanner('УГРОЗА ОТКАЧЕНА', `УРОВЕНЬ ${this.d.level} · −${ROLLBACK.cost} МОНЕТ`, '#38bdf8', 2.2);
    this.explode(this.px, this.py, '#38bdf8', 26, 1.6);
    this.shake = Math.min(1, this.shake + 0.5);
    this.flashWhite = 0.4;
    sfx.play('checkpoint');
    this.emitHud();
    return true;
  }

  private startDeath() {
    this.phase = 'dying';
    this.dyingT = 0;
    this.explode(this.px, this.py, '#22d3ee', 30, 1.8);
    this.explode(this.px, this.py, '#fbbf24', 22, 1.4);
    sfx.play('death');
    sfx.stopAmbient();
  }

  // ── enemies ────────────────────────────────────────────────────────────────
  private updateSpawning(dt: number) {
    if (this.phase !== 'playing') return;
    const d = this.d;

    if (this.modeDef.bossRush) {
      // gauntlet pacing: short breather between capital ships
      if (!this.boss && this.rushGapT > 0) {
        this.rushGapT -= dt;
        if (this.rushGapT <= 0) this.spawnNextBoss();
      }
      return;
    }

    if (this.boss) {
      if (this.boss.state === 'die') return;
      this.spawnT -= dt * 0.35;
    } else {
      this.spawnT -= dt;
    }
    if (this.spawnT <= 0) {
      // при переполнении экрана спавн просто ждёт — волна не копится в очередь
      if (this.enemies.length >= d.maxEnemies) {
        this.spawnT = 0.35;
      } else {
        const room = d.maxEnemies - this.enemies.length;
        const n = Math.min(room, d.burst > 1 && this.rng() < 0.5 ? d.burst : 1);
        for (let i = 0; i < n; i++) this.spawnEnemy(this.pickKind());
        this.spawnT = d.interval * (0.7 + this.rng() * 0.65);
      }
    }
    this.formationT -= dt;
    if (this.formationT <= 0) {
      this.formationT = 7 + this.rng() * 5;
      if (this.score > 350 && !this.boss) this.spawnFormation();
    }

    if (!this.boss && this.bossWarnT <= 0 && this.score >= this.nextBoss) {
      this.bossWarnT = 2.2;
      this.pushBanner('ТРЕВОГА', 'СИГНАТУРА ЛИНЕЙНОГО КОРАБЛЯ', '#ef4444', 2.2);
      sfx.play('warn');
    }
    if (this.bossWarnT > 0) {
      this.bossWarnT -= dt;
      if (this.bossWarnT <= 0) this.spawnNextBoss();
    }
  }

  private pickKind(): EnemyKind {
    const s = this.score;
    const ramp = (a: number, b: number) => clamp((s - a) / (b - a), 0, 1);
    const w0 = 10;
    const w1 = 6 * ramp(250, 1200);
    const w2 = 5 * ramp(700, 1800);
    const w3 = 4.2 * ramp(2400, 4200);
    const w4 = 3.2 * ramp(4200, 6500);
    const total = w0 + w1 + w2 + w3 + w4;
    let roll = this.rng() * total;
    if ((roll -= w0) <= 0) return 'scout';
    if ((roll -= w1) <= 0) return 'weaver';
    if ((roll -= w2) <= 0) return 'gunner';
    if ((roll -= w3) <= 0) return 'diver';
    return 'tank';
  }

  private spawnEnemy(kind: EnemyKind, x?: number, y?: number) {
    if (this.enemies.length >= this.d.maxEnemies) return;
    const def = ENEMIES[kind];
    const d = this.d;
    const ex = x ?? 28 + this.rng() * (this.w - 56);
    this.enemies.push({
      kind,
      x: ex,
      y: y ?? -def.r * 2 - this.rng() * 40,
      vx: 0,
      vy: def.speed * this.u * d.speed,
      hp: def.hp * d.hp,
      maxHp: def.hp * d.hp,
      r: def.r * this.u,
      score: def.score,
      coinMin: def.coins[0],
      coinMax: def.coins[1],
      powerChance: def.powerChance,
      t: this.rng() * 10,
      phase: this.rng() * TAU,
      baseX: ex,
      flash: 0,
      shootT: 1 + this.rng() * 1.4,
      state: 0,
      stateT: 0,
      aimX: 0,
      aimY: 0,
    });
  }

  private spawnFormation() {
    const room = this.d.maxEnemies - this.enemies.length;
    if (room < 3) return;
    const x0 = this.w * (0.25 + this.rng() * 0.5);
    const n = Math.min(room, 3 + Math.floor(this.rng() * 3));
    for (let i = 0; i < n; i++) {
      const x = x0 + (i - (n - 1) / 2) * 44 * this.u;
      if (x < 26 || x > this.w - 26) continue;
      this.spawnEnemy('scout', x, -40 - Math.abs(i - (n - 1) / 2) * 26);
    }
  }

  private updateEnemies(dt: number, dying: boolean) {
    const d = this.d;
    const pr = 11 * this.u;
    const phasing = this.ability.modifiers().phasing;
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      e.t += dt;
      e.flash = Math.max(0, e.flash - dt * 6);

      switch (e.kind) {
        case 'scout': {
          e.y += e.vy * dt;
          e.x = e.baseX + Math.sin(e.t * 2 + e.phase) * 22 * this.u;
          e.shootT -= dt * d.aggro;
          if (e.shootT <= 0 && e.y > 0 && e.y < this.h * 0.5 && this.score > 900) {
            e.shootT = 2.4 + this.rng() * 1.2;
            this.enemyShoot(e, 165, '#fb7185', 1);
          }
          break;
        }
        case 'weaver': {
          e.y += e.vy * dt;
          e.x = e.baseX + Math.sin(e.t * 2.4 + e.phase) * 62 * this.u;
          e.shootT -= dt * d.aggro;
          if (e.shootT <= 0 && e.y > 0 && e.y < this.h * 0.55) {
            e.shootT = 2.2 + this.rng();
            this.enemyShoot(e, 180, '#c084fc', 1);
          }
          break;
        }
        case 'gunner': {
          const anchor = this.h * (0.18 + 0.1 * Math.sin(e.phase));
          if (e.y < anchor) e.y += e.vy * dt;
          else {
            e.y += e.vy * 0.22 * dt;
            e.x = e.baseX + Math.sin(e.t * 0.9 + e.phase) * 70 * this.u;
          }
          e.shootT -= dt * d.aggro;
          if (e.shootT <= 0 && e.y > 0) {
            e.shootT = 1.7 + this.rng() * 0.9;
            this.enemyShoot(e, 195, '#fb923c', d.c > 3 ? 3 : 1);
          }
          break;
        }
        case 'diver': {
          e.stateT += dt;
          if (e.state === 0) {
            e.y += e.vy * dt;
            if (e.stateT > 0.75) {
              e.state = 1;
              e.stateT = 0;
              e.aimX = this.px;
              e.aimY = this.py;
            }
          } else if (e.state === 1) {
            e.y += e.vy * 0.25 * dt;
            e.aimX = lerp(e.aimX, this.px, dt * 2);
            e.aimY = lerp(e.aimY, this.py, dt * 2);
            if (e.stateT > 0.55) {
              e.state = 2;
              const dx = e.aimX - e.x;
              const dy = e.aimY - e.y;
              const len = Math.hypot(dx, dy) || 1;
              const sp = 380 * this.u * clamp(d.speed, 1, 1.7);
              e.vx = (dx / len) * sp;
              e.vy = (dy / len) * sp;
            }
          } else {
            e.x += e.vx * dt;
            e.y += e.vy * dt;
          }
          break;
        }
        case 'tank': {
          e.y += e.vy * dt;
          e.x = e.baseX + Math.sin(e.t * 1.1 + e.phase) * 16 * this.u;
          if (d.c > 1.6) {
            e.shootT -= dt * d.aggro;
            if (e.shootT <= 0 && e.y > 0) {
              e.shootT = 2.4 + this.rng();
              this.enemyShoot(e, 150, '#dc2626', 3);
            }
          }
          break;
        }
      }

      if (!dying && e.y > -10) {
        const rr = (e.r * 0.85 + pr) ** 2;
        if (dist2(e.x, e.y, this.px, this.py) < rr) {
          if (phasing) {
            // dashing straight through hostiles
            this.burst(e.x, e.y, '#22d3ee', 6, 160);
            this.killEnemy(i, true);
            continue;
          }
          if (this.pw.shield > 0) {
            this.rippleT = 1;
            sfx.play('shieldHit');
            this.killEnemy(i, true);
            continue;
          }
          if (this.invuln <= 0) {
            this.explode(e.x, e.y, '#fb7185', 12, 1);
            this.enemies.splice(i, 1);
            this.pendKills += 1;
            this.runKills += 1;
            this.damagePlayer(DAMAGE.crash);
            continue;
          }
        }
      }

      if (e.y > this.h + 70 || e.x < -90 || e.x > this.w + 90) this.enemies.splice(i, 1);
    }
  }

  private enemyShoot(e: Enemy, speed: number, color: string, fan: number) {
    const sp = speed * this.u * this.d.bullet;
    const base = Math.atan2(this.py - e.y, this.px - e.x);
    for (let i = 0; i < fan; i++) {
      const off = fan > 1 ? (i - (fan - 1) / 2) * 0.28 : 0;
      const a = base + off;
      this.spawnEBullet(e.x, e.y + e.r * 0.6, Math.cos(a) * sp, Math.sin(a) * sp, 4.6 * this.u, color);
    }
  }

  private killEnemy(idx: number, silent = false) {
    const e = this.enemies[idx];
    this.enemies.splice(idx, 1);
    this.runKills += 1;
    this.pendKills += 1;
    this.addScore(e.score);
    this.bumpVoidDrive();
    const big = e.kind === 'tank';
    this.explode(e.x, e.y, big ? '#fbbf24' : '#fb7185', big ? 26 : 14, big ? 1.5 : 1);
    if (!silent) sfx.play(big ? 'bigboom' : 'boom');
    if (big) this.shake = Math.min(1, this.shake + 0.3);
    this.addFloat(e.x, e.y, `+${Math.round(e.score * this.scoreMul)}`, '#fda4af', 13);
    const n = e.coinMin + Math.floor(this.rng() * (e.coinMax - e.coinMin + 1));
    for (let i = 0; i < n; i++) this.spawnCoin(e.x + (this.rng() * 16 - 8), e.y + (this.rng() * 12 - 4), 60 + this.rng() * 90);
    if (this.rng() < e.powerChance) this.dropPowerup(e.x, e.y);
  }

  /** VOID-X passive: damage grows while the pilot stays untouched. */
  private bumpVoidDrive() {
    const ship = SHIP_MAP[this.shipId];
    if (!ship?.voidDrive) return;
    this.voidStreak += 1;
    const next = voidDriveBonus(this.voidStreak);
    if (next > this.voidBonus) {
      this.voidBonus = next;
      const maxTier = VOID_DRIVE_TIERS[VOID_DRIVE_TIERS.length - 1];
      const maxed = this.voidStreak >= maxTier.kills;
      this.pushBanner(
        maxed ? 'ДВИГАТЕЛЬ БЕЗДНЫ — МАКСИМУМ' : `ДВИГАТЕЛЬ БЕЗДНЫ +${Math.round(next * 100)}%`,
        maxed ? 'БЕЗДНА ОТВЕЧАЕТ' : 'ДЕРЖИСЬ НЕТРОНУТЫМ',
        '#818cf8',
        1.5,
      );
      this.burst(this.px, this.py, '#818cf8', maxed ? 30 : 16, maxed ? 320 : 200);
      sfx.play(maxed ? 'voidmax' : 'powerup');
      if (maxed && !this.voidMaxed) {
        this.voidMaxed = true;
        this.voidMaxFx = 1;
        this.grantAchievement('voidmax');
      }
      this.emitHud();
    }
  }

  // ── boss lifecycle ─────────────────────────────────────────────────────────
  private spawnNextBoss() {
    this.bossTier += 1;
    const tier = this.modeDef.bossRush ? this.bossTier : Math.max(1, Math.floor(this.nextBoss / this.bossInterval()));
    const id = bossForTier(this.modeDef.bossRush ? this.bossTier : tier);
    const hpScale = clamp(this.d.hp, 1, 2.4) * this.modeDef.difficultyMul * (this.modeDef.bossRush ? 1 + 0.12 * (this.bossTier - 1) : 1);
    this.boss = createBoss(id, tier, hpScale, this.w, this.h, this.u, this.rng);
    this.pushBanner(this.boss.name, this.boss.def.subtitle, this.boss.def.color, 2.6);
    sfx.play('warn');
    this.emitHud();
  }

  private startBossDeath() {
    // death animation is driven by updateBoss; award happens on completion
    this.shake = Math.min(1, this.shake + 0.6);
  }

  private updateBossState(dt: number) {
    const b = this.boss;
    if (!b) return;
    updateBoss(b, dt, this.bossHooks);

    // lance contact damage
    const zone = bossLaserZone(b, this.u);
    if (zone && this.phase === 'playing' && Math.abs(this.px - zone.x) < zone.halfW + 10 * this.u && this.py > b.y) {
      // лазер жжёт непрерывно — урон за секунду, а не разовый
      if (this.invuln <= 0 && !this.ability.modifiers().invulnerable) this.damagePlayer(DAMAGE.laserPerSec * dt);
    }

    // ramming the hull
    if (b.state === 'fight' && this.invuln <= 0 && this.pw.shield <= 0 && !this.ability.modifiers().invulnerable) {
      if (Math.abs(this.px - b.x) < b.def.halfW * this.u * 0.8 && Math.abs(this.py - b.y) < 42 * this.u) {
        this.damagePlayer(DAMAGE.bossCrash);
      }
    }

    if (b.state === 'die' && b.dieT > 1.5) this.finishBossDeath(b);
  }

  private finishBossDeath(b: BossEntity) {
    this.boss = null;
    this.flashWhite = 0.65;
    // convert leftover enemy fire into harmless sparks — clean handoff, no strays
    for (let i = this.eBullets.length - 1; i >= 0; i--) {
      const bl = this.eBullets[i];
      this.addPart(bl.x, bl.y, bl.vx * 0.08, bl.vy * 0.08, 0.35, 9 * this.u, bl.color, 1.8, 0);
      this.freeEB.push(bl);
      this.eBullets.splice(i, 1);
    }
    const bonus = 1500 + 500 * (b.tier - 1);
    this.addScore(bonus);
    this.addFloat(b.x, b.y, `+${Math.round(bonus * this.scoreMul)}`, '#f472b6', 20);
    this.explode(b.x, b.y, '#ffffff', 40, 2.2);
    this.explode(b.x, b.y, b.def.color, 34, 1.8);
    this.shake = 1;
    sfx.play('bigboom');
    const total = 18 + 6 * b.tier;
    for (let i = 0; i < total; i++) {
      this.spawnCoin(b.x + (this.rng() * 80 - 40) * this.u, b.y + (this.rng() * 50 - 20) * this.u, 120 + this.rng() * 140);
    }
    this.dropPowerup(b.x, b.y - 10);
    this.bossesDown += 1;
    this.pendBossKills += 1;
    this.grantAchievement('boss1');

    if (this.modeDef.bossRush) {
      // gauntlet: repair, reward, next wave
      if (this.hp < this.maxHp) {
        const heal = Math.max(10, Math.round(this.maxHp * 0.4));
        const before = this.hp;
        this.hp = Math.min(this.maxHp, this.hp + heal);
        this.addFloat(this.px, this.py - 30 * this.u, `+${Math.round(this.hp - before)} HP`, '#4ade80', 14);
      }
      this.dropPowerup(this.px + 40 * this.u, this.h * 0.3);
      this.rushGapT = 3.2;
      this.pushBanner(`${this.bossesDown} СБИТО`, 'РЕМОНТ — СЛЕДУЮЩИЙ ЛИНКОР УЖЕ ИДЁТ', '#4ade80', 2.4);
      if (this.bossesDown >= 5) this.grantAchievement('bossrush5');
      this.api.commit((s) =>
        this.bossesDown > s.stats.bossRushBest ? { ...s, stats: { ...s.stats, bossRushBest: this.bossesDown } } : s,
      );
    } else {
      this.nextBoss = this.score + this.bossInterval();
      this.pushBanner('ЛИНЕЙНЫЙ КОРАБЛЬ УНИЧТОЖЕН', `+${Math.round(bonus * this.scoreMul)} ОЧКОВ — ДОБЫЧА ЗАБРАНА`, '#4ade80', 2.6);
    }
    this.emitHud();
  }

  // ── pickups ────────────────────────────────────────────────────────────────
  private spawnCoin(x: number, y: number, force: number) {
    if (this.coinsArr.length > 160) return;
    const a = -Math.PI * (0.15 + this.rng() * 0.7);
    this.coinsArr.push({ x, y, vx: Math.cos(a) * force, vy: Math.sin(a) * force, t: this.rng() * TAU });
  }

  private dropPowerup(x: number, y: number) {
    // ремонт выпадает только при повреждённом корпусе — и тем чаще, чем хуже дела
    const hurt = this.maxHp - this.hp;
    const weightOf = (p: (typeof POWERUPS)[number]) =>
      p.id === 'repair' ? (hurt > 0 ? p.weight * (1 + hurt) : 0) : p.weight;
    let total = 0;
    for (const p of POWERUPS) if (p.minScore <= this.score) total += weightOf(p);
    let roll = this.rng() * total;
    let def = POWERUPS[0];
    for (const p of POWERUPS) {
      if (p.minScore > this.score) continue;
      roll -= weightOf(p);
      if (roll <= 0) {
        def = p;
        break;
      }
    }
    this.powers.push({
      x: clamp(x, 30, this.w - 30),
      y,
      vy: 62 * this.u,
      t: this.rng() * TAU,
      type: def.id,
      color: def.color,
    });
  }

  private updatePickups(dt: number) {
    const syn = this.synergy.effects();
    const magnetActive = this.pw.magnet > 0;
    const mr = (magnetActive ? this.magnetRBig : this.magnetR) * this.u * syn.magnetMul;
    const mr2 = mr * mr;
    for (let i = this.coinsArr.length - 1; i >= 0; i--) {
      const c = this.coinsArr[i];
      c.t += dt * 6;
      c.vy = lerp(c.vy, 46 * this.u, dt * 1.4);
      const dx = this.px - c.x;
      const dy = this.py - c.y;
      const dSq = dx * dx + dy * dy;
      if (dSq < mr2 && this.phase !== 'dying') {
        const dlen = Math.sqrt(dSq) || 1;
        const pull = (magnetActive ? 1900 : 1050) * (1 - dlen / (mr * 1.15));
        c.vx += (dx / dlen) * pull * dt;
        c.vy += (dy / dlen) * pull * dt;
      }
      c.vx *= 1 - 1.4 * dt;
      c.vy *= 1 - 0.5 * dt;
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      if (dSq < 26 * 26 * this.u * this.u && this.phase !== 'dying') {
        this.coinsArr.splice(i, 1);
        this.collectCoin(c.x, c.y);
        continue;
      }
      if (c.y > this.h + 40) this.coinsArr.splice(i, 1);
    }

    for (let i = this.powers.length - 1; i >= 0; i--) {
      const p = this.powers[i];
      p.t += dt;
      p.y += p.vy * dt;
      p.x += Math.sin(p.t * 2.2) * 14 * dt;
      if (p.y > this.h + 40) {
        this.powers.splice(i, 1);
        continue;
      }
      if (this.phase !== 'dying' && dist2(p.x, p.y, this.px, this.py) < (30 * this.u) ** 2) {
        this.powers.splice(i, 1);
        this.applyPowerup(p);
      }
    }
  }

  private collectCoin(x: number, y: number) {
    const value = Math.max(1, Math.round(this.coinMul * this.synergy.effects().coinValueMul));
    this.runCoins += value;
    this.pendCoins += value;
    this.addScore(5 * value);
    this.burst(x, y, '#fbbf24', 5, 120);
    sfx.play('coin');
  }

  private applyPowerup(p: PowerEnt) {
    const def = POWERUP_MAP[p.type];
    // мгновенный ремонт корпуса
    if (def.instant) {
      if (this.hp < this.maxHp) {
        // чинит 35% запаса прочности
        const heal = Math.max(10, Math.round(this.maxHp * 0.35));
        const before = this.hp;
        this.hp = Math.min(this.maxHp, this.hp + heal);
        this.addFloat(p.x, p.y, `+${Math.round(this.hp - before)} HP`, '#4ade80', 15);
        this.pushBanner('РЕМОНТ КОРПУСА', 'ЦЕЛОСТНОСТЬ ВОССТАНОВЛЕНА', '#4ade80', 1.4);
      } else {
        this.addScore(250);
        this.addFloat(p.x, p.y, '+250', '#4ade80', 14);
      }
      this.burst(p.x, p.y, '#4ade80', 20, 220);
      this.rippleT = 1;
      sfx.play('powerup');
      this.emitHud();
      return;
    }
    const dur = p.type === 'shield' ? this.shieldDur : def.duration;
    this.pw[p.type] = dur;
    this.pwMax[p.type] = dur;
    this.addScore(25);
    if (p.type === 'shield') this.rippleT = 1;
    this.pushBanner(def.name, 'ВРЕМЕННОЕ УСИЛЕНИЕ ОНЛАЙН', p.color, 1.5);
    this.addFloat(p.x, p.y, '+25', p.color, 12);
    this.burst(p.x, p.y, p.color, 16, 200);
    sfx.play('powerup');
    this.emitHud();
  }

  // ── particles / text ───────────────────────────────────────────────────────
  private burst(x: number, y: number, color: string, n: number, speed: number) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU;
      const sp = (speed * 0.3 + Math.random() * speed * 0.7) * this.u;
      this.addPart(x, y, Math.cos(a) * sp, Math.sin(a) * sp, 0.2 + Math.random() * 0.25, (3 + Math.random() * 4) * this.u, color, 2.6, 0);
    }
  }

  private explode(x: number, y: number, color: string, n: number, power: number) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU;
      const sp = (30 + Math.random() * 160 * power) * this.u;
      this.addPart(
        x + (Math.random() * 8 - 4),
        y + (Math.random() * 8 - 4),
        Math.cos(a) * sp,
        Math.sin(a) * sp,
        (0.35 + Math.random() * 0.55) * power,
        (5 + Math.random() * 8) * this.u * power,
        Math.random() < 0.3 ? '#ffffff' : color,
        1.9,
        40,
      );
    }
  }

  private updateParticles(dt: number) {
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.life += dt;
      if (p.life >= p.max) {
        this.freeParts.push(p);
        this.parts.splice(i, 1);
        continue;
      }
      p.vx *= 1 - p.drag * dt;
      p.vy *= 1 - p.drag * dt;
      p.vy += p.grav * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
  }

  private addFloat(x: number, y: number, text: string, color: string, size: number) {
    if (this.floats.length > 24) this.floats.shift();
    this.floats.push({ x, y, t: 0, max: 1.1, text, color, size });
  }

  private pushBanner(text: string, sub: string, color: string, max: number) {
    if (this.banners.length > 2) this.banners.length = 2;
    this.banners.push({ text, sub, t: 0, max, color });
  }

  private updateTexts(dt: number) {
    for (let i = this.floats.length - 1; i >= 0; i--) {
      const f = this.floats[i];
      f.t += dt;
      f.y -= 34 * this.u * dt;
      if (f.t >= f.max) this.floats.splice(i, 1);
    }
    if (this.banners.length) {
      const b = this.banners[0];
      b.t += dt;
      if (b.t >= b.max) this.banners.shift();
    }
  }

  // ── milestones / achievements / persistence ────────────────────────────────
  private checkMilestones() {
    const save = this.api.getSave();
    for (const m of MILESTONES) {
      // local guard as well: the React save mirror updates a frame or two later
      if (this.score < m.score || save.checkpoints.includes(m.score) || this.newCheckpoints.includes(m.score)) continue;
      this.newCheckpoints.push(m.score);
      if (m.unlock && !this.newUnlocks.includes(m.unlock)) this.newUnlocks.push(m.unlock);
      const unlockId = m.unlock;
      this.api.commit((s) => {
        if (s.checkpoints.includes(m.score)) return s;
        const unlocks = unlockId && !s.unlocks.includes(unlockId) ? [...s.unlocks, unlockId] : s.unlocks;
        const shipsOwned =
          unlockId === 'ship:voidx' && !s.shipsOwned.includes('voidx') ? [...s.shipsOwned, 'voidx' as ShipId] : s.shipsOwned;
        return {
          ...s,
          coins: s.coins + m.coins,
          checkpoints: [...s.checkpoints, m.score].sort((a, b) => a - b),
          unlocks,
          shipsOwned,
        };
      });
      this.pushBanner(`РАНГ: ${m.name}`, `${m.detail.toUpperCase()} · +${m.coins} МОНЕТ`, m.color, 2.6);
      sfx.play('checkpoint');
      this.burst(this.px, this.py - 40 * this.u, m.color, 22, 260);
    }

    const lvl = this.d.level;
    if (lvl > this.level) {
      this.level = lvl;
      if (lvl > this.levelBannered && lvl <= 10) {
        this.levelBannered = lvl;
        this.pushBanner(`УРОВЕНЬ УГРОЗЫ ${lvl}`, 'ПЛОТНОСТЬ ПРОТИВНИКА РАСТЁТ', '#fb923c', 1.5);
      }
    }
    this.checkAchievements();
  }

  /**
   * Треки наград: каждая ячейка растёт по рангам (бронза → бездна).
   * Трек «score» не платит отдельно — его ступени уже оплачены вехами.
   */
  private checkTracks() {
    const save = this.api.getSave();
    for (const def of TRACKS) {
      if (def.id === 'score') continue;
      const have = save.tracks[def.id] ?? 0;
      const reached = trackReached(def, trackValue(def, save));
      if (reached <= have) continue;
      let coins = 0;
      for (let i = have; i < reached; i++) coins += def.coins[i] ?? 0;
      const rankName = RANKS[Math.min(RANKS.length - 1, reached - 1)].name;
      const color = RANKS[Math.min(RANKS.length - 1, reached - 1)].color;
      this.api.commit((s) => ({
        ...s,
        coins: s.coins + coins,
        tracks: { ...s.tracks, [def.id]: reached },
      }));
      this.pushBanner(`${def.name} — ${rankName}`, `+${coins} МОНЕТ`, color, 2.2);
      sfx.play('checkpoint');
    }
  }

  private grantAchievement(id: string) {
    if (this.unlockedAch.includes(id)) return;
    if (this.api.getSave().achievements.includes(id)) return;
    this.unlockedAch.push(id);
    this.pendAch.push(id);
    const def = ACHIEVEMENT_MAP[id];
    if (def) {
      this.pushBanner(`НАГРАДА — ${def.name}`, `+${def.reward} МОНЕТ`, '#fbbf24', 2.2);
      sfx.play('checkpoint');
    }
    this.flush(true);
  }

  private checkAchievements() {
    const save = this.api.getSave();
    const kills = save.stats.kills + this.pendKills;
    const totalCoins = save.stats.totalCoins + this.pendCoins;
    if (kills >= 100) this.grantAchievement('kills100');
    if (totalCoins >= 500) this.grantAchievement('coins500');
    if (this.runTime >= 300) this.grantAchievement('survive300');
    if (this.score >= 10000) this.grantAchievement('score10k');
    if (this.gameMode === 'hardcore' && this.score >= 10000) this.grantAchievement('hardcore10k');
  }

  private flush(force: boolean) {
    if (!force && !this.pendCoins && !this.pendKills) return;
    const dCoins = this.pendCoins;
    const dKills = this.pendKills;
    const dBoss = this.pendBossKills;
    const ach = this.pendAch.slice();
    const newBest = Math.floor(this.score) > this.api.getSave().best ? Math.floor(this.score) : 0;
    this.pendCoins = 0;
    this.pendKills = 0;
    this.pendBossKills = 0;
    this.pendAch.length = 0;
    let reward = 0;
    for (const id of ach) reward += ACHIEVEMENT_MAP[id]?.reward ?? 0;
    if (!dCoins && !dKills && !ach.length && !newBest && !dBoss) {
      this.emitHud();
      return;
    }
    this.api.commit((s) => {
      const achievements = s.achievements.slice();
      for (const id of ach) if (!achievements.includes(id)) achievements.push(id);
      return {
        ...s,
        best: Math.max(s.best, newBest || 0),
        coins: s.coins + dCoins + reward,
        achievements,
        stats: {
          ...s.stats,
          kills: s.stats.kills + dKills,
          totalCoins: s.stats.totalCoins + dCoins,
          bossKills: s.stats.bossKills + dBoss,
        },
      };
    });
    this.emitHud();
  }

  private endRun() {
    if (this.gameMode === 'daily') this.grantAchievement('daily');
    this.checkAchievements();

    const finalScore = Math.floor(this.score);
    const save = this.api.getSave();
    const newBest = finalScore > save.best;
    const dCoins = this.pendCoins;
    const dKills = this.pendKills;
    const dBoss = this.pendBossKills;
    const lateAch = this.pendAch.slice();
    this.pendCoins = 0;
    this.pendKills = 0;
    this.pendBossKills = 0;
    this.pendAch.length = 0;
    let reward = 0;
    for (const id of lateAch) reward += ACHIEVEMENT_MAP[id]?.reward ?? 0;

    const mode = this.gameMode;
    const bossesDown = this.bossesDown;
    const runTime = Math.floor(this.runTime);
    const dailyKey = this.daily?.key ?? todayKey();

    this.api.commit((s) => {
      const modeBest = Math.max(s.bestByMode[mode] ?? 0, finalScore);
      const daily =
        mode === 'daily'
          ? {
              date: dailyKey,
              best: Math.max(s.daily.date === dailyKey ? s.daily.best : 0, finalScore),
              runs: (s.daily.date === dailyKey ? s.daily.runs : 0) + 1,
              lastScore: finalScore,
            }
          : s.daily;
      return {
        ...s,
        best: Math.max(s.best, finalScore),
        coins: s.coins + dCoins + reward,
        achievements: [...new Set([...s.achievements, ...this.unlockedAch])],
        bestByMode: { ...s.bestByMode, [mode]: modeBest },
        daily,
        stats: {
          ...s.stats,
          kills: s.stats.kills + dKills,
          totalCoins: s.stats.totalCoins + dCoins,
          bossKills: s.stats.bossKills + dBoss,
          bestTime: Math.max(s.stats.bestTime, runTime),
          bossRushBest: mode === 'bossrush' ? Math.max(s.stats.bossRushBest, bossesDown) : s.stats.bossRushBest,
          hardcoreBest: mode === 'hardcore' ? Math.max(s.stats.hardcoreBest, finalScore) : s.stats.hardcoreBest,
        },
      };
    });

    const after = this.api.getSave();
    const result: RunResult = {
      mode,
      modeLabel: this.modeDef.name,
      score: finalScore,
      best: Math.max(save.best, finalScore),
      newBest,
      coins: this.runCoins,
      kills: this.runKills,
      time: runTime,
      level: this.level,
      startCheckpoint: this.startCp,
      newCheckpoints: this.newCheckpoints.slice(),
      newUnlocks: this.newUnlocks.slice(),
      newAchievements: this.unlockedAch.slice(),
      bossKills: bossesDown,
      dailyBest: mode === 'daily' ? after.daily.best : undefined,
    };
    this.phase = 'over';
    sfx.stopAmbient();
    this.api.onGameOver(result);
    this.emitHud();
  }

  // ── HUD ────────────────────────────────────────────────────────────────────
  private emitHud() {
    const save = this.api.getSave();
    const powerups: HudState['powerups'] = [];
    for (const k of Object.keys(this.pw) as PowerupType[]) {
      if (this.pw[k] > 0 && k !== 'shield') powerups.push({ type: k, left: this.pw[k], total: this.pwMax[k] || 1 });
    }
    const synergies: SynergyHud[] = [];
    for (const id of this.synergy.active) {
      const def = SYNERGY_MAP[id];
      synergies.push({ id, name: def.name, color: def.color });
    }
    const abilityDef = this.ability.def;
    const ability: AbilityHud = {
      id: abilityDef.id,
      name: abilityDef.short,
      phase: this.ability.phase,
      left: this.ability.hudLeft(),
      total: this.ability.hudTotal(),
      color: abilityDef.color,
    };
    const b = this.boss;
    this.api.onHud({
      score: Math.floor(this.score),
      best: Math.max(save.best, Math.floor(this.score)),
      coins: save.coins + this.pendCoins,
      hp: Math.max(0, Math.round(this.hp)),
      maxHp: this.maxHp,
      armor: Math.round(this.armor),
      rollbackReady: this.rollbackT <= 0,
      rollbackLeft: this.rollbackT,
      rollbackCost: ROLLBACK.cost,
      canAffordRollback: save.coins + this.pendCoins >= ROLLBACK.cost,
      level: this.level,
      shielded: this.pw.shield > 0,
      powerups,
      synergies,
      ability,
      boss: b ? { hp: Math.max(0, b.hp), max: b.max, name: b.name, phase: b.phase, critical: b.phase >= 3 } : null,
      elapsed: this.runTime,
      muted: save.muted,
      paused: this.paused,
      mode: this.gameMode,
      modeLabel: this.modeDef.name,
      modeColor: this.modeDef.color,
      scoreMul: this.scoreMul,
      bossesDown: this.bossesDown,
      voidBonus: this.voidBonus,
      voidStreak: this.voidStreak,
    });
  }

  // ── background (delegated to the isolated subsystem) ───────────────────────

  // ── rendering ──────────────────────────────────────────────────────────────
  private render() {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.w, this.h);

    const hardcore = this.gameMode === 'hardcore' && this.phase !== 'menu' && this.phase !== 'over';
    const live = this.phase === 'playing' || this.phase === 'dying' || this.phase === 'intro';
    const stretch = live ? 1 + Math.min(1.6, this.d.c * 0.12) : 0.5;
    this.bg.renderSpace(ctx, {
      w: this.w,
      h: this.h,
      u: this.u,
      time: this.time,
      hardcore,
      menuPhase: this.phase === 'menu' || this.phase === 'over',
      stretch,
    });

    ctx.save();
    if (this.shake > 0) {
      const s2 = this.shake * this.shake * 16 * this.u;
      ctx.translate((Math.random() * 2 - 1) * s2, (Math.random() * 2 - 1) * s2);
    }

    // coins
    for (const c of this.coinsArr) {
      drawGlow(ctx, 'rgba(251,191,36,0.5)', c.x, c.y, 13 * this.u, 0.7);
      ctx.save();
      ctx.translate(c.x, c.y);
      drawCoinDisc(ctx, 6.4 * this.u, c.t);
      ctx.restore();
    }

    // power-up orbs
    for (const p of this.powers) {
      const pulse = 1 + 0.14 * Math.sin(p.t * 6);
      const r = 15 * this.u * pulse;
      drawGlow(ctx, p.color, p.x, p.y, 26 * this.u * pulse, 0.85, true);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = 1.4;
      ctx.setLineDash([6, 5]);
      ctx.lineDashOffset = -p.t * 22;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(5,8,18,0.66)';
      ctx.beginPath();
      ctx.arc(0, 0, r - 2, 0, TAU);
      ctx.fill();
      drawPowerupIcon(ctx, p.type, 15 * this.u);
      ctx.restore();
    }

    // enemies
    for (const e of this.enemies) {
      const glowColor =
        e.kind === 'scout'
          ? 'rgba(244,63,94,0.4)'
          : e.kind === 'weaver'
            ? 'rgba(192,132,252,0.4)'
            : e.kind === 'gunner'
              ? 'rgba(251,146,60,0.4)'
              : e.kind === 'diver'
                ? 'rgba(239,68,68,0.45)'
                : 'rgba(220,38,38,0.5)';
      drawGlow(ctx, glowColor, e.x, e.y, e.r * 1.9, 0.8);
      ctx.save();
      ctx.translate(e.x, e.y);
      if (e.kind === 'diver' && e.state === 2) ctx.rotate(Math.atan2(e.vy, e.vx) - Math.PI / 2);
      drawEnemyKind(ctx, e.kind, e.r, e.t, e.flash);
      if (e.maxHp > 10 && e.hp < e.maxHp) {
        const w = e.r * 1.7;
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(-w / 2, -e.r - 8 * this.u, w, 3);
        ctx.fillStyle = '#f87171';
        ctx.fillRect(-w / 2, -e.r - 8 * this.u, w * clamp(e.hp / e.maxHp, 0, 1), 3);
      }
      ctx.restore();
    }

    if (this.boss) renderBoss(ctx, this.boss, this.u, this.px, this.py, this.h);

    // enemy bullets
    for (const b of this.eBullets) {
      drawGlow(ctx, b.color, b.x, b.y, b.r * 2.6, 0.9, true);
      ctx.fillStyle = '#fff1f2';
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r * 0.55, 0, TAU);
      ctx.fill();
      if (b.homing > 0) {
        ctx.strokeStyle = 'rgba(248,113,113,0.5)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(b.x, b.y);
        ctx.lineTo(b.x - b.vx * 0.05, b.y - b.vy * 0.05);
        ctx.stroke();
      }
    }

    // nova beam (behind the ship sprite)
    if (this.ability.isActive && this.ability.def.id === 'novabeam') this.renderBeam(ctx);

    if (this.phase !== 'over' && this.phase !== 'dying' && this.phase !== 'menu') this.renderPlayer(ctx);

    // player bullets + техника
    for (const b of this.pBullets) {
      const color = b.color || (b.power ? '#f472b6' : '#67e8f9');
      if (b.kind === 2) {
        // бомба
        const pulse = 1 + 0.18 * Math.sin(this.time * 24);
        drawGlow(ctx, color, b.x, b.y, b.r * 2.6 * pulse, 1, true);
        ctx.fillStyle = '#0b1f17';
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r * pulse, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.stroke();
        continue;
      }
      drawGlow(ctx, color, b.x, b.y, b.r * (b.kind === 1 ? 3.6 : 3), 0.9, true);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      const ang = Math.atan2(b.vy, b.vx) + Math.PI / 2;
      if (b.kind === 1) ctx.ellipse(b.x, b.y, b.r * 0.42, b.r * 2.1, ang, 0, TAU);
      else ctx.ellipse(b.x, b.y, b.r * 0.55, b.r * 1.7, ang, 0, TAU);
      ctx.fill();
    }

    // дуги ЭМИ-молнии
    for (const a of this.arcs) {
      const k = clamp(a.life / 0.24, 0, 1);
      ctx.save();
      ctx.globalAlpha = k;
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = a.color;
      ctx.lineWidth = 2.4 * this.u;
      ctx.beginPath();
      ctx.moveTo(a.x1, a.y1);
      const segs = 4;
      for (let i = 1; i <= segs; i++) {
        const t = i / segs;
        const jitter = i === segs ? 0 : (Math.random() * 2 - 1) * 14 * this.u;
        ctx.lineTo(a.x1 + (a.x2 - a.x1) * t + jitter, a.y1 + (a.y2 - a.y1) * t + jitter * 0.5);
      }
      ctx.stroke();
      ctx.restore();
    }

    // орбитальные дроны NOVA-X
    if (this.techLevel > 0 && this.techId === 'drones' && this.phase === 'playing') {
      const n = this.techLevel >= 4 ? 3 : 2;
      for (let i = 0; i < n; i++) {
        const ang = this.time * 2.2 + (TAU * i) / n;
        const dx = this.px + Math.cos(ang) * 34 * this.u;
        const dy = this.py + Math.sin(ang) * 34 * this.u * 0.55;
        drawGlow(ctx, '#f472b6', dx, dy, 11 * this.u, 0.9, true);
        ctx.fillStyle = '#fdf2f8';
        ctx.fillRect(dx - 2.6 * this.u, dy - 2.6 * this.u, 5.2 * this.u, 5.2 * this.u);
      }
    }

    // сингулярность VOID-X
    const vx = this.vortex;
    if (vx) {
      const k = vx.life / vx.max;
      ctx.save();
      ctx.translate(vx.x, vx.y);
      ctx.rotate(this.time * 3);
      drawGlow(ctx, '#818cf8', 0, 0, vx.r * 1.3, 0.85);
      ctx.strokeStyle = `rgba(199,210,254,${0.5 + 0.4 * k})`;
      ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(0, 0, vx.r * (0.4 + 0.3 * i) * (0.75 + 0.25 * k), i * 1.5, i * 1.5 + 4.2);
        ctx.stroke();
      }
      ctx.fillStyle = '#05061a';
      ctx.beginPath();
      ctx.arc(0, 0, vx.r * 0.3, 0, TAU);
      ctx.fill();
      ctx.restore();
    }

    for (const p of this.parts) {
      const lifeK = 1 - p.life / p.max;
      drawGlow(ctx, p.color, p.x, p.y, p.size * (0.5 + lifeK), lifeK);
    }

    ctx.restore();

    this.renderTexts(ctx);
    this.bg.renderVignette(ctx, this.w, this.h);
    this.renderOverlays(ctx, hardcore);
  }

  private renderBeam(ctx: CanvasRenderingContext2D) {
    const halfW = 17 * this.u * (0.85 + 0.15 * Math.sin(this.time * 40));
    const top = 0;
    const grad = ctx.createLinearGradient(this.px - halfW, 0, this.px + halfW, 0);
    grad.addColorStop(0, 'rgba(244,114,182,0)');
    grad.addColorStop(0.35, 'rgba(244,114,182,0.7)');
    grad.addColorStop(0.5, 'rgba(255,255,255,0.95)');
    grad.addColorStop(0.65, 'rgba(244,114,182,0.7)');
    grad.addColorStop(1, 'rgba(244,114,182,0)');
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = grad;
    ctx.fillRect(this.px - halfW * 1.7, top, halfW * 3.4, this.py - top);
    ctx.restore();
    drawGlow(ctx, '#f472b6', this.px, this.py - 22 * this.u, 40 * this.u, 1, true);
  }

  private renderPlayer(ctx: CanvasRenderingContext2D) {
    const blink = this.invuln > 0 && Math.floor(this.time * 14) % 2 === 0 && this.phase === 'playing';
    const dashing = this.ability.isActive && this.ability.def.id === 'dash';
    const fortress = this.ability.isActive && this.ability.def.id === 'fortress';
    const charging = this.ability.isCharging;

    if (!blink || dashing) {
      ctx.save();
      ctx.translate(this.px, this.py);
      ctx.rotate(this.bank);
      const stretch = dashing ? 1.25 : 1;
      ctx.scale(this.u * 1.06 * (dashing ? 0.85 : 1), this.u * 1.06 * stretch);
      drawGlow(ctx, 'rgba(34,211,238,0.35)', 0, 4, 34, 0.9);
      if (this.voidBonus > 0) {
        drawGlow(ctx, '#818cf8', 0, 0, 40 + this.voidBonus * 120, 0.35 + this.voidBonus * 2);
      }
      drawShip(ctx, this.shipId, this.time, this.pointerActive ? 1 : 0.6);
      ctx.restore();
    }

    if (this.muzzleT > 0) {
      drawGlow(ctx, '#a5f3fc', this.px, this.py - 20 * this.u, 13 * this.u * (this.muzzleT / 0.05), 0.95, true);
    }

    // боковые турели — видимые модули на корпусе
    if (this.turretL || this.turretR) {
      const sides: number[] = [];
      if (this.turretL) sides.push(-1);
      if (this.turretR) sides.push(1);
      for (const s of sides) {
        const tx = this.px + s * 24 * this.u;
        const ty = this.py + 8 * this.u;
        drawGlow(ctx, '#fbbf24', tx, ty, 13 * this.u * (0.8 + this.turretFlash * 0.6), 0.75, true);
        ctx.save();
        ctx.translate(tx, ty);
        ctx.fillStyle = '#44403c';
        ctx.fillRect(-3.6 * this.u, -3.6 * this.u, 7.2 * this.u, 7.2 * this.u);
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 1.2;
        ctx.strokeRect(-3.6 * this.u, -3.6 * this.u, 7.2 * this.u, 7.2 * this.u);
        // ствол смотрит назад
        ctx.fillStyle = this.turretFlash > 0.4 ? '#fde68a' : '#78716c';
        ctx.fillRect(-1.5 * this.u, 2 * this.u, 3 * this.u, 9 * this.u);
        ctx.restore();
      }
    }

    // beam charge-up
    if (charging) {
      const k = this.ability.progress;
      drawGlow(ctx, '#f472b6', this.px, this.py - 22 * this.u, (10 + 26 * k) * this.u, 0.6 + 0.4 * k, true);
      ctx.save();
      ctx.strokeStyle = `rgba(244,114,182,${0.4 + 0.5 * k})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(this.px, this.py, (44 - 26 * k) * this.u, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }

    // fortress field
    if (fortress) {
      const pulse = 1 + 0.06 * Math.sin(this.time * 8);
      ctx.save();
      ctx.translate(this.px, this.py);
      drawGlow(ctx, 'rgba(52,211,153,0.5)', 0, 0, 52 * this.u * pulse, 0.8);
      ctx.rotate(this.time * 0.7);
      ctx.strokeStyle = 'rgba(167,243,208,0.9)';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      const R = 40 * this.u * pulse;
      for (let i = 0; i < 6; i++) {
        const a = (TAU * i) / 6;
        const x = Math.cos(a) * R;
        const y = Math.sin(a) * R;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.globalAlpha = 0.12;
      ctx.fillStyle = '#34d399';
      ctx.fill();
      ctx.restore();
    }

    // void collapse implosion ring
    if (this.ability.isActive && this.ability.def.id === 'collapse') {
      const k = 1 - this.ability.progress;
      ctx.save();
      ctx.globalAlpha = 0.75 * k;
      ctx.strokeStyle = '#818cf8';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(this.px, this.py, 210 * this.u * k, 0, TAU);
      ctx.stroke();
      ctx.restore();
      drawGlow(ctx, '#818cf8', this.px, this.py, 70 * this.u * (1 - k), 0.9, true);
    }

    // shield bubble
    if (this.pw.shield > 0) {
      const reflect = this.synergy.effects().reflect;
      ctx.save();
      ctx.translate(this.px, this.py);
      drawGlow(ctx, reflect ? 'rgba(125,211,252,0.6)' : 'rgba(34,211,238,0.5)', 0, 0, 40 * this.u, 0.75);
      ctx.rotate(this.time * 0.88);
      ctx.strokeStyle = reflect ? 'rgba(224,242,254,0.95)' : 'rgba(165,243,252,0.85)';
      ctx.lineWidth = reflect ? 2.4 : 1.6;
      ctx.beginPath();
      const R = 30 * this.u;
      for (let i = 0; i < 6; i++) {
        const a = (TAU * i) / 6;
        const x = Math.cos(a) * R;
        const y = Math.sin(a) * R;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
      if (this.rippleT > 0) {
        ctx.save();
        ctx.globalAlpha = this.rippleT;
        ctx.strokeStyle = '#a5f3fc';
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.arc(this.px, this.py, 30 * this.u + (1 - this.rippleT) * 26 * this.u, 0, TAU);
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  private renderTexts(ctx: CanvasRenderingContext2D) {
    for (const f of this.floats) {
      const a = 1 - f.t / f.max;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.font = `700 ${f.size * this.u}px ui-monospace, Menlo, monospace`;
      ctx.textAlign = 'center';
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
      ctx.restore();
    }

    if (this.banners.length) {
      const b = this.banners[0];
      const inK = clamp(b.t / 0.22, 0, 1);
      const outK = clamp((b.max - b.t) / 0.3, 0, 1);
      const a = Math.min(inK, outK);
      const scale = 0.85 + 0.15 * inK;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.translate(this.w / 2, this.h * 0.3);
      ctx.scale(scale, scale);
      ctx.textAlign = 'center';
      try {
        (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${3.5 * this.u}px`;
      } catch {
        /* unsupported */
      }
      drawGlow(ctx, b.color, 0, 0, 120 * this.u, 0.4 * a);
      ctx.font = `800 ${23 * this.u}px "Avenir Next", system-ui, sans-serif`;
      ctx.fillStyle = b.color;
      ctx.fillText(b.text, 0, 0);
      if (b.sub) {
        ctx.font = `600 ${9.5 * this.u}px "Avenir Next", system-ui, sans-serif`;
        ctx.fillStyle = 'rgba(226,240,255,0.85)';
        ctx.fillText(b.sub, 0, 20 * this.u);
      }
      try {
        (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = '0px';
      } catch {
        /* unsupported */
      }
      ctx.restore();
    }
  }

  private renderOverlays(ctx: CanvasRenderingContext2D, hardcore: boolean) {
    // white shock flash on capital ship destruction
    if (this.flashWhite > 0) {
      ctx.save();
      ctx.globalAlpha = this.flashWhite * 0.6;
      ctx.fillStyle = '#e8f6ff';
      ctx.fillRect(0, 0, this.w, this.h);
      ctx.restore();
    }

    if (this.hurtFlash > 0) {
      ctx.save();
      ctx.globalAlpha = this.hurtFlash * 0.32;
      const g = ctx.createRadialGradient(this.w / 2, this.h / 2, this.h * 0.2, this.w / 2, this.h / 2, this.h * 0.7);
      g.addColorStop(0, 'rgba(239,68,68,0)');
      g.addColorStop(1, 'rgba(239,68,68,0.9)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, this.w, this.h);
      ctx.restore();
    }

    if (this.phase === 'playing' && this.hp / this.maxHp <= 0.25 && this.pw.shield <= 0) {
      ctx.save();
      ctx.globalAlpha = 0.1 + 0.07 * Math.sin(this.time * 5.5);
      const g = ctx.createRadialGradient(this.w / 2, this.h / 2, this.h * 0.24, this.w / 2, this.h / 2, this.h * 0.72);
      g.addColorStop(0, 'rgba(239,68,68,0)');
      g.addColorStop(1, 'rgba(239,68,68,0.85)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, this.w, this.h);
      ctx.restore();
    }

    // hardcore frame
    if (hardcore) {
      ctx.save();
      ctx.globalAlpha = 0.35 + 0.12 * Math.sin(this.time * 2.4);
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2.5 * this.u;
      ctx.strokeRect(1, 1, this.w - 2, this.h - 2);
      ctx.restore();
    }

    // boss critical phase frame
    if (this.boss && this.boss.phase >= 3 && this.boss.state === 'fight') {
      ctx.save();
      ctx.globalAlpha = 0.16 + 0.12 * Math.sin(this.time * 9);
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 6 * this.u;
      ctx.strokeRect(0, 0, this.w, this.h);
      ctx.restore();
    }

    if (this.bossWarnT > 0) {
      ctx.save();
      ctx.globalAlpha = 0.25 + 0.25 * Math.sin(this.time * 14);
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 5 * this.u;
      ctx.strokeRect(0, 0, this.w, this.h);
      ctx.restore();
    }

    // VOID DRIVE maxed shockwave
    if (this.voidMaxFx > 0) {
      ctx.save();
      ctx.globalAlpha = this.voidMaxFx * 0.5;
      ctx.strokeStyle = '#818cf8';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(this.px, this.py, (1 - this.voidMaxFx) * 420 * this.u, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }

    if (this.phase === 'playing' && this.runTime < 3 && !this.pointerActive) {
      const a = clamp(3 - this.runTime, 0, 1);
      ctx.save();
      ctx.globalAlpha = a * (0.65 + 0.35 * Math.sin(this.time * 5));
      ctx.textAlign = 'center';
      ctx.font = `700 ${13 * this.u}px "Avenir Next", system-ui, sans-serif`;
      ctx.fillStyle = '#a5f3fc';
      const hy = this.py - 64 * this.u;
      ctx.fillText('ТЯНИ ПАЛЬЦЕМ ДЛЯ ПОЛЁТА', this.w / 2, hy);
      ctx.strokeStyle = 'rgba(165,243,252,0.6)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(this.w / 2 + Math.sin(this.time * 2.4) * 40 * this.u, hy + 26 * this.u, 12 * this.u, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }
  }
}

export { bossPhaseLabel };
