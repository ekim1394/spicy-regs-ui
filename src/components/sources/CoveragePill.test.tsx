import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import { CoveragePill } from './CoveragePill';

describe('CoveragePill', () => {
  it('renders the default "partial" label with the reason as tooltip', () => {
    render(<CoveragePill reason="Top ~100K recipients by award amount" />);
    const pill = screen.getByText('partial');
    expect(pill).toHaveAttribute('title', 'Top ~100K recipients by award amount');
  });

  it('accepts a custom label and stays neutral (not the amber demo family)', () => {
    render(<CoveragePill label="sampled" reason="why" />);
    const pill = screen.getByText('sampled');
    expect(pill.getAttribute('style')).not.toContain('accent-amber');
    expect(pill.getAttribute('style')).toContain('--muted');
  });
});
