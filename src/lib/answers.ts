// The plain answer sentences on the LGU page's question cards and in the headline.
// Pure functions, so every city and town gets the same wording for the same numbers.
import { fmtPeso, type LguIndexRow, type PeerMode, type PeriodDef, SEPARATE_REGION } from './metrics.ts';

const pct = (x: number) => `${Math.round(x * 100)}%`;

/** "City of Mati" → "Mati", "Island Garden City of Samal" → "Samal"; "Quezon City" and towns keep their name. */
export function shortName(name: string): string {
  const m = /\bCity of (.+)$/.exec(name);
  return m ? m[1] : name;
}

/** 1.94 → "1.9", 12.4 → "12". */
export function times(r: number): string {
  return r >= 10 ? String(Math.round(r)) : r.toFixed(1);
}

/** Who "similar" means, as it reads after "than most …" / "what … got". */
export function groupWords(mode: PeerMode, me: Pick<LguIndexRow, 'kind' | 'reg'>): string {
  switch (mode) {
    case 'class': return me.kind === 'City' ? 'similar cities' : 'similar towns';
    case 'region': return `other places in ${me.reg}`;
    case 'pop': return 'places of a similar size';
    case 'country': return me.reg === SEPARATE_REGION ? 'other places in BARMM' : 'places across the country';
  }
}

/**
 * Card 1 comparison. ratio = money per person here ÷ the group's typical (middle) value.
 * ≥1.15 "About N× what X got"; 0.85–1.15 "About the same as X"; <0.85 "About N× less than X";
 * below 0.5 "Less than half of what X got".
 */
export function spendComparison(ratio: number | null, group: string): string {
  if (ratio == null || !Number.isFinite(ratio)) return '';
  if (ratio >= 1.15) return `About ${times(ratio)}× what ${group} got.`;
  if (ratio >= 0.85) return `About the same as ${group}.`;
  if (ratio < 0.5) return `Less than half of what ${group} got.`;
  return `About ${times(1 / ratio)}× less than ${group}.`;
}

/** Card 1 second line: the change from the comparison period. */
export function spendChange(now: number | null, before: number | null, since: string): string {
  if (now == null || before == null) return '';
  const d = Math.round(now - before);
  if (d === 0) return `The same per person as ${since}.`;
  return `${d > 0 ? 'Up' : 'Down'} ${fmtPeso(Math.abs(d))} per person from ${since}.`;
}

/** What the comparison period is called in "Up ₱X per person from …". */
export function sinceWords(prev: Pick<PeriodDef, 'id' | 'label'> | null, per: Pick<PeriodDef, 'id'>): string {
  if (!prev) return '';
  switch (per.id) {
    case 'latest': return 'the year before';
    case 'last3': return 'the previous 3 years';
    case 'marcos': return 'the previous president’s term';
    default: return prev.label;
  }
}

/** "4 in 10", from a percentage. Under 5% there is no honest "N in 10". */
export function inTen(pctValue: number): string {
  if (pctValue < 5) return 'fewer than 1 in 20';
  const n = Math.round(pctValue / 10);
  return n >= 10 ? 'nearly all' : `about ${n} in 10`;
}

/** Card 2 answer: "About 4 in 10 people are poor." */
export function povertyAnswer(pctValue: number | null): string {
  if (pctValue == null) return 'We don’t have a poverty figure for this place.';
  return `${cap(inTen(pctValue))} people are poor.`;
}

/** Peer-table cell: "4 in 10 (38.9%)". */
export function povertyCell(pctValue: number | null): string {
  if (pctValue == null) return '—';
  return `${inTen(pctValue).replace(/^about /, '')} (${pctValue.toFixed(1)}%)`;
}

/**
 * Compare a value with the group's middle value. Within `tolerance` → "same".
 * Returns which side it is on, for the wording helpers below.
 */
export function side(value: number | null, middle: number | null, tolerance: number): 'more' | 'less' | 'same' | null {
  if (value == null || middle == null) return null;
  if (Math.abs(value - middle) <= tolerance) return 'same';
  return value > middle ? 'more' : 'less';
}

