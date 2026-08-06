const FEATURES = [
  {
    title: "Server-resolved rounds",
    body: "Every spin is computed on the server and delivered as a signed replay — the client only animates what already happened."
  },
  {
    title: "Full replay transparency",
    body: "Scrub back through any round: cascade-by-cascade breakdown, collector routes, and the exact symbol paytable."
  },
  {
    title: "Math you can check",
    body: "RTP is validated with a 50-million-round simulation, not a guess — see the numbers on the Promotions page."
  }
] as const;

export function FeatureGrid() {
  return (
    <section className="grid gap-5 sm:grid-cols-3">
      {FEATURES.map((feature) => (
        <div
          key={feature.title}
          className="group relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-6 shadow-xl shadow-black/20 transition hover:border-white/20"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/assets/wildwood/symbols/spirit-seed.png"
            alt=""
            aria-hidden="true"
            className="pointer-events-none absolute -right-5 -top-5 h-24 w-24 opacity-15 transition group-hover:opacity-25"
          />
          <h3 className="relative text-lg font-black text-white">{feature.title}</h3>
          <p className="relative mt-2 text-sm leading-6 text-emerald-100/60">{feature.body}</p>
        </div>
      ))}
    </section>
  );
}
