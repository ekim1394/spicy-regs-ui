import { describe, it, expect } from 'vitest';

import {
  buildAgendaForDocketQuery,
  buildLitigationForAgencyQuery,
  buildSourceQuery,
  buildStatsQuery,
  sourceRef,
} from './query';
import { SOURCES, getSource } from './registry';

const BASE = 'https://r2.example.dev';

const bills = getSource('congress-bills')!;
const courts = getSource('court-dockets')!;

describe('sourceRef', () => {
  it('builds a read_parquet reference', () => {
    expect(sourceRef('gao_reports', BASE)).toBe(
      "read_parquet('https://r2.example.dev/gao_reports.parquet')",
    );
  });
});

describe('buildSourceQuery', () => {
  it('default query: no WHERE, default sort + tiebreak, offset 0', () => {
    const sql = buildSourceQuery(bills, BASE, { limit: 20, offset: 0 });
    expect(sql).not.toContain('WHERE');
    expect(sql).toContain('ORDER BY latest_action_date DESC NULLS LAST, bill_id ASC');
    expect(sql).toContain('LIMIT 20 OFFSET 0');
    expect(sql).toContain(`read_parquet('${BASE}/congress_bills.parquet')`);
  });

  it('search ORs the searchFields and escapes quotes', () => {
    const sql = buildSourceQuery(bills, BASE, {
      search: "farmer's market",
      limit: 20,
      offset: 0,
    });
    expect(sql).toContain("title ILIKE '%farmer''s market%' ESCAPE '\\'");
    expect(sql).toContain("bill_id ILIKE '%farmer''s market%' ESCAPE '\\'");
    expect(sql).not.toContain("farmer's"); // raw quote never reaches SQL
  });

  it('escapes LIKE wildcards so user text matches literally', () => {
    const sql = buildSourceQuery(bills, BASE, {
      search: 'a_b 50% \\x',
      limit: 20,
      offset: 0,
    });
    expect(sql).toContain("ILIKE '%a\\_b 50\\% \\\\x%' ESCAPE '\\'");
  });

  it('applies declared filter values as equality predicates', () => {
    const sql = buildSourceQuery(bills, BASE, {
      filterValues: { congress: '118', chamber: 'House' },
      limit: 20,
      offset: 0,
    });
    expect(sql).toContain("congress = '118'");
    expect(sql).toContain("origin_chamber = 'House'");
  });

  it('drops filter values not declared in the registry (URL tampering)', () => {
    const sql = buildSourceQuery(bills, BASE, {
      filterValues: { congress: "118' OR 1=1 --" },
      limit: 20,
      offset: 0,
    });
    expect(sql).not.toContain('OR 1=1');
    expect(sql).not.toContain('WHERE');
  });

  it('uses per-option WHERE overrides (derived filters)', () => {
    const sql = buildSourceQuery(courts, BASE, {
      filterValues: { status: 'open' },
      limit: 20,
      offset: 0,
    });
    expect(sql).toContain('date_terminated IS NULL');
    expect(sql).not.toContain("date_terminated = 'open'");
  });

  it('falls back to the default sort for unknown sort keys', () => {
    const sql = buildSourceQuery(bills, BASE, {
      sortKey: 'bogus',
      limit: 20,
      offset: 0,
    });
    expect(sql).toContain('ORDER BY latest_action_date DESC NULLS LAST');
  });

  it('floors non-integer limit/offset', () => {
    const sql = buildSourceQuery(bills, BASE, { limit: 20.9, offset: 10.5 });
    expect(sql).toContain('LIMIT 20 OFFSET 10');
  });
});

describe('buildAgendaForDocketQuery', () => {
  const agenda = getSource('unified-agenda')!;

  it('chains fr_docket_links RINs → latest agenda edition without scanning Federal Register', () => {
    const sql = buildAgendaForDocketQuery(agenda, 'EPA-HQ-OAR-2026-0728', BASE, 5);
    expect(sql).toContain(`read_parquet('${BASE}/fr_docket_links.parquet')`);
    expect(sql).toContain("WHERE docket_id = 'EPA-HQ-OAR-2026-0728'");
    expect(sql).toContain('regulation_id_numbers_json');
    expect(sql).not.toContain(`read_parquet('${BASE}/federal_register.parquet')`);
    expect(sql).toContain(`read_parquet('${BASE}/unified_agenda.parquet')`);
    expect(sql).toContain('QUALIFY ROW_NUMBER() OVER (PARTITION BY rin ORDER BY agenda_edition DESC) = 1');
    expect(sql).toContain('LIMIT 5');
  });

  it('escapes quotes in the docket id', () => {
    const sql = buildAgendaForDocketQuery(agenda, "EPA'; DROP TABLE x --", BASE, 5);
    expect(sql).toContain("EPA''; DROP TABLE x --");
    expect(sql).not.toContain("EPA';");
  });
});

describe('buildLitigationForAgencyQuery', () => {
  const courtsDef = getSource('court-dockets')!;

  it('substring-matches the full agency name, newest filings first', () => {
    const sql = buildLitigationForAgencyQuery(
      courtsDef,
      'Environmental Protection Agency',
      BASE,
      4,
    );
    expect(sql).toContain("case_name ILIKE '%Environmental Protection Agency%'");
    expect(sql).toContain('ORDER BY date_filed DESC NULLS LAST, cl_docket_id ASC');
    expect(sql).toContain('LIMIT 4');
  });

  it('escapes quotes in the agency name', () => {
    const sql = buildLitigationForAgencyQuery(courtsDef, "O'Brien Agency", BASE, 4);
    expect(sql).toContain("O''Brien Agency");
  });
});

