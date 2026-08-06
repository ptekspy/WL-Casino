import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { InsufficientBalanceError, settleRound } from "@/lib/wallet";
import { ageFromDateOfBirth, maxStakeForAge } from "@/lib/uk-compliance";

/**
 * Caller-supplied seeds are a deliberate test hook: every game engine is
 * fully deterministic, so a client that can choose the seed can grind
 * offline and submit only winners. Disabled in production builds.
 */
const ALLOW_CLIENT_SEED = process.env.NODE_ENV !== "production";
const MAX_SEED_LENGTH = 64;

type PlayRequestBody = { seed?: unknown; stake?: unknown };

/**
 * Shared server-side play handler: stake validation, session/age/stake-cap
 * gating, bonus-spin stake resolution, and wallet settlement. Extracted out
 * of the Wildwood play route so every game's route is just this call with
 * its own `resolveRound`.
 */
export async function handlePlayRequest<TRound extends { cappedWin: number }>(
  request: Request,
  config: {
    allowedStakes: readonly number[];
    resolveRound: (input: { seed: string; stake: number }) => TRound;
  }
): Promise<NextResponse> {
  const body = (await request.json().catch(() => ({}))) as PlayRequestBody;
  const isAllowedStake = (stake: unknown): stake is number =>
    typeof stake === "number" && Number.isFinite(stake) && config.allowedStakes.includes(stake);

  if (body.stake !== undefined && !isAllowedStake(body.stake)) {
    return NextResponse.json(
      { error: "Invalid stake.", allowedStakes: config.allowedStakes },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  const requestedStake = isAllowedStake(body.stake) ? body.stake : 1;

  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "Sign up or log in to play." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  // UK stake limits: this is the real enforcement boundary (the signup-form
  // and client-side dropdown filtering are UX niceties, not what's relied on).
  const dateOfBirth = session.user.dateOfBirth as string | null | undefined;
  const age = dateOfBirth ? ageFromDateOfBirth(dateOfBirth) : 0;
  if (age < 18) {
    return NextResponse.json(
      { error: "You must be 18 or older, with a date of birth on file, to play." },
      { status: 403, headers: { "Cache-Control": "no-store" } }
    );
  }
  const maxStake = maxStakeForAge(age);
  if (requestedStake > maxStake) {
    return NextResponse.json(
      { error: `Stake exceeds the ${maxStake.toFixed(2)} limit for your age group.` },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  // Logged-in players auto-consume bonus spins at the locked bonus stake
  // before any real balance is touched, regardless of the stake they picked.
  const isBonusSpin = (session.user.bonusSpinsRemaining ?? 0) > 0;
  const stake = isBonusSpin ? (session.user.bonusSpinStake ?? requestedStake) : requestedStake;

  const round = config.resolveRound({ seed: resolveSeed(body.seed), stake });

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
