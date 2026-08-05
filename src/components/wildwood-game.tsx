"use client";

import { useMutation } from "@tanstack/react-query";
import type { SymbolType, WildwoodRoundResult, WildwoodStep } from "@/lib/wildwood";
import { WILDWOOD_CONFIG } from "@/lib/wildwood";
import { SYMBOL_ICON_SRC } from "@/lib/pixi/assets";
import { wildwoodSound } from "@/lib/pixi/sound";
import { WILDWOOD_BOARD_ASPECT, WildwoodPixiBoard, type WildwoodBoardHandle } from "@/components/wildwood-pixi-board";
import type { ReactNode } from "react";
import { useCallback, useRef, useState } from "react";

async function playWildwood(stake: number): Promise<WildwoodRoundResult> {
  const response = await fetch("/api/wildwood/play", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ stake })
  });

  if (!response.ok) {
    const problem = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(problem?.error ?? "Wildwood failed to resolve.");
  }
  return response.json() as Promise<WildwoodRoundResult>;
}

type StepInfo = { index: number; step: WildwoodStep; total: number };

export function WildwoodGame() {
  const [demoBalance, setDemoBalance] = useState(1000);
  const [stake, setStake] = useState(1);
  const [stepInfo, setStepInfo] = useState<StepInfo | null>(null);
  const [muted, setMuted] = useState(false);
  const boardRef = useRef<WildwoodBoardHandle>(null);

  const mutation = useMutation({
    mutationFn: playWildwood,
    onMutate: (staked) => {
      setDemoBalance((balance) => Number((balance - staked).toFixed(2)));
      setStepInfo(null);
      return { staked };
    },
    onError: (_error, _staked, context) => {
      if (context) setDemoBalance((balance) => Number((balance + context.staked).toFixed(2)));
    }
  });

  const round = mutation.data ?? null;
  const replayEnabled = Boolean(round && stepInfo && stepInfo.total > 1);

  const handleStepChange = useCallback((index: number, step: WildwoodStep, total: number) => {
    setStepInfo({ index, step, total });
  }, []);

  const handleRoundComplete = useCallback((completed: WildwoodRoundResult) => {
    setDemoBalance((balance) => Number((balance + completed.cappedWin).toFixed(2)));
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-4 shadow-2xl shadow-black/30 sm:p-6">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-black text-white">Play Wildwood</h2>
            <p className="text-sm text-emerald-100/65">Server-resolved fake-money round, replayed live from the returned diffs.</p>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-amber-300/25 bg-gradient-to-b from-emerald-400/15 to-emerald-950/40 px-4 py-2 text-sm font-bold text-amber-50 shadow-inner shadow-black/40">
            <span className="text-base">🪙</span>
            Balance: {demoBalance.toFixed(2)} credits
          </div>
        </div>

        <div
          className="relative mx-auto w-full max-w-2xl overflow-hidden rounded-[1.75rem] border border-amber-300/15 bg-black/40 shadow-[0_0_0_1px_rgba(245,197,66,0.06),0_25px_60px_-15px_rgba(0,0,0,0.8)]"
          style={{ aspectRatio: WILDWOOD_BOARD_ASPECT }}
        >
          <WildwoodPixiBoard ref={boardRef} round={round} onStepChange={handleStepChange} onRoundComplete={handleRoundComplete} />
          <button
            type="button"
            onClick={() => {
              const next = !muted;
              wildwoodSound.setMuted(next);
              setMuted(next);
            }}
            aria-label={muted ? "Unmute sound" : "Mute sound"}
            aria-pressed={muted}
            className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-black/50 text-lg text-emerald-100/80 backdrop-blur transition hover:border-emerald-300/40 hover:text-white"
          >
            {muted ? "🔇" : "🔊"}
          </button>
        </div>

        <div className="mx-auto mt-5 flex w-full max-w-2xl flex-col gap-3 sm:flex-row sm:items-center">
          <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-emerald-100/70">
            Stake
            <select
              value={stake}
              onChange={(event) => setStake(Number(event.target.value))}
              className="rounded-xl border border-white/10 bg-neutral-950 px-3 py-2 font-bold text-white outline-none"
            >
              {WILDWOOD_CONFIG.allowedStakes.map((option) => (
                <option key={option} value={option}>
                  {option.toFixed(2)}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            onClick={() => {
              wildwoodSound.resume();
              mutation.mutate(stake);
            }}
            disabled={mutation.isPending || demoBalance < stake}
            className="relative overflow-hidden rounded-2xl border border-emerald-200/40 bg-gradient-to-b from-emerald-200 via-emerald-300 to-emerald-500 px-6 py-4 text-base font-black text-emerald-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.6),0_10px_25px_-8px_rgba(4,120,87,0.8)] transition duration-150 hover:brightness-105 active:translate-y-px active:shadow-[inset_0_1px_0_rgba(255,255,255,0.4),0_4px_10px_-6px_rgba(4,120,87,0.8)] disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-neutral-700 disabled:bg-none disabled:text-neutral-400 disabled:shadow-none sm:ml-auto"
          >
            <span className="pointer-events-none absolute inset-x-2 top-1 h-1/3 rounded-full bg-white/40 blur-[2px]" aria-hidden="true" />
            <span className="relative">{mutation.isPending ? "Resolving..." : "Play Wildwood"}</span>
          </button>
        </div>

        {/* Always rendered (disabled when there's nothing to scrub) so it never shifts the layout when it activates. */}
        <div className="mx-auto mt-4 w-full max-w-2xl rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="shrink-0 text-xs font-bold uppercase tracking-wider text-emerald-200/60">Replay</span>
            <input
              type="range"
              min={0}
              max={Math.max(0, (stepInfo?.total ?? 1) - 1)}
              value={stepInfo?.index ?? 0}
              onChange={(event) => boardRef.current?.seek(Number(event.target.value))}
              disabled={!replayEnabled}
              className="h-1 w-full cursor-pointer appearance-none rounded-full bg-white/15 accent-emerald-300 disabled:cursor-not-allowed disabled:opacity-30"
              aria-label="Replay step"
            />
            <span className="shrink-0 text-xs font-bold tabular-nums text-emerald-100/70">{stepInfo ? `${stepInfo.index + 1}/${stepInfo.total}` : "–/–"}</span>
            <button
              type="button"
              onClick={() => boardRef.current?.skipToEnd()}
              disabled={!replayEnabled}
              className="shrink-0 rounded-lg border border-white/10 bg-white/5 px-3 py-1 text-xs font-bold text-emerald-100/80 transition hover:border-emerald-300/30 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
            >
              Skip ▸▸
            </button>
          </div>
        </div>

        {mutation.isError ? <p className="mt-3 text-sm font-bold text-red-300">{mutation.error.message}</p> : null}
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Panel title="Round result">
          {round ? (
            <dl className="space-y-3 text-sm">
              <Metric label="Round" value={round.roundId} />
              <Metric label="Stake" value={`${round.stake.toFixed(2)}x`} />
              <Metric label="Spirit Seeds" value={`${round.spiritSeedsSeen}`} />
              <Metric label="Base win" value={`🪙 ${round.baseWin.toFixed(2)}`} />
              <Metric label="Bonus" value={round.bonus ? `🪙 ${(round.bonus.bonusWin * round.stake).toFixed(2)}` : "No"} />
              {round.bonus ? <Metric label="Bonus peak" value={`${round.bonus.peakMultiplier}x · ${round.bonus.collectorsHeld} held`} /> : null}
              <Metric label="Total win" value={`🪙 ${round.cappedWin.toFixed(2)}`} />
              <Metric label="Uncapped" value={`🪙 ${round.uncappedWin.toFixed(2)}`} />
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
    </div>
  );
}

function symbolNote(symbol: SymbolType): string {
  if (symbol === "spiritSeed") return "Triggers the bonus";
  if (symbol === "rot") return "No value, blocks nothing";
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
