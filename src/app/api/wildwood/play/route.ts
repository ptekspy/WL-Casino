import { WILDWOOD_CONFIG, isAllowedStake, resolveWildwoodRound } from "@/lib/wildwood";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type PlayRequest = {
  seed?: unknown;
  stake?: unknown;
};

/**
 * Caller-supplied seeds are a deliberate test hook: the engine is fully
 * deterministic, so a client that can choose the seed can grind offline and
 * submit only winners. Disabled in production builds.
 */
const ALLOW_CLIENT_SEED = process.env.NODE_ENV !== "production";
const MAX_SEED_LENGTH = 64;

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as PlayRequest;

  if (body.stake !== undefined && !isAllowedStake(body.stake)) {
    return NextResponse.json(
      { error: "Invalid stake.", allowedStakes: WILDWOOD_CONFIG.allowedStakes },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  const stake = isAllowedStake(body.stake) ? body.stake : 1;

  return NextResponse.json(resolveWildwoodRound({ seed: resolveSeed(body.seed), stake }), {
    headers: { "Cache-Control": "no-store" }
  });
}

function resolveSeed(candidate: unknown): string {
  if (!ALLOW_CLIENT_SEED || typeof candidate !== "string") return crypto.randomUUID();
  const trimmed = candidate.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_SEED_LENGTH) return crypto.randomUUID();
  return trimmed;
}
