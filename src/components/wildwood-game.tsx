"use client";

import { useMutation } from "@tanstack/react-query";
import type { SymbolType, WildwoodRoundResult, WildwoodStep } from "@/lib/wildwood";
import { WILDWOOD_CONFIG } from "@/lib/wildwood";
import { SYMBOL_ICON_SRC } from "@/lib/pixi/assets";
import { wildwoodSound } from "@/lib/pixi/sound";
import {
  WILDWOOD_BOARD_ASPECT,
  WILDWOOD_BOARD_DESIGN_HEIGHT,
  WILDWOOD_BOARD_DESIGN_WIDTH,
  WildwoodPixiBoard,
  type WildwoodBoardHandle
} from "@/components/wildwood-pixi-board";
import { authClient } from "@/lib/auth-client";
import { formatCredits } from "@/lib/currency";
import Link from "next/link";
import type { ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Everything around the board (site header, page header, cabinet, replay bar,
 * paddings) that eats into viewport height. The board's max-width is derived
 * from whatever's left of 100dvh so the play button never scrolls off-screen
 * on short viewports. Tuned against the live layout — re-check after touching
 * any of those surrounding pieces.
 */
const BOARD_HEIGHT_BUDGET_PX = 470;

type WalletState = { balance: number; bonusSpinsRemaining: number; bonusSpinStake: number; isBonusSpin: boolean };
// Optional because WildwoodPixiBoard's onRoundComplete is typed over the base
// WildwoodRoundResult — the play API always includes it now that play is
// account-gated, but this stays a boundary check on the HTTP response.
type PlayResult = WildwoodRoundResult & { wallet?: WalletState };

async function playWildwood(stake: number): Promise<PlayResult> {
  const response = await fetch("/api/wildwood/play", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ stake })
  });

  if (!response.ok) {
    const problem = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(problem?.error ?? "Wildwood failed to resolve.");
  }
  return response.json() as Promise<PlayResult>;
}

type StepInfo = { index: number; step: WildwoodStep; total: number };

