import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusTag } from './StatusTag';
import { deadlineLevel } from '@/lib/deadline';

function inDays(n: number): string {
  return new Date(Date.now() + n * 24 * 60 * 60 * 1000).toISOString();
}

describe('deadlineLevel thresholds (<=3 red, <=12 amber, else green)', () => {
  it('maps day counts to the unified scale', () => {
    expect(deadlineLevel(0)).toBe('red');
    expect(deadlineLevel(3)).toBe('red');
    expect(deadlineLevel(4)).toBe('amber');
    expect(deadlineLevel(12)).toBe('amber');
    expect(deadlineLevel(13)).toBe('green');
    expect(deadlineLevel(45)).toBe('green');
  });
});

describe('StatusTag', () => {
  it('shows days-left for an open window', () => {
    render(<StatusTag commentEndDate={inDays(5)} />);
    expect(screen.getByText('5d left')).toBeInTheDocument();
  });

  it('shows "Comment period closed" for a past date', () => {
    render(<StatusTag commentEndDate={inDays(-10)} />);
    expect(screen.getByText('Comment period closed')).toBeInTheDocument();
  });

  it('shows "Final rule" when forced', () => {
    render(<StatusTag state="final" />);
    expect(screen.getByText('Final rule')).toBeInTheDocument();
  });

  it('renders nothing without a date or state', () => {
    const { container } = render(<StatusTag />);
    expect(container).toBeEmptyDOMElement();
  });

  it('colours an urgent (<=3d) deadline red', () => {
    render(<StatusTag commentEndDate={inDays(2)} />);
    const tag = screen.getByText('2d left');
    expect(tag.getAttribute('style')).toContain('var(--accent-red)');
  });
});
