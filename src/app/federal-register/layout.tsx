import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Federal Register',
};

export default function FederalRegisterLayout({ children }: { children: React.ReactNode }) {
  return children;
}
