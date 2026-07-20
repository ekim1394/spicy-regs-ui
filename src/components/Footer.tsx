import Link from "next/link";
import { Flame } from "lucide-react";

import { APP_FRAME } from "./ui/appFrame";

// Footer nav mirrors the header's three items plus Lab, which is otherwise
// reachable by URL only — the footer is a fine place to surface it.
const FOOTER_LINKS = [
  { href: "/feed", label: "Feed" },
  { href: "/agencies", label: "Agencies" },
  { href: "/sources", label: "Sources" },
  { href: "/about", label: "About" },
  { href: "/lab", label: "Lab" },
];

/**
 * Short global footer rendered by {@link PageShell} below every page's content.
 * Uses the same fixed {@link APP_FRAME} width as the header so the two pieces of
 * chrome stay aligned across routes.
 */
export function Footer() {
  return (
    <footer className="border-t border-[var(--border)] bg-[var(--surface)]/60">
      <div
        className={`${APP_FRAME} mx-auto px-4 py-6 flex flex-col sm:flex-row items-center justify-between gap-3`}
      >
        <Link href="/feed" className="flex items-center gap-1.5">
          <Flame size={15} className="text-[var(--accent-primary)]" />
          <span className="text-sm font-bold gradient-text font-serif">SpicyRegs</span>
        </Link>

        <nav className="flex items-center gap-0.5">
          {FOOTER_LINKS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-elevated)] transition-colors"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
