import {
  BookOpen,
  Building2,
  CalendarClock,
  CircleDollarSign,
  FileSearch,
  Gavel,
  Handshake,
  Landmark,
  Newspaper,
  ScrollText,
  Vote,
  type LucideIcon,
} from 'lucide-react';

import type { SourceCategory, SourceDef } from './types';
import {
  agendaEditionLabel,
  billLabel,
  cfrCitation,
  congressBillUrl,
  crsReportUrl,
  fecCommitteeUrl,
  filingPeriodLabel,
  formatDate,
  formatUSDCompact,
  ordinal,
  recipientLevelLabel,
  stripNatureOfSuitCode,
  trimGaoAbstract,
  usaspendingRecipientUrl,
} from './format';

/** Display metadata for the index page's category shelves, in display order. */
export const CATEGORY_META: Record<SourceCategory, { label: string; blurb: string }> = {
  lifecycle: {
    label: 'Rulemaking Lifecycle',
    blurb: 'What agencies plan, publish, and codify — the arc of a regulation.',
  },
  influence: {
    label: 'Organizations & Influence',
    blurb: 'Who shows up around rulemakings — registrants, lobbying, and money.',
  },
  oversight: {
    label: 'Oversight & Outcomes',
    blurb: 'What happens after the rule — litigation, audits, and spending.',
  },
};

export const CATEGORY_ORDER: SourceCategory[] = ['lifecycle', 'influence', 'oversight'];

/**
 * Index-page entry for the Federal Register, which already has its own
 * dedicated browse surfaces (the feed's FR toggle and /federal-register).
 * Listed on the index for completeness; not a /sources/[source] route.
 */
export const FEDERAL_REGISTER_ENTRY = {
  key: 'federal-register',
  table: 'federal_register',
  label: 'Federal Register',
  description:
    'Rules, proposed rules, notices, and presidential documents published in the Federal Register since 2000.',
  category: 'lifecycle' as SourceCategory,
  provider: 'federalregister.gov',
  icon: Newspaper as LucideIcon,
  href: '/federal-register',
  recencyExpr: 'MAX(publication_date)',
};

/**
 * The registry: every external dataset browsable at /sources/[key]. All
 * per-source knowledge — SQL projection, sorts, filters, card mapping — lives
 * here so the route, query hook, and card component stay generic.
 *
 * Data-shape notes baked into these defs were verified against live R2 data
 * (2026-07-19): all columns are VARCHAR; some `url` columns are API endpoints
 * (congress_bills, crs_reports) so human links are constructed; fec_committees
 * and usaspending_recipients have no url column at all.
 */
