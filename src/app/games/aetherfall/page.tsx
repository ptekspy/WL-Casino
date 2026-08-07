import type { Metadata } from "next";
import { AetherfallGame } from "@/components/aetherfall-game";
import { GameShellBar } from "@/components/games/game-shell-bar";

export const metadata: Metadata = { title: "Aetherfall" };

export default function AetherfallPage() {
  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <GameShellBar gameName="Aetherfall" />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <AetherfallGame />
      </div>
    </div>
  );
}
