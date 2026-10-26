/**
 * The Halo orb.
 *
 * A stack of additive radial-gradient blobs orbiting a bright core. The
 * geometry is driven by the conversation state and by the live RMS of the
 * microphone / speaker, so the orb literally breathes with the conversation.
 *
 * No `ctx.filter` blur is used — softness comes from multi-stop radial
 * gradients, which keeps this at a steady 60 fps on modest hardware.
 */

const TAU = Math.PI * 2;

const PROFILES = {
  idle: { hue: 232, energy: 0.16, speed: 0.16, sat: 88, light: 58 },
  connecting: { hue: 200, energy: 0.34, speed: 0.52, sat: 95, light: 62 },
  listening: { hue: 186, energy: 0.26, speed: 0.42, sat: 100, light: 60 },
  thinking: { hue: 272, energy: 0.44, speed: 0.92, sat: 95, light: 63 },
  speaking: { hue: 330, energy: 0.42, speed: 0.66, sat: 100, light: 64 },
  error: { hue: 6, energy: 0.2, speed: 0.18, sat: 88, light: 56 },
};

const BLOBS = [
  { phase: 0.0, rx: 0.30, ry: 0.26, speed: 0.31, size: 0.40, shift: 0, alpha: 0.5, light: 62 },
  { phase: 1.7, rx: 0.24, ry: 0.32, speed: 0.23, size: 0.34, shift: 26, alpha: 0.46, light: 58 },
  { phase: 3.1, rx: 0.34, ry: 0.20, speed: 0.41, size: 0.30, shift: -28, alpha: 0.42, light: 66 },
  { phase: 4.4, rx: 0.20, ry: 0.28, speed: 0.37, size: 0.26, shift: 48, alpha: 0.36, light: 54 },
  { phase: 2.2, rx: 0.28, ry: 0.24, speed: 0.53, size: 0.22, shift: -50, alpha: 0.32, light: 70 },
  { phase: 5.3, rx: 0.22, ry: 0.18, speed: 0.61, size: 0.18, shift: 14, alpha: 0.28, light: 48 },
  { phase: 0.9, rx: 0.16, ry: 0.21, speed: 0.73, size: 0.14, shift: -14, alpha: 0.26, light: 76 },
];

export class Orb {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.state = 'idle';
    this.hue = PROFILES.idle.hue;
    this.targetHue = this.hue;
    this.inputLevel = 0;
    this.outputLevel = 0;
    this.smoothInput = 0;
    this.smoothOutput = 0;
    this.energy = PROFILES.idle.energy;
    this.running = false;
    this.frame = null;
    this.startedAt = performance.now();
    this.reducedMotion =
      typeof matchMedia === 'function' &&
      matchMedia('(prefers-reduced-motion: reduce)').matches;

    this._resize = this._resize.bind(this);
    this._tick = this._tick.bind(this);

