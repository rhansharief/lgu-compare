// Shared metric logic, used by the pipeline (tests) and the browser.
// Pure functions over the emitted index: no I/O here.

export const CATEGORIES = ['flood', 'roads', 'buildings', 'other'] as const;
export type Category = (typeof CATEGORIES)[number];
export const CATEGORY_LABEL: Record<Category, string> = {
  flood: 'Flood control',
  roads: 'Roads and bridges',
  buildings: 'Schools, halls and other buildings',
  other: 'Water and other',
};

/** Per budget year: spend per category (PHP), project count, completed count, count with known status. */
export type YearRow = [flood: number, roads: number, buildings: number, other: number, count: number, completed: number, known: number];

export type IslandGroup = 'Luzon' | 'Visayas' | 'Mindanao';

export interface LguIndexRow {
  psgc: string;
  name: string;
  prov: string;
  reg: string;
  island: IslandGroup;
  /** 'City' or 'Mun' */
  kind: 'City' | 'Mun';
  /** Income class, e.g. '1st' … '6th'; null when unknown. */
  cls: string | null;
  pop: number | null;
  pov: number | null; // poverty incidence, %
  povYear: number | null;
  povLevel: 'lgu' | 'prov' | null;
  povPrev: number | null;
  povPrevYear: number | null;
  y: Record<string, YearRow>;
  /** Top-3 contractor share per preset period id (0–1), null when no spend. */
  top3: Record<string, number | null>;
}

export interface PeriodDef {
  id: string;
  label: string;
  from: number;
  to: number;
  /** id of the period to compare against for deltas */
  prev: string | null;
  note?: string;
}

export const CURRENT_YEAR = 2026;
export const FIRST_DATA_YEAR = 2016;

// Budget (infra) years fully inside each period. Budget years run Jan–Dec.
export const PERIODS: PeriodDef[] = [
  { id: 'latest', label: 'Latest year (2025)', from: 2025, to: 2025, prev: 'prev-latest' },
  { id: 'last3', label: 'Last 3 years (2023–2025)', from: 2023, to: 2025, prev: 'prev-last3' },
  {
    id: 'marcos',
    label: 'Marcos Jr. admin (2022-07→)',
    from: 2023,
    to: 2026,
    prev: 'duterte',
    note: 'Projects approved for 2026 are still being bid out and awarded, so the 2026 total will keep growing. A low figure here does not mean nothing is happening.',
  },
  { id: 'duterte', label: 'Duterte admin (2016-07→2022-06)', from: 2017, to: 2021, prev: null },
  // Comparison-only periods (not shown as chips)
  { id: 'prev-latest', label: '2024', from: 2024, to: 2024, prev: null },
  { id: 'prev-last3', label: '2020–2022', from: 2020, to: 2022, prev: null },
];
export const PRESET_IDS = ['latest', 'last3', 'marcos', 'duterte'];

export function periodById(id: string): PeriodDef | undefined {
  return PERIODS.find((p) => p.id === id);
}

/** Custom range → a PeriodDef, with the same-length window just before it as its comparison. */
export function customPeriod(from: number, to: number): PeriodDef {
  const lo = Math.max(FIRST_DATA_YEAR, Math.min(from, to));
  const hi = Math.min(CURRENT_YEAR, Math.max(from, to));
  return {
    id: `custom-${lo}-${hi}`,
    label: lo === hi ? `${lo}` : `${lo}–${hi}`,
    from: lo,
    to: hi,
    prev: null,
    note: hi >= CURRENT_YEAR ? PERIODS[2].note : undefined,
  };
}

export function prevOf(p: PeriodDef): PeriodDef | null {
  if (p.prev) return periodById(p.prev) ?? null;
  if (p.id.startsWith('custom-')) {
    const len = p.to - p.from + 1;
    if (p.from - len < FIRST_DATA_YEAR) return null;
    return { id: `custom-${p.from - len}-${p.from - 1}`, label: `${p.from - len}–${p.from - 1}`, from: p.from - len, to: p.from - 1, prev: null };
  }
  return null;
}

export type CategoryFilter = Category | 'all';

export interface PeriodTotals {
  spend: number;
  byCategory: Record<Category, number>;
  count: number;
  completed: number;
  known: number;
}

