"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { UserMenu } from "@/components/site/user-menu";
import { AuthButtons } from "@/components/site/auth-buttons";

export function GameShellBar({ gameName }: Readonly<{ gameName: string }>) {
  const { data: session, isPending } = authClient.useSession();
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", handleChange);
    return () => document.removeEventListener("fullscreenchange", handleChange);
  }, []);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void document.documentElement.requestFullscreen().catch(() => {});
    }
  };

  return (
    <header className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 bg-neutral-950/95 px-3 py-2 backdrop-blur">
      <div className="flex min-w-0 items-center gap-3">
        <Link
          href="/games"
          aria-label="Back to lobby"
          className="flex shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm font-bold text-emerald-100/70 transition hover:bg-white/10 hover:text-white"
        >
          <span aria-hidden="true">←</span>
          <span className="hidden sm:inline">Lobby</span>
        </Link>
        <span className="truncate text-sm font-black tracking-tight text-white sm:text-base">{gameName}</span>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={toggleFullscreen}
          aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
          className="rounded-full border border-white/10 bg-white/5 p-2.5 text-emerald-100/70 transition hover:bg-white/10 hover:text-white"
        >
          <span aria-hidden="true">{isFullscreen ? "⤡" : "⤢"}</span>
        </button>
        {isPending ? (
          <div className="h-9 w-24 animate-pulse rounded-full bg-white/5" />
        ) : session ? (
          <UserMenu name={session.user.name} email={session.user.email} balance={session.user.balance ?? 0} />
        ) : (
          <AuthButtons />
        )}
      </div>
    </header>
  );
}
