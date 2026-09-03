// ── Synthesized SFX — no assets, fully offline. Game runs fine when silent. ──

export type SoundName =
  | 'shoot'
  | 'hit'
  | 'boom'
  | 'bigboom'
  | 'coin'
  | 'powerup'
  | 'shieldHit'
  | 'shieldDown'
  | 'hurt'
  | 'death'
  | 'warn'
  | 'checkpoint'
  | 'ui';

class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private lastShoot = 0;
  private ambient: { stop: () => void } | null = null;
  muted = false;

  setMuted(m: boolean) {
    this.muted = m;
    if (m) this.stopAmbient();
  }

  /** Call from a user gesture. Safe to call repeatedly. */
  unlock() {
    if (this.muted) return;
    try {
      if (!this.ctx) {
        const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.55;
        this.master.connect(this.ctx.destination);
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume();
    } catch {
      /* audio unavailable */
    }
  }

  private ready(): boolean {
    return !!this.ctx && !this.muted && this.ctx.state === 'running';
  }

  private getNoise(): AudioBuffer | null {
    if (!this.ctx) return null;
    if (!this.noiseBuf) {
      const len = this.ctx.sampleRate;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    }
    return this.noiseBuf;
  }

  private tone(f0: number, f1: number, dur: number, type: OscillatorType, vol: number, when = 0) {
    if (!this.ready() || !this.ctx || !this.master) return;
    const t = this.ctx.currentTime + when;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(1, f0), t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  private noise(dur: number, vol: number, f0: number, f1: number, when = 0) {
    if (!this.ready() || !this.ctx || !this.master) return;
    const buf = this.getNoise();
    if (!buf) return;
    const t = this.ctx.currentTime + when;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(f0, t);
    filter.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    src.start(t, Math.random());
    src.stop(t + dur + 0.05);
  }

  play(name: SoundName) {
    if (!this.ready()) return;
    const now = performance.now();
    switch (name) {
      case 'shoot':
        if (now - this.lastShoot < 55) return;
        this.lastShoot = now;
        this.tone(920 + Math.random() * 120, 340, 0.07, 'square', 0.045);
        break;
      case 'hit':
        this.noise(0.06, 0.06, 3200, 900);
        break;
      case 'boom':
        this.noise(0.28, 0.16, 1400, 120);
        this.tone(180, 46, 0.25, 'sine', 0.12);
        break;
      case 'bigboom':
        this.noise(0.7, 0.3, 1600, 60);
        this.tone(120, 30, 0.6, 'sine', 0.22);
        this.noise(0.4, 0.2, 800, 90, 0.12);
        break;
      case 'coin':
        this.tone(1240, 1240, 0.05, 'sine', 0.07);
        this.tone(1860, 1860, 0.09, 'sine', 0.06, 0.05);
        break;
      case 'powerup':
        this.tone(523, 523, 0.08, 'triangle', 0.1);
        this.tone(659, 659, 0.08, 'triangle', 0.1, 0.07);
        this.tone(880, 880, 0.14, 'triangle', 0.12, 0.14);
        break;
      case 'shieldHit':
        this.tone(480, 240, 0.12, 'sine', 0.1);
        this.noise(0.08, 0.05, 2400, 1200);
        break;
      case 'shieldDown':
        this.tone(320, 70, 0.32, 'sawtooth', 0.11);
        break;
      case 'hurt':
        this.noise(0.2, 0.22, 2000, 200);
        this.tone(220, 60, 0.25, 'square', 0.12);
        break;
      case 'death':
        this.noise(1.1, 0.35, 2200, 40);
        this.tone(320, 24, 1.0, 'sawtooth', 0.18);
        this.tone(140, 20, 1.2, 'sine', 0.2, 0.1);
        break;
      case 'warn':
        this.tone(160, 160, 0.16, 'square', 0.12);
        this.tone(160, 160, 0.16, 'square', 0.12, 0.24);
        this.tone(110, 110, 0.3, 'square', 0.1, 0.48);
        break;
      case 'checkpoint':
        this.tone(523, 523, 0.1, 'triangle', 0.11);
        this.tone(784, 784, 0.1, 'triangle', 0.11, 0.09);
        this.tone(1046, 1046, 0.1, 'triangle', 0.12, 0.18);
        this.tone(1318, 1318, 0.22, 'triangle', 0.12, 0.27);
        break;
      case 'ui':
        this.tone(700, 900, 0.06, 'sine', 0.05);
        break;
    }
  }

  /** Soft space-wind bed during gameplay. */
  startAmbient() {
    if (!this.ready() || this.ambient || !this.ctx || !this.master) return;
    try {
      const buf = this.getNoise();
      if (!buf) return;
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 220;
      filter.Q.value = 0.8;
      const lfo = this.ctx.createOscillator();
      lfo.frequency.value = 0.11;
      const lfoGain = this.ctx.createGain();
      lfoGain.gain.value = 90;
      lfo.connect(lfoGain);
      lfoGain.connect(filter.frequency);
      const gain = this.ctx.createGain();
      gain.gain.value = 0.022;
      src.connect(filter);
      filter.connect(gain);
      gain.connect(this.master);
      src.start();
      lfo.start();
      this.ambient = {
        stop: () => {
          try {
            src.stop();
            lfo.stop();
          } catch {
            /* noop */
          }
        },
      };
    } catch {
      /* noop */
    }
  }

  stopAmbient() {
    this.ambient?.stop();
    this.ambient = null;
  }
}

export const sfx = new AudioEngine();
