import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PageShell } from './PageShell';

// Header pulls in next/navigation, which jsdom can't satisfy without a
// router context. Mock it to keep this an isolated PageShell smoke test.
vi.mock('@/components/Header', () => ({
  Header: () => <header data-testid="mock-header">Header</header>,
}));

describe('PageShell', () => {
  it('renders Header and children inside <main>', () => {
    render(
      <PageShell>
        <p>hello world</p>
      </PageShell>,
    );
    expect(screen.getByTestId('mock-header')).toBeInTheDocument();
    const main = screen.getByRole('main');
    expect(main).toContainElement(screen.getByText('hello world'));
  });

  it('defaults to max-w-6xl', () => {
    render(<PageShell><div /></PageShell>);
    expect(screen.getByRole('main').className).toContain('max-w-6xl');
  });

  it('honors maxWidth="5xl"', () => {
    render(<PageShell maxWidth="5xl"><div /></PageShell>);
    expect(screen.getByRole('main').className).toContain('max-w-5xl');
  });

  it('replaces standard padding when mainClassName is set (keeping flex-1)', () => {
    render(<PageShell mainClassName="custom-main"><div /></PageShell>);
    const main = screen.getByRole('main');
    // flex-1 is always applied so the footer is pushed to the bottom; the
    // caller's mainClassName replaces only the width/padding defaults.
    expect(main.className).toBe('flex-1 custom-main');
  });
});
