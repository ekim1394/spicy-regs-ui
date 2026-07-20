import { describe, it, expect } from 'vitest';

import {
  agendaEditionLabel,
  billLabel,
  cfrCitation,
  congressBillUrl,
  crsReportUrl,
  fecCommitteeUrl,
  filingPeriodLabel,
  formatDate,
  formatMonthYear,
  formatUSDCompact,
  ordinal,
  recipientLevelLabel,
  stripNatureOfSuitCode,
  trimGaoAbstract,
  usaspendingRecipientUrl,
} from './format';

describe('formatDate', () => {
  it('formats ISO dates', () => {
    expect(formatDate('2026-07-16')).toBe('Jul 16, 2026');
  });
  it('formats timestamps with timezone offsets', () => {
    expect(formatDate('2026-04-20T15:03:53-04:00')).toMatch(/Apr (20|21), 2026/);
  });
  it('rejects the Unified Agenda year-3000 TBD sentinel', () => {
    expect(formatDate('3000-04-01')).toBeNull();
  });
  it('handles null/empty/garbage', () => {
    expect(formatDate(null)).toBeNull();
    expect(formatDate('')).toBeNull();
    expect(formatDate('not a date')).toBeNull();
  });
  it('does not shift a date-only string backward a day', () => {
    // ISO date-only parses as UTC midnight; UTC formatting keeps the day.
    expect(formatDate('2026-01-01')).toBe('Jan 1, 2026');
  });
});

describe('formatMonthYear', () => {
  it('formats month + year', () => {
    expect(formatMonthYear('2025-04-02')).toBe('Apr 2025');
  });
  it('rejects sentinels and nulls', () => {
    expect(formatMonthYear('3000-04-01')).toBeNull();
    expect(formatMonthYear(null)).toBeNull();
  });
});

describe('formatUSDCompact', () => {
  it('compacts billions', () => {
    expect(formatUSDCompact('117118169550.28')).toBe('$117.1B');
  });
  it('compacts thousands', () => {
    expect(formatUSDCompact('30000.00')).toBe('$30K');
  });
  it('handles null and garbage', () => {
    expect(formatUSDCompact(null)).toBeNull();
    expect(formatUSDCompact('n/a')).toBeNull();
  });
});

describe('ordinal', () => {
  it('covers teens and standard suffixes', () => {
    expect(ordinal(119)).toBe('119th');
    expect(ordinal(111)).toBe('111th');
    expect(ordinal(112)).toBe('112th');
    expect(ordinal(113)).toBe('113th');
    expect(ordinal(121)).toBe('121st');
    expect(ordinal(122)).toBe('122nd');
    expect(ordinal(123)).toBe('123rd');
  });
});

describe('congressBillUrl', () => {
  it('builds the human congress.gov page (not the API url)', () => {
    expect(congressBillUrl('119', 'hr', '2573')).toBe(
      'https://www.congress.gov/bill/119th-congress/house-bill/2573',
    );
    expect(congressBillUrl('118', 'sjres', '5')).toBe(
      'https://www.congress.gov/bill/118th-congress/senate-joint-resolution/5',
    );
  });
  it('returns null for unknown types or missing parts', () => {
    expect(congressBillUrl('119', 'xyz', '1')).toBeNull();
    expect(congressBillUrl(null, 'hr', '1')).toBeNull();
    expect(congressBillUrl('119', 'hr', null)).toBeNull();
  });
});

describe('billLabel', () => {
  it('maps known types', () => {
    expect(billLabel('hr', '2573')).toBe('H.R. 2573');
    expect(billLabel('hconres', '12')).toBe('H.Con.Res. 12');
  });
  it('falls back to uppercased raw type', () => {
    expect(billLabel('xyz', '9')).toBe('XYZ 9');
  });
});

describe('constructed external URLs', () => {
  it('crs / fec / usaspending', () => {
    expect(crsReportUrl('R48641')).toBe('https://www.congress.gov/crs-product/R48641');
    expect(fecCommitteeUrl('C00006080')).toBe('https://www.fec.gov/data/committee/C00006080/');
    expect(usaspendingRecipientUrl('7fe0d08f-R')).toBe(
      'https://www.usaspending.gov/recipient/7fe0d08f-R/latest',
    );
    expect(crsReportUrl(null)).toBeNull();
    expect(fecCommitteeUrl(null)).toBeNull();
    expect(usaspendingRecipientUrl(null)).toBeNull();
  });
});

describe('cfrCitation', () => {
  it('renders section rows ("part-section" shape)', () => {
    expect(cfrCitation('1', null, '10-1')).toBe('1 CFR § 10.1');
  });
  it('renders part-level rows', () => {
    expect(cfrCitation('20', '655', null)).toBe('20 CFR Part 655');
  });
  it('renders title-only rows and missing titles', () => {
    expect(cfrCitation('40', null, null)).toBe('Title 40 CFR');
    expect(cfrCitation(null, '655', null)).toBeNull();
  });
});

describe('trimGaoAbstract', () => {
  it('strips the boilerplate heading', () => {
    expect(trimGaoAbstract('What GAO Found\n\nThe Navy is 24 months behind.')).toBe(
      'The Navy is 24 months behind.',
    );
  });
  it('leaves plain abstracts alone and nulls empty results', () => {
    expect(trimGaoAbstract('Plain teaser.')).toBe('Plain teaser.');
    expect(trimGaoAbstract('What GAO Found')).toBeNull();
    expect(trimGaoAbstract(null)).toBeNull();
  });
});

describe('stripNatureOfSuitCode', () => {
  it('drops the numeric PACER prefix', () => {
    expect(stripNatureOfSuitCode('899 Other Statutes: APA Review')).toBe(
      'Other Statutes: APA Review',
    );
  });
  it('passes through unprefixed values', () => {
    expect(stripNatureOfSuitCode('Other Statutes')).toBe('Other Statutes');
    expect(stripNatureOfSuitCode(null)).toBeNull();
  });
});

describe('small label maps', () => {
  it('recipientLevelLabel', () => {
    expect(recipientLevelLabel('R')).toBe('Recipient');
    expect(recipientLevelLabel('P')).toBe('Parent');
    expect(recipientLevelLabel('C')).toBe('Child');
    expect(recipientLevelLabel('z')).toBe('z');
    expect(recipientLevelLabel(null)).toBeNull();
  });
  it('filingPeriodLabel', () => {
    expect(filingPeriodLabel('first_quarter')).toBe('Q1');
    expect(filingPeriodLabel('year_end')).toBe('Year-end');
    expect(filingPeriodLabel('unknown_thing')).toBe('unknown_thing');
  });
  it('agendaEditionLabel', () => {
    expect(agendaEditionLabel('202510')).toBe('Fall 2025');
    expect(agendaEditionLabel('202604')).toBe('Spring 2026');
    expect(agendaEditionLabel('garbled')).toBe('garbled');
    expect(agendaEditionLabel(null)).toBeNull();
  });
});
