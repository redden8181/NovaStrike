import type { EnemyKind, PowerupType, ShipId } from './types';

// ── Cached radial glow sprites (cheap additive glows, no shadowBlur in loop) ─
const glowCache = new Map<string, HTMLCanvasElement>();

export function glowSprite(color: string, core = false, size = 64): HTMLCanvasElement {
  const key = `${color}|${core ? 1 : 0}|${size}`;
  const hit = glowCache.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  const r = size / 2;
  const grad = g.createRadialGradient(r, r, 0, r, r, r);
  if (core) {
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.25, color);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
  } else {
    grad.addColorStop(0, color);
    grad.addColorStop(0.4, color + '');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
  }
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  glowCache.set(key, c);
  return c;
}

export function drawGlow(
  ctx: CanvasRenderingContext2D,
  color: string,
  x: number,
  y: number,
  radius: number,
  alpha = 1,
  core = false,
) {
  const s = glowSprite(color, core);
  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
  ctx.globalCompositeOperation = 'lighter';
  ctx.drawImage(s, x - radius, y - radius, radius * 2, radius * 2);
  ctx.restore();
}

// ── Player ships (drawn at origin, nose pointing -y) ─────────────────────────
export function drawShip(ctx: CanvasRenderingContext2D, id: ShipId, t: number, thrust = 1) {
  // гибрид: донор-корпус B идёт боковыми модулями, основа A — сверху
  if (typeof id === 'string' && id.startsWith('fused:')) {
    const [a, b] = id.slice(6).split('+') as [ShipId, ShipId];
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.translate(side * 11, 5);
      ctx.scale(side * 0.52, 0.52);
      ctx.globalAlpha = 0.95;
      drawShipBase(ctx, b, t + side * 0.4, thrust * 0.8);
      ctx.restore();
    }
    // шов энергии между корпусами
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = 'rgba(165,243,252,0.5)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-11, 4);
    ctx.lineTo(11, 4);
    ctx.stroke();
    ctx.restore();
    drawShipBase(ctx, a, t, thrust);
    return;
  }
  drawShipBase(ctx, id, t, thrust);
}

function drawShipBase(ctx: CanvasRenderingContext2D, id: ShipId, t: number, thrust: number) {
  switch (id) {
    case 'falcon':
      shipFalcon(ctx, t, thrust);
      break;
    case 'comet':
      shipComet(ctx, t, thrust);
      break;
    case 'titan':
      shipTitan(ctx, t, thrust);
      break;
    case 'nova':
      shipNova(ctx, t, thrust);
      break;
    case 'voidx':
      shipVoid(ctx, t, thrust);
      break;
  }
}

