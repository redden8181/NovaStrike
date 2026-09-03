import { ACHIEVEMENT_MAP, CHECKPOINTS, ENEMIES, POWERUPS, SHIP_MAP } from './content';
import type { EnemyKind, EngineApi, HudState, PowerupType, RunResult, ShipId } from './types';
import { drawCoinDisc, drawEnemyKind, drawGlow, drawPowerupIcon, drawShip } from './sprites';
import { sfx } from './audio';

// ── helpers ─────────────────────────────────────────────────────────────────
const TAU = Math.PI * 2;
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const randi = (a: number, b: number) => Math.floor(rand(a, b + 1));
const dist2 = (x1: number, y1: number, x2: number, y2: number) => {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return dx * dx + dy * dy;
};

interface Star {
  x: number;
  y: number;
  z: number; // 0..2 layer
  tw: number;
}
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
interface PBullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  dmg: number;
  r: number;
  power: boolean;
}
interface EBullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  color: string;
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
  state: number; // diver: 0 enter, 1 aim, 2 charge
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
interface Turret {
  ox: number;
  oy: number;
  hp: number;
  max: number;
  alive: boolean;
  cool: number;
  burstLeft: number;
  burstT: number;
}
interface Boss {
  x: number;
  y: number;
  t: number;
  state: 'enter' | 'fight' | 'die';
  hp: number;
  max: number;
  tier: number;
  name: string;
  turrets: Turret[];
  pattern: number;
  pT: number;
  sprayT: number;
  sprayAngle: number;
  dropT: number;
  spawnT: number;
  dieT: number;
  dieFx: number;
  flash: number;
}

const BOSS_NAMES = ['VOID REAVER', 'STAR BREAKER', 'NULL HERALD', 'OMEGA LOOM', 'DARK MATRIARCH', 'RUIN ENGINE'];
const EMPTY_TIMERS: Record<PowerupType, number> = { rapid: 0, double: 0, triple: 0, shield: 0, power: 0, magnet: 0 };

export class GameEngine {
  private cv: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private api: EngineApi;

  private w = 0;
  private h = 0;
  private u = 1;
  private dpr = 1;

  private mode: 'menu' | 'intro' | 'playing' | 'dying' | 'over' = 'menu';
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

  // background
  private stars: Star[] = [];
  private nebulas: { x: number; y: number; r: number; vy: number; hue: number }[] = [];
  private vignette: HTMLCanvasElement | null = null;
  private shootStar: { x: number; y: number; vx: number; vy: number; life: number } | null = null;
  private shootT = 5;

  // run state
  private shipId: ShipId = 'falcon';
  private startCp = 0;
  private score = 0;
  private runCoins = 0;
  private runKills = 0;
  private runTime = 0;
  private level = 1;
  private fireRate = 4;
  private damage = 1;
  private streamsBase = 1;
  private maxHp = 3;
  private hp = 3;
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

  private pBullets: PBullet[] = [];
  private eBullets: EBullet[] = [];
  private enemies: Enemy[] = [];
  private coinsArr: CoinEnt[] = [];
  private powers: PowerEnt[] = [];
  private parts: Particle[] = [];
  private floats: FloatText[] = [];
  private banners: Banner[] = [];

  private spawnT = 1;
  private formationT = 8;
  private levelBannered = 1;
  private boss: Boss | null = null;
  private nextBoss = 8000;
  private bossWarnT = 0;
  private bossKillsRun = 0;

  private pendCoins = 0;
  private pendKills = 0;
  private pendBossKills = 0;
  private pendAch: string[] = [];
  private pendTime = 0;
  private newCheckpoints: number[] = [];
  private unlockedAch: string[] = [];

  constructor(canvas: HTMLCanvasElement, api: EngineApi) {
    this.cv = canvas;
    this.api = api;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('no 2d context');
    this.ctx = ctx;

    this.resize();
    window.addEventListener('resize', this.resize);
    canvas.addEventListener('pointerdown', this.onDown, { passive: false });
    window.addEventListener('pointermove', this.onMove, { passive: false });
    window.addEventListener('pointerup', this.onUp);
    window.addEventListener('pointercancel', this.onUp);
    window.addEventListener('keydown', this.onKey);
    window.addEventListener('keyup', this.onKeyUp);
    document.addEventListener('visibilitychange', this.onVis);

    this.initBackground();
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
    sfx.stopAmbient();
  }

  // ── sizing / background ────────────────────────────────────────────────────
  private resize = () => {
    const parent = this.cv.parentElement;
    const w = parent ? parent.clientWidth : window.innerWidth;
    const h = parent ? parent.clientHeight : window.innerHeight;
    this.w = w;
    this.h = h;
    this.u = clamp(h / 760, 0.75, 1.3);
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.cv.width = Math.round(w * this.dpr);
    this.cv.height = Math.round(h * this.dpr);
    this.cv.style.width = `${w}px`;
    this.cv.style.height = `${h}px`;
    this.buildVignette();
    this.initBackground();
    if (this.mode === 'menu' || this.mode === 'over') {
      this.px = w / 2;
      this.py = h * 0.82;
    }
  };

  private initBackground() {
    this.stars = [];
    for (let i = 0; i < 110; i++) {
      this.stars.push({
        x: Math.random() * this.w,
        y: Math.random() * this.h,
        z: Math.random() < 0.5 ? 0 : Math.random() < 0.7 ? 1 : 2,
        tw: Math.random() * TAU,
      });
    }
    this.nebulas = [];
    for (let i = 0; i < 4; i++) {
      this.nebulas.push({
        x: rand(0.1, 0.9) * this.w,
        y: rand(-0.2, 1) * this.h,
        r: rand(120, 260) * this.u,
        vy: rand(3, 7),
        hue: randi(0, 2),
      });
    }
  }

  private buildVignette() {
    const c = document.createElement('canvas');
    c.width = Math.max(2, Math.round(this.w));
    c.height = Math.max(2, Math.round(this.h));
    const g = c.getContext('2d')!;
    const grad = g.createRadialGradient(
      this.w / 2,
      this.h * 0.42,
      Math.min(this.w, this.h) * 0.34,
      this.w / 2,
      this.h * 0.5,
      Math.max(this.w, this.h) * 0.78,
    );
    grad.addColorStop(0, 'rgba(2,4,12,0)');
    grad.addColorStop(0.75, 'rgba(2,4,12,0.28)');
    grad.addColorStop(1, 'rgba(1,2,8,0.72)');
    g.fillStyle = grad;
    g.fillRect(0, 0, c.width, c.height);
    this.vignette = c;
  }

  // ── input ──────────────────────────────────────────────────────────────────
  private onDown = (e: PointerEvent) => {
    if (e.cancelable) e.preventDefault();
    sfx.unlock();
    if (this.mode !== 'playing' || this.paused) return;
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
    const y = cy - rect.top - 78 * this.u; // keep ship visible above finger
    this.tx = clamp(x, 18 * this.u, this.w - 18 * this.u);
    this.ty = clamp(y, this.h * 0.3, this.h * 0.93);
  }

