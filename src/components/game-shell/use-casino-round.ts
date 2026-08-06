"use client";

import { useMutation } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { MIN_ROUND_MS, maxStakeForDateOfBirth } from "@/lib/uk-compliance";

export type WalletState = { balance: number; bonusSpinsRemaining: number; bonusSpinStake: number; isBonusSpin: boolean };

/** The minimum shape every game's round-result response must carry for the cabinet to settle it. */
export type RoundWithWallet = { cappedWin: number; wallet?: WalletState };

/**
 * Everything a stake-and-spin game cabinet needs regardless of its board:
 * session/DOB gating, the age-capped stake list, optimistic balance
 * deduction on Play, the UK 2.5s minimum-round-speed floor, and bonus-spin
 * tracking. Extracted out of wildwood-game.tsx — the board component and any
 * game-specific replay/info UI stay with the game itself.
 */
export function useCasinoRound<TRound extends RoundWithWallet>(config: {
  playEndpoint: string;
  allowedStakes: readonly number[];
  /** Runs synchronously inside startRound, before the mutation fires — e.g. resuming an audio context on the click gesture. */
  onBeforeStart?: () => void;
}) {
  const { data: session, isPending: sessionPending, refetch: refetchSession } = authClient.useSession();
  const isLoggedIn = Boolean(session);
  const maxStake = maxStakeForDateOfBirth((session?.user.dateOfBirth as string | undefined) ?? null);
  const needsDateOfBirth = isLoggedIn && maxStake === 0;
  const allowedStakes = config.allowedStakes.filter((option) => option <= maxStake);

  const [demoBalance, setDemoBalance] = useState(0);
  const [stake, setStake] = useState(1);
  const [displayedWin, setDisplayedWin] = useState(0);
  const [roundPlaying, setRoundPlaying] = useState(false);
  const [bonusSpinsRemaining, setBonusSpinsRemaining] = useState(0);
  const [bonusSpinStake, setBonusSpinStake] = useState(0);

  const balanceRef = useRef(0);
  const stakeRef = useRef(1);
  const roundPlayingRef = useRef(false);
  const bonusSpinsRemainingRef = useRef(0);
  const roundStartRef = useRef(0);
  const preSpinBalanceRef = useRef(0);

  // Seed the wallet from the account on login/logout. Mid-session updates
  // (deposits, spins) flow through the play/deposit responses instead, so
  // this only re-fires when who's logged in actually changes.
  useEffect(() => {
    if (!session) return;
    const balance = session.user.balance ?? 0;
    const spinsRemaining = session.user.bonusSpinsRemaining ?? 0;
    balanceRef.current = balance;
    setDemoBalance(balance);
    bonusSpinsRemainingRef.current = spinsRemaining;
    setBonusSpinsRemaining(spinsRemaining);
    setBonusSpinStake(session.user.bonusSpinStake ?? 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user.id]);

  const mutation = useMutation({
    mutationFn: async (staked: number): Promise<TRound> => {
      const response = await fetch(config.playEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stake: staked })
      });
      if (!response.ok) {
        const problem = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(problem?.error ?? "Round failed to resolve.");
      }
      return response.json() as Promise<TRound>;
    },
    onMutate: (staked) => {
      roundStartRef.current = Date.now();
      roundPlayingRef.current = true;
      setRoundPlaying(true);

      // Deduct immediately so the balance visibly moves the instant Play is
      // pressed — completeRound overwrites this with the server's
      // authoritative figure once the response lands, so this is just a
      // same-frame preview, not a second source of truth.
      const isBonusSpin = bonusSpinsRemainingRef.current > 0;
      preSpinBalanceRef.current = balanceRef.current;
      const optimisticBalance = Number((balanceRef.current - (isBonusSpin ? 0 : staked)).toFixed(2));
      balanceRef.current = optimisticBalance;
      setDemoBalance(optimisticBalance);

      setDisplayedWin(0);
    },
    onError: () => {
      balanceRef.current = preSpinBalanceRef.current;
      setDemoBalance(preSpinBalanceRef.current);
      roundPlayingRef.current = false;
      setRoundPlaying(false);
    }
  });

  const round = mutation.data ?? null;
  const effectiveStake = bonusSpinsRemaining > 0 ? bonusSpinStake : stake;

  const startRound = useCallback(() => {
    if (!isLoggedIn || needsDateOfBirth || mutation.isPending || roundPlayingRef.current) return;
    const currentStake = stakeRef.current;
    const hasBonusSpin = bonusSpinsRemainingRef.current > 0;
    if (!hasBonusSpin && balanceRef.current < currentStake) return;
    config.onBeforeStart?.();
    mutation.mutate(currentStake);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn, needsDateOfBirth, mutation]);

  /**
   * Call once the board is ready to reflect the server's authoritative
   * result (typically from the board's onRoundComplete callback). Settles
   * the wallet display and, per the UK minimum-round-speed rule, delays
   * re-enabling Play until at least MIN_ROUND_MS have passed since startRound.
   */
  const completeRound = useCallback(
    (completed: TRound) => {
      // Play is account-gated server-side (401 without a session), so a
      // completed round always carries wallet state; `wallet` is only
      // optional in the type to satisfy the board's base round type.
      const wallet = completed.wallet as WalletState;
      balanceRef.current = wallet.balance;
      setDemoBalance(wallet.balance);
      bonusSpinsRemainingRef.current = wallet.bonusSpinsRemaining;
      setBonusSpinsRemaining(wallet.bonusSpinsRemaining);
      setBonusSpinStake(wallet.bonusSpinStake);
      // Keep the header's balance pill (a separate useSession() subscriber) in sync.
      void refetchSession();
      setDisplayedWin(completed.cappedWin);

      const elapsed = Date.now() - roundStartRef.current;
      const remaining = Math.max(0, MIN_ROUND_MS - elapsed);
      const releasePlayButton = () => {
        roundPlayingRef.current = false;
        setRoundPlaying(false);
      };
      if (remaining > 0) {
        setTimeout(releasePlayButton, remaining);
      } else {
        releasePlayButton();
      }
    },
    [refetchSession]
  );

  const setStakeValue = useCallback((next: number) => {
    stakeRef.current = next;
    setStake(next);
  }, []);

  return {
    sessionPending,
    isLoggedIn,
    needsDateOfBirth,
    allowedStakes,
    demoBalance,
    displayedWin,
    stake,
    setStake: setStakeValue,
    bonusSpinsRemaining,
    bonusSpinStake,
    effectiveStake,
    roundPlaying,
    round,
    mutation,
    startRound,
    completeRound
  };
}
