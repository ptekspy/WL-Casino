import type { Metadata } from "next";
import { DragonforgeGame } from "@/components/dragonforge-game";
import { GameShellBar } from "@/components/games/game-shell-bar";

export const metadata: Metadata = { title: "Dragonforge" };

export default function DragonforgePage() {
  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <GameShellBar gameName="Dragonforge" />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <DragonforgeGame />
      </div>
    </div>
  );
}
