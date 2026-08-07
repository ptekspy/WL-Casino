import { AETHERFALL_CONFIG, isAetherfallLead, resolveAetherfallRound } from "@/lib/aetherfall";
import { handlePlayRequest } from "@/lib/play-route";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return handlePlayRequest(request, {
    allowedStakes: AETHERFALL_CONFIG.allowedStakes,
    resolveRound: ({ seed, stake, requestBody }) =>
      resolveAetherfallRound({
        seed,
        stake,
        lead: isAetherfallLead(requestBody.lead) ? requestBody.lead : AETHERFALL_CONFIG.defaultLead
      })
  });
}
