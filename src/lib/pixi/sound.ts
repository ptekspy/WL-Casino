import type { CollectorType } from "../wildwood";

/**
 * Tiny synthesized SFX engine — no audio files, everything is oscillators and
 * gain envelopes. Browsers block audio before a user gesture, so `resume()`
 * must be called from a click handler before any of this will be audible.
 */

type ToneOptions = {
  duration?: number;
  type?: OscillatorType;
  gain?: number;
  delay?: number;
  slideTo?: number;
};

type NoiseOptions = {
  duration?: number;
  gain?: number;
  delay?: number;
  frequency?: number;
};

class WildwoodSound {
  private ctx: AudioContext | null = null;
  private muted = false;

  private getCtx(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      this.ctx = new Ctor();
    }
    return this.ctx;
  }

  resume(): void {
    const ctx = this.getCtx();
    if (ctx && ctx.state === "suspended") void ctx.resume();
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
  }

  get isMuted(): boolean {
    return this.muted;
  }

  private tone(freq: number, opts: ToneOptions = {}): void {
    if (this.muted) return;
    const ctx = this.getCtx();
    if (!ctx) return;
    const start = ctx.currentTime + (opts.delay ?? 0);
    const duration = opts.duration ?? 0.18;
    const osc = ctx.createOscillator();
    osc.type = opts.type ?? "sine";
    osc.frequency.setValueAtTime(freq, start);
    if (opts.slideTo) osc.frequency.exponentialRampToValueAtTime(opts.slideTo, start + duration);
    const gainNode = ctx.createGain();
    const peak = opts.gain ?? 0.12;
    gainNode.gain.setValueAtTime(0.0001, start);
    gainNode.gain.exponentialRampToValueAtTime(peak, start + 0.015);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(gainNode).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + duration + 0.02);
  }

  private noiseBurst(opts: NoiseOptions = {}): void {
    if (this.muted) return;
    const ctx = this.getCtx();
    if (!ctx) return;
    const duration = opts.duration ?? 0.25;
    const start = ctx.currentTime + (opts.delay ?? 0);
    const bufferSize = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = opts.frequency ?? 1200;
    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(opts.gain ?? 0.08, start);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    src.connect(filter).connect(gainNode).connect(ctx.destination);
    src.start(start);
  }

  private static readonly COLLECT_SCALE = [523.25, 587.33, 659.25, 698.46, 783.99, 880, 987.77, 1046.5];

  playCollect(streak = 0): void {
    const scale = WildwoodSound.COLLECT_SCALE;
    this.tone(scale[Math.min(streak, scale.length - 1)], { type: "triangle", duration: 0.22, gain: 0.11 });
  }

  playCascade(level = 0): void {
    const lift = Math.max(0, Math.min(5, level));
    this.noiseBurst({ duration: 0.28, gain: 0.045 + lift * 0.006, frequency: 900 + lift * 120 });
    this.tone(220 + lift * 26, { type: "sine", duration: 0.22, slideTo: 340 + lift * 42, gain: 0.05 + lift * 0.006 });
  }

  playValueRise(multiplier: number): void {
    const lift = Math.max(0, Math.min(6, multiplier));
    this.tone(440 + lift * 42, { type: "triangle", duration: 0.22, slideTo: 620 + lift * 58, gain: 0.075 });
    this.tone(659.25 + lift * 32, { type: "sine", duration: 0.28, gain: 0.055, delay: 0.07 });
  }

  playEscalation(level: number): void {
    const step = Math.max(0, Math.min(5, level));
    this.tone(261.63 + step * 38, { type: "sawtooth", duration: 0.16, gain: 0.035 + step * 0.005 });
  }

  playTargetLock(symbol: CollectorType, order = 0): void {
    const frequency: Record<CollectorType, number> = { fox: 493.88, owl: 739.99, stag: 329.63, wisp: 987.77 };
    this.tone(frequency[symbol] * (1 + order * 0.045), { type: symbol === "wisp" ? "sine" : "triangle", duration: 0.16, gain: 0.045 });
  }

  playCollectorImpact(symbol: CollectorType): void {
    const frequency: Record<CollectorType, number> = { fox: 520, owl: 760, stag: 340, wisp: 920 };
    this.tone(frequency[symbol], { type: symbol === "wisp" ? "sine" : "triangle", duration: 0.12, slideTo: frequency[symbol] * 1.18, gain: 0.055 });
    this.noiseBurst({ duration: 0.1, gain: 0.022, frequency: frequency[symbol] * 1.4 });
  }

  playCollectorCelebrate(symbol: CollectorType): void {
    const chord: Record<CollectorType, readonly [number, number]> = {
      fox: [659.25, 783.99],
      owl: [783.99, 987.77],
      stag: [392, 523.25],
      wisp: [987.77, 1318.51]
    };
    chord[symbol].forEach((freq, index) => this.tone(freq, { type: "triangle", duration: 0.2, gain: 0.045, delay: index * 0.06 }));
  }

  playSeedHint(): void {
    this.tone(880, { type: "sine", duration: 0.32, gain: 0.09 });
    this.tone(1108.73, { type: "sine", duration: 0.32, gain: 0.07, delay: 0.09 });
  }

  playSpiritShare(count: number): void {
    for (let index = 0; index < Math.min(4, count); index += 1) {
      this.tone(880 + index * 110, { type: "sine", duration: 0.28, gain: 0.055, delay: index * 0.07 });
    }
  }

  playBonusTrigger(): void {
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => this.tone(freq, { type: "sawtooth", duration: 0.5, gain: 0.1, delay: i * 0.09 }));
    this.noiseBurst({ duration: 0.4, gain: 0.06 });
  }

  playBonusBreath(index: number): void {
    this.noiseBurst({ duration: 0.45, gain: 0.045, frequency: 700 + index * 90 });
    this.tone(220 + index * 24, { type: "sine", duration: 0.38, slideTo: 480 + index * 38, gain: 0.055 });
  }

  playMultiplierUp(): void {
    this.tone(659.25, { type: "square", duration: 0.13, gain: 0.07 });
  }

  playBonusEnd(): void {
    this.tone(392, { type: "sine", duration: 0.5, slideTo: 261.63, gain: 0.08 });
  }

  playGoodWin(): void {
    [587.33, 739.99, 880].forEach((freq, i) => this.tone(freq, { type: "triangle", duration: 0.3, gain: 0.065, delay: i * 0.08 }));
  }

  playBigWin(): void {
    [659.25, 783.99, 987.77, 1174.66].forEach((freq, i) => this.tone(freq, { type: "triangle", duration: 0.4, gain: 0.09, delay: i * 0.1 }));
  }

  playMegaWin(): void {
    [523.25, 659.25, 783.99, 987.77, 1318.51].forEach((freq, i) => this.tone(freq, { type: "sawtooth", duration: 0.48, gain: 0.085, delay: i * 0.09 }));
    this.noiseBurst({ duration: 0.48, gain: 0.055, frequency: 1500 });
  }

  playMaxWin(): void {
    [523.25, 659.25, 783.99, 1046.5, 1318.51].forEach((freq, i) => this.tone(freq, { type: "sawtooth", duration: 0.55, gain: 0.1, delay: i * 0.08 }));
    this.noiseBurst({ duration: 0.6, gain: 0.07 });
  }
}

export const wildwoodSound = new WildwoodSound();
