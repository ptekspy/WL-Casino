import type { ReactNode } from "react";

export function Field({ label, htmlFor, children }: Readonly<{ label: string; htmlFor: string; children: ReactNode }>) {
  return (
    <label htmlFor={htmlFor} className="flex flex-col gap-1.5">
      <span className="text-xs font-black uppercase tracking-[0.16em] text-emerald-200/50">{label}</span>
      {children}
    </label>
  );
}

export const FIELD_INPUT_CLASS =
  "w-full rounded-xl border border-white/10 bg-black/30 px-4 py-2.5 text-white outline-none focus:border-emerald-300/40";
