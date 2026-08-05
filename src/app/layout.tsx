import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Wildwood | WL Casino",
  description: "Fake-money Wildwood casino game prototype."
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-neutral-950 text-emerald-50 antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
