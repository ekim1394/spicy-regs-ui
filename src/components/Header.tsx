"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Flame } from 'lucide-react';

import { SearchInput } from "./SearchInput";
import { APP_FRAME } from "./ui/appFrame";

// Primary nav is deliberately minimal. Federal Register (now folded into
// the feed via the FR toggle), About, and Lab stay reachable by URL only.
const NAV_ITEMS = [
  { href: "/feed", label: "Feed" },
  { href: "/agencies", label: "Agencies" },
];

export function Header() {
  const pathname = usePathname();

  return (
    <header className="border-b border-[var(--border)] bg-[var(--surface)]/80 backdrop-blur-xl sticky top-0 z-50">
      {/* Inner column is a fixed width (APP_FRAME), not the page's content
          width, so the logo / search / nav never shift between routes. */}
      <div className={`${APP_FRAME} mx-auto px-4`}>
        <div className="flex items-center gap-4 h-14">
          {/* Logo → the feed (the primary product surface). Flanking sections
              share flex-1 so the search bar stays centered in the header. */}
          <div className="flex-1 flex justify-start">
            <Link href="/feed" className="flex items-center gap-1.5 flex-shrink-0">
              <Flame size={22} className="text-[var(--accent-primary)]" />
              <span className="text-lg font-bold gradient-text font-serif hidden sm:inline">
                SpicyRegs
              </span>
            </Link>
          </div>

          {/* Search — centered */}
          <SearchInput className="w-full max-w-md" />

          {/* Navigation */}
          <nav className="flex-1 flex items-center justify-end gap-0.5">
            {NAV_ITEMS.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href === '/agencies' && pathname?.startsWith('/sr'));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    isActive
                      ? "bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]"
                      : "text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-elevated)]"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
    </header>
  );
}
