"use client";

import { createAuthClient } from "better-auth/react";
import { inferAdditionalFields } from "better-auth/client/plugins";
import type { auth } from "@/lib/auth";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_BETTER_AUTH_URL ?? "http://localhost:6799",
  plugins: [inferAdditionalFields<typeof auth>()]
});

export const { useSession, signIn, signUp, signOut } = authClient;
