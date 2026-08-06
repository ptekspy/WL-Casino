/** Shared money/ratio formatting so every game's payouts round identically. */
export function roundMoney(value: number): number {
  return Number(value.toFixed(4));
}

export function roundRatio(value: number): number {
  return Number(value.toFixed(6));
}

export function formatWin(value: number): string {
  return roundMoney(value).toFixed(2);
}

/** `sortedAscending` must already be sorted. Used for simulation median/p95/p99. */
export function percentile(sortedAscending: Float64Array, fraction: number): number {
  const runs = sortedAscending.length;
  return sortedAscending[Math.min(runs - 1, Math.floor(fraction * runs))];
}
