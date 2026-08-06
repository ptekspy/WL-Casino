import { formatCredits } from "@/lib/currency";

export function BalancePill({ balance }: Readonly<{ balance: number }>) {
  return (
    <span className="flex items-center gap-1.5 rounded-full border border-white/10 bg-black/30 px-3 py-1.5 text-sm font-black tabular-nums text-amber-100">
      <span aria-hidden="true">🪙</span>
      {formatCredits(balance)}
    </span>
  );
}
