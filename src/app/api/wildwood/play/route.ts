import { WILDWOOD_CONFIG, isAllowedStake, resolveWildwoodRound } from "@/lib/wildwood";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { InsufficientBalanceError, settleRound } from "@/lib/wallet";

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

  const requestedStake = isAllowedStake(body.stake) ? body.stake : 1;

  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json(resolveWildwoodRound({ seed: resolveSeed(body.seed), stake: requestedStake }), {
      headers: { "Cache-Control": "no-store" }
    });
  }

  // Logged-in players auto-consume bonus spins at the locked bonus stake
  // before any real balance is touched, regardless of the stake they picked.
  const isBonusSpin = (session.user.bonusSpinsRemaining ?? 0) > 0;
  const stake = isBonusSpin ? (session.user.bonusSpinStake ?? requestedStake) : requestedStake;

  const round = resolveWildwoodRound({ seed: resolveSeed(body.seed), stake });

  try {
    const wallet = settleRound(session.user.id, { stakeCharged: stake, isBonusSpin, win: round.cappedWin });
    return NextResponse.json({ ...round, wallet: { ...wallet, isBonusSpin } }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof InsufficientBalanceError) {
      return NextResponse.json({ error: "Insufficient balance." }, { status: 400, headers: { "Cache-Control": "no-store" } });
    }
    throw error;
  }
}

function resolveSeed(candidate: unknown): string {
  if (!ALLOW_CLIENT_SEED || typeof candidate !== "string") return crypto.randomUUID();
  const trimmed = candidate.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_SEED_LENGTH) return crypto.randomUUID();
  return trimmed;
}
