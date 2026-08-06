"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { MIN_PLAYER_AGE, ageFromDateOfBirth } from "@/lib/uk-compliance";

/**
 * Backfill for accounts created before dateOfBirth existed — the only path
 * that gets a legacy account playable again, since the wildwood-game.tsx
 * gate and the play route both require it. New signups collect this
 * up front instead (src/components/auth/signup-form.tsx).
 */
export function DateOfBirthForm() {
  const router = useRouter();
  const { refetch } = authClient.useSession();
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    if (ageFromDateOfBirth(dateOfBirth) < MIN_PLAYER_AGE) {
      setError(`You must be ${MIN_PLAYER_AGE} or older to play.`);
      return;
    }

    setSubmitting(true);
    const { error: updateError } = await authClient.updateUser({ dateOfBirth });
    setSubmitting(false);

    if (updateError) {
      setError(updateError.message ?? "Couldn't save your date of birth.");
      return;
    }

    // Two refreshes needed: refetch() updates the client-side useSession()
    // store other components (WildwoodGame, SiteHeader) subscribe to, while
    // this page's own DOB-set/unset branch is server-rendered and only
    // re-runs on router.refresh().
    await refetch();
    router.refresh();
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 rounded-[1.75rem] border border-amber-200/25 bg-amber-300/10 p-5"
    >
      <div>
        <h3 className="text-lg font-black text-white">Add your date of birth</h3>
        <p className="mt-1 text-sm text-emerald-100/60">
          UK rules cap stakes by age — 18-24 is £2, 25+ is £5. We only need this once, and it unlocks play.
        </p>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-black uppercase tracking-[0.16em] text-emerald-200/50">Date of birth</span>
          <input
            type="date"
            required
            value={dateOfBirth}
            onChange={(event) => setDateOfBirth(event.target.value)}
            className="rounded-xl border border-white/10 bg-black/30 px-4 py-2.5 text-white outline-none focus:border-emerald-300/40"
          />
        </label>
        <button
          type="submit"
          disabled={submitting}
          className="rounded-full border border-amber-200/30 bg-gradient-to-b from-emerald-400 to-emerald-600 px-5 py-2.5 text-sm font-black text-emerald-950 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? "Saving…" : "Save"}
        </button>
      </div>
      {error ? <p className="text-sm font-bold text-red-300">{error}</p> : null}
    </form>
  );
}
