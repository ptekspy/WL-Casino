import type { ReactNode } from "react";

export function AuthCard({ title, subtitle, children }: Readonly<{ title: string; subtitle: string; children: ReactNode }>) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-16 sm:px-6">
      <div className="text-center">
        <h1 className="text-3xl font-black tracking-tight text-white">{title}</h1>
        <p className="mt-2 text-sm text-emerald-100/60">{subtitle}</p>
      </div>
      <div className="rounded-[2rem] border border-emerald-100/10 bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.08),transparent_42%),rgba(255,255,255,0.035)] p-6 shadow-2xl shadow-black/40 sm:p-8">
        {children}
      </div>
    </div>
  );
}
