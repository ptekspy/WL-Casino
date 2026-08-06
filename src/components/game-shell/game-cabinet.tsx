import Link from "next/link";
import type { ReactNode } from "react";
import { formatCredits } from "@/lib/currency";

/**
 * The generic slot-cabinet chrome shared by every game: board frame sized to
 * fit the viewport, gate banners (sign-up / DOB / bonus-spin), the
 * Balance-then-Win stack, Play button, and Stake selector. Extracted out of
 * wildwood-game.tsx. A game's own board component and any info/replay panel
 * stay outside this — those differ per game and are rendered by the caller
 * around <GameCabinet>.
 */
export type GameCabinetProps = {
  gameName: string;
  boardAspect: string | number;
  boardDesignWidth: number;
  boardDesignHeight: number;
  /**
   * Everything around the board (shell bar, cabinet paddings) that eats into
   * viewport height. Tuned against the live layout — re-check after touching
   * the shell bar or cabinet. Defaults to Wildwood's measured budget.
   */
  heightBudgetPx?: number;
  board: ReactNode;
  cornerBadges?: ReactNode;

  sessionPending: boolean;
  isLoggedIn: boolean;
  needsDateOfBirth: boolean;
  bonusSpinsRemaining: number;
  bonusSpinStake: number;

  balanceLabel: string;
  winLabel: string;

  onPlay: () => void;
  playDisabled: boolean;
  playBusy: boolean;

  stakeOptions: readonly number[];
  stakeValue: number;
  onStakeChange: (value: number) => void;
  stakeDisabled: boolean;

  errorMessage?: string | null;
};

