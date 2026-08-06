import { DRAGONFORGE_CONFIG, resolveDragonforgeRound } from "@/lib/dragonforge";
import { handlePlayRequest } from "@/lib/play-route";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return handlePlayRequest(request, {
    allowedStakes: DRAGONFORGE_CONFIG.allowedStakes,
    resolveRound: resolveDragonforgeRound
  });
}
