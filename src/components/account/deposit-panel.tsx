"use client";

import { useState } from "react";
import { ALLOWED_DEPOSIT_AMOUNTS, BONUS_CONFIG } from "@/lib/bonus";
import { authClient } from "@/lib/auth-client";

type DepositResponse = {
  balance: number;
  bonusSpinsRemaining: number;
  bonusGranted: boolean;
  error?: string;
};

export function DepositPanel({ hasDeposited }: Readonly<{ hasDeposited: boolean }>) {
  const { refetch } = authClient.useSession();
  const [pendingAmount, setPendingAmount] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const deposit = async (amount: number) => {
    setPendingAmount(amount);
    setError(null);
    setMessage(null);

    const response = await fetch("/api/wallet/deposit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount })
    });
    const result = (await response.json()) as DepositResponse;

    setPendingAmount(null);
    if (!response.ok) {
      setError(result.error ?? "Deposit failed.");
      return;
    }

    setMessage(
      result.bonusGranted
        ? `Added ${amount.toFixed(2)} credits — welcome bonus unlocked: ${BONUS_CONFIG.spins} spins @ ${BONUS_CONFIG.spinStake.toFixed(2)}!`
        : `Added ${amount.toFixed(2)} credits.`
    );
    await refetch();
  };

  return (
    <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-5 shadow-xl shadow-black/20">
      <h3 className="text-lg font-black text-white">Demo deposit</h3>
      <p className="mt-1 text-sm text-emerald-100/55">
        Not real money — this just tops up your play-money balance.
        {!hasDeposited ? ` Your first deposit of ${BONUS_CONFIG.depositTrigger}+ credits unlocks the welcome bonus.` : ""}
      </p>

      <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-5">
        {ALLOWED_DEPOSIT_AMOUNTS.map((amount) => (
          <button
            key={amount}
            type="button"
            onClick={() => deposit(amount)}
            disabled={pendingAmount !== null}
            className="rounded-xl border border-white/10 bg-black/30 py-3 text-sm font-black text-amber-100 transition hover:border-emerald-300/40 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pendingAmount === amount ? "…" : `+${amount}`}
          </button>
        ))}
      </div>

      {message ? <p className="mt-3 text-sm font-bold text-emerald-300">{message}</p> : null}
      {error ? <p className="mt-3 text-sm font-bold text-red-300">{error}</p> : null}
    </div>
  );
}
