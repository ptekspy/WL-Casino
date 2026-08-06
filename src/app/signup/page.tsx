import type { Metadata } from "next";
import { AuthCard } from "@/components/auth/auth-card";
import { SignupForm } from "@/components/auth/signup-form";
import { BONUS_CONFIG } from "@/lib/bonus";

export const metadata: Metadata = { title: "Sign up" };

export default function SignupPage() {
  return (
    <AuthCard
      title="Create your account"
      subtitle={`Deposit ${BONUS_CONFIG.depositTrigger}+ demo credits after signing up and get ${BONUS_CONFIG.spins} bonus spins.`}
    >
      <SignupForm />
    </AuthCard>
  );
}