export function totals(lgu: Pick<LguIndexRow, 'y'>, p: Pick<PeriodDef, 'from' | 'to'>): PeriodTotals {
  const byCategory: Record<Category, number> = { flood: 0, roads: 0, buildings: 0, other: 0 };
  let count = 0, completed = 0, known = 0;
  for (let yr = p.from; yr <= p.to; yr++) {
    const r = lgu.y[yr];
    if (!r) continue;
    byCategory.flood += r[0];
    byCategory.roads += r[1];
    byCategory.buildings += r[2];
    byCategory.other += r[3];
    count += r[4];
    completed += r[5];
    known += r[6];
  }
  const spend = byCategory.flood + byCategory.roads + byCategory.buildings + byCategory.other;
  return { spend, byCategory, count, completed, known };
}

export function spendFor(t: PeriodTotals, cat: CategoryFilter): number {
  return cat === 'all' ? t.spend : t.byCategory[cat];
}

export function perResident(spend: number, pop: number | null): number | null {
  return pop && pop > 0 ? spend / pop : null;
}

export function completionRate(t: PeriodTotals): number | null {
  return t.known > 0 ? t.completed / t.known : null;
}

// ---------- Peer groups ----------

export type PeerMode = 'class' | 'region' | 'pop' | 'country';
export const PEER_MODES: { id: PeerMode; label: string }[] = [
  { id: 'class', label: 'Similar cities and towns' },
  { id: 'region', label: 'Cities and towns in the same region' },
  { id: 'pop', label: 'Places with a similar population' },
  { id: 'country', label: 'Every city and town in the country' },
];

export function peerLabel(mode: PeerMode, lgu: LguIndexRow, all?: LguIndexRow[]): string {
  switch (mode) {
    case 'class': {
      const kinds = lgu.kind === 'City' ? 'cities' : 'municipalities';
      if (!all || !lgu.cls) return lgu.cls ? `${lgu.cls} income class ${kinds} in ${lgu.island}` : `${kinds[0].toUpperCase()}${kinds.slice(1)} in ${lgu.island}`;
      const band = classBand(lgu, all);
      return `${band.length > 1 ? `${band[0]}–${band[band.length - 1]}` : band[0]} income class ${kinds} in ${lgu.island}`;
    }
    case 'region':
      return lgu.reg;
    case 'pop':
      return lgu.pop ? `Population ${fmtCompact(lgu.pop * 0.7)}–${fmtCompact(lgu.pop * 1.3)}` : 'Similar population';
    case 'country':
      return lgu.reg === SEPARATE_REGION ? 'All cities & municipalities in the Bangsamoro region (BARMM)' : 'All cities & municipalities outside the Bangsamoro region (BARMM)';
  }
}

/**
 * The peer group always includes the LGU itself. City and municipality income classes use
 * different thresholds, so "same class" also means same kind (city vs municipality).
 */
export const SEPARATE_REGION = 'BARMM';
export const SEPARATE_NOTE =
  'Cities and towns in the Bangsamoro Autonomous Region in Muslim Mindanao (BARMM) are compared only with each other: most public works there are carried out by the region\'s own Ministry of Public Works, not the Department of Public Works and Highways (DPWH), so their DPWH figures are low by design.';

/** BARMM and non-BARMM LGUs never share a peer group (see SEPARATE_NOTE). */
export function comparable<T extends LguIndexRow>(lgu: Pick<LguIndexRow, 'reg'> | null, all: T[]): T[] {
  const inSep = lgu?.reg === SEPARATE_REGION;
  return all.filter((o) => (o.reg === SEPARATE_REGION) === inSep);
}

export function peers<T extends LguIndexRow>(lgu: T, allLgus: T[], mode: PeerMode): T[] {
  const all = comparable(lgu, allLgus);
  switch (mode) {
    case 'class': {
      const band = classBand(lgu, all);
      return all.filter((o) => o.island === lgu.island && o.kind === lgu.kind && band.includes(o.cls as string));
    }
    case 'region':
      return all.filter((o) => o.reg === lgu.reg);
    case 'pop':
      if (!lgu.pop) return [lgu];
      return all.filter((o) => o.pop != null && o.pop >= lgu.pop! * 0.7 && o.pop <= lgu.pop! * 1.3);
    case 'country':
      return all;
  }
}

export const MIN_PEERS = 8;
const CLASS_ORDER = ['Special', '1st', '2nd', '3rd', '4th', '5th', '6th'];

