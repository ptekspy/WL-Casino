import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { Providers } from "./providers";
import { SITE_NAME, SITE_TAGLINE } from "@/lib/site-config";

export const metadata: Metadata = {
  title: SITE_NAME,
  description: `${SITE_NAME} — ${SITE_TAGLINE} Fake-money casino prototype.`
};

/**
 * Deliberately chrome-free: the marketing/account pages get SiteHeader/Footer
 * from src/app/(site)/layout.tsx, but games (src/app/games/<slug>) sit
 * outside that route group so they can render a full-viewport, dedicated
 * game shell instead of the site header/footer.
 */
export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-neutral-950 text-emerald-50 antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
