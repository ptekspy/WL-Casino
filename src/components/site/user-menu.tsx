"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { UserAvatar } from "@/components/site/user-avatar";
import { BalancePill } from "@/components/site/balance-pill";

export function UserMenu({
  name,
  email,
  balance
}: Readonly<{ name: string; email: string; balance: number }>) {
  const router = useRouter();

  const handleSignOut = async () => {
    await authClient.signOut();
    router.push("/");
    router.refresh();
  };

  return (
    <details className="group relative">
      <summary className="flex list-none items-center gap-2 rounded-full border border-white/10 bg-white/5 py-1 pr-2 pl-1 [&::-webkit-details-marker]:hidden">
        <UserAvatar label={name || email} size={30} />
        <BalancePill balance={balance} />
      </summary>
      <div className="absolute right-0 z-20 mt-2 w-52 overflow-hidden rounded-2xl border border-white/10 bg-neutral-900 shadow-2xl shadow-black/60">
        <div className="border-b border-white/10 px-4 py-3">
          <p className="truncate text-sm font-bold text-white">{name || "Player"}</p>
          <p className="truncate text-xs text-emerald-100/50">{email}</p>
        </div>
        <Link href="/account" className="block px-4 py-2.5 text-sm font-semibold text-emerald-100/80 transition hover:bg-white/5 hover:text-white">
          Account
        </Link>
        <button
          type="button"
          onClick={handleSignOut}
          className="block w-full px-4 py-2.5 text-left text-sm font-semibold text-emerald-100/80 transition hover:bg-white/5 hover:text-white"
        >
          Sign out
        </button>
      </div>
    </details>
  );
}
