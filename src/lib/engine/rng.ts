/**
 * Deterministic RNG shared by every game on the engine — same seed always
 * produces the same round, which is what makes server-resolved rounds
 * replayable and testable. Moved verbatim out of wildwood.ts; behavior is
 * unchanged (see wildwood.test.ts's determinism assertions).
 */
export type Rng = {
  next: () => number;
  int: (minInclusive: number, maxInclusive: number) => number;
  chance: (probability: number) => boolean;
  pickWeighted: <T extends { weight: number }>(items: readonly T[]) => T;
};

export function createRng(seed: string): Rng {
  const hash = xmur3(seed);
  const next = sfc32(hash(), hash(), hash(), hash());
  return {
    next,
    int(minInclusive, maxInclusive) {
      return Math.floor(next() * (maxInclusive - minInclusive + 1)) + minInclusive;
    },
    chance(probability) {
      return next() < probability;
    },
    pickWeighted(items) {
      let totalWeight = 0;
      for (const item of items) totalWeight += item.weight;
      let cursor = next() * totalWeight;
      for (const item of items) {
        cursor -= item.weight;
        if (cursor < 0) return item;
      }
      return items[items.length - 1];
    }
  };
}

export function xmur3(input: string) {
  let hash = 1779033703 ^ input.length;
  for (let index = 0; index < input.length; index += 1) {
    hash = Math.imul(hash ^ input.charCodeAt(index), 3432918353);
    hash = (hash << 13) | (hash >>> 19);
  }
  return function nextHash() {
    hash = Math.imul(hash ^ (hash >>> 16), 2246822507);
    hash = Math.imul(hash ^ (hash >>> 13), 3266489909);
    return (hash ^= hash >>> 16) >>> 0;
  };
}

export function sfc32(a: number, b: number, c: number, d: number) {
  return function next() {
    a >>>= 0;
    b >>>= 0;
    c >>>= 0;
    d >>>= 0;
    const t = (a + b) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    d = (d + 1) | 0;
    const result = (t + d) | 0;
    c = (c + result) | 0;
    return (result >>> 0) / 4294967296;
  };
}
