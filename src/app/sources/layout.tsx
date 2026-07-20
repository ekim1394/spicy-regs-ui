import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sources',
  description:
    'Explore the complementary federal datasets in the Spicy Regs corpus — Unified Agenda, Congress bills, CFR, lobbying, FEC, court dockets, GAO and CRS reports, and more.',
};

export default function SourcesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
