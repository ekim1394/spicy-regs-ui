/**
 * Static metadata for federal agencies.
 * Maps agency codes to display info, accent colors, and links.
 *
 * Agency data loaded from generated agencies.json (scripts/generate_agencies.py).
 */

import agenciesData from './data/agencies.json';

export interface AgencyInfo {
  code: string;
  name: string;
  shortName: string;
  description: string;
  color: string;
  website: string | null;
  favicon: string | null;
  relatedAgencies: string[];
  links: { label: string; url: string }[];
}

/** Extra curated metadata for major agencies (colors, related, links) */
const CURATED_EXTRAS: Record<string, Partial<AgencyInfo>> = {
  EPA: {
    color: 'var(--agency-epa)',
    relatedAgencies: ['DOE', 'DOT', 'USDA', 'NOAA'],
    links: [
      { label: 'regulations.gov', url: 'https://www.regulations.gov' },
      { label: 'epa.gov', url: 'https://www.epa.gov' },
      { label: 'Federal Register', url: 'https://www.federalregister.gov' },
    ],
  },
  FDA: {
    color: 'var(--agency-fda)',
    relatedAgencies: ['HHS', 'USDA', 'EPA'],
    links: [
      { label: 'regulations.gov', url: 'https://www.regulations.gov' },
      { label: 'fda.gov', url: 'https://www.fda.gov' },
    ],
  },
  FCC: {
    color: 'var(--agency-fcc)',
    relatedAgencies: ['FTC', 'DOJ'],
    links: [
      { label: 'regulations.gov', url: 'https://www.regulations.gov' },
      { label: 'fcc.gov', url: 'https://www.fcc.gov' },
    ],
  },
  DOT: {
    color: 'var(--agency-dot)',
    relatedAgencies: ['EPA', 'DOE', 'DHS'],
    links: [
      { label: 'regulations.gov', url: 'https://www.regulations.gov' },
      { label: 'transportation.gov', url: 'https://www.transportation.gov' },
    ],
  },
  SEC: {
    color: 'var(--agency-sec)',
    relatedAgencies: ['CFTC', 'FTC', 'DOJ'],
    links: [
      { label: 'regulations.gov', url: 'https://www.regulations.gov' },
      { label: 'sec.gov', url: 'https://www.sec.gov' },
    ],
  },
  USDA: {
    color: 'var(--agency-usda)',
    relatedAgencies: ['EPA', 'FDA', 'DOI'],
    links: [
      { label: 'regulations.gov', url: 'https://www.regulations.gov' },
      { label: 'usda.gov', url: 'https://www.usda.gov' },
    ],
  },
  DOE: {
    color: 'var(--agency-doe)',
    relatedAgencies: ['EPA', 'DOT', 'NRC'],
    links: [
      { label: 'regulations.gov', url: 'https://www.regulations.gov' },
      { label: 'energy.gov', url: 'https://www.energy.gov' },
    ],
  },
  HHS: {
    color: 'var(--agency-hhs)',
    relatedAgencies: ['FDA', 'CMS', 'CDC'],
    links: [
      { label: 'regulations.gov', url: 'https://www.regulations.gov' },
      { label: 'hhs.gov', url: 'https://www.hhs.gov' },
    ],
  },
  DHS: {
    color: 'var(--agency-dhs)',
    relatedAgencies: ['DOJ', 'DOD', 'DOT'],
    links: [
      { label: 'regulations.gov', url: 'https://www.regulations.gov' },
      { label: 'dhs.gov', url: 'https://www.dhs.gov' },
    ],
  },
  DOJ: {
    color: 'var(--agency-doj)',
    relatedAgencies: ['DHS', 'FTC', 'SEC'],
    links: [
      { label: 'regulations.gov', url: 'https://www.regulations.gov' },
      { label: 'justice.gov', url: 'https://www.justice.gov' },
    ],
  },
  DOD: {
    color: 'var(--agency-dod)',
    relatedAgencies: ['DHS', 'DOE', 'VA'],
    links: [
      { label: 'regulations.gov', url: 'https://www.regulations.gov' },
      { label: 'defense.gov', url: 'https://www.defense.gov' },
    ],
  },
  HUD: {
    color: 'var(--agency-hud)',
    relatedAgencies: ['EPA', 'DOT', 'ED'],
    links: [
      { label: 'regulations.gov', url: 'https://www.regulations.gov' },
      { label: 'hud.gov', url: 'https://www.hud.gov' },
    ],
  },
  ED: {
    color: 'var(--agency-ed)',
    relatedAgencies: ['HHS', 'HUD'],
    links: [
      { label: 'regulations.gov', url: 'https://www.regulations.gov' },
      { label: 'ed.gov', url: 'https://www.ed.gov' },
    ],
  },
  NOAA: {
    color: 'var(--agency-noaa)',
    relatedAgencies: ['EPA', 'USDA', 'DOI'],
    links: [
      { label: 'regulations.gov', url: 'https://www.regulations.gov' },
      { label: 'noaa.gov', url: 'https://www.noaa.gov' },
    ],
  },
};

