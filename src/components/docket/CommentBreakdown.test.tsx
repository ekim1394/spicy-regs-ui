import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';
import '@testing-library/jest-dom/vitest';

import { TemplateCard, formatDayRange } from './CommentBreakdown';
import type { TemplateFamily } from '@/lib/comments/templates';

describe('formatDayRange', () => {
  it('collapses a single day', () => {
    expect(formatDayRange('2026-05-27', '2026-05-27')).toBe('May 27, 2026');
  });
  it('collapses a same-month span to one month + year', () => {
    expect(formatDayRange('2026-05-27', '2026-05-29')).toBe('May 27–29, 2026');
  });
  it('keeps both months for a same-year span', () => {
    expect(formatDayRange('2026-05-27', '2026-06-02')).toBe('May 27 – Jun 2, 2026');
  });
  it('keeps full dates across a year boundary', () => {
    expect(formatDayRange('2026-12-30', '2027-01-02')).toBe('Dec 30, 2026 – Jan 2, 2027');
  });
});

// A body long enough that the card excerpt (220-char cap) drops the tail, and
// carrying HTML + paragraph breaks so we can prove the modal cleans & preserves.
const TAIL = 'CLOSING_SENTINEL_ONLY_IN_FULL_TEXT.';
const BODY =
  'As a member of the American Society of Radiologic Technologists, I respectfully submit this public comment to the Office of Management and Budget regarding the proposed Standard Occupational Classification.<br><br>' +
  'I urge the establishment of a distinct SOC code. '.repeat(6) +
  TAIL;

const family: TemplateFamily = {
  id: 'hash-rep',
  representative: { hash: 'hash-rep', n: 98256, sample: BODY, firstDay: '2024-08-09', lastDay: '2024-08-14' },
  members: [{ hash: 'hash-rep', n: 98256, sample: BODY, firstDay: '2024-08-09', lastDay: '2024-08-14' }],
  totalN: 98256,
  sharePct: 87.9,
  variantCount: 7,
  firstDay: '2024-08-09',
  lastDay: '2024-08-14',
};

describe('TemplateCard full-text modal', () => {
  it('hides the tail in the card and reveals the full text on click', async () => {
    const user = userEvent.setup();
    render(<TemplateCard family={family} rank={1} />);

    // The card shows a truncated excerpt — the closing sentence is not present yet.
    expect(screen.queryByText(new RegExp(TAIL))).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /read full text of template #1/i }));

    // Dialog opens with the complete, cleaned body (HTML stripped, tail present).
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent(TAIL);
    expect(dialog).not.toHaveTextContent('<br>');
    expect(dialog).toHaveTextContent('Form-letter template #1');
  });

  it('leads the card with the share and humanizes the date window', () => {
    render(<TemplateCard family={family} rank={1} />);
    // Share is the headline metric; the count survives as quiet detail.
    expect(screen.getByText('87.9%')).toBeInTheDocument();
    expect(screen.getByText(/98,256 comments/)).toBeInTheDocument();
    // Dates are humanized + collapsed, not raw ISO.
    expect(screen.getByText(/Aug 9–14, 2024/)).toBeInTheDocument();
    expect(screen.queryByText(/2024-08-09/)).not.toBeInTheDocument();
  });

  it('closes on the close button', async () => {
    const user = userEvent.setup();
    render(<TemplateCard family={family} rank={1} />);

    await user.click(screen.getByRole('button', { name: /read full text/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /close/i }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
