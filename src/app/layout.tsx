import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { Providers } from "./providers";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { SITE_NAME, SITE_TAGLINE } from "@/lib/site-config";

export const metadata: Metadata = {
  title: SITE_NAME,
  description: `${SITE_NAME} — ${SITE_TAGLINE} Fake-money casino prototype.`
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col bg-neutral-950 text-emerald-50 antialiased">
        <Providers>
          <SiteHeader />
          <main className="flex-1">{children}</main>
          <SiteFooter />
        </Providers>
      </body>
    </html>
  );
}
