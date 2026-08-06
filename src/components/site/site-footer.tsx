import { SITE_NAME } from "@/lib/site-config";

export function SiteFooter() {
  return (
    <footer className="border-t border-white/10 bg-neutral-950/60">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-2 px-4 py-8 text-sm text-emerald-100/40 sm:px-6 lg:px-8">
        <p className="font-bold text-emerald-100/60">{SITE_NAME}</p>
        <p>
          Fake-money prototype. No real currency is deposited, wagered, or won here — every credit, spin, and
          balance on this site is play money for demonstration purposes only.
        </p>
        <p>&copy; {new Date().getFullYear()} {SITE_NAME}.</p>
      </div>
    </footer>
  );
}
