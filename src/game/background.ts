// ── Background subsystem — stars, nebulas, planet, shooting star, vignette ──
// Pure cosmetic layer: owns no gameplay state and is driven only by update().

import { drawGlow } from './sprites';

const TAU = Math.PI * 2;
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

interface Star {
  x: number;
  y: number;
  z: number;
  tw: number;
}

interface Nebula {
  x: number;
  y: number;
  r: number;
  vy: number;
  hue: number;
}

interface ShootStar {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
}

export interface BgRenderOpts {
  w: number;
  h: number;
  u: number;
  time: number;
  /** red ambient for hardcore */
  hardcore: boolean;
  /** menu / game-over ambience shows the planet */
  menuPhase: boolean;
  /** star elongation for the sense of speed */
  stretch: number;
}

export class Background {
  private stars: Star[] = [];
  private nebulas: Nebula[] = [];
  private vignette: HTMLCanvasElement | null = null;
  private shoot: ShootStar | null = null;
  private shootT = 5;

  /** Regenerate layout (debounced by the engine on resize). */
  resize(w: number, h: number, u: number) {
    const stars: Star[] = [];
    for (let i = 0; i < 110; i++) {
      stars.push({
        x: Math.random() * w,
        y: Math.random() * h,
        z: Math.random() < 0.5 ? 0 : Math.random() < 0.7 ? 1 : 2,
        tw: Math.random() * TAU,
      });
    }
    this.stars = stars;
    const nebulas: Nebula[] = [];
    for (let i = 0; i < 4; i++) {
      nebulas.push({
        x: (0.1 + Math.random() * 0.8) * w,
        y: (-0.2 + Math.random() * 1.2) * h,
        r: (120 + Math.random() * 140) * u,
        vy: 3 + Math.random() * 4,
        hue: Math.floor(Math.random() * 3),
      });
    }
    this.nebulas = nebulas;

    const c = document.createElement('canvas');
    c.width = Math.max(2, Math.round(w));
    c.height = Math.max(2, Math.round(h));
    const g = c.getContext('2d')!;
    const grad = g.createRadialGradient(
      w / 2,
      h * 0.42,
      Math.min(w, h) * 0.34,
      w / 2,
      h * 0.5,
      Math.max(w, h) * 0.78,
    );
    grad.addColorStop(0, 'rgba(2,4,12,0)');
    grad.addColorStop(0.75, 'rgba(2,4,12,0.28)');
    grad.addColorStop(1, 'rgba(1,2,8,0.72)');
    g.fillStyle = grad;
    g.fillRect(0, 0, c.width, c.height);
    this.vignette = c;
  }

  update(dt: number, speed: number, w: number, h: number, u: number) {
    for (const st of this.stars) {
      const v = (st.z === 0 ? 26 : st.z === 1 ? 64 : 130) * speed * u;
      st.y += v * dt;
      st.tw += dt * 3;
      if (st.y > h + 4) {
        st.y = -4;
        st.x = Math.random() * w;
      }
    }
    for (const n of this.nebulas) {
      n.y += n.vy * speed * dt;
      if (n.y - n.r > h) {
        n.y = -n.r;
        n.x = (0.1 + Math.random() * 0.8) * w;
      }
    }
    if (this.shoot) {
      const s = this.shoot;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.life -= dt;
      if (s.life <= 0 || s.x > w + 80) this.shoot = null;
    } else {
      this.shootT -= dt;
      if (this.shootT <= 0) {
        this.shootT = 5 + Math.random() * 6;
        this.shoot = {
          x: -40 + Math.random() * w * 0.5,
          y: Math.random() * h * 0.3,
          vx: (380 + Math.random() * 240) * u,
          vy: (120 + Math.random() * 100) * u,
          life: 0.7 + Math.random() * 0.4,
        };
      }
    }
  }

  renderSpace(ctx: CanvasRenderingContext2D, o: BgRenderOpts) {
    const { w, h, u, hardcore, menuPhase, stretch } = o;

    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, hardcore ? '#1a0709' : '#070b1c');
    bg.addColorStop(0.5, '#05070f');
    bg.addColorStop(1, '#03040c');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    for (const n of this.nebulas) {
      const color = hardcore
        ? 'rgba(140,20,30,0.14)'
        : n.hue === 0
          ? 'rgba(99,60,180,0.16)'
          : n.hue === 1
            ? 'rgba(24,80,140,0.15)'
            : 'rgba(150,40,110,0.1)';
      drawGlow(ctx, color, n.x, n.y, n.r, 1);
    }

    if (menuPhase) this.renderPlanet(ctx, w, h, u);

    for (const st of this.stars) {
      const baseA = st.z === 0 ? 0.35 : st.z === 1 ? 0.6 : 0.95;
      const a = baseA * (0.72 + 0.28 * Math.sin(st.tw));
      ctx.fillStyle = st.z === 2 ? `rgba(190,230,255,${a})` : `rgba(220,228,255,${a})`;
      const sz = (st.z === 0 ? 1 : st.z === 1 ? 1.4 : 2) * u;
      if (st.z === 2 && stretch > 1.05) ctx.fillRect(st.x, st.y, 1.2 * u, sz * (2.4 * stretch));
      else ctx.fillRect(st.x, st.y, sz, sz);
    }

    if (this.shoot) {
      const s = this.shoot;
      const a = clamp(s.life / 0.9, 0, 1);
      ctx.save();
      ctx.globalAlpha = a;
      const grad = ctx.createLinearGradient(s.x, s.y, s.x - s.vx * 0.14, s.y - s.vy * 0.14);
      grad.addColorStop(0, 'rgba(220,240,255,0.95)');
      grad.addColorStop(1, 'rgba(220,240,255,0)');
      ctx.strokeStyle = grad;
      ctx.lineWidth = 1.6 * u;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(s.x - s.vx * 0.14, s.y - s.vy * 0.14);
      ctx.stroke();
      ctx.restore();
    }
  }

  renderVignette(ctx: CanvasRenderingContext2D, w: number, h: number) {
    if (this.vignette) ctx.drawImage(this.vignette, 0, 0, w, h);
  }

  private renderPlanet(ctx: CanvasRenderingContext2D, w: number, h: number, u: number) {
    const px = w * 0.78;
    const py = h * 0.15;
    const pr = 72 * u;
    drawGlow(ctx, 'rgba(80,140,255,0.28)', px, py, pr * 2.6, 0.9);
    const pg = ctx.createRadialGradient(px - pr * 0.4, py - pr * 0.45, pr * 0.1, px, py, pr);
    pg.addColorStop(0, '#2b4d8f');
    pg.addColorStop(0.55, '#12264d');
    pg.addColorStop(1, '#050b1c');
    ctx.fillStyle = pg;
    ctx.beginPath();
    ctx.arc(px, py, pr, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(2,4,12,0.55)';
    ctx.beginPath();
    ctx.arc(px + pr * 0.34, py + pr * 0.18, pr * 0.92, 0, TAU);
    ctx.arc(px, py, pr, 0, TAU);
    ctx.fill('evenodd');
    ctx.strokeStyle = 'rgba(120,180,255,0.35)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(px, py, pr, Math.PI * 0.9, Math.PI * 1.9);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(140,170,255,0.16)';
    ctx.lineWidth = 5 * u;
    ctx.beginPath();
    ctx.ellipse(px, py, pr * 1.7, pr * 0.42, -0.28, Math.PI * 0.95, Math.PI * 1.95);
    ctx.stroke();
  }
}
