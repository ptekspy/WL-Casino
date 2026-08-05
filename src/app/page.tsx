import { WildwoodGame } from "@/components/wildwood-game";
import { WILDWOOD_CONFIG } from "@/lib/wildwood";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-8 px-4 py-6 sm:px-6 lg:px-8">
      <header className="rounded-[2rem] border border-emerald-400/20 bg-emerald-950/30 p-6 shadow-2xl shadow-emerald-950/40 backdrop-blur md:p-8">
        <p className="mb-3 inline-flex rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-1 text-sm font-medium text-amber-100">
          Fake-money prototype · Wildwood V1
        </p>
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <h1 className="text-4xl font-black tracking-tight text-white sm:text-6xl">Wildwood</h1>
            <p className="mt-4 text-lg leading-8 text-emerald-100/80">
              Fresh 6×6 board every play. Collect {WILDWOOD_CONFIG.bonusTriggerSeeds} Spirit Seeds to enter the hold-and-win
              Wildwood bonus, where collectors are held and the multiplier climbs. The result is resolved server-side and
              returned as replay data.
            </p>
          </div>
          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4 lg:min-w-[32rem]">
            <Stat label="RTP target" value={`${(WILDWOOD_CONFIG.targetRtp * 100).toFixed(0)}%`} />
            <Stat label="Max win" value={`${WILDWOOD_CONFIG.maxWin}x`} />
            <Stat label="Bonus" value={`${WILDWOOD_CONFIG.bonusTriggerSeeds} seeds`} />
            <Stat label="Mode" value="Demo" />
          </dl>
        </div>
      </header>

      <WildwoodGame />
    </main>
  );
}

function Stat({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <dt className="text-xs uppercase tracking-[0.2em] text-emerald-200/60">{label}</dt>
      <dd className="mt-2 text-2xl font-black text-white">{value}</dd>
    </div>
  );
}
