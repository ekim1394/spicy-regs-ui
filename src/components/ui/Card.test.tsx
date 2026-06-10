import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Card } from './Card';

describe('Card', () => {
  it('renders default variant with .card class and no size modifier', () => {
    render(<Card>hello</Card>);
    expect(screen.getByText('hello').className).toContain('card');
    expect(screen.getByText('hello').className).not.toContain('card-lg');
  });

  it('renders gradient variant as .card .card-lg', () => {
    render(<Card variant="gradient">grad</Card>);
    expect(screen.getByText('grad').className).toContain('card');
    expect(screen.getByText('grad').className).toContain('card-lg');
  });

  it('renders post variant as .card .card-lg', () => {
    render(<Card variant="post">postcard</Card>);
    expect(screen.getByText('postcard').className).toContain('card');
    expect(screen.getByText('postcard').className).toContain('card-lg');
  });

  it('renders a non-hover surface as .card-static when interactive is false', () => {
    render(<Card interactive={false}>static</Card>);
    const el = screen.getByText('static');
    expect(el.className).toContain('card-static');
    // The interactive base must be absent (token boundary, not a substring of card-static)
    expect(el.className.split(/\s+/)).not.toContain('card');
  });

  it('keeps the radius bump on a non-interactive gradient surface', () => {
    render(<Card variant="gradient" interactive={false}>static-lg</Card>);
    const el = screen.getByText('static-lg');
    expect(el.className).toContain('card-static');
    expect(el.className).toContain('card-lg');
  });

  it('forwards the card classes to its child when asChild is set', () => {
    render(
      <Card asChild variant="gradient" className="extra">
        <a href="/foo">link card</a>
      </Card>,
    );
    const link = screen.getByText('link card');
    expect(link.tagName).toBe('A');
    expect(link.getAttribute('href')).toBe('/foo');
    expect(link.className).toContain('card-lg');
    expect(link.className).toContain('extra');
  });
});
