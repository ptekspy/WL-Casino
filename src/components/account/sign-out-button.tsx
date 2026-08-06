"use client";

import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export function SignOutButton() {
  const router = useRouter();

  const handleSignOut = async () => {
    await authClient.signOut();
    router.push("/");
    router.refresh();
  };

  return (
    <button
      type="button"
      onClick={handleSignOut}
      className="rounded-full border border-white/10 bg-black/30 px-5 py-2.5 text-sm font-bold text-emerald-100/70 transition hover:border-red-300/30 hover:text-red-200"
    >
      Sign out
    </button>
  );
}
