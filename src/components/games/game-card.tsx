import Link from "next/link";

export type GameSummary = {
  slug: string;
  name: string;
  tagline: string;
  rtp: string;
  maxWin: string;
  badge?: string;
  /** Portrait art used as the card thumbnail — one of the collector/symbol assets. */
  art: string;
};

export function GameCard({ game }: Readonly<{ game: GameSummary }>) {
  return (
    <Link
      href={`/games/${game.slug}`}
      className="group relative flex aspect-[3/4] flex-col justify-end overflow-hidden rounded-[1.75rem] border border-emerald-100/10 shadow-2xl shadow-black/40 transition hover:border-emerald-300/30"
    >
      <div className="absolute inset-0 bg-[#04140c]" aria-hidden="true" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/assets/wildwood/tile-wood.svg"
        alt=""
        aria-hidden="true"
        className="absolute inset-0 h-full w-full object-cover opacity-25"
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-70 transition group-hover:opacity-90"
        style={{ background: "radial-gradient(circle at 50% 28%, rgba(16,185,129,0.4), transparent 60%)" }}
        aria-hidden="true"
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={game.art}
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-8 h-40 w-40 -translate-x-1/2 drop-shadow-[0_18px_32px_rgba(0,0,0,0.65)] transition duration-300 group-hover:scale-110 sm:h-44 sm:w-44"
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#04140c] via-[#04140c]/75 to-transparent" aria-hidden="true" />

      {game.badge ? (
        <span className="absolute right-4 top-4 rounded-full border border-amber-300/30 bg-amber-300/15 px-3 py-1 text-xs font-black uppercase tracking-wide text-amber-100 backdrop-blur">
          {game.badge}
        </span>
      ) : null}

      <div className="relative p-5">
        <h3 className="text-2xl font-black tracking-tight text-white">{game.name}</h3>
        <p className="mt-1 text-sm text-emerald-100/70">{game.tagline}</p>

        <div className="mt-4 flex items-center gap-3 text-xs">
          <Stat label="RTP" value={game.rtp} />
          <Stat label="Max win" value={game.maxWin} />
        </div>

        <span className="mt-4 inline-flex w-fit items-center gap-1 rounded-full border border-amber-200/30 bg-gradient-to-b from-emerald-400 to-emerald-600 px-4 py-2 text-sm font-black text-emerald-950 transition group-hover:brightness-110">
          Play now
        </span>
      </div>
    </Link>
  );
}

function Stat({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <span className="rounded-lg border border-white/10 bg-black/40 px-2.5 py-1.5 font-black text-amber-100 backdrop-blur">
      <span className="mr-1 text-emerald-200/50">{label}</span>
      {value}
    </span>
  );
}
