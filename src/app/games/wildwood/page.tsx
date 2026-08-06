import type { Metadata } from "next";
import { WildwoodGame } from "@/components/wildwood-game";
import { WILDWOOD_CONFIG } from "@/lib/wildwood";

export const metadata: Metadata = { title: "Wildwood" };

export default function WildwoodPage() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:px-8">
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-400/20 bg-emerald-950/30 px-4 py-3 backdrop-blur">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-amber-300/30 bg-amber-300/10 px-2.5 py-1 text-xs font-medium text-amber-100">Demo</span>
          <p className="text-sm font-bold text-emerald-100/70">
            Fresh 6×6 board · {WILDWOOD_CONFIG.bonusTriggerSeeds}-seed hold-and-win bonus · resolved server-side
          </p>
        </div>
        <div className="flex gap-2 text-xs font-black">
          <Stat label="RTP" value={`${(WILDWOOD_CONFIG.targetRtp * 100).toFixed(0)}%`} />
          <Stat label="Max win" value={`${WILDWOOD_CONFIG.maxWin}x`} />
        </div>
      </header>

      <WildwoodGame />
    </div>
  );
}

function Stat({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <span className="rounded-lg border border-white/10 bg-black/30 px-2.5 py-1.5 text-amber-100">
      <span className="mr-1 text-emerald-200/50">{label}</span>
      {value}
    </span>
  );
}
