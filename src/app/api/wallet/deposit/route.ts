import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { ALLOWED_DEPOSIT_AMOUNTS } from "@/lib/bonus";
import { applyDeposit } from "@/lib/wallet";

export const dynamic = "force-dynamic";

type DepositRequest = { amount?: unknown };

function isAllowedDeposit(candidate: unknown): candidate is (typeof ALLOWED_DEPOSIT_AMOUNTS)[number] {
  return typeof candidate === "number" && (ALLOWED_DEPOSIT_AMOUNTS as readonly number[]).includes(candidate);
}

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  const body = (await request.json().catch(() => ({}))) as DepositRequest;
  if (!isAllowedDeposit(body.amount)) {
    return NextResponse.json(
      { error: "Invalid deposit amount.", allowedAmounts: ALLOWED_DEPOSIT_AMOUNTS },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  const result = applyDeposit(session.user.id, body.amount);
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