/** VOID-X — secret endgame prototype: dark hull, rift-purple energy. */
function shipVoid(ctx: CanvasRenderingContext2D, t: number, thrust: number) {
  // swept dark wings
  const wg = ctx.createLinearGradient(0, -10, 0, 16);
  wg.addColorStop(0, '#4c1d95');
  wg.addColorStop(1, '#0b0716');
  ctx.fillStyle = wg;
  ctx.beginPath();
  ctx.moveTo(0, -2);
  ctx.lineTo(-19, 8);
  ctx.lineTo(-15, 15);
  ctx.lineTo(-4, 12);
  ctx.closePath();
  ctx.moveTo(0, -2);
  ctx.lineTo(19, 8);
  ctx.lineTo(15, 15);
  ctx.lineTo(4, 12);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(129,140,248,0.85)';
  ctx.lineWidth = 0.9;
  ctx.stroke();
  // rift engine
  engineFlame(ctx, 0, 14, t, 1.5, thrust, '#818cf8');
  // faceted hull
  const hg = ctx.createLinearGradient(0, -20, 0, 14);
  hg.addColorStop(0, '#e0e7ff');
  hg.addColorStop(0.45, '#4338ca');
  hg.addColorStop(1, '#0b0716');
  ctx.fillStyle = hg;
  ctx.beginPath();
  ctx.moveTo(0, -21);
  ctx.lineTo(-6, -6);
  ctx.lineTo(-4.5, 11);
  ctx.lineTo(0, 14);
  ctx.lineTo(4.5, 11);
  ctx.lineTo(6, -6);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(199,210,254,0.75)';
  ctx.lineWidth = 0.7;
  ctx.stroke();
  // rift core
  const pulse = 0.7 + 0.3 * Math.sin(t * 4);
  const cg = ctx.createRadialGradient(0, -4, 0, 0, -4, 7 * pulse);
  cg.addColorStop(0, '#ffffff');
  cg.addColorStop(0.4, '#818cf8');
  cg.addColorStop(1, 'rgba(49,46,129,0)');
  ctx.fillStyle = cg;
  ctx.beginPath();
  ctx.ellipse(0, -4, 3.4 * pulse, 6.5 * pulse, 0, 0, Math.PI * 2);
  ctx.fill();
  // orbiting shards
  ctx.fillStyle = 'rgba(199,210,254,0.9)';
  for (let i = 0; i < 3; i++) {
    const a = t * 1.6 + (Math.PI * 2 * i) / 3;
    ctx.save();
    ctx.translate(Math.cos(a) * 13, Math.sin(a) * 5 + 2);
    ctx.rotate(a);
    ctx.fillRect(-1.2, -1.2, 2.4, 2.4);
    ctx.restore();
  }
}

function engineFlame(ctx: CanvasRenderingContext2D, x: number, y: number, t: number, scale: number, thrust: number, color: string) {
  const flick = 0.75 + 0.25 * Math.sin(t * 42 + x * 3) + Math.random() * 0.08;
  const len = (10 + 8 * thrust) * flick * scale;
  const w = 3.4 * scale;
  const g = ctx.createLinearGradient(0, y, 0, y + len);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.3, color);
  g.addColorStop(1, 'rgba(34,211,238,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(x - w, y);
  ctx.lineTo(x + w, y);
  ctx.lineTo(x, y + len);
  ctx.closePath();
  ctx.fill();
}

function shipFalcon(ctx: CanvasRenderingContext2D, t: number, thrust: number) {
  // wings
  const wg = ctx.createLinearGradient(0, -8, 0, 16);
  wg.addColorStop(0, '#94a3b8');
  wg.addColorStop(1, '#334155');
  ctx.fillStyle = wg;
  ctx.beginPath();
  ctx.moveTo(0, 2);
  ctx.lineTo(-17, 13);
  ctx.lineTo(-13, 16);
  ctx.lineTo(-3, 13);
  ctx.lineTo(0, 11);
  ctx.closePath();
  ctx.moveTo(0, 2);
  ctx.lineTo(17, 13);
  ctx.lineTo(13, 16);
  ctx.lineTo(3, 13);
  ctx.lineTo(0, 11);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(34,211,238,0.65)';
  ctx.lineWidth = 0.8;
  ctx.stroke();
  // wing tip lights
  ctx.fillStyle = '#67e8f9';
  ctx.fillRect(-17.4, 12.4, 1.8, 1.8);
  ctx.fillRect(15.6, 12.4, 1.8, 1.8);
  // flames
  engineFlame(ctx, -4.5, 14, t, 1, thrust, '#22d3ee');
  engineFlame(ctx, 4.5, 14, t + 0.5, 1, thrust, '#22d3ee');
  // hull
  const hg = ctx.createLinearGradient(0, -18, 0, 15);
  hg.addColorStop(0, '#f1f5f9');
  hg.addColorStop(0.5, '#94a3b8');
  hg.addColorStop(1, '#475569');
  ctx.fillStyle = hg;
  ctx.beginPath();
  ctx.moveTo(0, -19);
  ctx.lineTo(-5.5, -4);
  ctx.lineTo(-5, 12);
  ctx.lineTo(-2.5, 15);
  ctx.lineTo(2.5, 15);
  ctx.lineTo(5, 12);
  ctx.lineTo(5.5, -4);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(226,232,240,0.7)';
  ctx.lineWidth = 0.7;
  ctx.stroke();
  // cockpit
  const cg = ctx.createRadialGradient(0, -7, 0, 0, -6, 6);
  cg.addColorStop(0, '#e0feff');
  cg.addColorStop(0.5, '#22d3ee');
  cg.addColorStop(1, 'rgba(14,116,144,0.2)');
  ctx.fillStyle = cg;
  ctx.beginPath();
  ctx.ellipse(0, -6, 2.6, 5.5, 0, 0, Math.PI * 2);
  ctx.fill();
  // nose stripe
  ctx.fillStyle = '#22d3ee';
  ctx.fillRect(-0.7, -18, 1.4, 5);
}

