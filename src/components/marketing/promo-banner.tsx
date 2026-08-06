import Link from "next/link";
import { BONUS_CONFIG } from "@/lib/bonus";
import { formatCredits } from "@/lib/currency";

export function PromoBanner() {
  return (
    <section className="flex flex-col items-start justify-between gap-5 rounded-[1.75rem] border border-amber-200/20 bg-[linear-gradient(135deg,rgba(217,119,6,0.14),rgba(16,185,129,0.08))] p-6 sm:flex-row sm:items-center md:p-8">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-200/70">Welcome bonus</p>
        <h2 className="mt-2 text-2xl font-black text-white sm:text-3xl">
          Deposit {formatCredits(BONUS_CONFIG.depositTrigger)}+, get {BONUS_CONFIG.spins} free spins
        </h2>
        <p className="mt-2 max-w-xl text-sm text-emerald-100/70">
          One-time, on your first deposit. Spins run at a locked {formatCredits(BONUS_CONFIG.spinStake)} stake and any
          wins land straight in your real balance.
        </p>
      </div>
      <Link
        href="/promotions"
        className="shrink-0 rounded-full border border-amber-200/30 bg-gradient-to-b from-amber-300 to-amber-500 px-6 py-3 text-sm font-black text-amber-950 transition hover:brightness-110"
      >
        See details
      </Link>
    </section>
  );
}
