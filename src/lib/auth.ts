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
      }
    }
  },
  // Must be last: makes signIn/signUp server actions set cookies correctly under Next.js.
  plugins: [nextCookies()]
});
