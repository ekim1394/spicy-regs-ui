"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, Database, Flame, List } from 'lucide-react';

import { SearchInput } from "./SearchInput";
import { APP_FRAME } from "./ui/appFrame";

// Primary nav is deliberately minimal. Federal Register (now folded into
// the feed via the FR toggle), About, and Lab stay reachable by URL only.
const NAV_ITEMS = [
  { href: "/feed", label: "Feed", icon: List },
  { href: "/agencies", label: "Agencies", icon: Building2 },
  { href: "/sources", label: "Sources", icon: Database },
];

export function Header() {
  const pathname = usePathname();

  return (
    <header className="border-b border-[var(--border)] bg-[var(--surface)]/80 backdrop-blur-xl sticky top-0 z-50">
      {/* Inner column is a fixed width (APP_FRAME), not the page's content
          width, so the logo / search / nav never shift between routes. */}
      <div className={`${APP_FRAME} mx-auto px-4`}>
        <div className="flex items-center gap-4 h-14">
          {/* Logo → the About page (the product's front door, served on the
              apex domain). Flanking sections share flex-1 so the search bar
              stays centered in the header. */}
          <div className="flex-1 flex justify-start">
            <Link href="/about" className="flex items-center gap-1.5 flex-shrink-0">
              <Flame size={22} className="text-[var(--accent-primary)]" />
              <span className="text-lg font-bold gradient-text font-serif hidden sm:inline">
                SpicyRegs
              </span>
            </Link>
          </div>

          {/* Search — centered */}
          <SearchInput className="w-full max-w-md min-w-0" />

          {/* Navigation */}
          <nav className="flex-1 flex items-center justify-end gap-0.5">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive =
                pathname === item.href ||
                (item.href === '/agencies' && pathname?.startsWith('/sr')) ||
                (item.href === '/sources' && pathname?.startsWith('/sources'));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-label={item.label}
                  className={`px-2 sm:px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    isActive
                      ? "bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]"
                      : "text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-elevated)]"
                  }`}
                >
                  <Icon size={15} className="sm:hidden" aria-hidden="true" />
                  <span className="hidden sm:inline">{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
    </header>
  );
}
