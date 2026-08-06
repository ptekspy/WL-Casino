function initialFor(label: string): string {
  const trimmed = label.trim();
  return trimmed.length > 0 ? trimmed[0].toUpperCase() : "?";
}

export function UserAvatar({ label, size = 36 }: Readonly<{ label: string; size?: number }>) {
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full border border-amber-200/30 bg-[radial-gradient(circle_at_35%_25%,#6ee7b7_0%,#10b981_45%,#065f46_100%)] font-black text-emerald-950"
      style={{ width: size, height: size, fontSize: size * 0.42 }}
      aria-hidden="true"
    >
      {initialFor(label)}
    </span>
  );
}
