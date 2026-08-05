export type WinPresentationTier = "standard" | "good" | "big" | "mega" | "max";

export type WinPresentation = {
  tier: WinPresentationTier;
  label: string;
  holdMs: number;
  countMs: number;
  intensity: number;
};

/**
 * Visual win tiers are based on return relative to stake, never raw currency.
 * The thresholds deliberately affect presentation only and do not alter payout math.
 */
export function getWinPresentation(win: number, stake: number, capApplied = false): WinPresentation {
  const multiple = stake > 0 ? win / stake : 0;
  if (capApplied) return { tier: "max", label: "MAX WIN", holdMs: 1700, countMs: 1900, intensity: 1 };
  if (multiple >= 50) return { tier: "mega", label: "MEGA WIN", holdMs: 1350, countMs: 1550, intensity: 0.86 };
  if (multiple >= 15) return { tier: "big", label: "BIG WIN", holdMs: 1050, countMs: 1250, intensity: 0.68 };
  if (multiple >= 3) return { tier: "good", label: "NICE WIN", holdMs: 700, countMs: 850, intensity: 0.42 };
  return { tier: "standard", label: win > 0 ? "WIN" : "ROUND COMPLETE", holdMs: 500, countMs: 520, intensity: 0.18 };
}
