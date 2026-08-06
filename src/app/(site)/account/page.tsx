import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { formatCredits } from "@/lib/currency";
import { DepositPanel } from "@/components/account/deposit-panel";
import { SignOutButton } from "@/components/account/sign-out-button";
import { DateOfBirthForm } from "@/components/account/date-of-birth-form";
import { ageFromDateOfBirth, maxStakeForAge } from "@/lib/uk-compliance";

export const metadata: Metadata = { title: "Account" };

export default async function AccountPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const { user } = session;
  const balance = user.balance ?? 0;
  const bonusSpinsRemaining = user.bonusSpinsRemaining ?? 0;
  const bonusSpinStake = user.bonusSpinStake ?? 0;
  const hasDeposited = user.hasDeposited ?? false;
  const dateOfBirth = user.dateOfBirth as string | null | undefined;
  const maxStake = dateOfBirth ? maxStakeForAge(ageFromDateOfBirth(dateOfBirth)) : 0;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-10 sm:px-6 lg:px-8">
      <div>
        <h1 className="text-3xl font-black tracking-tight text-white">Account</h1>
        <p className="mt-1 text-sm text-emerald-100/60">{user.email}</p>
      </div>

      {!dateOfBirth ? <DateOfBirthForm /> : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryTile label="Balance" value={`🪙 ${formatCredits(balance)}`} />
        <SummaryTile label="Bonus spins left" value={`${bonusSpinsRemaining}`} />
        <SummaryTile label="Bonus stake" value={bonusSpinsRemaining > 0 ? `${formatCredits(bonusSpinStake)} / spin` : "—"} />
      </div>

      {dateOfBirth ? (
        <p className="-mt-2 text-xs text-emerald-100/45">
          Stake limit: {formatCredits(maxStake)} per spin, based on your age (UK online slots rule).
        </p>
      ) : null}

      <DepositPanel hasDeposited={hasDeposited} />

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-5">
        <Link
          href="/games/wildwood"
          className="rounded-full border border-amber-200/30 bg-gradient-to-b from-emerald-400 to-emerald-600 px-5 py-2.5 text-sm font-black text-emerald-950 transition hover:brightness-110"
        >
          Play Wildwood
        </Link>
        <SignOutButton />
      </div>
    </div>
  );
}

function SummaryTile({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-200/50">{label}</p>
      <p className="mt-2 text-2xl font-black tabular-nums text-white">{value}</p>
    </div>
  );
}
