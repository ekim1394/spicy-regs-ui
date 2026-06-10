import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Badge } from './Badge';

describe('Badge', () => {
  it('renders neutral variant with surface-elevated background', () => {
    render(<Badge>Proposed Rule</Badge>);
    const badge = screen.getByText('Proposed Rule');
    expect(badge.className).toContain('bg-[var(--surface-elevated)]');
    expect(badge.className).toContain('text-[var(--muted)]');
  });

  it('renders accent variant with soft-accent background', () => {
    render(<Badge variant="accent">Organization</Badge>);
    const badge = screen.getByText('Organization');
    expect(badge.className).toContain('bg-[var(--accent-primary-soft)]');
  });

  it('renders code variant with mono font and surface-raised background', () => {
    render(<Badge variant="code">EPA-2024-0001</Badge>);
    const badge = screen.getByText('EPA-2024-0001');
    expect(badge.className).toContain('font-mono-id');
    expect(badge.className).toContain('bg-[var(--surface-raised)]');
  });

  it('renders an aria-hidden dot when dot is set', () => {
    render(<Badge dot>Federal Register</Badge>);
    const badge = screen.getByText('Federal Register');
    const dot = badge.querySelector('[aria-hidden]');
    expect(dot).not.toBeNull();
  });

  it('respects size prop', () => {
    render(<Badge size="xs">Tiny</Badge>);
    const badge = screen.getByText('Tiny');
    expect(badge.className).toContain('text-[10px]');
  });

  it('merges caller className', () => {
    render(<Badge className="custom-extra">Tagged</Badge>);
    const badge = screen.getByText('Tagged');
    expect(badge.className).toContain('custom-extra');
  });
});
