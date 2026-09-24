// The one-paragraph plain-language summary under an LGU's name. Built from the same numbers as the
// question cards; used on the page, as the meta description and as the share-card text. No causal wording.
import { CATEGORIES, median, peers, perResident, SEPARATE_REGION, totals, type Category, type LguIndexRow, type PeerMode, type PeriodDef } from './metrics.ts';
import { inTen, povertyTrend, shortName, times } from './answers.ts';

const CATEGORY_WORDS: Record<Category, string> = {
  flood: 'flood control',
  roads: 'roads and bridges',
  buildings: 'schools, halls and other buildings',
  other: 'water systems and other works',
};

/** "City of Mati" → "the City of Mati"; municipalities keep their bare name. */
export function displayName(l: Pick<LguIndexRow, 'name'>): string {
  return /\bCity of\b/.test(l.name) ? `the ${l.name}` : l.name;
}

export function periodPhrase(per: PeriodDef): string {
  switch (per.id) {
    case 'latest': return `In ${per.from}`;
    case 'last3': return 'Over the last 3 years';
    case 'marcos': return 'Under the current president (since July 2022)';
    case 'duterte': return 'Under the previous president (2016–2022)';
    default: return per.from === per.to ? `In ${per.from}` : `From ${per.from} to ${per.to}`;
  }
}

/** Who the LGU is compared with, in the headline. No income class, no "peer". */
export function peersPhrase(mode: PeerMode, me: Pick<LguIndexRow, 'kind' | 'reg' | 'island'>): string {
  switch (mode) {
    case 'class': return `similar ${me.kind === 'City' ? 'cities' : 'towns'} in ${me.island}`;
    case 'region': return `other cities and towns in ${me.reg}`;
    case 'pop': return 'places of a similar size';
    case 'country': return me.reg === SEPARATE_REGION ? 'other places in BARMM' : 'places across the country';
  }
}

export interface HeadlineInput<T extends LguIndexRow> {
  me: T;
  all: T[];
  mode: PeerMode;
  per: PeriodDef;
  /** Share of the period's money won by the top 3 contractors (0–1), null when unknown. */
  top3: number | null;
  /** Number of distinct contractors in the period. */
  contractors: number;
}

const pct = (x: number) => `${Math.round(x * 100)}%`;
const MONEY = 'national road-and-flood money per person';

/** The money part, with the same thresholds as the first card (see spendComparison). */
export function moneyPhrase(ratio: number, group: string): string {
  if (ratio >= 1.15) return `about ${times(ratio)} times the ${MONEY} that ${group} got`;
  if (ratio >= 0.85) return `about the same ${MONEY} as ${group}`;
  if (ratio < 0.5) return `less than half the ${MONEY} that ${group} got`;
  return `about ${times(1 / ratio)} times less ${MONEY} than ${group}`;
}

export function headline<T extends LguIndexRow>({ me, all, mode, per, top3, contractors }: HeadlineInput<T>): string {
  const who = shortName(me.name);
  const when = periodPhrase(per);
  const t = totals(me, per);
  const mine = perResident(t.spend, me.pop);
  const group = peers(me, all, mode);
  // Same middle value as the first card, so the two always agree.
  const typical = median(group.map((l) => perResident(totals(l, per).spend, l.pop)).filter((x): x is number => x != null));

  const out: string[] = [];
  if (mine == null) {
    out.push(`${when}, money per person can't be worked out for ${who} because its population isn't listed.`);
  } else if (t.spend === 0) {
    out.push(`${when}, no national road-and-flood projects could be placed in ${who}.`);
  } else {
    const money = typical ? moneyPhrase(mine / typical, peersPhrase(mode, me)) : 'national road-and-flood money';
    const top = CATEGORIES.reduce((a, c) => (t.byCategory[c] > t.byCategory[a] ? c : a), CATEGORIES[0]);
    const topShare = t.byCategory[top] / t.spend;
    const share = Math.round(topShare * 100);
    const what = share > 50 ? `mostly for ${CATEGORY_WORDS[top]}` : share === 50 ? `about half for ${CATEGORY_WORDS[top]}` : `the biggest part (${share}%) for ${CATEGORY_WORDS[top]}`;
    const whom = contractors === 0 ? ''
      : contractors === 1 ? ', all through a single company'
      : contractors <= 3 ? `, all through ${contractors} companies`
      : top3 != null && top3 >= 0.5 ? `, with ${pct(top3)} going to just 3 companies`
      : `, spread across ${contractors} companies`;
    out.push(`${when}, ${who} got ${money}, ${what}${whom}.`);
  }

  if (me.pov != null) {
    const where = me.povLevel === 'prov' ? (/province|metro/i.test(me.prov) ? me.prov : `${me.prov} province`) : who;
    const share = inTen(me.pov);
    const trend = povertyTrend(me.pov, me.povPrev, me.povPrevYear);
    if (!trend) out.push(`${cap(share)} people in ${where} are poor.`);
    else if (trend.status === 'same') out.push(`Poverty in ${where} stayed about the same: ${share} people are poor.`);
    else out.push(`Meanwhile, poverty in ${where} got ${trend.status}: ${share} people are now poor.`);
  }
  return cap(out.join(' '));
}

const cap = (x: string) => x[0].toUpperCase() + x.slice(1);

/** Distinct contractors among projects in the period. `projects` rows are [..., budget(4), year(5), contractorIds(6)]. */
export function contractorCount(projects: readonly (readonly unknown[])[], per: Pick<PeriodDef, 'from' | 'to'>): number {
  const ids = new Set<string>();
  for (const p of projects) {
    const y = p[5] as number | null;
    if (y != null && y >= per.from && y <= per.to) for (const id of p[6] as string[]) ids.add(id);
  }
  return ids.size;
}
