import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/lib/db";

export const auth = betterAuth({
  database: db,
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:6799",
  secret: process.env.BETTER_AUTH_SECRET,
  emailAndPassword: {
    enabled: true
  },
  user: {
    additionalFields: {
      balance: {
        type: "number",
        required: false,
        defaultValue: 0,
        input: false
      },
      bonusSpinsRemaining: {
        type: "number",
        required: false,
        defaultValue: 0,
        input: false
      },
      bonusSpinStake: {
        type: "number",
        required: false,
        defaultValue: 0,
        input: false
      },
      hasDeposited: {
        type: "boolean",
        required: false,
        defaultValue: false,
        input: false
      },
      // Client-settable (unlike the wallet fields above) — collected at
      // signup and, for accounts that predate this field, via /account.
      // Drives the UK age-banded stake cap in src/lib/uk-compliance.ts.
      // Not DB-required (nullable): a NOT NULL column can't be added to a
      // table that already has rows without a default, and the app already
      // treats a missing value as "needs to be set before playing" — see
      // the needsDateOfBirth gate in wildwood-game.tsx. The signup form
      // still requires it for new accounts via its own client validation.
      dateOfBirth: {
        type: "string",
        required: false,
        input: true
      }
    }
  },
  // Must be last: makes signIn/signUp server actions set cookies correctly under Next.js.
  plugins: [nextCookies()]
});
