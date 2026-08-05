import type { Ticker } from "pixi.js";

export type EasingFn = (t: number) => number;

export const Easing = {
  linear: (t: number) => t,
  inQuad: (t: number) => t * t,
  outQuad: (t: number) => 1 - (1 - t) * (1 - t),
  outCubic: (t: number) => 1 - (1 - t) ** 3,
  inOutQuad: (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2),
  outBack: (t: number) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
  },
  outElastic: (t: number) => {
    const c4 = (2 * Math.PI) / 3;
    if (t === 0 || t === 1) return t;
    return 2 ** (-10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
  }
} satisfies Record<string, EasingFn>;

type ActiveTween = {
  elapsed: number;
  duration: number;
  easing: EasingFn;
  onUpdate: (progress: number) => void;
  resolve: () => void;
};

/**
 * Drives every Wildwood board animation off one Pixi ticker so a single
 * `destroy()` call on unmount tears the whole animation graph down, and
 * pending `await`s resolve immediately instead of hanging.
 */
export class TweenRunner {
  private readonly tweens = new Set<ActiveTween>();
  private destroyed = false;
  private timeScale = 1;

  constructor(private readonly ticker: Ticker) {
    this.ticker.add(this.tick);
  }

  private readonly tick = () => {
    if (this.tweens.size === 0) return;
    const dtMs = this.ticker.deltaMS * this.timeScale;
    for (const tween of [...this.tweens]) {
      tween.elapsed += dtMs;
      const progress = tween.duration <= 0 ? 1 : Math.min(1, tween.elapsed / tween.duration);
      tween.onUpdate(tween.easing(progress));
      if (progress >= 1) {
        this.tweens.delete(tween);
        tween.resolve();
      }
    }
  };

  animate(duration: number, onUpdate: (progress: number) => void, easing: EasingFn = Easing.linear): Promise<void> {
    if (this.destroyed) return Promise.resolve();
    return new Promise((resolve) => {
      this.tweens.add({ elapsed: 0, duration, easing, onUpdate, resolve });
    });
  }

  wait(ms: number): Promise<void> {
    return this.animate(ms, () => {});
  }

  setTimeScale(scale: number): void {
    this.timeScale = Math.max(0.5, Math.min(2.5, scale));
  }

  /** Immediately stops every in-flight tween without running its final update — used when a seek interrupts autoplay. */
  cancelAll(): void {
    for (const tween of this.tweens) tween.resolve();
    this.tweens.clear();
  }

  get isDestroyed(): boolean {
    return this.destroyed;
  }

  destroy(): void {
    this.destroyed = true;
    for (const tween of this.tweens) tween.resolve();
    this.tweens.clear();
    this.ticker.remove(this.tick);
  }
}
