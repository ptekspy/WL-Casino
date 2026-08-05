import { resolveWildwoodRound } from "@/lib/wildwood";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type PlayRequest = {
  seed?: string;
  stake?: number;
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as PlayRequest;
  const stake = Number.isFinite(body.stake) && body.stake && body.stake > 0 ? body.stake : 1;
  const seed = body.seed?.trim() || crypto.randomUUID();

  return NextResponse.json(resolveWildwoodRound({ seed, stake }), {
    headers: {
      "Cache-Control": "no-store"
    }
  });
}