/** Card 2 comparison (poverty %, tolerance 1 point). */
export function povertyComparison(pctValue: number | null, middle: number | null, group: string): string {
  const s = side(pctValue, middle, 1);
  if (!s) return '';
  return s === 'same' ? `About the same as ${group}.` : s === 'more' ? `More than most ${group}.` : `Fewer than most ${group}.`;
}

/** Card 2 trend, with the status class for color and icon. Higher poverty = worse. */
export function povertyTrend(now: number | null, before: number | null, beforeYear: number | null): { text: string; status: 'worse' | 'better' | 'same' } | null {
  if (now == null || before == null || beforeYear == null) return null;
  const d = now - before;
  if (Math.abs(d) < 0.5) return { text: `About the same as in ${beforeYear}.`, status: 'same' };
  return d > 0 ? { text: `Got worse since ${beforeYear}.`, status: 'worse' } : { text: `Got better since ${beforeYear}.`, status: 'better' };
}

/** Card 3 answer. ≥75% "Yes", 50–75% "Mostly", <50% "No". */
export function top3Answer(share: number | null): string {
  if (share == null) return 'No company data for this period.';
  const lead = share >= 0.75 ? 'Yes' : share >= 0.5 ? 'Mostly' : 'No';
  return `${lead}. The 3 biggest got ${pct(share)}.`;
}

/** Card 3 comparison (share 0–1, tolerance 2 points). */
export function top3Comparison(share: number | null, middle: number | null, group: string): string {
  const s = side(share, middle, 0.02);
  if (!s) return '';
  return s === 'same' ? `About the same as ${group}.` : s === 'more' ? `More concentrated than most ${group}.` : `More spread out than most ${group}.`;
}

export function companiesLine(n: number): string {
  return n === 0 ? '' : n === 1 ? 'Only 1 company got work.' : `${n.toLocaleString('en-PH')} companies got work in total.`;
}

/** Card 4 answer: "67 of 150 projects are done." */
export function completionAnswer(done: number, known: number): string {
  if (!known) return 'No project status is listed for this period.';
  const n = (x: number) => x.toLocaleString('en-PH');
  return known === 1 ? `${done} of 1 project is done.` : `${n(done)} of ${n(known)} projects ${done === 1 ? 'is' : 'are'} done.`;
}

/** Card 4 second line: why the rest isn't done yet. */
export function unfinishedLine(u: { year: number; ongoing: number; notStarted: number }): string {
  const out: string[] = [];
  if (u.ongoing) out.push(`${u.ongoing.toLocaleString('en-PH')} of the rest ${u.ongoing === 1 ? 'was' : 'were'} approved in ${u.year} and ${u.ongoing === 1 ? 'is' : 'are'} still being built.`);
  if (u.notStarted) out.push(`${u.notStarted.toLocaleString('en-PH')} ${u.notStarted === 1 ? 'hasn’t' : 'haven’t'} started yet.`);
  return out.join(' ');
}

/**
 * Card 4 comparison (completion rate 0–1, tolerance 2 points). When more than half of the unfinished
 * projects are from the newest year in the period, say so: new projects can't be finished yet.
 */
export function completionComparison(rate: number | null, middle: number | null, group: string, o: { name: string; unfinished: number; newUnfinished: number }): string {
  const s = side(rate, middle, 0.02);
  if (!s) return '';
  const base = s === 'same' ? `About as many finished as ${group}` : s === 'more' ? `More finished than most ${group}` : `Fewer finished than most ${group}`;
  const isNew = s === 'less' && o.unfinished > 0 && o.newUnfinished / o.unfinished > 0.5;
  return isNew ? `${base}, but most of ${o.name}’s unfinished projects are new.` : `${base}.`;
}

const cap = (x: string) => x[0].toUpperCase() + x.slice(1);

/** Category bars: this place's money per person for one type of work vs the group's typical value (same 0.85/1.15 bands). */
export function categoryComparison(mine: number, typical: number | null, group: string): string {
  if (typical == null) return '';
  if (typical === 0) return mine > 0 ? `More than ${group} (most got none).` : `None, like most ${group}.`;
  const r = mine / typical;
  return r >= 1.15 ? `More than ${group}.` : r >= 0.85 ? `About the same as ${group}.` : `Less than ${group}.`;
}