  private onKey = (e: KeyboardEvent) => {
    this.keys.add(e.key);
  };
  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.key);
  };

  private onVis = () => {
    if (document.hidden) {
      if (this.mode === 'playing' || this.mode === 'intro') this.setPaused(true);
      this.flush(true);
    }
  };

  // ── public API ─────────────────────────────────────────────────────────────
  startRun(startCheckpoint: number) {
    const save = this.api.getSave();
    this.shipId = save.ship;
    const mods = SHIP_MAP[save.ship].mods;
    const up = save.upgrades;
    this.fireRate = 4.1 * (1 + 0.22 * up.rate) * mods.rate;
    this.damage = 1 * (1 + 0.4 * up.power) * mods.damage;
    this.streamsBase = 1 + up.streams + mods.streams;
    this.maxHp = Math.max(1, 3 + up.hull + mods.hull);
    this.hp = this.maxHp;
    this.shieldDur = 7 + 1.5 * up.shield;
    this.magnetR = 62 * (1 + 0.5 * up.magnet);
    this.magnetRBig = 260 * (1 + 0.25 * up.magnet);
    this.followSpeed = 13 * mods.speed;

    this.startCp = startCheckpoint;
    this.score = startCheckpoint;
    this.runCoins = 0;
    this.runKills = 0;
    this.runTime = 0;
    this.level = 1;
    this.levelBannered = 1;
    this.invuln = 2;
    this.dyingT = 0;
    this.fireT = 0;
    this.pw = { ...EMPTY_TIMERS };
    this.pwMax = { ...EMPTY_TIMERS };
    this.pBullets = [];
    this.eBullets = [];
    this.enemies = [];
    this.coinsArr = [];
    this.powers = [];
    this.parts = [];
    this.floats = [];
    this.banners = [];
    this.spawnT = 1.2;
    this.formationT = 9;
    this.boss = null;
    this.nextBoss = (Math.floor(this.score / 8000) + 1) * 8000;
    this.bossWarnT = 0;
    this.bossKillsRun = 0;
    this.pendCoins = 0;
    this.pendKills = 0;
    this.pendBossKills = 0;
    this.pendAch = [];
    this.pendTime = 0;
    this.newCheckpoints = [];
    this.unlockedAch = [];
    this.shake = 0;
    this.hurtFlash = 0;

    this.px = this.w / 2;
    this.py = this.h + 60;
    this.tx = this.w / 2;
    this.ty = this.h * 0.8;
    this.pointerId = -1;
    this.pointerActive = false;

    this.mode = 'intro';
    this.introT = 1.15;
    this.paused = false;
    sfx.setMuted(save.muted);
    sfx.startAmbient();

    this.api.commit((s) => ({ ...s, stats: { ...s.stats, runs: s.stats.runs + 1 } }));
    if (startCheckpoint > 0) {
      this.pushBanner(`CHECKPOINT ${startCheckpoint}`, 'THREAT LEVEL RAISED — GOOD LUCK', '#fbbf24', 2.2);
    } else {
      this.pushBanner('SECTOR ZERO', 'DRAG TO FLY — CANNONS FIRE THEMSELVES', '#22d3ee', 2.4);
    }
    this.emitHud();
  }

  setPaused(p: boolean) {
    if (this.mode !== 'playing' && this.mode !== 'intro') p = false;
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
    this.mode = 'menu';
    this.paused = false;
    this.boss = null;
    this.pBullets = [];
    this.eBullets = [];
    this.enemies = [];
    this.powers = [];
    sfx.stopAmbient();
  }

  // ── difficulty curve ───────────────────────────────────────────────────────
  private diff() {
    const c = this.score / 3200 + this.runTime / 300;
    return {
      c,
      speed: 1 + Math.min(1.45, c * 0.16),
      hp: 1 + c * 0.3,
      interval: Math.max(0.3, 1.05 - Math.min(c, 11) * 0.066),
      bullet: 1 + Math.min(0.7, c * 0.07),
      aggro: Math.min(1, 0.3 + c * 0.1),
      burst: c > 6 ? 3 : c > 2.5 ? 2 : 1,
    };
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
    const playing = this.mode === 'playing' || this.mode === 'intro' || this.mode === 'dying';
    const bgSpeed = this.mode === 'menu' || this.mode === 'over' ? 0.45 : 1 + Math.min(1.4, this.diff().c * 0.12);
    this.updateBackground(dt, bgSpeed);

    if (!playing) {
      // keep embers drifting behind the game-over panel
      this.updateParticles(dt);
      this.updateTexts(dt);
      return;
    }

    if (this.mode === 'dying') {
      this.dyingT += dt;
      const wdt = dt * 0.35;
      if (Math.random() < 0.35) {
        this.explode(this.px + rand(-26, 26) * this.u, this.py + rand(-20, 20) * this.u, Math.random() < 0.5 ? '#fbbf24' : '#fb7185', randi(6, 12), 1);
      }
      this.updateWorld(wdt, true);
      if (this.dyingT > 1.5) this.endRun();
      return;
    }

    if (this.mode === 'intro') {
      this.introT -= dt;
      const k = 1 - Math.exp(-dt * 4);
      this.py = lerp(this.py, this.h * 0.8, k);
      this.emitTrail(dt, 0.7);
      if (this.introT <= 0) this.mode = 'playing';
    }

    this.runTime += dt;
    this.pendTime += dt;
    this.score += dt * 9; // survival trickle

    this.updatePlayer(dt);
    this.updateWorld(dt, false);
    this.updateSpawning(dt);
    this.updateBoss(dt);
    this.checkMilestones();

    this.flushT += dt;
    if (this.flushT > 1.2) {
      this.flushT = 0;
      this.flush(false);
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
    this.updatePickups(dt);
    this.updateParticles(dt);
    this.updateTexts(dt);
    this.shake = Math.max(0, this.shake - dt * 1.6);
    this.hurtFlash = Math.max(0, this.hurtFlash - dt * 1.8);
    this.muzzleT = Math.max(0, this.muzzleT - dt);
    this.rippleT = Math.max(0, this.rippleT - dt * 2.6);
  }

  // ── player ─────────────────────────────────────────────────────────────────
  private updatePlayer(dt: number) {
    if (this.invuln > 0) this.invuln -= dt;
    for (const k of Object.keys(this.pw) as PowerupType[]) {
      if (this.pw[k] > 0) {
        this.pw[k] -= dt;
        if (this.pw[k] <= 0) {
          this.pw[k] = 0;
          if (k === 'shield') sfx.play('shieldDown');
        }
      }
    }

    // keyboard fallback (desktop)
    const ks = 420 * this.u * dt;
    if (this.keys.has('ArrowLeft') || this.keys.has('a')) this.tx -= ks;
    if (this.keys.has('ArrowRight') || this.keys.has('d')) this.tx += ks;
    if (this.keys.has('ArrowUp') || this.keys.has('w')) this.ty -= ks;
    if (this.keys.has('ArrowDown') || this.keys.has('s')) this.ty += ks;
    this.tx = clamp(this.tx, 18 * this.u, this.w - 18 * this.u);
    this.ty = clamp(this.ty, this.h * 0.3, this.h * 0.93);

    this.prevPx = this.px;
    const k = 1 - Math.exp(-dt * this.followSpeed);
    const ky = 1 - Math.exp(-dt * this.followSpeed * 0.8);
    this.px += (this.tx - this.px) * k;
    this.py += (this.ty - this.py) * ky;

    const vx = dt > 0 ? (this.px - this.prevPx) / dt : 0;
    this.bank = lerp(this.bank, clamp(vx * 0.0011, -0.5, 0.5), clamp(dt * 9, 0, 1));

    const moveSpeed = Math.abs(vx) + Math.abs(this.ty - this.py);
    this.emitTrail(dt, 0.55 + clamp(moveSpeed / 400, 0, 0.6));
    this.updateFire(dt);
  }

  private emitTrail(dt: number, power: number) {
    if (Math.random() < dt * 90 * power) {
      this.parts.push({
        x: this.px + rand(-3, 3) * this.u,
        y: this.py + 16 * this.u,
        vx: rand(-14, 14),
        vy: rand(60, 130) * this.u,
        life: 0,
        max: rand(0.28, 0.5),
        size: rand(6, 11) * this.u * power,
        color: Math.random() < 0.25 ? '#ffffff' : '#22d3ee',
        drag: 0.9,
        grav: 0,
      });
    }
  }

  private updateFire(dt: number) {
    if (this.mode !== 'playing' && this.mode !== 'intro') return;
    if (this.mode === 'intro') return;
    const rapid = this.pw.rapid > 0;
    const rate = this.fireRate * (rapid ? 2.3 : 1);
    const interval = 1 / rate;
    this.fireT += dt;
    while (this.fireT >= interval) {
      this.fireT -= interval;
      this.fire();
    }
  }

  private fire() {
    let n = this.streamsBase;
    if (this.pw.triple > 0) n += 2;
    else if (this.pw.double > 0) n += 1;
    n = clamp(n, 1, 7);
    const dmg = this.damage * (this.pw.power > 0 ? 2 : 1);
    const speed = 860 * this.u;
    const powered = this.pw.power > 0;
    for (let i = 0; i < n; i++) {
      const off = i - (n - 1) / 2;
      const angle = off * 0.058;
      this.pBullets.push({
        x: this.px + off * 10 * this.u,
        y: this.py - 16 * this.u,
        vx: Math.sin(angle) * speed,
        vy: -Math.cos(angle) * speed,
        dmg,
        r: (powered ? 5.5 : 4) * this.u,
        power: powered,
      });
    }
    this.muzzleT = 0.05;
    sfx.play('shoot');
  }

  // ── bullets & collisions ───────────────────────────────────────────────────
  private updateBullets(dt: number, dying: boolean) {
    const pr = 11 * this.u;
    for (let i = this.pBullets.length - 1; i >= 0; i--) {
      const b = this.pBullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.y < -30 || b.x < -30 || b.x > this.w + 30) {
        this.pBullets.splice(i, 1);
        continue;
      }
      // boss collision takes priority
      if (this.boss && this.boss.state !== 'enter' && this.hitBoss(b)) {
        this.pBullets.splice(i, 1);
        continue;
      }
      for (let j = this.enemies.length - 1; j >= 0; j--) {
        const e = this.enemies[j];
        const rr = (e.r + b.r) * (e.r + b.r);
        if (dist2(b.x, b.y, e.x, e.y) < rr) {
          e.hp -= b.dmg;
          e.flash = 1;
          this.burst(b.x, b.y, '#a5f3fc', 3, 90);
          sfx.play('hit');
          this.pBullets.splice(i, 1);
          if (e.hp <= 0) this.killEnemy(j);
          break;
        }
      }
    }

    for (let i = this.eBullets.length - 1; i >= 0; i--) {
      const b = this.eBullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.y > this.h + 30 || b.y < -30 || b.x < -30 || b.x > this.w + 30) {
        this.eBullets.splice(i, 1);
        continue;
      }
      if (dying) continue;
      const rr = (pr + b.r) * (pr + b.r);
      if (dist2(b.x, b.y, this.px, this.py) < rr) {
        if (this.invuln <= 0) {
          this.eBullets.splice(i, 1);
          this.damagePlayer();
        }
      }
    }
  }

  private hitBoss(b: PBullet): boolean {
    const boss = this.boss!;
    const sc = this.u;
    for (const t of boss.turrets) {
      if (!t.alive) continue;
      const tx = boss.x + t.ox * sc;
      const ty = boss.y + t.oy * sc;
      const rr = (16 * sc + b.r) ** 2;
      if (dist2(b.x, b.y, tx, ty) < rr) {
        t.hp -= b.dmg;
        boss.flash = 1;
        this.burst(b.x, b.y, '#fbcfe8', 3, 80);
        sfx.play('hit');
        if (t.hp <= 0) {
          t.alive = false;
          this.explode(tx, ty, '#f472b6', 22, 1.4);
          sfx.play('boom');
          this.score += 250;
          this.addFloat(tx, ty, '+250', '#f472b6', 15);
          this.shake = Math.min(1, this.shake + 0.35);
        }
        return true;
      }
    }
    const coreR = (34 + (boss.state === 'die' ? 200 : 0)) * sc + b.r;
    if (boss.state !== 'die' && dist2(b.x, b.y, boss.x, boss.y) < coreR * coreR) {
      boss.hp -= b.dmg;
      boss.flash = 1;
      this.burst(b.x, b.y, '#fbcfe8', 3, 80);
      sfx.play('hit');
      if (boss.hp <= 0 && boss.state === 'fight') this.startBossDeath();
      return true;
    }
    return false;
  }

  private damagePlayer() {
    if (this.mode === 'dying') return;
    if (this.pw.shield > 0) {
      this.rippleT = 1;
      sfx.play('shieldHit');
      this.shake = Math.min(1, this.shake + 0.15);
      return;
    }
    this.hp -= 1;
    this.invuln = 1.25;
    this.hurtFlash = 1;
    this.shake = Math.min(1, this.shake + 0.6);
    this.burst(this.px, this.py, '#fb7185', 14, 220);
    sfx.play('hurt');
    if (this.hp <= 0) this.startDeath();
  }

  private startDeath() {
    this.mode = 'dying';
    this.dyingT = 0;
    this.explode(this.px, this.py, '#22d3ee', 30, 1.8);
    this.explode(this.px, this.py, '#fbbf24', 22, 1.4);
    sfx.play('death');
    sfx.stopAmbient();
  }

  // ── enemies ────────────────────────────────────────────────────────────────
  private updateSpawning(dt: number) {
    if (this.mode !== 'playing') return;
    const d = this.diff();
    if (this.boss) {
      // boss dies on its own schedule; light trickle of minions handled by boss
      if (this.boss.state === 'die') return;
      this.spawnT -= dt * 0.35;
    } else {
      this.spawnT -= dt;
    }
    if (this.spawnT <= 0) {
      const n = d.burst > 1 && Math.random() < 0.5 ? d.burst : 1;
      for (let i = 0; i < n; i++) this.spawnEnemy(this.pickKind());
      this.spawnT = d.interval * rand(0.7, 1.35);
    }
    this.formationT -= dt;
    if (this.formationT <= 0) {
      this.formationT = rand(7, 12);
      if (this.score > 350 && !this.boss) this.spawnFormation();
    }
    // boss trigger
    if (!this.boss && this.bossWarnT <= 0 && this.score >= this.nextBoss) {
      this.bossWarnT = 2.2;
      this.pushBanner('WARNING', 'CAPITAL SHIP SIGNATURE DETECTED', '#ef4444', 2.2);
      sfx.play('warn');
    }
    if (this.bossWarnT > 0) {
      this.bossWarnT -= dt;
      if (this.bossWarnT <= 0) this.spawnBoss();
    }
  }

  private pickKind(): EnemyKind {
    const s = this.score;
    const ramp = (a: number, b: number) => clamp((s - a) / (b - a), 0, 1);
    const pool: [EnemyKind, number][] = [
      ['scout', 10],
      ['weaver', 6 * ramp(250, 1200)],
      ['gunner', 5 * ramp(700, 1800)],
      ['diver', 4.2 * ramp(2400, 4200)],
      ['tank', 3.2 * ramp(4200, 6500)],
    ];
    let total = 0;
    for (const [, w] of pool) total += w;
    let roll = Math.random() * total;
    for (const [kind, w] of pool) {
      roll -= w;
      if (roll <= 0) return kind;
    }
    return 'scout';
  }

  private spawnEnemy(kind: EnemyKind, x?: number, y?: number) {
    const def = ENEMIES[kind];
    const d = this.diff();
    const ex = x ?? rand(28, this.w - 28);
    this.enemies.push({
      kind,
      x: ex,
      y: y ?? -def.r * 2 - rand(0, 40),
      vx: 0,
      vy: def.speed * this.u * d.speed,
      hp: def.hp * d.hp,
      maxHp: def.hp * d.hp,
      r: def.r * this.u,
      score: def.score,
      coinMin: def.coins[0],
      coinMax: def.coins[1],
      powerChance: def.powerChance,
      t: rand(0, 10),
      phase: rand(0, TAU),
      baseX: ex,
      flash: 0,
      shootT: rand(1, 2.4),
      state: 0,
      stateT: 0,
      aimX: 0,
      aimY: 0,
    });
  }

  private spawnFormation() {
    const x0 = rand(this.w * 0.25, this.w * 0.75);
    const n = randi(3, 5);
    for (let i = 0; i < n; i++) {
      const x = x0 + (i - (n - 1) / 2) * 44 * this.u;
      if (x < 26 || x > this.w - 26) continue;
      this.spawnEnemy('scout', x, -40 - Math.abs(i - (n - 1) / 2) * 26);
    }
  }

  private updateEnemies(dt: number, dying: boolean) {
    const d = this.diff();
    const pr = 11 * this.u;
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
            e.shootT = rand(2.4, 3.6);
            this.enemyShoot(e, 165, '#fb7185', 1);
          }
          break;
        }
        case 'weaver': {
          e.y += e.vy * dt;
          e.x = e.baseX + Math.sin(e.t * 2.4 + e.phase) * 62 * this.u;
          e.shootT -= dt * d.aggro;
          if (e.shootT <= 0 && e.y > 0 && e.y < this.h * 0.55) {
            e.shootT = rand(2.2, 3.2);
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
            e.shootT = rand(1.7, 2.6);
            this.enemyShoot(e, 195, '#fb923c', this.diff().c > 3 ? 3 : 1);
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
              const sp = 380 * this.u * clamp(d.speed, 1, 1.6);
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
              e.shootT = rand(2.4, 3.4);
              this.enemyShoot(e, 150, '#dc2626', 3);
            }
          }
          break;
        }
      }

      // contact with player
      if (!dying && this.invuln <= 0 && e.y > -10) {
        const rr = (e.r * 0.85 + pr) ** 2;
        if (dist2(e.x, e.y, this.px, this.py) < rr) {
          if (this.pw.shield > 0) {
            this.rippleT = 1;
            sfx.play('shieldHit');
            this.killEnemy(i, true);
            continue;
          }
          this.explode(e.x, e.y, '#fb7185', 12, 1);
          this.enemies.splice(i, 1);
          this.pendKills += 1;
          this.runKills += 1;
          this.damagePlayer();
          continue;
        }
      }

      if (e.y > this.h + 70 || e.x < -90 || e.x > this.w + 90) {
        this.enemies.splice(i, 1);
      }
    }
  }

  private enemyShoot(e: Enemy, speed: number, color: string, fan: number) {
    const d = this.diff();
    const sp = speed * this.u * d.bullet;
    const dx = this.px - e.x;
    const dy = this.py - e.y;
    const base = Math.atan2(dy, dx);
    for (let i = 0; i < fan; i++) {
      const off = fan > 1 ? (i - (fan - 1) / 2) * 0.28 : 0;
      const a = base + off;
      this.eBullets.push({
        x: e.x,
        y: e.y + e.r * 0.6,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        r: 4.6 * this.u,
        color,
      });
    }
  }

  private killEnemy(idx: number, silent = false) {
    const e = this.enemies[idx];
    this.enemies.splice(idx, 1);
    this.runKills += 1;
    this.pendKills += 1;
    this.score += e.score;
    const big = e.kind === 'tank';
    this.explode(e.x, e.y, big ? '#fbbf24' : '#fb7185', big ? 26 : 14, big ? 1.5 : 1);
    if (!silent) sfx.play(big ? 'bigboom' : 'boom');
    if (big) this.shake = Math.min(1, this.shake + 0.3);
    this.addFloat(e.x, e.y, `+${e.score}`, '#fda4af', 13);
    // coins
    const n = randi(e.coinMin, e.coinMax);
    for (let i = 0; i < n; i++) this.spawnCoin(e.x + rand(-8, 8), e.y + rand(-4, 8), rand(60, 150));
    // power-up
    if (Math.random() < e.powerChance) this.dropPowerup(e.x, e.y);
  }

  // ── boss ───────────────────────────────────────────────────────────────────
  private spawnBoss() {
    const tier = Math.max(1, Math.floor(this.nextBoss / 8000));
    const d = this.diff();
    const name = `${BOSS_NAMES[(tier - 1) % BOSS_NAMES.length]}${tier > BOSS_NAMES.length ? ` ${Math.ceil(tier / BOSS_NAMES.length)}` : ''}`;
    const hp = 130 * (1 + 0.5 * (tier - 1)) * clamp(d.hp, 1, 2.2);
    this.boss = {
      x: this.w / 2,
      y: -120 * this.u,
      t: 0,
      state: 'enter',
      hp,
      max: hp,
      tier,
      name,
      turrets: [
        { ox: -52, oy: 16, hp: 45 * (1 + 0.35 * (tier - 1)), max: 45 * (1 + 0.35 * (tier - 1)), alive: true, cool: 1.2, burstLeft: 0, burstT: 0 },
        { ox: 52, oy: 16, hp: 45 * (1 + 0.35 * (tier - 1)), max: 45 * (1 + 0.35 * (tier - 1)), alive: true, cool: 1.9, burstLeft: 0, burstT: 0 },
      ],
      pattern: 0,
      pT: 0,
      sprayT: 0.8,
      sprayAngle: 0,
      dropT: 0,
      spawnT: 0,
      dieT: 0,
      dieFx: 0,
      flash: 0,
    };
    this.pushBanner(name, 'DESTROY THE TURRETS, THEN THE CORE', '#f472b6', 2.6);
  }

  private updateBoss(dt: number) {
    const b = this.boss;
    if (!b) return;
    b.t += dt;
    b.flash = Math.max(0, b.flash - dt * 6);
    const sc = this.u;
    const baseY = this.h * 0.2;
    const d = this.diff();

    if (b.state === 'enter') {
      b.y = lerp(b.y, baseY, 1 - Math.exp(-dt * 1.6));
      if (b.y > baseY - 8 * sc) b.state = 'fight';
      return;
    }

    if (b.state === 'die') {
      b.dieT += dt;
      b.dieFx -= dt;
      b.y += Math.sin(b.t * 30) * 0.4;
      if (b.dieFx <= 0) {
        b.dieFx = 0.08;
        this.explode(b.x + rand(-70, 70) * sc, b.y + rand(-34, 34) * sc, Math.random() < 0.4 ? '#f472b6' : '#fbbf24', randi(8, 16), 1.3);
        this.shake = Math.min(1, this.shake + 0.15);
        if (Math.random() < 0.5) sfx.play('boom');
      }
      if (b.dieT > 1.5) this.finishBossDeath();
      return;
    }

    // movement + patterns
    b.pT += dt;
    const patterns = b.tier >= 3 ? [0, 1, 2, 3] : b.tier >= 2 ? [0, 1, 2] : [0, 1];
    const cur = patterns[b.pattern % patterns.length];
    if (b.pT > 4.6) {
      b.pT = 0;
      b.pattern += 1;
    }
    const sway = Math.min(this.w * 0.24, 110);
    if (cur === 2) {
      // sweep across the screen
      const p = (b.pT % 4.6) / 4.6;
      const tri = p < 0.5 ? p * 2 : (1 - p) * 2;
      b.x = lerp(this.w * 0.18, this.w * 0.82, tri);
      b.y = lerp(b.y, baseY + 26 * sc, dt * 2);
      b.dropT -= dt;
      if (b.dropT <= 0) {
        b.dropT = 0.15;
        for (const off of [-30, 30]) {
          this.eBullets.push({
            x: b.x + off * sc + rand(-8, 8),
            y: b.y + 30 * sc,
            vx: rand(-12, 12),
            vy: 195 * sc * d.bullet,
            r: 5 * sc,
            color: '#f472b6',
          });
        }
      }
    } else {
      b.x = this.w / 2 + Math.sin(b.t * 0.55) * sway;
      b.y = lerp(b.y, baseY + Math.sin(b.t * 0.9) * 7 * sc, dt * 2);
    }

    if (cur === 0) {
      b.sprayT -= dt;
      if (b.sprayT <= 0) {
        b.sprayT = 0.95;
        const count = 10 + b.tier * 2;
        b.sprayAngle += 0.42;
        for (let i = 0; i < count; i++) {
          const a = b.sprayAngle + (TAU * i) / count;
          this.eBullets.push({
            x: b.x + Math.cos(a) * 24 * sc,
            y: b.y + Math.sin(a) * 24 * sc,
            vx: Math.cos(a) * 135 * sc * d.bullet,
            vy: Math.sin(a) * 135 * sc * d.bullet,
            r: 5 * sc,
            color: '#f472b6',
          });
        }
      }
    }

    if (cur === 1) {
      for (const t of b.turrets) {
        if (!t.alive) continue;
        const tx = b.x + t.ox * sc;
        const ty = b.y + t.oy * sc;
        if (t.burstLeft > 0) {
          t.burstT -= dt;
          if (t.burstT <= 0) {
            t.burstT = 0.15;
            t.burstLeft -= 1;
            const a = Math.atan2(this.py - ty, this.px - tx);
            const sp = 215 * sc * d.bullet;
            this.eBullets.push({ x: tx, y: ty, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: 5 * sc, color: '#fb923c' });
          }
        } else {
          t.cool -= dt;
          if (t.cool <= 0) {
            t.cool = 1.6;
            t.burstLeft = 3;
            t.burstT = 0;
          }
        }
      }
    }

    if (cur === 3) {
      b.spawnT -= dt;
      const scouts = this.enemies.filter((e) => e.kind === 'scout').length;
      if (b.spawnT <= 0 && scouts < 5) {
        b.spawnT = 1.1;
        this.spawnEnemy('scout', clamp(b.x + rand(-80, 80) * sc, 26, this.w - 26), b.y + 30 * sc);
      }
    }

    // player ramming the boss
    if (this.invuln <= 0 && this.pw.shield <= 0) {
      const rr = (44 * sc + 11 * sc) ** 2;
      if (dist2(b.x, b.y, this.px, this.py) < rr) this.damagePlayer();
    }
  }

  private startBossDeath() {
    const b = this.boss!;
    b.state = 'die';
    b.dieT = 0;
    sfx.play('bigboom');
  }

  private finishBossDeath() {
    const b = this.boss!;
    this.boss = null;
    const tier = b.tier;
    const bonus = 1500 + 500 * (tier - 1);
    this.score += bonus;
    this.addFloat(b.x, b.y, `+${bonus}`, '#f472b6', 20);
    this.explode(b.x, b.y, '#ffffff', 40, 2.2);
    this.explode(b.x, b.y, '#f472b6', 34, 1.8);
    this.shake = 1;
    sfx.play('bigboom');
    const total = 18 + 6 * tier;
    for (let i = 0; i < total; i++) {
      this.spawnCoin(b.x + rand(-40, 40) * this.u, b.y + rand(-20, 30) * this.u, rand(120, 260));
    }
    this.dropPowerup(b.x, b.y - 10);
    this.bossKillsRun += 1;
    this.pendBossKills += 1;
    this.nextBoss = this.score + 8000;
    this.pushBanner('CAPITAL SHIP DESTROYED', `+${bonus} POINTS — SALVAGE SECURED`, '#4ade80', 2.6);
    this.checkAchievements(true);
  }

  // ── pickups ────────────────────────────────────────────────────────────────
  private spawnCoin(x: number, y: number, force: number) {
    const a = rand(-Math.PI * 0.85, -Math.PI * 0.15);
    this.coinsArr.push({
      x,
      y,
      vx: Math.cos(a) * force,
      vy: Math.sin(a) * force,
      t: rand(0, TAU),
    });
  }

  private dropPowerup(x: number, y: number) {
    const pool = POWERUPS.filter((p) => p.minScore <= this.score);
    let total = 0;
    for (const p of pool) total += p.weight;
    let roll = Math.random() * total;
    let def = pool[0];
    for (const p of pool) {
      roll -= p.weight;
      if (roll <= 0) {
        def = p;
        break;
      }
    }
    this.powers.push({ x: clamp(x, 30, this.w - 30), y, vy: 62 * this.u, t: rand(0, TAU), type: def.id, color: def.color });
  }

  private updatePickups(dt: number) {
    const magnetActive = this.pw.magnet > 0;
    const mr = magnetActive ? this.magnetRBig * this.u : this.magnetR * this.u;
    for (let i = this.coinsArr.length - 1; i >= 0; i--) {
      const c = this.coinsArr[i];
      c.t += dt * 6;
      c.vy = lerp(c.vy, 46 * this.u, dt * 1.4);
      const dx = this.px - c.x;
      const dy = this.py - c.y;
      const dSq = dx * dx + dy * dy;
      if (dSq < mr * mr && this.mode !== 'dying') {
        const dlen = Math.sqrt(dSq) || 1;
        const pull = (magnetActive ? 1900 : 1050) * (1 - dlen / (mr * 1.15));
        c.vx += (dx / dlen) * pull * dt;
        c.vy += (dy / dlen) * pull * dt;
      }
      c.vx *= 1 - 1.4 * dt;
      c.vy *= 1 - 0.5 * dt;
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      if (dSq < 26 * 26 * this.u * this.u && this.mode !== 'dying') {
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
      if (this.mode !== 'dying' && dist2(p.x, p.y, this.px, this.py) < (30 * this.u) ** 2) {
        this.powers.splice(i, 1);
        this.applyPowerup(p);
      }
    }
  }

  private collectCoin(x: number, y: number) {
    this.runCoins += 1;
    this.pendCoins += 1;
    this.score += 5;
    this.burst(x, y, '#fbbf24', 5, 120);
    sfx.play('coin');
  }

  private applyPowerup(p: PowerEnt) {
    const dur = p.type === 'shield' ? this.shieldDur : (POWERUPS.find((d) => d.id === p.type)?.duration ?? 8);
    this.pw[p.type] = dur;
    this.pwMax[p.type] = dur;
    this.score += 25;
    if (p.type === 'shield') this.rippleT = 1;
    const name = POWERUPS.find((d) => d.id === p.type)?.name ?? 'POWER UP';
    this.pushBanner(name, 'TEMPORARY BOOST ONLINE', p.color, 1.6);
    this.addFloat(p.x, p.y, '+25', p.color, 12);
    this.burst(p.x, p.y, p.color, 16, 200);
    sfx.play('powerup');
    this.emitHud();
  }

  // ── particles / text ───────────────────────────────────────────────────────
  private burst(x: number, y: number, color: string, n: number, speed: number) {
    for (let i = 0; i < n; i++) {
      if (this.parts.length > 300) this.parts.shift();
      const a = rand(0, TAU);
      const sp = rand(speed * 0.3, speed) * this.u;
      this.parts.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 0,
        max: rand(0.2, 0.45),
        size: rand(3, 7) * this.u,
        color,
        drag: 2.6,
        grav: 0,
      });
    }
  }

  private explode(x: number, y: number, color: string, n: number, power: number) {
    for (let i = 0; i < n; i++) {
      if (this.parts.length > 300) this.parts.shift();
      const a = rand(0, TAU);
      const sp = rand(30, 190 * power) * this.u;
      this.parts.push({
        x: x + rand(-4, 4),
        y: y + rand(-4, 4),
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 0,
        max: rand(0.35, 0.9) * power,
        size: rand(5, 13) * this.u * power,
        color: Math.random() < 0.3 ? '#ffffff' : color,
        drag: 1.9,
        grav: 40,
      });
    }
  }

  private updateParticles(dt: number) {
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.life += dt;
      if (p.life >= p.max) {
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
    // banners play sequentially — never stomp each other
    if (this.banners.length) {
      const b = this.banners[0];
      b.t += dt;
      if (b.t >= b.max) this.banners.shift();
    }
  }

  // ── milestones: checkpoints, achievements, best ─────────────────────────────
  private checkMilestones() {
    const save = this.api.getSave();
    for (const cp of CHECKPOINTS) {
      if (this.score >= cp && !save.checkpoints.includes(cp)) {
        this.newCheckpoints.push(cp);
        this.api.commit((s) => (s.checkpoints.includes(cp) ? s : { ...s, checkpoints: [...s.checkpoints, cp].sort((a, b) => a - b) }));
        this.pushBanner(`CHECKPOINT ${cp} SECURED`, 'LAUNCH POINT UNLOCKED FOREVER', '#4ade80', 2.6);
        sfx.play('checkpoint');
        this.burst(this.px, this.py - 40 * this.u, '#4ade80', 18, 240);
      }
    }
    const lvl = clamp(1 + Math.floor(this.diff().c), 1, 15);
    if (lvl > this.level) {
      this.level = lvl;
      if (lvl > this.levelBannered && lvl <= 8) {
        this.levelBannered = lvl;
        this.pushBanner(`THREAT LEVEL ${lvl}`, 'HOSTILE DENSITY INCREASING', '#fb923c', 1.6);
      }
    }
    this.checkAchievements(false);
  }

  private checkAchievements(final: boolean) {
    void final;
    const save = this.api.getSave();
    const owned = new Set([...save.achievements, ...this.unlockedAch]);
    const grant: string[] = [];
    const kills = save.stats.kills + this.pendKills;
    const totalCoins = save.stats.totalCoins + this.pendCoins;
    if (!owned.has('kills100') && kills >= 100) grant.push('kills100');
    if (!owned.has('coins500') && totalCoins >= 500) grant.push('coins500');
    if (!owned.has('survive300') && this.runTime >= 300) grant.push('survive300');
    if (!owned.has('score10k') && this.score >= 10000) grant.push('score10k');
    if (!owned.has('boss1') && this.bossKillsRun > 0) grant.push('boss1');
    if (!grant.length) return;
    for (const id of grant) {
      this.unlockedAch.push(id);
      this.pendAch.push(id);
      const def = ACHIEVEMENT_MAP[id];
      this.pushBanner(`ACHIEVEMENT — ${def.name}`, `+${def.reward} COINS AWARDED`, '#fbbf24', 2.4);
      sfx.play('checkpoint');
    }
    this.flush(true);
  }

  // ── persistence flush ──────────────────────────────────────────────────────
  private flush(force: boolean) {
    if (!force && !this.pendCoins && !this.pendKills) return;
    const dCoins = this.pendCoins;
    const dKills = this.pendKills;
    const dBoss = this.pendBossKills;
    const ach = [...this.pendAch];
    const newBest = Math.floor(this.score) > this.api.getSave().best ? Math.floor(this.score) : 0;
    this.pendCoins = 0;
    this.pendKills = 0;
    this.pendBossKills = 0;
    this.pendAch = [];
    let reward = 0;
    for (const id of ach) reward += ACHIEVEMENT_MAP[id]?.reward ?? 0;
    if (!dCoins && !dKills && !ach.length && !newBest && !dBoss) {
      this.emitHud();
      return;
    }
    this.api.commit((s) => {
      const achievements = [...s.achievements];
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
    this.checkAchievements(true);
    const finalScore = Math.floor(this.score);
    const save = this.api.getSave();
    const newBest = finalScore > save.best;
    const dCoins = this.pendCoins;
    const dKills = this.pendKills;
    const dBoss = this.pendBossKills;
    // any achievement unlocked in the final check still grants its reward once
    const lateAch = [...this.pendAch];
    this.pendAch = [];
    let reward = 0;
    for (const id of lateAch) reward += ACHIEVEMENT_MAP[id]?.reward ?? 0;
    this.pendCoins = 0;
    this.pendKills = 0;
    this.pendBossKills = 0;
    this.api.commit((s) => ({
      ...s,
      best: Math.max(s.best, finalScore),
      coins: s.coins + dCoins + reward,
      achievements: [...new Set([...s.achievements, ...this.unlockedAch])],
      stats: {
        ...s.stats,
        kills: s.stats.kills + dKills,
        totalCoins: s.stats.totalCoins + dCoins,
        bossKills: s.stats.bossKills + dBoss,
        bestTime: Math.max(s.stats.bestTime, Math.floor(this.runTime)),
      },
    }));
    const result: RunResult = {
      score: finalScore,
      best: Math.max(save.best, finalScore),
      newBest,
      coins: this.runCoins,
      kills: this.runKills,
      time: Math.floor(this.runTime),
      level: this.level,
      startCheckpoint: this.startCp,
      newCheckpoints: [...this.newCheckpoints],
      newAchievements: [...this.unlockedAch],
      bossKills: this.bossKillsRun,
    };
    this.mode = 'over';
    sfx.stopAmbient();
    this.api.onGameOver(result);
    this.emitHud();
  }

  // ── HUD ────────────────────────────────────────────────────────────────────
  private emitHud() {
    const save = this.api.getSave();
    const powerups: HudState['powerups'] = [];
    for (const k of Object.keys(this.pw) as PowerupType[]) {
      if (this.pw[k] > 0 && k !== 'shield') {
        powerups.push({ type: k, left: this.pw[k], total: this.pwMax[k] || 1 });
      }
    }
    this.api.onHud({
      score: Math.floor(this.score),
      best: Math.max(save.best, Math.floor(this.score)),
      coins: save.coins + this.pendCoins,
      hp: this.hp,
      maxHp: this.maxHp,
      level: this.level,
      shielded: this.pw.shield > 0,
      powerups,
      boss: this.boss ? { hp: Math.max(0, this.boss.hp), max: this.boss.max, name: this.boss.name } : null,
      elapsed: this.runTime,
      muted: save.muted,
      paused: this.paused,
    });
  }

  // ── background update ──────────────────────────────────────────────────────
  private updateBackground(dt: number, speed: number) {
    for (const st of this.stars) {
      const v = (st.z === 0 ? 26 : st.z === 1 ? 64 : 130) * speed * this.u;
      st.y += v * dt;
      st.tw += dt * 3;
      if (st.y > this.h + 4) {
        st.y = -4;
        st.x = Math.random() * this.w;
      }
    }
    for (const n of this.nebulas) {
      n.y += n.vy * speed * dt;
      if (n.y - n.r > this.h) {
        n.y = -n.r;
        n.x = rand(0.1, 0.9) * this.w;
      }
    }
    // shooting stars
    if (this.shootStar) {
      const s = this.shootStar;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.life -= dt;
      if (s.life <= 0 || s.x > this.w + 80) this.shootStar = null;
    } else {
      this.shootT -= dt;
      if (this.shootT <= 0) {
        this.shootT = rand(5, 11);
        this.shootStar = {
          x: rand(-40, this.w * 0.5),
          y: rand(0, this.h * 0.3),
          vx: rand(380, 620) * this.u,
          vy: rand(120, 220) * this.u,
          life: rand(0.7, 1.1),
        };
      }
    }
  }

  // ── rendering ──────────────────────────────────────────────────────────────
  private render() {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.w, this.h);

    // space gradient
    const bg = ctx.createLinearGradient(0, 0, 0, this.h);
    bg.addColorStop(0, '#070b1c');
    bg.addColorStop(0.5, '#05070f');
    bg.addColorStop(1, '#03040c');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, this.w, this.h);

    // nebulas
    for (const n of this.nebulas) {
      const color = n.hue === 0 ? 'rgba(99,60,180,0.16)' : n.hue === 1 ? 'rgba(24,80,140,0.15)' : 'rgba(150,40,110,0.1)';
      drawGlow(ctx, color, n.x, n.y, n.r, 1);
    }

    // distant planet in the menu / hangover backdrop
    if (this.mode === 'menu' || this.mode === 'over') {
      const px = this.w * 0.78;
      const py = this.h * 0.15;
      const pr = 72 * this.u;
      drawGlow(ctx, 'rgba(80,140,255,0.28)', px, py, pr * 2.6, 0.9);
      const pg = ctx.createRadialGradient(px - pr * 0.4, py - pr * 0.45, pr * 0.1, px, py, pr);
      pg.addColorStop(0, '#2b4d8f');
      pg.addColorStop(0.55, '#12264d');
      pg.addColorStop(1, '#050b1c');
      ctx.fillStyle = pg;
      ctx.beginPath();
      ctx.arc(px, py, pr, 0, TAU);
      ctx.fill();
      // terminator shadow
      ctx.fillStyle = 'rgba(2,4,12,0.55)';
      ctx.beginPath();
      ctx.arc(px + pr * 0.34, py + pr * 0.18, pr * 0.92, 0, TAU);
      ctx.arc(px, py, pr, 0, TAU);
      ctx.fill('evenodd');
      // rim light
      ctx.strokeStyle = 'rgba(120,180,255,0.35)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(px, py, pr, Math.PI * 0.9, Math.PI * 1.9);
      ctx.stroke();
      // ring
      ctx.strokeStyle = 'rgba(140,170,255,0.16)';
      ctx.lineWidth = 5 * this.u;
      ctx.beginPath();
      ctx.ellipse(px, py, pr * 1.7, pr * 0.42, -0.28, Math.PI * 0.95, Math.PI * 1.95);
      ctx.stroke();
    }

    // stars
    const playing = this.mode === 'playing' || this.mode === 'dying' || this.mode === 'intro';
    const stretch = playing ? 1 + Math.min(1.6, this.diff().c * 0.12) : 0.5;
    for (const st of this.stars) {
      const baseA = st.z === 0 ? 0.35 : st.z === 1 ? 0.6 : 0.95;
      const a = baseA * (0.72 + 0.28 * Math.sin(st.tw));
      ctx.fillStyle = st.z === 2 ? `rgba(190,230,255,${a})` : `rgba(220,228,255,${a})`;
      const sz = (st.z === 0 ? 1 : st.z === 1 ? 1.4 : 2) * this.u;
      if (st.z === 2 && stretch > 1.05) {
        ctx.fillRect(st.x, st.y, 1.2 * this.u, sz * (2.4 * stretch));
      } else {
        ctx.fillRect(st.x, st.y, sz, sz);
      }
    }

    // shooting star streak
    if (this.shootStar) {
      const s = this.shootStar;
      const a = clamp(s.life / 0.9, 0, 1);
      const tail = 0.14;
      ctx.save();
      ctx.globalAlpha = a;
      const grad = ctx.createLinearGradient(s.x, s.y, s.x - s.vx * tail, s.y - s.vy * tail);
      grad.addColorStop(0, 'rgba(220,240,255,0.95)');
      grad.addColorStop(1, 'rgba(220,240,255,0)');
      ctx.strokeStyle = grad;
      ctx.lineWidth = 1.6 * this.u;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(s.x - s.vx * tail, s.y - s.vy * tail);
      ctx.stroke();
      ctx.restore();
      drawGlow(ctx, 'rgba(190,225,255,0.8)', s.x, s.y, 8 * this.u, a, true);
    }

    // camera shake
    ctx.save();
    if (this.shake > 0) {
      const s2 = this.shake * this.shake * 16 * this.u;
      ctx.translate(rand(-s2, s2), rand(-s2, s2));
    }

    // pickups
    for (const c of this.coinsArr) {
      drawGlow(ctx, 'rgba(251,191,36,0.5)', c.x, c.y, 13 * this.u, 0.7);
      ctx.save();
      ctx.translate(c.x, c.y);
      drawCoinDisc(ctx, 6.4 * this.u, c.t);
      ctx.restore();
    }
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
        e.kind === 'scout' ? 'rgba(244,63,94,0.4)' : e.kind === 'weaver' ? 'rgba(192,132,252,0.4)' : e.kind === 'gunner' ? 'rgba(251,146,60,0.4)' : e.kind === 'diver' ? 'rgba(239,68,68,0.45)' : 'rgba(220,38,38,0.5)';
      drawGlow(ctx, glowColor, e.x, e.y, e.r * 1.9, 0.8);
      ctx.save();
      ctx.translate(e.x, e.y);
      if (e.kind === 'diver' && e.state === 2) ctx.rotate(Math.atan2(e.vy, e.vx) - Math.PI / 2);
      drawEnemyKind(ctx, e.kind, e.r, e.t, e.flash);
      // hp bar for tougher foes
      if (e.maxHp > 10 && e.hp < e.maxHp) {
        const w = e.r * 1.7;
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(-w / 2, -e.r - 8 * this.u, w, 3);
        ctx.fillStyle = '#f87171';
        ctx.fillRect(-w / 2, -e.r - 8 * this.u, w * clamp(e.hp / e.maxHp, 0, 1), 3);
      }
      ctx.restore();
    }

    // boss
    if (this.boss) this.renderBoss(ctx, this.boss);

    // enemy bullets
    for (const b of this.eBullets) {
      drawGlow(ctx, b.color, b.x, b.y, b.r * 2.6, 0.9, true);
      ctx.fillStyle = '#fff1f2';
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r * 0.55, 0, TAU);
      ctx.fill();
    }

    // player
    if (this.mode !== 'over' && this.mode !== 'dying' && this.mode !== 'menu') {
      const blink = this.invuln > 0 && Math.floor(this.time * 14) % 2 === 0 && this.mode === 'playing';
      if (!blink) {
        ctx.save();
        ctx.translate(this.px, this.py);
        ctx.rotate(this.bank);
        ctx.scale(this.u * 1.06, this.u * 1.06);
        drawGlow(ctx, 'rgba(34,211,238,0.35)', 0, 4, 34, 0.9);
        drawShip(ctx, this.shipId, this.time, this.pointerActive ? 1 : 0.6);
        ctx.restore();
        if (this.muzzleT > 0) {
          drawGlow(ctx, '#a5f3fc', this.px, this.py - 20 * this.u, 13 * this.u * (this.muzzleT / 0.05), 0.95, true);
        }
        // shield bubble
        if (this.pw.shield > 0) {
          const st = this.time * 2.2;
          ctx.save();
          ctx.translate(this.px, this.py);
          drawGlow(ctx, 'rgba(34,211,238,0.5)', 0, 0, 40 * this.u, 0.75);
          ctx.rotate(st * 0.4);
          ctx.strokeStyle = 'rgba(165,243,252,0.85)';
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          const R = 30 * this.u;
          for (let i = 0; i < 6; i++) {
            const a = (TAU * i) / 6;
            const px = Math.cos(a) * R;
            const py = Math.sin(a) * R;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.closePath();
          ctx.stroke();
          ctx.restore();
          if (this.rippleT > 0) {
            ctx.save();
            ctx.translate(this.px, this.py);
            ctx.globalAlpha = this.rippleT;
            ctx.strokeStyle = '#a5f3fc';
            ctx.lineWidth = 2.4;
            ctx.beginPath();
            ctx.arc(0, 0, 30 * this.u + (1 - this.rippleT) * 26 * this.u, 0, TAU);
            ctx.stroke();
            ctx.restore();
          }
        }
      }
    }

    // player bullets
    for (const b of this.pBullets) {
      const color = b.power ? '#f472b6' : '#67e8f9';
      drawGlow(ctx, color, b.x, b.y, b.r * 3, 0.9, true);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      const ang = Math.atan2(b.vy, b.vx);
      ctx.ellipse(b.x, b.y, b.r * 0.55, b.r * 1.7, ang + Math.PI / 2, 0, TAU);
      ctx.fill();
    }

    // particles (additive)
    for (const p of this.parts) {
      const lifeK = 1 - p.life / p.max;
      drawGlow(ctx, p.color, p.x, p.y, p.size * (0.5 + lifeK), lifeK);
    }

    ctx.restore();

    // floaters
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

    // banners (only the active one)
    if (this.banners.length) {
      const b = this.banners[0];
      const inK = clamp(b.t / 0.22, 0, 1);
      const outK = clamp((b.max - b.t) / 0.3, 0, 1);
      const a = Math.min(inK, outK);
      const scale = 0.85 + 0.15 * inK;
      const cx = this.w / 2;
      const cy = this.h * 0.3;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.translate(cx, cy);
      ctx.scale(scale, scale);
      ctx.textAlign = 'center';
      try {
        (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${3.5 * this.u}px`;
      } catch {
        /* unsupported */
      }
      drawGlow(ctx, b.color, 0, 0, 120 * this.u, 0.4 * a);
      ctx.font = `800 ${24 * this.u}px "Avenir Next", system-ui, sans-serif`;
      ctx.fillStyle = b.color;
      ctx.fillText(b.text, 0, 0);
      if (b.sub) {
        ctx.font = `600 ${10 * this.u}px "Avenir Next", system-ui, sans-serif`;
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

    // vignette
    if (this.vignette) ctx.drawImage(this.vignette, 0, 0, this.w, this.h);

    // hurt flash
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

    // critical integrity heartbeat
    if (this.mode === 'playing' && this.hp === 1 && this.pw.shield <= 0) {
      ctx.save();
      ctx.globalAlpha = 0.1 + 0.07 * Math.sin(this.time * 5.5);
      const g = ctx.createRadialGradient(this.w / 2, this.h / 2, this.h * 0.24, this.w / 2, this.h / 2, this.h * 0.72);
      g.addColorStop(0, 'rgba(239,68,68,0)');
      g.addColorStop(1, 'rgba(239,68,68,0.85)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, this.w, this.h);
      ctx.restore();
    }

    // boss warning frame pulse
    if (this.bossWarnT > 0) {
      ctx.save();
      ctx.globalAlpha = 0.25 + 0.25 * Math.sin(this.time * 14);
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 5 * this.u;
      ctx.strokeRect(0, 0, this.w, this.h);
      ctx.restore();
    }

    // first-seconds control hint
    if (this.mode === 'playing' && this.runTime < 3 && !this.pointerActive) {
      const a = clamp(3 - this.runTime, 0, 1);
      ctx.save();
      ctx.globalAlpha = a * (0.65 + 0.35 * Math.sin(this.time * 5));
      ctx.textAlign = 'center';
      ctx.font = `700 ${13 * this.u}px "Avenir Next", system-ui, sans-serif`;
      ctx.fillStyle = '#a5f3fc';
      const hy = this.py - 64 * this.u;
      ctx.fillText('TOUCH + DRAG TO FLY', this.w / 2, hy);
      ctx.strokeStyle = 'rgba(165,243,252,0.6)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(this.w / 2 + Math.sin(this.time * 2.4) * 40 * this.u, hy + 26 * this.u, 12 * this.u, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }
  }

  private renderBoss(ctx: CanvasRenderingContext2D, b: Boss) {
    const sc = this.u;
    ctx.save();
    ctx.translate(b.x, b.y);
    const tierColors = ['#f472b6', '#fb7185', '#c084fc', '#fb923c', '#f87171', '#f472b6'];
    const accent = tierColors[(b.tier - 1) % tierColors.length];

    drawGlow(ctx, accent, 0, 0, 110 * sc, 0.55);

    // hull — broad menacing wedge
    const hg = ctx.createLinearGradient(0, -46 * sc, 0, 44 * sc);
    hg.addColorStop(0, '#1e293b');
    hg.addColorStop(0.55, '#0f172a');
    hg.addColorStop(1, '#020617');
    ctx.fillStyle = hg;
    ctx.beginPath();
    ctx.moveTo(0, 44 * sc);
    ctx.lineTo(-30 * sc, 30 * sc);
    ctx.lineTo(-84 * sc, 6 * sc);
    ctx.lineTo(-70 * sc, -20 * sc);
    ctx.lineTo(-26 * sc, -34 * sc);
    ctx.lineTo(0, -44 * sc);
    ctx.lineTo(26 * sc, -34 * sc);
    ctx.lineTo(70 * sc, -20 * sc);
    ctx.lineTo(84 * sc, 6 * sc);
    ctx.lineTo(30 * sc, 30 * sc);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = accent;
    ctx.globalAlpha = 0.85;
    ctx.lineWidth = 1.6;
    ctx.stroke();
    ctx.globalAlpha = 1;

    // plating lines
    ctx.strokeStyle = 'rgba(148,163,184,0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-60 * sc, -4 * sc);
    ctx.lineTo(60 * sc, -4 * sc);
    ctx.moveTo(-40 * sc, -22 * sc);
    ctx.lineTo(40 * sc, -22 * sc);
    ctx.moveTo(-24 * sc, 16 * sc);
    ctx.lineTo(24 * sc, 16 * sc);
    ctx.stroke();

    // spiky fins
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.moveTo(-84 * sc, 6 * sc);
    ctx.lineTo(-102 * sc, -6 * sc);
    ctx.lineTo(-80 * sc, -12 * sc);
    ctx.moveTo(84 * sc, 6 * sc);
    ctx.lineTo(102 * sc, -6 * sc);
    ctx.lineTo(80 * sc, -12 * sc);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = accent;
    ctx.stroke();

    // core — pulsating, shifts red as hp drops
    const hpK = clamp(b.hp / b.max, 0, 1);
    const pulse = 0.8 + 0.2 * Math.sin(b.t * 4);
    const coreR = 17 * sc * pulse;
    const coreColor = hpK > 0.6 ? '#22d3ee' : hpK > 0.3 ? '#fbbf24' : '#ef4444';
    drawGlow(ctx, coreColor, 0, 2 * sc, 34 * sc * pulse, 1, true);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 2 * sc, coreR * 0.5, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = coreColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 2 * sc, coreR * 0.85, b.t * 1.4, b.t * 1.4 + TAU * 0.8);
    ctx.stroke();

    // turrets
    for (const t of b.turrets) {
      const tx = t.ox * sc;
      const ty = t.oy * sc;
      if (t.alive) {
        drawGlow(ctx, '#fb923c', tx, ty, 20 * sc, 0.8, true);
        ctx.fillStyle = '#292524';
        ctx.beginPath();
        ctx.arc(tx, ty, 12 * sc, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = '#fb923c';
        ctx.lineWidth = 1.4;
        ctx.stroke();
        // barrel aims at player
        const wa = Math.atan2(this.py - (b.y + ty), this.px - (b.x + tx));
        ctx.save();
        ctx.translate(tx, ty);
        ctx.rotate(wa);
        ctx.fillStyle = '#44403c';
        ctx.fillRect(6 * sc, -2.4 * sc, 15 * sc, 4.8 * sc);
        ctx.fillStyle = '#fdba74';
        ctx.fillRect(19 * sc, -2.4 * sc, 2.6 * sc, 4.8 * sc);
        ctx.restore();
      } else {
        ctx.fillStyle = '#0c0a09';
        ctx.beginPath();
        ctx.arc(tx, ty, 12 * sc, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = 'rgba(120,113,108,0.5)';
        ctx.stroke();
        if (Math.random() < 0.06) {
          this.parts.push({
            x: b.x + tx,
            y: b.y + ty,
            vx: rand(-8, 8),
            vy: rand(14, 34),
            life: 0,
            max: rand(0.5, 1),
            size: rand(6, 12) * sc,
            color: 'rgba(120,120,130,0.5)',
            drag: 0.4,
            grav: -12,
          });
        }
      }
    }

    if (b.flash > 0) {
      ctx.globalAlpha = b.flash * 0.5;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(0, 44 * sc);
      ctx.lineTo(-84 * sc, 6 * sc);
      ctx.lineTo(0, -44 * sc);
      ctx.lineTo(84 * sc, 6 * sc);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  }
}
