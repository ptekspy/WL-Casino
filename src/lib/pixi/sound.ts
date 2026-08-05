/**
 * Tiny synthesized SFX engine — no audio files, everything is oscillators and
 * gain envelopes. Browsers block audio before a user gesture, so `resume()`
 * must be called from a click handler (the Play button) before any of this
 * will actually be audible.
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

  /** Rises up a pentatonic-ish scale as `streak` climbs, for a combo feel across cascades. */
  playCollect(streak = 0): void {
    const scale = WildwoodSound.COLLECT_SCALE;
    this.tone(scale[Math.min(streak, scale.length - 1)], { type: "triangle", duration: 0.22, gain: 0.11 });
  }

  playCascade(): void {
    this.noiseBurst({ duration: 0.28, gain: 0.045, frequency: 900 });
    this.tone(220, { type: "sine", duration: 0.2, slideTo: 340, gain: 0.05 });
  }

  playSeedHint(): void {
    this.tone(880, { type: "sine", duration: 0.32, gain: 0.09 });
    this.tone(1108.73, { type: "sine", duration: 0.32, gain: 0.07, delay: 0.09 });
  }

  playBonusTrigger(): void {
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => this.tone(freq, { type: "sawtooth", duration: 0.5, gain: 0.1, delay: i * 0.09 }));
    this.noiseBurst({ duration: 0.4, gain: 0.06 });
  }

  playMultiplierUp(): void {
    this.tone(659.25, { type: "square", duration: 0.13, gain: 0.07 });
  }

  playBonusEnd(): void {
    this.tone(392, { type: "sine", duration: 0.5, slideTo: 261.63, gain: 0.08 });
  }

  playBigWin(): void {
    [659.25, 783.99, 987.77, 1174.66].forEach((freq, i) => this.tone(freq, { type: "triangle", duration: 0.4, gain: 0.09, delay: i * 0.1 }));
  }

  playMaxWin(): void {
    [523.25, 659.25, 783.99, 1046.5, 1318.51].forEach((freq, i) => this.tone(freq, { type: "sawtooth", duration: 0.55, gain: 0.1, delay: i * 0.08 }));
    this.noiseBurst({ duration: 0.6, gain: 0.07 });
  }
}

export const wildwoodSound = new WildwoodSound();
