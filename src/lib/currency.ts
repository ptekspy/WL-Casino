/** Shared demo-credit formatter. Everything on-site is fake money — this is the one place that decides how it's displayed. */
export function formatCredits(value: number): string {
  return value.toFixed(2);
}
