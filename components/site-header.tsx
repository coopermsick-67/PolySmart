"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", label: "Consensus" },
  { href: "/portfolio", label: "Bankroll Tracker" },
];

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="mx-auto flex max-w-7xl flex-col gap-3 px-4 pt-6 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-neutral-100">Polymarket Smart Money Consensus</h1>
        <p className="text-sm text-neutral-500">
          Research and analytics only. Not financial advice. Wallet activity may be stale, hedged,
          or wrong. Do your own research.
        </p>
      </div>
      <nav className="flex gap-1 border-b border-neutral-800">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "border-emerald-500 text-emerald-400"
                  : "border-transparent text-neutral-500 hover:text-neutral-300",
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
