import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import { SourceCard } from './SourceCard';
import type { SourceCardModel } from '@/lib/sources/types';

const FULL_CARD: SourceCardModel = {
  id: 'x1',
  chips: [
    { label: 'H.R. 2573', variant: 'code' },
    { label: 'House' },
    { label: '$30K', variant: 'accent' },
  ],
  title: 'LIZARD Act of 2025',
  href: 'https://www.congress.gov/bill/119th-congress/house-bill/2573',
  body: 'Referred to the House Committee on Natural Resources.',
  metaLeft: 'via STRATEGIC POLICY COUNSEL PLLC',
  metaRight: 'Latest action Apr 1, 2025',
  linkLabel: 'congress.gov',
};

describe('SourceCard', () => {
  it('renders chips, title link, body, and meta footer', () => {
    render(<SourceCard card={FULL_CARD} />);

    expect(screen.getByText('H.R. 2573')).toBeInTheDocument();
    expect(screen.getByText('House')).toBeInTheDocument();
    expect(screen.getByText('$30K')).toBeInTheDocument();

    const titleLink = screen.getByRole('link', { name: 'LIZARD Act of 2025' });
    expect(titleLink).toHaveAttribute('href', FULL_CARD.href);
    expect(titleLink).toHaveAttribute('target', '_blank');
    expect(titleLink).toHaveAttribute('rel', 'noopener noreferrer');

    expect(
      screen.getByText('Referred to the House Committee on Natural Resources.'),
    ).toBeInTheDocument();
    expect(screen.getByText('via STRATEGIC POLICY COUNSEL PLLC')).toBeInTheDocument();
    expect(screen.getByText('Latest action Apr 1, 2025')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /congress\.gov/ })).toBeInTheDocument();
  });

  it('renders a plain-text title when there is no href', () => {
    render(<SourceCard card={{ ...FULL_CARD, href: null, linkLabel: null }} />);
    expect(screen.getByText('LIZARD Act of 2025')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'LIZARD Act of 2025' })).not.toBeInTheDocument();
  });

  it('omits optional slots cleanly', () => {
    render(
      <SourceCard
        card={{
          id: 'x2',
          chips: [],
          title: 'Bare row',
          href: null,
          body: null,
          metaLeft: null,
          metaRight: null,
          linkLabel: null,
        }}
      />,
    );
    expect(screen.getByText('Bare row')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('applies badge variants to chips', () => {
    render(<SourceCard card={FULL_CARD} />);
    expect(screen.getByText('H.R. 2573').className).toContain('font-mono-id');
    expect(screen.getByText('$30K').className).toContain('accent');
  });
});
