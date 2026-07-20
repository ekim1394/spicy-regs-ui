import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import { MiniSourceCard } from './MiniSourceCard';
import type { SourceCardModel } from '@/lib/sources/types';

const CARD: SourceCardModel = {
  id: '2060-AW83-202510',
  chips: [
    { label: 'Environmental Protection Agency', variant: 'accent' },
    { label: 'Proposed Rule Stage' },
    { label: '2060-AW83', variant: 'code' },
  ],
  title: 'Amendments to the Heavy-Duty Highway Engine Criteria Pollutant Program',
  href: 'https://www.reginfo.gov/public/do/eAgendaViewRule?pubId=202510&RIN=2060-AW83',
  metaRight: 'Next action Mar 1, 2027',
  linkLabel: 'reginfo.gov',
};

describe('MiniSourceCard', () => {
  it('renders the whole card as an external link with clamped chip strip', () => {
    render(<MiniSourceCard card={CARD} />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', CARD.href);
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');

    // maxChips defaults to 2: the third (code) chip is dropped.
    expect(screen.getByText('Environmental Protection Agency')).toBeInTheDocument();
    expect(screen.getByText('Proposed Rule Stage')).toBeInTheDocument();
    expect(screen.queryByText('2060-AW83')).not.toBeInTheDocument();

    expect(screen.getByText(/Heavy-Duty Highway Engine/)).toBeInTheDocument();
    expect(screen.getByText('Next action Mar 1, 2027')).toBeInTheDocument();
  });

  it('honors a custom maxChips', () => {
    render(<MiniSourceCard card={CARD} maxChips={3} />);
    expect(screen.getByText('2060-AW83')).toBeInTheDocument();
  });

  it('renders without a link when href is null', () => {
    render(<MiniSourceCard card={{ ...CARD, href: null }} />);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByText(/Heavy-Duty Highway Engine/)).toBeInTheDocument();
  });
});
