import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

/**
 * Optimistic-only: checks cookie presence so logged-out users don't even see
 * the account page flash before redirecting. Real authorization happens
 * server-side via auth.api.getSession() in the route/page itself.
 */
export function middleware(request: NextRequest) {
  const sessionCookie = getSessionCookie(request);
  if (!sessionCookie) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/account"]
};
