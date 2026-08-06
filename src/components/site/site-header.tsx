"use client";

import Link from "next/link";
import { NAV_LINKS, SITE_NAME } from "@/lib/site-config";
import { authClient } from "@/lib/auth-client";
import { AuthButtons } from "@/components/site/auth-buttons";
import { UserMenu } from "@/components/site/user-menu";

export function SiteHeader() {
  const { data: session, isPending } = authClient.useSession();

  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-neutral-950/85 backdrop-blur">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2 text-lg font-black tracking-tight text-white">
          <span aria-hidden="true">🌲</span>
          {SITE_NAME}
        </Link>

        <nav className="hidden items-center gap-6 text-sm font-bold text-emerald-100/70 sm:flex">
          {NAV_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="transition hover:text-white">
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center">
          {isPending ? (
            <div className="h-9 w-24 animate-pulse rounded-full bg-white/5" />
          ) : session ? (
            <UserMenu name={session.user.name} email={session.user.email} balance={session.user.balance ?? 0} />
          ) : (
            <AuthButtons />
          )}
        </div>
      </div>
    </header>
  );
}