function shipComet(ctx: CanvasRenderingContext2D, t: number, thrust: number) {
  // slim delta
  const wg = ctx.createLinearGradient(0, -6, 0, 16);
  wg.addColorStop(0, '#c4b5fd');
  wg.addColorStop(1, '#4c1d95');
  ctx.fillStyle = wg;
  ctx.beginPath();
  ctx.moveTo(0, -4);
  ctx.lineTo(-14, 14);
  ctx.lineTo(-5, 11);
  ctx.lineTo(0, 13);
  ctx.lineTo(5, 11);
  ctx.lineTo(14, 14);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(196,181,253,0.8)';
  ctx.lineWidth = 0.8;
  ctx.stroke();
  engineFlame(ctx, 0, 13.5, t, 1.2, thrust, '#a78bfa');
  // needle hull
  const hg = ctx.createLinearGradient(0, -21, 0, 13);
  hg.addColorStop(0, '#ede9fe');
  hg.addColorStop(0.6, '#c4b5fd');
  hg.addColorStop(1, '#7c3aed');
  ctx.fillStyle = hg;
  ctx.beginPath();
  ctx.moveTo(0, -22);
  ctx.lineTo(-3, -2);
  ctx.lineTo(-2.4, 12);
  ctx.lineTo(0, 14);
  ctx.lineTo(2.4, 12);
  ctx.lineTo(3, -2);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(237,233,254,0.8)';
  ctx.lineWidth = 0.6;
  ctx.stroke();
  const cg = ctx.createRadialGradient(0, -8, 0, 0, -8, 5);
  cg.addColorStop(0, '#ffffff');
  cg.addColorStop(0.5, '#a78bfa');
  cg.addColorStop(1, 'rgba(124,58,237,0.15)');
  ctx.fillStyle = cg;
  ctx.beginPath();
  ctx.ellipse(0, -7, 2, 5, 0, 0, Math.PI * 2);
  ctx.fill();
}

function shipTitan(ctx: CanvasRenderingContext2D, t: number, thrust: number) {
  // heavy shoulder plates
  const pg = ctx.createLinearGradient(0, -6, 0, 18);
  pg.addColorStop(0, '#475569');
  pg.addColorStop(1, '#1e293b');
  ctx.fillStyle = pg;
  ctx.beginPath();
  ctx.moveTo(-8, -6);
  ctx.lineTo(-20, 4);
  ctx.lineTo(-18, 15);
  ctx.lineTo(-8, 13);
  ctx.closePath();
  ctx.moveTo(8, -6);
  ctx.lineTo(20, 4);
  ctx.lineTo(18, 15);
  ctx.lineTo(8, 13);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(52,211,153,0.55)';
  ctx.lineWidth = 0.9;
  ctx.stroke();
  // armor rivets
  ctx.fillStyle = 'rgba(52,211,153,0.8)';
  ctx.fillRect(-15.5, 5, 1.6, 1.6);
  ctx.fillRect(13.9, 5, 1.6, 1.6);
  engineFlame(ctx, -7, 15, t, 1.35, thrust, '#34d399');
  engineFlame(ctx, 7, 15, t + 0.4, 1.35, thrust, '#34d399');
  // broad wedge hull
  const hg = ctx.createLinearGradient(0, -15, 0, 16);
  hg.addColorStop(0, '#e2e8f0');
  hg.addColorStop(0.45, '#64748b');
  hg.addColorStop(1, '#334155');
  ctx.fillStyle = hg;
  ctx.beginPath();
  ctx.moveTo(0, -16);
  ctx.lineTo(-10, -2);
  ctx.lineTo(-10, 12);
  ctx.lineTo(-4, 16);
  ctx.lineTo(4, 16);
  ctx.lineTo(10, 12);
  ctx.lineTo(10, -2);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(226,232,240,0.6)';
  ctx.lineWidth = 0.8;
  ctx.stroke();
  // cockpit slit
  const cg = ctx.createRadialGradient(0, -5, 0, 0, -5, 6);
  cg.addColorStop(0, '#d1fae5');
  cg.addColorStop(0.5, '#34d399');
  cg.addColorStop(1, 'rgba(6,78,59,0.2)');
  ctx.fillStyle = cg;
  ctx.beginPath();
  ctx.ellipse(0, -4, 3.4, 4.4, 0, 0, Math.PI * 2);
  ctx.fill();
}

