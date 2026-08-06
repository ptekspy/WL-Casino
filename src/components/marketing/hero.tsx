import Link from "next/link";
import { SITE_NAME } from "@/lib/site-config";

export function Hero() {
  return (
    <section className="relative isolate min-h-[440px] overflow-hidden rounded-[2rem] border border-emerald-400/20 bg-[#04140c] shadow-2xl shadow-emerald-950/50 sm:min-h-[480px] lg:min-h-[540px]">
      {/* Atmosphere — same layering idea as the in-game scene: canopy glow, spotlight, treeline, drifting mist. */}
      {/* eslint-disable @next/next/no-img-element */}
      <img
        src="/assets/wildwood/bg-canopy-light.svg"
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-70 mix-blend-screen"
      />
      <img
        src="/assets/wildwood/spotlight.svg"
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute -right-16 top-1/2 h-[150%] w-[75%] -translate-y-1/2 object-contain opacity-90 mix-blend-screen sm:right-0"
      />
      <img
        src="/assets/wildwood/bg-treeline-far.svg"
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 w-full object-cover opacity-90"
      />
      <img
        src="/assets/wildwood/bg-mist.svg"
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 w-[140%] animate-[drift-slow_16s_ease-in-out_infinite_alternate] object-cover opacity-40"
      />

      {/* Fox mascot, floating just off the right edge */}
      <img
        src="/assets/wildwood/symbols/fox.png"
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute -right-4 bottom-0 w-52 animate-[float-slow_7s_ease-in-out_infinite] drop-shadow-[0_25px_45px_rgba(0,0,0,0.65)] sm:w-64 md:right-6 md:w-80 lg:right-10 lg:w-96"
      />
      {/* eslint-enable @next/next/no-img-element */}

      {/* Scrim so copy stays legible over the art on every viewport */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#04140c] via-[#04140c]/85 to-transparent sm:via-[#04140c]/75" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#04140c] via-transparent to-transparent" />

      <div className="relative flex min-h-[440px] flex-col justify-center px-6 py-12 sm:min-h-[480px] sm:px-10 md:px-14 lg:min-h-[540px]">
        <div className="max-w-xl">
          <p className="mb-4 inline-flex rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-1 text-sm font-medium text-amber-100">
            Fake-money prototype · no real currency involved
          </p>
          <h1 className="text-5xl font-black leading-[0.95] tracking-tight text-white sm:text-6xl lg:text-7xl">{SITE_NAME}</h1>
          <p className="mt-5 max-w-lg text-lg leading-8 text-emerald-100/85">
            Every round is resolved server-side and handed back as full replay data — no black-box outcomes. Sign
            up, claim a welcome bonus, and spin Wildwood with a real (still fake) balance.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/games"
              className="rounded-full border border-amber-200/30 bg-gradient-to-b from-emerald-400 to-emerald-600 px-7 py-3.5 text-base font-black text-emerald-950 shadow-[0_10px_28px_-6px_rgba(16,185,129,0.7)] transition hover:scale-[1.02] hover:brightness-110"
            >
              Browse games
            </Link>
            <Link
              href="/signup"
              className="rounded-full border border-white/15 bg-white/5 px-7 py-3.5 text-base font-black text-white backdrop-blur transition hover:bg-white/10"
            >
              Create free account
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
