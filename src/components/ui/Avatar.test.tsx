import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Avatar } from './Avatar';

describe('Avatar', () => {
  it('renders derived initials when no fallback is given', () => {
    render(<Avatar name="Environmental Protection Agency" />);
    expect(screen.getByText('EP')).toBeInTheDocument();
  });

  it('honors explicit fallback over derived initials', () => {
    render(<Avatar name="ignored" fallback="HUD" />);
    expect(screen.getByText('HUD')).toBeInTheDocument();
  });

  it('applies size prop as inline width/height', () => {
    render(<Avatar name="Foo" size="lg" data-testid="avatar" />);
    // Radix Avatar.Root is the outermost element — find by fallback parent.
    const fallback = screen.getByText('F');
    const root = fallback.closest('[style*="width"]') as HTMLElement;
    expect(root.style.width).toBe('48px');
    expect(root.style.height).toBe('48px');
  });

  it('uses provided color for fallback background', () => {
    render(<Avatar name="Foo" color="rgb(0, 128, 0)" />);
    const fallback = screen.getByText('F');
    expect(fallback).toHaveStyle({ backgroundColor: 'rgb(0, 128, 0)' });
  });

  it('falls back to a deterministic hashed color when no color given', () => {
    render(<Avatar name="repeatable" />);
    const fallback = screen.getByText('R');
    // stringToColor produces hsl(...) — assert it's something other than empty.
    expect(fallback.style.backgroundColor).toMatch(/hsl|rgb/);
  });
});
