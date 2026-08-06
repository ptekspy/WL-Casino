import Link from "next/link";
import { BONUS_CONFIG } from "@/lib/bonus";
import { formatCredits } from "@/lib/currency";

export function PromoBanner() {
  return (
    <section className="relative flex flex-col items-start justify-between gap-6 overflow-hidden rounded-[1.75rem] border border-amber-200/25 bg-[linear-gradient(135deg,rgba(217,119,6,0.18),rgba(16,185,129,0.08))] p-6 sm:flex-row sm:items-center md:p-8">
      <div
        className="pointer-events-none absolute -right-12 -top-12 h-64 w-64 rounded-full opacity-50 blur-3xl"
        style={{ background: "radial-gradient(circle, rgba(245,197,66,0.55), transparent 70%)" }}
        aria-hidden="true"
      />

      <div className="relative flex items-center gap-5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/assets/wildwood/symbols/spirit-seed.png"
          alt=""
          aria-hidden="true"
          className="hidden h-20 w-20 shrink-0 drop-shadow-[0_10px_24px_rgba(245,197,66,0.4)] sm:block"
        />
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-200/70">Welcome bonus</p>
          <h2 className="mt-2 text-2xl font-black text-white sm:text-3xl">
            Deposit {formatCredits(BONUS_CONFIG.depositTrigger)}+, get {BONUS_CONFIG.spins} free spins
          </h2>
          <p className="mt-2 max-w-xl text-sm text-emerald-100/70">
            One-time, on your first deposit. Spins run at a locked {formatCredits(BONUS_CONFIG.spinStake)} stake and
            any wins land straight in your real balance.
          </p>
        </div>
      </div>

      <Link
        href="/promotions"
        className="relative shrink-0 rounded-full border border-amber-200/30 bg-gradient-to-b from-amber-300 to-amber-500 px-6 py-3 text-sm font-black text-amber-950 transition hover:scale-[1.03] hover:brightness-110"
      >
        See details
      </Link>
    </section>
  );
}
