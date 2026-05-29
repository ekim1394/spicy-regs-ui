import { describe, it, expect } from 'vitest';
import {
  toDisplay,
  toCanonical,
  toSkeleton,
  toTokenSet,
  isPlaceholder,
  normalizeComment,
  sqlTokenSetKey,
  sqlSkeletonFinal,
} from './normalize';

describe('toDisplay', () => {
  it('strips tags, decodes entities, collapses whitespace', () => {
    expect(toDisplay('<p>Hello&nbsp;&amp; welcome</p>')).toBe('Hello & welcome');
    expect(toDisplay('a<br>b<br/>c')).toBe('a b c');
    expect(toDisplay('  lots   of\n\n space ')).toBe('lots of space');
  });

  it('unwraps quoted parquet values and tolerates null', () => {
    expect(toDisplay('"quoted"')).toBe('quoted');
    expect(toDisplay(null)).toBe('');
  });
});

describe('toCanonical', () => {
  it('lowercases and removes punctuation but keeps digits', () => {
    expect(toCanonical('Section 508 — Really?!')).toBe('section 508 really');
  });
});

describe('toSkeleton', () => {
  it('collapses signature variants into one template key', () => {
    const body = 'I strongly oppose this rule. Sincerely, ';
    const a = toSkeleton(body + 'Jane Doe of Acme Corp', { firstName: 'Jane', lastName: 'Doe', organization: 'Acme Corp' });
    const b = toSkeleton(body + 'Robert Smith of Globex', { firstName: 'Robert', lastName: 'Smith', organization: 'Globex' });
    expect(a).toBe(b);
    expect(a).not.toContain('jane');
  });

  it('drops digits, zips, emails, and urls', () => {
    const s = toSkeleton('Comment from 90210, see http://x.com or me@x.com — 12 points');
    expect(s).not.toMatch(/[0-9]/);
    expect(s).not.toContain('http');
    expect(s).not.toContain('@');
  });
});

describe('toTokenSet', () => {
  it('is order-independent and de-duplicated', () => {
    expect(toTokenSet('protect the the workers please')).toBe(toTokenSet('please workers protect the'));
  });

  it('drops tokens of length <= 2', () => {
    expect(toTokenSet('we go to the park')).toBe('park the');
  });
});

describe('isPlaceholder', () => {
  it('flags blank, short, and see-attached comments', () => {
    expect(isPlaceholder('')).toBe(true);
    expect(isPlaceholder('See attached.')).toBe(true);
    expect(isPlaceholder('See attached file')).toBe(true);
    expect(isPlaceholder('I strongly oppose this proposed rule for many reasons.')).toBe(false);
  });
});

describe('normalizeComment', () => {
  it('reports structure flags, link and word counts', () => {
    const n = normalizeComment(
      '<p>Dear Administrator, I support this. Visit www.example.com. Sincerely,</p>',
    );
    expect(n.hasGreeting).toBe(true);
    expect(n.hasSignature).toBe(true);
    expect(n.linkCount).toBe(1);
    expect(n.wordCount).toBeGreaterThan(0);
  });
});

describe('sql builders', () => {
  it('emit DuckDB list/regex expressions referencing the input column', () => {
    expect(sqlTokenSetKey('skeleton')).toContain('list_sort');
    expect(sqlTokenSetKey('skeleton')).toContain('string_split(skeleton');
    expect(sqlSkeletonFinal('s3')).toContain('regexp_replace(s3');
  });
});
