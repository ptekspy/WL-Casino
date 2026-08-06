import Link from "next/link";
import { SITE_NAME } from "@/lib/site-config";

export function Hero() {
  return (
    <section className="relative overflow-hidden rounded-[2rem] border border-emerald-400/20 bg-emerald-950/30 p-8 shadow-2xl shadow-emerald-950/40 backdrop-blur md:p-14">
      <div
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{ background: "radial-gradient(circle at 15% 20%, rgba(16,185,129,0.25), transparent 45%)" }}
        aria-hidden="true"
      />
      <div className="relative max-w-3xl">
        <p className="mb-4 inline-flex rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-1 text-sm font-medium text-amber-100">
          Fake-money prototype · no real currency involved
        </p>
        <h1 className="text-4xl font-black leading-tight tracking-tight text-white sm:text-6xl">{SITE_NAME}</h1>
        <p className="mt-5 max-w-2xl text-lg leading-8 text-emerald-100/80">
          Every round is resolved server-side and handed back as full replay data — no black-box outcomes. Sign up,
          claim a welcome bonus, and spin Wildwood with a real (still fake) balance.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/games"
            className="rounded-full border border-amber-200/30 bg-gradient-to-b from-emerald-400 to-emerald-600 px-6 py-3 text-sm font-black text-emerald-950 shadow-[0_8px_20px_-8px_rgba(16,185,129,0.6)] transition hover:brightness-110"
          >
            Browse games
          </Link>
          <Link
            href="/signup"
            className="rounded-full border border-white/15 bg-white/5 px-6 py-3 text-sm font-black text-white transition hover:bg-white/10"
          >
            Create free account
          </Link>
        </div>
      </div>
    </section>
  );
}
