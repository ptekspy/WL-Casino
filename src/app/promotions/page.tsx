import type { Metadata } from "next";
import Link from "next/link";
import { BONUS_CONFIG, expectedBonusPayout } from "@/lib/bonus";
import { formatCredits } from "@/lib/currency";

export const metadata: Metadata = { title: "Promotions" };

export default function PromotionsPage() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-10 sm:px-6 lg:px-8">
      <div>
        <p className="mb-3 inline-flex rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-1 text-sm font-medium text-amber-100">
          Welcome bonus
        </p>
        <h1 className="text-4xl font-black tracking-tight text-white">
          Deposit {formatCredits(BONUS_CONFIG.depositTrigger)}+, get {BONUS_CONFIG.spins} free spins
        </h1>
        <p className="mt-4 max-w-2xl text-lg leading-8 text-emerald-100/80">
          One-time, on your first ever deposit. Sign up, add {formatCredits(BONUS_CONFIG.depositTrigger)}+ demo
          credits from your account page, and {BONUS_CONFIG.spins} bonus spins land instantly — no code needed.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Tile label="Bonus spins" value={`${BONUS_CONFIG.spins}`} />
        <Tile label="Locked stake" value={formatCredits(BONUS_CONFIG.spinStake)} />
        <Tile label="Minimum deposit" value={formatCredits(BONUS_CONFIG.depositTrigger)} />
      </div>

      <section className="rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-6">
        <h2 className="text-lg font-black text-white">How it works</h2>
        <ol className="mt-4 space-y-3 text-sm leading-6 text-emerald-100/70">
          <li>1. Create an account — starting balance is 0.00, no strings attached.</li>
          <li>2. Make your first demo deposit of {formatCredits(BONUS_CONFIG.depositTrigger)} credits or more.</li>
          <li>
            3. {BONUS_CONFIG.spins} spins are queued at a locked {formatCredits(BONUS_CONFIG.spinStake)} stake — they
            cost you nothing, but wins pay into your real balance.
          </li>
          <li>4. Once the bonus spins run out, normal staking resumes automatically.</li>
        </ol>
      </section>

      <section className="rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-6">
        <h2 className="text-lg font-black text-white">The math behind it</h2>
        <p className="mt-3 text-sm leading-6 text-emerald-100/70">
          Sized against a validated 50-million-round Wildwood simulation (measured RTP ≈ {(BONUS_CONFIG.measuredRtp * 100).toFixed(2)}%):
        </p>
        <div className="mt-4 rounded-xl border border-white/10 bg-black/30 p-4 font-mono text-sm text-emerald-100/80">
          {BONUS_CONFIG.spins} spins × {formatCredits(BONUS_CONFIG.spinStake)} × {(BONUS_CONFIG.measuredRtp * 100).toFixed(2)}% RTP
          ≈ {formatCredits(expectedBonusPayout())} expected credits back
        </div>
        <p className="mt-4 text-sm leading-6 text-emerald-100/70">
          That expected payout is well under the {formatCredits(BONUS_CONFIG.depositTrigger)}-credit deposit that
          unlocks it, and any single spin is capped at 1000x stake — so the offer stays sustainable no matter how
          many players claim it.
        </p>
      </section>

      <Link
        href="/signup"
        className="w-fit rounded-full border border-amber-200/30 bg-gradient-to-b from-emerald-400 to-emerald-600 px-6 py-3 text-sm font-black text-emerald-950 transition hover:brightness-110"
      >
        Claim your bonus
      </Link>
    </div>
  );
}

function Tile({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-200/50">{label}</p>
      <p className="mt-2 text-2xl font-black tabular-nums text-white">{value}</p>
    </div>
  );
}
