import { Hero } from "@/components/marketing/hero";
import { FeatureGrid } from "@/components/marketing/feature-grid";
import { PromoBanner } from "@/components/marketing/promo-banner";
import { CollectorShowcase } from "@/components/marketing/collector-showcase";
import { GameCard } from "@/components/games/game-card";
import { GAMES } from "@/lib/games";

export default function Home() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-10 px-4 py-6 sm:px-6 lg:px-8">
      <Hero />
      <FeatureGrid />
      <CollectorShowcase />

      <section>
        <div className="mb-5 flex items-baseline justify-between">
          <h2 className="text-2xl font-black tracking-tight text-white">Featured game</h2>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {GAMES.map((game) => (
            <GameCard key={game.slug} game={game} />
          ))}
        </div>
      </section>

      <PromoBanner />
    </div>
  );
}
