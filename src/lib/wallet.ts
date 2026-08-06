import { db } from "@/lib/db";
import { BONUS_CONFIG } from "@/lib/bonus";

export class InsufficientBalanceError extends Error {
  constructor() {
    super("Insufficient balance.");
    this.name = "InsufficientBalanceError";
  }
}

type WalletRow = {
  balance: number;
  bonusSpinsRemaining: number;
  bonusSpinStake: number;
  hasDeposited: number;
};

type WalletState = {
  balance: number;
  bonusSpinsRemaining: number;
  bonusSpinStake: number;
};

const getWallet = db.prepare<[string], WalletRow>(
  "SELECT balance, bonusSpinsRemaining, bonusSpinStake, hasDeposited FROM user WHERE id = ?"
);

const updateWallet = db.prepare<[number, number, string]>(
  "UPDATE user SET balance = ?, bonusSpinsRemaining = ? WHERE id = ?"
);

const applyDepositRow = db.prepare<[number, number, number, number, string]>(
  "UPDATE user SET balance = ?, bonusSpinsRemaining = ?, bonusSpinStake = ?, hasDeposited = ? WHERE id = ?"
);

/**
 * Settles one resolved round against a user's wallet. Bonus spins are free
 * (no stake debited) but their wins still land in the real balance. Runs as a
 * single better-sqlite3 transaction so rapid auto-play/turbo clicks can't race.
 */
export const settleRound = db.transaction(
  (userId: string, params: { stakeCharged: number; isBonusSpin: boolean; win: number }): WalletState => {
    const row = getWallet.get(userId);
    if (!row) throw new Error("Wallet not found.");

    if (!params.isBonusSpin && row.balance < params.stakeCharged) {
      throw new InsufficientBalanceError();
    }

    const balance = Number((row.balance - (params.isBonusSpin ? 0 : params.stakeCharged) + params.win).toFixed(4));
    const bonusSpinsRemaining = params.isBonusSpin ? Math.max(0, row.bonusSpinsRemaining - 1) : row.bonusSpinsRemaining;

    updateWallet.run(balance, bonusSpinsRemaining, userId);
    return { balance, bonusSpinsRemaining, bonusSpinStake: row.bonusSpinStake };
  }
);

/**
 * Adds demo credits to a user's balance. The welcome bonus is granted once,
 * on the user's first-ever deposit, only if that deposit meets
 * BONUS_CONFIG.depositTrigger — see src/lib/bonus.ts for the sizing math.
 */
export const applyDeposit = db.transaction((userId: string, amount: number): WalletState & { bonusGranted: boolean } => {
  const row = getWallet.get(userId);
  if (!row) throw new Error("Wallet not found.");

  const isFirstDeposit = row.hasDeposited === 0;
  const bonusGranted = isFirstDeposit && amount >= BONUS_CONFIG.depositTrigger;

  const balance = Number((row.balance + amount).toFixed(4));
  const bonusSpinsRemaining = bonusGranted ? BONUS_CONFIG.spins : row.bonusSpinsRemaining;
  const bonusSpinStake = bonusGranted ? BONUS_CONFIG.spinStake : row.bonusSpinStake;

  applyDepositRow.run(balance, bonusSpinsRemaining, bonusSpinStake, 1, userId);
  return { balance, bonusSpinsRemaining, bonusSpinStake, bonusGranted };
});

export function getWalletState(userId: string): WalletState | null {
  const row = getWallet.get(userId);
  if (!row) return null;
  return { balance: row.balance, bonusSpinsRemaining: row.bonusSpinsRemaining, bonusSpinStake: row.bonusSpinStake };
}
