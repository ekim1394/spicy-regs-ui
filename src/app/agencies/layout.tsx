import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Agencies',
};

export default function AgenciesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