describe('buildStatsQuery', () => {
  it('unions one COUNT branch per entry, casting latest to VARCHAR', () => {
    const sql = buildStatsQuery(
      [
        { table: 'gao_reports', recencyExpr: 'MAX(published_date)' },
        { table: 'usaspending_recipients', recencyExpr: null },
      ],
      BASE,
    );
    expect(sql).toContain("'gao_reports' AS tbl");
    expect(sql).toContain('CAST(MAX(published_date) AS VARCHAR)');
    expect(sql).toContain('CAST(NULL AS VARCHAR)');
    expect(sql.match(/UNION ALL/g)).toHaveLength(1);
  });
});

describe('registry integrity', () => {
  it('every source has a unique key and table', () => {
    const keys = SOURCES.map((s) => s.key);
    const tables = SOURCES.map((s) => s.table);
    expect(new Set(keys).size).toBe(SOURCES.length);
    expect(new Set(tables).size).toBe(SOURCES.length);
  });

  it('defaultSort always resolves to a sort option', () => {
    for (const s of SOURCES) {
      expect(s.sortOptions.some((o) => o.key === s.defaultSort), s.key).toBe(true);
    }
  });

  it('every source declares a pagination tiebreak', () => {
    for (const s of SOURCES) {
      expect(s.tiebreak, s.key).toMatch(/ASC|DESC/);
    }
  });

  it('every filter has an "all" option and unique params', () => {
    for (const s of SOURCES) {
      const params = s.filters.map((f) => f.param);
      expect(new Set(params).size).toBe(params.length);
      for (const f of s.filters) {
        expect(f.options.some((o) => o.value === ''), `${s.key}:${f.param}`).toBe(true);
      }
    }
  });

  it('toCard tolerates a row of all nulls', () => {
    for (const s of SOURCES) {
      const emptyRow = new Proxy({}, { get: () => null });
      const card = s.toCard(emptyRow as Record<string, string | null>);
      expect(typeof card.title, s.key).toBe('string');
      expect(card.title.length, s.key).toBeGreaterThan(0);
      expect(Array.isArray(card.chips), s.key).toBe(true);
    }
  });

  it('toCard maps a representative live row per source', () => {
    // Rows abridged from live R2 sampling (2026-07-19).
    const bill = getSource('congress-bills')!.toCard({
      bill_id: '119-hr-2573',
      congress: '119',
      bill_type: 'hr',
      bill_number: '2573',
      title: 'LIZARD Act of 2025',
      origin_chamber: 'House',
      latest_action_date: '2025-04-01',
      latest_action_text: 'Referred to the House Committee on Natural Resources.',
    });
    expect(bill.href).toBe('https://www.congress.gov/bill/119th-congress/house-bill/2573');
    expect(bill.chips.map((c) => c.label)).toContain('H.R. 2573');
    expect(bill.chips.map((c) => c.label)).toContain('119th Congress');

    const suit = getSource('court-dockets')!.toCard({
      cl_docket_id: '73626395',
      case_name: 'Kinston Fish & Oyster Inc. v. United States',
      court: 'District Court, E.D. North Carolina',
      docket_number: '4:26-cv-00122',
      date_filed: '2026-07-16',
      date_terminated: null,
      nature_of_suit: '899 Other Statutes: Administrative Procedures Act',
      cause: null,
      assigned_to: null,
      absolute_url: 'https://www.courtlistener.com/docket/73626395/kinston/',
    });
    expect(suit.chips[0].label).toBe('Pending');
    expect(suit.body).toBe('Other Statutes: Administrative Procedures Act');
    expect(suit.metaRight).toBe('Filed Jul 16, 2026');

    const filing = getSource('lobbying')!.toCard({
      filing_uuid: 'aec25a9b',
      filing_type: 'Q1',
      filing_year: '2026',
      filing_period: 'first_quarter',
      dt_posted: '2026-04-20T15:03:53-04:00',
      registrant_name: 'STRATEGIC POLICY COUNSEL PLLC',
      client_name: 'LAWYERS FOR CIVIL JUSTICE',
      income: '30000.00',
      expenses: null,
      url: 'https://lda.senate.gov/filings/public/filing/aec25a9b/print/',
      first_activity: 'Issues related to civil justice.',
    });
    expect(filing.title).toBe('LAWYERS FOR CIVIL JUSTICE');
    expect(filing.chips.map((c) => c.label)).toContain('Q1 2026');
    expect(filing.chips.map((c) => c.label)).toContain('$30K');
    expect(filing.metaLeft).toContain('STRATEGIC POLICY COUNSEL');

    const cfr = getSource('cfr-sections')!.toCard({
      granule_id: 'CFR-2025-title1-vol1-sec10-1',
      title: '1',
      part: null,
      section: '10-1',
      heading: 'Publication required.',
      edition_year: '2025',
      url: 'https://www.govinfo.gov/app/details/CFR-2025-title1-vol1-sec10-1',
    });
    expect(cfr.chips[0].label).toBe('1 CFR § 10.1');

    const gao = getSource('gao-reports')!.toCard({
      report_id: 'gao-26-107974',
      title: 'Navy Ship Modernization',
      abstract: 'What GAO Found\n\nThe Navy is currently 24 months behind.',
      published_date: '2026-07-17',
      url: 'https://www.gao.gov/products/gao-26-107974',
    });
    expect(gao.body).toBe('The Navy is currently 24 months behind.');
    expect(gao.chips[0].label).toBe('GAO-26-107974');
  });
});
