import { WILDWOOD_CONFIG } from "@/lib/wildwood";
import { DRAGONFORGE_CONFIG } from "@/lib/dragonforge";
import { AETHERFALL_CONFIG } from "@/lib/aetherfall";
import type { GameSummary } from "@/components/games/game-card";

/** Game catalog. Add an entry here (and a route under src/app/games/<slug>) to list a new game in the lobby. */
export const GAMES: readonly GameSummary[] = [
  {
    slug: "wildwood",
    name: "Wildwood",
    tagline: "Fresh 6×6 cascades with a hold-and-win Spirit Seed bonus.",
    rtp: `${(WILDWOOD_CONFIG.targetRtp * 100).toFixed(0)}%`,
    maxWin: `${WILDWOOD_CONFIG.maxWin}x`,
    badge: "Featured",
    art: "/assets/wildwood/symbols/fox.png"
  },
  {
    slug: "dragonforge",
    name: "Dragonforge",
    tagline: "Push-your-luck cascades — delve the Dragon's Hoard and secure treasure before it wakes.",
    rtp: `${(DRAGONFORGE_CONFIG.targetRtp * 100).toFixed(0)}%`,
    maxWin: `${DRAGONFORGE_CONFIG.maxWin}x`,
    badge: "New",
    art: "/assets/dragonforge/symbols/scout.png"
  },
  {
    slug: "aetherfall",
    name: "Aetherfall",
    tagline: "JRPG-style party battles with three volatility profiles sharing the same 95% RTP.",
    rtp: `${(AETHERFALL_CONFIG.targetRtp * 100).toFixed(0)}%`,
    maxWin: `${AETHERFALL_CONFIG.maxWin}x`,
    badge: "Prototype",
    art: "/assets/aetherfall/crystal.svg"
  }
];

export function getGame(slug: string): GameSummary | undefined {
  return GAMES.find((game) => game.slug === slug);
}
