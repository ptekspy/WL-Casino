import Link from "next/link";

export function AuthButtons() {
  return (
    <div className="flex items-center gap-2">
      <Link
        href="/login"
        className="rounded-full px-4 py-2 text-sm font-bold text-emerald-100/80 transition hover:text-white"
      >
        Log in
      </Link>
      <Link
        href="/signup"
        className="rounded-full border border-amber-200/30 bg-gradient-to-b from-emerald-400 to-emerald-600 px-4 py-2 text-sm font-black text-emerald-950 shadow-[0_8px_20px_-8px_rgba(16,185,129,0.6)] transition hover:brightness-110"
      >
        Sign up
      </Link>
    </div>
  );
}
