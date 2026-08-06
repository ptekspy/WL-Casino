import type { Metadata } from "next";
import { WildwoodGame } from "@/components/wildwood-game";
import { GameShellBar } from "@/components/games/game-shell-bar";

export const metadata: Metadata = { title: "Wildwood" };

export default function WildwoodPage() {
  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <GameShellBar gameName="Wildwood" />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <WildwoodGame />
      </div>
    </div>
  );
}
