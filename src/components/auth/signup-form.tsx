"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { Field, FIELD_INPUT_CLASS } from "@/components/auth/auth-field";

export function SignupForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    const { error: signUpError } = await authClient.signUp.email({ name, email, password });

    setSubmitting(false);
    if (signUpError) {
      setError(signUpError.message ?? "Couldn't create your account.");
      return;
    }

    router.push("/account");
    router.refresh();
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Field label="Display name" htmlFor="name">
        <input
          id="name"
          type="text"
          required
          minLength={2}
          value={name}
          onChange={(event) => setName(event.target.value)}
          className={FIELD_INPUT_CLASS}
          autoComplete="name"
        />
      </Field>
      <Field label="Email" htmlFor="email">
        <input
          id="email"
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className={FIELD_INPUT_CLASS}
          autoComplete="email"
        />
      </Field>
      <Field label="Password" htmlFor="password">
        <input
          id="password"
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className={FIELD_INPUT_CLASS}
          autoComplete="new-password"
        />
      </Field>

      {error ? <p className="text-sm font-bold text-red-300">{error}</p> : null}

      <button
        type="submit"
        disabled={submitting}
        className="mt-2 rounded-full border border-amber-200/30 bg-gradient-to-b from-emerald-400 to-emerald-600 px-4 py-3 text-sm font-black text-emerald-950 shadow-[0_8px_20px_-8px_rgba(16,185,129,0.6)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting ? "Creating account…" : "Create account"}
      </button>

      <p className="text-center text-sm text-emerald-100/50">
        Already have an account?{" "}
        <Link href="/login" className="font-bold text-emerald-200 hover:text-white">
          Log in
        </Link>
      </p>
    </form>
  );
}
