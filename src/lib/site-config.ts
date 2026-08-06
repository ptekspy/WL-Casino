/** Single source of truth for the brand name so it never drifts between pages/copy. */
export const SITE_NAME = "Wildline Casino";
export const SITE_TAGLINE = "Fake-money play. Real cascades.";

export type NavLink = { href: string; label: string };

export const NAV_LINKS: readonly NavLink[] = [
  { href: "/", label: "Home" },
  { href: "/games", label: "Games" },
  { href: "/promotions", label: "Promotions" }
];