function shipNova(ctx: CanvasRenderingContext2D, t: number, thrust: number) {
  // forward-swept fins
  const wg = ctx.createLinearGradient(0, -12, 0, 16);
  wg.addColorStop(0, '#f9a8d4');
  wg.addColorStop(1, '#701a75');
  ctx.fillStyle = wg;
  ctx.beginPath();
  ctx.moveTo(-4, -12);
  ctx.lineTo(-18, -4);
  ctx.lineTo(-16, 3);
  ctx.lineTo(-4, 2);
  ctx.closePath();
  ctx.moveTo(4, -12);
  ctx.lineTo(18, -4);
  ctx.lineTo(16, 3);
  ctx.lineTo(4, 2);
  ctx.closePath();
  ctx.moveTo(-4, 6);
  ctx.lineTo(-13, 15);
  ctx.lineTo(-5, 14);
  ctx.closePath();
  ctx.moveTo(4, 6);
  ctx.lineTo(13, 15);
  ctx.lineTo(5, 14);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(244,114,182,0.7)';
  ctx.lineWidth = 0.8;
  ctx.stroke();
  engineFlame(ctx, -5, 14.5, t, 1.1, thrust, '#f472b6');
  engineFlame(ctx, 5, 14.5, t + 0.6, 1.1, thrust, '#f472b6');
  engineFlame(ctx, 0, 15.5, t + 0.3, 0.9, thrust, '#22d3ee');
  // twin-prong hull
  const hg = ctx.createLinearGradient(0, -20, 0, 15);
  hg.addColorStop(0, '#fdf2f8');
  hg.addColorStop(0.5, '#9ca3af');
  hg.addColorStop(1, '#4b5563');
  ctx.fillStyle = hg;
  ctx.beginPath();
  ctx.moveTo(-3.4, -17);
  ctx.lineTo(-5, 10);
  ctx.lineTo(-2.4, 14);
  ctx.lineTo(0, 12);
  ctx.lineTo(2.4, 14);
  ctx.lineTo(5, 10);
  ctx.lineTo(3.4, -17);
  ctx.lineTo(0, -13);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(253,242,248,0.6)';
  ctx.lineWidth = 0.6;
  ctx.stroke();
  // prong tips
  ctx.fillStyle = '#f472b6';
  ctx.fillRect(-3.9, -18.5, 1.1, 3.5);
  ctx.fillRect(2.8, -18.5, 1.1, 3.5);
  const cg = ctx.createRadialGradient(0, -4, 0, 0, -4, 6);
  cg.addColorStop(0, '#ffffff');
  cg.addColorStop(0.5, '#f472b6');
  cg.addColorStop(1, 'rgba(157,23,77,0.2)');
  ctx.fillStyle = cg;
  ctx.beginPath();
  ctx.ellipse(0, -3, 2.4, 5, 0, 0, Math.PI * 2);
  ctx.fill();
}