interface AgencyJson {
  code: string;
  name: string;
  description: string | null;
  website: string | null;
  favicon: string | null;
}

/**
 * Deterministic avatar color for agencies without a curated brand color.
 * Hashes the code to a hue but pins lightness + chroma to the same muted band
 * as the curated `--agency-*` palette (see globals.css), so the long tail of
 * uncurated agencies reads as distinct, in-key colors rather than a single
 * flat `--agency-default` prussian.
 */
export function deriveAgencyColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `oklch(0.56 0.072 ${hue})`;
}

/**
 * Build lookup map from agencies.json.
 *
 * `favicon` is pre-validated by scripts/validate_favicons.mjs: it's either a
 * Google favicon URL confirmed to serve a real icon of at least the Avatar's
 * quality floor, or `null`. Domains where Google has no favicon (it would paint
 * a generic globe) and icons below the floor are already nulled there, so the
 * Avatar can use this value as-is and fall back to initials on `null`.
 */
const AGENCY_MAP = new Map<string, AgencyInfo>();
for (const entry of agenciesData as AgencyJson[]) {
  const extras = CURATED_EXTRAS[entry.code] || {};
  AGENCY_MAP.set(entry.code, {
    code: entry.code,
    name: entry.name,
    shortName: entry.code,
    description: entry.description || 'Federal regulatory agency.',
    color: extras.color || deriveAgencyColor(entry.code),
    website: entry.website,
    favicon: entry.favicon,
    relatedAgencies: extras.relatedAgencies || [],
    links: extras.links || [
      { label: 'regulations.gov', url: 'https://www.regulations.gov' },
    ],
  });
}

/**
 * Get metadata for an agency by code.
 * Returns a sensible fallback for unknown agencies.
 */
export function getAgencyInfo(code: string): AgencyInfo {
  const upper = code.toUpperCase();
  const info = AGENCY_MAP.get(upper);
  if (info) return info;

  return {
    code: upper,
    name: upper,
    shortName: upper,
    description: 'Federal regulatory agency.',
    color: deriveAgencyColor(upper),
    website: null,
    favicon: null,
    relatedAgencies: [],
    links: [
      { label: 'regulations.gov', url: 'https://www.regulations.gov' },
    ],
  };
}