/**
 * Income classes that make up an LGU's "same class" peer group. Some combinations are tiny
 * (there are 3 fifth-class cities in Mindanao), so when the exact class gives fewer than
 * MIN_PEERS LGUs we widen to the adjacent classes, one step at a time.
 */
export function classBand(lgu: LguIndexRow, all: LguIndexRow[]): string[] {
  const i = CLASS_ORDER.indexOf(lgu.cls ?? '');
  if (i < 0) return [lgu.cls as string];
  const pool = comparable(lgu, all).filter((o) => o.island === lgu.island && o.kind === lgu.kind);
  for (let w = 0; w < CLASS_ORDER.length; w++) {
    const band = CLASS_ORDER.slice(Math.max(0, i - w), i + w + 1);
    if (pool.filter((o) => band.includes(o.cls as string)).length >= MIN_PEERS || band.length === CLASS_ORDER.length) return band;
  }
  return CLASS_ORDER;
}

// ---------- Ranking & medians ----------

export function median(xs: number[]): number | null {
  const v = xs.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return null;
  const m = v.length >> 1;
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

/**
 * Rank of `value` among `values`, 1 = highest. Ties share the best rank.
 * Returns null when value is null. `of` counts only LGUs with a value.
 */
export function rankDesc(value: number | null, values: (number | null)[]): { rank: number; of: number } | null {
  const v = values.filter((x): x is number => x != null && Number.isFinite(x));
  if (value == null) return null;
  return { rank: v.filter((x) => x > value).length + 1, of: v.length };
}

/**
 * Where a value sits among its peers, for plain-language wording ("Less concentrated than 7 of 9 peers").
 * `values` includes the LGU's own value; `peers` excludes it. Ties count as neither above nor below.
 */
export function standing(value: number | null, values: (number | null)[]): { above: number; below: number; peers: number } | null {
  if (value == null) return null;
  const v = values.filter((x): x is number => x != null && Number.isFinite(x));
  return { above: v.filter((x) => x > value).length, below: v.filter((x) => x < value).length, peers: Math.max(0, v.length - 1) };
}

/**
 * "Higher than 6 of 9 peers" / "Lower than 6 of 9 peers": always states the larger side, in the
 * direction the reader expects, so nobody has to know whether 1st means highest or lowest.
 */
export function standingPhrase(s: { above: number; below: number; peers: number } | null, more: string, less: string): string {
  if (!s || s.peers === 0) return '';
  if (s.above === 0 && s.below === s.peers) return `${cap(more)} than all ${s.peers} peers`;
  if (s.below === 0 && s.above === s.peers) return `${cap(less)} than all ${s.peers} peers`;
  if (s.above === 0 && s.below === 0) return `The same as all ${s.peers} peers`;
  return s.below >= s.above ? `${cap(more)} than ${s.below} of ${s.peers} peers` : `${cap(less)} than ${s.above} of ${s.peers} peers`;
}

const cap = (x: string) => x[0].toUpperCase() + x.slice(1);

// ---------- Formatting ----------

export function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export function fmtPeso(x: number | null, digits = 0): string {
  if (x == null) return '—';
  return '₱' + x.toLocaleString('en-PH', { maximumFractionDigits: digits, minimumFractionDigits: digits });
}

export function fmtPesoCompact(x: number | null): string {
  if (x == null) return '—';
  const a = Math.abs(x);
  if (a >= 1e12) return `₱${(x / 1e12).toFixed(2)}T`;
  if (a >= 1e9) return `₱${(x / 1e9).toFixed(a >= 1e10 ? 1 : 2)}B`;
  if (a >= 1e6) return `₱${(x / 1e6).toFixed(a >= 1e8 ? 0 : 1)}M`;
  if (a >= 1e3) return `₱${(x / 1e3).toFixed(0)}k`;
  return `₱${x.toFixed(0)}`;
}

export function fmtCompact(x: number): string {
  if (x >= 1e6) return `${(x / 1e6).toFixed(1)}M`;
  if (x >= 1e3) return `${Math.round(x / 1e3)}k`;
  return String(Math.round(x));
}

export function fmtPct(x: number | null, digits = 0): string {
  return x == null ? '—' : `${(x * 100).toFixed(digits)}%`;
}
