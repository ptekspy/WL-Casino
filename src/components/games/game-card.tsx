import Link from "next/link";

export type GameSummary = {
  slug: string;
  name: string;
  tagline: string;
  rtp: string;
  maxWin: string;
  badge?: string;
};

export function GameCard({ game }: Readonly<{ game: GameSummary }>) {
  return (
    <Link
      href={`/games/${game.slug}`}
      className="group relative flex flex-col justify-between overflow-hidden rounded-[1.75rem] border border-emerald-100/10 bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.14),transparent_55%),rgba(255,255,255,0.035)] p-6 shadow-2xl shadow-black/40 transition hover:border-emerald-300/30"
    >
      {game.badge ? (
        <span className="absolute right-5 top-5 rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-1 text-xs font-black uppercase tracking-wide text-amber-100">
          {game.badge}
        </span>
      ) : null}

      <div>
        <h3 className="text-2xl font-black tracking-tight text-white">{game.name}</h3>
        <p className="mt-2 text-sm text-emerald-100/60">{game.tagline}</p>
      </div>

      <div className="mt-6 flex items-center gap-4 text-xs">
        <Stat label="RTP" value={game.rtp} />
        <Stat label="Max win" value={game.maxWin} />
      </div>

      <span className="mt-6 inline-flex w-fit items-center gap-1 rounded-full border border-amber-200/30 bg-gradient-to-b from-emerald-400 to-emerald-600 px-4 py-2 text-sm font-black text-emerald-950 transition group-hover:brightness-110">
        Play now
      </span>
    </Link>
  );
}

function Stat({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <span className="rounded-lg border border-white/10 bg-black/30 px-2.5 py-1.5 font-black text-amber-100">
      <span className="mr-1 text-emerald-200/50">{label}</span>
      {value}
    </span>
  );
}
