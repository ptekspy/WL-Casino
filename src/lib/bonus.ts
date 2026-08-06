/**
 * Welcome-bonus economics.
 *
 * Sized off the validated 50M-round Wildwood simulation (`scratch/sim-50m.md`,
 * `pnpm sim --runs 50000000`): measured RTP ≈ 0.9584.
 *
 *   expected bonus payout = spins * spinStake * rtp
 *                          = 20 * 0.20 * 0.9584
 *                          ≈ 3.83 credits
 *
 * That's ~38% of the 10-credit deposit required to unlock it, so the promo's
 * expected cost sits well under the deposit it's tied to — the average new
 * depositor is net-positive for the house before they've spent a single
 * credit of real balance. Tail risk is bounded by Wildwood's own 1000x max-win
 * cap (0.20 * 1000 = 200 credits ceiling on any one spin) and the cap-hit rate
 * measured at ~1-in-25,000 rounds (2,020 / 50,000,000) — negligible exposure
 * across a 20-spin bonus batch.
 *
 * Re-derive this whenever WILDWOOD_CONFIG's scalars change: re-run
 * `pnpm sim --runs 50000000` and update the RTP figure above.
 */
export const BONUS_CONFIG = {
  /** Minimum first-ever deposit (in demo credits) that unlocks the bonus. */
  depositTrigger: 10,
  /** Free spins granted once, on qualifying first deposit. */
  spins: 20,
  /** Fixed stake bonus spins play at, regardless of the player's selected stake. */
  spinStake: 0.2,
  /** RTP used for the EV estimate above — keep in sync with the sim output. */
  measuredRtp: 0.9584
} as const;

export const ALLOWED_DEPOSIT_AMOUNTS = [5, 10, 25, 50, 100] as const;

export function expectedBonusPayout(): number {
  return Number((BONUS_CONFIG.spins * BONUS_CONFIG.spinStake * BONUS_CONFIG.measuredRtp).toFixed(4));
}
