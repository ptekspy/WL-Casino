"use client";

import type { DragonforgeRoundResult, DragonforgeStep, SymbolType } from "@/lib/dragonforge";
import { DRAGONFORGE_CONFIG } from "@/lib/dragonforge";
import { DRAGONFORGE_SYMBOL_ICON_SRC } from "@/lib/pixi/dragonforge-assets";
import { dragonforgeSound } from "@/lib/pixi/sound";
import {
  DRAGONFORGE_BOARD_ASPECT,
  DRAGONFORGE_BOARD_DESIGN_HEIGHT,
  DRAGONFORGE_BOARD_DESIGN_WIDTH,
  DragonforgePixiBoard,
  type DragonforgeBoardHandle
} from "@/components/dragonforge-pixi-board";
import { formatCredits } from "@/lib/currency";
import { useCasinoRound, type WalletState } from "@/components/game-shell/use-casino-round";
import { GameCabinet, BoardIconButton } from "@/components/game-shell/game-cabinet";
import type { ReactNode } from "react";
import { useCallback, useRef, useState } from "react";

// Optional because DragonforgePixiBoard's onRoundComplete is typed over the
// base DragonforgeRoundResult — the play API always includes it now that
// play is account-gated, but this stays a boundary check on the HTTP response.
type PlayResult = DragonforgeRoundResult & { wallet?: WalletState };

type StepInfo = { index: number; step: DragonforgeStep; total: number };

const SYMBOL_ORDER: SymbolType[] = [
  "stone", "iron", "gold", "gem", "relic", "unstableRock", "dragonEgg", "miner", "prospector", "smith", "scout"
];

const SYMBOL_DISPLAY_NAME: Record<SymbolType, string> = {
  stone: "Stone",
  iron: "Iron",
  gold: "Gold",
  gem: "Gem",
  relic: "Relic",
  unstableRock: "Unstable Rock",
  dragonEgg: "Dragon Egg",
  miner: "Miner",
  prospector: "Prospector",
  smith: "Smith",
  scout: "Scout"
};

export function DragonforgeGame() {
  const [muted, setMuted] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [stepInfo, setStepInfo] = useState<StepInfo | null>(null);
  const boardRef = useRef<DragonforgeBoardHandle>(null);

  const cabinet = useCasinoRound<PlayResult>({
    playEndpoint: "/api/dragonforge/play",
    allowedStakes: DRAGONFORGE_CONFIG.allowedStakes,
    onBeforeStart: () => dragonforgeSound.resume()
  });

  const round = cabinet.round;

  const handleStepChange = useCallback((index: number, step: DragonforgeStep, total: number) => {
    setStepInfo({ index, step, total });
  }, []);

  const handleRoundComplete = useCallback(
    (completed: PlayResult) => {
      setStepInfo(null);
      cabinet.completeRound(completed);
    },
    [cabinet]
  );

  const toggleSound = () => {
    const next = !muted;
    dragonforgeSound.setMuted(next);
    setMuted(next);
  };

  return (
    <div className="flex h-full flex-col gap-6">
      <GameCabinet
        gameName="Dragonforge"
        boardAspect={DRAGONFORGE_BOARD_ASPECT}
        boardDesignWidth={DRAGONFORGE_BOARD_DESIGN_WIDTH}
        boardDesignHeight={DRAGONFORGE_BOARD_DESIGN_HEIGHT}
        board={
          <DragonforgePixiBoard
            ref={boardRef}
            round={round}
            stake={round?.stake ?? cabinet.effectiveStake}
            onStepChange={handleStepChange}
            onRoundComplete={handleRoundComplete}
          />
        }
        cornerBadges={
          <>
            <BoardIconButton icon={muted ? "🔇" : "🔊"} label={muted ? "Unmute" : "Mute"} active={!muted} onClick={toggleSound} />
            <BoardIconButton icon="i" label="Info" active={showInfo} onClick={() => setShowInfo((value) => !value)} />
          </>
        }
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

      {showInfo ? (
        <section className="grid gap-4 lg:grid-cols-3">
          <Panel title="Round result">
            {round ? (
              <dl className="space-y-3 text-sm">
                <Metric label="Round" value={round.roundId} />
                <Metric label="Stake" value={`${round.stake.toFixed(2)}x`} />
                <Metric label="Dragon Eggs" value={`${round.dragonEggsSeen}`} />
                <Metric label="Base win" value={`🪙 ${formatCredits(round.baseWin)}`} />
                <Metric label="Hoard" value={round.bonus ? `🪙 ${formatCredits(round.bonus.bonusWin * round.stake)}` : "No"} />
                {round.bonus ? (
                  <>
                    <Metric label="Hoard peak" value={`${round.bonus.peakMultiplier}x · ${round.bonus.collectorsHeld} held`} />
                    <Metric label="Delves" value={`${round.bonus.delvesUsed}`} />
                    <Metric label="Dragon woke" value={round.bonus.dragonWoke ? "Yes" : "No — surfaced safely"} />
                  </>
                ) : null}
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
                        index === stepInfo?.index ? "border-teal-300/40 bg-teal-400/10" : "border-white/10 bg-black/20 hover:border-white/20"
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
              {SYMBOL_ORDER.map((symbol) => (
                <li key={symbol} className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 p-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={DRAGONFORGE_SYMBOL_ICON_SRC[symbol]}
                    alt={symbol}
                    className="h-8 w-8 shrink-0 rounded-full border border-white/15 object-cover"
                  />
                  <div className="min-w-0">
                    <p className="truncate font-bold text-white">{SYMBOL_DISPLAY_NAME[symbol]}</p>
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

function symbolNote(symbol: SymbolType): string {
  if (symbol === "dragonEgg") return "Persistent shared reward";
  if (symbol === "unstableRock") return "No value";
  const collectorMultiplier = (DRAGONFORGE_CONFIG.collectorMultipliers as Partial<Record<SymbolType, number>>)[symbol];
  if (collectorMultiplier) return `Collector · ${collectorMultiplier}x`;
  const value = DRAGONFORGE_CONFIG.symbolValues[symbol];
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
