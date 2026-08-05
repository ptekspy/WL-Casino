"use client";

import { useMutation } from "@tanstack/react-query";
import type { BoardCell, WildwoodRoundResult } from "@/lib/wildwood";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";

async function playWildwood(stake: number): Promise<WildwoodRoundResult> {
  const response = await fetch("/api/wildwood/play", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ stake })
  });

  if (!response.ok) throw new Error("Wildwood failed to resolve.");
  return response.json() as Promise<WildwoodRoundResult>;
}

export function WildwoodGame() {
  const [demoBalance, setDemoBalance] = useState(1000);
  const [stake, setStake] = useState(1);
  const mutation = useMutation({
    mutationFn: playWildwood,
    onSuccess: (round) => {
      setDemoBalance((balance) => Number((balance - round.stake + round.cappedWin).toFixed(2)));
    }
  });

  const round = mutation.data;
  const displayBoard = useMemo(() => round?.bonus?.finalBoard ?? round?.finalBoard ?? null, [round]);

  return (
    <section className="grid gap-6 lg:grid-cols-[1fr_24rem]">
      <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-4 shadow-2xl shadow-black/30 sm:p-6">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-black text-white">Play Wildwood</h2>
            <p className="text-sm text-emerald-100/65">Server-resolved fake-money round. Client shows the replay result.</p>
          </div>
          <div className="rounded-full border border-emerald-300/15 bg-emerald-400/10 px-4 py-2 text-sm font-bold text-emerald-50">
            Balance: {demoBalance.toFixed(2)} credits
          </div>
        </div>

        {displayBoard ? (
          <WildwoodBoard board={displayBoard} />
        ) : (
          <div className="flex min-h-[26rem] items-center justify-center rounded-[1.75rem] border border-dashed border-emerald-300/20 bg-black/20 p-8 text-center">
            <div>
              <div className="text-6xl">🌲</div>
              <p className="mt-4 text-xl font-black text-white">Ready to grow the Wildwood.</p>
              <p className="mt-2 text-emerald-100/60">Press play to generate a fresh 6×6 board.</p>
            </div>
          </div>
        )}

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-emerald-100/70">
            Stake
            <select
              value={stake}
              onChange={(event) => setStake(Number(event.target.value))}
              className="rounded-xl border border-white/10 bg-neutral-950 px-3 py-2 font-bold text-white outline-none"
            >
              <option value={0.2}>0.20</option>
              <option value={0.5}>0.50</option>
              <option value={1}>1.00</option>
              <option value={2}>2.00</option>
              <option value={5}>5.00</option>
            </select>
          </label>

          <button
            type="button"
            onClick={() => mutation.mutate(stake)}
            disabled={mutation.isPending || demoBalance < stake}
            className="rounded-2xl bg-emerald-300 px-6 py-4 text-base font-black text-emerald-950 shadow-lg shadow-emerald-950/30 transition hover:bg-emerald-200 disabled:cursor-not-allowed disabled:bg-neutral-700 disabled:text-neutral-400 sm:ml-auto"
          >
            {mutation.isPending ? "Resolving..." : "Play Wildwood"}
          </button>
        </div>
      </div>

      <aside className="space-y-4">
        <Panel title="Round result">
          {round ? (
            <dl className="space-y-3 text-sm">
              <Metric label="Seed" value={round.seed.slice(0, 12)} />
              <Metric label="Stake" value={`${round.stake.toFixed(2)}x`} />
              <Metric label="Base win" value={`${round.baseWin.toFixed(2)}x`} />
              <Metric label="Bonus" value={round.bonus ? `${round.bonus.bonusWin.toFixed(2)}x` : "No"} />
              <Metric label="Capped win" value={`${round.cappedWin.toFixed(2)}x`} />
              <Metric label="Uncapped" value={`${round.uncappedWin.toFixed(2)}x`} />
              <Metric label="Cap applied" value={round.capApplied ? "Yes" : "No"} />
            </dl>
          ) : (
            <p className="text-sm text-emerald-100/60">No round yet.</p>
          )}
        </Panel>

        <Panel title="Replay log">
          {round ? (
            <ol className="max-h-[26rem] space-y-2 overflow-auto pr-1 text-sm text-emerald-50/80">
              {round.steps.map((step, index) => (
                <li key={`${step.type}-${index}`} className="rounded-xl border border-white/10 bg-black/20 p-3">
                  <span className="font-bold text-white">{index + 1}.</span> {step.message}
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-emerald-100/60">Replay steps will appear after a play.</p>
          )}
        </Panel>
      </aside>
    </section>
  );
}

function WildwoodBoard({ board }: Readonly<{ board: BoardCell[] }>) {
  return (
    <div className="grid grid-cols-6 gap-2 rounded-[1.75rem] border border-emerald-300/10 bg-black/30 p-3 shadow-inner shadow-black/50">
      {board.map((cell) => (
        <div key={cell.id} className={`flex aspect-square flex-col items-center justify-center gap-1 rounded-2xl text-center shadow-lg ring-1 ${symbolClasses[cell.symbol]}`} title={`${cell.symbol} (${cell.x}, ${cell.y})`}>
          <span className="text-2xl sm:text-3xl">{symbolEmoji[cell.symbol]}</span>
          <span className="hidden text-[0.6rem] font-bold uppercase tracking-wider opacity-70 sm:block">
            {cell.symbol === "spiritSeed" ? "seed" : cell.symbol}
          </span>
        </div>
      ))}
    </div>
  );
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
      <dd className="font-black text-white">{value}</dd>
    </div>
  );
}

const symbolClasses: Record<BoardCell["symbol"], string> = {
  leaf: "bg-emerald-400/15 text-emerald-100 ring-emerald-300/20",
  acorn: "bg-amber-500/15 text-amber-100 ring-amber-300/20",
  mushroom: "bg-red-400/15 text-red-100 ring-red-300/20",
  bloom: "bg-pink-400/15 text-pink-100 ring-pink-300/20",
  root: "bg-orange-500/15 text-orange-100 ring-orange-300/20",
  rot: "bg-violet-600/20 text-violet-100 ring-violet-300/20",
  spiritSeed: "bg-cyan-300/20 text-cyan-50 ring-cyan-200/30",
  fox: "bg-orange-400/25 text-orange-50 ring-orange-200/40",
  owl: "bg-sky-400/20 text-sky-50 ring-sky-200/40",
  stag: "bg-lime-400/20 text-lime-50 ring-lime-200/40",
  wisp: "bg-fuchsia-400/20 text-fuchsia-50 ring-fuchsia-200/40"
};

const symbolEmoji: Record<BoardCell["symbol"], string> = {
  leaf: "🍃",
  acorn: "🌰",
  mushroom: "🍄",
  bloom: "🌸",
  root: "🌿",
  rot: "🟣",
  spiritSeed: "💎",
  fox: "🦊",
  owl: "🦉",
  stag: "🦌",
  wisp: "✨"
};
