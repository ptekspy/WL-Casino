import { WILDWOOD_CONFIG } from "@/lib/wildwood";
import type { GameSummary } from "@/components/games/game-card";

/** Game catalog. Add an entry here (and a route under src/app/games/<slug>) to list a new game in the lobby. */
export const GAMES: readonly GameSummary[] = [
  {
    slug: "wildwood",
    name: "Wildwood",
    tagline: "Fresh 6×6 cascades with a hold-and-win Spirit Seed bonus.",
    rtp: `${(WILDWOOD_CONFIG.targetRtp * 100).toFixed(0)}%`,
    maxWin: `${WILDWOOD_CONFIG.maxWin}x`,
    badge: "Featured"
  }
];

export function getGame(slug: string): GameSummary | undefined {
  return GAMES.find((game) => game.slug === slug);
}
