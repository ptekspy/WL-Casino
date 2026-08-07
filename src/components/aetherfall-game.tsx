"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AETHERFALL_CONFIG,
  getAetherfallTheoreticalRtp,
  type AetherfallLead,
  type AetherfallRoundResult
} from "@/lib/aetherfall";
import { formatCredits } from "@/lib/currency";
import { GameCabinet } from "@/components/game-shell/game-cabinet";
import { useCasinoRound, type WalletState } from "@/components/game-shell/use-casino-round";

type PlayResult = AetherfallRoundResult & { wallet?: WalletState };

const LEAD_COPY: Record<AetherfallLead, { name: string; volatility: string; description: string; icon: string }> = {
  vanguard: {
    name: "Vanguard",
    volatility: "Low volatility",
    description: "Frequent smaller returns and the smoothest battle curve.",
    icon: "🛡️"
  },
  spellblade: {
    name: "Spellblade",
    volatility: "Balanced",
    description: "Middle-ground hit rate with access to the full 1000x tail.",
    icon: "⚔️"
  },
  shadow: {
    name: "Shadow",
    volatility: "High volatility",
    description: "More wipes, fewer hits, much heavier boss-win concentration.",
    icon: "🌘"
  }
};

export function AetherfallGame() {
  const [lead, setLead] = useState<AetherfallLead>(AETHERFALL_CONFIG.defaultLead);
  const [showInfo, setShowInfo] = useState(false);

  const cabinet = useCasinoRound<PlayResult>({
    playEndpoint: "/api/aetherfall/play",
    allowedStakes: AETHERFALL_CONFIG.allowedStakes,
    buildRequestBody: () => ({ lead })
  });

  const handleRoundComplete = useCallback(
    (round: PlayResult) => {
      cabinet.completeRound(round);
    },
    [cabinet.completeRound]
  );

  return (
    <div className="flex h-full flex-col gap-4 p-3 sm:p-5">
      <section className="mx-auto w-full max-w-3xl rounded-[1.5rem] border border-cyan-200/10 bg-[linear-gradient(135deg,rgba(9,30,48,0.9),rgba(29,12,46,0.85))] p-3 shadow-xl shadow-black/30">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-200/50">Choose your lead</p>
            <h2 className="text-lg font-black text-white">Same 95% RTP, different volatility</h2>
          </div>
          <button
            type="button"
            onClick={() => setShowInfo((value) => !value)}
            className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-black text-white/80 hover:bg-white/10"
          >
            {showInfo ? "Hide math" : "Math"}
          </button>
        </div>

        <div className="grid gap-2 sm:grid-cols-3">
          {(Object.keys(LEAD_COPY) as AetherfallLead[]).map((option) => {
            const copy = LEAD_COPY[option];
            const active = option === lead;
            return (
              <button
                key={option}
                type="button"
                disabled={cabinet.roundPlaying}
                onClick={() => setLead(option)}
                className={`rounded-2xl border p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${
                  active ? "border-cyan-300/50 bg-cyan-300/10" : "border-white/10 bg-black/20 hover:border-white/20"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-2xl" aria-hidden="true">{copy.icon}</span>
                  <div>
                    <p className="font-black text-white">{copy.name}</p>
                    <p className="text-[11px] font-bold uppercase tracking-wide text-cyan-100/55">{copy.volatility}</p>
                  </div>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-white/55">{copy.description}</p>
              </button>
            );
          })}
        </div>

        {showInfo ? (
          <div className="mt-3 grid gap-2 rounded-2xl border border-white/10 bg-black/25 p-3 text-xs text-white/65 sm:grid-cols-3">
            {(Object.keys(LEAD_COPY) as AetherfallLead[]).map((option) => (
              <div key={option}>
                <p className="font-black text-white">{LEAD_COPY[option].name}</p>
                <p>{(getAetherfallTheoreticalRtp(option) * 100).toFixed(2)}% theoretical RTP</p>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      <GameCabinet
        gameName="Aetherfall"
        boardAspect="16 / 10"
        boardDesignWidth={960}
        boardDesignHeight={600}
        heightBudgetPx={260}
        board={<AetherfallBattleBoard round={cabinet.round} onRoundComplete={handleRoundComplete} />}
        sessionPending={cabinet.sessionPending}
        isLoggedIn={cabinet.isLoggedIn}
        needsDateOfBirth={cabinet.needsDateOfBirth}
        bonusSpinsRemaining={cabinet.bonusSpinsRemaining}
        bonusSpinStake={cabinet.bonusSpinStake}
        balanceLabel={formatCredits(cabinet.demoBalance)}
        winLabel={formatCredits(cabinet.displayedWin)}
        onPlay={cabinet.startRound}
        playDisabled={
          !cabinet.isLoggedIn ||
          cabinet.needsDateOfBirth ||
          cabinet.roundPlaying ||
          cabinet.mutation.isPending ||
          (cabinet.bonusSpinsRemaining === 0 && cabinet.demoBalance < cabinet.stake)
        }
        playBusy={cabinet.roundPlaying}
        stakeOptions={cabinet.allowedStakes}
        stakeValue={cabinet.bonusSpinsRemaining > 0 ? cabinet.bonusSpinStake : cabinet.stake}
        onStakeChange={cabinet.setStake}
        stakeDisabled={!cabinet.isLoggedIn || cabinet.needsDateOfBirth || cabinet.roundPlaying || cabinet.bonusSpinsRemaining > 0}
        errorMessage={cabinet.mutation.isError ? cabinet.mutation.error.message : null}
      />
    </div>
  );
}

function AetherfallBattleBoard({
  round,
  onRoundComplete
}: Readonly<{ round: PlayResult | null; onRoundComplete: (round: PlayResult) => void }>) {
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    if (!round) return;
    setStepIndex(0);
    let index = 0;
    const interval = window.setInterval(() => {
      index += 1;
      if (index >= round.steps.length) {
        window.clearInterval(interval);
        onRoundComplete(round);
        return;
      }
      setStepIndex(index);
    }, 430);
    return () => window.clearInterval(interval);
  }, [round?.roundId, onRoundComplete]);

  const step = round?.steps[Math.min(stepIndex, Math.max(0, round.steps.length - 1))] ?? null;
  const enemyHpPercent = round && step ? Math.max(0, (step.enemyHp / round.encounter.maxHp) * 100) : 100;
  const resolutionLabel = useMemo(() => {
    if (!round) return null;
    if (round.resolution === "partyWipe") return "Party wiped";
    if (round.resolution === "retreat") return "Retreated with salvage";
    return "Victory";
  }, [round]);

  return (
    <div className="relative h-full w-full overflow-hidden bg-[radial-gradient(circle_at_50%_18%,rgba(77,208,225,0.18),transparent_28%),radial-gradient(circle_at_82%_45%,rgba(168,85,247,0.2),transparent_34%),linear-gradient(180deg,#071522_0%,#0d1020_48%,#160d22_100%)] text-white">
      <div className="absolute inset-0 opacity-30" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.03) 1px, transparent 1px)", backgroundSize: "36px 36px" }} />

      {!round || !step ? (
        <div className="relative flex h-full flex-col items-center justify-center p-8 text-center">
          <div className="mb-4 flex h-24 w-24 items-center justify-center rounded-full border border-cyan-200/20 bg-cyan-300/10 text-5xl shadow-[0_0_60px_rgba(34,211,238,0.18)]">✦</div>
          <h3 className="text-3xl font-black tracking-tight">Aetherfall</h3>
          <p className="mt-2 max-w-md text-sm text-cyan-50/55">A party-based casino battle. Choose a lead, stake the expedition, then watch the server-resolved encounter play out.</p>
        </div>
      ) : (
        <div className="relative grid h-full grid-rows-[auto_1fr_auto] gap-3 p-4 sm:p-6">
          <div className="grid grid-cols-[1fr_auto] items-start gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-full border border-fuchsia-200/20 bg-fuchsia-300/10 px-2 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-fuchsia-100/70">{round.encounter.rank}</span>
                <span className="text-xs font-bold text-white/45">Turn {step.turn}/{round.steps.length}</span>
              </div>
              <h3 className="mt-2 text-xl font-black sm:text-2xl">{round.encounter.name}</h3>
              <Bar value={enemyHpPercent} label={`${step.enemyHp.toLocaleString()} / ${round.encounter.maxHp.toLocaleString()} HP`} />
            </div>
            <div className="rounded-2xl border border-amber-200/20 bg-amber-300/10 px-3 py-2 text-right">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-100/55">Potential payout</p>
              <p className="text-xl font-black tabular-nums text-amber-100">{round.payoutMultiplier.toFixed(2)}x</p>
            </div>
          </div>

          <div className="grid min-h-0 items-center gap-3 sm:grid-cols-[1fr_1.2fr]">
            <div className="grid grid-cols-2 gap-2">
              {[
                ["🛡️", "Vanguard"],
                ["⚔️", "Spellblade"],
                ["🏹", "Ranger"],
                ["✨", "White Sage"]
              ].map(([icon, name]) => (
                <div key={name} className={`rounded-2xl border p-3 ${step.actor === name ? "border-cyan-300/45 bg-cyan-300/10" : "border-white/10 bg-black/20"}`}>
                  <div className="flex items-center gap-2">
                    <span className="text-xl" aria-hidden="true">{icon}</span>
                    <span className="text-xs font-black text-white">{name}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-[1.5rem] border border-white/10 bg-black/30 p-4 shadow-xl shadow-black/20">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-100/45">Battle log</p>
              <p className="mt-1 text-lg font-black text-white">{step.action}</p>
              <p className="mt-1 text-sm text-white/60">{step.message}</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <Bar value={step.partyHp} label={`Party HP ${step.partyHp}%`} />
                <Bar value={step.limitMeter} label={`Limit ${step.limitMeter}%`} />
              </div>
              {step.damage > 0 ? <p className="mt-3 text-sm font-black text-fuchsia-100">{step.critical ? "CRITICAL · " : ""}{step.damage.toLocaleString()} damage</p> : null}
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/25 px-4 py-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/35">Lead</p>
              <p className="text-sm font-black text-white">{LEAD_COPY[round.lead].name} · {LEAD_COPY[round.lead].volatility}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/35">Result</p>
              <p className="text-sm font-black text-cyan-100">{resolutionLabel} · {formatCredits(round.cappedWin)}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Bar({ value, label }: Readonly<{ value: number; label: string }>) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className="mt-2">
      <div className="mb-1 flex items-center justify-between text-[10px] font-bold text-white/45">
        <span>{label}</span>
        <span>{Math.round(clamped)}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-violet-400 to-fuchsia-400 transition-[width] duration-300" style={{ width: `${clamped}%` }} />
      </div>
    </div>
  );
}