    if (typeof ResizeObserver !== 'undefined') {
      this.observer = new ResizeObserver(this._resize);
      this.observer.observe(canvas);
    } else {
      window.addEventListener('resize', this._resize);
    }
    this._resize();
  }

  _resize() {
    const rect = this.canvas.getBoundingClientRect();
    const size = Math.max(1, Math.round(rect.width || 320));
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(size * dpr);
    this.canvas.height = Math.round(size * dpr);
    this.size = size;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.ctx.clearRect(0, 0, size, size);
  }

  setState(state) {
    if (PROFILES[state]) this.state = state;
  }

  setLevels({ input, output } = {}) {
    if (typeof input === 'number') this.inputLevel = input;
    if (typeof output === 'number') this.outputLevel = output;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.startedAt = performance.now();
    this.frame = requestAnimationFrame(this._tick);
  }

  stop() {
    this.running = false;
    if (this.frame) cancelAnimationFrame(this.frame);
    this.frame = null;
  }

  _tick(now) {
    if (!this.running) return;
    const t = (now - this.startedAt) / 1000;
    this._draw(t);
    this.frame = requestAnimationFrame(this._tick);
  }

  _draw(t) {
    const ctx = this.ctx;
    const profile = PROFILES[this.state] || PROFILES.idle;
    const size = this.size || 320;
    const cx = size / 2;
    const cy = size / 2;
    const R = size * 0.34;

    // Smooth the levels so the orb never flickers.
    const k = 0.25;
    this.smoothInput += (this.inputLevel - this.smoothInput) * k;
    this.smoothOutput += (this.outputLevel - this.smoothOutput) * k;

    const speaking = this.state === 'speaking';
    const drive = speaking ? this.smoothOutput : this.smoothInput;
    // The quieter channel still contributes, so a voice preview or a faint echo
    // keeps the orb alive instead of freezing it.
    const secondary = speaking ? this.smoothInput : this.smoothOutput;

    let targetEnergy = profile.energy + drive * 0.95 + secondary * 0.22;
    if (this.reducedMotion) targetEnergy *= 0.6;
    this.energy += (targetEnergy - this.energy) * 0.12;

    let targetHue = profile.hue;
    if (speaking) targetHue = profile.hue + drive * 26;
    if (this.state === 'listening') targetHue = profile.hue + this.smoothInput * 34;
    this.targetHue = targetHue;
    this.hue += (this.targetHue - this.hue) * 0.08;

    const speed = profile.speed * (this.reducedMotion ? 0.35 : 1) * (1 + this.smoothOutput * 0.5);

    ctx.clearRect(0, 0, size, size);
    ctx.globalCompositeOperation = 'lighter';

    // Outer halo
    const haloRadius = R * (1.55 + this.energy * 0.22) + Math.sin(t * 1.1) * 2;
    const halo = ctx.createRadialGradient(cx, cy, R * 0.2, cx, cy, haloRadius);
    halo.addColorStop(0, `hsla(${this.hue}, 90%, 60%, ${0.12 + this.energy * 0.1})`);
    halo.addColorStop(1, 'hsla(0, 0%, 0%, 0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(cx, cy, haloRadius, 0, TAU);
    ctx.fill();

    // Orbiting blobs
    for (const blob of BLOBS) {
      const angle = t * blob.speed * TAU * speed + blob.phase;
      const x = cx + Math.cos(angle) * blob.rx * R;
      const y = cy + Math.sin(angle * 0.83 + blob.phase) * blob.ry * R;
      const radius =
        R * (blob.size + this.energy * 0.17 + 0.02 * Math.sin(t * 2.4 + blob.phase));

      const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
      gradient.addColorStop(0, `hsla(${this.hue + blob.shift}, ${profile.sat}%, ${blob.light}%, ${blob.alpha})`);
      gradient.addColorStop(0.42, `hsla(${this.hue + blob.shift}, ${profile.sat}%, ${blob.light}%, ${blob.alpha * 0.45})`);
      gradient.addColorStop(0.78, `hsla(${this.hue + blob.shift}, ${profile.sat}%, ${blob.light}%, ${blob.alpha * 0.12})`);
      gradient.addColorStop(1, 'hsla(0, 0%, 0%, 0)');

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, TAU);
      ctx.fill();
    }

    // Core
    const coreRadius = R * (0.30 + this.energy * 0.06);
    const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreRadius);
    core.addColorStop(0, `hsla(${this.hue}, 100%, 96%, ${0.72 - this.energy * 0.16})`);
    core.addColorStop(0.35, `hsla(${this.hue}, 100%, 76%, 0.38)`);
    core.addColorStop(1, 'hsla(0, 0%, 0%, 0)');
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(cx, cy, coreRadius, 0, TAU);
    ctx.fill();

    // Ring
    ctx.globalCompositeOperation = 'source-over';
    const ringRadius = R * (1.08 + this.energy * 0.12) + Math.sin(t * 1.4) * 2.5;
    ctx.lineWidth = 1;
    ctx.strokeStyle = `hsla(${this.hue}, 80%, 72%, ${0.16 + this.energy * 0.14})`;
    ctx.beginPath();
    ctx.arc(cx, cy, ringRadius, 0, TAU);
    ctx.stroke();

    if (this.state === 'thinking') {
      ctx.strokeStyle = `hsla(${this.hue}, 95%, 78%, 0.5)`;
      ctx.lineWidth = 1.6;
      ctx.setLineDash([5, 16]);
      ctx.lineDashOffset = -t * 90;
      ctx.beginPath();
      ctx.arc(cx, cy, ringRadius + 9, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    if (this.state === 'speaking') {
      const pulse = (Math.sin(t * 6) + 1) / 2;
      ctx.strokeStyle = `hsla(${this.hue}, 95%, 80%, ${0.08 + pulse * 0.12})`;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(cx, cy, ringRadius + 14 + pulse * 6, 0, TAU);
      ctx.stroke();
    }

    ctx.globalCompositeOperation = 'source-over';
  }
}
