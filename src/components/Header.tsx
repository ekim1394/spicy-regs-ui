"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Flame } from 'lucide-react';

import { SearchInput } from "./SearchInput";

// Primary nav is deliberately three items. Federal Register (now folded into
// the feed via the FR toggle) and Lab stay reachable by URL only.
const NAV_ITEMS = [
  { href: "/feed", label: "Feed" },
  { href: "/agencies", label: "Agencies" },
  { href: "/about", label: "About" },
];

interface HeaderProps {
  /**
   * Tailwind max-width class for the header's inner content, so the logo /
   * search / nav align with the content column below it. The bar itself
   * (border + blurred surface) always spans full width. PageShell passes the
   * active page's width; defaults to the widest shell for standalone use.
   */
  maxWidthClass?: string;
}

export function Header({ maxWidthClass = 'max-w-7xl' }: HeaderProps = {}) {
  const pathname = usePathname();

  return (
    <header className="border-b border-[var(--border)] bg-[var(--surface)]/80 backdrop-blur-xl sticky top-0 z-50">
      <div className={`${maxWidthClass} mx-auto px-4`}>
        <div className="flex items-center gap-4 h-14">
          {/* Logo → the feed (the primary product surface) */}
          <Link href="/feed" className="flex items-center gap-1.5 flex-shrink-0">
            <Flame size={22} className="text-[var(--accent-primary)]" />
            <span className="text-lg font-bold gradient-text font-serif hidden sm:inline">
              SpicyRegs
            </span>
          </Link>

          {/* Search */}
          <SearchInput className="flex-1 max-w-md" />

          {/* Navigation — ml-auto brackets it against the content's right edge
              (the search caps at max-w-md, so it won't push the nav out itself) */}
          <nav className="ml-auto flex items-center gap-0.5">
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