/** Get all known agencies sorted by name */
export function getAllKnownAgencies(): AgencyInfo[] {
  return Array.from(AGENCY_MAP.values()).sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Parent-department groupings for the Agencies directory and the
 * AgencyIdentity "parent dept" line. Editorial groupings, not a strict
 * org chart — they map each agency code to the cabinet department (or
 * independent grouping) a reader would expect to find it under.
 *
 * Order is display order. Agencies not listed here fall into the
 * `UNGROUPED_DEPT` bucket via getAllKnownAgenciesByDept().
 */
export const UNGROUPED_DEPT = 'Other agencies';

export const DEPARTMENT_MAP: { dept: string; codes: string[] }[] = [
  { dept: 'Agriculture', codes: [
    'USDA', 'AMS', 'APHIS', 'ARS', 'CCC', 'CSREES', 'ERS', 'FAS', 'FCIC',
    'FNS', 'FPAC', 'FS', 'FSA', 'FSIS', 'GIPSA', 'NAL', 'NASS', 'NIFA',
    'NRCS', 'RBS', 'RHS', 'RMA', 'RTB', 'RUS', 'USDAIG',
  ] },
  { dept: 'Commerce', codes: [
    'DOC', 'BIS', 'EDA', 'ESA', 'ITA', 'MBDA', 'NIST', 'NOAA', 'NTIA',
    'PTO', 'USBC',
  ] },
  { dept: 'Defense', codes: ['DOD', 'USA', 'USAF', 'USN', 'COE'] },
  { dept: 'Education', codes: ['ED'] },
  { dept: 'Energy', codes: [
    'DOE', 'BPA', 'EERE', 'EIA', 'NNSA', 'OEPNU', 'SWPA', 'WAPA',
  ] },
  { dept: 'Health & Human Services', codes: [
    'HHS', 'ACF', 'ACL', 'AHRQ', 'AOA', 'ATSDR', 'CDC', 'CMS', 'FDA',
    'HHSIG', 'HRSA', 'IHS', 'NIH', 'SAMHSA',
  ] },
  { dept: 'Homeland Security', codes: [
    'DHS', 'CISA', 'FEMA', 'FLETC', 'FIRSTNET', 'ICEB', 'TSA', 'USCBP',
    'USCG', 'USCIS',
  ] },
  { dept: 'Housing & Urban Development', codes: ['HUD'] },
  { dept: 'Interior', codes: [
    'DOI', 'BIA', 'BLM', 'BOEM', 'BOR', 'BSEE', 'FWS', 'MMS', 'NPS',
    'ONRR', 'OSM', 'USGS',
  ] },
  { dept: 'Justice', codes: [
    'DOJ', 'ATF', 'ATR', 'BOP', 'DEA', 'EOIR', 'FBI', 'OJJDP', 'OJP', 'USPC',
  ] },
  { dept: 'Labor', codes: [
    'DOL', 'BLS', 'EBSA', 'ECAB', 'ETA', 'MSHA', 'OFCCP', 'OSHA', 'VETS', 'WHD',
  ] },
  { dept: 'State', codes: ['DOS', 'AID'] },
  { dept: 'Transportation', codes: [
    'DOT', 'FAA', 'FHWA', 'FMCSA', 'FRA', 'FTA', 'MARAD', 'NHTSA',
    'PHMSA', 'RITA', 'SLSDC',
  ] },
  { dept: 'Treasury', codes: [
    'TREAS', 'BPD', 'CDFI', 'FINCEN', 'FISCAL', 'IRS', 'OCC', 'OFAC',
    'OTS', 'TTB', 'USMINT',
  ] },
  { dept: 'Veterans Affairs', codes: ['VA'] },
  { dept: 'Environmental Protection Agency', codes: ['EPA', 'EAB'] },
  { dept: 'Executive Office of the President', codes: [
    'OMB', 'OSTP', 'ONDCP', 'ONCD', 'IPEC', 'CEQ', 'USTR', 'OFPP', 'NSPC',
  ] },
  { dept: 'Independent agencies', codes: [
    'SEC', 'FCC', 'FTC', 'CFPB', 'CPSC', 'CSB', 'EEOC', 'EIB', 'FMC',
    'FRTIB', 'GSA', 'NARA', 'NASA', 'NCUA', 'NLRB', 'NRC', 'NSF', 'NTSB',
    'OPM', 'PBGC', 'PCLOB', 'SBA', 'SSA', 'NIGC', 'ASC', 'FFIEC',
  ] },
];

/** Reverse lookup: agency code → parent department label. */
const CODE_TO_DEPT = new Map<string, string>();
for (const { dept, codes } of DEPARTMENT_MAP) {
  for (const code of codes) CODE_TO_DEPT.set(code, dept);
}

/**
 * Parent department for an agency code, or `UNGROUPED_DEPT` if unmapped.
 * Used by the AgencyIdentity card's "parent dept" line.
 */
export function getParentDept(code: string): string {
  return CODE_TO_DEPT.get(code.toUpperCase()) ?? UNGROUPED_DEPT;
}

/**
 * All known agencies grouped by parent department, in DEPARTMENT_MAP order,
 * with any unmapped agencies collected under `UNGROUPED_DEPT` last. Agencies
 * within each group are sorted by name. Empty groups are omitted. Drives the
 * Agencies directory's department section headers.
 */
export function getAllKnownAgenciesByDept(): { dept: string; agencies: AgencyInfo[] }[] {
  const all = getAllKnownAgencies();
  const byDept = new Map<string, AgencyInfo[]>();
  for (const agency of all) {
    const dept = getParentDept(agency.code);
    const list = byDept.get(dept);
    if (list) list.push(agency);
    else byDept.set(dept, [agency]);
  }

  const ordered: { dept: string; agencies: AgencyInfo[] }[] = [];
  for (const { dept } of DEPARTMENT_MAP) {
    const agencies = byDept.get(dept);
    if (agencies && agencies.length > 0) {
      ordered.push({ dept, agencies });
    }
  }
  const ungrouped = byDept.get(UNGROUPED_DEPT);
  if (ungrouped && ungrouped.length > 0) {
    ordered.push({ dept: UNGROUPED_DEPT, agencies: ungrouped });
  }
  return ordered;
}

/**
 * Agencies to surface as "related" on the profile page. Prefers the curated
 * cross-department picks (EPA → DOE, DOT, …); when an agency has none — most
 * don't — falls back to its parent-department siblings so every profile still
 * shows real connections. The agency itself and any unknown/duplicate codes are
 * filtered out, and the list is capped at `limit`.
 */
export function getRelatedAgencies(code: string, limit = 6): AgencyInfo[] {
  const upper = code.toUpperCase();
  const curated = getAgencyInfo(upper).relatedAgencies;
  let codes: string[] = curated && curated.length > 0 ? curated : [];
  if (codes.length === 0) {
    const dept = getParentDept(upper);
    const group = getAllKnownAgenciesByDept().find((g) => g.dept === dept);
    codes = (group?.agencies ?? []).map((a) => a.code);
  }

  const seen = new Set<string>([upper]);
  const out: AgencyInfo[] = [];
  for (const c of codes) {
    const cc = c.toUpperCase();
    if (seen.has(cc) || !AGENCY_MAP.has(cc)) continue;
    seen.add(cc);
    out.push(getAgencyInfo(cc));
    if (out.length >= limit) break;
  }
  return out;
}

/** Generate a deterministic color for avatars based on a string */
export function stringToColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 55%, 45%)`;
}

/** Get initials from a name (first letter of each word, max 2) */
export function getInitials(name: string): string {
  return name
    .split(/[\s-]+/)
    .filter(Boolean)
    .map(w => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

/** Format a number with K/M suffix */
export function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

/** Format a date as relative time (e.g. "2d ago") */
export function timeAgo(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffS = Math.floor(diffMs / 1000);
  const diffM = Math.floor(diffS / 60);
  const diffH = Math.floor(diffM / 60);
  const diffD = Math.floor(diffH / 24);
  const diffW = Math.floor(diffD / 7);
  const diffMo = Math.floor(diffD / 30);
  const diffY = Math.floor(diffD / 365);

  if (diffY > 0) return `${diffY}y ago`;
  if (diffMo > 0) return `${diffMo}mo ago`;
  if (diffW > 0) return `${diffW}w ago`;
  if (diffD > 0) return `${diffD}d ago`;
  if (diffH > 0) return `${diffH}h ago`;
  if (diffM > 0) return `${diffM}m ago`;
  return 'just now';
}
