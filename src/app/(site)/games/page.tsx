import type { Metadata } from "next";
import { GAMES } from "@/lib/games";
import { GameCard } from "@/components/games/game-card";

export const metadata: Metadata = { title: "Games" };

export default function GamesPage() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-10 sm:px-6 lg:px-8">
      <div>
        <h1 className="text-4xl font-black tracking-tight text-white">Games</h1>
        <p className="mt-2 max-w-2xl text-emerald-100/70">
          Every round is resolved server-side and returned as replay data — nothing here is client-guessed.
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {GAMES.map((game) => (
          <GameCard key={game.slug} game={game} />
        ))}
      </div>
    </div>
  );
}