export function GameCabinet({
  gameName,
  boardAspect,
  boardDesignWidth,
  boardDesignHeight,
  heightBudgetPx = 150,
  board,
  cornerBadges,
  sessionPending,
  isLoggedIn,
  needsDateOfBirth,
  bonusSpinsRemaining,
  bonusSpinStake,
  balanceLabel,
  winLabel,
  onPlay,
  playDisabled,
  playBusy,
  stakeOptions,
  stakeValue,
  onStakeChange,
  stakeDisabled,
  errorMessage
}: Readonly<GameCabinetProps>) {
  return (
    <section className="rounded-[2rem] border border-emerald-100/10 bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.08),transparent_42%),rgba(255,255,255,0.035)] p-3 shadow-2xl shadow-black/40 sm:p-5">
      <div
        className="relative mx-auto w-full overflow-hidden rounded-[1.75rem] border border-amber-300/15 bg-black/40 shadow-[0_0_0_1px_rgba(245,197,66,0.06),0_25px_60px_-15px_rgba(0,0,0,0.8)]"
        style={{
          aspectRatio: boardAspect,
          maxWidth: `min(42rem, calc((100dvh - ${heightBudgetPx}px) * ${boardDesignWidth} / ${boardDesignHeight}))`
        }}
      >
        {board}
        {cornerBadges ? <div className="absolute right-3 top-3 z-10 flex gap-2">{cornerBadges}</div> : null}
      </div>

      <div className="mx-auto mt-3 w-full max-w-2xl rounded-[1.75rem] border border-amber-200/15 bg-[linear-gradient(180deg,rgba(52,33,15,0.94),rgba(7,17,12,0.98))] p-3 shadow-[inset_0_1px_0_rgba(255,245,200,0.12),0_16px_30px_-18px_rgba(0,0,0,0.9)]">
        {!sessionPending && !isLoggedIn ? (
          <div className="mb-3 flex flex-col items-center gap-2 rounded-xl border border-emerald-200/30 bg-emerald-300/10 px-3 py-3 text-center">
            <p className="text-sm font-black text-white">Sign up to play {gameName}</p>
            <p className="text-xs text-emerald-100/60">Free account, demo balance, a welcome bonus on your first deposit.</p>
            <div className="mt-1 flex gap-2">
              <Link
                href="/signup"
                className="rounded-full border border-amber-200/30 bg-gradient-to-b from-emerald-400 to-emerald-600 px-4 py-2 text-xs font-black text-emerald-950 transition hover:brightness-110"
              >
                Sign up
              </Link>
              <Link
                href="/login"
                className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-black text-white transition hover:bg-white/10"
              >
                Log in
              </Link>
            </div>
          </div>
        ) : needsDateOfBirth ? (
          <div className="mb-3 flex flex-col items-center gap-2 rounded-xl border border-amber-200/30 bg-amber-300/10 px-3 py-3 text-center">
            <p className="text-sm font-black text-white">Add your date of birth to play</p>
            <p className="text-xs text-emerald-100/60">
              UK rules cap stakes by age — 18-24 is {formatCredits(2)}, 25+ is {formatCredits(5)}. We only need this once.
            </p>
            <Link
              href="/account"
              className="mt-1 rounded-full border border-amber-200/30 bg-gradient-to-b from-emerald-400 to-emerald-600 px-4 py-2 text-xs font-black text-emerald-950 transition hover:brightness-110"
            >
              Go to account
            </Link>
          </div>
        ) : bonusSpinsRemaining > 0 ? (
          <div className="mb-3 flex items-center justify-center gap-2 rounded-xl border border-amber-200/30 bg-amber-300/10 px-3 py-2 text-xs font-black uppercase tracking-wide text-amber-100">
            <span aria-hidden="true">🎁</span>
            Bonus spins: {bonusSpinsRemaining} left @ {formatCredits(bonusSpinStake)}
          </div>
        ) : null}

        <div className="grid grid-cols-3 items-center gap-2 sm:gap-3">
          <div className="flex flex-col gap-2">
            <CabinetMetric label="Balance" value={balanceLabel} />
            <CabinetMetric label="Win" value={winLabel} compact />
          </div>

          <button
            type="button"
            onClick={onPlay}
            disabled={playDisabled}
            aria-label={`Play ${gameName}`}
            className="group relative mx-auto flex h-20 w-20 items-center justify-center rounded-full border-4 border-amber-100/60 bg-[radial-gradient(circle_at_35%_25%,#d1fae5_0%,#6ee7b7_22%,#10b981_52%,#065f46_78%,#032d22_100%)] text-3xl text-emerald-950 shadow-[inset_0_3px_6px_rgba(255,255,255,0.65),inset_0_-8px_15px_rgba(0,0,0,0.45),0_0_0_5px_rgba(28,18,6,0.9),0_10px_24px_rgba(16,185,129,0.32)] transition hover:brightness-110 active:translate-y-0.5 disabled:cursor-not-allowed disabled:grayscale disabled:opacity-45"
          >
            <span className="absolute inset-2 rounded-full border border-white/35" aria-hidden="true" />
            <span className="relative translate-x-0.5">{playBusy ? "✦" : "▶"}</span>
          </button>

          <label className="rounded-xl border border-white/10 bg-black/30 px-3 py-2">
            <span className="block text-[10px] font-black uppercase tracking-[0.16em] text-emerald-200/45">Stake</span>
            <select
              value={stakeValue}
              onChange={(event) => onStakeChange(Number(event.target.value))}
              disabled={stakeDisabled}
              className="mt-0.5 w-full bg-transparent text-base font-black tabular-nums text-amber-100 outline-none disabled:opacity-50"
            >
              {stakeOptions.map((option) => (
                <option key={option} value={option} className="bg-neutral-950">
                  {option.toFixed(2)}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {errorMessage ? <p className="mx-auto mt-3 max-w-2xl text-sm font-bold text-red-300">{errorMessage}</p> : null}
    </section>
  );
}

export function BoardIconButton({
  icon,
  label,
  active,
  onClick
}: Readonly<{ icon: string; label: string; active: boolean; onClick: () => void }>) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      className={`flex h-9 w-9 items-center justify-center rounded-full border text-sm font-black backdrop-blur transition ${
        active
          ? "border-emerald-200/40 bg-emerald-300/15 text-emerald-100"
          : "border-white/15 bg-black/40 text-white/70 hover:bg-black/60 hover:text-white"
      }`}
    >
      <span aria-hidden="true">{icon}</span>
    </button>
  );
}

function CabinetMetric({ label, value, compact = false }: Readonly<{ label: string; value: string; compact?: boolean }>) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2">
      <span className="block text-[10px] font-black uppercase tracking-[0.16em] text-emerald-200/45">{label}</span>
      <span className={`block truncate font-black tabular-nums text-amber-100 ${compact ? "text-sm" : "text-base"}`}>{value}</span>
    </div>
  );
}