export function WildwoodGame() {
  const { data: session, isPending: sessionPending, refetch: refetchSession } = authClient.useSession();
  const isLoggedIn = Boolean(session);

  const [demoBalance, setDemoBalance] = useState(0);
  const [stake, setStake] = useState(1);
  const [displayedWin, setDisplayedWin] = useState(0);
  const [stepInfo, setStepInfo] = useState<StepInfo | null>(null);
  const [muted, setMuted] = useState(false);
  const [turbo, setTurbo] = useState(false);
  const [autoPlay, setAutoPlay] = useState(false);
  const [roundPlaying, setRoundPlaying] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [bonusSpinsRemaining, setBonusSpinsRemaining] = useState(0);
  const [bonusSpinStake, setBonusSpinStake] = useState(0);

  const boardRef = useRef<WildwoodBoardHandle>(null);
  const balanceRef = useRef(0);
  const stakeRef = useRef(1);
  const autoPlayRef = useRef(false);
  const roundPlayingRef = useRef(false);
  const turboRef = useRef(false);
  const bonusSpinsRemainingRef = useRef(0);
  const autoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    mutationFn: playWildwood,
    onMutate: () => {
      roundPlayingRef.current = true;
      setRoundPlaying(true);
      // Balance/bonus state comes authoritatively from the play response
      // (handleRoundComplete), since the server may charge a different
      // (bonus) stake than the one requested — no optimistic update here.
      setDisplayedWin(0);
      setStepInfo(null);
    },
    onError: () => {
      roundPlayingRef.current = false;
      setRoundPlaying(false);
      autoPlayRef.current = false;
      setAutoPlay(false);
    }
  });

  const round = mutation.data ?? null;
  const replayEnabled = Boolean(round && stepInfo && stepInfo.total > 1);

  const startRound = useCallback(() => {
    if (!isLoggedIn || mutation.isPending || roundPlayingRef.current) return;
    const currentStake = stakeRef.current;
    const hasBonusSpin = bonusSpinsRemainingRef.current > 0;
    if (!hasBonusSpin && balanceRef.current < currentStake) {
      autoPlayRef.current = false;
      setAutoPlay(false);
      return;
    }
    wildwoodSound.resume();
    mutation.mutate(currentStake);
  }, [isLoggedIn, mutation]);

  const handleStepChange = useCallback((index: number, step: WildwoodStep, total: number) => {
    setStepInfo({ index, step, total });
  }, []);

  const handleRoundComplete = useCallback(
    (completed: PlayResult) => {
      // Play is account-gated server-side (401 without a session), so a
      // completed round always carries wallet state; `wallet` is only
      // optional in the type to satisfy WildwoodPixiBoard's base round type.
      const wallet = completed.wallet as WalletState;
      balanceRef.current = wallet.balance;
      setDemoBalance(wallet.balance);
      bonusSpinsRemainingRef.current = wallet.bonusSpinsRemaining;
      setBonusSpinsRemaining(wallet.bonusSpinsRemaining);
      setBonusSpinStake(wallet.bonusSpinStake);
      // Keep the header's balance pill (a separate useSession() subscriber) in sync.
      void refetchSession();
      setDisplayedWin(completed.cappedWin);
      roundPlayingRef.current = false;
      setRoundPlaying(false);

      const canAffordNext = bonusSpinsRemainingRef.current > 0 || balanceRef.current >= stakeRef.current;
      if (autoPlayRef.current && canAffordNext) {
        autoTimerRef.current = setTimeout(startRound, turboRef.current ? 220 : 650);
      } else if (autoPlayRef.current) {
        autoPlayRef.current = false;
        setAutoPlay(false);
      }
    },
    [startRound, refetchSession]
  );

  useEffect(() => {
    boardRef.current?.setTurbo(turbo);
    turboRef.current = turbo;
  }, [turbo]);

  useEffect(
    () => () => {
      if (autoTimerRef.current) clearTimeout(autoTimerRef.current);
    },
    []
  );

  const toggleAutoplay = () => {
    const next = !autoPlayRef.current;
    autoPlayRef.current = next;
    setAutoPlay(next);
    if (!next && autoTimerRef.current) {
      clearTimeout(autoTimerRef.current);
      autoTimerRef.current = null;
    }
    if (next && !roundPlayingRef.current && !mutation.isPending) {
      autoTimerRef.current = setTimeout(startRound, 0);
    }
  };

  const toggleSound = () => {
    const next = !muted;
    wildwoodSound.setMuted(next);
    setMuted(next);
  };

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-[2rem] border border-emerald-100/10 bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.08),transparent_42%),rgba(255,255,255,0.035)] p-3 shadow-2xl shadow-black/40 sm:p-5">
        <div className="mb-2 px-2">
          <h2 className="text-xl font-black tracking-tight text-white">Wildwood</h2>
        </div>

        <div
          className="relative mx-auto w-full overflow-hidden rounded-[1.75rem] border border-amber-300/15 bg-black/40 shadow-[0_0_0_1px_rgba(245,197,66,0.06),0_25px_60px_-15px_rgba(0,0,0,0.8)]"
          style={{
            aspectRatio: WILDWOOD_BOARD_ASPECT,
            maxWidth: `min(42rem, calc((100dvh - ${BOARD_HEIGHT_BUDGET_PX}px) * ${WILDWOOD_BOARD_DESIGN_WIDTH} / ${WILDWOOD_BOARD_DESIGN_HEIGHT}))`
          }}
        >
          <WildwoodPixiBoard ref={boardRef} round={round} onStepChange={handleStepChange} onRoundComplete={handleRoundComplete} />
        </div>

        <div className="mx-auto mt-3 w-full max-w-2xl rounded-[1.75rem] border border-amber-200/15 bg-[linear-gradient(180deg,rgba(52,33,15,0.94),rgba(7,17,12,0.98))] p-3 shadow-[inset_0_1px_0_rgba(255,245,200,0.12),0_16px_30px_-18px_rgba(0,0,0,0.9)]">
          {!sessionPending && !isLoggedIn ? (
            <div className="mb-3 flex flex-col items-center gap-2 rounded-xl border border-emerald-200/30 bg-emerald-300/10 px-3 py-3 text-center">
              <p className="text-sm font-black text-white">Sign up to play Wildwood</p>
              <p className="text-xs text-emerald-100/60">Free account, demo balance, a welcome bonus on your first deposit.</p>
              <div className="mt-1 flex gap-2">
                <Link
                  href="/signup"
                  className="rounded-full border border-amber-200/30 bg-gradient-to-b from-emerald-400 to-emerald-600 px-4 py-2 text-xs font-black text-emerald-950 transition hover:brightness-110"
                >
                  Sign up
                </Link>
                <Link
                  href="/login"
                  className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-black text-white transition hover:bg-white/10"
                >
                  Log in
                </Link>
              </div>
            </div>
          ) : bonusSpinsRemaining > 0 ? (
            <div className="mb-3 flex items-center justify-center gap-2 rounded-xl border border-amber-200/30 bg-amber-300/10 px-3 py-2 text-xs font-black uppercase tracking-wide text-amber-100">
              <span aria-hidden="true">🎁</span>
              Bonus spins: {bonusSpinsRemaining} left @ {formatCredits(bonusSpinStake)}
            </div>
          ) : null}

          <div className="grid grid-cols-3 gap-2 sm:grid-cols-[1fr_1fr_auto_1fr_1fr] sm:items-center">
            <CabinetMetric label="Balance" value={formatCredits(demoBalance)} />

            <label className="rounded-xl border border-white/10 bg-black/30 px-3 py-2">
              <span className="block text-[10px] font-black uppercase tracking-[0.16em] text-emerald-200/45">Stake</span>
              <select
                value={bonusSpinsRemaining > 0 ? bonusSpinStake : stake}
                onChange={(event) => {
                  const next = Number(event.target.value);
                  stakeRef.current = next;
                  setStake(next);
                }}
                disabled={!isLoggedIn || roundPlaying || autoPlay || bonusSpinsRemaining > 0}
                className="mt-0.5 w-full bg-transparent text-base font-black tabular-nums text-amber-100 outline-none disabled:opacity-50"
              >
                {WILDWOOD_CONFIG.allowedStakes.map((option) => (
                  <option key={option} value={option} className="bg-neutral-950">
                    {option.toFixed(2)}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              onClick={startRound}
              disabled={!isLoggedIn || roundPlaying || mutation.isPending || (bonusSpinsRemaining === 0 && demoBalance < stake)}
              aria-label="Play Wildwood"
              className="group relative col-start-2 row-start-2 mx-auto flex h-20 w-20 items-center justify-center rounded-full border-4 border-amber-100/60 bg-[radial-gradient(circle_at_35%_25%,#d1fae5_0%,#6ee7b7_22%,#10b981_52%,#065f46_78%,#032d22_100%)] text-3xl text-emerald-950 shadow-[inset_0_3px_6px_rgba(255,255,255,0.65),inset_0_-8px_15px_rgba(0,0,0,0.45),0_0_0_5px_rgba(28,18,6,0.9),0_10px_24px_rgba(16,185,129,0.32)] transition hover:brightness-110 active:translate-y-0.5 disabled:cursor-not-allowed disabled:grayscale disabled:opacity-45 sm:col-start-3 sm:row-start-1"
            >
              <span className="absolute inset-2 rounded-full border border-white/35" aria-hidden="true" />
              <span className="relative translate-x-0.5">{roundPlaying ? "✦" : "▶"}</span>
            </button>

            <CabinetMetric label="Win" value={formatCredits(displayedWin)} />
            <CabinetMetric label="Mode" value={autoPlay ? "AUTO" : turbo ? "TURBO" : "NORMAL"} compact />
          </div>

          <div className="mt-3 grid grid-cols-4 gap-2 border-t border-white/10 pt-3">
            <DeckButton label="Auto" icon="↻" active={autoPlay} disabled={!isLoggedIn} onClick={toggleAutoplay} />
            <DeckButton label="Turbo" icon="⚡" active={turbo} onClick={() => setTurbo((value) => !value)} />
            <DeckButton label={muted ? "Muted" : "Sound"} icon={muted ? "🔇" : "🔊"} active={!muted} onClick={toggleSound} />
            <DeckButton label="Info" icon="i" active={showInfo} onClick={() => setShowInfo((value) => !value)} />
          </div>
        </div>

        <div className="mx-auto mt-3 w-full max-w-2xl rounded-xl border border-white/10 bg-black/20 px-3 py-2">
          <div className="flex items-center gap-3">
            <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-emerald-200/45">Replay</span>
            <input
              type="range"
              min={0}
              max={Math.max(0, (stepInfo?.total ?? 1) - 1)}
              value={stepInfo?.index ?? 0}
              onChange={(event) => boardRef.current?.seek(Number(event.target.value))}
              disabled={!replayEnabled || roundPlaying}
              className="h-1 w-full cursor-pointer appearance-none rounded-full bg-white/15 accent-emerald-300 disabled:cursor-not-allowed disabled:opacity-30"
              aria-label="Replay step"
            />
            <span className="shrink-0 text-xs font-bold tabular-nums text-emerald-100/60">{stepInfo ? `${stepInfo.index + 1}/${stepInfo.total}` : "–/–"}</span>
            <button
              type="button"
              onClick={() => boardRef.current?.skipToEnd()}
              disabled={!replayEnabled || !roundPlaying}
              className="shrink-0 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs font-bold text-emerald-100/70 transition hover:border-emerald-300/30 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
            >
              Skip ▸▸
            </button>
          </div>
        </div>

        {mutation.isError ? <p className="mx-auto mt-3 max-w-2xl text-sm font-bold text-red-300">{mutation.error.message}</p> : null}
      </section>

      {showInfo ? (
        <section className="grid gap-4 lg:grid-cols-3">
          <Panel title="Round result">
            {round ? (
              <dl className="space-y-3 text-sm">
                <Metric label="Round" value={round.roundId} />
                <Metric label="Stake" value={`${round.stake.toFixed(2)}x`} />
                <Metric label="Spirit Seeds" value={`${round.spiritSeedsSeen}`} />
                <Metric label="Base win" value={`🪙 ${formatCredits(round.baseWin)}`} />
                <Metric label="Bonus" value={round.bonus ? `🪙 ${formatCredits(round.bonus.bonusWin * round.stake)}` : "No"} />
                {round.bonus ? <Metric label="Bonus peak" value={`${round.bonus.peakMultiplier}x · ${round.bonus.collectorsHeld} held`} /> : null}
                <Metric label="Total win" value={`🪙 ${formatCredits(round.cappedWin)}`} />
                <Metric label="Uncapped" value={`🪙 ${formatCredits(round.uncappedWin)}`} />
                <Metric label="Cap applied" value={round.capApplied ? "Yes" : "No"} />
              </dl>
            ) : (
              <p className="text-sm text-emerald-100/60">No round yet.</p>
            )}
          </Panel>

          <Panel title="Replay log">
            {round ? (
              <ol className="max-h-[22rem] space-y-2 overflow-auto pr-1 text-sm text-emerald-50/80">
                {round.steps.map((step, index) => (
                  <li key={`${step.type}-${index}`}>
                    <button
                      type="button"
                      onClick={() => boardRef.current?.seek(index)}
                      className={`w-full rounded-xl border p-3 text-left transition ${
                        index === stepInfo?.index ? "border-emerald-300/40 bg-emerald-400/10" : "border-white/10 bg-black/20 hover:border-white/20"
                      }`}
                    >
                      <span className="font-bold text-white">{index + 1}.</span> {step.message}
                    </button>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-emerald-100/60">Replay steps will appear after a play.</p>
            )}
          </Panel>

          <Panel title="Symbol guide">
            <ul className="grid grid-cols-2 gap-2 text-xs">
              {(Object.keys(SYMBOL_ICON_SRC) as SymbolType[]).map((symbol) => (
                <li key={symbol} className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 p-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={SYMBOL_ICON_SRC[symbol]} alt={symbol} className="h-8 w-8 shrink-0" />
                  <div className="min-w-0">
                    <p className="truncate font-bold capitalize text-white">{symbol === "spiritSeed" ? "Spirit Seed" : symbol}</p>
                    <p className="truncate text-emerald-100/50">{symbolNote(symbol)}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Panel>
        </section>
      ) : null}
    </div>
  );
}

function CabinetMetric({ label, value, compact = false }: Readonly<{ label: string; value: string; compact?: boolean }>) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2">
      <span className="block text-[10px] font-black uppercase tracking-[0.16em] text-emerald-200/45">{label}</span>
      <span className={`block truncate font-black tabular-nums text-amber-100 ${compact ? "text-sm" : "text-base"}`}>{value}</span>
    </div>
  );
}

function DeckButton({
  label,
  icon,
  active,
  disabled = false,
  onClick
}: Readonly<{ label: string; icon: string; active: boolean; disabled?: boolean; onClick: () => void }>) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={`rounded-xl border px-2 py-2 text-xs font-black uppercase tracking-wide transition disabled:cursor-not-allowed disabled:opacity-40 ${
        active
          ? "border-emerald-200/40 bg-emerald-300/15 text-emerald-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_0_14px_rgba(16,185,129,0.12)]"
          : "border-white/10 bg-black/25 text-emerald-100/45 hover:border-white/20 hover:text-emerald-100/75"
      }`}
    >
      <span className="mr-1 text-sm" aria-hidden="true">{icon}</span>
      {label}
    </button>
  );
}

function symbolNote(symbol: SymbolType): string {
  if (symbol === "spiritSeed") return "Persistent shared reward";
  if (symbol === "rot") return "No value";
  const collectorMultiplier = (WILDWOOD_CONFIG.collectorMultipliers as Partial<Record<SymbolType, number>>)[symbol];
  if (collectorMultiplier) return `Collector · ${collectorMultiplier}x`;
  const value = WILDWOOD_CONFIG.symbolValues[symbol];
  return `Worth ${value.toFixed(3)}x`;
}

function Panel({ title, children }: Readonly<{ title: string; children: ReactNode }>) {
  return (
    <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-5 shadow-xl shadow-black/20">
      <h3 className="mb-4 text-lg font-black text-white">{title}</h3>
      {children}
    </div>
  );
}

function Metric({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-2 last:border-b-0 last:pb-0">
      <dt className="text-emerald-100/60">{label}</dt>
      <dd className="truncate font-black text-white">{value}</dd>
    </div>
  );
}
