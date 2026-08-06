import { WILDWOOD_CONFIG, type CollectorType } from "@/lib/wildwood";

/** Highest payout multiplier first — same priority order the engine itself uses on a contested claim. */
const COLLECTOR_ORDER: readonly CollectorType[] = ["wisp", "owl", "stag", "fox"];

const COLLECTOR_COLOR: Record<CollectorType, string> = {
  fox: "#f97316",
  owl: "#38bdf8",
  stag: "#84cc16",
  wisp: "#e879f9"
};

const PLURAL_OVERRIDES: Partial<Record<string, string>> = { leaf: "leaves", spiritSeed: "Spirit Seeds" };

function formatTargets(symbols: readonly string[]): string {
  const labels = symbols.map((symbol) => PLURAL_OVERRIDES[symbol] ?? `${symbol}s`);
  if (labels.length === 1) return labels[0];
  return `${labels.slice(0, -1).join(", ")} & ${labels[labels.length - 1]}`;
}

export function CollectorShowcase() {
  return (
    <section>
      <div className="mb-5">
        <h2 className="text-2xl font-black tracking-tight text-white">Meet the forest</h2>
        <p className="mt-1 max-w-2xl text-sm text-emerald-100/60">
          Four collectors roam the board. When two can reach the same target, the higher multiplier gets it —
          wisp beats owl beats stag beats fox.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {COLLECTOR_ORDER.map((collector) => (
          <div
            key={collector}
            className="group relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-white/[0.03] p-5 text-center shadow-xl shadow-black/20 transition hover:border-white/20 hover:bg-white/[0.05]"
          >
            <div
              className="pointer-events-none absolute inset-0 opacity-25 transition group-hover:opacity-40"
              style={{ background: `radial-gradient(circle at 50% 15%, ${COLLECTOR_COLOR[collector]}, transparent 60%)` }}
              aria-hidden="true"
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/assets/wildwood/symbols/${collector}.png`}
              alt={collector}
              className="relative mx-auto h-24 w-24 drop-shadow-[0_12px_22px_rgba(0,0,0,0.55)] transition duration-300 group-hover:scale-110"
            />
            <p className="relative mt-3 text-lg font-black capitalize text-white">{collector}</p>
            <p className="relative mt-1 text-xs font-black uppercase tracking-wide" style={{ color: COLLECTOR_COLOR[collector] }}>
              {WILDWOOD_CONFIG.collectorMultipliers[collector]}x collector
            </p>
            <p className="relative mt-2 text-xs leading-5 text-emerald-100/55">
              Hunts {formatTargets(WILDWOOD_CONFIG.collectorTargets[collector])}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