// ── Enemies (drawn at origin, facing +y / downward) ──────────────────────────
export function drawEnemyKind(
  ctx: CanvasRenderingContext2D,
  kind: EnemyKind,
  r: number,
  t: number,
  flash: number,
) {
  const s = r / 15;
  ctx.save();
  ctx.scale(s, s);
  switch (kind) {
    case 'scout': {
      const g = ctx.createLinearGradient(0, -12, 0, 13);
      g.addColorStop(0, '#7f1d1d');
      g.addColorStop(1, '#fb7185');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(0, 14);
      ctx.lineTo(-11, -6);
      ctx.lineTo(-5, -11);
      ctx.lineTo(0, -7);
      ctx.lineTo(5, -11);
      ctx.lineTo(11, -6);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(254,205,211,0.8)';
      ctx.lineWidth = 0.9;
      ctx.stroke();
      ctx.fillStyle = '#fecdd3';
      ctx.beginPath();
      ctx.ellipse(0, 2, 2.2, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'weaver': {
      ctx.rotate(Math.sin(t * 3) * 0.16);
      const g = ctx.createLinearGradient(0, -13, 0, 13);
      g.addColorStop(0, '#581c87');
      g.addColorStop(1, '#c084fc');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(0, 14);
      ctx.lineTo(-12, 0);
      ctx.lineTo(0, -14);
      ctx.lineTo(12, 0);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(233,213,255,0.85)';
      ctx.lineWidth = 0.9;
      ctx.stroke();
      ctx.fillStyle = 'rgba(233,213,255,0.9)';
      ctx.save();
      ctx.rotate(t * 2.4);
      ctx.fillRect(-5.5, -1, 11, 2);
      ctx.fillRect(-1, -5.5, 2, 11);
      ctx.restore();
      break;
    }
    case 'gunner': {
      // barrel
      ctx.fillStyle = '#7c2d12';
      ctx.fillRect(-2, 6, 4, 11);
      ctx.fillStyle = '#fdba74';
      ctx.fillRect(-2, 15.5, 4, 1.6);
      const g = ctx.createLinearGradient(0, -13, 0, 9);
      g.addColorStop(0, '#7c2d12');
      g.addColorStop(1, '#fb923c');
      ctx.fillStyle = g;
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const a = (Math.PI * 2 * i) / 5 - Math.PI / 2;
        const px = Math.cos(a) * 13;
        const py = Math.sin(a) * 13 - 2;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(254,215,170,0.85)';
      ctx.lineWidth = 0.9;
      ctx.stroke();
      ctx.fillStyle = '#ffedd5';
      ctx.beginPath();
      ctx.arc(0, -2, 3, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'diver': {
      const g = ctx.createLinearGradient(0, -13, 0, 15);
      g.addColorStop(0, '#450a0a');
      g.addColorStop(1, '#ef4444');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(0, 16);
      ctx.lineTo(-9, -8);
      ctx.lineTo(0, -12);
      ctx.lineTo(9, -8);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(254,202,202,0.85)';
      ctx.lineWidth = 0.9;
      ctx.stroke();
      const pulse = 0.5 + 0.5 * Math.sin(t * 10);
      ctx.fillStyle = `rgba(254,202,202,${0.55 + 0.45 * pulse})`;
      ctx.beginPath();
      ctx.arc(0, 13, 2.4, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'tank': {
      const g = ctx.createLinearGradient(0, -14, 0, 14);
      g.addColorStop(0, '#450a0a');
      g.addColorStop(0.6, '#991b1b');
      g.addColorStop(1, '#dc2626');
      ctx.fillStyle = g;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI * 2 * i) / 6 + Math.PI / 6;
        const px = Math.cos(a) * 14;
        const py = Math.sin(a) * 14;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(254,202,202,0.7)';
      ctx.lineWidth = 1;
      ctx.stroke();
      // armor plates
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(-9, -4);
      ctx.lineTo(9, -4);
      ctx.moveTo(-9, 3);
      ctx.lineTo(9, 3);
      ctx.stroke();
      ctx.fillStyle = '#fca5a5';
      ctx.beginPath();
      ctx.arc(0, 0, 3.6, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
  }
  ctx.restore();
  if (flash > 0) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, flash) * 0.85;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.9, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// ── Power-up glyph icons (white, drawn at origin) ────────────────────────────
export function drawPowerupIcon(ctx: CanvasRenderingContext2D, type: PowerupType, size: number) {
  const s = size / 2;
  ctx.save();
  ctx.strokeStyle = '#ffffff';
  ctx.fillStyle = '#ffffff';
  ctx.lineWidth = Math.max(1.4, size * 0.14);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  switch (type) {
    case 'rapid': {
      ctx.beginPath();
      ctx.moveTo(s * 0.25, -s);
      ctx.lineTo(-s * 0.45, s * 0.15);
      ctx.lineTo(0, s * 0.15);
      ctx.lineTo(-s * 0.25, s);
      ctx.stroke();
      break;
    }
    case 'double': {
      for (const off of [-s * 0.45, s * 0.45]) {
        ctx.beginPath();
        ctx.moveTo(off - s * 0.28, s * 0.4);
        ctx.lineTo(off, -s * 0.5);
        ctx.lineTo(off + s * 0.28, s * 0.4);
        ctx.stroke();
      }
      break;
    }
    case 'triple': {
      for (const off of [-s * 0.62, 0, s * 0.62]) {
        ctx.beginPath();
        ctx.moveTo(off, -s * 0.55);
        ctx.lineTo(off, s * 0.55);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(off - s * 0.2, -s * 0.32);
        ctx.lineTo(off, -s * 0.62);
        ctx.lineTo(off + s * 0.2, -s * 0.32);
        ctx.stroke();
      }
      break;
    }
    case 'shield': {
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI * 2 * i) / 6 - Math.PI / 2;
        const px = Math.cos(a) * s * 0.95;
        const py = Math.sin(a) * s * 0.95;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();
      break;
    }
    case 'power': {
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = (Math.PI * 2 * i) / 8 - Math.PI / 2;
        const rr = i % 2 === 0 ? s : s * 0.42;
        const px = Math.cos(a) * rr;
        const py = Math.sin(a) * rr;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'magnet': {
      ctx.beginPath();
      ctx.arc(0, -s * 0.15, s * 0.7, Math.PI, 0, false);
      ctx.moveTo(s * 0.7, -s * 0.15);
      ctx.lineTo(s * 0.7, s * 0.7);
      ctx.moveTo(-s * 0.7, -s * 0.15);
      ctx.lineTo(-s * 0.7, s * 0.7);
      ctx.stroke();
      ctx.lineWidth *= 0.7;
      ctx.beginPath();
      ctx.moveTo(-s * 0.7, s * 0.7);
      ctx.lineTo(-s * 0.2, s * 0.7);
      ctx.moveTo(s * 0.2, s * 0.7);
      ctx.lineTo(s * 0.7, s * 0.7);
      ctx.stroke();
      break;
    }
  }
  ctx.restore();
}

// ── Coin disc ────────────────────────────────────────────────────────────────
export function drawCoinDisc(ctx: CanvasRenderingContext2D, r: number, spin: number) {
  ctx.save();
  ctx.scale(Math.max(0.18, Math.abs(Math.cos(spin))), 1);
  const g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
  g.addColorStop(0, '#fef9c3');
  g.addColorStop(0.55, '#fbbf24');
  g.addColorStop(1, '#b45309');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,251,235,0.9)';
  ctx.lineWidth = Math.max(1, r * 0.16);
  ctx.stroke();
  ctx.fillStyle = 'rgba(120,53,15,0.75)';
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (Math.PI * 2 * i) / 8;
    const rr = i % 2 === 0 ? r * 0.5 : r * 0.24;
    const px = Math.cos(a) * rr;
    const py = Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}