export const SOURCES: SourceDef[] = [
  // ── Rulemaking Lifecycle ────────────────────────────────────────────────
  {
    key: 'unified-agenda',
    table: 'unified_agenda',
    label: 'Unified Agenda',
    description:
      'The rulemakings agencies plan to pursue, from the OIRA semiannual Unified Agenda — the forward-looking counterpart to what gets published.',
    category: 'lifecycle',
    provider: 'reginfo.gov',
    caveat: 'Single edition snapshot (Fall 2025)',
    icon: CalendarClock,
    selectCols:
      'rin, title, abstract, agency_name, rin_status, rule_stage, priority_category, agenda_edition, next_action_date, url',
    searchFields: ['title', 'abstract', 'rin', 'agency_name'],
    tiebreak: 'rin ASC, agenda_edition ASC',
    defaultSort: 'next-action',
    sortOptions: [
      {
        key: 'next-action',
        label: 'Next action',
        // The agenda uses year-3000 dates as a "To Be Determined" sentinel;
        // fold those into the NULLS LAST bucket instead of ranking them first.
        orderBy:
          "CASE WHEN next_action_date >= '2999' THEN NULL ELSE next_action_date END DESC NULLS LAST",
      },
      { key: 'title', label: 'Title A–Z', orderBy: 'title ASC' },
    ],
    filters: [
      {
        param: 'stage',
        label: 'Stage',
        field: 'rule_stage',
        options: [
          { value: '', label: 'All stages' },
          { value: 'Prerule Stage', label: 'Prerule' },
          { value: 'Proposed Rule Stage', label: 'Proposed Rule' },
          { value: 'Final Rule Stage', label: 'Final Rule' },
          { value: 'Long-Term Actions', label: 'Long-Term' },
          { value: 'Completed Actions', label: 'Completed' },
        ],
      },
    ],
    recencyExpr: 'MAX(agenda_edition)',
    formatRecency: (raw) => agendaEditionLabel(raw) ?? raw,
    toCard: (row) => ({
      id: `${row.rin}-${row.agenda_edition}`,
      chips: [
        row.agency_name ? { label: row.agency_name, variant: 'accent' as const } : null,
        row.rule_stage ? { label: row.rule_stage } : null,
        row.rin ? { label: row.rin, variant: 'code' as const } : null,
      ].filter((c) => c !== null),
      title: row.title ?? '(untitled rulemaking)',
      href: row.url,
      body: row.abstract,
      metaLeft: row.priority_category,
      metaRight: formatDate(row.next_action_date)
        ? `Next action ${formatDate(row.next_action_date)}`
        : null,
      linkLabel: 'reginfo.gov',
    }),
  },
  {
    key: 'congress-bills',
    table: 'congress_bills',
    label: 'Congress Bills',
    description:
      'Congressional bills from the Congress.gov API — the legislative record that authorizes and reshapes the rulemakings this corpus tracks.',
    category: 'lifecycle',
    provider: 'Congress.gov',
    caveat: 'List-level bill metadata only',
    icon: Landmark,
    selectCols:
      'bill_id, congress, bill_type, bill_number, title, origin_chamber, latest_action_date, latest_action_text',
    searchFields: ['title', 'bill_id'],
    tiebreak: 'bill_id ASC',
    defaultSort: 'recent',
    sortOptions: [
      { key: 'recent', label: 'Latest action', orderBy: 'latest_action_date DESC NULLS LAST' },
      { key: 'oldest', label: 'Oldest', orderBy: 'latest_action_date ASC NULLS LAST' },
    ],
    filters: [
      {
        param: 'congress',
        label: 'Congress',
        field: 'congress',
        options: [
          { value: '', label: 'All congresses' },
          { value: '119', label: '119th (2025–26)' },
          { value: '118', label: '118th (2023–24)' },
          { value: '117', label: '117th (2021–22)' },
          { value: '116', label: '116th (2019–20)' },
        ],
      },
      {
        param: 'chamber',
        label: 'Chamber',
        field: 'origin_chamber',
        options: [
          { value: '', label: 'Both chambers' },
          { value: 'House', label: 'House' },
          { value: 'Senate', label: 'Senate' },
        ],
      },
    ],
    recencyExpr: 'MAX(latest_action_date)',
    toCard: (row) => ({
      id: row.bill_id ?? '',
      chips: [
        billLabel(row.bill_type, row.bill_number)
          ? { label: billLabel(row.bill_type, row.bill_number)!, variant: 'code' as const }
          : null,
        row.congress && Number.isInteger(Number(row.congress))
          ? { label: `${ordinal(Number(row.congress))} Congress` }
          : null,
        row.origin_chamber ? { label: row.origin_chamber } : null,
      ].filter((c) => c !== null),
      title: row.title || '(untitled bill)',
      href: congressBillUrl(row.congress, row.bill_type, row.bill_number),
      body: row.latest_action_text,
      metaRight: formatDate(row.latest_action_date)
        ? `Latest action ${formatDate(row.latest_action_date)}`
        : null,
      linkLabel: 'congress.gov',
    }),
  },
  {
    key: 'cfr-sections',
    table: 'cfr_sections',
    label: 'CFR Sections',
    description:
      'Section-level structure of the Code of Federal Regulations — where finalized rules land, keyed by the citations rulemakings reference.',
    category: 'lifecycle',
    provider: 'GovInfo',
    caveat: '2025 annual edition; headings only, no section text',
    icon: BookOpen,
    selectCols: 'granule_id, title, part, section, heading, edition_year, url',
    searchFields: ['heading', 'cfr_ref'],
    tiebreak: 'granule_id ASC',
    defaultSort: 'citation',
    sortOptions: [
      {
        key: 'citation',
        label: 'Citation order',
        orderBy: `TRY_CAST(title AS INTEGER) ASC NULLS LAST,
          TRY_CAST(split_part(COALESCE(section, part), '-', 1) AS INTEGER) ASC NULLS LAST,
          TRY_CAST(split_part(section, '-', 2) AS INTEGER) ASC NULLS LAST`,
      },
      { key: 'recent', label: 'Recently modified', orderBy: 'last_modified DESC NULLS LAST' },
    ],
    filters: [],
    recencyExpr: 'MAX(last_modified)',
    toCard: (row) => ({
      id: row.granule_id ?? '',
      chips: [
        cfrCitation(row.title, row.part, row.section)
          ? { label: cfrCitation(row.title, row.part, row.section)!, variant: 'code' as const }
          : null,
        row.edition_year ? { label: `${row.edition_year} edition` } : null,
      ].filter((c) => c !== null),
      title: row.heading || '(untitled granule)',
      href: row.url,
      metaRight: null,
      linkLabel: 'govinfo.gov',
    }),
  },

  // ── Organizations & Influence ───────────────────────────────────────────
  {
    key: 'sam-entities',
    table: 'sam_entities',
    label: 'SAM Entities',
    description:
      'Organizations registered in SAM.gov to do business with the federal government — the entity-resolution backbone (UEI) for commenters and awardees.',
    category: 'influence',
    provider: 'SAM.gov',
    caveat: 'Active public registrations only',
    icon: Building2,
    selectCols:
      'uei, legal_business_name, dba_name, city, state, primary_naics, registration_date, registration_expiration_date, entity_url',
    searchFields: ['legal_business_name', 'dba_name', 'uei', 'city'],
    tiebreak: 'uei ASC',
    defaultSort: 'recent',
    sortOptions: [
      { key: 'recent', label: 'Recently registered', orderBy: 'registration_date DESC NULLS LAST' },
      { key: 'name', label: 'Name A–Z', orderBy: 'legal_business_name ASC' },
    ],
    filters: [],
    recencyExpr: 'MAX(registration_date)',
    toCard: (row) => {
      const location = [row.city, row.state].filter(Boolean).join(', ');
      return {
        id: row.uei ?? '',
        chips: [
          location ? { label: location } : null,
          row.primary_naics ? { label: `NAICS ${row.primary_naics}` } : null,
          row.uei ? { label: row.uei, variant: 'code' as const } : null,
        ].filter((c) => c !== null),
        title: row.legal_business_name || '(unnamed entity)',
        href: row.entity_url,
        metaLeft: row.dba_name ? `d/b/a ${row.dba_name}` : null,
        metaRight: formatDate(row.registration_date)
          ? `Registered ${formatDate(row.registration_date)}`
          : null,
        linkLabel: row.entity_url ? 'website' : null,
      };
    },
  },
  {
    key: 'lobbying',
    table: 'lobbying_filings',
    label: 'Lobbying Filings',
    description:
      'Federal lobbying disclosures filed under the Lobbying Disclosure Act — who is paying whom to lobby, on what issues.',
    category: 'influence',
    provider: 'Senate LDA',
    caveat: 'Filings from 2024 onward',
    icon: Handshake,
    selectCols: `filing_uuid, filing_type, filing_year, filing_period, dt_posted,
      registrant_name, client_name, income, expenses, url,
      json_extract_string(lobbying_activities_json, '$[0].description') AS first_activity`,
    searchFields: ['client_name', 'registrant_name'],
    tiebreak: 'filing_uuid ASC',
    defaultSort: 'recent',
    sortOptions: [
      {
        key: 'recent',
        label: 'Recently posted',
        // dt_posted carries mixed timezone offsets, so lexical order is not
        // reliable — cast to TIMESTAMP for a true recency sort.
        orderBy: 'TRY_CAST(dt_posted AS TIMESTAMP) DESC NULLS LAST',
      },
    ],
    filters: [
      {
        param: 'year',
        label: 'Year',
        field: 'filing_year',
        options: [
          { value: '', label: 'All years' },
          { value: '2026', label: '2026' },
          { value: '2025', label: '2025' },
          { value: '2024', label: '2024' },
        ],
      },
      {
        param: 'period',
        label: 'Period',
        field: 'filing_period',
        options: [
          { value: '', label: 'All periods' },
          { value: 'first_quarter', label: 'Q1' },
          { value: 'second_quarter', label: 'Q2' },
          { value: 'third_quarter', label: 'Q3' },
          { value: 'fourth_quarter', label: 'Q4' },
        ],
      },
    ],
    recencyExpr: 'MAX(dt_posted)',
    toCard: (row) => {
      // A filing reports income (firms) or expenses (self-filers), rarely both.
      const money = formatUSDCompact(row.income) ?? formatUSDCompact(row.expenses);
      const period = [filingPeriodLabel(row.filing_period), row.filing_year]
        .filter(Boolean)
        .join(' ');
      return {
        id: row.filing_uuid ?? '',
        chips: [
          period ? { label: period } : null,
          money ? { label: money, variant: 'accent' as const } : null,
        ].filter((c) => c !== null),
        title: row.client_name || '(unnamed client)',
        href: row.url,
        body: row.first_activity,
        metaLeft: row.registrant_name ? `via ${row.registrant_name}` : null,
        metaRight: formatDate(row.dt_posted) ? `Posted ${formatDate(row.dt_posted)}` : null,
        linkLabel: 'lda.senate.gov',
      };
    },
  },
  {
    key: 'fec-committees',
    table: 'fec_committees',
    label: 'FEC Committees',
    description:
      'Political committees registered with the Federal Election Commission — PACs, party committees, and campaign committees.',
    category: 'influence',
    caveat: 'Committees only — no contribution records',
    provider: 'OpenFEC',
    icon: Vote,
    selectCols:
      'committee_id, name, committee_type_full, designation_full, party_full, state, last_file_date',
    searchFields: ['name', 'committee_id'],
    tiebreak: 'committee_id ASC',
    defaultSort: 'recent',
    sortOptions: [
      { key: 'recent', label: 'Recently filed', orderBy: 'last_file_date DESC NULLS LAST' },
      { key: 'name', label: 'Name A–Z', orderBy: 'name ASC NULLS LAST' },
    ],
    filters: [
      {
        param: 'type',
        label: 'Type',
        field: 'committee_type_full',
        options: [
          { value: '', label: 'All types' },
          { value: 'House', label: 'House' },
          { value: 'Senate', label: 'Senate' },
          { value: 'Presidential', label: 'Presidential' },
          { value: 'PAC - Qualified', label: 'PAC (qualified)' },
          { value: 'PAC - Nonqualified', label: 'PAC (nonqualified)' },
          { value: 'Super PAC (Independent Expenditure-Only)', label: 'Super PAC' },
          { value: 'Party - Qualified', label: 'Party (qualified)' },
          { value: 'Party - Nonqualified', label: 'Party (nonqualified)' },
        ],
      },
    ],
    recencyExpr: 'MAX(last_file_date)',
    toCard: (row) => ({
      id: row.committee_id ?? '',
      chips: [
        row.committee_type_full ? { label: row.committee_type_full } : null,
        row.party_full ? { label: row.party_full, variant: 'accent' as const } : null,
        row.state ? { label: row.state, variant: 'code' as const } : null,
      ].filter((c) => c !== null),
      title: row.name || '(unnamed committee)',
      href: fecCommitteeUrl(row.committee_id),
      metaLeft: row.designation_full,
      metaRight: formatDate(row.last_file_date)
        ? `Last filing ${formatDate(row.last_file_date)}`
        : null,
      linkLabel: 'fec.gov',
    }),
  },

  // ── Oversight & Outcomes ────────────────────────────────────────────────
  {
    key: 'usaspending',
    table: 'usaspending_recipients',
    label: 'USASpending Recipients',
    description:
      'The largest recipients of federal awards, ranked by all-time award dollars — where regulated money actually flows.',
    category: 'oversight',
    provider: 'USASpending',
    caveat: 'Top ~100K recipients by award amount',
    icon: CircleDollarSign,
    selectCols: 'recipient_id, name, uei, recipient_level, total_award_amount',
    searchFields: ['name', 'uei'],
    tiebreak: 'recipient_id ASC',
    defaultSort: 'top',
    sortOptions: [
      {
        key: 'top',
        label: 'Award amount',
        // total_award_amount is a numeric VARCHAR; lexical order would
        // mis-rank, so cast before sorting.
        orderBy: 'TRY_CAST(total_award_amount AS DOUBLE) DESC NULLS LAST',
      },
    ],
    filters: [
      {
        param: 'level',
        label: 'Level',
        field: 'recipient_level',
        options: [
          { value: '', label: 'All levels' },
          { value: 'R', label: 'Recipient' },
          { value: 'P', label: 'Parent' },
          { value: 'C', label: 'Child' },
        ],
      },
    ],
    recencyExpr: null,
    toCard: (row) => ({
      id: row.recipient_id ?? '',
      chips: [
        formatUSDCompact(row.total_award_amount)
          ? { label: formatUSDCompact(row.total_award_amount)!, variant: 'accent' as const }
          : null,
        recipientLevelLabel(row.recipient_level)
          ? { label: recipientLevelLabel(row.recipient_level)! }
          : null,
        row.uei ? { label: row.uei, variant: 'code' as const } : null,
      ].filter((c) => c !== null),
      title: row.name || '(unnamed recipient)',
      href: usaspendingRecipientUrl(row.recipient_id),
      metaRight: 'All-time award total',
      linkLabel: 'usaspending.gov',
    }),
  },
  {
    key: 'court-dockets',
    table: 'court_dockets',
    label: 'Court Dockets',
    description:
      'Federal lawsuits challenging agency action under the Administrative Procedure Act — the litigation that follows finalized rules.',
    category: 'oversight',
    provider: 'CourtListener',
    caveat: 'APA-review suits (nature of suit 899) only',
    icon: Gavel,
    selectCols:
      'cl_docket_id, case_name, court, docket_number, date_filed, date_terminated, nature_of_suit, cause, assigned_to, absolute_url',
    searchFields: ['case_name', 'docket_number'],
    tiebreak: 'cl_docket_id ASC',
    defaultSort: 'recent',
    sortOptions: [
      { key: 'recent', label: 'Recently filed', orderBy: 'date_filed DESC NULLS LAST' },
      { key: 'oldest', label: 'Oldest', orderBy: 'date_filed ASC NULLS LAST' },
    ],
    filters: [
      {
        param: 'status',
        label: 'Status',
        field: 'date_terminated',
        options: [
          { value: '', label: 'All cases' },
          { value: 'open', label: 'Pending', where: 'date_terminated IS NULL' },
          { value: 'closed', label: 'Closed', where: 'date_terminated IS NOT NULL' },
        ],
      },
    ],
    recencyExpr: 'MAX(date_filed)',
    toCard: (row) => ({
      id: row.cl_docket_id ?? '',
      chips: [
        row.date_terminated === null
          ? { label: 'Pending', variant: 'accent' as const }
          : { label: 'Closed' },
        row.court ? { label: row.court } : null,
        row.docket_number ? { label: row.docket_number, variant: 'code' as const } : null,
      ].filter((c) => c !== null),
      title: row.case_name || '(unnamed case)',
      href: row.absolute_url,
      body: row.cause || stripNatureOfSuitCode(row.nature_of_suit),
      metaLeft: row.assigned_to ? `Judge ${row.assigned_to}` : null,
      metaRight: formatDate(row.date_filed) ? `Filed ${formatDate(row.date_filed)}` : null,
      linkLabel: 'courtlistener.com',
    }),
  },
  {
    key: 'gao-reports',
    table: 'gao_reports',
    label: 'GAO Reports',
    description:
      'Audits and evaluations from the Government Accountability Office — federal oversight of how agencies implement laws and rules.',
    category: 'oversight',
    provider: 'GAO',
    caveat: 'Accumulating from GAO’s recent-items feed',
    icon: FileSearch,
    selectCols: 'report_id, title, abstract, published_date, url',
    searchFields: ['title', 'abstract'],
    tiebreak: 'report_id ASC',
    defaultSort: 'recent',
    sortOptions: [
      { key: 'recent', label: 'Recently published', orderBy: 'published_date DESC NULLS LAST' },
    ],
    filters: [],
    recencyExpr: 'MAX(published_date)',
    toCard: (row) => ({
      id: row.report_id ?? '',
      chips: [
        row.report_id ? { label: row.report_id.toUpperCase(), variant: 'code' as const } : null,
      ].filter((c) => c !== null),
      title: row.title || '(untitled report)',
      href: row.url,
      body: trimGaoAbstract(row.abstract),
      metaRight: formatDate(row.published_date),
      linkLabel: 'gao.gov',
    }),
  },
  {
    key: 'crs-reports',
    table: 'crs_reports',
    label: 'CRS Reports',
    description:
      'Congressional Research Service analysis for Congress — the nonpartisan brief behind many legislative and regulatory debates.',
    category: 'oversight',
    provider: 'CRS via Congress.gov',
    icon: ScrollText,
    selectCols: 'report_id, title, report_type, published_date, url',
    searchFields: ['title', 'report_id'],
    tiebreak: 'report_id ASC',
    defaultSort: 'recent',
    sortOptions: [
      { key: 'recent', label: 'Recently published', orderBy: 'published_date DESC NULLS LAST' },
    ],
    filters: [],
    recencyExpr: 'MAX(published_date)',
    toCard: (row) => ({
      id: row.report_id ?? '',
      chips: [
        row.report_id ? { label: row.report_id, variant: 'code' as const } : null,
      ].filter((c) => c !== null),
      title: row.title || '(untitled report)',
      href: crsReportUrl(row.report_id),
      metaRight: formatDate(row.published_date),
      linkLabel: 'congress.gov',
    }),
  },
];

/** Lookup by route segment; undefined for unknown keys. */
export function getSource(key: string): SourceDef | undefined {
  return SOURCES.find((s) => s.key === key);
}
